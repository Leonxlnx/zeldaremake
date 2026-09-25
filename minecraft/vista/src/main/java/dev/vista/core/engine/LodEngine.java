package dev.vista.core.engine;

import dev.vista.core.Dir;
import dev.vista.core.Downsampler;
import dev.vista.core.SectionCodec;
import dev.vista.core.SectionKey;
import dev.vista.core.StateClasses;
import dev.vista.core.Voxel;
import dev.vista.core.gen.ColumnSamples;
import dev.vista.core.gen.ColumnSynth;
import dev.vista.core.mesh.GreedyMesher;
import dev.vista.core.mesh.MeshData;
import dev.vista.core.store.SectionStore;

import java.util.Arrays;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * The far-terrain engine: storage, generation, ingestion of real chunks, level propagation, meshing and
 * LOD selection. Minecraft-independent; the client layer supplies a {@link TerrainSource}, a
 * {@link MeshSink} (GPU upload) and a {@link VanillaCoverage} (which chunks vanilla is drawing).
 */
public final class LodEngine implements AutoCloseable {

    public static final class Config {
        public int minY = -64;
        public int maxY = 320;
        public int threads = Math.max(1, Runtime.getRuntime().availableProcessors() - 2);
        public int cacheSections = 768;
        public boolean generate = true;
        /**
         * A node at level L is split into its children while the camera is closer than {@code subdivide * size(L)}.
         * This is the maximum; {@link LodEngine#setDetail} may lower the effective value at runtime.
         */
        public double subdivide = 8;
        public double maxDistance = 32768;

        public int topLevel() {
            int l = 1;
            while (l < SectionKey.MAX_LEVEL && subdivide * SectionKey.size(l) < maxDistance) l++;
            return l;
        }
    }

    /** Thread-safe source of synthetic far terrain. */
    public interface TerrainSource {
        void sample(int level, int sx, int sz, ColumnSamples out);
        ColumnSynth.SurfaceTable surfaces();
        int waterState();
        long seed();
    }

    public interface MeshSink {
        /** Called from a worker thread. */
        void accept(long key, MeshData mesh, int dataVersion);
    }

    public interface VanillaCoverage {
        /** True if vanilla is currently drawing every chunk in the block rectangle (inclusive min, exclusive max). */
        boolean covers(int minX, int minZ, int maxX, int maxZ);
    }

    public static final class Column {
        volatile byte source;
        volatile long mask;

        public byte source() { return source; }
        public long mask() { return mask; }
    }

    public static final class Node {
        final AtomicInteger dataVersion = new AtomicInteger();
        final Request request = new Request();
        volatile int meshVersion = -1;
        volatile boolean uploaded;
        volatile boolean empty = true;
        volatile long lastWanted;
    }

    private final Config config;
    private final SectionStore store;
    private final StateClasses classes;
    private final TerrainSource terrain;
    private final EngineStats stats = new EngineStats();
    private final PriorityExecutor workers;
    private final SectionCache cache;
    private final int topLevel;

    private final ConcurrentHashMap<Long, Boolean> loadedRegions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Column> columns = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, Node> nodes = new ConcurrentHashMap<>();
    private final Set<Long> dirtyRegionMeta = ConcurrentHashMap.newKeySet();
    private final ConcurrentHashMap<Long, Request> pendingGenerate = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, AtomicInteger> pendingPropagate = new ConcurrentHashMap<>();
    private final Object[] sectionLocks = new Object[1024];
    private final Object[] columnLocks = new Object[1024];
    private final ThreadLocal<GreedyMesher> mesher = ThreadLocal.withInitial(GreedyMesher::new);
    private final ThreadLocal<ColumnSamples> samples = ThreadLocal.withInitial(ColumnSamples::new);

    private volatile MeshSink meshSink = (k, m, v) -> {};
    private volatile VanillaCoverage vanilla = (a, b, c, d) -> false;
    private volatile double camX, camY, camZ;
    private volatile boolean selectionDirty = true;
    private volatile DrawList drawList = DrawList.EMPTY;
    private final Thread selectorThread;
    private volatile boolean running = true;
    private long lastMetaFlush = System.nanoTime();
    private long lastGc = System.nanoTime();

