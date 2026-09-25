#!/usr/bin/env bash
# Runs the standard comparison suite sequentially (never in parallel: runs would compete for the CPU).
# Every run uses the same world seed, camera script, window size and JVM settings.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="-Dbench.warmup=90 -Dbench.fly=20 -Dbench.spin=8 -Dbench.hold=20 -Dbench.shots=10,30,60,90"
run() { local profile="$1" label="$2"; shift 2; echo "== $label"; "$HERE/run-bench.sh" "$profile" "$label" $SCRIPT "$@" > "${OUT:-$HOME/mc/results}/$label.log" 2>&1; }
mkdir -p "${OUT:-$HOME/mc/results}"
run vista   final-vista        -Dvista.statsLog=true
run vista   final-vista-msaa1  -Dvista.statsLog=true -Dvista.msaa=1
run vanilla final-vanilla-rd12 -Dbench.rd=12
run vanilla final-vanilla-rd32 -Dbench.rd=32
run dh      final-dh
echo done
