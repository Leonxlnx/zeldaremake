package dev.vista.client.render;

import com.mojang.blaze3d.platform.GlStateManager;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.BufferUploader;
import com.mojang.blaze3d.pipeline.RenderTarget;
import dev.vista.client.VistaClient;
import dev.vista.client.VistaConfig;
import dev.vista.client.world.BiomeRegistry;
import dev.vista.client.world.StateRegistry;
import dev.vista.core.Dir;
import dev.vista.core.RangeAllocator;
import dev.vista.core.SectionKey;
import dev.vista.core.engine.DrawList;
import dev.vista.core.engine.LodEngine;
import dev.vista.core.mesh.MeshData;
import it.unimi.dsi.fastutil.longs.Long2LongMap;
import it.unimi.dsi.fastutil.longs.Long2LongOpenHashMap;
import it.unimi.dsi.fastutil.longs.Long2ObjectMap;
import it.unimi.dsi.fastutil.longs.Long2ObjectOpenHashMap;
import it.unimi.dsi.fastutil.longs.LongOpenHashSet;
import it.unimi.dsi.fastutil.objects.ObjectIterator;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.client.renderer.texture.TextureAtlas;
import net.minecraft.world.phys.Vec3;
import org.joml.FrustumIntersection;
import org.joml.Matrix4f;
import org.lwjgl.opengl.GL;
import org.lwjgl.opengl.GL11C;
import org.lwjgl.opengl.GL13C;
import org.lwjgl.opengl.GL15C;
import org.lwjgl.opengl.GL20C;
import org.lwjgl.opengl.GL30C;
import org.lwjgl.opengl.GL31C;
import org.lwjgl.opengl.GL33C;
import org.lwjgl.opengl.GL40C;
import org.lwjgl.opengl.GL43C;
import org.lwjgl.opengl.GL45C;
import org.lwjgl.opengl.GLCapabilities;
import org.lwjgl.system.MemoryUtil;

import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.Arrays;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Draws the far terrain. All section meshes live in one shader-storage buffer; each frame the visible,
 * camera-facing face groups of the current selection are turned into one {@code glMultiDrawArraysIndirect}
 * for opaque terrain and one for (back-to-front sorted) translucent terrain. The pass renders into its own
 * multisampled target with a reversed-Z, infinite-far projection and a 32-bit float depth buffer (no depth
 * fighting at any distance), then is composited under vanilla terrain with premultiplied alpha.
 */
public final class LodRenderer implements AutoCloseable {
    private static final float NEAR = 0.5f;
    private static final int META_STRIDE = 32;
    private static final int CMD_STRIDE = 16;

    private record PendingMesh(long key, MeshData mesh, int version) {}

    private static final class GpuSection {
        int offset = -1;
        int quads;
        int[] groups;
        int version = -1;
        long lastUsed;
    }

    private final LodEngine engine;
    private final StateRegistry states;
    private final BiomeRegistry biomes;
    private final VistaConfig config;
    private final ConcurrentLinkedQueue<PendingMesh> meshQueue = new ConcurrentLinkedQueue<>();
    private final AtomicLong queuedBytes = new AtomicLong();
    private final Long2ObjectOpenHashMap<GpuSection> sections = new Long2ObjectOpenHashMap<>();
    private final BlockAppearance appearance = new BlockAppearance();
    private final VanillaMask mask = new VanillaMask();

    private boolean initialised, failed;
    private boolean clipControl;
    private GlProgram lodProgram, compositeProgram;
    private int quadBuffer, metaBuffer, indirectBuffer, vao, emptyVao;
    private RangeAllocator allocator;
    private long maxQuads;
    private int fbo, colorRb, depthRb, resolveFbo, resolveTex, fbW, fbH, fbSamples;

    private DrawList current = DrawList.EMPTY;
    private LongOpenHashSet currentSet = new LongOpenHashSet();
    private final Long2LongOpenHashMap fadeIn = new Long2LongOpenHashMap();
    private final Long2LongOpenHashMap fadeOut = new Long2LongOpenHashMap();
    private final it.unimi.dsi.fastutil.longs.Long2ByteOpenHashMap fadeSeams = new it.unimi.dsi.fastutil.longs.Long2ByteOpenHashMap();

    private ByteBuffer meta = MemoryUtil.memAlloc(64 * 1024);
    private ByteBuffer cmds = MemoryUtil.memAlloc(64 * 1024);
    private ByteBuffer staging = MemoryUtil.memAlloc(1 << 20);
    private long[] transKeys = new long[1024];
    private double[] transDist = new double[1024];
    private int[] transMeta = new int[1024];
    private long frame;

