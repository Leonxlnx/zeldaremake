package dev.vista.bench;

import dev.vista.core.Downsampler;
import dev.vista.core.SectionCodec;
import dev.vista.core.SectionKey;
import dev.vista.core.StateClasses;
import dev.vista.core.Voxel;
import dev.vista.core.engine.DrawList;
import dev.vista.core.engine.LodEngine;
import dev.vista.core.gen.ColumnSamples;
import dev.vista.core.gen.ColumnSynth;
import dev.vista.core.gen.SyntheticTerrain;
import dev.vista.core.mesh.GreedyMesher;
import dev.vista.core.mesh.MeshData;
import dev.vista.core.store.SectionStore;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;
import java.util.zip.Deflater;

/**
 * Headless benchmark of the CPU pipeline on synthetic terrain: synthesis, codec (vs. alternatives), greedy
 * meshing, downsampling, and a full engine warm-up to a steady selection (time-to-horizon, cache size,
 * quad counts). Run with {@code ./gradlew bench}.
 */
public final class PipelineBench {
    public static void main(String[] args) throws Exception {
        StateClasses classes = SyntheticTerrain.classes();
        SyntheticTerrain terrain = new SyntheticTerrain(7);
        List<int[]> sections = new ArrayList<>();
        ColumnSamples cs = new ColumnSamples();
        int[] buf = new int[Voxel.VOLUME];
        long t0 = System.nanoTime();
        int columns = 0;
        for (int level = 0; level <= 4; level++) {
            for (int x = 0; x < 6; x++) {
                terrain.sample(level, x, 3, cs);
                columns++;
                for (int sy = -2; sy <= 9; sy++) {
                    if (ColumnSynth.fill(cs, terrain.surfaces(), terrain.waterState(), level, x, sy >> level, 3, buf, 7)) {
                        sections.add(buf.clone());
                    }
                }
            }
        }
        double synthMs = (System.nanoTime() - t0) / 1e6;
        System.out.printf("synthesis: %d columns -> %d non-empty sections in %.1f ms (%.2f ms/column)%n", columns, sections.size(), synthMs, synthMs / columns);

        // --- codec comparison
        long raw = 0, zstd = 0, deflate = 0, packed = 0;
        long encNs = 0, decNs = 0, defNs = 0;
        int[] out = new int[Voxel.VOLUME];
        for (int rep = 0; rep < 3; rep++) {
            for (int[] s : sections) {
                long a = System.nanoTime();
                byte[] enc = SectionCodec.encode(s);
                long b = System.nanoTime();
                SectionCodec.decode(enc, out);
                long c = System.nanoTime();
                if (rep == 2) {
                    encNs += b - a;
                    decNs += c - b;
                    raw += Voxel.VOLUME * 4L;
                    zstd += enc.length;
                    long d0 = System.nanoTime();
                    deflate += deflateBytePalette(s);
                    defNs += System.nanoTime() - d0;
                    packed += bitPackedSize(s);
                }
            }
        }
        int n = sections.size();
        System.out.printf("codec palette+zstd : %6.1f KiB/section (%.1f%% of raw), encode %.3f ms, decode %.3f ms%n", zstd / 1024.0 / n, 100.0 * zstd / raw, encNs / 1e6 / n, decNs / 1e6 / n);
        System.out.printf("codec palette+deflate: %6.1f KiB/section, encode %.3f ms%n", deflate / 1024.0 / n, defNs / 1e6 / n);
        System.out.printf("codec bitpacked (no entropy): %6.1f KiB/section%n", packed / 1024.0 / n);

        // --- meshing
        GreedyMesher mesher = new GreedyMesher();
        int[][] nb = new int[6][];
        Arrays.fill(nb, GreedyMesher.AIR_NEIGHBOR);
        long quads = 0, faces = 0;
        for (int[] s : sections) mesher.mesh(s, nb, classes);
        long m0 = System.nanoTime();
        for (int rep = 0; rep < 5; rep++) {
            for (int[] s : sections) {
                MeshData md = mesher.mesh(s, nb, classes);
                if (rep == 0) {
                    quads += md.quadCount();
                    faces += countFaces(s, classes);
                }
            }
        }
        double meshMs = (System.nanoTime() - m0) / 1e6 / (5.0 * n);
        System.out.printf("greedy mesh: %.3f ms/section, %d quads from %d exposed faces (%.1fx reduction), %.1f KiB GPU/section%n",
                meshMs, quads, faces, faces / (double) Math.max(1, quads), quads * 8 / 1024.0 / n);

        // --- downsampling
        int[] parent = new int[Voxel.VOLUME];
        long d0 = System.nanoTime();
        for (int rep = 0; rep < 5; rep++) for (int[] s : sections) Downsampler.downsample(s, parent, rep & 7, classes);
        System.out.printf("downsample octant: %.3f ms%n", (System.nanoTime() - d0) / 1e6 / (5.0 * n));

        // --- full engine: time to a converged horizon at several distances
        for (double dist : new double[]{8192, 32768, 131072}) runEngine(dist, args.length > 0 ? Integer.parseInt(args[0]) : Math.max(1, Runtime.getRuntime().availableProcessors() - 1));
    }

