#!/usr/bin/env python3
"""bands.py -- what a wall takes off the forest, band by band.

    python3 art/audio/2026-09-24-indoors/bands.py --takes /tmp/indoors \
        --out art/audio/2026-09-24-indoors/indoors.jpg

Each pair is two 90 s renders of the bed alone, from the middle of a room and from a spot on the
deck outside its door. Nothing differs between the two but where the listener stands, so the
difference between them is the wall -- and because a wall is a filter and not a fader, the
interesting number is not one level but five. A fader moves every band by the same amount; planks
take the top off and leave the body, and the sheet has to be able to show which of those happened.

The sheet draws two rooms, not one, because they are not the same experiment. `where.mjs` prints
what `surfaceAt` hands the bed at each spot: the west house stands under open sky (canopy 0.00) and
the grove's huts stand under a closed one (canopy 1.00). A roof is also a low-pass, so the grove's
wall has much less top left to take than the west house's does. Showing only one of them would make
the change look either stronger or weaker than it is, depending which.

Levels are band RMS over the whole 90 s in dBFS. Two guards on reading them:

  * the renders are 16-bit, so each band has a floor -- drawn as a tick. A bar standing on its tick
    is not a measurement of the bed, it is the file's own noise, and the sheet marks that difference
    with a "<=" because the real one can only be larger.
  * 90 s of gusts and birds settles these to a few tenths. The first decimal is real, the second is
    not, so the sheet rounds to whole decibels.
"""
import argparse
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '2026-09-23-lane5'))
from spectra import load, mono  # noqa: E402

BANDS = [('500 Hz - 1 kHz', 500, 1000), ('1 - 2 kHz', 1000, 2000), ('2 - 4 kHz', 2000, 4000), ('4 - 8 kHz', 4000, 8000), ('8 - 16 kHz', 8000, 16000)]
# a stretch of spectrum the bed never reaches, used to read each file's own noise floor
EMPTY = (16000, 20000)

BG = (17, 19, 22)
GRID = (44, 48, 54)
INK = (236, 238, 240)
DIM = (140, 146, 154)
FLOOR = (186, 148, 214)
OUT = (214, 162, 96)
IN = (124, 196, 130)


def _font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def band_db(x, sr, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    X[(f < lo) | (f >= hi)] = 0
    y = np.fft.irfft(X, len(x))
    return 20 * np.log10(max(float(np.sqrt(np.mean(y.astype(np.float64) ** 2))), 1e-14))


def measure(takes, pair):
    """[(band, outside dB, inside dB, this band's floor dB)], 'overall' first"""
    a, sr = load(os.path.join(takes, f'{pair}-out.wav'))
    b, _ = load(os.path.join(takes, f'{pair}-in.wav'))
    xa, xb = mono(a), mono(b)
    # the floor is flat per hertz, so scale the empty band's level by each band's width
    density = max(band_db(xa, sr, *EMPTY), band_db(xb, sr, *EMPTY)) - 10 * math.log10(EMPTY[1] - EMPTY[0])
    rms = lambda v: 20 * np.log10(max(float(np.sqrt(np.mean(v.astype(np.float64) ** 2))), 1e-14))
    rows = [('overall', rms(xa), rms(xb), density + 10 * math.log10(sr / 2))]
    for name, lo, hi in BANDS:
        rows.append((name, band_db(xa, sr, lo, hi), band_db(xb, sr, lo, hi), density + 10 * math.log10(hi - lo)))
    return rows


def panel(d, box, title, note, rows, lo_db, hi_db):
    x0, y0, x1, y1 = box
    px = lambda v: x0 + (x1 - x0) * (np.clip(v, lo_db, hi_db) - lo_db) / (hi_db - lo_db)
    d.text((x0 - 152, y0 - 46), title, font=_font(15, True), fill=INK)
    d.text((x0 - 152, y0 - 26), note, font=_font(12), fill=DIM)
    for s in range(int(hi_db) - 10, int(lo_db), -20):
        d.line([(px(s), y0), (px(s), y1 + 14)], fill=GRID)
        d.text((px(s) - 10, y1 + 18), str(s), font=_font(11), fill=(110, 116, 124))
    y = y0
    for name, outdb, indb, floor in rows:
        d.text((x0 - 152, y + 13), name, font=_font(12, True), fill=INK)
        for i, (v, colour) in enumerate([(outdb, OUT), (indb, IN)]):
            top = y + 3 + i * 15
            d.rectangle([(x0, top), (px(v), top + 11)], fill=colour)
            d.text((px(v) + 5, top - 1), f'{v:.0f}', font=_font(11, True), fill=colour)
        # drawn over the bars: a bar standing on the file's own noise is a bound, not a reading
        for yy in range(y + 1, y + 31, 4):
            d.line([(px(floor), yy), (px(floor), yy + 2)], fill=FLOOR, width=2)
        bound = indb < floor + 1.0
        d.text((px(max(outdb, indb)) + 42, y + 10), f'{"\u2264" if bound else ""}{indb - outdb:+.0f} dB', font=_font(12, True), fill=FLOOR if bound else IN)
        y += 44
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/indoors')
    ap.add_argument('--out')
    ap.add_argument('--all', action='store_true', help='print every pair as well')
    args = ap.parse_args()

    for p in (['west-house', 'stilt', 'hut'] if args.all else []):
        rows = measure(args.takes, p)
        print(f'{p:12s} indoors minus outdoors: ' + '  '.join(f'{i - o:.1f}' for _, o, i, _ in rows))
        for name, o, i, fl in rows:
            print(f'    {name:16s} outside {o:7.1f}   inside {i:7.1f}   {i - o:+.1f}' + ('   (inside is at the file floor)' if i < fl + 1.0 else ''))
    if not args.out:
        return

    W, H = 1280, 404
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'Stepping through a door', font=_font(21, True), fill=INK)
    d.text((18, 40), '90 s standing still either side of it, the ambience alone.  Amber = on the deck outside,  green = in the middle of the room,  tick = the 16-bit render\u2019s own noise floor.', font=_font(12), fill=DIM)

    cols = [
        ('west-house', 'The west house', 'open sky above it (canopy 0.00)', 170),
        ('stilt', 'The grove\u2019s stilt house', 'a closed canopy above it (canopy 1.00)', 810),
    ]
    whole = {}
    for pair, title, note, x0 in cols:
        rows = measure(args.takes, pair)
        whole[pair] = rows[0]
        panel(d, (x0, 96, x0 + 300, 316), title, note, rows[1:], -110.0, -46.0)

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    w, s = whole['west-house'], whole['stilt']
    d.text((18, H - 40), f'The whole bed drops {w[1] - w[2]:.1f} dB in one room and {s[1] - s[2]:.1f} dB in the other, and both lose about 6 dB at 2-4 kHz \u2014 the same wall doing the same thing in two parts of the map.', font=_font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'Above 4 kHz they read differently only because the roof got there first: under open sky the wall still has a top end to take off, under a closed canopy there is almost none left.', font=_font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
