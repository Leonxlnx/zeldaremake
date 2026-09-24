#!/usr/bin/env bash
# Runs one scripted benchmark in a production-style client (vanilla jar + Fabric Loader + release mod
# jars), headless under Xvfb. Each profile has its own work dir (mods/, saves/, config/) so renderers never
# share caches; the world is recreated from the same seed for every run.
#
#   run-bench.sh <profile> <label> [-Dbench.key=value ...]
#
# Profiles are ~/mc/work-<profile>/ with the mods to test in mods/ (see README.md). Results land in
# $OUT/<label>/ (summary.json, frametimes_*.txt, screenshots).
set -euo pipefail
PROFILE="$1"; LABEL="$2"; shift 2
MC="${MC_HOME:-$HOME/mc}"
OUT="${OUT:-$MC/results}"
RES="${RES:-1280x720}"
WORK="$MC/work-$PROFILE"
mkdir -p "$OUT"
rm -rf "$WORK/saves/bench" "$WORK/vista" "$WORK/Distant_Horizons_server_data" "$WORK/.bobby"
# DH keeps its database inside the world folder, Bobby in .bobby/, Vista in vista/: all wiped above.
JVM_ARGS="-Xms2G -Xmx${HEAP:-4G} -XX:+UseG1GC -Dbench.world=bench -Dbench.label=$LABEL -Dbench.out=$OUT $*"
export LIBGL_ALWAYS_SOFTWARE=1 GALLIUM_DRIVER=llvmpipe MESA_GL_VERSION_OVERRIDE=4.6 MESA_GLSL_VERSION_OVERRIDE=460
exec xvfb-run -a -s "-screen 0 ${RES}x24" \
  "$HOME/.local/bin/portablemc" --main-dir "$MC/main" --work-dir "$WORK" --output human \
  start fabric:1.21.1:0.19.5 --jvm /usr/bin/java --jvm-args "$JVM_ARGS" --resolution "$RES" -u Bench
