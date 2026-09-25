package dev.vista.core;

import io.airlift.compress.zstd.ZstdCompressor;
import io.airlift.compress.zstd.ZstdDecompressor;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Serialises a 32^3 voxel section: palette + byte/short indices, then Zstandard (pure Java).
 * Byte-aligned indices compress far better under zstd than bit-packed ones because runs of the same
 * block stay byte-periodic (see {@code PipelineBench} for the measured comparison).
 */
public final class SectionCodec {
    private static final byte UNIFORM = 0, BYTES = 1, SHORTS = 2;

    private static final ThreadLocal<State> STATE = ThreadLocal.withInitial(State::new);

    private SectionCodec() {}

    private static final class State {
        final ZstdCompressor compressor = new ZstdCompressor();
        final ZstdDecompressor decompressor = new ZstdDecompressor();
        final IntIntMap palette = new IntIntMap(512);
        final int[] paletteValues = new int[Voxel.VOLUME];
        final byte[] raw = new byte[Voxel.VOLUME * 2 + Voxel.VOLUME * 4 + 16];
        byte[] out = new byte[new ZstdCompressor().maxCompressedLength(raw.length) + 16];
    }

    public static byte[] encode(int[] voxels) {
        State s = STATE.get();
        IntIntMap pal = s.palette;
        pal.clear();
        int n = 0;
        int first = voxels[0];
        boolean uniform = true;
        for (int i = 0; i < Voxel.VOLUME; i++) {
            if (voxels[i] != first) { uniform = false; break; }
        }
        if (uniform) {
            byte[] b = new byte[5];
            b[0] = UNIFORM;
            ByteBuffer.wrap(b, 1, 4).order(ByteOrder.LITTLE_ENDIAN).putInt(first);
            return b;
        }
        for (int i = 0; i < Voxel.VOLUME; i++) {
            int v = voxels[i];
            if (pal.get(v) < 0) {
                pal.put(v, n);
                s.paletteValues[n++] = v;
            }
        }
        byte fmt = n <= 256 ? BYTES : SHORTS;
        ByteBuffer raw = ByteBuffer.wrap(s.raw).order(ByteOrder.LITTLE_ENDIAN);
        raw.putInt(n);
        for (int i = 0; i < n; i++) raw.putInt(s.paletteValues[i]);
        if (fmt == BYTES) {
            for (int i = 0; i < Voxel.VOLUME; i++) raw.put((byte) pal.get(voxels[i]));
        } else {
            for (int i = 0; i < Voxel.VOLUME; i++) raw.putShort((short) pal.get(voxels[i]));
        }
        int rawLen = raw.position();
        int max = s.compressor.maxCompressedLength(rawLen);
        if (s.out.length < max + 5) s.out = new byte[max + 5];
        int clen = s.compressor.compress(s.raw, 0, rawLen, s.out, 5, max);
        s.out[0] = fmt;
        ByteBuffer.wrap(s.out, 1, 4).order(ByteOrder.LITTLE_ENDIAN).putInt(rawLen);
        byte[] result = new byte[clen + 5];
        System.arraycopy(s.out, 0, result, 0, clen + 5);
        return result;
    }

    public static void decode(byte[] data, int[] voxels) {
        ByteBuffer hdr = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
        byte fmt = hdr.get();
        if (fmt == UNIFORM) {
            java.util.Arrays.fill(voxels, hdr.getInt());
            return;
        }
        int rawLen = hdr.getInt();
        State s = STATE.get();
        s.decompressor.decompress(data, 5, data.length - 5, s.raw, 0, rawLen);
        ByteBuffer raw = ByteBuffer.wrap(s.raw, 0, rawLen).order(ByteOrder.LITTLE_ENDIAN);
        int n = raw.getInt();
        int[] pal = s.paletteValues;
        for (int i = 0; i < n; i++) pal[i] = raw.getInt();
        int off = raw.position();
        byte[] r = s.raw;
        if (fmt == BYTES) {
            for (int i = 0; i < Voxel.VOLUME; i++) voxels[i] = pal[r[off + i] & 0xFF];
        } else {
            for (int i = 0; i < Voxel.VOLUME; i++) {
                int j = off + i * 2;
                voxels[i] = pal[(r[j] & 0xFF) | (r[j + 1] & 0xFF) << 8];
            }
        }
    }

    /** Minimal open-addressing int→int map (no boxing); returns -1 for missing keys. */
    static final class IntIntMap {
        private int[] keys;
        private int[] vals;
        private boolean[] used;
        private int mask;
        private int size;

        IntIntMap(int cap) {
            int c = Integer.highestOneBit(Math.max(4, cap) - 1) << 1;
            keys = new int[c];
            vals = new int[c];
            used = new boolean[c];
            mask = c - 1;
        }

        void clear() {
            java.util.Arrays.fill(used, false);
            size = 0;
        }

        int get(int k) {
            int i = mix(k) & mask;
            while (used[i]) {
                if (keys[i] == k) return vals[i];
                i = (i + 1) & mask;
            }
            return -1;
        }

        void put(int k, int v) {
            if (size * 2 >= keys.length) grow();
            int i = mix(k) & mask;
            while (used[i]) {
                if (keys[i] == k) { vals[i] = v; return; }
                i = (i + 1) & mask;
            }
            used[i] = true;
            keys[i] = k;
            vals[i] = v;
            size++;
        }

        private void grow() {
            int[] ok = keys, ov = vals;
            boolean[] ou = used;
            keys = new int[ok.length * 2];
            vals = new int[ok.length * 2];
            used = new boolean[ok.length * 2];
            mask = keys.length - 1;
            size = 0;
            for (int i = 0; i < ok.length; i++) if (ou[i]) put(ok[i], ov[i]);
        }

        private static int mix(int k) {
            int h = k * 0x9E3779B9;
            return h ^ (h >>> 16);
        }
    }
}
