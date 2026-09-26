#!/usr/bin/env python3
"""steps.py -- a walk and a run, step by step, out of the rendered audio.

    python3 art/audio/2026-09-26-perstep/steps.py --takes /tmp/perstep \
        --out art/audio/2026-09-26-perstep/steps.jpg

Rubric check 21 is *walking and running differ in more than rate*, and it has sat at 3 because the
per-step instrument did not work at a running cadence: at the old controller's 4.6 m/s a run was
five steps a second, a step's envelope had not finished when the next began, and the run's own first
half differed from its second by 13.4 dB rms. PR #59 brought the run to 3.67 steps a second, and
272 ms between steps is not 143.

The detector is deliberately simple, and its own reliability is the first thing reported:

  found     steps detected against steps the cadence says there should be. Under-counting is the
            failure mode the old instrument had, and it shows here as a ratio under 1.
  spacing   the interval between detected onsets. A gait is a rhythm; if the detector is finding
            parts of steps rather than steps, the spacing scatters.

Then, per step, on the 40 ms after its onset:

  peak      how hard it lands
  centroid  where its energy sits -- the run design brightens the body by RUN_BRIGHT
  decay     how long it takes to fall 12 dB from its peak -- the run design shortens the tail
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def envelope(x, rate, win=0.004):
    n = max(2, int(win * rate))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def onsets(x, rate, min_gap):
    """
    Peaks in the envelope's rise, at least `min_gap` apart.

    The gap is three quarters of the cadence's own interval, so it cannot merge two real steps and
    cannot split one: a heel and its toe are 50-100 ms apart and the gaps here are 272 ms and 366.
    """
    env = envelope(x, rate)
    d = np.diff(env, prepend=env[0])
    thr = np.percentile(d, 99.0)
    gap = int(min_gap * rate)
    out = []
    i = 0
    while i < len(d):
        if d[i] > thr:
            j = min(len(env), i + int(0.02 * rate))
            out.append(int(i + np.argmax(env[i:j])) if j > i else i)
            i += gap
        else:
            i += 1
    return np.array(out)


def per_step(x, rate, at, length=0.04):
    n = int(length * rate)
    out = []
    for i in at:
        seg = x[i : i + n]
        if len(seg) < n // 2:
            continue
        w = np.hanning(len(seg))
        spec = np.abs(np.fft.rfft(seg * w)) ** 2
        f = np.fft.rfftfreq(len(seg), 1 / rate)
        tot = spec.sum()
        if tot <= 0:
            continue
        env = envelope(x[i : i + int(0.25 * rate)], rate)
        pk = env.max() if len(env) else 0.0
        below = np.flatnonzero(env < pk * 10 ** (-12 / 20))
        decay = (below[0] / rate) if len(below) else 0.25
        out.append({'peak': 20 * math.log10(max(pk, 1e-9)), 'centroid': float((spec * f).sum() / tot), 'decay': decay})
    return out


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/perstep')
ap.add_argument('--out', default='')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'takes-after.json')))
STRIDE = {'walk': 0.44, 'run': 0.60}
rows = []
for t in meta['takes']:
    x, rate = read(os.path.join(a.takes, f"{t['gait']}-after.wav"))
    x = x[int(meta['lead'] * rate) :]
    interval = STRIDE[t['gait']] / t['speed']
    at = onsets(x, rate, interval * 0.75)
    steps = per_step(x, rate, at)
    if not steps:
        continue
    gaps = np.diff(at) / rate
    expect = len(x) / rate / interval
    rows.append(
        {
            'gait': t['gait'],
            'speed': t['speed'],
            'interval': interval,
            'found': len(at),
            'expect': expect,
            'gapMed': float(np.median(gaps)),
            'gapIqr': float(np.percentile(gaps, 75) - np.percentile(gaps, 25)),
            'peak': float(np.median([s['peak'] for s in steps])),
            'centroid': float(np.median([s['centroid'] for s in steps])),
            'decay': float(np.median([s['decay'] for s in steps])),
            'steps': steps,
        }
    )

print('first, whether the instrument works at all at this cadence:')
print(f"{'gait':6} {'speed':>6} {'cadence':>9}   {'found':>6} {'expected':>8} {'ratio':>6}   {'gap median':>11} {'gap IQR':>8}")
for r in rows:
    print(
        f"{r['gait']:6} {r['speed']:>4} m/s {1 / r['interval']:>6.2f}/s   {r['found']:>6} {r['expect']:>8.0f} {r['found'] / r['expect']:>6.2f}   "
        f"{r['gapMed'] * 1000:>8.0f} ms {r['gapIqr'] * 1000:>6.0f} ms"
    )
print('\nand then what a step is, per gait:')
print(f"{'gait':6} {'peak':>9} {'centroid':>10} {'decay to -12 dB':>16}")
for r in rows:
    print(f"{r['gait']:6} {r['peak']:>7.1f} dB {r['centroid']:>8.0f} Hz {r['decay'] * 1000:>13.0f} ms")
if len(rows) == 2:
    w, rn = rows[0], rows[1]
    print(
        f"\na run against a walk: {rn['peak'] - w['peak']:+.1f} dB, {rn['centroid'] - w['centroid']:+.0f} Hz, "
        f"{(rn['decay'] - w['decay']) * 1000:+.0f} ms, and {1 / rn['interval'] / (1 / w['interval']):.2f}x the rate"
    )

if not a.out or len(rows) != 2:
    raise SystemExit(0)

W, H = 1060, 460
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
COL = {'walk': (130, 160, 240), 'run': (244, 176, 110)}
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'A walk and a run, step by step, out of the rendered audio', font=f22, fill=INK)
d.text((28, 48), 'every detected step plotted as a dot; the box is the middle half and the line the median. blue = walk, orange = run', font=f13, fill=DIM)
panels = [('peak', 'how hard it lands (dB)', 1), ('centroid', 'where its energy sits (Hz)', 1), ('decay', 'tail to \u221212 dB (ms)', 1000)]
for i, (key, label, scale) in enumerate(panels):
    x0 = 60 + i * 330
    x1 = x0 + 270
    y0, y1 = 100, 360
    d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
    d.text((x0, y0 - 22), label, font=f16, fill=INK)
    vals = {r['gait']: np.array([s[key] for s in r['steps']]) * scale for r in rows}
    lo = min(v.min() for v in vals.values())
    hi = max(v.max() for v in vals.values())
    span = (hi - lo) or 1
    for k, (gait, v) in enumerate(vals.items()):
        cx = x0 + (x1 - x0) * (0.3 + 0.4 * k)
        for s in v:
            yy = y1 - (y1 - y0 - 20) * (s - lo) / span - 10
            d.ellipse([cx - 2, yy - 2, cx + 2, yy + 2], fill=COL[gait])
        q1, med, q3 = np.percentile(v, [25, 50, 75])
        for q, wdt in ((q1, 26), (med, 40), (q3, 26)):
            yy = y1 - (y1 - y0 - 20) * (q - lo) / span - 10
            d.line([(cx - wdt, yy), (cx + wdt, yy)], fill=COL[gait], width=2 if q == med else 1)
        d.text((cx - 16, y1 + 6), gait, font=f13, fill=COL[gait])
        d.text((cx - 22, y0 + 4 + k * 16), f'{med:.0f}', font=f13, fill=COL[gait])
im.save(a.out, quality=92)
print(f'wrote {a.out}')
