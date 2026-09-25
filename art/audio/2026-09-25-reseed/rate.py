#!/usr/bin/env python3
"""rate.py -- the old rule's firings against the rate the wood calls at.

    python3 art/audio/2026-09-25-reseed/rate.py --out art/audio/2026-09-25-reseed/rate.jpg

`rate.mjs` computes when "re-draw the whole wood" fired on journeys a player makes; it is a pure
function of the route. This draws them on a timeline against a call every 5.5 s, which is the
comparison that matters: a wood re-drawn more often than it speaks is not a wood with birds in it.
"""
import argparse
import math
import os

from PIL import Image, ImageDraw, ImageFont

R = 25.0
CALL_EVERY = 5.5


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def path_line(a, b, speed, secs, loop):
    dt = 1 / 30
    ln = math.hypot(b[0] - a[0], b[1] - a[1])
    out = []
    t = 0.0
    while t < secs:
        tr = (t * speed) / ln if ln else 0
        leg = tr % 2
        u = (leg if leg <= 1 else 2 - leg) if loop else min(1.0, tr)
        out.append((t, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
        t += dt
    return out


def fires(pts):
    ax, az = pts[0][1], pts[0][2]
    at = []
    for t, x, z in pts:
        if math.hypot(x - ax, z - az) > R:
            ax, az = x, z
            at.append(t)
    return at


JOURNEYS = [
    ('plaza to the log arch, run', path_line((0.5, 2), (4, -58), 4.2, 14.3, False)),
    ('pacing a 26 m line, run', path_line((0, 0), (26, 0), 4.2, 120, True)),
    ('pacing a 60 m line, run', path_line((0, 0), (60, 0), 4.2, 120, True)),
    ('pacing a 26 m line, walk', path_line((0, 0), (26, 0), 1.5, 120, True)),
    ('pacing a 21 m line, run', path_line((0, 0), (21, 0), 4.2, 120, True)),
    ('standing still', path_line((0, 0), (26, 0), 0, 120, True)),
]

ap = argparse.ArgumentParser()
ap.add_argument('--out', default='art/audio/2026-09-25-reseed/rate.jpg')
a = ap.parse_args()

W, H = 1180, 120 + 58 * len(JOURNEYS)
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
CALL, FIRE = (96, 104, 114), (226, 106, 106)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'The old rule: every mark is the whole wood \u2014 all six birds \u2014 re-drawn at once', font=f22, fill=INK)
d.text((28, 48), 'the grey ticks below each line are the rate the wood calls at, one every 5.5 s. Two minutes across.', font=f13, fill=DIM)
span = 120.0
x0, x1 = 450, W - 40
for i, (name, pts) in enumerate(JOURNEYS):
    y = 96 + i * 58
    secs = pts[-1][0]
    d.text((28, y - 8), name, font=f16, fill=INK)
    d.line([(x0, y), (x0 + (x1 - x0) * secs / span, y)], fill=(52, 58, 66), width=2)
    t = 0.0
    while t < secs:
        tx = x0 + (x1 - x0) * t / span
        d.line([(tx, y + 8), (tx, y + 14)], fill=CALL, width=1)
        t += CALL_EVERY
    at = fires(pts)
    for t in at:
        tx = x0 + (x1 - x0) * t / span
        d.line([(tx, y - 16), (tx, y + 4)], fill=FIRE, width=3)
    note = f'{len(at)} re-draws, {len(at) * 6} birds moved' if at else 'none'
    d.text((232, y - 7), note, font=f13, fill=FIRE if at else DIM)
d.text((28, H - 34), 'and now: a bird is retired on its own once it is more than 45 m behind, where its distance has already clamped and a swap cannot be heard.', font=f13, fill=(120, 214, 150))
im.save(a.out, quality=92)
print(f'wrote {a.out}')