    public LodEngine(Config config, SectionStore store, StateClasses classes, TerrainSource terrain, Consumer<Throwable> errors) {
        this.config = config;
        this.store = store;
        this.classes = classes;
        this.terrain = config.generate ? terrain : null;
        this.cache = new SectionCache(config.cacheSections);
        this.topLevel = config.topLevel();
        for (int i = 0; i < sectionLocks.length; i++) sectionLocks[i] = new Object();
        for (int i = 0; i < columnLocks.length; i++) columnLocks[i] = new Object();
        this.workers = new PriorityExecutor("vista-worker", config.threads, errors);
        this.selectorThread = new Thread(() -> selectorLoop(errors), "vista-selector");
        selectorThread.setDaemon(true);
        selectorThread.setPriority(Thread.NORM_PRIORITY - 1);
        selectorThread.start();
    }

    public Config config() { return config; }
    public EngineStats stats() { return stats; }
    public StateClasses classes() { return classes; }
    public int topLevel() { return topLevel; }
    public DrawList drawList() { return drawList; }
    public int pendingJobs() { return workers.pending(); }
    public int nodeCount() { return nodes.size(); }
    public SectionStore store() { return store; }

    public void setMeshSink(MeshSink sink) { this.meshSink = sink; }
    public void setVanillaCoverage(VanillaCoverage v) { this.vanilla = v; }

    public void setCamera(double x, double y, double z) {
        camX = x;
        camY = y;
        camZ = z;
    }

    public void markSelectionDirty() { selectionDirty = true; }

    private volatile double detail = Double.NaN;

    /** Effective detail factor (clamped to the configured maximum); used by adaptive quality. */
    public void setDetail(double d) {
        double v = Math.max(2, Math.min(config.subdivide, d));
        if (v != detail) {
            detail = v;
            selectionDirty = true;
        }
    }

    public double detail() { return Double.isNaN(detail) ? config.subdivide : detail; }

    /** True if the selector needed this node (drawn, or as a split prerequisite) within the last {@code ms}. */
    public boolean recentlyWanted(long key, long ms) {
        Node n = nodes.get(key);
        return n != null && System.currentTimeMillis() - n.lastWanted < ms;
    }

    // ------------------------------------------------------------------------------------------ geometry

    int minSy(int level) { return Math.floorDiv(config.minY, SectionKey.size(level)); }
    int maxSy(int level) { return Math.floorDiv(config.maxY - 1, SectionKey.size(level)); }

