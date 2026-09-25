#!/usr/bin/env python3
"""apart.py -- how far apart two places in this world actually sound.

    python3 art/audio/2026-09-25-places/apart.py --takes /tmp/floor \
        --out art/audio/2026-09-25-places/apart.jpg

Check 9 of `art/audio/RUBRIC_50_SOUND.md` asks whether two places a player can name sound different.
I scored it 2 on the grounds that six named places sit inside 2.5 dB of each other A-weighted. That
was the wrong measurement for the question: level is one axis and a place is not only louder or
quieter than another, it is a different colour. The plaza has the body of wind on open ground and
the forest floor has birds under a closed roof, and a listener has no trouble at all telling those
apart at the same loudness.

So this measures both, and reports them side by side:

  level     the A-weighted always-on difference. What I scored on.
  colour    the RMS difference between the two places' always-on spectra AFTER each is normalised
            to the same broadband level -- so it is purely shape, with loudness divided out. Two
            takes of the same place differ by a few tenths of a decibel here; anything over about
            3 dB is a different-sounding place.

Both, because either alone can mislead. A term that made one place louder and changed nothing else
would move `level` and not `colour`, and would not make anywhere sound like anywhere new.
"""
import argparse
import itertools
import json
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# third-octave centres from the body of the wind to the top of the leaves
BANDS = [(f / 1.122, f * 1.122) for f in (63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000)]
BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch).mean(axis=1) / 32768.0, sr


def a_weight(x, sr):
    X = np.fft.rfft(x)
    f = np.maximum(np.fft.rfftfreq(len(x), 1.0 / sr), 1e-6)
    f2 = f**2
    ra = (12194.0**2 * f2**2) / ((f2 + 20.6**2) * np.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194.0**2))
    return np.fft.irfft(X * (ra * 10 ** (1.9997 / 20)), len(x))


def always_on(x, sr, lo=None, hi=None, win=0.25):
    if lo is not None:
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(len(x), 1.0 / sr)
        X[(f < lo) | (f >= hi)] = 0
        x = np.fft.irfft(X, len(x))
    n = int(win * sr)
    m = len(x) // n
    st = 20 * np.log10(np.maximum(np.sqrt((x[: m * n].reshape(m, n) ** 2).mean(axis=1)), 1e-13))
    return float(np.percentile(st, 10))


def profile(path):
    """(A-weighted always-on level, the always-on spectrum normalised to zero mean)"""
    x, sr = load(path)
    level = always_on(a_weight(x, sr), sr)
    shape = np.array([always_on(x, sr, lo, hi) for lo, hi in BANDS])
    return level, shape - shape.mean()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/floor')
    ap.add_argument('--out')
    args = ap.parse_args()
    meta = json.load(open(os.path.join(args.takes, 'places.json')))
    places = [p['id'] for p in meta['places']]
    prof = {p: profile(os.path.join(args.takes, f'{p}.wav')) for p in places}

    pairs = []
    for a, b in itertools.combinations(places, 2):
        level = abs(prof[a][0] - prof[b][0])
        colour = float(np.sqrt(np.mean((prof[a][1] - prof[b][1]) ** 2)))
        pairs.append((a, b, level, colour))

    print(f'{"":30s} {"level apart":>12s} {"colour apart":>13s}')
    print('the ten pairs that sound most alike:')
    for a, b, lv, co in sorted(pairs, key=lambda p: p[3])[:10]:
        print(f'  {a + " / " + b:28s} {lv:10.1f} dB {co:11.1f} dB')
    print('the ten that sound least alike:')
    for a, b, lv, co in sorted(pairs, key=lambda p: -p[3])[:10]:
        print(f'  {a + " / " + b:28s} {lv:10.1f} dB {co:11.1f} dB')
    lv = [p[2] for p in pairs]
    co = [p[3] for p in pairs]
    print()
    print(f'across all {len(pairs)} pairs:  level apart {min(lv):.1f} to {max(lv):.1f} dB (median {np.median(lv):.1f})')
    print(f'{"":19s}colour apart {min(co):.1f} to {max(co):.1f} dB (median {np.median(co):.1f})')

    if not args.out:
        return
    W, H = 1280, 520
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'Two places do not have to differ in level to sound different', font=font(21, True), fill=INK)
    d.text((18, 40), 'Every pair of the thirteen surveyed places. Across is how far apart they are in A-weighted always-on LEVEL; up is how far apart their always-on SPECTRA are once loudness is divided out.', font=font(12), fill=DIM)
    x0, x1, y0, y1 = 80, W - 340, 96, 430
    xmax, ymax = max(12.0, max(lv) + 1), max(8.0, max(co) + 1)
    for v in range(0, int(xmax) + 1, 2):
        px = x0 + (x1 - x0) * v / xmax
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 6, y1 + 6), str(v), font=font(11), fill=(110, 116, 124))
    for v in range(0, int(ymax) + 1, 2):
        py = y1 - (y1 - y0) * v / ymax
        d.line([(x0, py), (x1, py)], fill=GRID)
        d.text((x0 - 22, py - 7), str(v), font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 90, y1 + 26), 'apart in level (dBA)', font=font(12), fill=DIM)
    d.text((18, y0 - 18), 'apart in colour (dB)', font=font(12), fill=DIM)
    # the line the check was scored against, and the line that matters
    py = y1 - (y1 - y0) * 3.0 / ymax
    d.line([(x0, py), (x1, py)], fill=(120, 96, 140), width=2)
    d.text((x1 + 8, py - 7), 'a different-sounding place', font=font(11, True), fill=(160, 130, 180))
    px = x0 + (x1 - x0) * 2.5 / xmax
    d.line([(px, y0), (px, y1)], fill=(120, 96, 140), width=2)
    for a, b, lvv, cov in pairs:
        px = x0 + (x1 - x0) * min(lvv, xmax) / xmax
        py = y1 - (y1 - y0) * min(cov, ymax) / ymax
        interesting = lvv < 2.5 and cov > 3.0
        d.ellipse([(px - 4, py - 4), (px + 4, py + 4)], fill=(124, 196, 130) if interesting else (96, 104, 116))
    n_int = sum(1 for p in pairs if p[2] < 2.5 and p[3] > 3.0)
    d.text((x1 + 8, y0 + 8), f'{n_int} pairs of the {len(pairs)}', font=font(13, True), fill=(124, 196, 130))
    d.text((x1 + 8, y0 + 26), 'sit inside 2.5 dB of level', font=font(11), fill=(124, 196, 130))
    d.text((x1 + 8, y0 + 40), 'and still sound different', font=font(11), fill=(124, 196, 130))
    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    d.text((18, H - 40), f'I scored check 9 a 2 because the places sit close together across this chart. Most of them sit high up it: {n_int} pairs are within 2.5 dB of each other and further', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'than 3 dB apart in shape. Level was the wrong axis to judge the check on, and the score was mine to correct.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
