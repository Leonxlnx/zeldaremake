package dev.vista.core.engine;

import java.util.LinkedHashMap;
import java.util.Map;

/** Bounded LRU of decoded voxel arrays. Arrays handed out must be treated as read-only snapshots. */
final class SectionCache {
    private final int capacity;
    private final LinkedHashMap<Long, int[]> map;

    SectionCache(int capacity) {
        this.capacity = capacity;
        this.map = new LinkedHashMap<>(capacity * 2, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Long, int[]> eldest) {
                return size() > SectionCache.this.capacity;
            }
        };
    }

    synchronized int[] get(long key) { return map.get(key); }

    synchronized void put(long key, int[] voxels) { map.put(key, voxels); }

    synchronized void remove(long key) { map.remove(key); }

    synchronized int size() { return map.size(); }

    synchronized void clear() { map.clear(); }
}