    private double distanceTo(long key) {
        int size = SectionKey.size(SectionKey.level(key));
        double x0 = SectionKey.minBlockX(key), y0 = SectionKey.minBlockY(key), z0 = SectionKey.minBlockZ(key);
        double dx = Math.max(0, Math.max(x0 - camX, camX - (x0 + size)));
        double dy = Math.max(0, Math.max(y0 - camY, camY - (y0 + size)));
        double dz = Math.max(0, Math.max(z0 - camZ, camZ - (z0 + size)));
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private boolean vanillaCovers(long key) {
        int size = SectionKey.size(SectionKey.level(key));
        if (size > 256) return false;
        int x0 = SectionKey.minBlockX(key), z0 = SectionKey.minBlockZ(key);
        return vanilla.covers(x0, z0, x0 + size, z0 + size);
    }

    private Object sectionLock(long key) { return sectionLocks[(int) (mixKey(key) & (sectionLocks.length - 1))]; }
    private Object columnLock(long key) { return columnLocks[(int) (mixKey(key) & (columnLocks.length - 1))]; }

    private static long mixKey(long k) {
        k ^= k >>> 33;
        k *= 0xFF51AFD7ED558CCDL;
        return k ^ (k >>> 33);
    }

    // ------------------------------------------------------------------------------------------ index

    private static long regionKey(int level, int rx, int rz) { return SectionKey.columnOf(level, rx, rz); }

    private void ensureRegion(int level, int rx, int rz) {
        loadedRegions.computeIfAbsent(regionKey(level, rx, rz), rk -> {
            byte[] meta = store.readColumns(level, rx, rz);
            for (int i = 0; i < 256; i++) {
                if (meta[i] != SectionStore.COLUMN_UNKNOWN) {
                    Column c = new Column();
                    c.source = meta[i];
                    columns.putIfAbsent(SectionKey.columnOf(level, (rx << 4) | (i & 15), (rz << 4) | (i >> 4)), c);
                }
            }
            store.forEachSection(level, rx, rz, k -> {
                Column c = columns.get(SectionKey.column(k));
                if (c != null) {
                    int bit = SectionKey.y(k) - minSy(level);
                    if (bit >= 0 && bit < 64) {
                        synchronized (c) { c.mask |= 1L << bit; }
                    }
                }
            });
            return Boolean.TRUE;
        });
    }

    /** Returns the column, or null if nothing is known about it. */
    public Column column(int level, int x, int z) {
        ensureRegion(level, x >> 4, z >> 4);
        return columns.get(SectionKey.columnOf(level, x, z));
    }

    private Column columnForWrite(long colKey, byte source) {
        int level = SectionKey.level(colKey), x = SectionKey.x(colKey), z = SectionKey.z(colKey);
        ensureRegion(level, x >> 4, z >> 4);
        Column c = columns.computeIfAbsent(colKey, k -> new Column());
        if (c.source < source) {
            c.source = source;
            dirtyRegionMeta.add(regionKey(level, x >> 4, z >> 4));
        }
        return c;
    }

    private void flushRegionMeta() {
        Iterator<Long> it = dirtyRegionMeta.iterator();
        while (it.hasNext()) {
            long rk = it.next();
            it.remove();
            int level = SectionKey.level(rk), rx = SectionKey.x(rk), rz = SectionKey.z(rk);
            byte[] meta = new byte[256];
            for (int i = 0; i < 256; i++) {
                Column c = columns.get(SectionKey.columnOf(level, (rx << 4) | (i & 15), (rz << 4) | (i >> 4)));
                if (c != null) meta[i] = c.source;
            }
            store.writeColumns(level, rx, rz, meta);
        }
    }

    // ------------------------------------------------------------------------------------------ section IO

    /** Read-only voxels of a section, or null if the section is air. Caller must not modify the array. */
    int[] load(long key) {
        int[] v = cache.get(key);
        if (v != null) return v;
        byte[] data = store.read(key);
        if (data == null) return null;
        v = new int[Voxel.VOLUME];
        SectionCodec.decode(data, v);
        cache.put(key, v);
        return v;
    }

    private int[] loadCopyOrSky(long key) {
        int[] v = load(key);
        if (v != null) return v.clone();
        int[] a = new int[Voxel.VOLUME];
        Arrays.fill(a, Voxel.SKY);
        return a;
    }

    private boolean isEmpty(int[] v) {
        byte[] cls = classes.raw();
        for (int x : v) if (cls[x & 0xFFFF] != StateClasses.AIR) return false;
        return true;
    }

    /** Writes (or deletes, if {@code voxels} is null/empty) a section and updates index and dependants. */
    private void putSection(long key, int[] voxels, byte source) {
        boolean empty = voxels == null || isEmpty(voxels);
        Column c = columnForWrite(SectionKey.column(key), source);
        int bit = SectionKey.y(key) - minSy(SectionKey.level(key));
        boolean had = bit >= 0 && bit < 64 && (c.mask & (1L << bit)) != 0;
        if (empty) {
            if (!had) return;
            store.write(key, null);
            cache.remove(key);
        } else {
            byte[] enc = SectionCodec.encode(voxels);
            store.write(key, enc);
            cache.put(key, voxels);
            stats.bytesWritten.addAndGet(enc.length);
        }
        stats.sectionWrites.incrementAndGet();
        if (bit >= 0 && bit < 64) {
            synchronized (c) {
                c.mask = empty ? c.mask & ~(1L << bit) : c.mask | (1L << bit);
            }
        }
        onSectionChanged(key);
    }

    private void onSectionChanged(long key) {
        long now = System.currentTimeMillis();
        Node n = nodes.computeIfAbsent(key, k -> new Node());
        n.dataVersion.incrementAndGet();
        if (active(n, now)) scheduleRemesh(key, n, now);
        for (int d = 0; d < Dir.COUNT; d++) {
            long nk = SectionKey.neighbor(key, d);
            Node nn = nodes.get(nk);
            if (nn != null) {
                nn.dataVersion.incrementAndGet();
                if (active(nn, now)) scheduleRemesh(nk, nn, now);
            }
        }
        selectionDirty = true;
    }

    /**
     * Only nodes the selector touched recently are remeshed eagerly when their data changes; everything else
     * (e.g. sections under vanilla chunks, which receive a stream of ingests) is remeshed lazily when it is
     * next needed, because the selector compares mesh and data versions.
     */
    private static final long REMESH_DELAY_MS = 700;
    private final ConcurrentHashMap<Long, Long> remeshDue = new ConcurrentHashMap<>();

    /**
     * A node that is on screen keeps its current mesh until the burst of changes around it settles (chunks
     * arrive in bursts, and each also dirties six neighbours); nodes without a mesh are meshed immediately.
     */
    private void scheduleRemesh(long key, Node n, long now) {
        if (!n.uploaded) {
            requestMesh(key, distanceTo(key));
            return;
        }
        remeshDue.putIfAbsent(key, now + REMESH_DELAY_MS);
    }

    private void submitDueRemeshes() {
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<Long, Long>> it = remeshDue.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<Long, Long> e = it.next();
            if (e.getValue() > now) continue;
            it.remove();
            requestMesh(e.getKey(), distanceTo(e.getKey()));
        }
    }

