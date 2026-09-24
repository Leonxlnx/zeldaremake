package dev.vista.client;

import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientChunkEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.resource.ResourceManagerHelper;
import net.fabricmc.fabric.api.resource.SimpleSynchronousResourceReloadListener;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.packs.PackType;
import net.minecraft.server.packs.resources.ResourceManager;
import org.joml.Matrix4f;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public final class VistaClient implements ClientModInitializer {
    public static final Logger LOG = LoggerFactory.getLogger("vista");
    private static VistaConfig config;
    private static VistaSession session;
    private static boolean unsupportedLogged;

    @Override
    public void onInitializeClient() {
        config = VistaConfig.load();
        ClientChunkEvents.CHUNK_LOAD.register((level, chunk) -> {
            if (session != null && session.level == level) session.ingestor.markDirty(chunk.getPos().x, chunk.getPos().z);
        });
        ClientChunkEvents.CHUNK_UNLOAD.register((level, chunk) -> {
            if (session != null && session.level == level) session.ingestor.onUnload(level, chunk);
        });
        ClientTickEvents.END_CLIENT_TICK.register(VistaClient::tick);
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> client.execute(VistaClient::closeSession));
        ResourceManagerHelper.get(PackType.CLIENT_RESOURCES).registerReloadListener(new SimpleSynchronousResourceReloadListener() {
            @Override
            public ResourceLocation getFabricId() {
                return ResourceLocation.fromNamespaceAndPath("vista", "appearance");
            }

            @Override
            public void onResourceManagerReload(ResourceManager manager) {
                if (session != null) session.renderer.markResourcesReloaded();
            }
        });
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, ctx) -> dispatcher.register(
                ClientCommandManager.literal("vista")
                        .executes(c -> {
                            for (String line : debugLines()) c.getSource().sendFeedback(Component.literal(line));
                            return 1;
                        })
                        .then(ClientCommandManager.literal("toggle").executes(c -> {
                            config.enabled = !config.enabled;
                            config.save();
                            if (!config.enabled) closeSession();
                            c.getSource().sendFeedback(Component.literal("Vista " + (config.enabled ? "enabled" : "disabled")));
                            return 1;
                        }))
                        .then(ClientCommandManager.literal("distance").then(ClientCommandManager.argument("chunks", IntegerArgumentType.integer(32, 262144)).executes(c -> {
                            config.renderDistanceChunks = IntegerArgumentType.getInteger(c, "chunks");
                            config.save();
                            closeSession();
                            c.getSource().sendFeedback(Component.literal("Vista distance " + config.renderDistanceChunks + " chunks"));
                            return 1;
                        })))
                        .then(ClientCommandManager.literal("detail").then(ClientCommandManager.argument("factor", DoubleArgumentType.doubleArg(2, 32)).executes(c -> {
                            config.detail = DoubleArgumentType.getDouble(c, "factor");
                            config.save();
                            closeSession();
                            c.getSource().sendFeedback(Component.literal("Vista detail " + config.detail));
                            return 1;
                        })))));
        LOG.info("Vista initialised (far distance {} chunks, detail {})", config.renderDistanceChunks, config.detail);
    }

    public static VistaConfig config() { return config; }
    public static VistaSession session() { return session; }

    private static void tick(Minecraft mc) {
        if (!config.enabled || mc.level == null) {
            if (session != null && mc.level == null) closeSession();
            return;
        }
        if (session != null && session.level != mc.level) closeSession();
        if (session == null) {
            if (!dev.vista.client.render.LodRenderer.isSupported()) {
                if (!unsupportedLogged) LOG.error("Vista needs OpenGL 4.3; far terrain disabled");
                unsupportedLogged = true;
                return;
            }
            session = VistaSession.open(mc.level, config);
            var src = mc.level.getChunkSource();
            int rd = mc.options.getEffectiveRenderDistance() + 2;
            var p = mc.player != null ? mc.player.chunkPosition() : new net.minecraft.world.level.ChunkPos(0, 0);
            for (int z = -rd; z <= rd; z++) for (int x = -rd; x <= rd; x++) {
                if (src.hasChunk(p.x + x, p.z + z)) session.ingestor.markDirty(p.x + x, p.z + z);
            }
        }
        session.ingestor.tick(mc.level);
        if (STATS_LOG && ++statsTicks % 200 == 0) {
            for (String line : debugLines()) LOG.info(line);
        }
    }

    private static final boolean STATS_LOG = Boolean.getBoolean("vista.statsLog");
    private static int statsTicks;

    private static void closeSession() {
        if (session != null) {
            session.close();
            session = null;
        }
    }

    /** Called from {@code LevelRendererMixin} right before vanilla draws solid terrain. */
    public static void renderTerrain(Matrix4f modelView, Matrix4f projection, Camera camera) {
        if (session == null || !config.enabled) return;
        if (camera.getFluidInCamera() != net.minecraft.world.level.material.FogType.NONE) return;
        session.renderer.render(modelView, projection, camera);
    }

    /** Called from {@code LevelRendererMixin} whenever vanilla marks a section for re-meshing. */
    public static void onSectionDirty(int sectionX, int sectionZ) {
        if (session != null) session.ingestor.markDirty(sectionX, sectionZ);
    }

    public static boolean overridesFog() { return session != null && config.enabled; }
    public static float fogStart() { return (float) (config.farDistanceBlocks() * config.fogStart); }
    public static float fogEnd() { return (float) config.farDistanceBlocks(); }
    public static float hazeStrength() { return 0.55f; }

    public static List<String> debugLines() {
        VistaSession s = session;
        if (s == null) return List.of("[Vista] inactive");
        var r = s.renderer;
        var e = s.engine;
        Runtime rt = Runtime.getRuntime();
        return List.of(
                String.format("[Vista] %d selected, %d visible, %d draws (%d translucent), %.1fM quads, cpu %.2f ms",
                        r.statSelected, r.statVisible, r.statCommands, r.statTransCommands, r.statQuadsDrawn / 1e6, r.statCpuMs),
                String.format("[Vista] GPU %.0f/%.0f MiB, upload queue %d (%.1f MiB), jobs %d, nodes %d, ingest %d",
                        r.gpuBytes() / 1048576.0, r.gpuCapacityBytes() / 1048576.0, r.queuedMeshes(), r.queuedUploadBytes() / 1048576.0,
                        e.pendingJobs(), e.nodeCount(), s.ingestor.pending()),
                "[Vista] " + e.stats().summary(),
                String.format("[Vista] heap %d/%d MiB, distance %d chunks, detail %.1f, levels 0-%d",
                        (rt.totalMemory() - rt.freeMemory()) >> 20, rt.maxMemory() >> 20, config.renderDistanceChunks, config.detail, e.topLevel()));
    }
}
