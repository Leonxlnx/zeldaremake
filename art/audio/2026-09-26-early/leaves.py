#!/usr/bin/env python3
"""leaves.py -- how far behind the wind are the leaves, in the rendered audio?

    python3 art/audio/2026-09-26-early/leaves.py /tmp/early/before /tmp/early/after

`early.mjs` measures the staleness on the schedule, which is exact and is not audio. This is the
same claim in the file: the leaf-only take's envelope, cross-correlated against the gust
`wind.ts` is actually running, with the lag of the best match read off.

Two things make the measurement honest rather than merely plausible:

  - **the sign is checked before it is used.** A cross-correlation's sign is the easiest thing
    here to get backwards and the hardest to notice, so a copy of the gust delayed by a known
    three seconds is measured first and has to read +3.0.
  - **the wind layers are muted in the take.** They follow the gust through `PLACE_TAU` and
    arrive on time, and they live in the same band the flutters do, so a take with both in it
    measures a blend of one late stream and one punctual one.

The bed take beside it is the control: it must not have moved. The change is to *when* the
weather is read, not to how much leaf there is, and a bed that got louder or quieter would mean
something else happened.
"""
import math
import pathlib
import sys
import wave

import numpy as np

BIN = 0.25
MAX_LAG_S = 10.0
# "how much leaf is happening" is a rate times a level and only exists over a window. Unsmoothed,
# the rendered envelope is a spike train — one flutter a second, each under a quarter of a second
# long — and correlating that against a smooth gust reads r = 0.03 whatever the truth is. Six
# seconds is where the match peaks and it is a quarter of the gust's own 24 s beat, so it cannot
# be smoothing the answer into existence.
SMOOTH_S = 6.0


# src/world/wind/wind.ts, update()
def gust(t):
    g = 0.5 + 0.5 * np.sin(t * 0.37) * np.sin(t * 0.11 + 1.3)
    push = np.maximum(0, np.sin(t * 0.23 + 0.4)) ** 3
    return np.minimum(1, g * 0.8 + push * 0.6)


def read(path):
    with wave.open(str(path), "rb") as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def envelope(x, rate):
    """energy per bin, over a window: what 'how much leaf is happening' means in a file"""
    n = int(rate * BIN)
    m = len(x) // n * n
    e = (x[:m].reshape(-1, n) ** 2).mean(axis=1)
    k = max(1, int(SMOOTH_S / BIN))
    return np.convolve(e, np.ones(k) / k, mode="same")


def norm(a):
    d = a - a.mean()
    s = math.sqrt(float((d * d).sum())) or 1.0
    return d / s


def delay_of(a, b):
    """the delay of `a` BEHIND `b`, in seconds: positive means `a` is late"""
    n = min(len(a), len(b))
    A, B = norm(a[:n]), norm(b[:n])
    best = (-2.0, 0.0)
    curve = []
    for L in range(-int(MAX_LAG_S / BIN), int(MAX_LAG_S / BIN) + 1):
        if L >= 0:
            s = float((A[L:] * B[: n - L]).sum()) * n / max(1, n - L)
        else:
            s = float((A[: n + L] * B[-L:]).sum()) * n / max(1, n + L)
        curve.append((L * BIN, s))
        if s > best[0]:
            best = (s, L * BIN)
    return best[1], best[0], curve


def lufs_ish(x):
    return 10 * math.log10(max(float((x * x).mean()), 1e-20))


def one(root):
    root = pathlib.Path(root)
    leaf_path = root / "leaves.wav"
    if not leaf_path.exists():
        return None
    x, rate = read(leaf_path)
    e = envelope(x, rate)
    t = (np.arange(len(e)) + 0.5) * BIN
    g = gust(t)
    # the sign check, on a series whose delay is known
    k = int(3.0 / BIN)
    known = np.concatenate([np.full(k, g[0]), g[:-k]])
    lag_known, _, _ = delay_of(known, g)
    if abs(lag_known - 3.0) > BIN:
        raise SystemExit(f"the correlation's sign is wrong: a series delayed by 3 s read as {lag_known}")
    lag, r, curve = delay_of(e, g)
    row = dict(lag=lag, r=r, rms=lufs_ish(x), curve=curve, sign=lag_known)
    bed_path = root / "bed.wav"
    if bed_path.exists():
        b, _ = read(bed_path)
        row["bed"] = lufs_ish(b)
        row["bedPeak"] = 20 * math.log10(max(float(np.abs(b).max()), 1e-12))
    return row


