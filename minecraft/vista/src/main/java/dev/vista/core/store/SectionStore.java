package dev.vista.core.store;

import dev.vista.core.SectionKey;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongConsumer;
import java.util.stream.Stream;

/**
 * Persistent section storage: one {@link RegionFile} per (level, 16x16 section columns), with an LRU of
 * open files. Each region additionally stores one metadata record: a byte per column describing where
 * that column's data came from ({@link #COLUMN_UNKNOWN}, {@link #COLUMN_GENERATED}, {@link #COLUMN_REAL}).
 */
public final class SectionStore implements AutoCloseable {
    public static final byte COLUMN_UNKNOWN = 0;
    public static final byte COLUMN_GENERATED = 1;
    public static final byte COLUMN_REAL = 2;

    private final Path root;
    private final int maxOpen;
    private final LinkedHashMap<Long, RegionFile> open;
    private boolean closed;

    public SectionStore(Path root, int maxOpen) {
        this.root = root;
        this.maxOpen = maxOpen;
        this.open = new LinkedHashMap<>(64, 0.75f, true);
    }

    public Path root() { return root; }

    private static long regionKey(int level, int rx, int rz) {
        return SectionKey.columnOf(level, rx, rz);
    }

    private RegionFile region(int level, int rx, int rz) throws IOException {
        long rk = regionKey(level, rx, rz);
        synchronized (open) {
            if (closed) throw new IOException("store closed");
            RegionFile f = open.get(rk);
            if (f != null) return f;
            f = new RegionFile(root.resolve("L" + level).resolve("r." + rx + "." + rz + ".vr"));
            open.put(rk, f);
            if (open.size() > maxOpen) {
                Iterator<Map.Entry<Long, RegionFile>> it = open.entrySet().iterator();
                Map.Entry<Long, RegionFile> eldest = it.next();
                it.remove();
                eldest.getValue().close();
            }
            return f;
        }
    }

    private RegionFile regionOf(long key) throws IOException {
        return region(SectionKey.level(key), SectionKey.x(key) >> 4, SectionKey.z(key) >> 4);
    }

    private static int local(long key) {
        return RegionFile.localKey(SectionKey.x(key), SectionKey.y(key), SectionKey.z(key));
    }

    public byte[] read(long key) {
        for (int attempt = 0; ; attempt++) {
            try {
                return regionOf(key).read(local(key));
            } catch (java.nio.channels.ClosedChannelException e) {
                if (attempt > 2 || closed) throw new UncheckedIOException(e);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
    }

    public void write(long key, byte[] data) {
        for (int attempt = 0; ; attempt++) {
            try {
                regionOf(key).write(local(key), data);
                return;
            } catch (java.nio.channels.ClosedChannelException e) {
                if (attempt > 2 || closed) throw new UncheckedIOException(e);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
    }

    /** Column source flags for the 16x16 columns of a region, indexed {@code lx | lz << 4}. */
    public byte[] readColumns(int level, int rx, int rz) {
        try {
            byte[] meta = region(level, rx, rz).read(RegionFile.META_KEY);
            return meta != null && meta.length == 256 ? meta : new byte[256];
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void writeColumns(int level, int rx, int rz, byte[] columns) {
        try {
            region(level, rx, rz).write(RegionFile.META_KEY, columns);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Visits every stored section key of a region (not the metadata record). */
    public void forEachSection(int level, int rx, int rz, LongConsumer consumer) {
        try {
            region(level, rx, rz).forEachKey(k -> {
                if (k == RegionFile.META_KEY) return;
                consumer.accept(SectionKey.of(level, (rx << 4) | RegionFile.localX(k), RegionFile.localY(k), (rz << 4) | RegionFile.localZ(k)));
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** Total bytes on disk (all regions, including not-yet-compacted garbage). */
    public long diskBytes() {
        if (!Files.isDirectory(root)) return 0;
        try (Stream<Path> s = Files.walk(root)) {
            return s.filter(Files::isRegularFile).mapToLong(p -> {
                try { return Files.size(p); } catch (IOException e) { return 0; }
            }).sum();
        } catch (IOException e) {
            return 0;
        }
    }

    @Override
    public void close() {
        synchronized (open) {
            closed = true;
            for (RegionFile f : open.values()) {
                try { f.close(); } catch (IOException ignored) {}
            }
            open.clear();
        }
    }
}
