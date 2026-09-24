package dev.vista.core;

import dev.vista.core.engine.DrawList;
import dev.vista.core.engine.LodEngine;
import dev.vista.core.gen.SyntheticTerrain;
import dev.vista.core.mesh.MeshData;
import dev.vista.core.store.SectionStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;

class StoreAndEngineTest {
    @TempDir
    Path dir;

    @Test
    void storeOverwriteDeleteReopenAndTornTail() throws Exception {
        long a = SectionKey.of(0, 3, -2, 5), b = SectionKey.of(0, 4, 7, 5), c = SectionKey.of(2, -40, 0, 99);
        try (SectionStore s = new SectionStore(dir, 4)) {
            s.write(a, new byte[]{1, 2, 3});
            s.write(b, new byte[]{9});
            s.write(a, new byte[]{4, 5});
            s.write(c, new byte[]{7, 7});
            s.write(b, null);
            byte[] cols = new byte[256];
            cols[17] = SectionStore.COLUMN_REAL;
            s.writeColumns(0, 0, 0, cols);
        }
        try (SectionStore s = new SectionStore(dir, 4)) {
            assertArrayEquals(new byte[]{4, 5}, s.read(a));
            assertNull(s.read(b));
            assertArrayEquals(new byte[]{7, 7}, s.read(c));
            assertEquals(SectionStore.COLUMN_REAL, s.readColumns(0, 0, 0)[17]);
            List<Long> keys = new ArrayList<>();
            s.forEachSection(0, 0, 0, keys::add);
            assertEquals(List.of(a), keys);
        }
        Path region = dir.resolve("L0").resolve("r.0.0.vr");
        long len = Files.size(region);
        try (RandomAccessFile f = new RandomAccessFile(region.toFile(), "rw")) {
            f.seek(len);
            f.write(new byte[]{1, 0, 0, 0, 100, 0, 0, 0, 1, 2}); // torn record: claims 100 bytes, has 2
        }
        try (SectionStore s = new SectionStore(dir, 4)) {
            assertArrayEquals(new byte[]{4, 5}, s.read(a));
            s.write(b, new byte[]{8});
        }
        try (SectionStore s = new SectionStore(dir, 4)) {
            assertArrayEquals(new byte[]{8}, s.read(b));
        }
    }

    @Test
    void storeCompactsGarbage() throws Exception {
        long a = SectionKey.of(0, 0, 0, 0);
        byte[] big = new byte[64 * 1024];
        try (SectionStore s = new SectionStore(dir, 4)) {
            for (int i = 0; i < 40; i++) {
                big[0] = (byte) i;
                s.write(a, big);
            }
        }
        long size = Files.size(dir.resolve("L0").resolve("r.0.0.vr"));
        assertTrue(size < 2 * (big.length + 8), "compacted on close, size=" + size);
        try (SectionStore s = new SectionStore(dir, 4)) {
            assertEquals(39, s.read(a)[0]);
        }
    }

    /**
     * End-to-end: generate synthetic terrain, mesh, "upload", and verify the selection covers space with no
     * overlapping nodes (an overlap would z-fight; a gap would be a hole).
     */
    @Test
    void selectionIsAnExactCoverWithoutOverlaps() throws Exception {
        LodEngine.Config cfg = new LodEngine.Config();
        cfg.maxDistance = 6000;
        cfg.subdivide = 4;
        cfg.threads = 3;
        SyntheticTerrain terrain = new SyntheticTerrain(42);
        SectionStore store = new SectionStore(dir.resolve("w"), 64);
        LodEngine engine = new LodEngine(cfg, store, SyntheticTerrain.classes(), terrain, Throwable::printStackTrace);
        ConcurrentHashMap<Long, MeshData> gpu = new ConcurrentHashMap<>();
        engine.setMeshSink((k, m, v) -> {
            gpu.put(k, m);
            engine.onMeshUploaded(k, v, m.isEmpty());
        });
        engine.setCamera(100, 90, 100);
        DrawList dl = DrawList.EMPTY;
        for (int i = 0; i < 400; i++) {
            engine.awaitIdle(20_000);
            dl = engine.select();
            if (engine.pendingJobs() == 0 && i > 3) {
                engine.awaitIdle(2000);
                DrawList again = engine.select();
                if (again.count == dl.count && engine.pendingJobs() == 0) break;
            }
        }
        assertTrue(dl.count > 50, "selection has content: " + dl.count);
        Set<Integer> levels = new HashSet<>();
        for (int i = 0; i < dl.count; i++) levels.add(SectionKey.level(dl.keys[i]));
        assertTrue(levels.contains(0) && levels.size() >= 4, "multiple LOD levels selected: " + levels);
        Set<Long> selected = new HashSet<>();
        for (int i = 0; i < dl.count; i++) selected.add(dl.keys[i]);
        for (int i = 0; i < dl.count; i++) {
            long k = dl.keys[i];
            for (long p = k; SectionKey.level(p) < engine.topLevel(); ) {
                p = SectionKey.parent(p);
                assertFalse(selected.contains(p), "node " + SectionKey.toString(k) + " overlaps ancestor " + SectionKey.toString(p));
            }
            assertTrue(gpu.containsKey(k));
        }
        System.out.println("selection " + dl.count + " nodes, levels " + levels + "; " + engine.stats().summary());
        engine.close();
    }
}
