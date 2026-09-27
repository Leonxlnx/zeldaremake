#!/usr/bin/env python3
"""flame.py -- how much of the world's loudest never-stopping place is the flame?

    python3 art/audio/2026-09-27-flame/flame.py /tmp/flame

The metric is the one this lane answers the owner's *"too buzzy"* with: the **always-on** level,
the tenth percentile over time, per band — never the mean. A flame that is loud in gusts and
silent between is a different thing from one that sits there, and only the second is what the
complaint is about.

Read with both channels, powers averaged, because a mono sum reads a decorrelated bed 4.6 to
5.3 dB low (`art/audio/2026-09-26-ears/`).

Three takes per place: the whole bed, the flame alone, and everything except the flame. The third
is what the flame would have to be measured against if it were an event; it is not an event, so
what matters is how much of the FLOOR it is — a thing that never stops is judged by what it adds
to the quietest moment, not by what it adds on average.
"""
import json
import math
import pathlib
import sys
import wave

import numpy as np

BANDS = [(20, 60), (60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]
WIN = 0.25


def read(path):
    with wave.open(str(path), "rb") as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype="<i2").astype(np.float64).reshape(-1, ch) / 32768.0, sr


def a_weight(x, sr):
    """IEC 61672, per channel, in the frequency domain (the take is offline, so this is exact)"""
    out = np.empty_like(x)
    n = x.shape[0]
    f = np.maximum(np.fft.rfftfreq(n, 1.0 / sr), 1e-6)
    f2 = f**2
    ra = (12194.0**2 * f2**2) / ((f2 + 20.6**2) * np.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194.0**2))
    for c in range(x.shape[1]):
        out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c]) * (ra * 10 ** (1.9997 / 20)), n)
    return out


def short_term(x, sr, win=WIN):
    """channel powers averaged, not samples — see art/audio/2026-09-26-ears/"""
    n = int(win * sr)
    m = x.shape[0] // n
    p = np.stack([(x[: m * n, c].reshape(m, n) ** 2).mean(axis=1) for c in range(x.shape[1])])
    return 10 * np.log10(np.maximum(p.mean(axis=0), 1e-26))


def band(x, sr, lo, hi):
    out = np.empty_like(x)
    n = x.shape[0]
    f = np.fft.rfftfreq(n, 1.0 / sr)
    keep = (f >= lo) & (f < hi)
    for c in range(x.shape[1]):
        X = np.fft.rfft(x[:, c])
        X[~keep] = 0
        out[:, c] = np.fft.irfft(X, n)
    return out


def profile(path):
    x, sr = read(path)
    aw = short_term(a_weight(x, sr), sr)
    p10, p50, p90 = np.percentile(aw, [10, 50, 90])
    bands = {}
    for lo, hi in BANDS:
        b = short_term(band(x, sr, lo, hi), sr)
        bands[(lo, hi)] = (float(np.percentile(b, 10)), float(np.percentile(b, 90)))
    return dict(floor=float(p10), mid=float(p50), swing=float(p90 - p10), bands=bands)


def main(root):
    root = pathlib.Path(root)
    meta = json.loads((root / "flame.json").read_text()) if (root / "flame.json").exists() else {}
    places = [p[0] for p in meta.get("places", [])] or ["pod", "bough", "lawn"]
    notes = {p[0]: p[2] for p in meta.get("places", [])}
    got = {}
    for place in places:
        for take in ("bed", "flame", "without"):
            f = root / f"{place}-{take}.wav"
            if f.exists():
                got[(place, take)] = profile(f)
    if not got:
        print(f"  {root}: nothing to read")
        return

    print(f"\nthe always-on level (A-weighted, the tenth percentile over time) and how much it breathes\n")
    print(f"  {'place':<8}{'take':<10}{'always-on':>12}{'median':>10}{'swing':>9}{'the flame is':>15}")
    for place in places:
        for take in ("bed", "flame", "without"):
            r = got.get((place, take))
            if not r:
                continue
            share = ""
            if take == "flame" and (place, "bed") in got:
                # what the flame adds to the FLOOR: the bed's floor against the floor without it
                b = got[(place, "bed")]["floor"]
                w = got[(place, "without")]["floor"] if (place, "without") in got else None
                if w is not None:
                    share = f"{b - w:+.2f} dB"
            print(f"  {place:<8}{take:<10}{r['floor']:12.1f}{r['mid']:10.1f}{r['swing']:9.1f}{share:>15}")
        print("")

    print("  what the flame adds to the floor, per band (the bed against the bed without it)\n")
    print(f"  {'band (Hz)':>14}" + "".join(f"{p:>12}" for p in places))
    for k in BANDS:
        line = f"  {k[0]:6d}-{k[1]:<7d}"
        for place in places:
            if (place, "bed") in got and (place, "without") in got:
                line += f"{got[(place, 'bed')]['bands'][k][0] - got[(place, 'without')]['bands'][k][0]:+12.2f}"
            else:
                line += f"{'—':>12}"
        print(line)

    print("\n  and the flame on its own: does it breathe, or is it a drone?\n")
    print(f"  {'place':<8}{'always-on':>12}{'swing':>9}   (rubric check 1 wants a band to swing 10 dB or more)")
    for place in places:
        r = got.get((place, "flame"))
        if r:
            print(f"  {place:<8}{r['floor']:12.1f}{r['swing']:9.1f}   {notes.get(place, '')}")
    # the crowd question: a village of pods must not sum to a drone
    if ("bough", "flame") in got and ("pod", "flame") in got:
        d = got[("bough", "flame")]["floor"] - got[("pod", "flame")]["floor"]
        print(f"\n  the densest cluster in the world against one pod at a metre: {d:+.1f} dB on the floor")
        print(f"  (LANTERN_CROWD_SHARE exists so a village of pods does not sum to a drone)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/flame")
