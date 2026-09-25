#!/usr/bin/env python3
"""sweep.py -- the wood turning under the listener.

    python3 art/audio/2026-09-25-facing/sweep.py --takes /tmp/turn \
        --out art/audio/2026-09-25-facing/facing.jpg

Two panels, because the claim has two halves and each alone can be faked.

The top is what `panFor` says: a source fixed due north, plotted against every heading the listener
can have. It has to be a sine through zero at north and south -- a stereo pan cannot tell front from
back, and pretending otherwise would be the wrong kind of confident -- and hard over at east and
west, mirrored about the turn. A sign error is a reflection of this curve and impossible to miss.

The bottom is what came out of the renderer: the short-term left-minus-right balance of four 75 s
takes from one spot, the same seed, differing only in which way he is facing. Nothing in the world
moved between them. If the panning were nailed to the speakers the four traces would lie on top of
each other, which is what "the bed is a pair of speakers" looks like when you draw it.
"""
import argparse
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FACINGS = [0, 90, 180, 270]
BG = (17, 19, 22)
GRID = (44, 48, 54)
INK = (236, 238, 240)
DIM = (140, 146, 154)
COLOURS = {0: (214, 162, 96), 90: (124, 196, 130), 180: (150, 170, 240), 270: (216, 132, 196)}


def _font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch) / 32768.0, sr


def balance(a, sr, win=0.5):
    """left minus right as a share of the whole, in short windows: where the image sits over time"""
    n = int(win * sr)
    m = len(a) // n
    L = np.sqrt((a[: m * n, 0].reshape(m, n) ** 2).mean(axis=1))
    R = np.sqrt((a[: m * n, 1].reshape(m, n) ** 2).mean(axis=1))
    return (L - R) / np.maximum(L + R, 1e-12)


def pan_for(heading_deg, to=(0.0, -1.0)):
    """the same arithmetic as `panFor` in ambience.ts, for the curve the code should trace"""
    th = np.radians(heading_deg)
    fx, fz = np.sin(th), np.cos(th)
    length = float(np.hypot(*to)) or 1.0
    return np.clip((to[0] * -fz + to[1] * fx) / length, -1, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/turn')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    W, H = 1280, 560
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'The wood turns under him', font=_font(21, True), fill=INK)
    d.text((18, 40), 'One spot on the north forest floor, one seed, four facings. Nothing in the world moves between the takes except which way he is looking.', font=_font(12), fill=DIM)

    # ---- top: the convention itself
    x0, x1, y0, y1 = 80, W - 300, 100, 250
    d.text((x0, y0 - 20), 'what panFor says: one bird due north, as he turns all the way round', font=_font(14, True), fill=INK)
    for v, lab in [(1, 'hard right'), (0, 'centre'), (-1, 'hard left')]:
        y = y0 + (y1 - y0) * (1 - v) / 2
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x1 + 10, y - 7), lab, font=_font(11), fill=(110, 116, 124))
    for deg in range(0, 361, 45):
        px = x0 + (x1 - x0) * deg / 360
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 10, y1 + 6), f'{deg}\u00b0', font=_font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 90, y1 + 24), 'the way he is facing (0\u00b0 = north, the bird)', font=_font(12), fill=DIM)
    pts = []
    for i in range(0, 361):
        px = x0 + (x1 - x0) * i / 360
        pts.append((px, y0 + (y1 - y0) * (1 - pan_for(i)) / 2))
    d.line(pts, fill=(236, 220, 150), width=2)
    for deg, note in [(0, 'facing north:\nthe bird is ahead'), (90, 'facing east:\nit is on his left'), (180, 'facing south:\nit is behind him'), (270, 'facing west:\nit is on his right')]:
        px = x0 + (x1 - x0) * deg / 360
        py = y0 + (y1 - y0) * (1 - pan_for(deg)) / 2
        d.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill=COLOURS[deg])
        d.multiline_text((px + 8, py - 16), note, font=_font(11), fill=COLOURS[deg])

    # ---- bottom: what the renderer produced
    bx0, bx1, by0, by1 = 80, W - 300, 340, 480
    d.text((bx0, by0 - 20), 'and what came out: the stereo balance of each take, 500 ms windows over 75 s', font=_font(14, True), fill=INK)
    for v, lab in [(0.4, 'left'), (0.0, ''), (-0.4, 'right')]:
        y = by0 + (by1 - by0) * (0.5 - v / 0.8 * 0.5)
        d.line([(bx0, y), (bx1, y)], fill=GRID)
        if lab:
            d.text((bx1 + 10, y - 7), lab, font=_font(11), fill=(110, 116, 124))
    means = {}
    for deg in FACINGS:
        a, sr = load(os.path.join(args.takes, f'facing-{deg}.wav'))
        b = balance(a, sr)
        means[deg] = float(np.mean(b))
        pts = [(bx0 + (bx1 - bx0) * i / len(b), by0 + (by1 - by0) * (0.5 - np.clip(v, -0.4, 0.4) / 0.8)) for i, v in enumerate(b)]
        d.line(pts, fill=COLOURS[deg], width=1)
    for i, deg in enumerate(FACINGS):
        d.text((bx1 + 60, by0 + 8 + i * 18), f'facing {deg}\u00b0: mean {means[deg]:+.3f}', font=_font(12, True), fill=COLOURS[deg])

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    d.text((18, H - 40), f'Turning right round mirrors the image: {means[0]:+.3f} against {means[180]:+.3f}, and {means[90]:+.3f} against {means[270]:+.3f}. That is the claim the bottom panel can carry \u2014 the scene is not symmetric, so there is no', font=_font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'absolute balance to expect from it. Which way round is right is the top panel\u2019s job, and the unit tests\u2019 (ambience.test.mjs: a bird due north is hard right facing west).', font=_font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)
    for deg in FACINGS:
        print(f'facing {deg:3d}\u00b0  mean balance {means[deg]:+.4f}   panFor(north) {pan_for(deg):+.3f}')


if __name__ == '__main__':
    main()
