package dev.vistabench;

import com.google.gson.GsonBuilder;
import com.mojang.blaze3d.platform.NativeImage;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.WorldRenderEvents;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.LevelSettings;
import net.minecraft.world.level.WorldDataConfiguration;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.levelgen.presets.WorldPresets;
import net.minecraft.world.phys.Vec3;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Scripted, mod-agnostic benchmark. Identical camera script and settings for every renderer under test:
 * <ol>
 *   <li>load: hover at the start point for {@code bench.warmup} s, screenshots at fixed times (fill speed)</li>
 *   <li>fly: straight line at {@code bench.speed} blocks/s for {@code bench.fly} s (streaming under load)</li>
 *   <li>spin: one full turn in {@code bench.spin} s (culling / submission cost)</li>
 *   <li>hold: settle and take the final comparison screenshots (level view and high-altitude view)</li>
 * </ol>
 * Outputs {@code summary.json}, per-phase frame times and PNGs to {@code bench.out/bench.label}.
 */
public final class BenchClient implements ClientModInitializer {
    private static final Logger LOG = LoggerFactory.getLogger("vistabench");

    private enum Phase { IDLE, LOADING, SETUP, LOAD, FLY, SPIN, HOLD, HIGH, DONE }

    private final String world = System.getProperty("bench.world");
    private final String label = System.getProperty("bench.label", "run");
    private final Path out = Path.of(System.getProperty("bench.out", "bench-results")).resolve(label);
    private final long seed = Long.getLong("bench.seed", 20260924L);
    private final int rd = Integer.getInteger("bench.rd", 12);
    private final double warmup = dbl("bench.warmup", 60), fly = dbl("bench.fly", 30), spin = dbl("bench.spin", 10), hold = dbl("bench.hold", 20);
    private final double speed = dbl("bench.speed", 40);
    private final double sx = dbl("bench.x", 0), sy = dbl("bench.y", 140), sz = dbl("bench.z", 0);
    private final float pitch = (float) dbl("bench.pitch", 4);
    private final float yaw = (float) dbl("bench.yaw", -90);
    private final double[] loadShots = Arrays.stream(System.getProperty("bench.shots", "5,15,30,60").split(",")).mapToDouble(Double::parseDouble).toArray();

    private Phase phase = Phase.IDLE;
    private long phaseStart;
    private long lastFrame;
    private int setupTicks;
    private int shotIndex;
    private Vec3 flyEnd;
    private final Map<Phase, List<Double>> frames = new LinkedHashMap<>();
    private final Map<Phase, long[]> cpu = new LinkedHashMap<>();
    private long maxHeap, maxRss;
    private final Map<String, Object> notes = new LinkedHashMap<>();

    private static double dbl(String k, double d) {
        String v = System.getProperty(k);
        return v == null ? d : Double.parseDouble(v);
    }

    @Override
    public void onInitializeClient() {
        if (world == null) return;
        LOG.info("Vista bench active: world={}, label={}, out={}", world, label, out);
        ClientTickEvents.END_CLIENT_TICK.register(this::tick);
        WorldRenderEvents.LAST.register(ctx -> onFrame());
    }

    private double elapsed() { return (System.nanoTime() - phaseStart) / 1e9; }

    private void enter(Phase p) {
        Minecraft mc = Minecraft.getInstance();
        if (frames.containsKey(phase) && cpu.containsKey(phase)) cpu.get(phase)[1] = cpuNanos();
        phase = p;
        phaseStart = System.nanoTime();
        lastFrame = 0;
        frames.put(p, new ArrayList<>());
        cpu.put(p, new long[]{cpuNanos(), 0, System.nanoTime(), 0});
        LOG.info("bench phase {} (fps {})", p, mc.getFps());
    }

    private static long cpuNanos() {
        var os = ManagementFactory.getOperatingSystemMXBean();
        return os instanceof com.sun.management.OperatingSystemMXBean sun ? sun.getProcessCpuTime() : 0;
    }

    private void onFrame() {
        long now = System.nanoTime();
        List<Double> list = frames.get(phase);
        if (list != null && lastFrame != 0) list.add((now - lastFrame) / 1e6);
        lastFrame = now;
    }

    private void tick(Minecraft mc) {
        try {
            doTick(mc);
        } catch (Throwable t) {
            LOG.error("bench failure", t);
            mc.stop();
        }
    }

