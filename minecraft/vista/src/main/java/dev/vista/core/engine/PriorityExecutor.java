package dev.vista.core.engine;

import java.util.concurrent.PriorityBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * Fixed pool of low-priority daemon threads draining a priority queue (lowest value first, FIFO on ties).
 * Workers run at {@link Thread#MIN_PRIORITY} so the OS schedules the game's render and server threads first.
 */
public final class PriorityExecutor implements AutoCloseable {
    private final PriorityBlockingQueue<Job> queue = new PriorityBlockingQueue<>(1024);
    private final Thread[] threads;
    private final AtomicLong seq = new AtomicLong();
    private final Consumer<Throwable> errorHandler;
    private volatile boolean running = true;

    private record Job(double priority, long seq, Runnable task) implements Comparable<Job> {
        @Override
        public int compareTo(Job o) {
            int c = Double.compare(priority, o.priority);
            return c != 0 ? c : Long.compare(seq, o.seq);
        }
    }

    public PriorityExecutor(String name, int threadCount, Consumer<Throwable> errorHandler) {
        this.errorHandler = errorHandler;
        threads = new Thread[threadCount];
        for (int i = 0; i < threadCount; i++) {
            Thread t = new Thread(this::loop, name + "-" + i);
            t.setDaemon(true);
            t.setPriority(Thread.MIN_PRIORITY);
            threads[i] = t;
            t.start();
        }
    }

    public void submit(double priority, Runnable task) {
        if (running) queue.add(new Job(priority, seq.getAndIncrement(), task));
    }

    /** Queued plus currently running jobs. */
    public int pending() { return queue.size() + active.get(); }

    private final java.util.concurrent.atomic.AtomicInteger active = new java.util.concurrent.atomic.AtomicInteger();

    private void loop() {
        while (running) {
            Job j;
            try {
                j = queue.poll(250, TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                return;
            }
            if (j == null) continue;
            active.incrementAndGet();
            try {
                j.task.run();
            } catch (Throwable t) {
                errorHandler.accept(t);
            } finally {
                active.decrementAndGet();
            }
        }
    }

    @Override
    public void close() {
        running = false;
        queue.clear();
        for (Thread t : threads) t.interrupt();
        for (Thread t : threads) {
            try { t.join(2000); } catch (InterruptedException ignored) {}
        }
    }
}
