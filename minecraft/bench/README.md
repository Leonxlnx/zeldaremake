# Vista benchmark harness

Scripted, renderer-agnostic benchmark used to compare Vista against vanilla and Distant Horizons under
identical conditions. The harness is a tiny Fabric mod (`../vista-bench`) that is inert unless
`-Dbench.world=<name>` is set.

## What a run does

1. Creates (or loads) world `bench` with a fixed seed (`20260924`), spectator mode, peaceful, noon, clear
   weather, daylight cycle off. The world, Vista cache, DH database and Bobby cache are wiped before each
   run, so every renderer starts cold.
2. **load**: hovers at (0, 140, 0) looking east for `bench.warmup` s; screenshots at `bench.shots`
   seconds (shows how fast the horizon fills).
3. **fly**: straight line east at 40 blocks/s for 20 s (streaming under motion).
4. **spin**: one full turn in 8 s (culling and submission cost).
5. **hold**: 20 s at the end of the flight, then a level screenshot.
6. **high**: 20 s at y=300 above the same point, then a screenshot looking down 12°.

Per phase it records average FPS, 1 % and 0.1 % lows, p50/p99/max frame time, frames over 50 ms and process
CPU utilisation; per run it records peak heap and peak RSS. Everything lands in
`$OUT/<label>/summary.json`, `frametimes_<phase>.txt` and PNGs.

## Setup used for the numbers in `../vista/README.md`

```bash
pip install --user portablemc
portablemc --main-dir ~/mc/main --work-dir ~/mc/work start fabric:1.21.1:0.19.5 --dry   # installs MC + Fabric
# one work dir per renderer, each with fabric-api + vista-bench (+ the renderer under test) in mods/
mkdir -p ~/mc/work-{vanilla,vista,dh}/mods
./run-suite.sh            # sequential runs; results in ~/mc/results
```

`run-bench.sh` launches a production-style client (vanilla jar + Fabric Loader + release jars) under Xvfb.
In this repository's cloud VM there is no GPU, so OpenGL is Mesa **llvmpipe** (CPU rasterisation on the same
4 vCPUs that run the game and the LOD workers). Absolute FPS numbers from that environment say more about
software rasterisation than about any of the renderers; the generation-speed, memory, disk, CPU-side
frame cost and visual results transfer to real hardware.
