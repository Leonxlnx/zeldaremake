package dev.vista.core.gen;

/**
 * Terrain samples for one 32x32 section column at some LOD level: one sample per voxel column, taken at
 * the voxel column's centre. Index {@code x | z << 5}.
 */
public final class ColumnSamples {
    /** Y of the highest solid block (ocean floor for water columns). */
    public final int[] height = new int[1024];
    /** Compact biome id. */
    public final int[] biome = new int[1024];
    public int seaLevel = 63;
    public boolean allLand;

    public int minHeight() {
        int m = Integer.MAX_VALUE;
        for (int h : height) m = Math.min(m, h);
        return m;
    }

    public int maxHeight() {
        int m = Integer.MIN_VALUE;
        for (int h : height) m = Math.max(m, h);
        return m;
    }
}
