#!/usr/bin/env python3
"""passby.py -- how far behind the player the rendered sound actually is.

    python3 art/audio/2026-09-25-lag/passby.py --takes /tmp/lag \
        --out art/audio/2026-09-25-lag/passby.jpg

`lag.mjs` says what the bed's parameters do. This says what came out of the graph. For each
journey `passby.mjs` rendered, one band is pulled out of the WAV every 10 ms -- the band that
carries the term under test -- and lined up against the world's own trace of that term, which
`lag.mjs` wrote into lag.json along the same path at the same hop. The shift that lines the two up
best, in metres of ground, is the answer.

  lantern   60-320 Hz. The flame is pink noise through a 320 Hz lowpass with a husk resonance
            under it; nothing else in the bed lives down there while the wind layers peak at
            1-2 kHz.
  bore      2-8 kHz against 250 Hz-1 kHz. The enclosure filter takes the top off, so brightness
            is the term, and a ratio cancels the gust that is moving underneath it.
  canopy    250 Hz-2 kHz, the leaf roll's own band.

The seed, the path, the speed and the length are identical across the pair, and the bed's events
are scheduled off the clock rather than the constants, so the leaves and birds in the two files
land at the same moments and cancel out of the comparison.
"""
import argparse
import json
import os
import struct
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for p in (
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    ):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read_wav(path):
    with wave.open(path, 'rb') as w:
        n = w.getnframes()
        raw = w.readframes(n)
        ch = w.getnchannels()
        rate = w.getframerate()
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, rate


def band_db(x, rate, hop, lo, hi, win=0.06):
    """energy in [lo, hi) every `hop` seconds, in dB, on a Hann-windowed rfft"""
    n = int(round(win * rate))
    n += n % 2
    step = int(round(hop * rate))
    w = np.hanning(n)
    freqs = np.fft.rfftfreq(n, 1 / rate)
    sel = (freqs >= lo) & (freqs < hi)
    out = []
    for i in range(0, max(1, len(x) - n), step):
        s = np.fft.rfft(x[i : i + n] * w)
        out.append(10 * np.log10(np.maximum((np.abs(s[sel]) ** 2).sum(), 1e-20)))
    return np.array(out)


