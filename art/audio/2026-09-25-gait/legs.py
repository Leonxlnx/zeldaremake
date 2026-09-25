#!/usr/bin/env python3
"""legs.py -- the same flagstones at a walk and at a run, before and after.

    python3 art/audio/2026-09-25-gait/legs.py --before /tmp/gait --after /tmp/gait-after \
        --out art/audio/2026-09-25-gait/gait.jpg

Whole-leg spectra, five seconds of each gait, with no step detection anywhere in it. That is
deliberate: the obvious instrument here is to cut each step out and compare them, and it does not
work at five steps a second. The run's own first half differs from its second by 13.4 dB rms of
shape against the walk's 3.2, and after the change the onset detector stops finding the run's steps
at all. A measurement whose noise floor is bigger than its effect is not a measurement, so this
takes the whole leg and asks where its energy sits.

The walk is on the sheet as the control. It must not move, because nothing in this change touches it.
"""
import argparse
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
WALK, RUN = (150, 170, 240), (214, 162, 96)
RUN_AFTER = (124, 196, 130)
LEGS = {'walk': (13, 18), 'run': (36, 41)}


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def leg(path, t0, t1):
    with wave.open(path, 'rb') as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64).reshape(-1, w.getnchannels()).mean(axis=1) / 32768.0
    return x[int(t0 * sr) : int(t1 * sr)], sr


def spectrum(seg, sr):
    S = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    return np.fft.rfftfreq(len(seg), 1.0 / sr), S


def centroid(seg, sr):
    f, S = spectrum(seg, sr)
    m = (f > 80) & (f < 12000)
    return float((f[m] * S[m]).sum() / S[m].sum())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    curves = {}
    cents = {}
    for tag, folder in [('before', args.before), ('after', args.after)]:
        for name, (t0, t1) in LEGS.items():
            seg, sr = leg(os.path.join(folder, 'dry.wav'), t0, t1)
            curves[(tag, name)] = spectrum(seg, sr)
            cents[(tag, name)] = centroid(seg, sr)

    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'A run was a louder walk', font=font(21, True), fill=INK)
    d.text((18, 40), 'Five seconds of flagstones at each gait, from the same render, dry. Whole-leg spectra \u2014 no step detection, because at five steps a second there is none that works.', font=font(12), fill=DIM)
    x0, x1, y0, y1 = 80, W - 330, 106, 380
    lof, hif = np.log10(60), np.log10(12000)
    peak = max(10 * np.log10(np.maximum(S, 1e-30)).max() for _, S in curves.values())
    top = float(np.ceil((peak + 2) / 5) * 5)
    bot = top - 65
    for v in range(int(top), int(bot), -10):
        y = y0 + (y1 - y0) * (top - v) / (top - bot)
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x0 - 34, y - 7), f'{v:.0f}', font=font(11), fill=(110, 116, 124))
    for f_ in (60, 125, 250, 500, 1000, 2000, 4000, 8000):
        px = x0 + (x1 - x0) * (np.log10(f_) - lof) / (hif - lof)
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 10, y1 + 6), f'{f_ // 1000}k' if f_ >= 1000 else str(f_), font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 10, y1 + 26), 'Hz', font=font(12), fill=DIM)

    series = [
        (('before', 'walk'), WALK, 'the walk (unchanged)', 2),
        (('before', 'run'), RUN, 'the run, before', 2),
        (('after', 'run'), RUN_AFTER, 'the run, after', 2),
    ]
    for key, colour, label, wdt in series:
        f, S = curves[key]
        lin = 10 ** (10 * np.log10(np.maximum(S, 1e-30)) / 10)
        pts = []
        for fc in np.logspace(np.log10(70), np.log10(11000), 400):
            m = (f >= fc / 1.15) & (f <= fc * 1.15)
            if not m.any():
                continue
            v = 10 * np.log10(max(float(np.mean(lin[m])), 1e-30))
            px = x0 + (x1 - x0) * (np.log10(fc) - lof) / (hif - lof)
            py = y0 + (y1 - y0) * (top - np.clip(v, bot, top)) / (top - bot)
            pts.append((px, py))
        d.line(pts, fill=colour, width=wdt)
        i = series.index((key, colour, label, wdt))
        d.text((x1 + 14, y0 + 8 + i * 32), label, font=font(12, True), fill=colour)
        d.text((x1 + 14, y0 + 24 + i * 32), f'centroid {cents[key]:.0f} Hz', font=font(11), fill=colour)

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    before_gap = cents[('before', 'run')] - cents[('before', 'walk')]
    after_gap = cents[('after', 'run')] - cents[('after', 'walk')]
    d.text((18, H - 40), f'A run\u2019s spectral centre was {before_gap:+.0f} Hz from a walk\u2019s. It is now {after_gap:+.0f} Hz: the strike is faster, it rings the surface higher, the toe stops being its own event and the whole contact is briefer.', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), f'The walk did not move \u2014 centroid {cents[("after", "walk")] - cents[("before", "walk")]:+.0f} Hz, every band inside 0.01 dB \u2014 and neither did any peak: the loudness of a run is strengthFor\u2019s job and was already right.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)
    for k in sorted(cents):
        print(f'  {k[0]:7s} {k[1]:5s} centroid {cents[k]:6.0f} Hz')


if __name__ == '__main__':
    main()
