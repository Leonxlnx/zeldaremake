package dev.vista.core;

import dev.vista.core.mesh.GreedyMesher;
import dev.vista.core.mesh.MeshData;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class CoreTest {
    static StateClasses classes() {
        StateClasses c = new StateClasses();
        c.set(1, StateClasses.OPAQUE);
        c.set(2, StateClasses.OPAQUE);
        c.set(3, StateClasses.TRANSLUCENT);
        return c;
    }

    static int[] sky() {
        int[] v = new int[Voxel.VOLUME];
        Arrays.fill(v, Voxel.SKY);
        return v;
    }

    @Test
    void sectionKeyRoundTrip() {
        Random r = new Random(1);
        for (int i = 0; i < 10000; i++) {
            int l = r.nextInt(12), x = r.nextInt(1 << 23) - (1 << 22), y = r.nextInt(4096) - 2048, z = r.nextInt(1 << 23) - (1 << 22);
            long k = SectionKey.of(l, x, y, z);
            assertEquals(l, SectionKey.level(k));
            assertEquals(x, SectionKey.x(k));
            assertEquals(y, SectionKey.y(k));
            assertEquals(z, SectionKey.z(k));
            if (l < 11) {
                long p = SectionKey.of(l + 1, x >> 1, y >> 1, z >> 1);
                assertEquals(p, SectionKey.parent(k));
                int octant = (x & 1) | (y & 1) << 1 | (z & 1) << 2;
                assertEquals(k, SectionKey.child(p, octant));
            }
        }
    }

    @Test
    void codecRoundTrip() {
        Random r = new Random(2);
        for (int pal : new int[]{1, 2, 17, 255, 256, 257, 5000}) {
            int[] v = new int[Voxel.VOLUME];
            int[] values = new int[pal];
            for (int i = 0; i < pal; i++) values[i] = r.nextInt();
            for (int i = 0; i < v.length; i++) v[i] = values[r.nextInt(pal)];
            int[] out = new int[Voxel.VOLUME];
            SectionCodec.decode(SectionCodec.encode(v), out);
            assertArrayEquals(v, out, "palette " + pal);
        }
    }

    @Test
    void singleBlockMeshesToSixFaces() {
        int[] v = sky();
        v[Voxel.index(5, 6, 7)] = Voxel.pack(1, 0, 0);
        int[][] nb = new int[6][];
        Arrays.fill(nb, GreedyMesher.AIR_NEIGHBOR);
        MeshData m = new GreedyMesher().mesh(v, nb, classes());
        assertEquals(6, m.quadCount());
        for (int d = 0; d < 6; d++) {
            assertEquals(1, m.groupCount(MeshData.normalGroup(d)));
            assertEquals(0, m.groupCount(MeshData.seamGroup(d)));
            int w0 = m.quads[m.groupStart[MeshData.normalGroup(d)] * 2];
            assertEquals(5, w0 & 31);
            assertEquals(6, (w0 >> 5) & 31);
            assertEquals(7, (w0 >> 10) & 31);
            assertEquals(d, (w0 >> 25) & 7);
            assertEquals(0xF0, m.quads[m.groupStart[MeshData.normalGroup(d)] * 2 + 1] >>> 24, "face takes the facing air's light");
        }
    }

    @Test
    void greedyMergesFlatGroundAndEmitsSeams() {
        int[] v = sky();
        for (int z = 0; z < 32; z++) for (int x = 0; x < 32; x++) for (int y = 0; y < 10; y++) v[Voxel.index(x, y, z)] = Voxel.pack(1, 0, 0);
        int[] solid = new int[Voxel.VOLUME];
        Arrays.fill(solid, Voxel.pack(2, 0, 0));
        int[][] nb = new int[6][];
        Arrays.fill(nb, solid);
        nb[Dir.UP] = GreedyMesher.AIR_NEIGHBOR;
        MeshData m = new GreedyMesher().mesh(v, nb, classes());
        assertEquals(1, m.groupCount(MeshData.normalGroup(Dir.UP)), "flat top merges into one quad");
        int w0 = m.quads[m.groupStart[MeshData.normalGroup(Dir.UP)] * 2];
        assertEquals(31, (w0 >> 15) & 31);
        assertEquals(31, (w0 >> 20) & 31);
        for (int d : new int[]{Dir.NORTH, Dir.SOUTH, Dir.WEST, Dir.EAST, Dir.DOWN}) {
            assertEquals(0, m.groupCount(MeshData.normalGroup(d)));
            assertEquals(1, m.groupCount(MeshData.seamGroup(d)), "seam wall for dir " + d);
        }
        // Unknown neighbours also produce seam faces, never normal walls.
        Arrays.fill(nb, null);
        nb[Dir.UP] = GreedyMesher.AIR_NEIGHBOR;
        m = new GreedyMesher().mesh(v, nb, classes());
        assertEquals(1, m.groupCount(MeshData.seamGroup(Dir.EAST)));
        assertEquals(0, m.groupCount(MeshData.normalGroup(Dir.EAST)));
    }

    @Test
    void waterOnlyShowsFacesAgainstAir() {
        int[] v = sky();
        for (int z = 0; z < 32; z++) for (int x = 0; x < 32; x++) {
            v[Voxel.index(x, 0, z)] = Voxel.pack(1, 0, 0);
            for (int y = 1; y < 5; y++) v[Voxel.index(x, y, z)] = Voxel.pack(3, 0, 0xA0);
        }
        int[][] nb = new int[6][];
        Arrays.fill(nb, GreedyMesher.AIR_NEIGHBOR);
        MeshData m = new GreedyMesher().mesh(v, nb, classes());
        int trans = m.groupCount(MeshData.TRANSLUCENT_GROUP);
        assertEquals(1 + 4, trans, "one merged water top + 4 side walls against open air");
        assertEquals(1, m.groupCount(MeshData.normalGroup(Dir.UP)), "sea floor stays visible through the water");
    }

    @Test
    void downsampleKeepsThinPillarsAndTopBlock() {
        StateClasses c = classes();
        int[] child = sky();
        // 1-wide pillar at x=4,z=4, y 0..31
        for (int y = 0; y < 32; y++) child[Voxel.index(4, y, 4)] = Voxel.pack(1, 0, 0);
        // ground of dirt(2) y<6 topped by grass(1) at y=6..7
        for (int z = 10; z < 20; z++) for (int x = 10; x < 20; x++) {
            for (int y = 0; y < 6; y++) child[Voxel.index(x, y, z)] = Voxel.pack(2, 0, 0);
            child[Voxel.index(x, 6, z)] = Voxel.pack(1, 0, 0);
            child[Voxel.index(x, 7, z)] = Voxel.pack(1, 0, 0);
        }
        // lone block (should not inflate)
        child[Voxel.index(30, 30, 30)] = Voxel.pack(1, 0, 0);
        int[] parent = sky();
        Downsampler.downsample(child, parent, 0, c);
        for (int y = 0; y < 16; y++) assertEquals(1, Voxel.state(parent[Voxel.index(2, y, 2)]), "pillar survives");
        assertEquals(1, Voxel.state(parent[Voxel.index(6, 3, 6)]), "grass on top");
        assertEquals(2, Voxel.state(parent[Voxel.index(6, 1, 6)]), "dirt below");
        assertEquals(0, Voxel.state(parent[Voxel.index(15, 15, 15)]), "lone block does not inflate");
        assertEquals(15, Voxel.sky(parent[Voxel.index(15, 15, 15)]));
    }
}
