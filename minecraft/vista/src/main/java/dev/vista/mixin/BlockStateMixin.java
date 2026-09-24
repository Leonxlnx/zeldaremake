package dev.vista.mixin;

import dev.vista.client.world.VistaStateId;
import net.minecraft.world.level.block.state.BlockBehaviour;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

/** O(1) BlockState to compact-id lookup for chunk ingestion (no hashing per block). */
@Mixin(BlockBehaviour.BlockStateBase.class)
public abstract class BlockStateMixin implements VistaStateId {
    /** {@code epoch << 32 | id}, written as one volatile long so readers never see a torn pair. */
    @Unique
    private volatile long vista$packed;

    @Override
    public int vista$getId(int epoch) {
        long p = vista$packed;
        return (int) (p >>> 32) == epoch ? (int) p : -1;
    }

    @Override
    public void vista$setId(int epoch, int id) {
        vista$packed = (long) epoch << 32 | (id & 0xFFFFFFFFL);
    }
}
