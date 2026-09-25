package dev.vista.client.world;

import dev.vista.core.StateClasses;
import dev.vista.core.Voxel;
import dev.vista.core.engine.LodEngine;
import it.unimi.dsi.fastutil.longs.Long2LongMap;
import it.unimi.dsi.fastutil.longs.Long2LongOpenHashMap;
import it.unimi.dsi.fastutil.objects.ObjectIterator;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.Holder;
import net.minecraft.core.SectionPos;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.LightLayer;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.chunk.DataLayer;
import net.minecraft.world.level.chunk.LevelChunk;
import net.minecraft.world.level.chunk.LevelChunkSection;
import net.minecraft.world.level.chunk.PalettedContainer;
import net.minecraft.world.level.chunk.PalettedContainerRO;
import net.minecraft.world.level.levelgen.Heightmap;

/**
 * Feeds real client chunks into the engine. Chunks are marked dirty on load, on light arrival and on block
 * changes, and ingested once they have been quiet for a moment. The main thread only copies palettes and
 * light arrays (microseconds per chunk, time-boxed per tick); decoding happens on worker threads.
 */
public final class ChunkIngestor {
    private static final long QUIET_MS = 750;
    private static final long TICK_BUDGET_NS = 1_500_000;

    private final LodEngine engine;
    private final StateRegistry states;
    private final BiomeRegistry biomes;
    private final Long2LongOpenHashMap dirty = new Long2LongOpenHashMap();

    public ChunkIngestor(LodEngine engine, StateRegistry states, BiomeRegistry biomes) {
        this.engine = engine;
        this.states = states;
        this.biomes = biomes;
    }

    public void markDirty(int chunkX, int chunkZ) {
        dirty.put(ChunkPos.asLong(chunkX, chunkZ), System.currentTimeMillis() + QUIET_MS);
    }

    public int pending() { return dirty.size(); }

    /** Chunk is about to be unloaded: ingest it now if it has unsaved changes. */
    public void onUnload(ClientLevel level, LevelChunk chunk) {
        long key = chunk.getPos().toLong();
        if (dirty.containsKey(key)) {
            dirty.remove(key);
            snapshotAndSubmit(level, chunk);
        }
    }

    public void tick(ClientLevel level) {
        if (dirty.isEmpty()) return;
        long now = System.currentTimeMillis();
        long start = System.nanoTime();
        ObjectIterator<Long2LongMap.Entry> it = dirty.long2LongEntrySet().fastIterator();
        while (it.hasNext()) {
            Long2LongMap.Entry e = it.next();
            if (e.getLongValue() > now) continue;
            long key = e.getLongKey();
            it.remove();
            LevelChunk chunk = level.getChunkSource().getChunk(ChunkPos.getX(key), ChunkPos.getZ(key), false);
            if (chunk != null) snapshotAndSubmit(level, chunk);
            if (System.nanoTime() - start > TICK_BUDGET_NS) break;
        }
    }

    private record SectionSnapshot(PalettedContainer<BlockState> states, int[] biomes, DataLayer sky, DataLayer block) {}

    @SuppressWarnings("unchecked")
    private void snapshotAndSubmit(ClientLevel level, LevelChunk chunk) {
        ChunkPos pos = chunk.getPos();
        LevelChunkSection[] sections = chunk.getSections();
        int minSection = level.getMinSection();
        SectionSnapshot[] snaps = new SectionSnapshot[sections.length];
        var skyLight = level.getLightEngine().getLayerListener(LightLayer.SKY);
        var blockLight = level.getLightEngine().getLayerListener(LightLayer.BLOCK);
        for (int i = 0; i < sections.length; i++) {
            LevelChunkSection s = sections[i];
            if (s == null || s.hasOnlyAir()) continue;
            PalettedContainerRO<Holder<Biome>> bc = s.getBiomes();
            int[] bio = new int[64];
            for (int c = 0; c < 64; c++) bio[c] = biomes.id(bc.get(c & 3, (c >> 4) & 3, (c >> 2) & 3));
            SectionPos sp = SectionPos.of(pos.x, minSection + i, pos.z);
            DataLayer sky = skyLight.getDataLayerData(sp);
            DataLayer blk = blockLight.getDataLayerData(sp);
            snaps[i] = new SectionSnapshot(s.getStates().copy(), bio, sky == null ? null : sky.copy(), blk == null ? null : blk.copy());
        }
        int[] heights = new int[256];
        Heightmap hm = chunk.getOrCreateHeightmapUnprimed(Heightmap.Types.WORLD_SURFACE);
        for (int z = 0; z < 16; z++) for (int x = 0; x < 16; x++) heights[x | z << 4] = hm.getFirstAvailable(x, z);
        boolean neighboursKnown = true;
        int gx = pos.x & ~1, gz = pos.z & ~1;
        for (int j = 0; j < 4; j++) {
            if (!level.getChunkSource().hasChunk(gx + (j & 1), gz + (j >> 1))) neighboursKnown = false;
        }
        boolean nk = neighboursKnown;
        int minY = level.getMinBuildHeight();
        engine.submitWork(-2, () -> {
            int[][] voxels = convert(snaps, heights, minSection, minY);
            engine.ingestChunkNow(pos.x, pos.z, minSection, voxels, nk);
        });
    }

    private int[][] convert(SectionSnapshot[] snaps, int[] heights, int minSection, int minY) {
        int[][] out = new int[snaps.length][];
        StateClasses cls = states.classes();
        int snow = states.snowBlock();
        int[] below = null;
        for (int i = 0; i < snaps.length; i++) {
            SectionSnapshot s = snaps[i];
            if (s == null) {
                below = null;
                continue;
            }
            int[] v = new int[4096];
            int baseY = (minSection + i) * 16;
            for (int y = 0; y < 16; y++) {
                for (int z = 0; z < 16; z++) {
                    for (int x = 0; x < 16; x++) {
                        int id = states.id(s.states.get(x, y, z));
                        int bio = s.biomes[(x >> 2) | (z >> 2) << 2 | (y >> 2) << 4];
                        // Client sky light can lag behind chunk data; exposure from the heightmap is a floor for it.
                        int exposed = baseY + y >= heights[x | z << 4] ? 15 : 0;
                        int sky = s.sky != null ? Math.max(s.sky.get(x, y, z), exposed) : exposed;
                        int blk = s.block != null ? s.block.get(x, y, z) : 0;
                        int idx = y << 8 | z << 4 | x;
                        if (id == StateRegistry.SNOW_LAYER) {
                            id = 0;
                            if (y > 0) {
                                int b = v[idx - 256];
                                if (cls.ofVoxel(b) == StateClasses.OPAQUE) v[idx - 256] = (b & ~0xFFFF) | snow;
                            } else if (below != null) {
                                int bi = 15 << 8 | z << 4 | x;
                                if (cls.ofVoxel(below[bi]) == StateClasses.OPAQUE) below[bi] = (below[bi] & ~0xFFFF) | snow;
                            }
                        }
                        v[idx] = Voxel.pack(id, bio, sky << 4 | blk);
                    }
                }
            }
            out[i] = v;
            below = v;
        }
        return out;
    }
}