    private static boolean active(Node n, long now) {
        return n.request.isQueued() || (n.uploaded && now - n.lastWanted < 3000);
    }

    // ------------------------------------------------------------------------------------------ generation

    private void requestGenerate(int level, int x, int z, double dist) {
        if (terrain == null) return;
        long colKey = SectionKey.columnOf(level, x, z);
        Request r = pendingGenerate.computeIfAbsent(colKey, k -> new Request());
        int ticket = r.claim(dist * 0.75);
        if (ticket < 0) return;
        workers.submit(dist * 0.75, () -> {
            if (!r.isCurrent(ticket)) return;
            try {
                if (!r.isStale()) generateIfUnknown(colKey);
            } finally {
                pendingGenerate.remove(colKey, r);
            }
        });
    }

    /**
     * De-duplicates queued work for one key while still letting it be re-prioritised: a request with a much
     * better priority than the queued one submits a new job and invalidates the old one (the camera moved
     * towards it); a job nobody has asked for in a while is dropped when it reaches the front of the queue
     * (the camera moved away).
     */
    static final class Request {
        private static final long STALE_MS = 8000;
        private int ticket;
        private boolean queued;
        private double priority;
        private volatile long lastRequested;

        /** Returns a ticket to submit a job with, or -1 if the already queued job is good enough. */
        synchronized int claim(double prio) {
            lastRequested = System.currentTimeMillis();
            if (queued && prio >= priority * 0.6 - 32) return -1;
            queued = true;
            priority = prio;
            return ++ticket;
        }

        synchronized boolean isCurrent(int t) {
            if (t != ticket) return false;
            queued = false;
            return true;
        }

        synchronized boolean isQueued() { return queued; }

        boolean isStale() { return System.currentTimeMillis() - lastRequested > STALE_MS; }

        void touch() { lastRequested = System.currentTimeMillis(); }
    }

