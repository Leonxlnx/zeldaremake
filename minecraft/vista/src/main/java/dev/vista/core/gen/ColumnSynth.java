package dev.vista.core.gen;

import dev.vista.core.Voxel;

/**
 * Turns {@link ColumnSamples} into voxel sections at any LOD level. This is the "instant horizon": the
 * samples come straight from the world generator's density/biome noise (no chunk generation, no
 * features), so a 32x32 column at level 8 describes an 8 km x 8 km patch of real terrain shape in one job.
 * Forests are reconstructed from the biome's canopy description: discrete trees while voxels are at most
 * 4 blocks wide, a dithered canopy layer beyond that, which is what real forests downsample to anyway.
 */
public final class ColumnSynth {
    public interface SurfaceTable {
        BiomeSurface get(int biome);
    }

    private static final int TREE_CELL = 7;

    private ColumnSynth() {}

    /**
     * Fills section {@code (level, sx, sy, sz)}. Returns false (and leaves {@code out} undefined) if the
     * section is entirely open sky.
     */
    public static boolean fill(ColumnSamples cs, SurfaceTable table, int water, int level, int sx, int sy, int sz, int[] out, long seed) {
        int s = 1 << level;
        int baseY = sy * 32 * s;
        int maxTop = cs.maxHeight() + 40;
        if (baseY > Math.max(maxTop, cs.seaLevel + 1)) return false;
        boolean any = false;
        int baseX = sx * 32 * s, baseZ = sz * 32 * s;
        for (int z = 0; z < 32; z++) {
            for (int x = 0; x < 32; x++) {
                int col = x | z << 5;
                int h = cs.height[col];
                int bio = cs.biome[col] & 0xFF;
                BiomeSurface surf = table.get(bio);
                int wx = baseX + x * s, wz = baseZ + z * s;
                for (int y = 0; y < 32; y++) {
                    int wy = baseY + y * s;
                    int twiceCenter = 2 * wy + s;
                    int v;
                    if (twiceCenter < 2 * cs.minY || twiceCenter >= 2 * cs.maxY) {
                        out[Voxel.index(x, y, z)] = twiceCenter < 2 * cs.minY ? Voxel.AIR : Voxel.SKY;
                        continue;
                    }
                    boolean seaSurface = h < cs.seaLevel - 1 && wy <= cs.seaLevel - 1 && cs.seaLevel - 1 < wy + s;
                    if (twiceCenter < 2 * (h + 1) && !seaSurface) {
                        boolean top = 2 * (wy + s) + s >= 2 * (h + 1);
                        int state;
                        if (top) {
                            if (h < cs.seaLevel - 1) state = surf.underwater();
                            else state = surf.snowy() ? surf.snow() : surf.top();
                        } else if (h - (wy + s) < 4) {
                            state = h < cs.seaLevel - 1 ? surf.underwater() : surf.filler();
                        } else {
                            state = wy < 0 ? surf.deepStone() : surf.stone();
                        }
                        v = Voxel.pack(state, bio, 0);
                    } else if (seaSurface || (twiceCenter < 2 * cs.seaLevel && h < cs.seaLevel - 1)) {
                        int depth = Math.max(0, cs.seaLevel - (wy + s / 2));
                        int sky = Math.max(0, 15 - depth);
                        boolean surface = seaSurface || 2 * (wy + s) + s >= 2 * cs.seaLevel;
                        int state = surface && surf.snowy() ? surf.ice() : water;
                        v = Voxel.pack(state, bio, sky << 4);
                    } else {
                        v = Voxel.pack(0, bio, 0xF0);
                        if (surf.canopy() > 0 && h >= cs.seaLevel) {
                            int tree = treeAt(wx, wy, wz, s, h, surf, seed);
                            if (tree != 0) v = Voxel.pack(tree, bio, 0);
                        }
                    }
                    out[Voxel.index(x, y, z)] = v;
                    if (v != Voxel.SKY && (v & 0xFFFF) != 0) any = true;
                }
            }
        }
        return any;
    }

    private static int treeAt(int wx, int wy, int wz, int s, int h, BiomeSurface surf, long seed) {
        int top = h + surf.treeHeight();
        int bottom = top - 4;
        if (wy >= top || wy + s <= h + 1) return 0;
        if (s >= 8) {
            if (wy + s <= bottom) return 0;
            float p = surf.canopy() * 0.85f;
            return hash01(wx, wy, wz, seed) < p ? surf.leaves() : 0;
        }
        float cx = wx + s * 0.5f, cy = wy + s * 0.5f, cz = wz + s * 0.5f;
        float grow = s * 0.5f;
        int cellX = Math.floorDiv(wx, TREE_CELL), cellZ = Math.floorDiv(wz, TREE_CELL);
        float prob = Math.min(1f, surf.canopy() / 0.42f);
        for (int dz = -1; dz <= 1; dz++) {
            for (int dx = -1; dx <= 1; dx++) {
                int gx = cellX + dx, gz = cellZ + dz;
                long hsh = mix(gx * 0x9E3779B97F4A7C15L ^ gz * 0xC2B2AE3D27D4EB4FL ^ seed);
                if ((hsh >>> 40) / (float) (1 << 24) >= prob) continue;
                float tx = gx * TREE_CELL + 1 + (int) ((hsh >>> 8) & 0xFF) % (TREE_CELL - 2) + 0.5f;
                float tz = gz * TREE_CELL + 1 + (int) ((hsh >>> 16) & 0xFF) % (TREE_CELL - 2) + 0.5f;
                int th = top - 1 + (int) ((hsh >>> 24) & 3) - 1;
                float ddx = Math.abs(cx - tx), ddz = Math.abs(cz - tz);
                if (cy < th - 1 && ddx < 0.5f + grow && ddz < 0.5f + grow) return surf.log();
                float ry = cy - (th - 2.0f);
                if (ry < -2.5f - grow || ry > 1.5f + grow) continue;
                float r = (ry > 0.5f ? 1.5f : 2.6f) + grow;
                if (ddx * ddx + ddz * ddz < r * r) return surf.leaves();
            }
        }
        return 0;
    }

    static float hash01(int x, int y, int z, long seed) {
        long h = mix(x * 0x9E3779B97F4A7C15L ^ y * 0xD6E8FEB86659FD93L ^ z * 0xC2B2AE3D27D4EB4FL ^ seed);
        return (h >>> 40) / (float) (1 << 24);
    }

    static long mix(long z) {
        z = (z ^ (z >>> 33)) * 0xFF51AFD7ED558CCDL;
        z = (z ^ (z >>> 33)) * 0xC4CEB9FE1A85EC53L;
        return z ^ (z >>> 33);
    }
}
