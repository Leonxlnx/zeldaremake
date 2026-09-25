#!/usr/bin/env python3
"""floor.py -- the loudest never-stopping thing in the world, place by place.

    python3 art/audio/2026-09-24-standing/floor.py --takes /tmp/floor \
        --out art/audio/2026-09-24-standing/world-floor.jpg [--against /tmp/older]

`survey.mjs` stands still in every place a player stands and renders the world's own sound there.
This reads those takes and answers the owner's standing complaint as a number rather than an
opinion: not how loud a place is, but **what in it never stops**.

The metric is the 10th percentile of the short-term level over the take -- the level present in
nine frames out of ten. A mean cannot answer the question, because a place whose gusts are loud and
whose gaps are silent has the same mean as a place that hisses steadily, and only one of those is
what he complained about. The broadband figure is A-weighted, because "is this noisy" is a judgement
the ear makes and the ear is not flat.

Two numbers per place, and they have to be read together:

  floor   the A-weighted always-on level. The thing being minimised.
  swing   p90 - p10 of the same trace. A place can reach a low floor by being quiet, or by
          breathing -- loud when the wind comes and nearly silent between. Only the second is a
          forest, and a floor that drops while the swing collapses is a regression wearing the
          right number.

`--against` prints an older survey's takes beside the new ones, which is how a change that moved
every place at once (a master trim, say) is told apart from one that moved a single place.
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BANDS = [('60-250', 60, 250), ('250-1k', 250, 1000), ('1-2k', 1000, 2000), ('2-4k', 2000, 4000), ('4-8k', 4000, 8000), ('8-16k', 8000, 16000)]
WIN = 0.25

BG = (17, 19, 22)
GRID = (44, 48, 54)
INK = (236, 238, 240)
DIM = (140, 146, 154)
BAR = (124, 196, 130)
OLD = (214, 162, 96)
WARN = (226, 128, 112)


def _font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def load(path):
    import wave

    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch).mean(axis=1) / 32768.0, sr


def a_weight(x, sr):
    """IEC 61672 A-weighting, applied in the frequency domain (the take is offline, so this is exact)"""
    X = np.fft.rfft(x)
    f = np.maximum(np.fft.rfftfreq(len(x), 1.0 / sr), 1e-6)
    f2 = f**2
    ra = (12194.0**2 * f2**2) / ((f2 + 20.6**2) * np.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194.0**2))
    return np.fft.irfft(X * (ra * 10 ** (1.9997 / 20)), len(x))


def short_term(x, sr, win=WIN):
    n = int(win * sr)
    m = len(x) // n
    return 20 * np.log10(np.maximum(np.sqrt((x[: m * n].reshape(m, n) ** 2).mean(axis=1)), 1e-13))


def band(x, sr, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    X[(f < lo) | (f >= hi)] = 0
    return np.fft.irfft(X, len(x))


def measure(folder, place_id):
    x, sr = load(os.path.join(folder, f'{place_id}.wav'))
    st = short_term(a_weight(x, sr), sr)
    p10, p90 = np.percentile(st, [10, 90])
    bands = []
    for _, lo, hi in BANDS:
        b = short_term(band(x, sr, lo, hi), sr)
        bands.append(float(np.percentile(b, 10)))
    return {'floor': float(p10), 'swing': float(p90 - p10), 'bands': bands}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/floor')
    ap.add_argument('--against', help='an older survey to print beside this one')
    ap.add_argument('--out')
    ap.add_argument('--json')
    args = ap.parse_args()

    meta = json.load(open(os.path.join(args.takes, 'places.json')))
    rows = []
    for p in meta['places']:
        r = measure(args.takes, p['id'])
        r['id'] = p['id']
        r['note'] = p['note']
        if args.against and os.path.exists(os.path.join(args.against, f'{p["id"]}.wav')):
            r['was'] = measure(args.against, p['id'])['floor']
        rows.append(r)

    rows.sort(key=lambda r: -r['floor'])
    head = f'{"place":16s} {"floor":>7s} {"swing":>7s}' + (f' {"was":>7s} {"moved":>7s}' if args.against else '') + '   ' + ' '.join(f'{n:>7s}' for n, _, _ in BANDS)
    print(head)
    for r in rows:
        line = f'{r["id"]:16s} {r["floor"]:7.1f} {r["swing"]:7.1f}'
        if args.against:
            line += f' {r["was"]:7.1f} {r["floor"] - r["was"]:+7.1f}' if 'was' in r else f' {"-":>7s} {"new":>7s}'
        print(line + '   ' + ' '.join(f'{v:7.1f}' for v in r['bands']))
    print()
    print(f'the loudest never-stopping place in the world is {rows[0]["id"]} ({rows[0]["note"]}) at {rows[0]["floor"]:.1f} dBA')
    flat = [r for r in rows if r['swing'] < 10]
    print('places that do not breathe (swing under 10 dB):', ', '.join(r['id'] for r in flat) if flat else 'none')

    if args.json:
        json.dump(rows, open(args.json, 'w'), indent=1)
    if not args.out:
        return

    W = 1280
    H = 150 + 30 * len(rows)
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'What never stops, place by place', font=_font(21, True), fill=INK)
    d.text((18, 40), '90 s standing still in each, the ambience alone. The bar is the A-weighted level present in nine frames out of ten; the number after it is how far the place swings between its quietest and its loudest.', font=_font(12), fill=DIM)
    # scaled to the places, not to a round number: the whole world sits inside about 12 dB and a
    # fixed axis hides that the quietest place and the loudest are not far apart
    vals = [r['floor'] for r in rows] + [r['was'] for r in rows if 'was' in r]
    lo, hi = float(np.floor(min(vals) - 2)), float(np.ceil(max(vals) + 2))
    x0, x1, y = 250, W - 300, 92
    for s in range(int(np.ceil(lo / 5) * 5), int(hi) + 1, 5):
        px = x0 + (x1 - x0) * (s - lo) / (hi - lo)
        d.line([(px, y - 6), (px, H - 46)], fill=GRID)
        d.text((px - 10, H - 42), f'{s}', font=_font(11), fill=(110, 116, 124))
    d.text((x0 + (x1 - x0) / 2 - 34, H - 26), 'dBA, always-on', font=_font(12), fill=DIM)
    for r in rows:
        d.text((18, y + 3), r['id'], font=_font(12, True), fill=INK)
        px = x0 + (x1 - x0) * (np.clip(r['floor'], lo, hi) - lo) / (hi - lo)
        colour = WARN if r['swing'] < 10 else BAR
        d.rectangle([(x0, y + 2), (px, y + 17)], fill=colour)
        d.text((px + 6, y + 2), f'{r["floor"]:.0f}', font=_font(12, True), fill=colour)
        if 'was' in r:
            wx = x0 + (x1 - x0) * (np.clip(r['was'], lo, hi) - lo) / (hi - lo)
            d.line([(wx, y + 1), (wx, y + 18)], fill=OLD, width=2)
        d.text((x1 + 44, y + 3), f'swings {r["swing"]:.0f} dB', font=_font(12), fill=DIM)
        y += 30
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
