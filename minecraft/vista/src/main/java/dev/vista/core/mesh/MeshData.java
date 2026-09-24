package dev.vista.core.mesh;

/**
 * Packed quads of one section, 2 ints (8 bytes) per quad, laid out in {@link #GROUPS} contiguous groups:
 * <pre>
 *   group 2d     opaque faces facing direction d whose neighbour is visible (always drawn if d faces the camera)
 *   group 2d+1   opaque "seam" faces on the section boundary facing d whose same-level neighbour is solid or
 *                unknown; drawn only when that neighbour is not drawn at the same level
 *   group 12     translucent faces (water, glass, ice)
 * </pre>
 * Quad word 0: {@code x | y<<5 | z<<10 | (w-1)<<15 | (h-1)<<20 | dir<<25}; word 1: the voxel value with the
 * light of the facing voxel in the top byte (see {@link dev.vista.core.Voxel}).
 */
public final class MeshData {
    public static final int GROUPS = 13;
    public static final int TRANSLUCENT_GROUP = 12;
    public static final MeshData EMPTY = new MeshData(new int[0], new int[GROUPS + 1]);

    public final int[] quads;
    /** Start (in quads) of each group; {@code groupStart[GROUPS]} is the total quad count. */
    public final int[] groupStart;

    public MeshData(int[] quads, int[] groupStart) {
        this.quads = quads;
        this.groupStart = groupStart;
    }

    public int quadCount() { return groupStart[GROUPS]; }

    public int groupCount(int g) { return groupStart[g + 1] - groupStart[g]; }

    public boolean isEmpty() { return quadCount() == 0; }

    public static int normalGroup(int dir) { return dir * 2; }

    public static int seamGroup(int dir) { return dir * 2 + 1; }
}