    private void generateIfUnknown(long colKey) {
        if (terrain == null) return;
        int level = SectionKey.level(colKey), x = SectionKey.x(colKey), z = SectionKey.z(colKey);
        synchronized (columnLock(colKey)) {
            Column c = column(level, x, z);
            if (c != null && c.source != SectionStore.COLUMN_UNKNOWN) return;
            long t0 = System.nanoTime();
            ColumnSamples cs = samples.get();
            cs.minY = config.minY;
            cs.maxY = config.maxY;
            terrain.sample(level, x, z, cs);
            int[] buf = new int[Voxel.VOLUME];
            for (int sy = minSy(level); sy <= maxSy(level); sy++) {
                long key = SectionKey.of(level, x, sy, z);
                synchronized (sectionLock(key)) {
                    if (ColumnSynth.fill(cs, terrain.surfaces(), terrain.waterState(), level, x, sy, z, buf, terrain.seed())) {
                        putSection(key, buf, SectionStore.COLUMN_GENERATED);
                        buf = new int[Voxel.VOLUME];
                    } else {
                        putSection(key, null, SectionStore.COLUMN_GENERATED);
                    }
                }
            }
            columnForWrite(colKey, SectionStore.COLUMN_GENERATED);
            stats.generatedColumns.incrementAndGet();
            stats.generateNanos.addAndGet(System.nanoTime() - t0);
        }
    }

    // ------------------------------------------------------------------------------------------ ingestion

    /**
     * Ingests one real chunk column. {@code sections[i]} holds 16^3 voxels (index {@code y<<8|z<<4|x}) for chunk
     * section {@code minChunkSectionY + i}, or null if that chunk section is empty air.
     *
     * @param neighboursKnown true when the other three chunks of the 2x2 L0 column are also being ingested,
     *                        so synthesising a base for the column would be wasted work
     */
    public void ingestChunk(int chunkX, int chunkZ, int minChunkSectionY, int[][] sections, boolean neighboursKnown) {
        workers.submit(-1, () -> ingestChunkNow(chunkX, chunkZ, minChunkSectionY, sections, neighboursKnown));
    }

    /** Runs arbitrary work on the engine's worker pool (lower priority value runs first). */
    public void submitWork(double priority, Runnable task) {
        workers.submit(priority, task);
    }

    /** Synchronous variant of {@link #ingestChunk}; call from a worker thread. */
    public void ingestChunkNow(int chunkX, int chunkZ, int minChunkSectionY, int[][] sections, boolean neighboursKnown) {
        doIngest(chunkX, chunkZ, minChunkSectionY, sections, neighboursKnown);
    }

    private void doIngest(int chunkX, int chunkZ, int minCsy, int[][] sections, boolean neighboursKnown) {
        long t0 = System.nanoTime();
        int sx = chunkX >> 1, sz = chunkZ >> 1;
        long colKey = SectionKey.columnOf(0, sx, sz);
        if (!neighboursKnown) generateIfUnknown(colKey);
        int ox = (chunkX & 1) * 16, oz = (chunkZ & 1) * 16;
        for (int sy = minSy(0); sy <= maxSy(0); sy++) {
            long key = SectionKey.of(0, sx, sy, sz);
            synchronized (sectionLock(key)) {
                int[] vox = loadCopyOrSky(key);
                for (int half = 0; half < 2; half++) {
                    int csy = sy * 2 + half;
                    int i = csy - minCsy;
                    int[] src = i >= 0 && i < sections.length ? sections[i] : null;
                    int oy = half * 16;
                    for (int y = 0; y < 16; y++) {
                        for (int z = 0; z < 16; z++) {
                            int dst = Voxel.index(ox, oy + y, oz + z);
                            if (src == null) {
                                Arrays.fill(vox, dst, dst + 16, Voxel.SKY);
                            } else {
                                System.arraycopy(src, y << 8 | z << 4, vox, dst, 16);
                            }
                        }
                    }
                }
                putSection(key, vox, SectionStore.COLUMN_REAL);
            }
            schedulePropagate(key);
        }
        stats.ingestedChunks.incrementAndGet();
        stats.ingestNanos.addAndGet(System.nanoTime() - t0);
    }

    private void schedulePropagate(long child) {
        if (SectionKey.level(child) >= topLevel) return;
        long parent = SectionKey.parent(child);
        int octant = (SectionKey.x(child) & 1) | (SectionKey.y(child) & 1) << 1 | (SectionKey.z(child) & 1) << 2;
        AtomicInteger bits = pendingPropagate.computeIfAbsent(parent, k -> new AtomicInteger());
        bits.getAndUpdate(b -> b | 1 << octant);
        propagateDue.putIfAbsent(parent, System.currentTimeMillis() + PROPAGATE_DELAY_MS);
    }