def best_shift(world, heard, hop, speed, max_m=4.0):
    """
    The shift, in metres, that best lines the heard curve onto the world's own.

    Every candidate shift is scored over the SAME span of the take -- the last `n - smax` hops --
    rather than over whatever is left after the shift. Scoring each on its own span makes a large
    shift compete on a shorter, differently-shaped stretch of the journey, which quietly pulls the
    answer toward zero; the first pass here did exactly that and read the lantern at a walk as 4 cm.
    """
    n = min(len(world), len(heard))
    z = lambda v: (v - v.mean()) / (v.std() or 1)
    smax = int(round(max_m / speed / hop))
    if n - smax < 16:
        smax = max(1, n // 3)
    best, bestr = 0, -2.0
    for s in range(0, smax + 1):
        h = z(heard[smax:n])
        w = z(world[smax - s : n - s])
        r = float(np.corrcoef(h, w)[0, 1])
        if r > bestr:
            bestr, best = r, s
    return best * hop * speed, bestr


def peak_shift(world, heard, hop, speed, smooth=0.25):
    """
    Where the loudest moment of a bump lands, heard against where the world put it.

    The lantern is a hump rather than a ramp, and a hump has an answer a correlation does not need
    to find: the top of it. Both curves are smoothed over `smooth` seconds first, because the bed's
    leaves and birds put spikes of their own into the band and an argmax has no defence against one.
    """
    k = max(1, int(round(smooth / hop)))
    box = np.ones(k) / k
    n = min(len(world), len(heard))
    w = np.convolve(world[:n], box, mode='same')
    h = np.convolve(heard[:n], box, mode='same')
    edge = k
    return (int(np.argmax(h[edge : n - edge])) - int(np.argmax(w[edge : n - edge]))) * hop * speed


# the band that carries each take's watched term
BANDS = {
    'flame level': [(60, 320)],
    'bed top': [(2000, 8000), (250, 1000)],
    'roll level': [(250, 2000)],
}


def feature(path, rate_hop, watch):
    x, rate = read_wav(path)
    bands = BANDS[watch]
    v = band_db(x, rate, rate_hop, *bands[0])
    if len(bands) > 1:
        v = v - band_db(x, rate, rate_hop, *bands[1])
    return v


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/lag')
ap.add_argument('--out', default='')
a = ap.parse_args()

report = json.load(open(os.path.join(a.takes, 'lag.json')))
rows = []
for t in report['takes']:
    tr = t['trace']
    world = np.array(tr['world'])
    hop = tr['hopS']
    row = {'id': t['id'], 'note': t['note'], 'watch': tr['watch'], 'speed': t['speed'], 'curves': {}}
    for tag in ('before', 'after'):
        p = os.path.join(a.takes, f"{t['id']}-bed-{tag}.wav")
        if not os.path.exists(p):
            continue
        h = feature(p, hop, tr['watch'])
        m, r = best_shift(world, h, hop, t['speed'])
        row[tag] = {'lagM': m, 'r': r, 'peakM': peak_shift(world, h, hop, t['speed']) if t['watch'] == 'flame level' else None}
        row['curves'][tag] = h
    rows.append(row)

print(f"{'take':14} {'watched'.ljust(12)} {'speed':>6}   {'before':>9} {'r':>6}   {'after':>9} {'r':>6}   {'closer by':>9}   peak before / after")
for r in rows:
    if 'before' not in r or 'after' not in r:
        continue
    pk = ''
    if r['before']['peakM'] is not None:
        pk = f"   {r['before']['peakM']:+.2f} m / {r['after']['peakM']:+.2f} m"
    print(
        f"{r['id']:14} {r['watch'].ljust(12)} {r['speed']:>4} m/s   "
        f"{r['before']['lagM']:>7.2f} m {r['before']['r']:>6.2f}   "
        f"{r['after']['lagM']:>7.2f} m {r['after']['r']:>6.2f}   "
        f"{r['before']['lagM'] - r['after']['lagM']:>7.2f} m" + pk
    )

if not a.out:
    raise SystemExit(0)

# ---- the figure: the world's own term, and what came out of the graph, before and after ---------
W, H = 1500, 300 * len(rows) + 90
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
WORLD, BEFORE, AFTER = (244, 214, 120), (226, 106, 106), (120, 214, 150)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f14, f17, f22 = font(14), font(17), font(22)
d.text((28, 22), 'Running past what the world is doing: the term, and the sound that came out', font=f22, fill=INK)
d.text((28, 52), 'gold = the world where he is  |  red = heard, before  |  green = heard, after  |  each curve scaled to its own range', font=f14, fill=DIM)

for i, r in enumerate(rows):
    top = 90 + i * 300
    plot_h = 210
    d.text((28, top), f"{r['id']} \u2014 {r['note']}", font=f17, fill=INK)
    if 'before' in r and 'after' in r:
        d.text(
            (28, top + 22),
            f"watching {r['watch']}  \u2014  heard {r['before']['lagM']:.2f} m behind him before, {r['after']['lagM']:.2f} m after",
            font=f14,
            fill=DIM,
        )
    x0, y0, x1, y1 = 28, top + 48, W - 28, top + 48 + plot_h
    d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
    curves = [('world', np.array(r['trace']['world']) if 'trace' in r else None)]
    src = {'world': np.array(report['takes'][i]['trace']['world'])}
    src.update(r['curves'])
    for name, colour in (('world', WORLD), ('before', BEFORE), ('after', AFTER)):
        v = src.get(name)
        if v is None or len(v) < 4:
            continue
        v = np.asarray(v, dtype=float)
        lo, hi = float(v.min()), float(v.max())
        rng = (hi - lo) or 1.0
        pts = [(x0 + (x1 - x0) * k / (len(v) - 1), y1 - (y1 - y0) * (val - lo) / rng) for k, val in enumerate(v)]
        d.line(pts, fill=colour, width=2)
    # the mark: where the world passes the halfway point of the change
    mark = report['takes'][i]['marks'].get(r['watch'])
    if mark:
        secs = len(src['world']) * report['takes'][i]['trace']['hopS']
        mx = x0 + (x1 - x0) * min(1.0, mark['atS'] / secs)
        d.line([(mx, y0), (mx, y1)], fill=(90, 96, 104), width=1)
        d.text((mx + 5, y0 + 4), f"halfway at {mark['atS']:.2f} s", font=f14, fill=(150, 156, 164))

im.save(a.out, quality=92)
print(f'wrote {a.out}')
