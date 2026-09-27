#!/usr/bin/env bash
# clips.sh -- the walk out over the bridge, with the ravine and without it.
#
#   bash art/audio/2026-09-26-ravine/clips.sh /tmp/ravine art/audio/2026-09-26-ravine/clips
#
# The bridge is OFFLINE_WALK's last leg, 45-50 s, so the clips run from 44 s: two seconds of the
# stand before it, then the boots go out over the cut. `no-ravine` is the term forced to 0, which
# is what shipped until now; `ravine` is the take as the walk sets it.
#
# The steps stem, not the mix, so the bed is not in the way -- and +16 dB of common gain on both,
# because the footsteps stem alone is quiet and the pair must move together or the comparison is
# about the gain. NOT otherwise normalised.
set -euo pipefail
takes="${1:-/tmp/ravine}"
out="${2:-art/audio/2026-09-26-ravine/clips}"
mkdir -p "$out"
ffmpeg -y -loglevel error -ss 44 -t 7 -i "$takes/after-gorge0.wav" -af "volume=16dB" -codec:a libmp3lame -q:a 4 "$out/bridge-no-ravine.mp3"
ffmpeg -y -loglevel error -ss 44 -t 7 -i "$takes/after-shipped.wav" -af "volume=16dB" -codec:a libmp3lame -q:a 4 "$out/bridge-ravine.mp3"
# and the stair flight from the same pair, which must be the same file twice
ffmpeg -y -loglevel error -ss 18 -t 5 -i "$takes/after-gorge0.wav" -af "volume=16dB" -codec:a libmp3lame -q:a 4 "$out/stairs-no-ravine.mp3"
ffmpeg -y -loglevel error -ss 18 -t 5 -i "$takes/after-shipped.wav" -af "volume=16dB" -codec:a libmp3lame -q:a 4 "$out/stairs-ravine.mp3"
ls -l "$out"
