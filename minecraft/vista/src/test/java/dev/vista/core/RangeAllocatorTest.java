package dev.vista.core;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class RangeAllocatorTest {
    @Test
    void randomAllocFreeNeverOverlapsAndFullyCoalesces() {
        RangeAllocator a = new RangeAllocator(100_000);
        Random r = new Random(3);
        List<int[]> live = new ArrayList<>();
        for (int i = 0; i < 20_000; i++) {
            if (live.isEmpty() || r.nextInt(3) > 0) {
                int size = 1 + r.nextInt(500);
                int off = a.allocate(size);
                if (off < 0) continue;
                for (int[] b : live) assertTrue(off + size <= b[0] || b[0] + b[1] <= off, "overlap");
                live.add(new int[]{off, size});
            } else {
                int[] b = live.remove(r.nextInt(live.size()));
                a.free(b[0], b[1]);
            }
        }
        for (int[] b : live) a.free(b[0], b[1]);
        assertEquals(0, a.used());
        assertEquals(100_000, a.largestFree(), "all free space coalesced back into one block");
        a.grow(150_000);
        assertEquals(150_000, a.largestFree());
        assertEquals(0, a.allocate(150_000));
        assertEquals(-1, a.allocate(1));
    }
}