    // Stats for the debug overlay / benchmarks.
    public volatile int statVisible, statCommands, statSelected, statTransCommands;
    public volatile long statQuadsDrawn, statUploadBytes, statGpuBytes;
    public volatile double statCpuMs;

    public LodRenderer(LodEngine engine, StateRegistry states, BiomeRegistry biomes, VistaConfig config) {
        this.engine = engine;
        this.states = states;
        this.biomes = biomes;
        this.config = config;
        engine.setMeshSink(this::enqueueMesh);
        engine.setVanillaCoverage(mask);
    }

    public static boolean isSupported() {
        GLCapabilities caps = GL.getCapabilities();
        return caps.OpenGL43;
    }

    public void markResourcesReloaded() { appearance.markReload(); }

    private void enqueueMesh(long key, MeshData mesh, int version) {
        meshQueue.add(new PendingMesh(key, mesh, version));
        queuedBytes.addAndGet(mesh.quadCount() * 8L);
    }

    public int queuedMeshes() { return meshQueue.size(); }

    private boolean init() {
        if (initialised) return true;
        if (failed) return false;
        try {
            if (!isSupported()) throw new IllegalStateException("OpenGL 4.3 is required (shader storage buffers, multi-draw indirect)");
            GLCapabilities caps = GL.getCapabilities();
            clipControl = caps.OpenGL45 || caps.GL_ARB_clip_control;
            lodProgram = new GlProgram("lod.vsh", "lod.fsh");
            compositeProgram = new GlProgram("composite.vsh", "composite.fsh");
            long maxBlock = GL43C.glGetInteger64(GL43C.GL_MAX_SHADER_STORAGE_BLOCK_SIZE);
            maxQuads = Math.min((long) config.maxGpuMemoryMiB * 1048576L, maxBlock) / 8;
            int initial = (int) Math.min(maxQuads, (long) config.gpuMemoryMiB * 1048576L / 8);
            quadBuffer = GL15C.glGenBuffers();
            GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, quadBuffer);
            GL15C.glBufferData(GL43C.GL_SHADER_STORAGE_BUFFER, initial * 8L, GL15C.GL_DYNAMIC_DRAW);
            GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, 0);
            allocator = new RangeAllocator(initial);
            metaBuffer = GL15C.glGenBuffers();
            indirectBuffer = GL15C.glGenBuffers();
            vao = GL30C.glGenVertexArrays();
            GL30C.glBindVertexArray(vao);
            GL15C.glBindBuffer(GL15C.GL_ARRAY_BUFFER, metaBuffer);
            GL15C.glBufferData(GL15C.GL_ARRAY_BUFFER, 64 * 1024, GL15C.GL_STREAM_DRAW);
            GL20C.glEnableVertexAttribArray(0);
            GL20C.glVertexAttribPointer(0, 4, GL11C.GL_FLOAT, false, META_STRIDE, 0);
            GL33C.glVertexAttribDivisor(0, 1);
            GL20C.glEnableVertexAttribArray(1);
            GL20C.glVertexAttribPointer(1, 4, GL11C.GL_FLOAT, false, META_STRIDE, 16);
            GL33C.glVertexAttribDivisor(1, 1);
            GL30C.glBindVertexArray(0);
            GL15C.glBindBuffer(GL15C.GL_ARRAY_BUFFER, 0);
            emptyVao = GL30C.glGenVertexArrays();
            initialised = true;
            VistaClient.LOG.info("Vista renderer ready: GL {}, {} MiB geometry buffer (max {} MiB), clip control {}",
                    GL11C.glGetString(GL11C.GL_VERSION), initial * 8L >> 20, maxQuads * 8 >> 20, clipControl);
            return true;
        } catch (Throwable t) {
            failed = true;
            VistaClient.LOG.error("Vista renderer disabled", t);
            return false;
        }
    }

    // ------------------------------------------------------------------------------------------ frame

    public void render(Matrix4f modelView, Matrix4f projection, Camera camera) {
        if (!init()) return;
        long t0 = System.nanoTime();
        frame++;
        Minecraft mc = Minecraft.getInstance();
        ClientLevel level = mc.level;
        if (level == null) return;
        Vec3 cam = camera.getPosition();
        engine.setCamera(cam.x, cam.y, cam.z);
        int camCX = (int) Math.floor(cam.x) >> 4, camCZ = (int) Math.floor(cam.z) >> 4;
        mask.update(level, camCX, camCZ, mc.options.getEffectiveRenderDistance());
        appearance.update(states, biomes, level);
        processUploads();
        long now = System.currentTimeMillis();
        updateDrawList(now);
        if ((frame & 63) == 0) evictStale(now);

        RenderTarget main = mc.getMainRenderTarget();
        ensureFramebuffer(main.width, main.height);

        Matrix4f vp = new Matrix4f(projection).mul(modelView);
        // Replace the depth row with z' = near * w: reversed, infinite-far depth that keeps any view bobbing
        // or zoom already baked into vanilla's projection.
        vp.m02(NEAR * vp.m03()).m12(NEAR * vp.m13()).m22(NEAR * vp.m23()).m32(NEAR * vp.m33());
        FrustumIntersection frustum = new FrustumIntersection(vp, false);

        int opaqueCmds = buildCommands(cam, frustum, now);
        int transCmds = cmdCount - opaqueCmds;

        drawPass(vp, cam, camCX, camCZ, opaqueCmds, transCmds, main);
        statCpuMs = (System.nanoTime() - t0) / 1e6;
    }

    private void ensureFramebuffer(int w, int h) {
        int samples = Math.max(1, Math.min(config.msaa, GL11C.glGetInteger(GL30C.GL_MAX_SAMPLES)));
        if (fbo != 0 && w == fbW && h == fbH && samples == fbSamples) return;
        deleteFramebuffer();
        fbW = w;
        fbH = h;
        fbSamples = samples;
        fbo = GL30C.glGenFramebuffers();
        colorRb = GL30C.glGenRenderbuffers();
        depthRb = GL30C.glGenRenderbuffers();
        GL30C.glBindRenderbuffer(GL30C.GL_RENDERBUFFER, colorRb);
        GL30C.glRenderbufferStorageMultisample(GL30C.GL_RENDERBUFFER, samples, GL11C.GL_RGBA8, w, h);
        GL30C.glBindRenderbuffer(GL30C.GL_RENDERBUFFER, depthRb);
        GL30C.glRenderbufferStorageMultisample(GL30C.GL_RENDERBUFFER, samples, GL30C.GL_DEPTH_COMPONENT32F, w, h);
        GL30C.glBindRenderbuffer(GL30C.GL_RENDERBUFFER, 0);
        GlStateManager._glBindFramebuffer(GL30C.GL_FRAMEBUFFER, fbo);
        GL30C.glFramebufferRenderbuffer(GL30C.GL_FRAMEBUFFER, GL30C.GL_COLOR_ATTACHMENT0, GL30C.GL_RENDERBUFFER, colorRb);
        GL30C.glFramebufferRenderbuffer(GL30C.GL_FRAMEBUFFER, GL30C.GL_DEPTH_ATTACHMENT, GL30C.GL_RENDERBUFFER, depthRb);
        resolveTex = GL11C.glGenTextures();
        GlStateManager._bindTexture(resolveTex);
        GL11C.glTexImage2D(GL11C.GL_TEXTURE_2D, 0, GL11C.GL_RGBA8, w, h, 0, GL11C.GL_RGBA, GL11C.GL_UNSIGNED_BYTE, (ByteBuffer) null);
        GL11C.glTexParameteri(GL11C.GL_TEXTURE_2D, GL11C.GL_TEXTURE_MIN_FILTER, GL11C.GL_NEAREST);
        GL11C.glTexParameteri(GL11C.GL_TEXTURE_2D, GL11C.GL_TEXTURE_MAG_FILTER, GL11C.GL_NEAREST);
        GlStateManager._bindTexture(0);
        resolveFbo = GL30C.glGenFramebuffers();
        GlStateManager._glBindFramebuffer(GL30C.GL_FRAMEBUFFER, resolveFbo);
        GL30C.glFramebufferTexture2D(GL30C.GL_FRAMEBUFFER, GL30C.GL_COLOR_ATTACHMENT0, GL11C.GL_TEXTURE_2D, resolveTex, 0);
        GlStateManager._glBindFramebuffer(GL30C.GL_FRAMEBUFFER, 0);
    }

    private void deleteFramebuffer() {
        if (fbo != 0) GL30C.glDeleteFramebuffers(fbo);
        if (resolveFbo != 0) GL30C.glDeleteFramebuffers(resolveFbo);
        if (colorRb != 0) GL30C.glDeleteRenderbuffers(colorRb);
        if (depthRb != 0) GL30C.glDeleteRenderbuffers(depthRb);
        if (resolveTex != 0) GL11C.glDeleteTextures(resolveTex);
        fbo = resolveFbo = colorRb = depthRb = resolveTex = 0;
    }

    // ------------------------------------------------------------------------------------------ streaming

    private void processUploads() {
        long budget = (long) (config.uploadBudgetMiB * 1048576);
        long used = 0;
        PendingMesh pm;
        while (used < budget && (pm = meshQueue.poll()) != null) {
            queuedBytes.addAndGet(-pm.mesh.quadCount() * 8L);
            GpuSection g = sections.get(pm.key);
            if (g != null && pm.version < g.version) continue;
            if (pm.mesh.isEmpty()) {
                if (g != null) {
                    if (g.offset >= 0) allocator.free(g.offset, g.quads);
                    sections.remove(pm.key);
                }
                engine.onMeshUploaded(pm.key, pm.version, true);
                continue;
            }
            int quads = pm.mesh.quadCount();
            int off = allocate(quads);
            if (off < 0) {
                VistaClient.LOG.warn("Vista geometry buffer full ({} MiB); raise maxGpuMemoryMiB or lower detail", allocator.capacity() * 8L >> 20);
                continue;
            }
            upload(off, pm.mesh.quads);
            if (g == null) {
                g = new GpuSection();
                sections.put(pm.key, g);
            } else if (g.offset >= 0) {
                allocator.free(g.offset, g.quads);
            }
            g.offset = off;
            g.quads = quads;
            g.groups = pm.mesh.groupStart;
            g.version = pm.version;
            g.lastUsed = System.currentTimeMillis();
            engine.onMeshUploaded(pm.key, pm.version, false);
            used += quads * 8L;
        }
        statUploadBytes = used;
        statGpuBytes = allocator.used() * 8;
    }

    private void upload(int offsetQuads, int[] quads) {
        int bytes = quads.length * 4;
        if (staging.capacity() < bytes) {
            MemoryUtil.memFree(staging);
            staging = MemoryUtil.memAlloc(Math.max(bytes, staging.capacity() * 2));
        }
        staging.clear();
        staging.asIntBuffer().put(quads);
        staging.limit(bytes);
        GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, quadBuffer);
        GL15C.glBufferSubData(GL43C.GL_SHADER_STORAGE_BUFFER, offsetQuads * 8L, staging);
        GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, 0);
    }

    private int allocate(int quads) {
        int off = allocator.allocate(quads);
        if (off >= 0) return off;
        evictUnused(quads);
        off = allocator.allocate(quads);
        if (off >= 0) return off;
        if (allocator.capacity() < maxQuads) {
            long target = Math.min(maxQuads, Math.max((long) allocator.capacity() * 3 / 2, (long) allocator.capacity() + quads * 4L));
            growBuffer((int) target);
            off = allocator.allocate(quads);
        }
        return off;
    }

    private void growBuffer(int newQuads) {
        int old = allocator.capacity();
        int nb = GL15C.glGenBuffers();
        GL15C.glBindBuffer(GL31C.GL_COPY_WRITE_BUFFER, nb);
        GL15C.glBufferData(GL31C.GL_COPY_WRITE_BUFFER, newQuads * 8L, GL15C.GL_DYNAMIC_DRAW);
        GL15C.glBindBuffer(GL31C.GL_COPY_READ_BUFFER, quadBuffer);
        GL31C.glCopyBufferSubData(GL31C.GL_COPY_READ_BUFFER, GL31C.GL_COPY_WRITE_BUFFER, 0, 0, old * 8L);
        GL15C.glBindBuffer(GL31C.GL_COPY_READ_BUFFER, 0);
        GL15C.glBindBuffer(GL31C.GL_COPY_WRITE_BUFFER, 0);
        GL15C.glDeleteBuffers(quadBuffer);
        quadBuffer = nb;
        allocator.grow(newQuads);
        VistaClient.LOG.info("Vista geometry buffer grown to {} MiB", newQuads * 8L >> 20);
    }

    /** Frees least-recently-drawn meshes that are not part of the current selection. */
    private void evictUnused(int needQuads) {
        long[] keys = new long[sections.size()];
        long[] used = new long[sections.size()];
        int n = 0;
        for (Long2ObjectMap.Entry<GpuSection> e : sections.long2ObjectEntrySet()) {
            long k = e.getLongKey();
            if (currentSet.contains(k) || fadeOut.containsKey(k)) continue;
            keys[n] = k;
            used[n++] = e.getValue().lastUsed;
        }
        Integer[] order = new Integer[n];
        for (int i = 0; i < n; i++) order[i] = i;
        Arrays.sort(order, (a, b) -> Long.compare(used[a], used[b]));
        long freed = 0;
        for (int i = 0; i < n && (freed < needQuads * 4L || allocator.largestFree() < needQuads); i++) {
            long k = keys[order[i]];
            GpuSection g = sections.remove(k);
            if (g.offset >= 0) {
                allocator.free(g.offset, g.quads);
                freed += g.quads;
            }
            engine.onMeshEvicted(k);
        }
    }

    private void evictStale(long now) {
        ObjectIterator<Long2ObjectMap.Entry<GpuSection>> it = sections.long2ObjectEntrySet().fastIterator();
        while (it.hasNext()) {
            Long2ObjectMap.Entry<GpuSection> e = it.next();
            long k = e.getLongKey();
            if (currentSet.contains(k) || fadeOut.containsKey(k)) continue;
            GpuSection g = e.getValue();
            if (now - g.lastUsed > 20_000) {
                if (g.offset >= 0) allocator.free(g.offset, g.quads);
                it.remove();
                engine.onMeshEvicted(k);
            }
        }
    }

    // ------------------------------------------------------------------------------------------ fades

    private long fadeMs() { return Math.max(1, (long) (config.fadeSeconds * 1000)); }

    private void updateDrawList(long now) {
        DrawList dl = engine.drawList();
        long T = fadeMs();
        if (dl.id != current.id) {
            LongOpenHashSet next = new LongOpenHashSet(Math.max(16, dl.count));
            for (int i = 0; i < dl.count; i++) next.add(dl.keys[i]);
            for (int i = 0; i < current.count; i++) {
                long k = current.keys[i];
                if (next.contains(k)) continue;
                long start = fadeIn.remove(k);
                double tin = start == fadeIn.defaultReturnValue() ? 1.0 : Math.min(1.0, (now - start) / (double) T);
                fadeOut.put(k, now - (long) ((1 - tin) * T));
                fadeSeams.put(k, current.seams[i]);
            }
            for (int i = 0; i < dl.count; i++) {
                long k = dl.keys[i];
                if (currentSet.contains(k)) continue;
                if (fadeOut.containsKey(k)) {
                    double tout = Math.min(1.0, (now - fadeOut.remove(k)) / (double) T);
                    fadeIn.put(k, now - (long) ((1 - tout) * T));
                } else {
                    fadeIn.put(k, now);
                }
            }
            currentSet = next;
            current = dl;
        }
        for (ObjectIterator<Long2LongMap.Entry> it = fadeIn.long2LongEntrySet().fastIterator(); it.hasNext(); ) {
            if (now - it.next().getLongValue() >= T) it.remove();
        }
        for (ObjectIterator<Long2LongMap.Entry> it = fadeOut.long2LongEntrySet().fastIterator(); it.hasNext(); ) {
            Long2LongMap.Entry e = it.next();
            if (now - e.getLongValue() >= T) {
                fadeSeams.remove(e.getLongKey());
                it.remove();
            }
        }
        statSelected = dl.count;
    }

    // ------------------------------------------------------------------------------------------ commands

    private int metaCount, cmdCount;

    /** Fills the meta and command buffers; returns the number of opaque commands (translucent ones follow). */
    private int buildCommands(Vec3 cam, FrustumIntersection frustum, long now) {
        meta.clear();
        cmds.clear();
        metaCount = 0;
        cmdCount = 0;
        int transCount = 0;
        long quadsDrawn = 0;
        long T = fadeMs();
        int visible = 0;
        int total = current.count + fadeOut.size();
        long[] keys = new long[total];
        System.arraycopy(current.keys, 0, keys, 0, current.count);
        int n = current.count;
        for (long k : fadeOut.keySet()) keys[n++] = k;

        for (int i = 0; i < n; i++) {
            long key = keys[i];
            GpuSection g = sections.get(key);
            if (g == null || g.offset < 0) continue;
            int level = SectionKey.level(key);
            int size = SectionKey.size(level);
            double x0 = SectionKey.minBlockX(key), y0 = SectionKey.minBlockY(key), z0 = SectionKey.minBlockZ(key);
            float rx = (float) (x0 - cam.x), ry = (float) (y0 - cam.y), rz = (float) (z0 - cam.z);
            if (!frustum.testAab(rx, ry, rz, rx + size, ry + size, rz + size)) continue;
            g.lastUsed = now;
            float mode, t;
            boolean fading = i >= current.count;
            if (fading) {
                mode = 2;
                t = (float) Math.min(1.0, (now - fadeOut.get(key)) / (double) T);
            } else if (fadeIn.containsKey(key)) {
                mode = 1;
                t = (float) Math.min(1.0, (now - fadeIn.get(key)) / (double) T);
            } else {
                mode = 0;
                t = 1;
            }
            int metaIndex = metaCount++;
            ensureMeta();
            meta.putFloat(rx).putFloat(ry).putFloat(rz).putFloat(1 << level)
                    .putFloat(t).putFloat(mode).putFloat(level).putFloat(0);
            visible++;
            int[] gs = g.groups;
            int seamMask = fading ? fadeSeams.get(key) : current.seams[i];
            for (int d = 0; d < Dir.COUNT; d++) {
                if (!facesCamera(d, x0, y0, z0, size, cam)) continue;
                int start = gs[MeshData.normalGroup(d)];
                int count = gs[MeshData.normalGroup(d) + 1] - start;
                int seam = gs[MeshData.seamGroup(d) + 1] - gs[MeshData.seamGroup(d)];
                if (seam > 0 && (seamMask & (1 << d)) != 0) count += seam;
                if (count == 0) continue;
                addCommand(count, g.offset + start, metaIndex);
                quadsDrawn += count;
            }
            int tc = gs[MeshData.GROUPS] - gs[MeshData.TRANSLUCENT_GROUP];
            if (tc > 0) {
                if (transCount == transKeys.length) {
                    transKeys = Arrays.copyOf(transKeys, transCount * 2);
                    transDist = Arrays.copyOf(transDist, transCount * 2);
                    transMeta = Arrays.copyOf(transMeta, transCount * 2);
                }
                double cx = rx + size * 0.5, cy = ry + size * 0.5, cz = rz + size * 0.5;
                transKeys[transCount] = key;
                transDist[transCount] = cx * cx + cy * cy + cz * cz;
                transMeta[transCount++] = metaIndex;
            }
        }
        int opaqueCmds = cmdCount;
        statTransCommands = transCount;
        if (transCount > 0) {
            Integer[] order = new Integer[transCount];
            for (int i = 0; i < transCount; i++) order[i] = i;
            double[] dist = transDist;
            Arrays.sort(order, (a, b) -> Double.compare(dist[b], dist[a]));
            for (int oi : order) {
                GpuSection g = sections.get(transKeys[oi]);
                int start = g.groups[MeshData.TRANSLUCENT_GROUP];
                int count = g.groups[MeshData.GROUPS] - start;
                addCommand(count, g.offset + start, transMeta[oi]);
                quadsDrawn += count;
            }
        }
        statVisible = visible;
        statCommands = cmdCount;
        statQuadsDrawn = quadsDrawn;
        return opaqueCmds;
    }

    private static boolean facesCamera(int d, double x0, double y0, double z0, int size, Vec3 cam) {
        return switch (d) {
            case Dir.DOWN -> cam.y < y0 + size;
            case Dir.UP -> cam.y > y0;
            case Dir.NORTH -> cam.z < z0 + size;
            case Dir.SOUTH -> cam.z > z0;
            case Dir.WEST -> cam.x < x0 + size;
            default -> cam.x > x0;
        };
    }

    private void ensureMeta() {
        if (meta.remaining() < META_STRIDE) {
            ByteBuffer nb = MemoryUtil.memAlloc(meta.capacity() * 2);
            meta.flip();
            nb.put(meta);
            MemoryUtil.memFree(meta);
            meta = nb;
        }
    }

    private void addCommand(int quads, int firstQuad, int metaIndex) {
        if (cmds.remaining() < CMD_STRIDE) {
            ByteBuffer nb = MemoryUtil.memAlloc(cmds.capacity() * 2);
            cmds.flip();
            nb.put(cmds);
            MemoryUtil.memFree(cmds);
            cmds = nb;
        }
        cmds.putInt(quads * 6).putInt(1).putInt(firstQuad * 6).putInt(metaIndex);
        cmdCount++;
    }

    // ------------------------------------------------------------------------------------------ GL pass

    private void drawPass(Matrix4f vp, Vec3 cam, int camCX, int camCZ, int opaqueCmds, int transCmds, RenderTarget main) {
        Minecraft mc = Minecraft.getInstance();
        meta.flip();
        cmds.flip();
        GL15C.glBindBuffer(GL15C.GL_ARRAY_BUFFER, metaBuffer);
        GL15C.glBufferData(GL15C.GL_ARRAY_BUFFER, Math.max(meta.limit(), 64), GL15C.GL_STREAM_DRAW);
        if (meta.limit() > 0) GL15C.glBufferSubData(GL15C.GL_ARRAY_BUFFER, 0, meta);
        GL15C.glBindBuffer(GL15C.GL_ARRAY_BUFFER, 0);
        GL15C.glBindBuffer(GL40C.GL_DRAW_INDIRECT_BUFFER, indirectBuffer);
        GL15C.glBufferData(GL40C.GL_DRAW_INDIRECT_BUFFER, Math.max(cmds.limit(), 64), GL15C.GL_STREAM_DRAW);
        if (cmds.limit() > 0) GL15C.glBufferSubData(GL40C.GL_DRAW_INDIRECT_BUFFER, 0, cmds);

        GlStateManager._glBindFramebuffer(GL30C.GL_FRAMEBUFFER, fbo);
        GlStateManager._viewport(0, 0, fbW, fbH);
        GL11C.glClearColor(0, 0, 0, 0);
        GL11C.glClearDepth(0.0);
        GlStateManager._depthMask(true);
        GL11C.glClear(GL11C.GL_COLOR_BUFFER_BIT | GL11C.GL_DEPTH_BUFFER_BIT);
        GL11C.glClearDepth(1.0);

        if (opaqueCmds + transCmds > 0) {
            if (clipControl) GL45C.glClipControl(GL20C.GL_LOWER_LEFT, GL45C.GL_ZERO_TO_ONE);
            RenderSystem.enableDepthTest();
            GlStateManager._depthFunc(GL11C.GL_GREATER);
            RenderSystem.enableCull();
            RenderSystem.disableBlend();

            GL20C.glUseProgram(lodProgram.id);
            try (var stack = org.lwjgl.system.MemoryStack.stackPush()) {
                FloatBuffer m = stack.mallocFloat(16);
                vp.get(m);
                GL20C.glUniformMatrix4fv(lodProgram.uniform("uViewProj"), false, m);
            }
            double fx = cam.x - Math.floor(cam.x), fy = cam.y - Math.floor(cam.y), fz = cam.z - Math.floor(cam.z);
            GL20C.glUniform3f(lodProgram.uniform("uCamFrac"), (float) fx, (float) fy, (float) fz);
            float[] fogColor = RenderSystem.getShaderFogColor();
            GL20C.glUniform4f(lodProgram.uniform("uFogColor"), fogColor[0], fogColor[1], fogColor[2], fogColor[3]);
            GL20C.glUniform3f(lodProgram.uniform("uFog"), RenderSystem.getShaderFogStart(), RenderSystem.getShaderFogEnd(), VistaClient.hazeStrength());
            GL20C.glUniform2i(lodProgram.uniform("uCamChunk"), camCX, camCZ);
            GL20C.glUniform2f(lodProgram.uniform("uCamChunkOffset"), (float) (cam.x - camCX * 16.0), (float) (cam.z - camCZ * 16.0));
            GL20C.glUniform1f(lodProgram.uniform("uVanillaRadius"), (mask.radiusChunks() + 1) * 16f * 1.4143f);
            GL20C.glUniform2f(lodProgram.uniform("uAtlasSize"), appearance.atlasWidth(), appearance.atlasHeight());
            GL20C.glUniform1i(lodProgram.uniform("uTextures"), config.textures ? 1 : 0);
            GL20C.glUniform1i(lodProgram.uniform("uDebug"), config.debugView);
            GL20C.glUniform1i(lodProgram.uniform("uAtlas"), 0);
            GL20C.glUniform1i(lodProgram.uniform("uLightmap"), 1);
            GL20C.glUniform1i(lodProgram.uniform("uVanillaMask"), 2);

            GlStateManager._activeTexture(GL13C.GL_TEXTURE0);
            GlStateManager._bindTexture(mc.getTextureManager().getTexture(TextureAtlas.LOCATION_BLOCKS).getId());
            GlStateManager._activeTexture(GL13C.GL_TEXTURE1);
            mc.gameRenderer.lightTexture().turnOnLightLayer();
            GlStateManager._bindTexture(RenderSystem.getShaderTexture(2));
            GlStateManager._activeTexture(GL13C.GL_TEXTURE2);
            GlStateManager._bindTexture(mask.texture());

            GL30C.glBindBufferBase(GL43C.GL_SHADER_STORAGE_BUFFER, 0, quadBuffer);
            GL30C.glBindBufferBase(GL43C.GL_SHADER_STORAGE_BUFFER, 1, appearance.stateBuffer());
            GL30C.glBindBufferBase(GL43C.GL_SHADER_STORAGE_BUFFER, 2, appearance.biomeBuffer());
            GL30C.glBindVertexArray(vao);

            if (opaqueCmds > 0) {
                GL20C.glUniform1f(lodProgram.uniform("uAlpha"), 1f);
                GL43C.glMultiDrawArraysIndirect(GL11C.GL_TRIANGLES, 0L, opaqueCmds, CMD_STRIDE);
            }
            if (transCmds > 0) {
                GL20C.glUniform1f(lodProgram.uniform("uAlpha"), -1f);
                RenderSystem.enableBlend();
                GlStateManager._blendFuncSeparate(GL11C.GL_ONE, GL11C.GL_ONE_MINUS_SRC_ALPHA, GL11C.GL_ONE, GL11C.GL_ONE_MINUS_SRC_ALPHA);
                GlStateManager._depthMask(false);
                GL43C.glMultiDrawArraysIndirect(GL11C.GL_TRIANGLES, (long) opaqueCmds * CMD_STRIDE, transCmds, CMD_STRIDE);
                GlStateManager._depthMask(true);
            }

            GL30C.glBindVertexArray(0);
            for (int i = 0; i < 3; i++) GL30C.glBindBufferBase(GL43C.GL_SHADER_STORAGE_BUFFER, i, 0);
            if (clipControl) GL45C.glClipControl(GL20C.GL_LOWER_LEFT, GL45C.GL_NEGATIVE_ONE_TO_ONE);
            GlStateManager._depthFunc(GL11C.GL_LEQUAL);
        }
        GL15C.glBindBuffer(GL40C.GL_DRAW_INDIRECT_BUFFER, 0);

        // Resolve MSAA, then composite under vanilla terrain (which has not been drawn yet this frame).
        GlStateManager._glBindFramebuffer(GL30C.GL_READ_FRAMEBUFFER, fbo);
        GlStateManager._glBindFramebuffer(GL30C.GL_DRAW_FRAMEBUFFER, resolveFbo);
        GL30C.glBlitFramebuffer(0, 0, fbW, fbH, 0, 0, fbW, fbH, GL11C.GL_COLOR_BUFFER_BIT, GL11C.GL_NEAREST);
        main.bindWrite(true);
        RenderSystem.disableDepthTest();
        RenderSystem.enableBlend();
        GlStateManager._blendFuncSeparate(GL11C.GL_ONE, GL11C.GL_ONE_MINUS_SRC_ALPHA, GL11C.GL_ZERO, GL11C.GL_ONE);
        GL20C.glUseProgram(compositeProgram.id);
        GL20C.glUniform1i(compositeProgram.uniform("uColor"), 0);
        GlStateManager._activeTexture(GL13C.GL_TEXTURE0);
        GlStateManager._bindTexture(resolveTex);
        GL30C.glBindVertexArray(emptyVao);
        GL11C.glDrawArrays(GL11C.GL_TRIANGLES, 0, 3);
        GL30C.glBindVertexArray(0);

        // Hand the GL state back exactly as vanilla expects it.
        GlStateManager._bindTexture(0);
        GlStateManager._activeTexture(GL13C.GL_TEXTURE2);
        GlStateManager._bindTexture(0);
        GlStateManager._activeTexture(GL13C.GL_TEXTURE1);
        GlStateManager._bindTexture(0);
        GlStateManager._activeTexture(GL13C.GL_TEXTURE0);
        RenderSystem.disableBlend();
        RenderSystem.defaultBlendFunc();
        RenderSystem.enableDepthTest();
        GameRenderer.getPositionShader().clear();
        BufferUploader.invalidate();
    }

    @Override
    public void close() {
        if (initialised) {
            deleteFramebuffer();
            GL15C.glDeleteBuffers(quadBuffer);
            GL15C.glDeleteBuffers(metaBuffer);
            GL15C.glDeleteBuffers(indirectBuffer);
            GL30C.glDeleteVertexArrays(vao);
            GL30C.glDeleteVertexArrays(emptyVao);
            lodProgram.close();
            compositeProgram.close();
            appearance.close();
            mask.close();
        }
        MemoryUtil.memFree(meta);
        MemoryUtil.memFree(cmds);
        MemoryUtil.memFree(staging);
        meshQueue.clear();
        sections.clear();
        initialised = false;
    }

    public long gpuBytes() { return statGpuBytes; }
    public long gpuCapacityBytes() { return allocator == null ? 0 : allocator.capacity() * 8L; }
    public long queuedUploadBytes() { return queuedBytes.get(); }
}
