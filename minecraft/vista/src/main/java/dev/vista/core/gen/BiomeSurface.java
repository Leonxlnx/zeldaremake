package dev.vista.core.gen;

/**
 * How a biome looks from far away: surface/filler/underwater block ids and a forest canopy description.
 * All block values are compact state ids.
 */
public record BiomeSurface(
        int top,
        int filler,
        int underwater,
        int stone,
        int deepStone,
        int leaves,
        int log,
        /** Fraction of ground covered by tree canopy, 0..1. */
        float canopy,
        /** Typical tree height to the top of the canopy, in blocks. */
        int treeHeight,
        /** Whether the surface is snow-covered (snow on top, ice on water). */
        boolean snowy,
        int snow,
        int ice) {
}
