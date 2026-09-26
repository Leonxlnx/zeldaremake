#!/usr/bin/env python3
"""layers.py -- what each layer of the bed is worth, and how long the wood is left with nothing.

    python3 art/audio/2026-09-25-layers/layers.py --takes /tmp/layers \
        --out art/audio/2026-09-25-layers/layers.jpg

Two questions, one set of takes.

  level     the always-on level per band -- the 10th percentile over time, which is what the owner's
            complaint is scored on -- with each layer switched off in turn. The difference between
            `all` and `no X` is what X is worth.

  the gap   the longest stretch the wood is left with nothing happening in it. `QUIET_GAP_MAX` caps
            the flutter scheduler at 2.2 s and says why: "with the bed gated below the gust knee and
            the tune resting between passes, the wood could otherwise fall to nothing for five
            seconds at a time, which reads as the sound having broken rather than as a quiet
            forest. A leaf turning over is the answer to that." This measures whether it is: a
            stretch counts as nothing-happening while the broadband short-time level stays within
            1 dB of that take's own quiet level.

Half the takes hold the gust below `GUST_KNEE`, where the wind layers are silent by design, because
that is the case the flutters were written for and a steady mid gust never visits it.
"""
import argparse
import json
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BANDS = [(60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000)]
WIN = 0.05


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


def frames(x, rate):
    n = int(round(WIN * rate))
    n += n % 2
    step = n // 2
    w = np.hanning(n)
    count = 1 + max(0, len(x) - n) // step
    idx = np.arange(n)[None, :] + step * np.arange(count)[:, None]
    return np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2, np.fft.rfftfreq(n, 1 / rate), step / rate


def aweight(f):
    """IEC 61672 A-weighting in dB -- what an ear does to the bands"""
    f = np.maximum(f, 1e-6)
    f2 = f * f
    ra = (12194**2 * f2**2) / ((f2 + 20.6**2) * np.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194**2))
    return 20 * np.log10(ra) + 2.0


def measure(path, floor=None):
    """
    The bands' always-on levels, and the longest stretch with nothing audible happening.

    A-weighted, and that is not a detail: broadband, the level is dominated by 60-250 Hz, where a
    leaf has nothing at all, so a broadband quiet metric cannot see the flutters however loud they
    are. Smoothed over 0.3 s, because a single 50 ms frame dipping under a threshold is not a wood
    falling silent. `floor` is the reference the stretch is counted against -- the full take's own
    10th percentile, shared across the mutes of a condition so that muting can only lengthen a gap.
    """
    x, rate = read(path)
    spec, f, hop = frames(x, rate)
    out = {'bands': {}}
    for lo, hi in BANDS:
        p = spec[:, (f >= lo) & (f < hi)].sum(axis=1)
        out['bands'][f'{lo}-{hi}'] = 10 * np.log10(max(np.percentile(p, 10), 1e-20))
    wgt = 10 ** (aweight(f) / 10)
    db = 10 * np.log10(np.maximum((spec * wgt[None, :]).sum(axis=1), 1e-20))
    k = max(1, int(0.3 / hop))
    pad = np.pad(db, (k // 2, k - k // 2 - 1), mode='edge')
    db = np.median(np.lib.stride_tricks.sliding_window_view(pad, k), axis=1)
    out['allOnDb'] = float(np.percentile(db, 10))
    ref = out['allOnDb'] if floor is None else floor
    idle = db <= ref + 3.0
    best = run = 0
    for v in idle:
        run = run + 1 if v else 0
        best = max(best, run)
    out['quietGapS'] = best * hop
    out['quietShare'] = float(idle.mean())
    return out


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/layers')
ap.add_argument('--out', default='')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'takes.json')))
rows = {}
for t in meta['takes']:
    if t['mute'] == 'all':
        rows[t['id']] = {**t, **measure(os.path.join(a.takes, f"{t['id']}.wav"))}
