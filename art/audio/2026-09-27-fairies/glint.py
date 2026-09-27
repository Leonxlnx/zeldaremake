#!/usr/bin/env python3
"""glint.py -- is a fairy louder than the forest it has to be heard over?

    python3 art/audio/2026-09-27-fairies/glint.py /tmp/fairies

Three takes of the same ninety seconds standing a metre from a Kokiri kid: the whole bed, the
glints alone, and everything except the glints. The third is what the fairy has to get through.

A cue is audible when it clears the thing behind it **in its own band, at the moment it happens**
— not on average over a take, which is the mistake that would make a bell buried under a lantern
look fine. So the glints are found in the glint-only take (where nothing else can be mistaken for
one), and each is then compared with the forest's level at that same instant in the same band.

`FAIRY_LEVEL` is 0.014, the smallest level in the bed by a long way, and the standing complaint
this lane exists for is that there is too much sound. The fairy being quiet is deliberate. The
question is whether it is quiet or absent.
"""
import json
import math
import pathlib
import sys
import wave

import numpy as np

# src/audio/ambience.ts: the glint is high-passed at 1200 Hz and is two or three bell partials
BAND = (1200, 9000)
MIN_GAP_S = 1.4  # FAIRY_GAP[0] — the closest two glints can be
LOOK_S = 0.18  # a glint climbs over about 120 ms


def read(path):
    with wave.open(str(path), "rb") as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype="<i2").astype(np.float64).reshape(-1, ch) / 32768.0, sr


def band_env(x, sr, lo, hi, win=0.01):
    """the short-term level in a band, both channels, as a loudness would count them"""
    N, H = 2048, 256
    f = np.fft.rfftfreq(N, 1 / sr)
    w = np.hanning(N)
    nf = 1 + (len(x) - N) // H
    idx = np.arange(N)[None, :] + H * np.arange(nf)[:, None]
    sel = (f >= lo) & (f < hi)
    p = np.zeros(nf)
    for c in range(x.shape[1]):
        p += np.abs(np.fft.rfft(x[idx, c] * w, axis=1))[:, sel].__pow__(2).sum(axis=1)
    return 10 * np.log10(np.maximum(p / x.shape[1], 1e-20)), H / sr


def db(v):
    return 10 * math.log10(max(float(v), 1e-20))


def main(root):
    root = pathlib.Path(root)
    takes = {}
    for name in ("bed", "glints", "without"):
        p = root / f"{name}.wav"
        if p.exists():
            takes[name] = read(p)
    if "glints" not in takes or "without" not in takes:
        print(f"  {root}: need glints.wav and without.wav")
        return
    meta = json.loads((root / "glint.json").read_text()) if (root / "glint.json").exists() else {}
    g, sr = takes["glints"]
    w, _ = takes["without"]

    print(f"\nstanding a metre from {meta.get('kid', 'a Kokiri kid')} at {tuple(meta.get('at', {}).values())}, {len(g) / sr:.0f} s\n")
    for name, (x, _sr) in takes.items():
        print(f"  {name:<9} rms {db((x ** 2).mean()):7.1f} dB   peak {20 * math.log10(max(np.abs(x).max(), 1e-12)):7.1f} dBFS")

    ge, hop = band_env(g, sr, *BAND)
    we, _ = band_env(w, sr, *BAND)
    n = min(len(ge), len(we))
    ge, we = ge[:n], we[:n]

    # the glints, found where nothing else can be mistaken for one
    floor = np.percentile(ge, 50)
    thresh = max(floor + 12, np.percentile(ge, 99) - 12)
    gap = max(1, int(MIN_GAP_S / hop))
    at = []
    i = 0
    while i < n:
        if ge[i] >= thresh:
            j = min(n, i + gap)
            k = i + int(np.argmax(ge[i:j]))
            at.append(k)
            i = k + gap
        else:
            i += 1
    if not at:
        print("\n  no glints found in the glint-only take")
        return
    look = max(1, int(LOOK_S / hop))
    over = np.array([ge[k] - we[max(0, k - look) : k + look].max() for k in at])
    print(f"\n  {len(at)} glints in {len(g) / sr:.0f} s — one every {len(g) / sr / len(at):.1f} s")
    print(f"  each against the forest at that instant, in {BAND[0]}\u2013{BAND[1]} Hz:")
    print(f"    median {np.median(over):+.1f} dB   p10 {np.percentile(over, 10):+.1f}   best {over.max():+.1f}   worst {over.min():+.1f}")
    above = (over > 0).sum()
    print(f"    {above} of {len(at)} ({100 * above / len(at):.0f} %) are louder than the forest behind them")
    print(f"\n  and the glint stream against the rest of the bed, over the whole take:")
    print(f"    glints {db((g ** 2).mean()):.1f} dB, everything else {db((w ** 2).mean()):.1f} dB \u2014 {db((g ** 2).mean()) - db((w ** 2).mean()):+.1f} dB")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/fairies")
