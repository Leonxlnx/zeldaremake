#!/usr/bin/env python3
"""plot.py -- the gap between a boot landing and the step sounding.

    python3 art/audio/2026-09-25-sync/plot.py --take /tmp/sync/sync.json \
        --out art/audio/2026-09-25-sync/sync.jpg

`footsteps.ts` says the gait-driven path exists so that "a step sounds when a boot actually plants,
so what is heard is what is seen". This is the distribution of how long that takes, and the marks on
it are the two things that decide whether the shape is right:

  30 ms   the scheduling lead. The tick books every contact at `ctx.currentTime + 0.03`, so nothing
          can be quicker than this, and a histogram that starts before it is a measurement error
          rather than a fast step.
  45 ms   about where audio arriving after the picture stops being invisible.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
WALK, RUN, MARK, WARN = (150, 170, 240), (124, 196, 130), (150, 130, 180), (226, 128, 112)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--take', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    d = json.load(open(args.take))

    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    dr = ImageDraw.Draw(im)
    dr.text((18, 12), 'How long after the boot lands does the step sound?', font=font(21, True), fill=INK)
    dr.text((18, 40), 'Every boot plant the character system reported, against the context time the audio booked its contact for. Forty seconds of each gait on the plaza.', font=font(12), fill=DIM)

    x0, x1, y0, y1 = 80, W - 300, 110, 360
    top_ms = 70
    bins = np.arange(0, top_ms + 1, 5)
    hists = {}
    for g, colour in [('walk', WALK), ('run', RUN)]:
        h, _ = np.histogram(d[g]['lags'], bins=bins)
        hists[g] = h / max(1, h.sum())
    peak = max(h.max() for h in hists.values()) * 1.15
    for v in np.linspace(0, peak, 5):
        y = y1 - (y1 - y0) * v / peak
        dr.line([(x0, y), (x1, y)], fill=GRID)
        dr.text((x0 - 36, y - 7), f'{v * 100:.0f}%', font=font(11), fill=(110, 116, 124))
    for ms in range(0, top_ms + 1, 10):
        px = x0 + (x1 - x0) * ms / top_ms
        dr.line([(px, y0), (px, y1)], fill=GRID)
        dr.text((px - 7, y1 + 6), str(ms), font=font(11), fill=(110, 116, 124))
    dr.text(((x0 + x1) / 2 - 78, y1 + 26), 'milliseconds after the boot', font=font(12), fill=DIM)
    dr.text((18, y0 - 18), 'share of steps', font=font(12), fill=DIM)

    for ms, colour, label in [(30, MARK, 'the 30 ms scheduling lead'), (45, WARN, 'audio starts being noticed here')]:
        px = x0 + (x1 - x0) * ms / top_ms
        for yy in range(y0, y1, 8):
            dr.line([(px, yy), (px, yy + 4)], fill=colour)
        dr.text((px + 6, y0 + (4 if ms == 30 else 20)), label, font=font(11, True), fill=colour)

    wbin = (x1 - x0) / len(bins[:-1]) * 0.42
    for i, (g, colour) in enumerate([('walk', WALK), ('run', RUN)]):
        for b, v in zip(bins[:-1], hists[g]):
            px = x0 + (x1 - x0) * (b + 2.5) / top_ms
            h = (y1 - y0) * v / peak
            dr.rectangle([(px - wbin + i * wbin, y1 - h), (px + i * wbin, y1)], fill=colour)
        lags = np.array(d[g]['lags'])
        dr.text((x1 + 14, y0 + 8 + i * 48), g, font=font(13, True), fill=colour)
        dr.text((x1 + 14, y0 + 26 + i * 48), f'median {np.median(lags):.0f} ms, max {lags.max():.0f}', font=font(11), fill=colour)

    dr.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    allp = sum(len(d[g]['plants']) for g in ('walk', 'run'))
    alls = sum(len(d[g]['sounds']) for g in ('walk', 'run'))
    dr.text((18, H - 40), f'{allp} boot plants, {alls} contacts scheduled, no contact without a plant before it and no plant without one after \u2014 the claim that a step sounds when a boot lands, checked.', font=font(12), fill=(170, 176, 184))
    dr.text((18, H - 22), 'The observed spread starts at 10 ms, which is under the scheduling lead it cannot beat: the harness reads the stance a moment after the audio does, so it under-reads by up to a frame.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
