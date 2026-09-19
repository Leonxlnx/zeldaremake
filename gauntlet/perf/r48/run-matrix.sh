#!/bin/bash
# run-matrix.sh — the round-48 native measurement chain (fable-6). One capture at a time, in the
# order of value: the take-0116 player strip (the monitor), the near-LOD variant traces (the lod-1
# brief), the six-view captures per build (the −0.003 budget), each system alone per hero view,
# and a repeat of the baseline trace at the end (box drift). Every step probes the box load first
# (gauntlet/perf/r48/load.log). Run from the repo root:  bash gauntlet/perf/r48/run-matrix.sh
set -u
cd "$(dirname "$0")/../../.." || exit 1
R=gauntlet/perf/r48
LOAD="C:/Users/User/AppData/Local/Temp/claude/E--zeldaremake-fable-6/dae27cf1-036b-4b0c-b397-ea8ae0827677/scratchpad/load.ps1"
probe() { powershell -NoProfile -File "$LOAD" | tee -a "$R/load.log"; }
export ZR_NATIVE_GPU=1
T0=$(date +%s)
say() { echo "[$(date +%H:%M:%S) +$((($(date +%s) - T0) / 60)) min] $*"; }

# 0. the player strip of take-0116 (14 player-height poses) for the Director's Monitor
say "player strip"; probe
node site/tools/player-strip.mjs --dist .wt/w0116/dist --out "$R/player-0116" --settle 12 2>&1 | grep -v "^\[page:warning\]" | tail -3

# 1. scratch builds with the near-LOD constants patched (variants.json records the diffs)
say "variants"; node "$R/build-variants.mjs" --worktree .wt/w0116 2>&1 | grep "build-variants"

# 2. the walk per variant (same trace as the baseline)
for v in lod18 lod25 prewarm lod18prewarm; do
  say "trace $v"; L=$(probe)
  node gauntlet/scripts/perftrace.mjs --dist ".wt/w0116/dist-$v" --frames 2400 --width 1280 --height 720 --finish --label "0116-$v" --note "take-0116 (973a21e) variant $v (gauntlet/perf/r48/variants.json); start load: $L" --out "$R/trace-0116-$v.json" 2>&1 | grep -E "wrote|Error|error:" | head -3
done

# 3. the six fixed views per build → SSIM vs the reference (the −0.003 budget)
for v in baseline lod18 lod25 prewarm lod18prewarm; do
  D=.wt/w0116/dist; [ "$v" != baseline ] && D=".wt/w0116/dist-$v"
  say "capture $v"; probe
  node gauntlet/scripts/capture.mjs --dist "$D" --out "$R/cap-$v" --settle 90 --no-checks 2>&1 | grep -E "^captured|Error|error:" | head -10
  node gauntlet/scripts/compare.mjs --in "$R/cap-$v" 2>&1 | tail -1
done

# 4. each system alone + finished frames per hero view on the baseline build
say "views isolate"; probe
node gauntlet/perf/ablate.mjs --dist .wt/w0116/dist --out "$R/views-0116" --views A_stairs,B_house,C_lookback,D_log,E_ground,F_canopy --width 1280 --height 720 --timed 20 --settle 8 --configs "baseline" --isolate 2>&1 | grep -E "^=== |→ frame|FAILED" | head -20

# 5. the baseline again — how far the box drifted during the matrix
say "baseline repeat"; L=$(probe)
node gauntlet/scripts/perftrace.mjs --dist .wt/w0116/dist --frames 2400 --width 1280 --height 720 --finish --label "0116-baseline-repeat" --note "take-0116 (973a21e) baseline repeated after the matrix; start load: $L" --out "$R/trace-0116-baseline-repeat.json" 2>&1 | grep -E "wrote|Error|error:" | head -3

# 6. the warm-up variant again (the first run lost its page — "Target closed" — right after a
#    106 s warm-up whose warm pass took 83 s: a D3D11 timeout is the suspect); shorter, so the
#    first seconds of play are what is compared
say "warmup retry"; L=$(probe)
node gauntlet/scripts/perftrace.mjs --dist .wt/w0116/dist --frames 600 --width 1280 --height 720 --finish --warmup --label "0116-warmup" --note "take-0116 (973a21e) with ?warmup=1 (main.ts warm-up before the first frame), retry after the first run's page crash; start load: $L" --out "$R/trace-0116-warmup.json" 2>&1 | grep -E "wrote|Error|error:|setup" | cut -c1-400 | head -4
probe
say "MATRIX-DONE"
