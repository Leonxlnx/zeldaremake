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


def band_power(x, rate, hop, lo, hi, win=0.02):
    """linear energy in [lo, hi) every `hop` seconds, on a Hann-windowed rfft"""
    n = int(round(win * rate))
    n += n % 2
    step = int(round(hop * rate))
    w = np.hanning(n)
    freqs = np.fft.rfftfreq(n, 1 / rate)
    sel = (freqs >= lo) & (freqs < hi)
    out = []
    for i in range(0, max(1, len(x) - n), step):
        s = np.fft.rfft(x[i : i + n] * w)
        out.append(float((np.abs(s[sel]) ** 2).sum()))
    return np.array(out)


def always_on(x, rate, hop, lo, hi, window=0.2, pct=10):
    """
    The band's always-on level over time, in dB: the `pct`-th percentile of its short-time power
    across a rolling `window`.

    This lane scores a place on the level present in nine frames out of ten rather than on the mean,
    because the mean of a forest is its birds. The same argument holds here with more force: a leaf
    flutter puts 40 dB into the top bands for 80 ms, and a correlation has no defence against one.
    The cost is resolution -- a 0.2 s window is 0.84 m of smear at a run -- which is small against
    the metres this is looking for and is identical in both takes of a pair.
    """
    p = band_power(x, rate, hop, lo, hi)
    k = max(1, int(round(window / hop)))
    pad = np.pad(p, (k // 2, k - k // 2 - 1), mode='edge')
    roll = np.lib.stride_tricks.sliding_window_view(pad, k)
    return 10 * np.log10(np.maximum(np.percentile(roll, pct, axis=1), 1e-20))


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


def feature(path, hop, watch, lead):
    """the take's watched band, always-on, from the moment he starts walking"""
    x, rate = read_wav(path)
    x = x[int(round(lead * rate)) :]
    bands = BANDS[watch]
    v = always_on(x, rate, hop, *bands[0])
    if len(bands) > 1:
        v = v - always_on(x, rate, hop, *bands[1])
    return v


def tick_buzz(path, tick_hz=30.0):
    """
    How far the take's own envelope stands over its neighbours at the tick rate.

    Shortening a smoothing time is only safe while the glide still outlives the tick. If it does
    not, a moving parameter becomes a staircase at 30 Hz, and a staircase on a gain is amplitude
    modulation — the buzz this lane exists to remove. So: the broadband envelope's spectrum, and
    the 30 Hz bin against the median of 10-50 Hz. Anything at or under 0 dB is not there.
    """
    x, rate = read_wav(path)
    env = np.abs(x)
    n = 1 << int(np.floor(np.log2(len(env))))
    env = env[:n] - env[:n].mean()
    s = np.abs(np.fft.rfft(env * np.hanning(n))) ** 2
    f = np.fft.rfftfreq(n, 1 / rate)
    near = (f >= tick_hz - 0.6) & (f <= tick_hz + 0.6)
    around = (f >= 10) & (f <= 50)
    return 10 * np.log10(max(s[near].max(), 1e-30) / max(float(np.median(s[around])), 1e-30))


def spectrogram(path, lead, secs, rows=260, cols=900, floor=-96, ceil=-30):
    """a log-frequency spectrogram of the take from the moment he starts walking, as a dB array"""
    x, rate = read_wav(path)
    x = x[int(round(lead * rate)) : int(round((lead + secs) * rate))]
    n = 8192
    step = max(1, (len(x) - n) // cols)
    w = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / rate)
    edges = np.geomspace(60, min(16000, rate / 2 - 1), rows + 1)
    # a log axis puts several rows inside one FFT bin down low; those rows take the nearest bin
    # rather than the floor, which is what made the first draft's bottom half a barcode
    bins = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        sel = (f >= lo) & (f < hi)
        bins.append(sel if sel.any() else np.abs(f - (lo + hi) / 2).argmin())
    out = np.full((rows, cols), floor, dtype=float)
    for c in range(cols):
        i = c * step
        if i + n > len(x):
            break
        p = np.abs(np.fft.rfft(x[i : i + n] * w)) ** 2
        for r, sel in enumerate(bins):
            out[r, c] = 10 * np.log10(max(float(p[sel].mean() if not np.isscalar(sel) else p[sel]), 1e-20))
    return np.clip((out - floor) / (ceil - floor), 0, 1), edges


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/lag')
ap.add_argument('--out', default='')
ap.add_argument('--spectro', default='', help='write a before/after spectrogram of the bore take here')
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
        h = feature(p, hop, tr['watch'], report['lead'])
        m, r = best_shift(world, h, hop, t['speed'])
        # how much of the world's own change actually reached the ear. A one-pole that has not
        # settled by the end of a change delivers less of it, which is the half of this a lag does
        # not describe; and it is the half a player hears as "the place did not arrive".
        # ... and only where the band and the term are in the same unit: the bore is watched through
        # a ratio of two bands against a cutoff in octaves, which have no share in common
        got = float(np.percentile(h, 98) - np.percentile(h, 2)) / (float(world.max() - world.min()) or 1) if tr['unit'] == 'dB' else None
        bump = abs(world[-1] - world[0]) < (world.max() - world.min()) * 0.5
        row[tag] = {'lagM': m, 'r': r, 'got': got, 'peakM': peak_shift(world, h, hop, t['speed']) if bump else None}
        row['curves'][tag] = h
    rows.append(row)

print(f"{'take':14} {'watched'.ljust(12)} {'speed':>6}   {'lag before':>10} {'r':>5}   {'lag after':>10} {'r':>5}   {'of the change heard':>21}   {'peak b/a':>16}")
for r in rows:
    if 'before' not in r or 'after' not in r:
        continue
    b, f_ = r['before'], r['after']
    got = f"{b['got'] * 100:>8.0f} % \u2192 {f_['got'] * 100:>3.0f} %" if b['got'] is not None else f"{'\u2014':>16}"
    peak = f"{b['peakM']:>+6.2f} m / {f_['peakM']:>+6.2f} m" if b['peakM'] is not None else ''
    print(f"{r['id']:14} {r['watch'].ljust(12)} {r['speed']:>4} m/s   " f"{b['lagM']:>8.2f} m {b['r']:>5.2f}   {f_['lagM']:>8.2f} m {f_['r']:>5.2f}   " + got + '   ' + peak)

print('\nthe tick in the envelope, dB over the median of 10-50 Hz. The controls are off-tick')
print('frequencies in the same band: 30 Hz has to stand over THOSE to be the tick and not the noise.')
CONTROLS = (14, 18, 23, 27, 33, 37, 42, 47)
print(f"{'take':14} {'30 Hz before':>13} {'after':>7}   {'worst control before':>21} {'after':>7}")
for r in rows:
    if 'before' not in r or 'after' not in r:
        continue
    out = []
    for tag in ('before', 'after'):
        p = os.path.join(a.takes, f"{r['id']}-bed-{tag}.wav")
        out.append((tick_buzz(p, 30.0), max(tick_buzz(p, hz) for hz in CONTROLS)))
    print(f"{r['id']:14} {out[0][0]:>12.1f} {out[1][0]:>7.1f}   {out[0][1]:>20.1f} {out[1][1]:>7.1f}")

# ---- the figure: the world's own term, and what came out of the graph, before and after ---------
W, H = 1500, 310 * len(rows) + 90
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
WORLD, BEFORE, AFTER = (244, 214, 120), (226, 106, 106), (120, 214, 150)
if a.out:
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    f14, f17, f22 = font(14), font(17), font(22)
    d.text((28, 22), 'Running past what the world is doing: the term, and the sound that came out', font=f22, fill=INK)
    d.text((28, 52), 'gold = the world where he is  |  red = heard, before  |  green = heard, after  |  each curve scaled to its own range', font=f14, fill=DIM)

    for i, r in enumerate(rows):
        top = 90 + i * 310
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
        secs = len(src['world']) * report['takes'][i]['trace']['hopS']
        # the mark: where the world passes the halfway point of the change
        mark = report['takes'][i]['marks'].get(r['watch'])
        if mark:
            mx = x0 + (x1 - x0) * min(1.0, mark['atS'] / secs)
            d.line([(mx, y0), (mx, y1)], fill=(90, 96, 104), width=1)
            d.text((mx + 5, y0 + 4), f"halfway at {mark['atS']:.2f} s", font=f14, fill=(150, 156, 164))
        for s in range(0, int(secs) + 1):
            tx = x0 + (x1 - x0) * s / secs
            d.line([(tx, y1), (tx, y1 + 5)], fill=(70, 76, 84), width=1)
            d.text((tx + 3, y1 + 4), f'{s} s', font=f14, fill=(96, 102, 110))
        # how far the watched band stands over the rest of the bed: where that is small the audio is
        # weak evidence whatever the shift search says, and the model carries the claim
        if 'before' in r:
            contrast = float(np.percentile(r['curves']['before'], 98) - np.percentile(r['curves']['before'], 2))
            d.text((x1 - 250, top + 22), f'band moves {contrast:.1f} dB across the take', font=f14, fill=DIM)

    im.save(a.out, quality=92)
    print(f'wrote {a.out}')

# ---- the bore, before and after, as a picture of the bed's top -----------------------------------
if a.spectro:
    take = next(t for t in report['takes'] if t['id'] == 'bore-run')
    secs = len(take['trace']['world']) * take['trace']['hopS']
    # where the world takes the top off: the steepest descent of its own trace, which on this path
    # is the bore's mouth rather than the canopy edge the halfway mark sits on
    wt = np.array(take['trace']['world'])
    mark = int(np.argmin(np.diff(wt))) * take['trace']['hopS']
    ROWS, COLS = 260, 900
    W2, H2 = COLS + 260, 2 * ROWS + 210
    im = Image.new('RGB', (W2, H2), BG)
    d = ImageDraw.Draw(im)
    f14, f17, f22 = font(14), font(17), font(22)
    d.text((28, 20), 'Running in through the log arch: the bed, and when its top comes off', font=f22, fill=INK)
    d.text((28, 48), f"{take['note']} \u2014 4.2 m/s, gust held at {report['gust']}. Same seed and path, so the birds and the leaves land together in both.", font=f14, fill=DIM)
    for k, tag in enumerate(('before', 'after')):
        img, edges = spectrogram(os.path.join(a.takes, f'bore-run-bed-{tag}.wav'), report['lead'], secs, ROWS, COLS)
        y0 = 90 + k * (ROWS + 50)
        px = im.load()
        for r in range(ROWS):
            for c in range(COLS):
                v = img[ROWS - 1 - r, c]
                px[110 + c, y0 + r] = (int(26 + v * 212), int(22 + v * 190), int(34 + v * 120))
        d.rectangle([110, y0, 110 + COLS - 1, y0 + ROWS - 1], outline=(60, 66, 74))
        d.text((28, y0 - 22), f"{tag} \u2014 tau 0.35 s" if tag == 'before' else f"{tag} \u2014 PLACE_TAU {report['proposedTau']} s", font=f17, fill=BEFORE if tag == 'before' else AFTER)
        for hz in (125, 500, 2000, 8000):
            yy = y0 + ROWS - 1 - int(ROWS * np.log(hz / edges[0]) / np.log(edges[-1] / edges[0]))
            d.text((66, yy - 8), f'{hz // 1000}k' if hz >= 1000 else str(hz), font=f14, fill=(110, 116, 124))
            d.line([(104, yy), (110, yy)], fill=(70, 76, 84))
        for s in range(0, int(secs) + 1):
            xx = 110 + int(COLS * s / secs)
            d.line([(xx, y0 + ROWS), (xx, y0 + ROWS + 5)], fill=(70, 76, 84))
            d.text((xx + 3, y0 + ROWS + 4), f'{s} s', font=f14, fill=(96, 102, 110))
        mx = 110 + int(COLS * mark / secs)
        d.line([(mx, y0), (mx, y0 + ROWS)], fill=(244, 214, 120), width=1)
    d.text((28, H2 - 28), 'gold line: where the world takes the top off. To the right of it the "before" pane keeps its top for most of a second longer.', font=f14, fill=DIM)
    im.save(a.spectro, quality=92)
    print(f'wrote {a.spectro}')