    private void doTick(Minecraft mc) throws IOException {
        switch (phase) {
            case IDLE -> {
                if (mc.getOverlay() == null && (mc.screen instanceof TitleScreen || mc.screen instanceof net.minecraft.client.gui.screens.AccessibilityOnboardingScreen)) {
                    mc.options.onboardAccessibility = false;
                    applyOptions(mc);
                    phase = Phase.LOADING;
                    if (mc.getLevelSource().levelExists(world)) {
                        mc.createWorldOpenFlows().openWorld(world, () -> LOG.error("world load cancelled"));
                    } else {
                        GameRules rules = new GameRules();
                        rules.getRule(GameRules.RULE_DAYLIGHT).set(false, null);
                        rules.getRule(GameRules.RULE_WEATHER_CYCLE).set(false, null);
                        rules.getRule(GameRules.RULE_DOMOBSPAWNING).set(false, null);
                        LevelSettings settings = new LevelSettings(world, GameType.SPECTATOR, false, Difficulty.PEACEFUL, true, rules, WorldDataConfiguration.DEFAULT);
                        mc.createWorldOpenFlows().createFreshLevel(world, settings, new WorldOptions(seed, true, false),
                                WorldPresets::createNormalWorldDimensions, mc.screen);
                    }
                }
            }
            case LOADING -> {
                if (mc.level != null && mc.player != null && mc.screen == null) {
                    phase = Phase.SETUP;
                    setupTicks = 0;
                }
            }
            case SETUP -> {
                setupTicks++;
                if (setupTicks == 5) {
                    var c = mc.player.connection;
                    c.sendCommand("gamemode spectator");
                    c.sendCommand("time set 6000");
                    c.sendCommand("weather clear");
                    c.sendCommand("gamerule doDaylightCycle false");
                    c.sendCommand("tp @s " + sx + " " + sy + " " + sz + " " + yaw + " " + pitch);
                }
                place(mc, new Vec3(sx, sy, sz), yaw, pitch);
                if (setupTicks >= 40) {
                    enter(Phase.LOAD);
                    shotIndex = 0;
                }
            }
            case LOAD -> {
                place(mc, new Vec3(sx, sy, sz), yaw, pitch);
                if (shotIndex < loadShots.length && elapsed() >= loadShots[shotIndex]) {
                    shot(mc, String.format("load_%03ds", (int) loadShots[shotIndex]));
                    shotIndex++;
                }
                if (elapsed() >= warmup) enter(Phase.FLY);
            }
            case FLY -> {
                double t = Math.min(elapsed(), fly);
                double rad = Math.toRadians(yaw);
                Vec3 dir = new Vec3(-Math.sin(rad), 0, Math.cos(rad));
                Vec3 p = new Vec3(sx, sy, sz).add(dir.scale(speed * t));
                place(mc, p, yaw, pitch);
                if (elapsed() >= fly) {
                    flyEnd = p;
                    shot(mc, "fly_end");
                    enter(Phase.SPIN);
                }
            }
            case SPIN -> {
                double t = Math.min(elapsed() / spin, 1);
                place(mc, flyEnd, (float) (yaw + 360 * t), pitch);
                if (elapsed() >= spin) enter(Phase.HOLD);
            }
            case HOLD -> {
                place(mc, flyEnd, yaw, pitch);
                if (elapsed() >= hold) {
                    shot(mc, "hold_level");
                    enter(Phase.HIGH);
                }
            }
            case HIGH -> {
                place(mc, new Vec3(flyEnd.x, 300, flyEnd.z), yaw, 12);
                if (elapsed() >= hold) {
                    shot(mc, "high");
                    enter(Phase.DONE);
                    report(mc);
                    mc.stop();
                }
            }
            case DONE -> {}
        }
        if (phase.ordinal() >= Phase.LOAD.ordinal()) sampleMemory();
    }

    private void applyOptions(Minecraft mc) {
        var o = mc.options;
        o.renderDistance().set(rd);
        o.simulationDistance().set(Math.min(rd, 12));
        o.framerateLimit().set(260);
        o.enableVsync().set(false);
        o.fov().set(70);
        o.bobView().set(false);
        o.pauseOnLostFocus = false;
        o.hideGui = true;
        o.save();
    }

    private static void place(Minecraft mc, Vec3 p, float yaw, float pitch) {
        var pl = mc.player;
        if (pl == null) return;
        pl.setDeltaMovement(Vec3.ZERO);
        pl.getAbilities().flying = true;
        pl.setPos(p.x, p.y, p.z);
        pl.setYRot(yaw);
        pl.setXRot(pitch);
        pl.setYHeadRot(yaw);
    }