    private static void runEngine(double distance, int threads) throws Exception {
        Path dir = Files.createTempDirectory("vista-bench");
        LodEngine.Config cfg = new LodEngine.Config();
        cfg.maxDistance = distance;
        cfg.subdivide = 8;
        cfg.threads = threads;
        LodEngine engine = new LodEngine(cfg, new SectionStore(dir, 128), SyntheticTerrain.classes(), new SyntheticTerrain(99), Throwable::printStackTrace);
        ConcurrentHashMap<Long, Integer> gpu = new ConcurrentHashMap<>();
        engine.setMeshSink((k, m, v) -> {
            gpu.put(k, m.quadCount());
            engine.onMeshUploaded(k, v, m.isEmpty());
        });
        engine.setCamera(0, 120, 0);
        long start = System.nanoTime();
        DrawList dl = DrawList.EMPTY;
        int stable = 0;
        long firstFrameNs = -1;
        while (System.nanoTime() - start < 600e9) {
            Thread.sleep(50);
            dl = engine.select();
            if (firstFrameNs < 0 && dl.count > 0) firstFrameNs = System.nanoTime() - start;
            if (engine.pendingJobs() == 0) {
                if (++stable >= 6) break;
            } else {
                stable = 0;
            }
        }
        double secs = (System.nanoTime() - start) / 1e9;
        long quads = 0;
        int[] perLevel = new int[16];
        for (int i = 0; i < dl.count; i++) {
            quads += gpu.getOrDefault(dl.keys[i], 0);
            perLevel[SectionKey.level(dl.keys[i])]++;
        }
        engine.close();
        long disk;
        try (Stream<Path> s = Files.walk(dir)) {
            disk = s.filter(Files::isRegularFile).mapToLong(p -> p.toFile().length()).sum();
        }
        System.out.printf("engine %6.0f blocks (%d threads): first geometry %.2f s, converged %.1f s; %d nodes, %.2fM quads drawn (%.1f MiB GPU), disk %.1f MiB, levels %s%n",
                distance, threads, firstFrameNs / 1e9, secs, dl.count, quads / 1e6, quads * 8 / 1048576.0, disk / 1048576.0,
                Arrays.toString(Arrays.copyOf(perLevel, engine.topLevel() + 1)));
        System.out.println("  " + engine.stats().summary());
        try (Stream<Path> s = Files.walk(dir)) {
            s.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        }
    }

    private static long countFaces(int[] s, StateClasses c) {
        long f = 0;
        for (int y = 0; y < 32; y++) for (int z = 0; z < 32; z++) for (int x = 0; x < 32; x++) {
            if (c.ofVoxel(s[Voxel.index(x, y, z)]) != StateClasses.OPAQUE) continue;
            int[][] d = {{1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}};
            for (int[] o : d) {
                int nx = x + o[0], ny = y + o[1], nz = z + o[2];
                if (nx < 0 || ny < 0 || nz < 0 || nx > 31 || ny > 31 || nz > 31 || c.ofVoxel(s[Voxel.index(nx, ny, nz)]) != StateClasses.OPAQUE) f++;
            }
        }
        return f;
    }

    private static int deflateBytePalette(int[] s) {
        int[] pal = Arrays.stream(s).distinct().toArray();
        java.util.HashMap<Integer, Integer> idx = new java.util.HashMap<>();
        for (int i = 0; i < pal.length; i++) idx.put(pal[i], i);
        byte[] b = new byte[s.length * 2];
        for (int i = 0; i < s.length; i++) {
            int v = idx.get(s[i]);
            b[i * 2] = (byte) v;
            b[i * 2 + 1] = (byte) (v >> 8);
        }
        Deflater d = new Deflater(1);
        d.setInput(b);
        d.finish();
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] tmp = new byte[65536];
        while (!d.finished()) bo.write(tmp, 0, d.deflate(tmp));
        d.end();
        return bo.size() + pal.length * 4;
    }

    private static int bitPackedSize(int[] s) {
        int p = (int) Arrays.stream(s).distinct().count();
        int bits = Math.max(1, 32 - Integer.numberOfLeadingZeros(Math.max(1, p - 1)));
        return s.length * bits / 8 + p * 4;
    }
}
