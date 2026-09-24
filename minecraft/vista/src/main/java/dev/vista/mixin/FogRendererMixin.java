package dev.vista.mixin;

import com.mojang.blaze3d.systems.RenderSystem;
import dev.vista.client.VistaClient;
import net.minecraft.client.Camera;
import net.minecraft.client.renderer.FogRenderer;
import net.minecraft.util.Mth;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(FogRenderer.class)
public abstract class FogRendererMixin {
    /**
     * Moves vanilla's terrain fog out to the far-terrain distance so vanilla chunks and far terrain share one
     * continuous fog curve (no fog wall at the vanilla render distance). Only the plain "clear air" branch is
     * replaced: water, lava, powder snow, blindness/darkness and foggy biomes keep vanilla behaviour.
     */
    @Inject(method = "setupFog", at = @At("TAIL"))
    private static void vista$extendFog(Camera camera, FogRenderer.FogMode mode, float renderDistance, boolean thickFog, float partialTick, CallbackInfo ci) {
        if (mode != FogRenderer.FogMode.FOG_TERRAIN || thickFog || !VistaClient.overridesFog()) return;
        float h = Mth.clamp(renderDistance / 10.0F, 4.0F, 64.0F);
        if (RenderSystem.getShaderFogEnd() != renderDistance || RenderSystem.getShaderFogStart() != renderDistance - h) return;
        RenderSystem.setShaderFogStart(VistaClient.fogStart());
        RenderSystem.setShaderFogEnd(VistaClient.fogEnd());
    }
}
