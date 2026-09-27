#!/usr/bin/env python3
"""clips.py -- cut the same gust out of both builds, so the leaves can be heard arriving late.

    python3 art/audio/2026-09-26-early/clips.py /tmp/early/before /tmp/early/after \\
        art/audio/2026-09-26-early/clips

Most of a take sounds the same either side of this change, because most of the time the wind is
not doing anything in particular and a four-second-old reading of it is as good as a fresh one.
The moment that carries it is a gust ARRIVING: the wind rises, and the leaves are supposed to
rise with it.

So the cut is made where `wind.ts`'s gust climbs fastest, and it is the same wall-clock second in
both takes — both are offline renders from the same seed against the same clock, so they are
already aligned and nothing has to be found by ear.
"""
import math
import pathlib
import subprocess
import sys

import numpy as np

LEAD_S = 6.0
LEN_S = 20.0


def gust(t):
    g = 0.5 + 0.5 * np.sin(t * 0.37) * np.sin(t * 0.11 + 1.3)
    push = np.maximum(0, np.sin(t * 0.23 + 0.4)) ** 3
    return np.minimum(1, g * 0.8 + push * 0.6)


def steepest_rise(seconds, lead=LEAD_S, span=LEN_S):
    """where the wind climbs most over a `lead`-second window, with room for the clip after it"""
    t = np.arange(0, max(1.0, seconds - span), 0.1)
    rise = gust(t + lead) - gust(t)
    i = int(np.argmax(rise[: max(1, len(rise))]))
    return float(t[i]), float(rise[i])


def cut(src, start, dur, dest):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.3f}", "-i", str(src), "-t", f"{dur:.3f}", "-b:a", "160k", str(dest)],
        check=True,
    )


def main(before, after, out, seconds=300):
    out = pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    at, rise = steepest_rise(seconds)
    print(f"  the wind climbs {rise:.2f} of its range over {LEAD_S:.0f} s starting at {at:.1f} s — the clip is {at:.1f} to {at + LEN_S:.1f} s")
    for label, root in (("before", before), ("after", after)):
        for stem in ("bed", "leaves"):
            src = pathlib.Path(root) / f"{stem}.wav"
            if src.exists():
                cut(src, at, LEN_S, out / f"{stem}-{label}.mp3")
    # and a minute of the whole bed either side, for context rather than for the A/B
    for label, root in (("before", before), ("after", after)):
        src = pathlib.Path(root) / "bed.wav"
        if src.exists():
            cut(src, 30, 60, out / f"bed-minute-{label}.mp3")
    print(f"  wrote {out}")


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "/tmp/early/before"
    b = sys.argv[2] if len(sys.argv) > 2 else "/tmp/early/after"
    c = sys.argv[3] if len(sys.argv) > 3 else "art/audio/2026-09-26-early/clips"
    main(a, b, c)
