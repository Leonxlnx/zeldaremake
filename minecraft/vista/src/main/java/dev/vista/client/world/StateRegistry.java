package dev.vista.client.world;

import dev.vista.client.VistaClient;
import dev.vista.core.StateClasses;
import net.minecraft.commands.arguments.blocks.BlockStateParser;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.client.renderer.ItemBlockRenderTypes;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.world.level.EmptyBlockGetter;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.LeavesBlock;
import net.minecraft.world.level.block.LiquidBlock;
import net.minecraft.world.level.block.SnowLayerBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.shapes.VoxelShape;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Per-world mapping between {@link BlockState}s and compact 16-bit ids, persisted as one serialised state
 * per line so cached terrain survives game/mod updates (unknown states degrade to stone).
 * <p>
 * Id 0 is air, id 1 is the "thin snow layer" marker (air that recolours the block below it as snow).
 * Blocks that are irrelevant at distance (plants, torches, thin panes) all collapse to air; water plants
 * (kelp, seagrass) collapse to water.
 */
public final class StateRegistry {
    public static final int AIR = 0;
    public static final int SNOW_LAYER = 1;
    private static final String SNOW_LAYER_NAME = "#vista:snow_layer";
    private static final AtomicInteger EPOCHS = new AtomicInteger(1);

    private final int epoch = EPOCHS.incrementAndGet();
    private final StateClasses classes = new StateClasses();
    private final List<BlockState> states = new ArrayList<>();
    private final Path file;
    private BufferedWriter writer;
    private final int water;
    private final int snowBlock;

    public StateRegistry(Path file) {
        this.file = file;
        states.add(Blocks.AIR.defaultBlockState());
        states.add(Blocks.SNOW.defaultBlockState());
        load();
        try {
            Files.createDirectories(file.getParent());
            writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            if (Files.size(file) == 0) {
                writer.write("minecraft:air\n" + SNOW_LAYER_NAME + "\n");
                writer.flush();
            }
        } catch (IOException e) {
            VistaClient.LOG.warn("Cannot open state registry {}", file, e);
        }
        ((VistaStateId) Blocks.AIR.defaultBlockState()).vista$setId(epoch, AIR);
        water = id(Blocks.WATER.defaultBlockState());
        snowBlock = id(Blocks.SNOW_BLOCK.defaultBlockState());
    }

    private void load() {
        if (!Files.exists(file)) return;
        try {
            List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
            for (int i = 2; i < lines.size(); i++) {
                String line = lines.get(i).trim();
                if (line.isEmpty()) continue;
                BlockState s;
                try {
                    s = BlockStateParser.parseForBlock(BuiltInRegistries.BLOCK.asLookup(), line, false).blockState();
                } catch (Exception e) {
                    s = Blocks.STONE.defaultBlockState();
                }
                int id = states.size();
                states.add(s);
                classes.set(id, classify(s));
                if (((VistaStateId) s).vista$getId(epoch) < 0) ((VistaStateId) s).vista$setId(epoch, id);
            }
        } catch (IOException e) {
            VistaClient.LOG.warn("Cannot read state registry {}", file, e);
        }
    }

    public StateClasses classes() { return classes; }
    public int water() { return water; }
    public int snowBlock() { return snowBlock; }

    public synchronized int size() { return states.size(); }

    public synchronized BlockState state(int id) {
        return id >= 0 && id < states.size() ? states.get(id) : Blocks.AIR.defaultBlockState();
    }

    /** Compact id for a state; thread-safe, lock-free after the first sighting of each state. */
    public int id(BlockState s) {
        int id = ((VistaStateId) s).vista$getId(epoch);
        return id >= 0 ? id : assign(s);
    }

    private synchronized int assign(BlockState s) {
        int id = ((VistaStateId) s).vista$getId(epoch);
        if (id >= 0) return id;
        if (s.getBlock() instanceof SnowLayerBlock && s.getValue(SnowLayerBlock.LAYERS) < 8) {
            id = SNOW_LAYER;
        } else {
            byte cls = classify(s);
            if (cls == StateClasses.AIR) {
                id = s.getFluidState().getType().isSame(net.minecraft.world.level.material.Fluids.WATER) && !s.is(Blocks.WATER) ? id(Blocks.WATER.defaultBlockState()) : AIR;
            } else if (states.size() >= 0xFFFF) {
                id = AIR;
            } else {
                id = states.size();
                states.add(s);
                classes.set(id, cls);
                if (writer != null) {
                    try {
                        writer.write(BlockStateParser.serialize(s));
                        writer.write('\n');
                        // Cached voxels reference these ids; the mapping must reach disk before they do.
                        writer.flush();
                    } catch (IOException e) {
                        VistaClient.LOG.warn("Cannot append to state registry", e);
                    }
                }
            }
        }
        ((VistaStateId) s).vista$setId(epoch, id);
        return id;
    }

    static byte classify(BlockState s) {
        if (s.isAir()) return StateClasses.AIR;
        if (s.getBlock() instanceof LiquidBlock) {
            return s.getFluidState().getType().isSame(net.minecraft.world.level.material.Fluids.WATER) ? StateClasses.TRANSLUCENT : StateClasses.OPAQUE;
        }
        if (s.getBlock() instanceof LeavesBlock) return StateClasses.OPAQUE;
        try {
            if (s.getCollisionShape(EmptyBlockGetter.INSTANCE, BlockPos.ZERO).isEmpty()) return StateClasses.AIR;
            VoxelShape shape = s.getShape(EmptyBlockGetter.INSTANCE, BlockPos.ZERO);
            if (shape.isEmpty()) return StateClasses.AIR;
            AABB bb = shape.bounds();
            double sx = bb.maxX - bb.minX, sy = bb.maxY - bb.minY, sz = bb.maxZ - bb.minZ;
            if (sy < 0.4 || Math.min(sx, sz) < 0.4 || sx * sy * sz < 0.3) return StateClasses.AIR;
        } catch (Throwable t) {
            // Some modded blocks need a real level for their shape; treat them as full cubes.
        }
        RenderType rt = ItemBlockRenderTypes.getChunkRenderType(s);
        if (rt == RenderType.translucent()) return StateClasses.TRANSLUCENT;
        return StateClasses.OPAQUE;
    }

    public synchronized void flush() {
        if (writer == null) return;
        try {
            writer.flush();
        } catch (IOException ignored) {}
    }

    public synchronized void close() {
        if (writer == null) return;
        try {
            writer.close();
        } catch (IOException ignored) {}
        writer = null;
    }
}