    /**
     * Parent updates wait a little so that the octants of many freshly ingested chunks are folded into one
     * downsample + write + remesh (loading a world ingests hundreds of chunks per second).
     */
    private static final long PROPAGATE_DELAY_MS = 1500;
    private final ConcurrentHashMap<Long, Long> propagateDue = new ConcurrentHashMap<>();

    private void submitDuePropagations() {
        long now = System.currentTimeMillis();
        for (Iterator<Map.Entry<Long, Long>> it = propagateDue.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<Long, Long> e = it.next();
            if (e.getValue() > now) continue;
            long parent = e.getKey();
            it.remove();
            workers.submit(64 + distanceTo(parent), () -> propagate(parent));
        }
    }

    private void propagate(long parent) {
        AtomicInteger bits = pendingPropagate.remove(parent);
        if (bits == null) return;
        int mask = bits.get();
        long t0 = System.nanoTime();
        generateIfUnknown(SectionKey.column(parent));
        synchronized (sectionLock(parent)) {
            int[] pv = loadCopyOrSky(parent);
            int[] sky = null;
            for (int o = 0; o < 8; o++) {
                if ((mask & (1 << o)) == 0) continue;
                int[] cv = load(SectionKey.child(parent, o));
                if (cv == null) {
                    if (sky == null) {
                        sky = new int[Voxel.VOLUME];
                        Arrays.fill(sky, Voxel.SKY);
                    }
                    cv = sky;
                }
                Downsampler.downsample(cv, pv, o, classes);
            }
            putSection(parent, pv, SectionStore.COLUMN_REAL);
        }
        stats.propagations.incrementAndGet();
        stats.propagateNanos.addAndGet(System.nanoTime() - t0);
        schedulePropagate(parent);
    }

    // ------------------------------------------------------------------------------------------ meshing

    public void requestMesh(long key, double dist) {
        Node n = nodes.computeIfAbsent(key, k -> new Node());
        int ticket = n.request.claim(dist);
        if (ticket < 0) return;
        workers.submit(dist, () -> {
            if (!n.request.isCurrent(ticket)) return;
            if (n.request.isStale() && !n.uploaded) return;
            buildMesh(key, n);
        });
    }

    private void buildMesh(long key, Node n) {
        int version = n.dataVersion.get();
        long t0 = System.nanoTime();
        int[] self = load(key);
        MeshData mesh;
        if (self == null) {
            mesh = MeshData.EMPTY;
        } else {
            int[][] nb = new int[6][];
            int level = SectionKey.level(key);
            for (int d = 0; d < Dir.COUNT; d++) {
                long nk = SectionKey.neighbor(key, d);
                int ny = SectionKey.y(nk);
                if (ny > maxSy(level)) { nb[d] = GreedyMesher.AIR_NEIGHBOR; continue; }
                if (ny < minSy(level)) { nb[d] = null; continue; }
                Column c = column(level, SectionKey.x(nk), SectionKey.z(nk));
                if (c == null || c.source == SectionStore.COLUMN_UNKNOWN) { nb[d] = null; continue; }
                int[] v = load(nk);
                nb[d] = v != null ? v : GreedyMesher.AIR_NEIGHBOR;
            }
            mesh = mesher.get().mesh(self, nb, classes);
        }
        stats.meshes.incrementAndGet();
        stats.meshQuads.addAndGet(mesh.quadCount());
        stats.meshNanos.addAndGet(System.nanoTime() - t0);
        meshSink.accept(key, mesh, version);
    }

    /** Called by the render thread after a mesh has been uploaded (or dropped because it was empty). */
    public void onMeshUploaded(long key, int version, boolean empty) {
        Node n = nodes.get(key);
        if (n == null) return;
        n.meshVersion = version;
        n.empty = empty;
        n.uploaded = true;
        selectionDirty = true;
    }

    /** Called by the render thread when it evicts a mesh from GPU memory. */
    public void onMeshEvicted(long key) {
        Node n = nodes.get(key);
        if (n == null) return;
        n.uploaded = false;
        n.meshVersion = -1;
        selectionDirty = true;
    }

