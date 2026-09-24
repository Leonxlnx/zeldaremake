package dev.vista.core;

/**
 * Render class of every compact state id. The core only needs three classes; everything that is
 * neither solid nor a see-through volume (flowers, torches, short grass, ...) is {@link #AIR} at LOD scale.
 */
public final class StateClasses {
    public static final byte AIR = 0;
    public static final byte OPAQUE = 1;
    /** Water, glass, ice: drawn in the translucent pass; faces between two translucent voxels are culled. */
    public static final byte TRANSLUCENT = 2;

    private final byte[] classes = new byte[1 << 16];

    public StateClasses() {}

    public byte get(int stateId) { return classes[stateId & 0xFFFF]; }

    public byte ofVoxel(int voxel) { return classes[voxel & 0xFFFF]; }

    public void set(int stateId, byte cls) {
        if (stateId != 0) classes[stateId & 0xFFFF] = cls;
    }

    public byte[] raw() { return classes; }
}
