#!/usr/bin/env python3
"""plot.py -- what the audio costs: the render's wall clock, and the graph's size under load.

    python3 art/audio/2026-09-25-cost/plot.py --before /tmp/cost/cost.json \
        --after after.json --out art/audio/2026-09-25-cost/cost.jpg

Two panels for two different questions that check 49 rolls into one.

Left: how long the renderer takes. Not the audio thread — an offline render has no callback deadline
— but it is the same graph, and a graph whose cost grows as the square of the take is one that is
keeping things it should have thrown away.

Right: how many voices are alive while the worst case is happening. This IS the live graph, and it
is the closest thing to the audio thread's load that a box without `AudioContext.renderCapacity`
can produce.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
BEFORE, AFTER, LINE = (214, 162, 96), (124, 196, 130), (150, 170, 240)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True, help='json of {stem: {seconds: wallMs}}')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    before = json.load(open(args.before))
    after = json.load(open(args.after))
    bw = {(r['stem'], r['seconds']): r['wallMs'] / 1000 for r in before['render']}
    aw = {(k, int(s)): v for k, d in after['render'].items() for s, v in d.items()}
    worst = before['worst']

    W, H = 1280, 480
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'What the audio costs', font=font(21, True), fill=INK)
    d.text((18, 40), 'Left: seconds of wall clock to render two minutes of audio. Right: voices alive while running and jumping under the lantern bough with the score playing.', font=font(12), fill=DIM)

    # ---- left: render time for 120 s
    stems = ['bed', 'steps', 'mix']
    x0, x1, y0 = 150, 560, 110
    top = max(max(bw.get((s, 120), 0) for s in stems), max(aw.get((s, 120), 0) for s in stems)) * 1.1
    d.text((60, y0 - 22), 'to render 120 s of audio', font=font(14, True), fill=INK)
    for v in range(0, int(top) + 1, 100):
        px = x0 + (x1 - x0) * v / top
        d.line([(px, y0), (px, y0 + 190)], fill=GRID)
        d.text((px - 10, y0 + 194), f'{v}', font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 40, y0 + 214), 'seconds', font=font(12), fill=DIM)
    y = y0 + 8
    for s in stems:
        d.text((60, y + 10), s, font=font(12, True), fill=INK)
        for i, (src, colour, lab) in enumerate([(bw, BEFORE, 'before'), (aw, AFTER, 'after')]):
            v = src.get((s, 120), 0)
            px = x0 + (x1 - x0) * v / top
            d.rectangle([(x0, y + i * 17), (px, y + i * 17 + 13)], fill=colour)
            d.text((px + 5, y + i * 17), f'{v:.0f}s', font=font(11, True), fill=colour)
        y += 58
    d.text((60, y0 + 172), 'before', font=font(11, True), fill=BEFORE)
    d.text((105, y0 + 172), 'after', font=font(11, True), fill=AFTER)

    # ---- right: voices under the worst case
    vx0, vx1, vy0, vy1 = 700, W - 60, 110, 300
    v = [s['voices'] for s in worst['samples']]
    vtop = max(20, max(v) + 4)
    d.text((640, vy0 - 22), 'live voices under the worst case', font=font(14, True), fill=INK)
    for t in range(0, int(vtop) + 1, 5):
        yy = vy1 - (vy1 - vy0) * t / vtop
        d.line([(vx0, yy), (vx1, yy)], fill=GRID)
        d.text((vx0 - 22, yy - 7), str(t), font=font(11), fill=(110, 116, 124))
    for s in range(0, worst['seconds'] + 1, 10):
        px = vx0 + (vx1 - vx0) * s / worst['seconds']
        d.line([(px, vy0), (px, vy1)], fill=GRID)
        d.text((px - 6, vy1 + 6), str(s), font=font(11), fill=(110, 116, 124))
    d.text(((vx0 + vx1) / 2 - 22, vy1 + 26), 'seconds', font=font(12), fill=DIM)
    pts = [(vx0 + (vx1 - vx0) * s['at'] / (worst['seconds'] * 1000), vy1 - (vy1 - vy0) * s['voices'] / vtop) for s in worst['samples']]
    d.line(pts, fill=LINE, width=2)
    d.text((vx0 + 8, vy0 + 4), f'{min(v)}\u2013{max(v)}, median {int(np.median(v))}', font=font(12, True), fill=LINE)
    d.text((vx0 + 8, vy0 + 22), f'{worst["steps"]} steps, {worst["landings"]} landings, {worst["pushOffs"]} shoves, {worst["pods"]} pods', font=font(11), fill=DIM)

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    d.text((18, H - 40), f'The renderer was keeping every node any event had ever built: cleanup took an early return offline, so nothing was disconnected until the render ended. The mix now takes {aw.get(("mix", 120), 0):.0f} s against {bw.get(("mix", 120), 0):.0f}.', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), f'The live graph was never the problem \u2014 {min(v)} to {max(v)} voices through the worst case the headroom was sized against, which is the band ordinary play already used.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
