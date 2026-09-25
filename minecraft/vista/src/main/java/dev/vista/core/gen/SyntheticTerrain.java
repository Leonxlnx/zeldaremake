package dev.vista.core.gen;

import dev.vista.core.StateClasses;
import dev.vista.core.engine.LodEngine;

/**
 * A deterministic, Minecraft-free terrain source (fBm heights, five biomes) used by tests and the headless
 * benchmark. Its per-sample cost is deliberately in the same order as vanilla's column height query.
 */
public final class SyntheticTerrain implements LodEngine.TerrainSource {
    public static final int GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LEAVES = 6, LOG = 7, SNOW = 8, ICE = 9,
            DEEPSLATE = 10, GRAVEL = 11, SANDSTONE = 12;

    private final long seed;
    private final BiomeSurface[] biomes = new BiomeSurface[5];

    public SyntheticTerrain(long seed) {
        this.seed = seed;
        biomes[0] = new BiomeSurface(GRASS, DIRT, SAND, STONE, DEEPSLATE, LEAVES, LOG, 0.05f, 6, false, SNOW, ICE);
        biomes[1] = new BiomeSurface(GRASS, DIRT, GRAVEL, STONE, DEEPSLATE, LEAVES, LOG, 0.8f, 7, false, SNOW, ICE);
        biomes[2] = new BiomeSurface(SAND, SANDSTONE, SAND, STONE, DEEPSLATE, LEAVES, LOG, 0f, 6, false, SNOW, ICE);
        biomes[3] = new BiomeSurface(SAND, SAND, GRAVEL, STONE, DEEPSLATE, LEAVES, LOG, 0f, 6, false, SNOW, ICE);
        biomes[4] = new BiomeSurface(STONE, STONE, GRAVEL, STONE, DEEPSLATE, LEAVES, LOG, 0.1f, 8, true, SNOW, ICE);
    }

    public static StateClasses classes() {
        StateClasses c = new StateClasses();
        for (int s = 1; s <= 12; s++) c.set(s, StateClasses.OPAQUE);
        c.set(WATER, StateClasses.TRANSLUCENT);
        c.set(ICE, StateClasses.TRANSLUCENT);
        return c;
    }

    @Override
    public void sample(int level, int sx, int sz, ColumnSamples out) {
        int s = 1 << level;
        out.seaLevel = 63;
        for (int z = 0; z < 32; z++) {
            for (int x = 0; x < 32; x++) {
                double wx = (sx * 32 + x) * (double) s + s * 0.5, wz = (sz * 32 + z) * (double) s + s * 0.5;
                double continent = fbm(wx / 2400.0, wz / 2400.0, 4);
                double hills = fbm(wx / 300.0, wz / 300.0, 5);
                double ridge = 1 - Math.abs(fbm(wx / 900.0 + 17, wz / 900.0 - 5, 4));
                double mountain = Math.max(0, continent - 0.1) * ridge * ridge * 260;
                int h = (int) (60 + continent * 40 + hills * 14 + mountain);
                double moist = fbm(wx / 1500.0 + 100, wz / 1500.0, 3);
                int biome;
                if (h < 60) biome = 3;
                else if (h > 150) biome = 4;
                else if (moist < -0.25) biome = 2;
                else if (moist > 0.1) biome = 1;
                else biome = 0;
                out.height[x | z << 5] = h;
                out.biome[x | z << 5] = biome;
            }
        }
    }

    private double fbm(double x, double z, int octaves) {
        double sum = 0, amp = 0.5, f = 1;
        for (int i = 0; i < octaves; i++) {
            sum += amp * valueNoise(x * f, z * f, i);
            f *= 2.03;
            amp *= 0.5;
        }
        return sum * 2;
    }

    private double valueNoise(double x, double z, int o) {
        int x0 = (int) Math.floor(x), z0 = (int) Math.floor(z);
        double fx = x - x0, fz = z - z0;
        fx = fx * fx * (3 - 2 * fx);
        fz = fz * fz * (3 - 2 * fz);
        double a = rnd(x0, z0, o), b = rnd(x0 + 1, z0, o), c = rnd(x0, z0 + 1, o), d = rnd(x0 + 1, z0 + 1, o);
        return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
    }

    private double rnd(int x, int z, int o) {
        long h = ColumnSynth.mix(x * 0x9E3779B97F4A7C15L ^ z * 0xC2B2AE3D27D4EB4FL ^ (seed + o * 0x632BE59BD9B4E019L));
        return ((h >>> 11) / (double) (1L << 53)) * 2 - 1;
    }

    @Override
    public ColumnSynth.SurfaceTable surfaces() {
        return b -> biomes[Math.min(b, biomes.length - 1)];
    }

    @Override
    public int waterState() { return WATER; }

    @Override
    public long seed() { return seed; }
}
