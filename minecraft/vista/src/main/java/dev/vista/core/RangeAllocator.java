package dev.vista.core;

import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Best-fit allocator over a linear range of units (quads in the GPU buffer), with O(log n) allocate/free
 * and immediate coalescing of neighbouring free blocks. Not thread-safe (render thread only).
 */
public final class RangeAllocator {
    private final TreeMap<Integer, Integer> freeByOffset = new TreeMap<>();
    /** (size << 32 | offset) of every free block, for best-fit lookup. */
    private final TreeSet<Long> freeBySize = new TreeSet<>();
    private int capacity;
    private long used;

    public RangeAllocator(int capacity) {
        this.capacity = capacity;
        addFree(0, capacity);
    }

    public int capacity() { return capacity; }
    public long used() { return used; }

    /** Returns the offset of a block of {@code size} units, or -1 if no free block is large enough. */
    public int allocate(int size) {
        if (size <= 0) throw new IllegalArgumentException("size " + size);
        Long best = freeBySize.ceiling((long) size << 32);
        if (best == null) return -1;
        int off = (int) (best & 0xFFFFFFFFL);
        int blk = (int) (best >>> 32);
        removeFree(off, blk);
        if (blk > size) addFree(off + size, blk - size);
        used += size;
        return off;
    }

    public void free(int offset, int size) {
        used -= size;
        int start = offset, len = size;
        Map.Entry<Integer, Integer> prev = freeByOffset.floorEntry(offset);
        if (prev != null && prev.getKey() + prev.getValue() == offset) {
            start = prev.getKey();
            len += prev.getValue();
            removeFree(prev.getKey(), prev.getValue());
        }
        Integer nextSize = freeByOffset.get(offset + size);
        if (nextSize != null) {
            len += nextSize;
            removeFree(offset + size, nextSize);
        }
        addFree(start, len);
    }

    /** Extends the managed range (after the backing buffer has been grown). */
    public void grow(int newCapacity) {
        if (newCapacity <= capacity) return;
        int old = capacity;
        capacity = newCapacity;
        used += newCapacity - old;
        free(old, newCapacity - old);
    }

    public int largestFree() {
        return freeBySize.isEmpty() ? 0 : (int) (freeBySize.last() >>> 32);
    }

    private void addFree(int off, int size) {
        freeByOffset.put(off, size);
        freeBySize.add((long) size << 32 | off);
    }

    private void removeFree(int off, int size) {
        freeByOffset.remove(off);
        freeBySize.remove((long) size << 32 | off);
    }
}
