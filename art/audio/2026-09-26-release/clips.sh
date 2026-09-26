#!/usr/bin/env bash
# clips.sh -- the run either side of the step cut, as mp3s a person can listen to.
#
#   bash art/audio/2026-09-26-release/clips.sh /tmp/release art/audio/2026-09-26-release/clips
#
# Both clips are the same fourteen seconds of the same seeded take, so anything that differs between
# them is the trim and nothing else. NOT normalised: the whole point is a level, and normalising the
# pair would hide the one thing they are here to show.
set -euo pipefail
takes="${1:-/tmp/release}"
out="${2:-art/audio/2026-09-26-release/clips}"
mkdir -p "$out"
for side in before after; do
  for gait in run walk; do
    ffmpeg -y -loglevel error -ss 6 -t 14 -i "$takes/$side/$gait-mix-on.wav" -codec:a libmp3lame -q:a 4 "$out/$gait-$side.mp3"
  done
done
ls -l "$out"