    // ------------------------------------------------------------------------------------------ selection

    private void selectorLoop(Consumer<Throwable> errors) {
        double lx = Double.NaN, ly = 0, lz = 0;
        long lastSelect = 0;
        while (running) {
            try {
                long now = System.nanoTime();
                double dx = camX - lx, dy = camY - ly, dz = camZ - lz;
                boolean moved = Double.isNaN(lx) || dx * dx + dy * dy + dz * dz > 4;
                if ((moved || selectionDirty) && now - lastSelect > 30_000_000L) {
                    selectionDirty = false;
                    lx = camX; ly = camY; lz = camZ;
                    lastSelect = now;
                    select();
                } else {
                    Thread.sleep(8);
                }
                submitDuePropagations();
                submitDueRemeshes();
                if (now - lastMetaFlush > 5_000_000_000L) {
                    lastMetaFlush = now;
                    workers.submit(1e9, this::flushRegionMeta);
                }
                if (now - lastGc > 10_000_000_000L) {
                    lastGc = now;
                    collectNodes();
                }
            } catch (InterruptedException e) {
                return;
            } catch (Throwable t) {
                errors.accept(t);
                try { Thread.sleep(100); } catch (InterruptedException e) { return; }
            }
        }
    }

    private long[] selBuf = new long[4096];
    private int selCount;
    private long selId;

    /** Computes a new {@link DrawList}. Runs on the selector thread; exposed for benchmarks. */
    public DrawList select() {
        long t0 = System.nanoTime();
        selCount = 0;
        long now = System.currentTimeMillis();
        int L = topLevel;
        int size = SectionKey.size(L);
        double maxD = config.maxDistance;
        int cx = (int) Math.floor(camX / size), cz = (int) Math.floor(camZ / size);
        int r = (int) Math.ceil(maxD / size) + 1;
        for (int tz = cz - r; tz <= cz + r; tz++) {
            for (int tx = cx - r; tx <= cx + r; tx++) {
                long colKey = SectionKey.columnOf(L, tx, tz);
                double hd = horizontalDistance(colKey);
                if (hd > maxD) continue;
                Column c = column(L, tx, tz);
                if (c == null || c.source == SectionStore.COLUMN_UNKNOWN) {
                    requestGenerate(L, tx, tz, hd);
                    continue;
                }
                long mask = c.mask;
                int base = minSy(L);
                while (mask != 0) {
                    int bit = Long.numberOfTrailingZeros(mask);
                    mask &= mask - 1;
                    visit(SectionKey.of(L, tx, base + bit, tz), now);
                }
            }
        }
        long[] keys = Arrays.copyOf(selBuf, selCount);
        sortByDistance(keys);
        it.unimi.dsi.fastutil.longs.LongOpenHashSet selected = new it.unimi.dsi.fastutil.longs.LongOpenHashSet(keys);
        byte[] seams = new byte[keys.length];
        for (int i = 0; i < keys.length; i++) {
            int m = 0;
            for (int d = 0; d < Dir.COUNT; d++) {
                long nk = SectionKey.neighbor(keys[i], d);
                if (!selected.contains(nk) && !vanillaCovers(nk)) m |= 1 << d;
            }
            seams[i] = (byte) m;
        }
        DrawList dl = new DrawList(++selId, keys, seams, selCount);
        drawList = dl;
        stats.selections.incrementAndGet();
        stats.selectionNanos.addAndGet(System.nanoTime() - t0);
        return dl;
    }

    /** Near-to-far order lets the GPU reject hidden far terrain with early depth testing. */
    private void sortByDistance(long[] keys) {
        int n = keys.length;
        long[] packed = new long[n];
        for (int i = 0; i < n; i++) {
            long d = (long) Math.min(distanceTo(keys[i]), 1e9);
            packed[i] = d << 32 | i;
        }
        Arrays.sort(packed);
        long[] copy = keys.clone();
        for (int i = 0; i < n; i++) keys[i] = copy[(int) (packed[i] & 0xFFFFFFFFL)];
    }

