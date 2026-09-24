package dev.vista.mixin;

import dev.vista.client.VistaClient;
import net.minecraft.client.gui.components.DebugScreenOverlay;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.List;

@Mixin(DebugScreenOverlay.class)
public abstract class DebugScreenOverlayMixin {
    @Inject(method = "getGameInformation", at = @At("RETURN"))
    private void vista$debugLines(CallbackInfoReturnable<List<String>> cir) {
        List<String> lines = cir.getReturnValue();
        lines.add("");
        lines.addAll(VistaClient.debugLines());
    }
}
