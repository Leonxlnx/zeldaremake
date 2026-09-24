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
 * Samples the integrated server's world generator directly, without generating, loading or saving chunks.
 * <p>
 * Height: the surface is bracketed with the router's cave-free {@code initialDensityWithoutJaggedness}
 * (vanilla's own preliminary-surface estimate, cheap), then located to one block with the full
 * {@code finalDensity} inside a small window around it. Biome: the biome source's climate sampler at the
 * surface. Sampling density drops with LOD level (every column at L0-1 is sampled on a stride-2 lattice,
 * stride 4 from L2 up) and the gaps are bilinearly interpolated: voxels there are already 4+ blocks wide.
 */
public final class NoiseTerrainSource implements LodEngine.TerrainSource {
    private static final double PRELIMINARY_THRESHOLD = 0.390625;

    private final ServerLevel level;
    private final ChunkGenerator generator;
    private final RandomState randomState;
    private final BiomeSource biomeSource;
    private final Climate.Sampler climate;
    private final DensityFunction density;
    private final DensityFunction preliminary;
    private final StateRegistry states;
    private final BiomeRegistry biomes;
    private final int minY, maxY, seaLevel;
    private final int water;
    private final long seed;
    private final ConcurrentHashMap<Integer, BiomeSurface> surfaces = new ConcurrentHashMap<>();
    public final AtomicLong samples = new AtomicLong();
    public final AtomicLong densityEvals = new AtomicLong();
    private final AtomicLong suspicious = new AtomicLong();

    public NoiseTerrainSource(ServerLevel level, StateRegistry states, BiomeRegistry biomes) {
        this.level = level;
        this.generator = level.getChunkSource().getGenerator();
        this.randomState = level.getChunkSource().randomState();
        this.biomeSource = generator.getBiomeSource();
        this.climate = randomState.sampler();
        boolean noise = generator instanceof NoiseBasedChunkGenerator;
        this.density = noise ? randomState.router().finalDensity() : null;
        this.preliminary = noise ? randomState.router().initialDensityWithoutJaggedness() : null;
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

    static int strideFor(int level) {
        return level <= 1 ? 2 : 4;
    }

    @Override
    public void sample(int lvl, int sx, int sz, ColumnSamples out) {
        int s = 1 << lvl;
        int stride = strideFor(lvl);
        int n = 32 / stride + 1;
        int[] h = new int[n * n];
        int[] b = new int[n * n];
        out.seaLevel = seaLevel;
        out.minY = minY;
        out.maxY = maxY;
        int prev = seaLevel;
        for (int j = 0; j < n; j++) {
            for (int k = 0; k < n; k++) {
                int i = (j & 1) == 0 ? k : n - 1 - k;
                int x = Math.min(31, i * stride), z = Math.min(31, j * stride);
                int wx = (sx * 32 + x) * s + s / 2;
                int wz = (sz * 32 + z) * s + s / 2;
                int height;
                if (density == null) {
                    height = generator.getBaseHeight(wx, wz, Heightmap.Types.OCEAN_FLOOR_WG, level, randomState) - 1;
                } else {
                    int guess = j == 0 && k == 0 ? search(wx, wz, seaLevel, true) : prev;
                    height = surfaceHeight(wx, wz, guess, Math.max(1, s / 2));
                    if (height >= maxY - 16 || height <= minY + 4) {
                        int exact = generator.getBaseHeight(wx, wz, Heightmap.Types.OCEAN_FLOOR_WG, level, randomState) - 1;
                        if (Math.abs(exact - height) > 8 && suspicious.incrementAndGet() <= 20) {
                            dev.vista.client.VistaClient.LOG.warn("Vista height search at {},{} (L{}) gave {} but exact is {} (guess {})", wx, wz, lvl, height, exact, guess);
                        }
                        height = exact;
                    }
                }
                prev = height;
                h[i + j * n] = height;
                b[i + j * n] = biomeAt(wx, Math.max(height, seaLevel), wz);
            }
        }
        for (int z = 0; z < 32; z++) {
            int j0 = Math.min(n - 2, z / stride);
            int z0 = j0 * stride, z1 = Math.min(31, (j0 + 1) * stride);
            double fz = z1 == z0 ? 0 : (z - z0) / (double) (z1 - z0);
            for (int x = 0; x < 32; x++) {
                int i0 = Math.min(n - 2, x / stride);
                int x0 = i0 * stride, x1 = Math.min(31, (i0 + 1) * stride);
                double fx = x1 == x0 ? 0 : (x - x0) / (double) (x1 - x0);
                double a = h[i0 + j0 * n] + (h[i0 + 1 + j0 * n] - h[i0 + j0 * n]) * fx;
                double c = h[i0 + (j0 + 1) * n] + (h[i0 + 1 + (j0 + 1) * n] - h[i0 + (j0 + 1) * n]) * fx;
                out.height[x | z << 5] = (int) Math.round(a + (c - a) * fz);
                int ni = fx < 0.5 ? i0 : i0 + 1, nj = fz < 0.5 ? j0 : j0 + 1;
                out.biome[x | z << 5] = b[ni + nj * n];
            }
        }
        samples.addAndGet((long) n * n);
    }

    private int biomeAt(int wx, int y, int wz) {
        Holder<Biome> biome = biomeSource.getNoiseBiome(QuartPos.fromBlock(wx), QuartPos.fromBlock(y), QuartPos.fromBlock(wz), climate);
        int id = biomes.id(biome);
        surfaces.computeIfAbsent(id, k -> BiomeSurfaces.of(biome, states));
        return id;
    }

    /** Compares the height search against vanilla's exact column query; logged once per session. */
    public String selfTest() {
        if (density == null) return "exact generator heights (non-noise generator)";
        int n = 0;
        long fastNs = 0, exactNs = 0, errSum = 0, errMax = 0, within2 = 0;
        long evals0 = densityEvals.get();
        for (int i = 0; i < 12; i++) {
            for (int j = 0; j < 12; j++) {
                int x = i * 211 - 1200, z = j * 197 - 1100;
                long a = System.nanoTime();
                int fast = surfaceHeight(x, z, seaLevel);
                long b = System.nanoTime();
                int exact = generator.getBaseHeight(x, z, Heightmap.Types.OCEAN_FLOOR_WG, level, randomState) - 1;
                long c = System.nanoTime();
                fastNs += b - a;
                exactNs += c - b;
                int err = Math.abs(fast - exact);
                errSum += err;
                errMax = Math.max(errMax, err);
                if (err <= 2) within2++;
                n++;
            }
        }
        long evals = densityEvals.get() - evals0;
        long p0 = System.nanoTime();
        for (int i = 0; i < 200; i++) preliminary.compute(new DensityFunction.SinglePointContext(i * 37, 70, i * 53));
        long p1 = System.nanoTime();
        for (int i = 0; i < 200; i++) density.compute(new DensityFunction.SinglePointContext(i * 37, 70, i * 53));
        long p2 = System.nanoTime();
        return String.format("height %.1f us/col (%.1f evals) vs exact %.1f us/col (%.1fx faster); |error| mean %.2f, max %d, %.0f%% within 2 blocks; eval cost preliminary %.1f us, final %.1f us",
                fastNs / 1e3 / n, evals / (double) n, exactNs / 1e3 / n, exactNs / (double) Math.max(1, fastNs), errSum / (double) n, errMax,
                100.0 * within2 / n, (p1 - p0) / 200e3, (p2 - p1) / 200e3);
    }

    private boolean solid(int x, int y, int z) {
        densityEvals.incrementAndGet();
        return density.compute(new DensityFunction.SinglePointContext(x, y, z)) > 0;
    }

    private boolean roughSolid(int x, int y, int z) {
        densityEvals.incrementAndGet();
        return preliminary.compute(new DensityFunction.SinglePointContext(x, y, z)) > PRELIMINARY_THRESHOLD;
    }

    /** Y of the highest solid block, exact to one block. */
    private int surfaceHeight(int x, int z, int guess) {
        return surfaceHeight(x, z, search(x, z, guess, true), 1);
    }

    /**
     * Y of the highest solid block to within {@code res} blocks, searched with the final density around
     * {@code guess}. Coarse LOD voxels are {@code 2^L} blocks tall, so far samples need only a few evaluations.
     */
    private int surfaceHeight(int x, int z, int guess, int res) {
        int top = maxY - 1;
        int step = Math.max(4, res * 2);
        int hi = Math.min(top, guess + step);
        int lo;
        if (solid(x, hi, z)) {
            lo = hi;
            while (true) {
                int next = Math.min(top, lo + step);
                if (next == lo) return lo;
                if (!solid(x, next, z)) { hi = next; break; }
                lo = next;
                step *= 2;
            }
        } else {
            int air = hi;
            while (true) {
                int next = air - step;
                if (next <= minY) return minY;
                if (solid(x, next, z)) { lo = next; hi = air; break; }
                air = next;
                if (step < 32) step *= 2;
            }
        }
        while (hi - lo > res) {
            int mid = (lo + hi) >>> 1;
            if (solid(x, mid, z)) lo = mid; else hi = mid;
        }
        return lo + (hi - lo - 1) / 2;
    }

    /** Highest solid y near {@code guess}: grow upward while solid, else step down until solid, then bisect. */
    private int search(int x, int z, int guess, boolean rough) {
        int top = maxY - 1;
        int hi = Math.min(top, guess + 12);
        if (test(x, hi, z, rough)) {
            int step = 16, lo = hi;
            while (true) {
                int next = Math.min(top, lo + step);
                if (next == lo) return top;
                if (!test(x, next, z, rough)) { hi = next; break; }
                lo = next;
                step *= 2;
            }
            return bisect(x, z, lo, hi, rough);
        }
        int step = 8, air = hi;
        while (true) {
            int next = air - step;
            if (next <= minY) return minY;
            if (test(x, next, z, rough)) return bisect(x, z, next, air, rough);
            air = next;
            if (step < 32) step *= 2;
        }
    }

    private boolean test(int x, int y, int z, boolean rough) {
        return rough ? roughSolid(x, y, z) : solid(x, y, z);
    }

    /** {@code lo} is solid, {@code hi} is air; returns the highest solid y between them. */
    private int bisect(int x, int z, int lo, int hi, boolean rough) {
        while (hi - lo > 1) {
            int mid = (lo + hi) >>> 1;
            if (test(x, mid, z, rough)) lo = mid; else hi = mid;
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
