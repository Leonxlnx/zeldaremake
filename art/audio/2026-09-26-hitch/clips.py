#!/usr/bin/env python3
"""clips.py -- cut the same few strides out of both builds so the difference can be heard.

    python3 art/audio/2026-09-26-hitch/clips.py /tmp/hitch/before /tmp/hitch/after art/audio/2026-09-26-hitch/clips

A 41-second take is too long to A/B and most of it is identical, because most steps did not fall
on a hitch. This finds the plant where the two builds differ most, cuts the same eight strides of
ground out of each take around it, and writes mp3s. The cut is made on the CONTACT SCHEDULE, not
on wall time: the hitched take needs a quarter more wall seconds for the same flagstones, so
cutting both at "12.0 s" would not be the same walk.
"""
import math
import pathlib
import subprocess
import sys

import numpy as np

import importlib.util

_spec = importlib.util.spec_from_file_location("hitched", pathlib.Path(__file__).with_name("hitched.py"))
H = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(H)

SPAN = 4  # plants either side of the one that moved most


def cut(src, start, dur, dest):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-b:a", "160k", str(dest)],
        check=True,
    )


def main(before, after, out):
    out = pathlib.Path(out)
    out.mkdir(parents=True, exist_ok=True)
    picked = {}
    for mode in ("blocking", "burst", "smooth"):
        ta, tb = H.take(before, mode), H.take(after, mode)
        if not ta or not tb:
            continue
        # the plant that moved most between the builds, matched on the ground he had covered
        best, at = 0.0, None
        for i in range(len(tb["amps"])):
            j = int(np.argmin(np.abs(ta["walked"] - tb["walked"][i])))
            if abs(ta["walked"][j] - tb["walked"][i]) > 0.22:
                continue
            d = H.db(tb["amps"][i]) - H.db(ta["amps"][j])
            if abs(d) > abs(best):
                best, at = d, (i, j)
        if at is None:
            continue
        i, j = at
        for label, t, idx, root in (("before", ta, j, before), ("after", tb, i, after)):
            lo = max(0, idx - SPAN)
            hi = min(len(t["at"]) - 1, idx + SPAN)
            start = max(0.0, t["at"][lo] - 0.35)
            dur = t["at"][hi] - start + 0.6
            cut(pathlib.Path(root) / f"{mode}.webm", start, dur, out / f"{mode}-{label}.mp3")
        picked[mode] = dict(d=best, metres=float(tb["walked"][i]))
        print(f"  {mode:9s} worst plant {best:+.1f} dB at {tb['walked'][i]:.1f} m → {mode}-before.mp3 / {mode}-after.mp3")
    # and the whole hitched walk either side, for anyone who wants the context
    for label, root in (("before", before), ("after", after)):
        src = pathlib.Path(root) / "blocking.webm"
        if src.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-b:a", "128k", str(out / f"walk-hitched-{label}.mp3")], check=True)
    print(f"  wrote {out}")
    return picked


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "/tmp/hitch/before"
    b = sys.argv[2] if len(sys.argv) > 2 else "/tmp/hitch/after"
    c = sys.argv[3] if len(sys.argv) > 3 else "art/audio/2026-09-26-hitch/clips"
    main(a, b, c)
