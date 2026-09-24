package dev.vista.core;

import dev.vista.core.gen.ColumnSamples;
import dev.vista.core.gen.ColumnSynth;
import dev.vista.core.gen.SyntheticTerrain;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;

class SynthTest {
    private static ColumnSamples flat(int height, int biome) {
        ColumnSamples cs = new ColumnSamples();
        Arrays.fill(cs.height, height);
        Arrays.fill(cs.biome, biome);
        cs.seaLevel = 63;
        cs.minY = -64;
        cs.maxY = 320;
        return cs;
    }

    @Test
    void coarseVoxelsBelowTheWorldAreVoid() {
        SyntheticTerrain t = new SyntheticTerrain(1);
        int[] v = new int[Voxel.VOLUME];
        // Level 6: section sy=-1 spans y -2048..-1; only voxels centred at or above -64 may be solid.
        ColumnSynth.fill(flat(70, 0), t.surfaces(), t.waterState(), 6, 0, -1, 0, v, 1);
        for (int y = 0; y < 32; y++) {
            int wy = -2048 + y * 64;
            int state = Voxel.state(v[Voxel.index(3, y, 3)]);
            if (wy + 32 < -64) assertEquals(0, state, "void at y " + wy);
        }
        assertNotEquals(0, Voxel.state(v[Voxel.index(3, 31, 3)]), "top voxel (-64..-1) is solid ground");
    }

    @Test
    void shallowSeaStaysWaterAtCoarseLevels() {
        SyntheticTerrain t = new SyntheticTerrain(1);
        StateClasses cls = SyntheticTerrain.classes();
        int[] v = new int[Voxel.VOLUME];
        // Sea floor at y=55 (8 blocks of water). At level 5 (32-block voxels) the voxel 32..63 has its centre
        // below the floor, but it contains the sea surface: it must be water, not land.
        ColumnSynth.fill(flat(55, 3), t.surfaces(), t.waterState(), 5, 0, 0, 0, v, 1);
        assertEquals(StateClasses.TRANSLUCENT, cls.ofVoxel(v[Voxel.index(0, 1, 0)]));
        assertEquals(StateClasses.AIR, cls.ofVoxel(v[Voxel.index(0, 2, 0)]));
    }

    @Test
    void downsampledSeaSurfaceStaysWater() {
        StateClasses cls = SyntheticTerrain.classes();
        int[] child = new int[Voxel.VOLUME];
        Arrays.fill(child, Voxel.SKY);
        for (int z = 0; z < 32; z++) for (int x = 0; x < 32; x++) {
            child[Voxel.index(x, 0, z)] = Voxel.pack(SyntheticTerrain.SAND, 0, 0);
            child[Voxel.index(x, 1, z)] = Voxel.pack(SyntheticTerrain.WATER, 0, 0xE0);
        }
        int[] parent = new int[Voxel.VOLUME];
        Downsampler.downsample(child, parent, 0, cls);
        // Cell y=0 holds a sand layer under a water layer: seen from above it is sea.
        assertEquals(StateClasses.TRANSLUCENT, cls.ofVoxel(parent[Voxel.index(3, 0, 3)]));
    }
}
