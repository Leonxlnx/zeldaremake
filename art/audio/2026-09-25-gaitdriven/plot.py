#!/usr/bin/env python3
"""plot.py -- steps per metre against the frame rate, in play and on the bench.

    python3 art/audio/2026-09-25-gaitdriven/plot.py --play /tmp/gaitrate/gaitrate.json \
        --pre /tmp/gaitrate-pre103/gaitrate.json --bench art/audio/2026-09-25-tickrate/before.json \
        --benchafter art/audio/2026-09-25-tickrate/after.json --out gaitdriven.jpg

Three lines for one number, and the point is how far apart two of them are.

The bench drives `createFootsteps` directly with no character system, which is what an offline
render does and what PR #103 measured. In PLAY the character system publishes stance flags and the
steps come from those instead — all 53 of a run's, 26 of a walk's 28 — so the integrator #103 fixed
is a fallback that barely runs.

Which means #103's headline was about the wrong thing, and this is the correction.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
PLAY, PRE, BENCH, BENCHA = (124, 196, 130), (150, 170, 240), (214, 132, 96), (228, 206, 128)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--play', required=True)
    ap.add_argument('--pre', required=True)
    ap.add_argument('--bench', required=True)
    ap.add_argument('--benchafter', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    play = json.load(open(args.play))['rows']
    pre = json.load(open(args.pre))['rows']
    bench = json.load(open(args.bench))
    bencha = json.load(open(args.benchafter))

    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'The steps a player hears never came from the thing I fixed', font=font(21, True), fill=INK)
    d.text((18, 40), 'Steps per metre at a run, against the frame rate. A stride is a distance, so a flat line is the right answer and a sagging one is dropped steps.', font=font(12), fill=DIM)

    x0, x1, y0, y1 = 90, W - 320, 106, 370
    want = 1 / 0.91
    top, bot = want * 1.12, want * 0.55
    lo, hi = np.log10(8), np.log10(260)
    for v in np.linspace(bot, top, 6):
        y = y1 - (y1 - y0) * (v - bot) / (top - bot)
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x0 - 34, y - 7), f'{v:.2f}', font=font(11), fill=(110, 116, 124))
    for ms in (8, 16, 33, 50, 67, 100, 167, 250):
        px = x0 + (x1 - x0) * (np.log10(ms) - lo) / (hi - lo)
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 10, y1 + 6), f'{ms}', font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 86, y1 + 26), 'tick / frame time (ms)', font=font(12), fill=DIM)
    d.text((18, y0 - 18), 'steps per metre', font=font(12), fill=DIM)
    y = y1 - (y1 - y0) * (want - bot) / (top - bot)
    d.line([(x0, y), (x1, y)], fill=(90, 96, 106), width=2)
    d.text((x0 + 6, y - 15), f'what a stride says: {want:.2f}', font=font(11), fill=(130, 138, 150))

    def draw(points, colour, label, note, i):
        pts = []
        for ms, v in points:
            if not (10**lo <= ms <= 10**hi):
                continue
            px = x0 + (x1 - x0) * (np.log10(ms) - lo) / (hi - lo)
            pts.append((px, y1 - (y1 - y0) * (np.clip(v, bot, top) - bot) / (top - bot)))
        d.line(pts, fill=colour, width=2)
        for p in pts:
            d.ellipse([(p[0] - 3, p[1] - 3), (p[0] + 3, p[1] + 3)], fill=colour)
        d.text((x1 + 14, y0 + 8 + i * 42), label, font=font(12, True), fill=colour)
        d.text((x1 + 14, y0 + 24 + i * 42), note, font=font(11), fill=colour)

    runs = lambda rows: [(r['dt'] * 1000, r['perMetre']) for r in rows if r['gait'] == 'run' and r['perMetre']]
    draw([(r['dt'] * 1000, r['perMetre']) for r in bench['run']['rows']], BENCH, 'the bench, before #103', 'no character system', 0)
    draw([(r['dt'] * 1000, r['perMetre']) for r in bencha['run']['rows']], BENCHA, 'the bench, after #103', 'what #103 measured', 1)
    draw(runs(pre), PRE, 'in play, before #103', 'the gait drives it', 2)
    draw(runs(play), PLAY, 'in play, after #103', 'the same line', 3)

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    d.text((18, H - 40), '#103 said "one step in fifteen never sounded". True of every offline render this lane makes, and not of the game: in play the character system fires the steps and the', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'integrator it fixed is a fallback that barely runs. The two play lines are on top of each other \u2014 and flat from 60 fps to 15, which is the thing check 28 actually asks.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
