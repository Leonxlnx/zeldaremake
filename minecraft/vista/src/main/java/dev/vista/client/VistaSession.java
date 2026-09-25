package dev.vista.client;

import dev.vista.client.render.LodRenderer;
import dev.vista.client.world.BiomeRegistry;
import dev.vista.client.world.ChunkIngestor;
import dev.vista.client.world.NoiseTerrainSource;
import dev.vista.client.world.StateRegistry;
import dev.vista.core.engine.LodEngine;
import dev.vista.core.store.SectionStore;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.storage.LevelResource;

import java.nio.file.Path;

/** Everything Vista holds for one world + dimension. Created and closed on the render thread. */
public final class VistaSession implements AutoCloseable {
    public final ClientLevel level;
    public final Path root;
    public final StateRegistry states;
    public final BiomeRegistry biomes;
    public final LodEngine engine;
    public final ChunkIngestor ingestor;
    public final LodRenderer renderer;
    public final NoiseTerrainSource terrain;
    public final long openedAt = System.currentTimeMillis();

    private VistaSession(ClientLevel level, Path root, VistaConfig cfg) {
        this.level = level;
        this.root = root;
        this.states = new StateRegistry(root.resolve("states.txt"));
        this.biomes = new BiomeRegistry(root.resolve("biomes.txt"));
        Minecraft mc = Minecraft.getInstance();
        NoiseTerrainSource t = null;
        if (cfg.generateTerrain && mc.getSingleplayerServer() != null) {
            ServerLevel sl = mc.getSingleplayerServer().getLevel(level.dimension());
            if (sl != null && NoiseTerrainSource.supports(sl)) t = new NoiseTerrainSource(sl, states, biomes);
        }
        this.terrain = t;
        LodEngine.Config ec = new LodEngine.Config();
        ec.minY = level.getMinBuildHeight();
        ec.maxY = level.getMaxBuildHeight();
        ec.subdivide = cfg.detail;
        ec.maxDistance = cfg.farDistanceBlocks();
        ec.generate = t != null;
        ec.cacheSections = cfg.cacheSections;
        if (cfg.threads > 0) ec.threads = cfg.threads;
        this.engine = new LodEngine(ec, new SectionStore(root.resolve("sections"), 96), states.classes(), t,
                err -> VistaClient.LOG.error("Vista worker error", err));
        this.ingestor = new ChunkIngestor(engine, states, biomes);
        this.renderer = new LodRenderer(engine, states, biomes, cfg);
        VistaClient.LOG.info("Vista session opened at {} (generation: {}, top level {}, {} threads); water id {} class {}",
                root, t != null, engine.topLevel(), ec.threads, states.water(), states.classes().get(states.water()));
        if (t != null) {
            NoiseTerrainSource ft = t;
            engine.submitWork(-10, () -> VistaClient.LOG.info("Vista terrain self-test: {}", ft.selfTest()));
        }
    }

    public static VistaSession open(ClientLevel level, VistaConfig cfg) {
        Path base = FabricLoader.getInstance().getGameDir().resolve("vista");
        String dim = level.dimension().location().toString().replace(':', '_').replace('/', '_');
        return new VistaSession(level, base.resolve(worldId()).resolve(dim), cfg);
    }

    private static String worldId() {
        Minecraft mc = Minecraft.getInstance();
        if (mc.getSingleplayerServer() != null) {
            Path p = mc.getSingleplayerServer().getWorldPath(LevelResource.ROOT).toAbsolutePath().normalize();
            return "sp_" + sanitize(p.getFileName().toString());
        }
        ServerData sd = mc.getCurrentServer();
        return "mp_" + sanitize(sd != null ? sd.ip : "unknown");
    }

    private static String sanitize(String s) {
        return s.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    @Override
    public void close() {
        renderer.close();
        engine.close();
        states.close();
        VistaClient.LOG.info("Vista session closed: {}", engine.stats().summary());
    }
}
