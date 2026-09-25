package dev.vista.client.render;

import com.mojang.blaze3d.platform.GlStateManager;
import dev.vista.client.world.BiomeRegistry;
import dev.vista.client.world.StateRegistry;
import net.minecraft.client.Minecraft;
import net.minecraft.client.color.block.BlockColors;
import net.minecraft.client.renderer.block.model.BakedQuad;
import net.minecraft.client.renderer.texture.TextureAtlas;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import net.minecraft.client.resources.model.BakedModel;
import net.minecraft.core.Direction;
import net.minecraft.core.Holder;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import org.lwjgl.opengl.GL11C;
import org.lwjgl.opengl.GL15C;
import org.lwjgl.opengl.GL43C;
import org.lwjgl.system.MemoryUtil;

import java.nio.ByteBuffer;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * GPU tables describing how every compact state and biome looks: per face class the atlas sprite rect,
 * the sprite's alpha-weighted average colour (computed in linear space from a one-off atlas readback,
 * matching Minecraft's gamma-correct mipmaps), the tint source and the light emission.
 */
final class BlockAppearance implements AutoCloseable {
    static final int STATE_STRIDE = 80;
    private static final Set<Block> GRASS_TINT = Set.of(Blocks.GRASS_BLOCK, Blocks.SHORT_GRASS, Blocks.TALL_GRASS, Blocks.FERN,
            Blocks.LARGE_FERN, Blocks.SUGAR_CANE, Blocks.POTTED_FERN);
    private static final Set<Block> FOLIAGE_TINT = Set.of(Blocks.OAK_LEAVES, Blocks.JUNGLE_LEAVES, Blocks.ACACIA_LEAVES,
            Blocks.DARK_OAK_LEAVES, Blocks.MANGROVE_LEAVES, Blocks.VINE);

    private int stateBuffer, biomeBuffer;
    private int stateCapacity, builtStates;
    private int builtBiomeVersion = -1;
    private int atlasW = 1, atlasH = 1;
    private ByteBuffer atlasPixels;
    private final Map<TextureAtlasSprite, Integer> avgCache = new IdentityHashMap<>();
    private boolean needsReload = true;

    int stateBuffer() { return stateBuffer; }
    int biomeBuffer() { return biomeBuffer; }
    int atlasWidth() { return atlasW; }
    int atlasHeight() { return atlasH; }

    void markReload() { needsReload = true; }