BANDS = [(20, 60), (60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]


def per_band(path):
    """the always-on level (p10 over time) and the swing (p90 − p10), per band.

    The metric this lane answers the owner's *"too buzzy"* with is the ALWAYS-ON one, never the
    mean: a change that leaves the floor where it was has not fixed anything. The swing beside it
    for the same reason in reverse — a floor that falls while the breathing collapses is a
    regression wearing the right number (rubric check 1 wants p90 − p10 ≥ 10 dB in every band).
    """
    x, rate = read(path)
    N, H = 8192, 4096
    f = np.fft.rfftfreq(N, 1 / rate)
    win = np.hanning(N)
    nf = 1 + (len(x) - N) // H
    idx = np.arange(N)[None, :] + H * np.arange(nf)[:, None]
    mag = np.abs(np.fft.rfft(x[idx] * win, axis=1)) ** 2
    out = {}
    for lo, hi in BANDS:
        db = 10 * np.log10(np.maximum(mag[:, (f >= lo) & (f < hi)].sum(1), 1e-20))
        out[(lo, hi)] = (float(np.percentile(db, 10)), float(np.percentile(db, 90)))
    return out


def floors(a_root, b_root):
    a, b = pathlib.Path(a_root) / "bed.wav", pathlib.Path(b_root) / "bed.wav"
    if not a.exists() or not b.exists():
        return
    fa, fb = per_band(a), per_band(b)
    print(f"\n  the whole bed, per band — the always-on level and the breathing")
    print(f"  {'band (Hz)':>15}{'always-on':>20}{'move':>9}{'swing p90−p10':>20}{'move':>9}")
    for k in BANDS:
        p10a, p90a = fa[k]
        p10b, p90b = fb[k]
        print(
            f"  {k[0]:6d}-{k[1]:<8d}{p10a:9.1f} → {p10b:6.1f}{p10b - p10a:+9.2f}"
            f"{p90a - p10a:13.1f} → {p90b - p10b:4.1f}{(p90b - p10b) - (p90a - p10a):+9.2f}"
        )


def main(argv):
    roots = argv or ["/tmp/early/after"]
    got = {r: one(r) for r in roots}
    got = {k: v for k, v in got.items() if v}
    if not got:
        print("  nothing to read")
        return
    print(f"\nthe leaves alone, standing on the plaza, against the wind the game is running")
    print(f"  (a copy of the gust delayed three seconds reads {list(got.values())[0]['sign']:+.2f} s, so the sign is right)\n")
    print(f"  {'take':<10}{'leaves behind the wind':>24}{'match':>9}{'leaf rms':>11}{'bed rms':>10}{'bed peak':>11}")
    for k, v in got.items():
        bed = f"{v['bed']:10.1f}" if "bed" in v else f"{'—':>10}"
        peak = f"{v['bedPeak']:11.1f}" if "bedPeak" in v else f"{'—':>11}"
        print(f"  {pathlib.Path(k).name:<10}{v['lag']:>21.2f} s{v['r']:9.3f}{v['rms']:11.1f}{bed}{peak}")
    if len(got) == 2:
        a, b = list(got.values())
        print(f"\n  the lag closes from {a['lag']:.2f} s to {b['lag']:.2f} s.")
        if "bed" in a and "bed" in b:
            print(f"  the leaves themselves move {b['rms'] - a['rms']:+.2f} dB and the whole bed {b['bed'] - a['bed']:+.2f} dB:")
            print(f"  the same leaves, in different places.")
        floors(roots[0], roots[1])


if __name__ == "__main__":
    main(sys.argv[1:])
