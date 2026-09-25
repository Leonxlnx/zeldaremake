package dev.vista.client.world;

import dev.vista.core.gen.BiomeSurface;
import net.minecraft.core.Holder;
import net.minecraft.resources.ResourceKey;
import net.minecraft.tags.BiomeTags;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;

/**
 * Far-view appearance of a biome for synthesised terrain. Vanilla surface rules need a real chunk, so this
 * reproduces their visible outcome (top/filler/underwater blocks) plus a canopy model per biome family.
 */
final class BiomeSurfaces {
    private BiomeSurfaces() {}

    static BiomeSurface of(Holder<Biome> holder, StateRegistry reg) {
        String path = holder.unwrapKey().map(ResourceKey::location).map(Object::toString).orElse("minecraft:plains");
        Biome biome = holder.value();
        boolean snowy = biome.getBaseTemperature() < 0.15f || path.contains("snow") || path.contains("frozen") || path.contains("ice");

        Block top = Blocks.GRASS_BLOCK, filler = Blocks.DIRT, under = Blocks.SAND;
        Block leaves = Blocks.OAK_LEAVES, log = Blocks.OAK_LOG;
        float canopy = 0f;
        int treeHeight = 6;

        if (holder.is(BiomeTags.IS_OCEAN) || holder.is(BiomeTags.IS_DEEP_OCEAN)) {
            top = Blocks.SAND; filler = Blocks.SAND; under = path.contains("deep") || path.contains("cold") || path.contains("frozen") ? Blocks.GRAVEL : Blocks.SAND;
        } else if (holder.is(BiomeTags.IS_BEACH)) {
            top = path.contains("stony") ? Blocks.STONE : Blocks.SAND; filler = top == Blocks.STONE ? Blocks.STONE : Blocks.SANDSTONE;
        } else if (holder.is(BiomeTags.IS_RIVER)) {
            under = Blocks.SAND;
        } else if (path.contains("desert")) {
            top = Blocks.SAND; filler = Blocks.SANDSTONE; under = Blocks.SAND;
        } else if (holder.is(BiomeTags.IS_BADLANDS)) {
            top = Blocks.RED_SAND; filler = Blocks.ORANGE_TERRACOTTA; under = Blocks.RED_SAND;
            if (path.contains("wooded")) { canopy = 0.12f; top = Blocks.COARSE_DIRT; }
        } else if (path.contains("mushroom")) {
            top = Blocks.MYCELIUM;
        } else if (path.contains("mangrove")) {
            top = Blocks.MUD; filler = Blocks.MUD; under = Blocks.MUD;
            leaves = Blocks.MANGROVE_LEAVES; log = Blocks.MANGROVE_LOG; canopy = 0.8f; treeHeight = 10;
        } else if (path.contains("swamp")) {
            under = Blocks.DIRT; canopy = 0.35f; treeHeight = 7;
        } else if (path.contains("stony_peaks") || path.contains("stony_shore")) {
            top = Blocks.STONE; filler = Blocks.STONE; under = Blocks.GRAVEL;
        } else if (path.contains("jagged_peaks") || path.contains("frozen_peaks") || path.contains("snowy_slopes")) {
            top = Blocks.SNOW_BLOCK; filler = Blocks.STONE; under = Blocks.GRAVEL; snowy = true;
        } else if (path.contains("gravelly")) {
            top = Blocks.GRAVEL; filler = Blocks.GRAVEL; under = Blocks.GRAVEL;
        } else if (path.contains("windswept_savanna")) {
            top = Blocks.GRASS_BLOCK; leaves = Blocks.ACACIA_LEAVES; log = Blocks.ACACIA_LOG; canopy = 0.1f; treeHeight = 7;
        } else if (path.contains("savanna")) {
            leaves = Blocks.ACACIA_LEAVES; log = Blocks.ACACIA_LOG; canopy = 0.14f; treeHeight = 7;
        } else if (path.contains("bamboo_jungle")) {
            leaves = Blocks.JUNGLE_LEAVES; log = Blocks.JUNGLE_LOG; canopy = 0.7f; treeHeight = 12;
        } else if (path.contains("sparse_jungle")) {
            leaves = Blocks.JUNGLE_LEAVES; log = Blocks.JUNGLE_LOG; canopy = 0.4f; treeHeight = 10;
        } else if (path.contains("jungle")) {
            leaves = Blocks.JUNGLE_LEAVES; log = Blocks.JUNGLE_LOG; canopy = 0.95f; treeHeight = 16;
        } else if (path.contains("dark_forest")) {
            leaves = Blocks.DARK_OAK_LEAVES; log = Blocks.DARK_OAK_LOG; canopy = 0.95f; treeHeight = 8;
        } else if (path.contains("birch")) {
            leaves = Blocks.BIRCH_LEAVES; log = Blocks.BIRCH_LOG; canopy = path.contains("old_growth") ? 0.8f : 0.7f; treeHeight = path.contains("old_growth") ? 12 : 7;
        } else if (path.contains("cherry")) {
            leaves = Blocks.CHERRY_LEAVES; log = Blocks.CHERRY_LOG; canopy = 0.45f; treeHeight = 8;
        } else if (path.contains("old_growth") && (path.contains("taiga"))) {
            leaves = Blocks.SPRUCE_LEAVES; log = Blocks.SPRUCE_LOG; canopy = 0.8f; treeHeight = 16;
            top = Blocks.PODZOL;
        } else if (path.contains("taiga") || path.contains("grove")) {
            leaves = Blocks.SPRUCE_LEAVES; log = Blocks.SPRUCE_LOG; canopy = path.contains("grove") ? 0.45f : 0.6f; treeHeight = 10;
        } else if (path.contains("windswept_forest")) {
            leaves = Blocks.SPRUCE_LEAVES; log = Blocks.SPRUCE_LOG; canopy = 0.55f; treeHeight = 9;
        } else if (path.contains("windswept_hills")) {
            top = Blocks.GRASS_BLOCK; canopy = 0.05f; leaves = Blocks.SPRUCE_LEAVES; log = Blocks.SPRUCE_LOG;
        } else if (path.contains("flower_forest")) {
            canopy = 0.55f;
        } else if (path.contains("forest")) {
            canopy = 0.75f; treeHeight = 7;
        } else if (path.contains("meadow")) {
            canopy = 0.02f;
        } else if (path.contains("plains")) {
            canopy = path.contains("snowy") ? 0.01f : 0.03f;
        } else if (holder.is(BiomeTags.IS_FOREST)) {
            canopy = 0.7f;
        } else if (holder.is(BiomeTags.IS_TAIGA)) {
            leaves = Blocks.SPRUCE_LEAVES; log = Blocks.SPRUCE_LOG; canopy = 0.6f; treeHeight = 10;
        } else if (holder.is(BiomeTags.IS_JUNGLE)) {
            leaves = Blocks.JUNGLE_LEAVES; log = Blocks.JUNGLE_LOG; canopy = 0.9f; treeHeight = 14;
        } else if (holder.is(BiomeTags.IS_MOUNTAIN)) {
            top = Blocks.STONE; filler = Blocks.STONE;
        }

        return new BiomeSurface(
                reg.id(top.defaultBlockState()), reg.id(filler.defaultBlockState()), reg.id(under.defaultBlockState()),
                reg.id(Blocks.STONE.defaultBlockState()), reg.id(Blocks.DEEPSLATE.defaultBlockState()),
                reg.id(leaves.defaultBlockState()), reg.id(log.defaultBlockState()),
                canopy, treeHeight, snowy,
                reg.id(Blocks.SNOW_BLOCK.defaultBlockState()), reg.id(Blocks.ICE.defaultBlockState()));
    }
}
