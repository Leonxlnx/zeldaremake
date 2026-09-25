#!/usr/bin/env python3
"""clock.py -- the audio clock against the wall clock, before and after.

    python3 art/audio/2026-09-25-suspend/clock.py --runs /tmp/suspend \
        --out art/audio/2026-09-25-suspend/clock.jpg

`suspend.mjs` logs `ctx.state` and `stats().contextTime` against `performance.now()` while it stops
the context at five seconds. A context that is doing its job advances its clock one second per
second; one that has been stopped and not asked back does not advance it at all, and everything the
player would have heard in that time is never produced.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


ap = argparse.ArgumentParser()
ap.add_argument('--runs', default='/tmp/suspend')
ap.add_argument('--out', default='art/audio/2026-09-25-suspend/clock.jpg')
a = ap.parse_args()

runs = {}
for tag in ('before', 'after'):
    p = os.path.join(a.runs, f'run-{tag}.json')
    if os.path.exists(p):
        runs[tag] = json.load(open(p))

W, H = 1080, 520
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
COL = {'before': (226, 106, 106), 'after': (120, 214, 150)}
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'The audio clock against the wall clock, with the context stopped at five seconds', font=f22, fill=INK)
d.text((28, 48), 'a context doing its job advances one second per second \u2014 the green sits on that line and hides it. The flat stretch is a game making no sound at all.', font=f13, fill=DIM)

x0, y0, x1, y1 = 90, 92, W - 40, H - 80
d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
span = 27.0
d.line([(x0, y1), (x0 + (x1 - x0), y1 - (y1 - y0))], fill=(70, 76, 84), width=1)
for s in range(0, 28, 3):
    tx = x0 + (x1 - x0) * s / span
    d.line([(tx, y1), (tx, y1 + 5)], fill=(70, 76, 84))
    d.text((tx - 6, y1 + 8), f'{s}', font=f13, fill=(96, 102, 110))
for s in range(0, 28, 6):
    ty = y1 - (y1 - y0) * s / span
    d.line([(x0 - 5, ty), (x0, ty)], fill=(70, 76, 84))
    d.text((x0 - 34, ty - 8), f'{s} s', font=f13, fill=(96, 102, 110))
d.text((x1 - 190, y1 + 30), 'wall clock, seconds \u2192', font=f13, fill=DIM)
d.text((28, y0 - 2), 'audio', font=f13, fill=DIM)
d.text((28, y0 + 16), 'clock', font=f13, fill=DIM)

for tag, run in runs.items():
    s = run['samples']
    base = s[0][2]
    pts = [(x0 + (x1 - x0) * r[0] / span, y1 - (y1 - y0) * (r[2] - base) / span) for r in s]
    d.line(pts, fill=COL[tag], width=3)
    lost = span - (s[-1][2] - base)
    d.text(
        (x0 + 16, y0 + 16 + 26 * (0 if tag == 'before' else 1)),
        f"{tag} \u2014 the clock ran {s[-1][2] - base:.2f} s of {span:.0f}, so {lost:.2f} s of the session made no sound",
        font=f16,
        fill=COL[tag],
    )
mx = x0 + (x1 - x0) * runs['before']['atSuspend'] / span
d.line([(mx, y0), (mx, y1)], fill=(244, 214, 120), width=1)
d.text((mx + 6, y1 - 22), 'context stopped here', font=f13, fill=(200, 180, 110))
im.save(a.out, quality=92)
print(f'wrote {a.out}')
