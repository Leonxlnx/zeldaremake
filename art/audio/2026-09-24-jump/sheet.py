#!/usr/bin/env python3
"""sheet.py — the take-off, before and after, with the four jumps stacked on the moment he leaves.

    python3 art/audio/2026-09-24-jump/sheet.py --before /tmp/jump --after /tmp/jump-a2 \
        --out art/audio/2026-09-24-jump/jump-before-after.jpg

Both takes run the same script: stand, walk the flagstones, then four jumps from a standstill. A
single 20 s envelope is unreadable for this — the event is a few decibels inside a wind bed that
moves by more than that on its own — so each jump is cut out and aligned on the instant the arc
leaves the ground (the probe samples `airHeight()` alongside the recording), the four are drawn
faintly and their mean boldly, and both takes share one scale.

t = 0 is the take-off. The grey band is the airborne window; its right edge is the landing.
"""
import argparse
import json
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG = (17, 19, 22)
GRID = (46, 50, 56)
AIR = (34, 41, 52)
INK = (236, 238, 240)
FAINT = (118, 98, 60)
TRACE = (244, 200, 116)
BEDLINE = (120, 132, 148)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def envelope(path, win=0.02):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        a = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64).reshape(-1, ch) / 32768.0
    x = a.mean(axis=1)
    k = int(win * sr)
    f = len(x) // k
    e = np.sqrt((x[: f * k].reshape(f, k) ** 2).mean(axis=1))
    return np.arange(f) * win, 20 * np.log10(np.maximum(e, 1e-9)), win


def jumps(root, pre=0.4, post=0.9):
    """each jump's envelope with t = 0 at the take-off, plus the airborne window"""
    te, e, win = envelope(os.path.join(root, 'jump.wav'))
    s = json.load(open(os.path.join(root, 'samples.json')))
    smp = np.array(s['samples'])
    ts, air = smp[:, 0], smp[:, 1]
    rel = np.arange(-pre, post, win)
    out, airs = [], []
    for j in s['jumps']:
        seg = (ts >= j - 0.3) & (ts <= j + 1.2)
        up = ts[seg][air[seg] > 0.02]
        if not len(up):
            continue
        out.append(np.interp(up[0] + rel, te, e))
        airs.append((0.0, up[-1] - up[0]))
    return rel, np.array(out), airs


