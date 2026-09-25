package dev.vista.core.mesh;

import dev.vista.core.Dir;
import dev.vista.core.StateClasses;
import dev.vista.core.Voxel;

import java.util.Arrays;

/**
 * Greedy mesher for 32^3 voxel sections. Faces are merged only when their full quad word 1 (state, biome
 * and facing light) is identical, so merging never changes the rendered image. Not thread-safe; use one
 * instance per worker thread.
 */
public final class GreedyMesher {
    /** Marker for a known, completely empty (air, full sky light) neighbour. */
    public static final int[] AIR_NEIGHBOR = filled(Voxel.SKY);

    private static final int FULL_SKY_LIGHT = 0xF0;

    private final int[] maskNormal = new int[1024];
    private final int[] maskSeam = new int[1024];
    private final int[] maskTrans = new int[1024];
    private final IntBuf[] out = new IntBuf[MeshData.GROUPS];

    public GreedyMesher() {
        for (int i = 0; i < out.length; i++) out[i] = new IntBuf();
    }

    private static int[] filled(int v) {
        int[] a = new int[Voxel.VOLUME];
        Arrays.fill(a, v);
        return a;
    }

    /**
     * @param self      the section's voxels
     * @param neighbors per direction: the neighbour section's voxels, {@link #AIR_NEIGHBOR} if known empty,
     *                  or {@code null} if unknown (faces toward unknown space become seam faces)
     */
    public MeshData mesh(int[] self, int[][] neighbors, StateClasses classes) {
        for (IntBuf b : out) b.clear();
        byte[] cls = classes.raw();
        for (int d = 0; d < Dir.COUNT; d++) meshDirection(self, neighbors[d], d, cls);
        int total = 0;
        int[] starts = new int[MeshData.GROUPS + 1];
        for (int g = 0; g < MeshData.GROUPS; g++) {
            starts[g] = total;
            total += out[g].size / 2;
        }
        starts[MeshData.GROUPS] = total;
        if (total == 0) return MeshData.EMPTY;
        int[] quads = new int[total * 2];
        for (int g = 0; g < MeshData.GROUPS; g++) System.arraycopy(out[g].data, 0, quads, starts[g] * 2, out[g].size);
        return new MeshData(quads, starts);
    }

    private void meshDirection(int[] self, int[] nb, int d, byte[] cls) {
        int axis = Dir.axis(d);
        boolean pos = Dir.positive(d);
        int sa, su, sv;
        switch (axis) {
            case 1 -> { sa = 1024; su = 1; sv = 32; }
            case 2 -> { sa = 32; su = 1; sv = 1024; }
            default -> { sa = 1; su = 32; sv = 1024; }
        }
        int step = pos ? sa : -sa;
        int boundary = pos ? 31 : 0;
        int nbSlice = pos ? 0 : 31;
        IntBuf normalOut = out[MeshData.normalGroup(d)];
        IntBuf seamOut = out[MeshData.seamGroup(d)];
        IntBuf transOut = out[MeshData.TRANSLUCENT_GROUP];

        for (int s = 0; s < 32; s++) {
            boolean edge = s == boundary;
            boolean anyN = false, anyS = false, anyT = false;
            int base = s * sa;
            int nbBase = nbSlice * sa;
            for (int v = 0; v < 32; v++) {
                for (int u = 0; u < 32; u++) {
                    int m = v * 32 + u;
                    int idx = base + u * su + v * sv;
                    int a = self[idx];
                    byte ca = cls[a & 0xFFFF];
                    maskNormal[m] = 0;
                    maskSeam[m] = 0;
                    maskTrans[m] = 0;
                    if (ca == StateClasses.AIR) continue;
                    int b;
                    boolean unknown = false;
                    if (!edge) {
                        b = self[idx + step];
                    } else if (nb != null) {
                        b = nb[nbBase + u * su + v * sv];
                    } else {
                        b = 0;
                        unknown = true;
                    }
                    byte cb = unknown ? StateClasses.OPAQUE : cls[b & 0xFFFF];
                    if (ca == StateClasses.OPAQUE) {
                        if (cb != StateClasses.OPAQUE) {
                            maskNormal[m] = (a & 0x00FFFFFF) | (b >>> 24) << 24;
                            anyN = true;
                        } else if (edge) {
                            // Seam faces are lit as if exposed to the sky: they are only visible across a
                            // level transition, where the true exposure is unknowable at this level.
                            maskSeam[m] = (a & 0x00FFFFFF) | FULL_SKY_LIGHT << 24;
                            anyS = true;
                        }
                    } else if (cb == StateClasses.AIR) {
                        maskTrans[m] = (a & 0x00FFFFFF) | (b >>> 24) << 24;
                        anyT = true;
                    }
                }
            }
            if (anyN) greedy(maskNormal, s, axis, d, normalOut);
            if (anyS) greedy(maskSeam, s, axis, d, seamOut);
            if (anyT) greedy(maskTrans, s, axis, d, transOut);
        }
    }

    private static void greedy(int[] mask, int s, int axis, int d, IntBuf dst) {
        for (int v = 0; v < 32; v++) {
            int row = v * 32;
            for (int u = 0; u < 32; ) {
                int key = mask[row + u];
                if (key == 0) { u++; continue; }
                int w = 1;
                while (u + w < 32 && mask[row + u + w] == key) w++;
                int h = 1;
                outer:
                while (v + h < 32) {
                    int r = (v + h) * 32 + u;
                    for (int i = 0; i < w; i++) if (mask[r + i] != key) break outer;
                    h++;
                }
                for (int j = 0; j < h; j++) Arrays.fill(mask, (v + j) * 32 + u, (v + j) * 32 + u + w, 0);
                int x, y, z;
                switch (axis) {
                    case 1 -> { x = u; y = s; z = v; }
                    case 2 -> { x = u; y = v; z = s; }
                    default -> { x = s; y = v; z = u; }
                }
                dst.add(x | y << 5 | z << 10 | (w - 1) << 15 | (h - 1) << 20 | d << 25);
                dst.add(key);
                u += w;
            }
        }
    }

    static final class IntBuf {
        int[] data = new int[4096];
        int size;

        void clear() { size = 0; }

        void add(int v) {
            if (size == data.length) data = Arrays.copyOf(data, size * 2);
            data[size++] = v;
        }
    }
}
