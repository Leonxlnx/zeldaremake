#!/bin/bash
# run-matrix-2.sh — the per-pixel knobs on the sealed world, natively (fable-6, round 48): the
# baseline trace showed the 780M's frame is a fixed ~100 ms of GPU work regardless of the triangle
# count, so the savings that would pay for wider LOD swaps are the shadow map, the composer stages
# and the pixel count. Two instruments, both on the take-0116 build:
#   1. viewstats --ab: interleaved on/off pairs of the live switches on ONE page (the four composer
#      stages, all four, the shadow-caster cull, vegetation LOD ×0.5) — both arms share the box load
#   2. ablate: fresh page per flag set at view A with 20 finished frames (shadow map size / taps,
#      render scale, fx=off) — the knobs that need a page load
# Run after run-matrix.sh (one capture at a time):  bash gauntlet/perf/r48/run-matrix-2.sh
set -u
cd "$(dirname "$0")/../../.." || exit 1
R=gauntlet/perf/r48
LOAD="$R/load.ps1"; [ -f "$LOAD" ] || { echo "missing $LOAD"; exit 1; }
probe() { powershell -NoProfile -File "$LOAD" | tee -a "$R/load.log"; }
export ZR_NATIVE_GPU=1
T0=$(date +%s)
say() { echo "[$(date +%H:%M:%S) +$((($(date +%s) - T0) / 60)) min] $*"; }

for v in A_stairs C_lookback; do
  say "ab $v"; probe
  node gauntlet/perf/viewstats.mjs --dist .wt/w0116/dist --viewpoint "$v" --width 1280 --height 720 --settle 8 --timed 10 --ab 12 --json "$R/ab-$v.json" 2>&1 | grep -E "A/B|timed frame 10|ready in|FAILED|Error" | head -12
done

say "ablate A"; probe
node gauntlet/perf/ablate.mjs --dist .wt/w0116/dist --out "$R/ablate-A" --views A_stairs --width 1280 --height 720 --timed 20 --settle 8 --configs "baseline;shadow=2048,8;shadow=1024,4;shadow=0;scale=0.75;scale=0.5;fx=off;veg=0.5,0.5" 2>&1 | grep -E "^=== |→ frame|FAILED" | head -20
probe
say "MATRIX-2-DONE"
