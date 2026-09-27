#!/usr/bin/env python3
"""plot.py -- the wind's worth, measured through the broken mute and through a mute.

    python3 art/audio/2026-09-26-relayers/plot.py --before /tmp/layers-before \\
        --after /tmp/layers-after --out art/audio/2026-09-26-relayers/relayers.jpg

Left: how far the always-on level falls when the wind is switched off, in each of the four
conditions, measured both ways. Three of them do not move at all and one moves 8.8 dB, and the
pattern is the whole explanation -- the leak was `windOff * sw` with the `windOff` missing, and
`sw` is zero below the gust knee, so the bug could only ever show where there was a gust to leak
AND where the wind was the only thing left in the floor.

Right: the band the correction lives in. Under gusty crowns with a real mute, every band of the
bed collapses by 20 to 40 dB and what is left is the same floor a still-air take has. The broken
mute left a wind-shaped residue sitting 9 dB over it.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '2026-09-25-layers', 'layers.py')).read()
_ns = {}
exec(compile(_src[: _src.index('ap = argparse.ArgumentParser()')], 'layers.py', 'exec'), _ns)  # noqa: S102
measure, BANDS = _ns['measure'], _ns['BANDS']

CONDITIONS = [('open', 'gusty'), ('open', 'still-air'), ('crowns', 'gusty'), ('crowns', 'still-air')]


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def load(takes):
    meta = json.load(open(os.path.join(takes, 'takes.json')))
    rows = {}
    for t in meta['takes']:
        if t['mute'] == 'all':
            rows[t['id']] = measure(os.path.join(takes, f"{t['id']}.wav"))
    for t in meta['takes']:
        if t['mute'] != 'all':
            rows[t['id']] = measure(os.path.join(takes, f"{t['id']}.wav"), rows[f"{t['spot']}-{t['gust']}-all"]['allOnDb'])
    return rows


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/layers-before')
ap.add_argument('--after', default='/tmp/layers-after')
ap.add_argument('--out', default='art/audio/2026-09-26-relayers/relayers.jpg')
a = ap.parse_args()

before, after = load(a.before), load(a.after)

W, H = 1060, 500
BG, INK, DIM, GRID = (17, 19, 22), (238, 240, 243), (120, 128, 138), (44, 48, 54)
WAS, NOW = (244, 176, 110), (130, 200, 160)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'What the wind is worth, measured through a mute that worked', font=f22, fill=INK)
d.text((28, 48), 'orange = through the broken mute (what 2026-09-25-layers reported)  |  green = through a mute', font=f13, fill=DIM)

# ---- left: the wind's always-on cost, per condition -------------------------------------------
x0, x1, y0, y1 = 210, 470, 110, 400
d.text((70, y0 - 24), 'how far the floor falls with the wind off', font=f16, fill=INK)
worst = 32.0
for gl in range(0, 31, 10):
    xx = x0 + (x1 - x0) * gl / worst
    d.line([(xx, y0), (xx, y1)], fill=GRID)
    d.text((xx - 12, y1 + 8), f'-{gl} dB', font=f13, fill=DIM)
for i, (spot, gust) in enumerate(CONDITIONS):
    yy = y0 + 20 + i * 68
    d.text((70, yy + 6), f'{spot}, {gust}', font=f13, fill=INK)
    for k, (name, rows, col) in enumerate((('before', before, WAS), ('after', after, NOW))):
        cost = rows[f'{spot}-{gust}-all']['allOnDb'] - rows[f'{spot}-{gust}-nowind']['allOnDb']
        w = (x1 - x0) * min(cost, worst) / worst
        d.rectangle([x0, yy + k * 20, x0 + max(w, 1), yy + k * 20 + 14], fill=col)
        d.text((x0 + max(w, 1) + 8, yy + k * 20), f'-{cost:.1f} dB', font=f13, fill=col)

# ---- right: the bands under gusty crowns -------------------------------------------------------
x0, x1 = 620, 1010
d.text((x0, y0 - 24), 'crowns, gusty \u2014 the bed with the wind off', font=f16, fill=INK)
d.rectangle([x0, y0, x1, y1], outline=GRID)
keys = [f'{lo}-{hi}' for lo, hi in BANDS]
top, bot = 20.0, -60.0
for gl in range(20, -61, -20):
    yy = y1 - (y1 - y0) * (gl - bot) / (top - bot)
    d.line([(x0, yy), (x1, yy)], fill=GRID)
    d.text((x0 - 42, yy - 8), f'{gl:>3} dB', font=f13, fill=DIM)
series = [
    ('the bed as it is', after['crowns-gusty-all']['bands'], (150, 158, 170)),
    ('wind off, broken mute', before['crowns-gusty-nowind']['bands'], WAS),
    ('wind off, a real mute', after['crowns-gusty-nowind']['bands'], NOW),
]
for si, (name, bands, col) in enumerate(series):
    pts = []
    for bi, k in enumerate(keys):
        xx = x0 + (x1 - x0) * (bi + 0.5) / len(keys)
        yy = y1 - (y1 - y0) * (min(max(bands[k], bot), top) - bot) / (top - bot)
        pts.append((xx, yy))
        d.ellipse([xx - 3, yy - 3, xx + 3, yy + 3], fill=col)
    d.line(pts, fill=col, width=2)
    d.text((x0 + 10, y1 - 62 + si * 18), name, font=f13, fill=col)
for bi, (lo, hi) in enumerate(BANDS):
    xx = x0 + (x1 - x0) * (bi + 0.5) / len(keys)
    label = f'{lo // 1000}k' if lo >= 1000 else str(lo)
    d.text((xx - 8, y1 + 8), label, font=f13, fill=DIM)
d.text((x0, y1 + 30), 'Hz \u2014 the always-on level in each band', font=f13, fill=DIM)

im.save(a.out, quality=92)
print(f'wrote {a.out}')
