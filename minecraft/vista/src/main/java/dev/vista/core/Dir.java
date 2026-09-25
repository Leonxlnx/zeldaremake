package dev.vista.core;

/** Face directions, in Minecraft's {@code Direction} ordinal order. */
public final class Dir {
    public static final int DOWN = 0, UP = 1, NORTH = 2, SOUTH = 3, WEST = 4, EAST = 5;
    public static final int COUNT = 6;

    public static final int[] DX = {0, 0, 0, 0, -1, 1};
    public static final int[] DY = {-1, 1, 0, 0, 0, 0};
    public static final int[] DZ = {0, 0, -1, 1, 0, 0};

    private Dir() {}

    public static int opposite(int d) { return d ^ 1; }

    /** 0 = X, 1 = Y, 2 = Z. */
    public static int axis(int d) { return d < 2 ? 1 : d < 4 ? 2 : 0; }

    public static boolean positive(int d) { return (d & 1) == 1; }
}
