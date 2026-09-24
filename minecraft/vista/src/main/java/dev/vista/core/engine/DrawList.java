package dev.vista.core.engine;

/**
 * Immutable output of one LOD selection: the set of section keys that together cover the visible world
 * exactly once (no overlaps, no gaps), independent of view direction. Frustum culling happens per frame
 * on the render thread.
 */
public final class DrawList {
    public static final DrawList EMPTY = new DrawList(0, new long[0], 0);

    public final long id;
    public final long[] keys;
    public final int count;

    DrawList(long id, long[] keys, int count) {
        this.id = id;
        this.keys = keys;
        this.count = count;
    }
}
