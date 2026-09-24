package dev.vista.client.render;

import com.mojang.blaze3d.platform.GlStateManager;
import dev.vista.core.engine.LodEngine;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.server.level.ChunkTrackingView;
import org.lwjgl.opengl.GL11C;
import org.lwjgl.opengl.GL12C;
import org.lwjgl.opengl.GL30C;
import org.lwjgl.system.MemoryUtil;

import java.nio.ByteBuffer;

/**
 * Which chunks vanilla (or Sodium) is drawing this frame, as a 256x256 torus of flags around the camera.
 * Far terrain is discarded per pixel inside those chunks and skipped per node by the selector, so the
 * hand-off between vanilla and LOD terrain follows the real loaded area: when chunks are missing (fast
 * flight, slow server) the far terrain fills the gap instead of leaving void.
 */
final class VanillaMask implements LodEngine.VanillaCoverage, AutoCloseable {
    private static final int SIZE = 256;
    private final byte[] flags = new byte[SIZE * SIZE];
    private final ByteBuffer upload = MemoryUtil.memCalloc(SIZE * SIZE);
    private volatile int centerX, centerZ, radius;
    private int texture;
    private int lastMinX, lastMinZ, lastMaxX, lastMaxZ;
    private boolean hasLast;

    int texture() { return texture; }
    int radiusChunks() { return radius; }

    void update(ClientLevel level, int camChunkX, int camChunkZ, int renderDistance) {
        if (hasLast) {
            for (int z = lastMinZ; z <= lastMaxZ; z++) for (int x = lastMinX; x <= lastMaxX; x++) flags[(x & 255) | (z & 255) << 8] = 0;
        }
        int rd = Math.min(renderDistance, 120);
        var src = level.getChunkSource();
        int minX = camChunkX - rd - 1, maxX = camChunkX + rd + 1, minZ = camChunkZ - rd - 1, maxZ = camChunkZ + rd + 1;
        for (int z = minZ; z <= maxZ; z++) {
            for (int x = minX; x <= maxX; x++) {
                if (!ChunkTrackingView.isInViewDistance(camChunkX, camChunkZ, rd, x, z)) continue;
                if (!src.hasChunk(x, z)) continue;
                boolean all = true;
                for (int dz = -1; dz <= 1 && all; dz++) for (int dx = -1; dx <= 1; dx++) {
                    if ((dx | dz) != 0 && !src.hasChunk(x + dx, z + dz)) { all = false; break; }
                }
                if (all) flags[(x & 255) | (z & 255) << 8] = 1;
            }
        }
        lastMinX = minX; lastMaxX = maxX; lastMinZ = minZ; lastMaxZ = maxZ;
        hasLast = true;
        centerX = camChunkX;
        centerZ = camChunkZ;
        radius = rd + 1;

        if (texture == 0) {
            texture = GL11C.glGenTextures();
            GlStateManager._bindTexture(texture);
            GL11C.glTexImage2D(GL11C.GL_TEXTURE_2D, 0, GL30C.GL_R8UI, SIZE, SIZE, 0, GL30C.GL_RED_INTEGER, GL11C.GL_UNSIGNED_BYTE, (ByteBuffer) null);
            GL11C.glTexParameteri(GL11C.GL_TEXTURE_2D, GL11C.GL_TEXTURE_MIN_FILTER, GL11C.GL_NEAREST);
            GL11C.glTexParameteri(GL11C.GL_TEXTURE_2D, GL11C.GL_TEXTURE_MAG_FILTER, GL11C.GL_NEAREST);
            GL11C.glTexParameteri(GL11C.GL_TEXTURE_2D, GL11C.GL_TEXTURE_WRAP_S, GL12C.GL_CLAMP_TO_EDGE);
            GL11C.glTexParameteri(GL11C.GL_TEXTURE_2D, GL11C.GL_TEXTURE_WRAP_T, GL12C.GL_CLAMP_TO_EDGE);
        } else {
            GlStateManager._bindTexture(texture);
        }
        upload.clear();
        upload.put(flags).flip();
        GL11C.glPixelStorei(GL11C.GL_UNPACK_ALIGNMENT, 1);
        GL11C.glTexSubImage2D(GL11C.GL_TEXTURE_2D, 0, 0, 0, SIZE, SIZE, GL30C.GL_RED_INTEGER, GL11C.GL_UNSIGNED_BYTE, upload);
        GL11C.glPixelStorei(GL11C.GL_UNPACK_ALIGNMENT, 4);
        GlStateManager._bindTexture(0);
    }

    @Override
    public boolean covers(int minX, int minZ, int maxX, int maxZ) {
        int cx0 = minX >> 4, cz0 = minZ >> 4, cx1 = (maxX - 1) >> 4, cz1 = (maxZ - 1) >> 4;
        int r = radius, ccx = centerX, ccz = centerZ;
        if (cx0 < ccx - r || cx1 > ccx + r || cz0 < ccz - r || cz1 > ccz + r) return false;
        for (int z = cz0; z <= cz1; z++) for (int x = cx0; x <= cx1; x++) {
            if (flags[(x & 255) | (z & 255) << 8] == 0) return false;
        }
        return true;
    }

    @Override
    public void close() {
        if (texture != 0) GL11C.glDeleteTextures(texture);
        texture = 0;
        MemoryUtil.memFree(upload);
    }
}
