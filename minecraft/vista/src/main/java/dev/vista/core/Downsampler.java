package dev.vista.core;

/**
 * Builds one octant of a level {@code L+1} section from a level {@code L} child section by reducing
 * each 2x2x2 block of voxels to one.
 * <p>
 * Rules (tuned against the failure modes of existing LOD mods):
 * <ul>
 *   <li>A cell is solid when at least {@link #SOLID_THRESHOLD} of its 8 children are opaque. A threshold of
 *   2 keeps one-block pillars, walls and tree trunks (2 of 8) alive instead of letting them vanish, while
 *   a lone block (1 of 8) does not inflate into a 2x2x2 lump. Flat ground with an odd top is a 4/8 tie and
 *   resolves upward, so the surface height is biased by at most half a voxel.</li>
 *   <li>The representative opaque block is the highest one in the cell (the one most likely to be seen
 *   from above: grass over dirt, snow over stone), ties broken by frequency.</li>
 *   <li>Non-solid cells become translucent (water/glass) if any child is translucent, else air. Water covering
 *   the top layer of a cell wins over the solid rule, so shallow seas and rivers survive coarse levels.</li>
 *   <li>Light of a non-opaque cell is the per-channel max over its non-opaque children, so faces keep
 *   their sky exposure and emissive glow at every level.</li>
 * </ul>
 */
public final class Downsampler {
    public static final int SOLID_THRESHOLD = 2;

    private Downsampler() {}

    /**
     * @param child   voxels of the child section
     * @param parent  voxels of the parent section, modified in place
     * @param octant  child octant: bit0 = x, bit1 = y, bit2 = z
     */
    public static void downsample(int[] child, int[] parent, int octant, StateClasses classes) {
        int ox = (octant & 1) * 16, oy = ((octant >> 1) & 1) * 16, oz = ((octant >> 2) & 1) * 16;
        byte[] cls = classes.raw();
        for (int py = 0; py < 16; py++) {
            for (int pz = 0; pz < 16; pz++) {
                for (int px = 0; px < 16; px++) {
                    int opaque = 0, translucent = 0;
                    int sky = 0, blk = 0;
                    int bestOpaque = 0, bestOpaqueY = -1;
                    int translucentVoxel = 0;
                    int airVoxel = 0;
                    int topOpaque = 0, topTranslucent = 0;
                    for (int c = 0; c < 8; c++) {
                        int cx = px * 2 + (c & 1), cy = py * 2 + ((c >> 1) & 1), cz = pz * 2 + ((c >> 2) & 1);
                        int v = child[(cy << 10) | (cz << 5) | cx];
                        byte k = cls[v & 0xFFFF];
                        boolean upper = ((c >> 1) & 1) == 1;
                        if (upper) {
                            if (k == StateClasses.OPAQUE) topOpaque++;
                            else if (k == StateClasses.TRANSLUCENT) topTranslucent++;
                        }
                        if (k == StateClasses.OPAQUE) {
                            opaque++;
                            int yy = (c >> 1) & 1;
                            if (yy > bestOpaqueY) {
                                bestOpaqueY = yy;
                                bestOpaque = v;
                            }
                        } else {
                            if (k == StateClasses.TRANSLUCENT) {
                                translucent++;
                                translucentVoxel = v;
                            } else if (airVoxel == 0 || Voxel.light(v) > Voxel.light(airVoxel)) {
                                airVoxel = v;
                            }
                            sky = Math.max(sky, Voxel.sky(v));
                            blk = Math.max(blk, Voxel.block(v));
                        }
                    }
                    int light = sky << 4 | blk;
                    int out;
                    if (topTranslucent >= 2 && topOpaque < 2) {
                        // Water covering the top of the cell is what is seen from above; keeping it prevents
                        // shallow seas and rivers from turning into land at coarse levels.
                        out = Voxel.withLight(translucentVoxel, light);
                    } else if (opaque >= SOLID_THRESHOLD) {
                        out = mostFrequentTop(bestOpaque, bestOpaqueY, child, px, py, pz, cls);
                        out = Voxel.withLight(out, light);
                    } else if (translucent > 0) {
                        out = Voxel.withLight(translucentVoxel, light);
                    } else {
                        out = Voxel.pack(0, Voxel.biome(airVoxel), light);
                    }
                    parent[((oy + py) << 10) | ((oz + pz) << 5) | (ox + px)] = out;
                }
            }
        }
    }

    private static int mostFrequentTop(int best, int bestY, int[] child, int px, int py, int pz, byte[] cls) {
        // Among the opaque children on the highest occupied child layer, pick the most frequent state.
        int top0 = 0, top1 = 0, top2 = 0, top3 = 0;
        int count = 0;
        int cy = py * 2 + bestY;
        for (int c = 0; c < 4; c++) {
            int v = child[(cy << 10) | ((pz * 2 + (c >> 1)) << 5) | (px * 2 + (c & 1))];
            if (cls[v & 0xFFFF] != StateClasses.OPAQUE) continue;
            switch (count++) {
                case 0 -> top0 = v;
                case 1 -> top1 = v;
                case 2 -> top2 = v;
                default -> top3 = v;
            }
        }
        if (count <= 2) return count == 0 ? best : top0;
        int s0 = top0 & 0xFFFF, s1 = top1 & 0xFFFF, s2 = top2 & 0xFFFF;
        if (s0 == s1 || s0 == s2 || (count == 4 && s0 == (top3 & 0xFFFF))) return top0;
        if (s1 == s2 || (count == 4 && s1 == (top3 & 0xFFFF))) return top1;
        return top0;
    }
}
