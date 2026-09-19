#!/bin/bash
# run-matrix-3.sh — the follow-ups (fable-6, round 48): the lod18 trace again with nothing else on
# the box (the first run overlapped a diagnostic world load — its pool counters stand, its
# milliseconds do not), and the take-0116 player strip with the retry-on-detached-frame fix.
# Runs after run-matrix-2.sh (launch-matrix-3.sh waits for MATRIX-2-DONE).
set -u
cd "$(dirname "$0")/../../.." || exit 1
R=gauntlet/perf/r48
LOAD="$R/load.ps1"; [ -f "$LOAD" ] || { echo "missing $LOAD"; exit 1; }
probe() { powershell -NoProfile -File "$LOAD" | tee -a "$R/load.log"; }
export ZR_NATIVE_GPU=1
T0=$(date +%s)
say() { echo "[$(date +%H:%M:%S) +$((($(date +%s) - T0) / 60)) min] $*"; }

say "trace lod18 (clean repeat)"; L=$(probe)
node gauntlet/scripts/perftrace.mjs --dist .wt/w0116/dist-lod18 --frames 2400 --width 1280 --height 720 --finish --label "0116-lod18" --note "take-0116 (973a21e) variant lod18 (gauntlet/perf/r48/variants.json), clean repeat; start load: $L" --out "$R/trace-0116-lod18.json" 2>&1 | grep -E "wrote|Error|error:" | head -3

say "player strip (retry on detached frame)"; probe
node site/tools/player-strip.mjs --dist .wt/w0116/dist --out "$R/player-0116" --settle 12 --attempts 5 2>&1 | grep -E "player-strip:" | tail -6
probe
say "MATRIX-3-DONE"