for t in meta['takes']:
    if t['mute'] != 'all':
        floor = rows[f"{t['spot']}-{t['gust']}-all"]['allOnDb']
        rows[t['id']] = {**t, **measure(os.path.join(a.takes, f"{t['id']}.wav"), floor)}

order = ['all', 'noleaves', 'nobirds', 'nowind']
for spot in ('open', 'crowns'):
    for gust in ('gusty', 'still-air'):
        base = rows.get(f'{spot}-{gust}-all')
        if not base:
            continue
        print(f"\n--- {spot}, {gust} (gust {base['gustValue']}) — {base['flutters']} flutters, {base['birds']} calls in {meta['seconds']} s ---")
        head = ' '.join(f'{k:>10}' for k in base['bands'])
        print(f"{'take':10} {head} {'always-on':>10} {'longest quiet':>14} {'quiet share':>12}")
        for m in order:
            r = rows.get(f'{spot}-{gust}-{m}')
            if not r:
                continue
            body = ' '.join(f"{r['bands'][k]:10.1f}" for k in base['bands'])
            print(f"{m:10} {body} {r['allOnDb']:10.1f} {r['quietGapS']:13.2f} s {r['quietShare'] * 100:11.0f} %")
        # what each layer is worth, in the always-on figure and in the gap
        for m in order[1:]:
            r = rows.get(f'{spot}-{gust}-{m}')
            if not r:
                continue
            print(f"{'  without ' + m[2:]:20} the longest quiet goes {base['quietGapS']:5.2f} → {r['quietGapS']:5.2f} s, and the always-on {r['allOnDb'] - base['allOnDb']:+.1f} dB")

if not a.out:
    raise SystemExit(0)

panes = [(s, g) for s in ('open', 'crowns') for g in ('gusty', 'still-air')]
W, H = 1120, 150 + 160 * len(panes)
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
COL = {'all': (238, 240, 243), 'noleaves': (120, 214, 150), 'nobirds': (226, 106, 106), 'nowind': (130, 160, 240)}
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'How long the wood is left with nothing happening in it, with each layer switched off', font=f22, fill=INK)
d.text((28, 48), 'QUIET_GAP_MAX caps the leaf scheduler at 2.2 s, on the grounds that a wood which falls silent reads as the sound having broken.', font=f13, fill=DIM)
d.text((28, 66), 'white = as it ships | green = no leaves | red = no birds | blue = no wind', font=f13, fill=DIM)
for i, (spot, gust) in enumerate(panes):
    y0 = 108 + i * 160
    y1 = y0 + 108
    x0, x1 = 300, W - 60
    base = rows.get(f'{spot}-{gust}-all')
    if not base:
        continue
    d.text((28, y0 + 8), f'{spot}, {gust}', font=f16, fill=INK)
    d.text((28, y0 + 30), f"{base['flutters']} leaves, {base['birds']} calls", font=f13, fill=DIM)
    lim = max(6.0, max(rows[f'{spot}-{gust}-{m}']['quietGapS'] for m in order if f'{spot}-{gust}-{m}' in rows) * 1.15)
    d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
    gx = x0 + (x1 - x0) * 2.2 / lim
    d.line([(gx, y0), (gx, y1)], fill=(244, 214, 120), width=1)
    d.text((gx + 5, y0 + 4), 'QUIET_GAP_MAX 2.2 s', font=f13, fill=(200, 180, 110))
    for k, m in enumerate(order):
        r = rows.get(f'{spot}-{gust}-{m}')
        if not r:
            continue
        by = y0 + 14 + k * 23
        w = (x1 - x0) * min(1.0, r['quietGapS'] / lim)
        d.rectangle([x0 + 1, by, x0 + max(2, w), by + 16], fill=COL[m])
        d.text((x0 + max(2, w) + 8, by + 1), f"{m} — {r['quietGapS']:.2f} s", font=f13, fill=COL[m])
im.save(a.out, quality=92)
print(f'\nwrote {a.out}')
