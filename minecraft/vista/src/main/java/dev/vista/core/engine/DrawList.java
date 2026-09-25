package dev.vista.core.engine;

/**
 * Immutable output of one LOD selection: the set of section keys that together cover the visible world
 * exactly once (no overlaps, no gaps), independent of view direction, plus for each node the directions in
 * which its seam faces must be drawn (the neighbouring space is drawn by LOD at a different level). Frustum
 * culling happens per frame on the render thread.
 */
public final class DrawList {
    public static final DrawList EMPTY = new DrawList(0, new long[0], new byte[0], 0);

    public final long id;
    public final long[] keys;
    /** Bit d set: draw the seam group of direction d. */
    public final byte[] seams;
    public final int count;

    DrawList(long id, long[] keys, byte[] seams, int count) {
        this.id = id;
        this.keys = keys;
        this.seams = seams;
        this.count = count;
    }
}