    private double horizontalDistance(long key) {
        int size = SectionKey.size(SectionKey.level(key));
        double x0 = SectionKey.minBlockX(key), z0 = SectionKey.minBlockZ(key);
        double dx = Math.max(0, Math.max(x0 - camX, camX - (x0 + size)));
        double dz = Math.max(0, Math.max(z0 - camZ, camZ - (z0 + size)));
        return Math.sqrt(dx * dx + dz * dz);
    }

    private void visit(long key, long now) {
        double d = distanceTo(key);
        if (d > config.maxDistance) return;
        if (vanillaCovers(key)) return;
        int level = SectionKey.level(key);
        if (level > 0 && d < detail() * SectionKey.size(level)) {
            if (childrenReady(key, d, now)) {
                int cl = level - 1;
                int base = minSy(cl);
                for (int o = 0; o < 8; o++) {
                    long ck = SectionKey.child(key, o);
                    Column c = column(cl, SectionKey.x(ck), SectionKey.z(ck));
                    int bit = SectionKey.y(ck) - base;
                    if (c != null && bit >= 0 && bit < 64 && (c.mask & (1L << bit)) != 0) visit(ck, now);
                }
                return;
            }
        }
        Node n = nodes.computeIfAbsent(key, k -> new Node());
        n.lastWanted = now;
        if (n.uploaded) {
            if (!n.empty) add(key);
            if (n.meshVersion < n.dataVersion.get()) remeshDue.putIfAbsent(key, now + REMESH_DELAY_MS);
        } else {
            requestMesh(key, d);
        }
    }

    private boolean childrenReady(long key, double d, long now) {
        int cl = SectionKey.level(key) - 1;
        int x2 = SectionKey.x(key) << 1, z2 = SectionKey.z(key) << 1;
        boolean ready = true;
        for (int i = 0; i < 4; i++) {
            int x = x2 | (i & 1), z = z2 | (i >> 1);
            Column c = column(cl, x, z);
            if (c == null || c.source == SectionStore.COLUMN_UNKNOWN) {
                ready = false;
                requestGenerate(cl, x, z, d);
            }
        }
        if (!ready) return false;
        int base = minSy(cl);
        for (int o = 0; o < 8; o++) {
            long ck = SectionKey.child(key, o);
            Column c = column(cl, SectionKey.x(ck), SectionKey.z(ck));
            int bit = SectionKey.y(ck) - base;
            if (bit < 0 || bit >= 64 || (c.mask & (1L << bit)) == 0) continue;
            if (vanillaCovers(ck)) continue;
            Node n = nodes.computeIfAbsent(ck, k -> new Node());
            n.lastWanted = now;
            if (!n.uploaded) {
                ready = false;
                requestMesh(ck, d);
            }
        }
        return ready;
    }

    private void add(long key) {
        if (selCount == selBuf.length) selBuf = Arrays.copyOf(selBuf, selCount * 2);
        selBuf[selCount++] = key;
    }

    private void collectNodes() {
        long cutoff = System.currentTimeMillis() - 30_000;
        for (Iterator<Map.Entry<Long, Node>> it = nodes.entrySet().iterator(); it.hasNext(); ) {
            Node n = it.next().getValue();
            if (!n.uploaded && !n.request.isQueued() && n.lastWanted < cutoff) it.remove();
        }
    }

    /** Blocks until the worker queue is drained (benchmarks/tests only). */
    public void awaitIdle(long timeoutMs) throws InterruptedException {
        long end = System.currentTimeMillis() + timeoutMs;
        int idle = 0;
        while (System.currentTimeMillis() < end) {
            if (workers.pending() == 0 && pendingPropagate.isEmpty() && pendingGenerate.isEmpty() && propagateDue.isEmpty() && remeshDue.isEmpty()) {
                if (++idle > 5) return;
            } else {
                idle = 0;
            }
            Thread.sleep(20);
        }
    }

    @Override
    public void close() {
        running = false;
        selectorThread.interrupt();
        workers.close();
        try { selectorThread.join(2000); } catch (InterruptedException ignored) {}
        flushRegionMeta();
        store.close();
    }
}
