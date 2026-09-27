#!/usr/bin/env bash
# clips.sh -- a run and a walk, through the compressor and through a plain gain.
#
#   bash art/audio/2026-09-26-pad/clips.sh /tmp art/audio/2026-09-26-pad/clips
#
# The same fourteen seconds of the same seeded take each way, so anything that differs is the
# output stage. NOT normalised: the thing to hear is partly a level, and the difference between a
# walk and a run is entirely one.
#
# Play the two walks against the two runs rather than each pair on its own. Through the compressor
# a run peaks 1.77 dB over a walk; through the gain, 3.83. That gap is the point.
set -euo pipefail
takes="${1:-/tmp}"
out="${2:-art/audio/2026-09-26-pad/clips}"
mkdir -p "$out"
for gait in run walk; do
  ffmpeg -y -loglevel error -ss 6 -t 14 -i "$takes/pad/$gait-mix-on.wav" -codec:a libmp3lame -q:a 4 "$out/$gait-compressor.mp3"
  ffmpeg -y -loglevel error -ss 6 -t 14 -i "$takes/pad-after/$gait-mix-on.wav" -codec:a libmp3lame -q:a 4 "$out/$gait-pad.mp3"
done
ls -l "$out"
