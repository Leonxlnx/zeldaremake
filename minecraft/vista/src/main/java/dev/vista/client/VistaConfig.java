package dev.vista.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** User configuration, stored as {@code config/vista.json}. */
public final class VistaConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public boolean enabled = true;
    /** Far render distance in chunks (16 blocks). 2048 chunks = 32 km. */
    public int renderDistanceChunks = 2048;
    /**
     * Detail factor: a node is refined while the camera is closer than {@code detail x its size}. 8 keeps
     * voxels at about 3 px on a 1080p screen at the switch distance; 16 is about 1.5 px.
     */
    public double detail = 8;
    /** Synthesise terrain from the world generator's noise beyond explored areas (singleplayer only). */
    public boolean generateTerrain = true;
    /** Worker threads; 0 = auto (cores - 2). */
    public int threads = 0;
    /** MSAA samples for the far-terrain pass (1, 2, 4 or 8). */
    public int msaa = 4;
    /** GPU upload budget per frame, in MiB. Bounds frame-time spikes while streaming. */
    public double uploadBudgetMiB = 6;
    /** Initial GPU geometry buffer, in MiB (grows on demand up to {@link #maxGpuMemoryMiB}). */
    public int gpuMemoryMiB = 256;
    public int maxGpuMemoryMiB = 2048;
    /** Duration of the dithered cross-fade when LOD nodes swap, in seconds. */
    public double fadeSeconds = 0.6;
    /** Fraction of the far distance where fog starts. */
    public double fogStart = 0.12;
    /** Decoded sections kept in RAM (128 KiB each). */
    public int cacheSections = 768;
    /**
     * GPU time budget for the far-terrain pass in milliseconds. The detail factor is lowered (down to 2) when
     * the pass is slower and raised back (up to {@link #detail}) when it is faster; 0 keeps detail fixed.
     */
    public double gpuBudgetMs = 3.0;
    /** Sample block textures on near LOD levels instead of flat average colours. */
    public boolean textures = true;

    public static Path path() {
        return FabricLoader.getInstance().getConfigDir().resolve("vista.json");
    }

    /** Diagnostic view: 0 off, 1 LOD level, 2 light, 3 tint, 4 state/biome ids. Also -Dvista.debug=N. */
    public int debugView = 0;

    public static VistaConfig load() {
        Path p = path();
        VistaConfig c = null;
        if (Files.exists(p)) {
            try {
                c = GSON.fromJson(Files.readString(p), VistaConfig.class);
            } catch (Exception e) {
                VistaClient.LOG.warn("Invalid {}, using defaults", p, e);
            }
        }
        if (c == null) c = new VistaConfig();
        c.save();
        c.debugView = Integer.getInteger("vista.debug", c.debugView);
        c.msaa = Integer.getInteger("vista.msaa", c.msaa);
        c.renderDistanceChunks = Integer.getInteger("vista.distance", c.renderDistanceChunks);
        c.threads = Integer.getInteger("vista.threads", c.threads);
        String budget = System.getProperty("vista.gpuBudgetMs");
        if (budget != null) c.gpuBudgetMs = Double.parseDouble(budget);
        return c;
    }

    public void save() {
        try {
            Files.createDirectories(path().getParent());
            Files.writeString(path(), GSON.toJson(this));
        } catch (IOException e) {
            VistaClient.LOG.warn("Could not save config", e);
        }
    }

    public double farDistanceBlocks() { return renderDistanceChunks * 16.0; }
}
