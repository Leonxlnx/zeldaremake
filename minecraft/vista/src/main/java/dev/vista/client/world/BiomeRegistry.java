package dev.vista.client.world;

import dev.vista.client.VistaClient;
import net.minecraft.core.Holder;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;

/** Per-world mapping between biome keys and 8-bit ids, persisted one key per line. */
public final class BiomeRegistry {
    private final Path file;
    private final List<ResourceLocation> keys = new ArrayList<>();
    private final Map<ResourceLocation, Integer> byKey = new java.util.HashMap<>();
    private final Map<Biome, Integer> byBiome = new IdentityHashMap<>();
    private volatile int version;

    public BiomeRegistry(Path file) {
        this.file = file;
        if (Files.exists(file)) {
            try {
                for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                    ResourceLocation rl = ResourceLocation.tryParse(line.trim());
                    if (rl != null && keys.size() < 256) {
                        byKey.putIfAbsent(rl, keys.size());
                        keys.add(rl);
                    }
                }
            } catch (IOException e) {
                VistaClient.LOG.warn("Cannot read biome registry {}", file, e);
            }
        }
    }

    public int id(Holder<Biome> holder) {
        Biome b = holder.value();
        synchronized (this) {
            Integer cached = byBiome.get(b);
            if (cached != null) return cached;
        }
        ResourceLocation rl = holder.unwrapKey().map(ResourceKey::location).orElse(null);
        synchronized (this) {
            int id = idFor(rl);
            byBiome.put(b, id);
            return id;
        }
    }

    private int idFor(ResourceLocation rl) {
        if (rl == null) return 0;
        Integer id = byKey.get(rl);
        if (id != null) return id;
        if (keys.size() >= 256) return 0;
        int nid = keys.size();
        keys.add(rl);
        byKey.put(rl, nid);
        version++;
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, rl + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException e) {
            VistaClient.LOG.warn("Cannot append to biome registry", e);
        }
        return nid;
    }

    public synchronized int size() { return keys.size(); }

    public int version() { return version; }

    /** Resolves an id back to a biome holder in the given level's registry (null if unknown). */
    public Holder<Biome> holder(Level level, int id) {
        ResourceLocation rl;
        synchronized (this) {
            if (id < 0 || id >= keys.size()) return null;
            rl = keys.get(id);
        }
        Registry<Biome> reg = level.registryAccess().registryOrThrow(Registries.BIOME);
        return reg.getHolder(ResourceKey.create(Registries.BIOME, rl)).orElse(null);
    }
}