def strip(args):
    """one take's envelope across a time window, wide — the background a clip video sweeps"""
    te, e, _ = envelope(os.path.join(args.strip, 'jump.wav'))
    s = json.load(open(os.path.join(args.strip, 'samples.json')))
    smp = np.array(s['samples'])
    ts, air = smp[:, 0], smp[:, 1]
    W, H = args.width, 380
    top, bot = -26, -54
    x0, x1, y0, y1 = 16, W - 16, 96, H - 40
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    px = lambda t: x0 + (x1 - x0) * (t - args.t0) / (args.t1 - args.t0)
    py = lambda v: y1 - (y1 - y0) * (np.clip(v, bot, top) - bot) / (top - bot)
    up = air > 0.02
    i = 0
    while i < len(up):
        if up[i]:
            j = i
            while j + 1 < len(up) and up[j + 1]:
                j += 1
            d.rectangle([px(ts[i]), y0 + 1, px(ts[j]), y1 - 1], fill=AIR)
            i = j
        i += 1
    d.rectangle((x0, y0, x1, y1), outline=GRID)
    for v in range(bot + 4, top, 6):
        d.line([(x0, py(v)), (x1, py(v))], fill=GRID)
        d.text((x0 + 5, py(v) - 15), f'{v}', font=font(13), fill=(112, 118, 126))
    seg = (te >= args.t0) & (te <= args.t1)
    d.line([(px(t), py(v)) for t, v in zip(te[seg], e[seg])], fill=TRACE, width=2)
    d.text((18, 18), args.label, font=font(23, True), fill=INK)
    d.text((18, 50), 'live master, 20 ms envelope in dBFS; the shaded bands are the four jump arcs - he is off the ground inside them', font=font(15), fill=(140, 146, 154))
    im.save(args.out, quality=95)
    print('wrote', args.out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before')
    ap.add_argument('--after')
    ap.add_argument('--strip', help='render one take across a window instead of the stacked pair')
    ap.add_argument('--label', default='')
    ap.add_argument('--from', dest='t0', type=float, default=3.2)
    ap.add_argument('--to', dest='t1', type=float, default=14.0)
    ap.add_argument('--width', type=int, default=1560)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    if args.strip:
        return strip(args)

    takes = [('before — nothing happens when he leaves the ground', args.before), ('after — the shove', args.after)]
    data = [(label, *jumps(root)) for label, root in takes]
    top = round(max(float(np.percentile(d[2], 99)) for d in data) + 2)
    bot = top - 26

    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 14), 'Leaving the ground: the four jumps of one take, aligned on the instant the arc lifts.', font=font(20, True), fill=INK)
    d.text((18, 42), 'Live master, 20 ms envelope in dBFS. Faint = each jump, bold = their mean. The grey band is the airborne window; its right edge is the landing.', font=font(13), fill=(140, 146, 154))

    pw = (W - 46) // 2
    for col, (label, rel, curves, airs) in enumerate(data):
        x0 = 18 + col * (pw + 10)
        x1 = x0 + pw
        y0, y1 = 96, 430
        px = lambda t: x0 + (x1 - x0) * (t - rel[0]) / (rel[-1] - rel[0])
        py = lambda v: y1 - (y1 - y0) * (np.clip(v, bot, top) - bot) / (top - bot)
        d.rectangle([px(0), y0 + 1, px(float(np.mean([a[1] for a in airs]))), y1 - 1], fill=AIR)
        d.rectangle((x0, y0, x1, y1), outline=GRID)
        for v in range(int(bot) + 5 - int(bot) % 5, int(top), 5):
            d.line([(x0, py(v)), (x1, py(v))], fill=GRID)
            d.text((x0 + 5, py(v) - 14), f'{v}', font=font(12), fill=(112, 118, 126))
        for t in np.arange(-0.4, 0.91, 0.2):
            d.line([(px(t), y0), (px(t), y1)], fill=GRID)
            d.text((px(t) - 10, y1 + 4), f'{t:+.1f}', font=font(11), fill=(112, 118, 126))
        # the bed this jump started from, as a reference line
        bed = float(np.median(curves[:, rel < -0.1]))
        d.line([(x0, py(bed)), (x1, py(bed))], fill=BEDLINE)
        d.text((x1 - 152, py(bed) - 15), f'the bed here: {bed:.0f} dB', font=font(12), fill=BEDLINE)
        for c in curves:
            d.line([(px(t), py(v)) for t, v in zip(rel, c)], fill=FAINT, width=1)
        mean = curves.mean(axis=0)
        d.line([(px(t), py(v)) for t, v in zip(rel, mean)], fill=TRACE, width=3)
        peak = float(mean[(rel >= -0.08) & (rel < 0.32)].max())
        d.line([(px(-0.08), py(peak)), (px(0.32), py(peak))], fill=TRACE)
        d.text((px(0.02), py(peak) - 17), f'take-off {peak:.0f} dB ({peak - bed:+.1f})', font=font(13, True), fill=TRACE)
        # the four on their own: scatter is the tell. Before, one of them is BELOW the bed — that
        # spread is the wind wandering, not an event.
        each = ' '.join(f'{float(c[(rel >= -0.08) & (rel < 0.32)].max()) - bed:+.1f}' for c in curves)
        d.text((x0 + 6, y1 - 20), f'each jump, over the bed:  {each}', font=font(13), fill=TRACE)
        d.text((x0 + 2, y0 - 19), label, font=font(15), fill=INK)
    d.text((18, 446), 'seconds from take-off', font=font(12), fill=(112, 118, 126))
    im.save(args.out, quality=93)
    print('wrote', args.out, f'({top} … {bot} dBFS)')


if __name__ == '__main__':
    main()