    private void shot(Minecraft mc, String name) throws IOException {
        Files.createDirectories(out);
        try (NativeImage img = Screenshot.takeScreenshot(mc.getMainRenderTarget())) {
            img.writeToFile(out.resolve(name + ".png"));
        }
        LOG.info("bench screenshot {}", name);
    }

    private void sampleMemory() {
        Runtime rt = Runtime.getRuntime();
        maxHeap = Math.max(maxHeap, rt.totalMemory() - rt.freeMemory());
        if ((System.nanoTime() / 1_000_000_000L) % 2 == 0) {
            try {
                for (String line : Files.readAllLines(Path.of("/proc/self/status"))) {
                    if (line.startsWith("VmRSS:")) {
                        maxRss = Math.max(maxRss, Long.parseLong(line.replaceAll("[^0-9]", "")) * 1024);
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    private void report(Minecraft mc) throws IOException {
        Files.createDirectories(out);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("label", label);
        root.put("world", world);
        root.put("seed", seed);
        root.put("vanillaRenderDistance", rd);
        root.put("window", mc.getWindow().getWidth() + "x" + mc.getWindow().getHeight());
        root.put("gpu", com.mojang.blaze3d.platform.GlUtil.getRenderer());
        root.put("glVersion", com.mojang.blaze3d.platform.GlUtil.getOpenGLVersion());
        root.put("cores", Runtime.getRuntime().availableProcessors());
        root.put("mods", net.fabricmc.loader.api.FabricLoader.getInstance().getAllMods().stream()
                .map(m -> m.getMetadata().getId() + "@" + m.getMetadata().getVersion().getFriendlyString())
                .filter(s -> !s.startsWith("fabric") && !s.startsWith("java") && !s.startsWith("minecraft")).sorted().toList());
        Map<String, Object> phases = new LinkedHashMap<>();
        for (var e : frames.entrySet()) {
            List<Double> ft = e.getValue();
            if (ft.isEmpty()) continue;
            long[] c = cpu.get(e.getKey());
            long cpuEnd = c[1] != 0 ? c[1] : cpuNanos();
            double wall = ft.stream().mapToDouble(Double::doubleValue).sum() / 1000.0;
            phases.put(e.getKey().name().toLowerCase(), stats(ft, (cpuEnd - c[0]) / 1e9 / Math.max(wall, 1e-3) / Runtime.getRuntime().availableProcessors()));
            Files.writeString(out.resolve("frametimes_" + e.getKey().name().toLowerCase() + ".txt"),
                    String.join("\n", ft.stream().map(d -> String.format("%.3f", d)).toList()));
        }
        root.put("phases", phases);
        root.put("maxHeapMiB", maxHeap >> 20);
        root.put("maxRssMiB", maxRss >> 20);
        root.putAll(notes);
        Files.writeString(out.resolve("summary.json"), new GsonBuilder().setPrettyPrinting().create().toJson(root));
        LOG.info("bench report written to {}", out);
    }

    private static Map<String, Object> stats(List<Double> ft, double cpuUtil) {
        double[] a = ft.stream().mapToDouble(Double::doubleValue).sorted().toArray();
        double sum = Arrays.stream(a).sum();
        int n = a.length;
        int worst1 = Math.max(1, n / 100), worst01 = Math.max(1, n / 1000);
        double w1 = 0, w01 = 0;
        for (int i = 0; i < worst1; i++) w1 += a[n - 1 - i];
        for (int i = 0; i < worst01; i++) w01 += a[n - 1 - i];
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("frames", n);
        m.put("seconds", round(sum / 1000));
        m.put("avgFps", round(n / (sum / 1000)));
        m.put("low1PctFps", round(1000 / (w1 / worst1)));
        m.put("low01PctFps", round(1000 / (w01 / worst01)));
        m.put("p50Ms", round(a[n / 2]));
        m.put("p99Ms", round(a[Math.min(n - 1, (int) (n * 0.99))]));
        m.put("maxMs", round(a[n - 1]));
        m.put("spikesOver50Ms", Arrays.stream(a).filter(x -> x > 50).count());
        m.put("cpuUtilPct", round(cpuUtil * 100));
        return m;
    }

    private static double round(double v) { return Math.round(v * 100) / 100.0; }
}
