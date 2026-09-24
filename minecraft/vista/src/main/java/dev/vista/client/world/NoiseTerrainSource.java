package dev.vista.client.world;

import dev.vista.core.gen.BiomeSurface;
import dev.vista.core.gen.ColumnSamples;
import dev.vista.core.gen.ColumnSynth;
import dev.vista.core.engine.LodEngine;
import net.minecraft.core.Holder;
import net.minecraft.core.QuartPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.biome.BiomeSource;
import net.minecraft.world.level.biome.Climate;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.DensityFunction;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.NoiseBasedChunkGenerator;
import net.minecraft.world.level.levelgen.RandomState;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Samples the integrated server's world generator directly: terrain height from the noise router's final
 * density (bracketed from the neighbouring column's height and bisected to one block, about 8 density
 * evaluations per column instead of building a {@code NoiseChunk}), and the surface biome from the biome
 * source's climate sampler. No chunks are generated, loaded or saved.
 */
public final class NoiseTerrainSource implements LodEngine.TerrainSource {
    private final ServerLevel level;
    private final ChunkGenerator generator;
    private final RandomState randomState;
    private final BiomeSource biomeSource;
    private final Climate.Sampler climate;
    private final DensityFunction density;
    private final StateRegistry states;
    private final BiomeRegistry biomes;
    private final int minY, maxY, seaLevel;
    private final int water;
    private final long seed;
    private final ConcurrentHashMap<Integer, BiomeSurface> surfaces = new ConcurrentHashMap<>();
    public final AtomicLong samples = new AtomicLong();
    public final AtomicLong densityEvals = new AtomicLong();

    public NoiseTerrainSource(ServerLevel level, StateRegistry states, BiomeRegistry biomes) {
        this.level = level;
        this.generator = level.getChunkSource().getGenerator();
        this.randomState = level.getChunkSource().randomState();
        this.biomeSource = generator.getBiomeSource();
        this.climate = randomState.sampler();
        this.density = generator instanceof NoiseBasedChunkGenerator ? randomState.router().finalDensity() : null;
        this.states = states;
        this.biomes = biomes;
        this.minY = level.getMinBuildHeight();
        this.maxY = level.getMaxBuildHeight();
        this.seaLevel = generator.getSeaLevel();
        this.water = states.water();
        this.seed = level.getSeed();
    }

    public static boolean supports(ServerLevel level) {
        return !level.dimensionType().hasCeiling();
    }

    @Override
    public void sample(int lvl, int sx, int sz, ColumnSamples out) {
        int s = 1 << lvl;
        out.seaLevel = seaLevel;
        int prev = seaLevel;
        for (int z = 0; z < 32; z++) {
            // Serpentine order keeps consecutive samples adjacent, so the previous height is a tight bracket.
            for (int i = 0; i < 32; i++) {
                int x = (z & 1) == 0 ? i : 31 - i;
                int wx = (sx * 32 + x) * s + s / 2;
                int wz = (sz * 32 + z) * s + s / 2;
                int h = density != null ? surfaceHeight(wx, wz, prev) : generator.getBaseHeight(wx, wz, Heightmap.Types.OCEAN_FLOOR_WG, level, randomState) - 1;
                prev = h;
                int by = Math.max(h, seaLevel);
                Holder<Biome> biome = biomeSource.getNoiseBiome(QuartPos.fromBlock(wx), QuartPos.fromBlock(by), QuartPos.fromBlock(wz), climate);
                int id = biomes.id(biome);
                surfaces.computeIfAbsent(id, k -> BiomeSurfaces.of(biome, states));
                out.height[x | z << 5] = h;
                out.biome[x | z << 5] = id;
            }
        }
        samples.addAndGet(1024);
    }

    private boolean solid(int x, int y, int z) {
        densityEvals.incrementAndGet();
        return density.compute(new DensityFunction.SinglePointContext(x, y, z)) > 0;
    }

    /** Y of the highest solid block, searched downward from above a guess and refined by bisection. */
    private int surfaceHeight(int x, int z, int guess) {
        int top = maxY - 1;
        int hi = Math.min(top, guess + 12);
        if (solid(x, hi, z)) {
            // Surface is above the guess: climb in growing steps until two consecutive air samples.
            int step = 16;
            int lo = hi;
            while (true) {
                int next = Math.min(top, lo + step);
                if (next == lo) return top;
                if (!solid(x, next, z)) {
                    hi = next;
                    break;
                }
                lo = next;
                step *= 2;
            }
            return bisect(x, z, lo, hi);
        }
        int step = 8;
        int air = hi;
        while (true) {
            int next = air - step;
            if (next <= minY) return minY;
            if (solid(x, next, z)) return bisect(x, z, next, air);
            air = next;
            if (step < 32) step *= 2;
        }
    }

    /** {@code lo} is solid, {@code hi} is air; returns the highest solid y between them. */
    private int bisect(int x, int z, int lo, int hi) {
        while (hi - lo > 1) {
            int mid = (lo + hi) >>> 1;
            if (solid(x, mid, z)) lo = mid; else hi = mid;
        }
        return lo;
    }

    @Override
    public ColumnSynth.SurfaceTable surfaces() {
        return b -> {
            BiomeSurface s = surfaces.get(b);
            if (s != null) return s;
            Holder<Biome> h = biomes.holder(level, b);
            if (h == null) h = level.registryAccess().registryOrThrow(net.minecraft.core.registries.Registries.BIOME)
                    .getHolderOrThrow(net.minecraft.world.level.biome.Biomes.PLAINS);
            Holder<Biome> fh = h;
            return surfaces.computeIfAbsent(b, k -> BiomeSurfaces.of(fh, states));
        };
    }

    @Override
    public int waterState() { return water; }

    @Override
    public long seed() { return seed; }
}