    void update(StateRegistry states, BiomeRegistry biomes, Level level) {
        if (stateBuffer == 0) {
            stateBuffer = GL15C.glGenBuffers();
            biomeBuffer = GL15C.glGenBuffers();
            GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, biomeBuffer);
            GL15C.glBufferData(GL43C.GL_SHADER_STORAGE_BUFFER, 256L * 16, GL15C.GL_DYNAMIC_DRAW);
        }
        if (needsReload) {
            needsReload = false;
            readAtlas();
            builtStates = 0;
            builtBiomeVersion = -1;
        }
        int n = states.size();
        if (n > builtStates) {
            if (n > stateCapacity) {
                int cap = Math.max(1024, Integer.highestOneBit(n - 1) << 1);
                ByteBuffer all = MemoryUtil.memCalloc(cap * STATE_STRIDE);
                for (int i = 0; i < n; i++) writeState(all, i, states.state(i));
                all.position(0).limit(cap * STATE_STRIDE);
                GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, stateBuffer);
                GL15C.glBufferData(GL43C.GL_SHADER_STORAGE_BUFFER, all, GL15C.GL_DYNAMIC_DRAW);
                MemoryUtil.memFree(all);
                stateCapacity = cap;
            } else {
                ByteBuffer part = MemoryUtil.memCalloc((n - builtStates) * STATE_STRIDE);
                for (int i = builtStates; i < n; i++) writeState(part, i - builtStates, states.state(i));
                part.position(0);
                GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, stateBuffer);
                GL15C.glBufferSubData(GL43C.GL_SHADER_STORAGE_BUFFER, (long) builtStates * STATE_STRIDE, part);
                MemoryUtil.memFree(part);
            }
            builtStates = n;
        }
        if (biomes.version() != builtBiomeVersion && level != null) {
            builtBiomeVersion = biomes.version();
            ByteBuffer b = MemoryUtil.memCalloc(256 * 16);
            for (int i = 0; i < Math.min(256, biomes.size()); i++) {
                Holder<Biome> h = biomes.holder(level, i);
                if (h == null) continue;
                Biome bio = h.value();
                b.putInt(i * 16, bio.getGrassColor(0, 0) & 0xFFFFFF);
                b.putInt(i * 16 + 4, bio.getFoliageColor() & 0xFFFFFF);
                b.putInt(i * 16 + 8, bio.getWaterColor() & 0xFFFFFF);
            }
            GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, biomeBuffer);
            GL15C.glBufferSubData(GL43C.GL_SHADER_STORAGE_BUFFER, 0, b);
            MemoryUtil.memFree(b);
        }
        GL15C.glBindBuffer(GL43C.GL_SHADER_STORAGE_BUFFER, 0);
    }

    private void readAtlas() {
        Minecraft mc = Minecraft.getInstance();
        int id = mc.getTextureManager().getTexture(TextureAtlas.LOCATION_BLOCKS).getId();
        GlStateManager._bindTexture(id);
        atlasW = GL11C.glGetTexLevelParameteri(GL11C.GL_TEXTURE_2D, 0, GL11C.GL_TEXTURE_WIDTH);
        atlasH = GL11C.glGetTexLevelParameteri(GL11C.GL_TEXTURE_2D, 0, GL11C.GL_TEXTURE_HEIGHT);
        if (atlasPixels != null) MemoryUtil.memFree(atlasPixels);
        atlasPixels = MemoryUtil.memAlloc(atlasW * atlasH * 4);
        GL11C.glGetTexImage(GL11C.GL_TEXTURE_2D, 0, GL11C.GL_RGBA, GL11C.GL_UNSIGNED_BYTE, atlasPixels);
        GlStateManager._bindTexture(0);
        avgCache.clear();
    }

    private void writeState(ByteBuffer buf, int slot, BlockState s) {
        int base = slot * STATE_STRIDE;
        if (s.isAir()) return;
        Minecraft mc = Minecraft.getInstance();
        BakedModel model = mc.getBlockRenderer().getBlockModel(s);
        BlockColors colors = mc.getBlockColors();
        boolean water = s.is(Blocks.WATER) || s.is(Blocks.BUBBLE_COLUMN);
        Direction[] faces = {Direction.DOWN, Direction.UP, Direction.NORTH};
        for (int fc = 0; fc < 3; fc++) {
            RandomSource rand = RandomSource.create(42L);
            List<BakedQuad> quads = model.getQuads(s, faces[fc], rand);
            BakedQuad quad = quads.isEmpty() ? null : quads.get(0);
            if (quad == null) {
                for (BakedQuad q : model.getQuads(s, null, RandomSource.create(42L))) {
                    if (q.getDirection() == faces[fc]) { quad = q; break; }
                }
            }
            TextureAtlasSprite sprite = quad != null ? quad.getSprite() : model.getParticleIcon();
            if (water) sprite = mc.getBlockRenderer().getBlockModelShaper().getParticleIcon(s);
            buf.putFloat(base + fc * 16, sprite.getU0());
            buf.putFloat(base + fc * 16 + 4, sprite.getV0());
            buf.putFloat(base + fc * 16 + 8, sprite.getU1());
            buf.putFloat(base + fc * 16 + 12, sprite.getV1());
            buf.putInt(base + 48 + fc * 4, average(sprite));
            int tint = 0;
            if (water) {
                tint = 3 << 24;
            } else if (quad != null && quad.isTinted()) {
                Block b = s.getBlock();
                if (GRASS_TINT.contains(b)) tint = 1 << 24;
                else if (FOLIAGE_TINT.contains(b)) tint = 2 << 24;
                else {
                    int c = colors.getColor(s, null, null, quad.getTintIndex());
                    if (c != -1) tint = 4 << 24 | (c & 0xFFFFFF);
                }
            }
            buf.putInt(base + 64 + fc * 4, tint);
        }
        buf.putInt(base + 60, s.getLightEmission());
        // Flag 1: fluid surface. Vanilla draws a still fluid's top 8/9 of a block high; matching it keeps the
        // hand-off from vanilla water to far water free of a see-through seam.
        buf.putInt(base + 76, s.getBlock() instanceof net.minecraft.world.level.block.LiquidBlock ? 1 : 0);
    }

    /** Alpha-weighted average in linear space, returned as RGBA8 (R in the low byte), alpha = coverage. */
    private int average(TextureAtlasSprite sprite) {
        Integer cached = avgCache.get(sprite);
        if (cached != null) return cached;
        int x0 = sprite.getX(), y0 = sprite.getY();
        int w = sprite.contents().width(), h = sprite.contents().height();
        double r = 0, g = 0, b = 0, a = 0;
        int n = 0;
        for (int y = y0; y < Math.min(atlasH, y0 + h); y++) {
            for (int x = x0; x < Math.min(atlasW, x0 + w); x++) {
                int i = (y * atlasW + x) * 4;
                double al = (atlasPixels.get(i + 3) & 0xFF) / 255.0;
                r += lin(atlasPixels.get(i) & 0xFF) * al;
                g += lin(atlasPixels.get(i + 1) & 0xFF) * al;
                b += lin(atlasPixels.get(i + 2) & 0xFF) * al;
                a += al;
                n++;
            }
        }
        int result;
        if (a <= 1e-6) {
            result = 0x00808080;
        } else {
            int ri = srgb(r / a), gi = srgb(g / a), bi = srgb(b / a);
            int ai = (int) Math.round(Math.min(1.0, a / Math.max(1, n)) * 255);
            result = ri | gi << 8 | bi << 16 | ai << 24;
        }
        avgCache.put(sprite, result);
        return result;
    }

    private static final double[] LIN = new double[256];
    static {
        for (int i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255.0, 2.2);
    }

    private static double lin(int v) { return LIN[v]; }

    private static int srgb(double v) {
        return (int) Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255);
    }

    @Override
    public void close() {
        if (stateBuffer != 0) GL15C.glDeleteBuffers(stateBuffer);
        if (biomeBuffer != 0) GL15C.glDeleteBuffers(biomeBuffer);
        stateBuffer = biomeBuffer = 0;
        if (atlasPixels != null) MemoryUtil.memFree(atlasPixels);
        atlasPixels = null;
    }
}
