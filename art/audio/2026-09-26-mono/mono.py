#!/usr/bin/env python3
"""mono.py -- what the mix does when the two speakers become one.

    python3 art/audio/2026-09-26-mono/mono.py /tmp/mono

The rubric's own instruction is to judge *"at the player's ear, in play, on headphones **and on
laptop speakers**"*, and `ambience.ts` says out loud that this lane has never done the second
half:

    "a sign error in either would be invisible to every measurement this lane makes, because all
     of them are mono sums"

Every tool in `art/audio/` opens a stereo WAV and immediately averages the channels. So the mono
case is the one that has been tuned, by accident, and **the stereo case is the one nobody has
looked at** — which is the wrong way round, because headphones are where a player hears a forest.

What is measured here, per stem and per band:

  * **stereo** — the energy two ears get, `(L² + R²) / 2`.
  * **mono** — the energy one speaker gets, `((L + R) / 2)²`. Summing is the worst case for
    anything wide and it is exactly what a phone, a single Bluetooth speaker or a laptop's mixed
    output does.
  * **the collapse** — mono minus stereo, which is 0 dB for anything dead centre and −∞ for
    anything in anti-phase. A stem that loses much more than its neighbours is a stem whose place
    in the balance depends on what the player is listening through.

The last one is the point. A level is only a level relative to something else, and every level
decision this lane has shipped — the steps down 4 dB, the sfx pad, the music's balance against
the bed — was decided on the mono sum. If the stems collapse by different amounts then those
decisions do not hold on headphones, and nobody would have known.
"""
import math
import pathlib
import sys
import wave

import numpy as np

BANDS = [(20, 60), (60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]
STEMS = ("mix", "bed", "steps", "music")


def read(path):
    with wave.open(str(path), "rb") as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    return x.reshape(-1, ch), rate


def db(v):
    return 10 * math.log10(max(float(v), 1e-20))


def spectra(sig, rate):
    N, H = 8192, 4096
    if len(sig) < N:
        return None, None
    win = np.hanning(N)
    nf = 1 + (len(sig) - N) // H
    idx = np.arange(N)[None, :] + H * np.arange(nf)[:, None]
    return np.abs(np.fft.rfft(sig[idx] * win, axis=1)) ** 2, np.fft.rfftfreq(N, 1 / rate)


def one(path):
    x, rate = read(path)
    if x.shape[1] < 2:
        return None
    L, R = x[:, 0], x[:, 1]
    mid = (L + R) / 2
    stereo = float(((L * L + R * R) / 2).mean())
    mono = float((mid * mid).mean())
    # how alike the two channels are: 1 is dead centre, 0 is fully decorrelated, −1 is anti-phase
    denom = math.sqrt(float((L * L).mean()) * float((R * R).mean())) or 1e-20
    corr = float((L * R).mean()) / denom
    # and whether it sits to one side, which is what check 43 actually asks: +1 is hard right
    lean = (float((R * R).mean()) - float((L * L).mean())) / (float((R * R).mean()) + float((L * L).mean()) or 1e-20)
    ml, f = spectra(mid, rate)
    sl, _ = spectra((L - R) / 2, rate)
    bands = {}
    if ml is not None:
        for lo, hi in BANDS:
            sel = (f >= lo) & (f < hi)
            m, s = float(ml[:, sel].sum()), float(sl[:, sel].sum())
            bands[(lo, hi)] = db(m) - db(m + s)
    side_mid = db(float(((L - R) / 2 * ((L - R) / 2)).mean())) - db(float((mid * mid).mean()))
    return dict(stereo=db(stereo), mono=db(mono), collapse=db(mono) - db(stereo), corr=corr, lean=lean, side=side_mid, bands=bands)


def report(root):
    root = pathlib.Path(root)
    got = {}
    for s in STEMS:
        p = root / f"{s}.wav"
        if p.exists():
            r = one(p)
            if r:
                got[s] = r
    if not got:
        print(f"  {root}: no stereo stems to read")
        return
    print(f"\n{root} — what each stem loses when the two speakers become one\n")
    print(f"  {'stem':<8}{'on headphones':>16}{'on one speaker':>17}{'the collapse':>15}{'L·R':>8}{'side−mid':>10}{'lean':>8}")
    for s, r in got.items():
        print(f"  {s:<8}{r['stereo']:14.1f} dB{r['mono']:15.1f} dB{r['collapse']:+13.2f} dB{r['corr']:8.2f}{r['side']:+9.1f} {r['lean']:+7.3f}")
    print(f"\n  lean is where the stem sits: 0 is centred, ±1 is hard against one speaker (check 43)")

    # the point: a level is only a level against something else
    if "bed" in got:
        print(f"\n  the balance, and whether it holds through the speakers")
        print(f"  {'':<22}{'headphones':>13}{'one speaker':>14}{'moves by':>11}")
        for s in ("steps", "music", "mix"):
            if s not in got:
                continue
            a = got[s]["stereo"] - got["bed"]["stereo"]
            b = got[s]["mono"] - got["bed"]["mono"]
            print(f"  {s + ' over the bed':<22}{a:11.1f} dB{b:12.1f} dB{b - a:+9.2f} dB")

    print(f"\n  the collapse per band (0 dB is dead centre, −3 dB is fully decorrelated)")
    head = "".join(f"{s:>10}" for s in got)
    print(f"  {'band (Hz)':<16}{head}")
    for k in BANDS:
        row = "".join(f"{got[s]['bands'].get(k, float('nan')):+10.2f}" for s in got)
        print(f"  {k[0]:6d}-{k[1]:<9d}{row}")

    worst = min(got.items(), key=lambda kv: kv[1]["corr"])
    if worst[1]["corr"] < 0:
        print(f"\n  ** {worst[0]} has negative channel correlation ({worst[1]['corr']:.2f}) — it partly CANCELS on one speaker **")


def compare(before, after):
    a = {s: one(pathlib.Path(before) / f"{s}.wav") for s in STEMS if (pathlib.Path(before) / f"{s}.wav").exists()}
    b = {s: one(pathlib.Path(after) / f"{s}.wav") for s in STEMS if (pathlib.Path(after) / f"{s}.wav").exists()}
    shared = [s for s in STEMS if a.get(s) and b.get(s)]
    if not shared:
        return
    print(f"\n  where each stem sits, before and after — 0 is centred, negative is left")
    print(f"  {'stem':<8}{'before':>10}{'after':>10}{'moved':>10}{'as dB of L over R, before → after':>38}")
    for s in shared:
        la, lb = a[s]["lean"], b[s]["lean"]
        dba = 10 * math.log10((1 - la) / (1 + la)) if abs(la) < 1 else float("nan")
        dbb = 10 * math.log10((1 - lb) / (1 + lb)) if abs(lb) < 1 else float("nan")
        print(f"  {s:<8}{la:+10.3f}{lb:+10.3f}{lb - la:+10.3f}{dba:+28.2f} → {dbb:+.2f}")


def main(argv):
    roots = argv or ["/tmp/mono"]
    for r in roots:
        report(r)
    if len(roots) == 2:
        compare(roots[0], roots[1])


if __name__ == "__main__":
    main(sys.argv[1:])
