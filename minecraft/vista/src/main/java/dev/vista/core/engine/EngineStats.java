package dev.vista.core.engine;

import java.util.concurrent.atomic.AtomicLong;

/** Lock-free counters for the debug HUD and benchmarks. Times are cumulative nanoseconds of worker CPU. */
public final class EngineStats {
    public final AtomicLong generatedColumns = new AtomicLong();
    public final AtomicLong generateNanos = new AtomicLong();
    public final AtomicLong ingestedChunks = new AtomicLong();
    public final AtomicLong ingestNanos = new AtomicLong();
    public final AtomicLong propagations = new AtomicLong();
    public final AtomicLong propagateNanos = new AtomicLong();
    public final AtomicLong meshes = new AtomicLong();
    public final AtomicLong meshNanos = new AtomicLong();
    public final AtomicLong meshQuads = new AtomicLong();
    public final AtomicLong sectionWrites = new AtomicLong();
    public final AtomicLong bytesWritten = new AtomicLong();
    public final AtomicLong selections = new AtomicLong();
    public final AtomicLong selectionNanos = new AtomicLong();

    static double ms(AtomicLong nanos, AtomicLong count) {
        long c = count.get();
        return c == 0 ? 0 : nanos.get() / 1e6 / c;
    }

    public String summary() {
        return String.format(
                "gen %d cols (%.2f ms/col) | ingest %d chunks (%.2f ms) | prop %d (%.2f ms) | mesh %d (%.2f ms, %d quads) | sel %d (%.2f ms) | writes %d (%.1f MB)",
                generatedColumns.get(), ms(generateNanos, generatedColumns),
                ingestedChunks.get(), ms(ingestNanos, ingestedChunks),
                propagations.get(), ms(propagateNanos, propagations),
                meshes.get(), ms(meshNanos, meshes), meshQuads.get(),
                selections.get(), ms(selectionNanos, selections),
                sectionWrites.get(), bytesWritten.get() / 1048576.0);
    }
}
