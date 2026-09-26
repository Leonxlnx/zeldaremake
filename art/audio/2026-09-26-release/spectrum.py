#!/usr/bin/env python3
"""spectrum.py -- the mix's envelope spectrum either side of the step cut, drawn.

    python3 art/audio/2026-09-26-release/spectrum.py --before /tmp/release/before \\
        --after /tmp/release/after --out art/audio/2026-09-26-release/pulse.jpg

The tables in the README say the music's beat is now the strongest rhythm in the mix. This is the
same claim in the form the ear makes it: two spikes in one curve, and which of them is taller.

The curve is the spectrum of the mix's broadband envelope -- how much of the mix's loudness swings
at each rate, between half a swing a second and eight. The music's beat is at 1.2 Hz (76 bpm). The
player's feet are at 2.73 Hz walking and 3.67 running. Everything else in there is the wind, the
birds and the leaves, which have no rate and make the background the two spikes stand over.
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BEAT_HZ = 1.2
STRIDE = {'walk': 0.44, 'run': 0.60}
SPEED = {'walk': 1.2, 'run': 2.2}
LO, HI = 0.4, 8.0


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def env_spectrum(x, rate, lead):
    x = x[int(lead * rate) :]
    env = np.abs(x)
    k = int(rate / 200)
    env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
    env = env - env.mean()
    n = 1 << int(np.floor(np.log2(len(env))))
    spec = np.abs(np.fft.rfft(env[:n] * np.hanning(n))) ** 2
    return spec, np.fft.rfftfreq(n, k / rate)


def smooth(v, n=3):
    return np.convolve(v, np.ones(n) / n, mode='same')


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/release/before')
ap.add_argument('--after', default='/tmp/release/after')
ap.add_argument('--out', default='art/audio/2026-09-26-release/pulse.jpg')
a = ap.parse_args()

lead = json.load(open(os.path.join(a.before, 'takes.json')))['lead']

W, H = 1060, 520
BG, INK, DIM, GRID = (17, 19, 22), (238, 240, 243), (120, 128, 138), (44, 48, 54)
BEFORE, AFTER = (244, 176, 110), (130, 200, 160)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), "What the mix's loudness swings at, before and after four decibels off the steps", font=f22, fill=INK)
d.text((28, 48), 'the spectrum of the mix\u2019s broadband envelope. orange = shipped, green = after. the taller spike is the rhythm you hear.', font=f13, fill=DIM)

for i, gait in enumerate(('run', 'walk')):
    step_hz = SPEED[gait] / STRIDE[gait]
    x0, x1 = 70 + i * 500, 70 + i * 500 + 430
    y0, y1 = 128, 430
    d.rectangle([x0, y0, x1, y1], outline=GRID)
    d.text((x0, y0 - 46), f'{gait} \u2014 {SPEED[gait]} m/s, {step_hz:.2f} steps a second', font=f16, fill=INK)

    curves = {}
    for name, folder, col in (('before', a.before, BEFORE), ('after', a.after, AFTER)):
        sig, rate = read(os.path.join(folder, f'{gait}-mix-on.wav'))
        spec, f = env_spectrum(sig, rate, lead)
        band = (f >= LO) & (f <= HI)
        bg = float(np.median(spec[band]))
        curves[name] = (f[band], 10 * np.log10(np.maximum(smooth(spec[band]), 1e-30) / bg), col)

    top = max(c[1].max() for c in curves.values()) + 2
    bot = -12
    for gl in range(0, int(top) + 1, 6):
        yy = y1 - (y1 - y0) * (gl - bot) / (top - bot)
        d.line([(x0, yy), (x1, yy)], fill=GRID)
        d.text((x0 - 34, yy - 8), f'{gl:>3} dB', font=f13, fill=DIM)
    for hz in (1, 2, 4, 8):
        xx = x0 + (x1 - x0) * (math.log(hz / LO) / math.log(HI / LO))
        d.line([(xx, y0), (xx, y1)], fill=GRID)
        d.text((xx - 8, y1 + 6), f'{hz} Hz', font=f13, fill=DIM)

    for name, (f, v, col) in curves.items():
        pts = [(x0 + (x1 - x0) * (math.log(max(ff, LO) / LO) / math.log(HI / LO)), y1 - (y1 - y0) * (min(vv, top) - bot) / (top - bot)) for ff, vv in zip(f, v)]
        d.line(pts, fill=col, width=2)

    for hz, label in ((BEAT_HZ, 'the music'), (step_hz, 'his feet')):
        xx = x0 + (x1 - x0) * (math.log(hz / LO) / math.log(HI / LO))
        for yy in range(y0, y1, 8):
            d.line([(xx, yy), (xx, yy + 4)], fill=(78, 84, 92))
        w = d.textlength(label, font=f13)
        d.text((xx - w / 2, y0 - 22), label, font=f13, fill=INK)
        for name, (f, v, col) in curves.items():
            near = (f >= hz - 0.25) & (f <= hz + 0.25)
            peak = float(v[near].max())
            yy = y1 - (y1 - y0) * (min(peak, top) - bot) / (top - bot)
            d.ellipse([xx - 4, yy - 4, xx + 4, yy + 4], fill=col)

    for k, (name, folder) in enumerate((('before', a.before), ('after', a.after))):
        sig, rate = read(os.path.join(folder, f'{gait}-mix-on.wav'))
        spec, f = env_spectrum(sig, rate, lead)

        def at(hz):
            near = (f >= hz - 0.25) & (f <= hz + 0.25)
            band = (f >= LO) & (f <= HI)
            return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[band])), 1e-30))

        over = at(step_hz) - at(BEAT_HZ)
        col = BEFORE if name == 'before' else AFTER
        verdict = 'his feet are the rhythm' if over > 0 else 'the music is the rhythm'
        d.text((x0 + 10, y1 + 30 + k * 20), f'{name:>7}   his feet {over:+.1f} dB against the music   \u2014   {verdict}', font=f13, fill=col)

im.save(a.out, quality=92)
print(f'wrote {a.out}')
