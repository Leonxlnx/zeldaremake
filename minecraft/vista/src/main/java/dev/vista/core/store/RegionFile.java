package dev.vista.core.store;

import it.unimi.dsi.fastutil.ints.Int2LongMap;
import it.unimi.dsi.fastutil.ints.Int2LongOpenHashMap;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.function.IntConsumer;

/**
 * Append-only log of records {@code [int localKey][int length][bytes]} for one region
 * (16x16 section columns of one LOD level, all heights). The newest record for a key wins; the index is
 * rebuilt by a sequential scan on open, which also trims a torn tail after a crash. Dead bytes are
 * reclaimed by {@link #compactIfWasteful()}.
 */
final class RegionFile implements AutoCloseable {
    static final int META_KEY = 0x7FFFFFFF;
    private static final int HEADER = 8;
    private static final int TOMBSTONE = -1;

    private final Path path;
    private FileChannel channel;
    private final Int2LongOpenHashMap index = new Int2LongOpenHashMap();
    private long end;
    private long garbage;

    RegionFile(Path path) throws IOException {
        this.path = path;
        Files.createDirectories(path.getParent());
        this.channel = FileChannel.open(path, StandardOpenOption.CREATE, StandardOpenOption.READ, StandardOpenOption.WRITE);
        index.defaultReturnValue(-1);
        scan();
    }

    static int localKey(int lx, int y, int lz) {
        return (lx & 15) | (lz & 15) << 4 | (y & 0xFFF) << 8;
    }

    static int localX(int key) { return key & 15; }
    static int localZ(int key) { return (key >> 4) & 15; }
    static int localY(int key) { return key << 12 >> 20; }

    private void scan() throws IOException {
        long size = channel.size();
        ByteBuffer hdr = ByteBuffer.allocate(HEADER).order(ByteOrder.LITTLE_ENDIAN);
        long pos = 0;
        while (pos + HEADER <= size) {
            hdr.clear();
            if (readFully(hdr, pos) < HEADER) break;
            hdr.flip();
            int key = hdr.getInt();
            int len = hdr.getInt();
            if (len == TOMBSTONE) {
                long old = index.remove(key);
                if (old != -1) garbage += (old & 0xFFFFFF) + HEADER;
                garbage += HEADER;
                pos += HEADER;
                continue;
            }
            if (len < 0 || len > 0xFFFFFF || pos + HEADER + len > size) break;
            long old = index.put(key, (pos + HEADER) << 24 | len);
            if (old != -1) garbage += (old & 0xFFFFFF) + HEADER;
            pos += HEADER + len;
        }
        end = pos;
        if (end < size) channel.truncate(end);
    }

    private int readFully(ByteBuffer buf, long pos) throws IOException {
        int total = 0;
        while (buf.hasRemaining()) {
            int r = channel.read(buf, pos + total);
            if (r < 0) break;
            total += r;
        }
        return total;
    }

    synchronized byte[] read(int key) throws IOException {
        long e = index.get(key);
        if (e == -1) return null;
        int len = (int) (e & 0xFFFFFF);
        ByteBuffer buf = ByteBuffer.allocate(len);
        if (readFully(buf, e >>> 24) < len) return null;
        return buf.array();
    }

    synchronized boolean contains(int key) {
        return index.containsKey(key);
    }

    synchronized void write(int key, byte[] data) throws IOException {
        long old = index.get(key);
        if (data == null) {
            if (old == -1) return;
            ByteBuffer hdr = ByteBuffer.allocate(HEADER).order(ByteOrder.LITTLE_ENDIAN);
            hdr.putInt(key).putInt(TOMBSTONE).flip();
            writeFully(hdr, end);
            end += HEADER;
            index.remove(key);
            garbage += (old & 0xFFFFFF) + 2L * HEADER;
            return;
        }
        ByteBuffer buf = ByteBuffer.allocate(HEADER + data.length).order(ByteOrder.LITTLE_ENDIAN);
        buf.putInt(key).putInt(data.length).put(data).flip();
        writeFully(buf, end);
        index.put(key, (end + HEADER) << 24 | data.length);
        end += HEADER + data.length;
        if (old != -1) garbage += (old & 0xFFFFFF) + HEADER;
    }

    private void writeFully(ByteBuffer buf, long pos) throws IOException {
        long p = pos;
        while (buf.hasRemaining()) p += channel.write(buf, p);
    }

    synchronized void forEachKey(IntConsumer consumer) {
        for (Int2LongMap.Entry e : index.int2LongEntrySet()) consumer.accept(e.getIntKey());
    }

    synchronized long liveBytes() { return end - garbage; }

    synchronized long fileBytes() { return end; }

    synchronized void compactIfWasteful() throws IOException {
        if (garbage < 256 * 1024 || garbage * 2 < end) return;
        Path tmp = path.resolveSibling(path.getFileName() + ".tmp");
        try (FileChannel out = FileChannel.open(tmp, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE)) {
            Int2LongOpenHashMap fresh = new Int2LongOpenHashMap();
            fresh.defaultReturnValue(-1);
            long pos = 0;
            for (Int2LongMap.Entry e : index.int2LongEntrySet()) {
                int len = (int) (e.getLongValue() & 0xFFFFFF);
                ByteBuffer buf = ByteBuffer.allocate(HEADER + len).order(ByteOrder.LITTLE_ENDIAN);
                buf.putInt(e.getIntKey()).putInt(len);
                ByteBuffer body = buf.slice(HEADER, len);
                int total = 0;
                while (body.hasRemaining()) {
                    int r = channel.read(body, (e.getLongValue() >>> 24) + total);
                    if (r < 0) break;
                    total += r;
                }
                buf.position(0).limit(HEADER + len);
                long p = pos;
                while (buf.hasRemaining()) p += out.write(buf, p);
                fresh.put(e.getIntKey(), (pos + HEADER) << 24 | len);
                pos += HEADER + len;
            }
            out.force(false);
            channel.close();
            Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            channel = FileChannel.open(path, StandardOpenOption.READ, StandardOpenOption.WRITE);
            index.clear();
            index.putAll(fresh);
            end = pos;
            garbage = 0;
        }
    }

    @Override
    public synchronized void close() throws IOException {
        try {
            compactIfWasteful();
        } finally {
            channel.close();
        }
    }
}
