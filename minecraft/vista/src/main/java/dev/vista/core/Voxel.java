package dev.vista.core;

/**
 * A voxel is a single int: {@code state(16) | biome(8) << 16 | light(8) << 24}.
 * <p>
 * {@code state} is a compact, per-world block-state id (0 = air). {@code light} is
 * {@code sky(4) << 4 | block(4)} and is meaningful for non-opaque voxels: a face takes the light of the
 * voxel it faces, exactly like vanilla smooth-lighting-off shading.
 */
public final class Voxel {
    public static final int AIR = 0;
    /** Air with full sky light: the voxel value for "open sky". */
    public static final int SKY = pack(0, 0, 0xF0);

    public static final int SIZE = 32;
    public static final int SHIFT = 5;
    public static final int VOLUME = SIZE * SIZE * SIZE;

    private Voxel() {}

    public static int pack(int state, int biome, int light) {
        return (state & 0xFFFF) | (biome & 0xFF) << 16 | (light & 0xFF) << 24;
    }

    public static int state(int v) { return v & 0xFFFF; }
    public static int biome(int v) { return (v >>> 16) & 0xFF; }
    public static int light(int v) { return v >>> 24; }
    public static int sky(int v) { return v >>> 28; }
    public static int block(int v) { return (v >>> 24) & 0xF; }

    public static int withLight(int v, int light) { return (v & 0x00FFFFFF) | (light & 0xFF) << 24; }

    /** Index into a 32^3 section; x fastest so rows are contiguous for meshing. */
    public static int index(int x, int y, int z) { return (y << 10) | (z << 5) | x; }
}
