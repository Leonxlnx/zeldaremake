#!/usr/bin/env python3
"""rate.py -- steps per metre against the tick, before and after.

    python3 art/audio/2026-09-25-tickrate/rate.py --before before.json --after after.json \
        --out art/audio/2026-09-25-tickrate/tickrate.jpg

`cadence.mjs --json` writes what it measured; this draws it. A stride is a distance, so the line
that matters is flat: however often the audio is asked, he takes the same number of steps to cross
the same ground. The dashed line is the ceiling of one step per tick, which is arithmetic rather
than a fault — a run needs five steps a second and no design can deliver them from a timer that
fires four times.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
BEFORE, AFTER, CEIL = (214, 162, 96), (124, 196, 130), (150, 130, 180)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    data = {t: json.load(open(f)) for t, f in [('before', args.before), ('after', args.after)]}

    W, H = 1280, 480
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'He took fewer steps when the box was busy', font=font(21, True), fill=INK)
    d.text((18, 40), 'Steps per metre against how often the audio is asked. A stride is a distance, so this line has to be flat \u2014 the tick rate is not supposed to be able to move it.', font=font(12), fill=DIM)

    panels = [('walk', 70, 'a walk, 1.6 m/s'), ('run', 700, 'a run, 4.6 m/s')]
    for gait, x0, title in panels:
        x1 = x0 + 470
        y0, y1 = 110, 380
        want = data['before'][gait]['want']
        top, bot = want * 1.15, 0.0
        d.text((x0, y0 - 22), title, font=font(14, True), fill=INK)
        for v in np.linspace(0, top, 6):
            y = y1 - (y1 - y0) * v / top
            d.line([(x0, y), (x1, y)], fill=GRID)
            d.text((x0 - 32, y - 7), f'{v:.1f}', font=font(11), fill=(110, 116, 124))
        ticks = [r['dt'] for r in data['before'][gait]['rows']]
        lo, hi = np.log10(min(ticks) * 1000), np.log10(max(ticks) * 1000)
        for ms in (8, 16, 33, 67, 125, 250, 500, 1000):
            if not (10**lo <= ms <= 10**hi):
                continue
            px = x0 + (x1 - x0) * (np.log10(ms) - lo) / (hi - lo)
            d.line([(px, y0), (px, y1)], fill=GRID)
            d.text((px - 10, y1 + 6), f'{ms}', font=font(11), fill=(110, 116, 124))
        d.text(((x0 + x1) / 2 - 46, y1 + 26), 'tick (ms)', font=font(12), fill=DIM)
        # what a stride says it should be
        y = y1 - (y1 - y0) * want / top
        d.line([(x0, y), (x1, y)], fill=(90, 96, 106), width=2)
        d.text((x0 + 6, y - 15), f'what a stride says: {want:.2f}', font=font(11), fill=(130, 138, 150))
        # the one-step-per-tick ceiling
        pts = []
        for r in data['before'][gait]['rows']:
            v = min(top, (1 / r['dt']) / data['before'][gait]['speed'])
            px = x0 + (x1 - x0) * (np.log10(r['dt'] * 1000) - lo) / (hi - lo)
            pts.append((px, y1 - (y1 - y0) * v / top))
        for i in range(0, len(pts) - 1, 2):
            d.line([pts[i], pts[i + 1]], fill=CEIL, width=1)
        d.text((x1 - 150, y0 + 6), 'one step per tick', font=font(11, True), fill=CEIL)
        for tag, colour in [('before', BEFORE), ('after', AFTER)]:
            rows = data[tag][gait]['rows']
            line = []
            for r in rows:
                px = x0 + (x1 - x0) * (np.log10(r['dt'] * 1000) - lo) / (hi - lo)
                line.append((px, y1 - (y1 - y0) * min(r['perMetre'], top) / top))
            d.line(line, fill=colour, width=2)
            for p in line:
                d.ellipse([(p[0] - 3, p[1] - 3), (p[0] + 3, p[1] + 3)], fill=colour)
        d.text((x0 + 6, y0 + 4), 'before', font=font(12, True), fill=BEFORE)
        d.text((x0 + 60, y0 + 4), 'after', font=font(12, True), fill=AFTER)

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    w = {r['dt']: r['perMetre'] for r in data['before']['walk']['rows']}
    wa = {r['dt']: r['perMetre'] for r in data['after']['walk']['rows']}
    want = data['before']['walk']['want']
    d.text((18, H - 40), f'At the 33 ms tick the game actually runs, a walk lost {(1 - w[1 / 30] / want) * 100:.0f} % of its steps and now loses {(1 - wa[1 / 30] / want) * 100:.0f} %. The cause was one line: firing a step reset the distance', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'integrator to zero instead of carrying the overshoot, so every step threw away however far he had gone past the trigger \u2014 half a tick\u2019s worth, every time.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
