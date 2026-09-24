package dev.vista.bench;

import dev.vista.core.SectionCodec;
import dev.vista.core.SectionKey;
import dev.vista.core.StateClasses;
import dev.vista.core.Voxel;
import dev.vista.core.mesh.GreedyMesher;
import dev.vista.core.mesh.MeshData;
import dev.vista.core.store.SectionStore;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

/**
 * Offline inspection of a Vista cache directory: per level, how many sections, voxel class histogram and
 * mesh group sizes. Usage: {@code StoreInspect <world-cache-dir>} (the directory containing states.txt).
 */
public final class StoreInspect {
    private static final java.util.Map<String, Long> transStates = new java.util.TreeMap<>();
    private static final long[] skyAboveWater = new long[16];
    private static final long[] skyAboveGround = new long[16];

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args[0]);
        List<String> states = Files.readAllLines(root.resolve("states.txt"));
        StateClasses cls = new StateClasses();
        int water = -1;
        for (int i = 2; i < states.size(); i++) {
            String s = states.get(i);
            boolean trans = s.startsWith("minecraft:water") || s.contains("glass") || s.startsWith("minecraft:ice");
            cls.set(i, trans ? StateClasses.TRANSLUCENT : StateClasses.OPAQUE);
            if (s.startsWith("minecraft:water") && water < 0) water = i;
        }
        System.out.println(states.size() + " states, water id " + water);
        try (SectionStore store = new SectionStore(root.resolve("sections"), 64)) {
            for (int level = 0; level <= 11; level++) {
                Path dir = root.resolve("sections").resolve("L" + level);
                if (!Files.isDirectory(dir)) continue;
                long[] counts = new long[3];
                long[] groups = new long[MeshData.GROUPS];
                int sections = 0, waterSections = 0;
                GreedyMesher mesher = new GreedyMesher();
                int[] v = new int[Voxel.VOLUME];
                int[][] nb = new int[6][];
                Arrays.fill(nb, GreedyMesher.AIR_NEIGHBOR);
                try (Stream<Path> files = Files.list(dir)) {
                    for (Path f : files.toList()) {
                        String[] p = f.getFileName().toString().split("\\.");
                        int rx = Integer.parseInt(p[1]), rz = Integer.parseInt(p[2]);
                        int lvl = level;
                        long[] keys = new long[4096];
                        int[] nk = {0};
                        store.forEachSection(lvl, rx, rz, k -> { if (nk[0] < keys.length) keys[nk[0]++] = k; });
                        for (int i = 0; i < nk[0]; i++) {
                            SectionCodec.decode(store.read(keys[i]), v);
                            sections++;
                            boolean w = false;
                            for (int x : v) {
                                counts[cls.ofVoxel(x)]++;
                                if (cls.ofVoxel(x) == StateClasses.TRANSLUCENT) transStates.merge(states.get(Voxel.state(x)), 1L, Long::sum);
                                if (Voxel.state(x) == water) w = true;
                            }
                            if (w) waterSections++;
                            for (int y = 0; y < 31; y++) for (int z = 0; z < 32; z++) for (int x = 0; x < 32; x++) {
                                int a = v[Voxel.index(x, y, z)], above = v[Voxel.index(x, y + 1, z)];
                                if (cls.ofVoxel(above) != StateClasses.AIR) continue;
                                if (Voxel.state(a) == water) skyAboveWater[Voxel.sky(above)]++;
                                else if (cls.ofVoxel(a) == StateClasses.OPAQUE) skyAboveGround[Voxel.sky(above)]++;
                            }
                            MeshData m = mesher.mesh(v, nb, cls);
                            for (int g = 0; g < MeshData.GROUPS; g++) groups[g] += m.groupCount(g);
                        }
                    }
                }
                System.out.printf("L%d: %d sections (%d with water); voxels air %d opaque %d translucent %d; quads normal %d seam %d translucent %d%n",
                        level, sections, waterSections, counts[0], counts[1], counts[2],
                        groups[0] + groups[2] + groups[4] + groups[6] + groups[8] + groups[10],
                        groups[1] + groups[3] + groups[5] + groups[7] + groups[9] + groups[11], groups[12]);
                System.out.println("   translucent states: " + transStates);
                transStates.clear();
                System.out.println("   sky light above water surfaces: " + Arrays.toString(skyAboveWater));
                System.out.println("   sky light above ground surfaces: " + Arrays.toString(skyAboveGround));
                Arrays.fill(skyAboveWater, 0);
                Arrays.fill(skyAboveGround, 0);
            }
        }
    }
}
