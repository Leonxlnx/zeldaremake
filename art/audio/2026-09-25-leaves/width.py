#!/usr/bin/env python3
"""width.py -- how wide the leaves sit, and how far out the widest of them goes.

    python3 art/audio/2026-09-25-leaves/width.py --takes /tmp/leaves \
        --out art/audio/2026-09-25-leaves/width.jpg

A leaf flutter is a short band of the bed's own noise at 950-2850 Hz, and `scheduleFlutters` gives
each group a pan drawn uniformly over +/-0.9 with a further +/-0.15 per leaf in the group -- so a
leaf can land at +/-1.0, hard against a speaker, which is exactly what `PERCH_PAN` forbids a bird
from doing and says why: "a call hard against one channel does not read as 'over there', it reads
as a fault in the mix".

Measured out of the file rather than off the constants, because what matters is where the leaves
actually land in the stereo field:

  frames   short-time frames where the flutter band stands over its own quiet level, i.e. a leaf
  pan      the equal-power pan each of those implies, after the steady bed under it is taken off
  width    the 90th percentile of |pan| -- how far out the wood's leaves habitually go
  hardest  the widest single frame in two minutes

The two places are chosen because the canopy term tells them apart: leaves overhead in one, a ring
of trees round an open sky in the other.
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BAND = (900, 3500)
WIN, HOP = 0.03, 0.01


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read_stereo(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    x = x.reshape(-1, ch)
    return x[:, 0], x[:, 1], rate


def band_power(x, rate):
    n = int(round(WIN * rate))
    n += n % 2
    step = int(round(HOP * rate))
    w = np.hanning(n)
    frames = 1 + max(0, len(x) - n) // step
    idx = np.arange(n)[None, :] + step * np.arange(frames)[:, None]
    spec = np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2
    f = np.fft.rfftfreq(n, 1 / rate)
    return spec[:, (f >= BAND[0]) & (f < BAND[1])].sum(axis=1)


def pans(path, over_db=9.0):
    """the pan of every frame in which something is happening in the leaf band"""
    l, r, rate = read_stereo(path)
    lp, rp = band_power(l, rate), band_power(r, rate)
    tot = lp + rp
    # the quiet level of the band is the bed with no event in it; anything well over that is one
    floor = np.percentile(tot, 20)
    bedl, bedr = np.percentile(lp, 20), np.percentile(rp, 20)
    sel = tot > floor * 10 ** (over_db / 10)
    out = []
    for i in np.flatnonzero(sel):
        dl, dr = lp[i] - bedl, rp[i] - bedr
        if dl <= 0 or dr <= 0:
            continue
        out.append(4 / math.pi * math.atan(math.sqrt(dr / dl)) - 1)
    return np.array(out)


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/leaves')
ap.add_argument('--before', default='/tmp/leaves-before', help='where scheduled.mjs wrote the old build\'s pans')
ap.add_argument('--out', default='')
a = ap.parse_args()

rows = []
for tag in ('before', 'after'):
    p = os.path.join(a.takes, f'takes-{tag}.json')
    if not os.path.exists(p):
        continue
    meta = json.load(open(p))
    for s in meta['spots']:
        v = pans(os.path.join(a.takes, f"{s['id']}-{tag}.wav"))
        if len(v) < 20:
            continue
        rows.append(
            {
                'tag': tag,
                'id': s['id'],
                'note': s['note'],
                'n': len(v),
                'flutters': s['flutters'],
                'median': float(np.median(np.abs(v))),
                'width': float(np.percentile(np.abs(v), 90)),
                'hardest': float(np.max(np.abs(v))),
                'v': v,
            }
        )

print(f"{'take':18} {'frames':>6} {'flutters':>8}   {'median |pan|':>12} {'width (p90)':>12} {'hardest':>8}")
for r in rows:
    print(f"{r['tag'] + ' ' + r['id']:18} {r['n']:>6} {r['flutters']:>8}   {r['median']:>12.3f} {r['width']:>12.3f} {r['hardest']:>8.3f}")
open_before = next((r for r in rows if r['tag'] == 'before' and r['id'] == 'open'), None)
crowns_before = next((r for r in rows if r['tag'] == 'before' and r['id'] == 'crowns'), None)
if open_before and crowns_before:
    print(f"\nopen against crowns, before: width {open_before['width']:.3f} vs {crowns_before['width']:.3f} — {abs(open_before['width'] - crowns_before['width']):.3f} apart")


# ---- and what the bed HANDS OUT, from scheduled.mjs, which the file cannot show ----------------
sched = {}
for tag, d in (('before', a.before), ('after', a.takes)):
    p = os.path.join(d, 'scheduled.json')
    if os.path.exists(p):
        sched[tag] = json.load(open(p))
if sched:
    print('\nand what the bed hands out, read off the graph rather than the file:')
    print(f"{'take':18} {'voices':>6}   {'width (p90)':>12} {'hardest':>8}")
    for tag in ('before', 'after'):
        if tag not in sched:
            continue
        for place in ('open', 'crowns'):
            v = np.abs(np.array(sched[tag][place]))
            print(f"{tag + ' ' + place:18} {len(v):>6}   {np.percentile(v, 90):>12.3f} {v.max():>8.3f}")
    print(f"a bird is capped at PERCH_PAN = {sched['after']['perchPan']}")
if not a.out or not sched:
    raise SystemExit(0)

# the figure is the GRAPH, not the file: the file cannot resolve the flutters and says so above
panes = [(tag, place) for tag in ('before', 'after') for place in ('open', 'crowns')]
W, H = 1080, 150 + 130 * len(panes)
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
COL = {'before': (226, 106, 106), 'after': (120, 214, 150)}
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'Where the bed puts its leaves: every pan it hands out in a minute of standing still', font=f22, fill=INK)
d.text((28, 48), 'the gold lines are PERCH_PAN, where a bird \u2014 a point source \u2014 is not allowed past. A leaf is the most diffuse thing in this bed.', font=f13, fill=DIM)
d.text((28, 66), 'the same change is not measurable in the rendered file, and the table above says why: the loud moments in the leaf band are birds.', font=f13, fill=DIM)
for i, (tag, place) in enumerate(panes):
    y0 = 108 + i * 130
    y1 = y0 + 84
    x0, x1 = 60, W - 60
    cx = (x0 + x1) / 2
    d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
    d.line([(cx, y0), (cx, y1)], fill=(38, 42, 48))
    pp = sched[tag]['perchPan']
    for sgn in (-pp, pp):
        gx = cx + (x1 - x0) / 2 * sgn
        d.line([(gx, y0), (gx, y1)], fill=(244, 214, 120), width=1)
    v = np.array(sched[tag][place])
    hist, _ = np.histogram(v, bins=81, range=(-1, 1))
    top = max(1, hist.max())
    for k, h in enumerate(hist):
        bx = x0 + (x1 - x0) * (k + 0.5) / len(hist)
        d.line([(bx, y1 - 2), (bx, y1 - 2 - (y1 - y0 - 6) * h / top)], fill=COL[tag], width=6)
    w90 = float(np.percentile(np.abs(v), 90))
    d.text((x0, y0 - 20), f"{tag} \u2014 {place}: width (p90) {w90:.3f}, hardest {np.abs(v).max():.3f}", font=f16, fill=COL[tag])
    d.text((x0, y1 + 4), 'hard left', font=f13, fill=DIM)
    d.text((x1 - 60, y1 + 4), 'hard right', font=f13, fill=DIM)
im.save(a.out, quality=92)
print(f'wrote {a.out}')
