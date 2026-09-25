#!/usr/bin/env python3
"""plot.py -- the voice count across a run that was hidden in the middle of it.

    python3 art/audio/2026-09-25-hidden/plot.py --runs /tmp/hidden2 /tmp/hidden-clamp \
        --labels "hidden, as this browser does it" "hidden, with a 1 s clamp imposed" \
        --out art/audio/2026-09-25-hidden/hidden.jpg

Every event in the bed builds a little chain of nodes and tears it down again through `cleanupAt`,
which is a `setTimeout`. The worry this answers is a leak that only happens when nobody is looking:
the events keep being scheduled at full rate, because `scheduleUntil` fills four seconds of AUDIO
time ahead and the AudioContext does not slow down for a hidden tab, while the timers that clean
them up are throttled. The line to look for is one that climbs across the shaded band and does not
come back down.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
BAND = (34, 38, 46)
COLOURS = [(124, 196, 130), (150, 170, 240), (214, 162, 96)]


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--runs', nargs='+', required=True)
    ap.add_argument('--labels', nargs='+', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'The voice count while nobody is looking', font=font(21, True), fill=INK)
    d.text((18, 40), 'Live audio, the tab put behind another one for the shaded stretch. Every leaf, bird, note and footstep builds a chain of nodes and tears it down on a timer.', font=font(12), fill=DIM)

    x0, x1, y0, y1 = 70, W - 330, 110, 350
    hi = 0
    runs = []
    for folder in args.runs:
        rows = json.load(open(os.path.join(folder, 'hidden.json')))['rows']
        t0 = rows[0]['wall']
        pts = [((r['wall'] - t0) / 1000, r['voices'], r['phase']) for r in rows]
        hi = max(hi, max(p[1] for p in pts))
        runs.append(pts)
    span = max(p[0] for r in runs for p in r)
    top = max(12, hi + 3)

    # the runs were hidden for different lengths, so each gets its own bar rather than one shared
    # band that would be a lie about whichever run it did not belong to
    hidden_spans = []
    for pts in runs:
        hs = [p[0] for p in pts if p[2] == 'hidden']
        hidden_spans.append((min(hs), max(hs)) if hs else (0, 0))
    lo = min(h[0] for h in hidden_spans)
    hi_s = max(h[1] for h in hidden_spans)
    d.rectangle([(x0 + (x1 - x0) * lo / span, y0), (x0 + (x1 - x0) * hi_s / span, y1)], fill=BAND)

    for v in range(0, int(top) + 1, 4):
        y = y1 - (y1 - y0) * v / top
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x0 - 24, y - 7), str(v), font=font(11), fill=(110, 116, 124))
    for s in range(0, int(span) + 1, 60):
        px = x0 + (x1 - x0) * s / span
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 10, y1 + 6), f'{s // 60}m', font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 60, y1 + 48), 'minutes into the run', font=font(12), fill=DIM)
    for i, (h0, h1) in enumerate(hidden_spans):
        yy = y1 + 22 + i * 11
        d.rectangle([(x0 + (x1 - x0) * h0 / span, yy), (x0 + (x1 - x0) * h1 / span, yy + 6)], fill=COLOURS[i % len(COLOURS)])
        d.text((x0 - 52, yy - 3), 'hidden', font=font(10), fill=COLOURS[i % len(COLOURS)])
    d.text((18, y0 - 18), 'live voices', font=font(12), fill=DIM)

    for i, (pts, label) in enumerate(zip(runs, args.labels)):
        colour = COLOURS[i % len(COLOURS)]
        line = [(x0 + (x1 - x0) * t / span, y1 - (y1 - y0) * v / top) for t, v, _ in pts]
        d.line(line, fill=colour, width=2)
        for p in line:
            d.ellipse([(p[0] - 2, p[1] - 2), (p[0] + 2, p[1] + 2)], fill=colour)
        vs = [v for _, v, _ in pts]
        d.text((x1 + 16, y0 + 8 + i * 34), label, font=font(12, True), fill=colour)
        d.text((x1 + 16, y0 + 24 + i * 34), f'{min(vs)}\u2013{max(vs)} voices, ends at {vs[-1]}', font=font(11), fill=colour)

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    d.text((18, H - 40), 'Neither line climbs. The audio clock ran at 100 % of real time throughout both, and there were no page errors in either.', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'The clamped run is the one that matters: this browser does not throttle a hidden tab\u2019s timers at all, so the clamp had to be imposed to test what a real one does.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
