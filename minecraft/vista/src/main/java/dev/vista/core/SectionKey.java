package dev.vista.core;

/**
 * Packs (level, x, y, z) of an LOD section into a long. A section at level {@code L} covers
 * {@code 32 * 2^L} blocks per axis; its voxels are {@code 2^L} blocks wide.
 * <pre>
 *  bits 60..63 level (0..15)
 *  bits 36..59 x (signed 24)
 *  bits 12..35 z (signed 24)
 *  bits  0..11 y (signed 12)
 * </pre>
 */
public final class SectionKey {
    public static final int MAX_LEVEL = 11;

    private SectionKey() {}

    public static long of(int level, int x, int y, int z) {
        return ((long) level & 0xF) << 60
                | ((long) x & 0xFFFFFF) << 36
                | ((long) z & 0xFFFFFF) << 12
                | ((long) y & 0xFFF);
    }

    public static int level(long k) { return (int) (k >>> 60); }
    public static int x(long k) { return (int) (k << 4 >> 40); }
    public static int z(long k) { return (int) (k << 28 >> 40); }
    public static int y(long k) { return (int) (k << 52 >> 52); }

    /** Column key: the same packing with y = 0. */
    public static long column(long k) { return k & ~0xFFFL; }

    public static long columnOf(int level, int x, int z) { return of(level, x, 0, z); }

    public static long parent(long k) {
        return of(level(k) + 1, x(k) >> 1, y(k) >> 1, z(k) >> 1);
    }

    public static long child(long k, int octant) {
        return of(level(k) - 1, (x(k) << 1) | (octant & 1), (y(k) << 1) | ((octant >> 1) & 1), (z(k) << 1) | ((octant >> 2) & 1));
    }

    public static long neighbor(long k, int dir) {
        int x = x(k), y = y(k), z = z(k);
        switch (dir) {
            case Dir.DOWN -> y--;
            case Dir.UP -> y++;
            case Dir.NORTH -> z--;
            case Dir.SOUTH -> z++;
            case Dir.WEST -> x--;
            default -> x++;
        }
        return of(level(k), x, y, z);
    }

    /** World-space size of the section in blocks. */
    public static int size(int level) { return Voxel.SIZE << level; }

    public static int minBlockX(long k) { return x(k) * size(level(k)); }
    public static int minBlockY(long k) { return y(k) * size(level(k)); }
    public static int minBlockZ(long k) { return z(k) * size(level(k)); }

    public static String toString(long k) {
        return "L" + level(k) + "[" + x(k) + "," + y(k) + "," + z(k) + "]";
    }
}
