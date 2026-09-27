#!/usr/bin/env python3
"""gait.py -- what the compressor was charging for, drawn.

    python3 art/audio/2026-09-26-pad/gait.py --before /tmp/pad --after /tmp/pad-after \\
        --out art/audio/2026-09-26-pad/gait.jpg

Two panels, two claims.

Left: every detected footstep's peak, at a walk and at a run, through the compressor and through
the plain gain that replaced it. Four-to-one compression takes more off a loud step than a quiet
one, so it pushes the two gaits together -- the picture is the walk column and the run column
sitting almost on top of each other on the left and coming apart on the right. That gap is what a
player feels when he starts running.

Right: the spectrum of the mix's broadband envelope at a run, which is the owner's complaint. The
spike at his step rate has to stay under the spike at the music's beat; the swap was not allowed
to hand that back.
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


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def envelope(x, rate, win=0.004):
    n = max(2, int(win * rate))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def step_peaks(path, lead):
    x, rate = read(path)
    x = x[int(lead * rate) :]
    e = envelope(x, rate)
    d = np.diff(e, prepend=e[0])
    thr = np.percentile(d, 99.0)
    gap = int(0.15 * rate)
    n = int(0.04 * rate)
    out, i = [], 0
    while i < len(d):
        if d[i] > thr:
            j = min(len(e), i + int(0.02 * rate))
            at = int(i + np.argmax(e[i:j])) if j > i else i
            if at + n < len(x):
                out.append(db(np.abs(x[at : at + n]).max()))
            i += gap
        else:
            i += 1
    return np.array(out)


def env_spectrum(x, rate, lead):
    x = x[int(lead * rate) :]
    env = np.abs(x)
    k = int(rate / 200)
    env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
    env = env - env.mean()
    n = 1 << int(np.floor(np.log2(len(env))))
    return np.abs(np.fft.rfft(env[:n] * np.hanning(n))) ** 2, np.fft.rfftfreq(n, k / rate)


def line(spec, f, hz, half=0.25):
    near = (f >= hz - half) & (f <= hz + half)
    around = (f >= LO) & (f <= HI)
    return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[around])), 1e-30))


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/pad')
ap.add_argument('--after', default='/tmp/pad-after')
ap.add_argument('--out', default='art/audio/2026-09-26-pad/gait.jpg')
a = ap.parse_args()

lead = json.load(open(os.path.join(a.before, 'takes.json')))['lead']
sides = (('compressor', a.before), ('a plain gain', a.after))

W, H = 1060, 540
BG, INK, DIM, GRID = (17, 19, 22), (238, 240, 243), (120, 128, 138), (44, 48, 54)
COL = {'walk': (130, 160, 240), 'run': (244, 176, 110)}
WAS, NOW = (244, 176, 110), (130, 200, 160)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'Four-to-one compression made a run sound like a walk. A plain gain does not.', font=f22, fill=INK)
d.text((28, 48), 'left: every footstep in a 62 s take. right: the spectrum of the mix\u2019s loudness swings at a run.', font=f13, fill=DIM)

# ---- left: step peaks per gait, each way ----------------------------------------------------
x0, x1, y0, y1 = 70, 470, 128, 430
d.rectangle([x0, y0, x1, y1], outline=GRID)
d.text((x0, y0 - 22), 'how hard a footstep lands', font=f16, fill=INK)
vals = {(name, gait): step_peaks(os.path.join(folder, f'{gait}-steps-on.wav'), lead) for name, folder in sides for gait in ('walk', 'run')}
lo = min(v.min() for v in vals.values())
hi = max(v.max() for v in vals.values())
span = (hi - lo) or 1
for gl in range(int(lo // 3 * 3), int(hi) + 3, 3):
    yy = y1 - (y1 - y0 - 20) * (gl - lo) / span - 10
    if y0 < yy < y1:
        d.line([(x0, yy), (x1, yy)], fill=GRID)
        d.text((x0 - 44, yy - 8), f'{gl:>4} dB', font=f13, fill=DIM)
def centred(text, cx, y, f, fill):
    d.text((cx - d.textlength(text, font=f) / 2, y), text, font=f, fill=fill)


for k, (name, _) in enumerate(sides):
    for g, gait in enumerate(('walk', 'run')):
        cx = x0 + (x1 - x0) * (0.12 + 0.22 * g + 0.54 * k)
        v = vals[(name, gait)]
        for s in v:
            yy = y1 - (y1 - y0 - 20) * (s - lo) / span - 10
            d.ellipse([cx - 2, yy - 2, cx + 2, yy + 2], fill=COL[gait])
        med = float(np.median(v))
        yy = y1 - (y1 - y0 - 20) * (med - lo) / span - 10
        d.line([(cx - 30, yy), (cx + 30, yy)], fill=COL[gait], width=2)
        centred(gait, cx, y1 + 6, f13, COL[gait])
    gap = float(np.median(vals[(name, 'run')])) - float(np.median(vals[(name, 'walk')]))
    cx = x0 + (x1 - x0) * (0.23 + 0.54 * k)
    centred(name, cx, y1 + 28, f16, INK)
    centred(f'a run {gap:+.2f} dB over a walk', cx, y1 + 50, f13, DIM)

# ---- right: the envelope spectrum at a run ---------------------------------------------------
x0, x1 = 600, 1010
d.rectangle([x0, y0, x1, y1], outline=GRID)
d.text((x0, y0 - 46), 'and the rhythm it must not hand back', font=f16, fill=INK)
step_hz = SPEED['run'] / STRIDE['run']
curves = {}
for name, folder in sides:
    sig, rate = read(os.path.join(folder, 'run-mix-on.wav'))
    spec, f = env_spectrum(sig, rate, lead)
    band = (f >= LO) & (f <= HI)
    bg = float(np.median(spec[band]))
    sm = np.convolve(spec[band], np.ones(3) / 3, mode='same')
    curves[name] = (f[band], 10 * np.log10(np.maximum(sm, 1e-30) / bg), WAS if name == 'compressor' else NOW, line(spec, f, step_hz) - line(spec, f, BEAT_HZ))
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
for hz, label in ((BEAT_HZ, 'the music'), (step_hz, 'his feet')):
    xx = x0 + (x1 - x0) * (math.log(hz / LO) / math.log(HI / LO))
    for yy in range(y0, y1, 8):
        d.line([(xx, yy), (xx, yy + 4)], fill=(78, 84, 92))
    w = d.textlength(label, font=f13)
    d.text((xx - w / 2, y0 - 22), label, font=f13, fill=INK)
for name, (f, v, col, over) in curves.items():
    pts = [(x0 + (x1 - x0) * (math.log(max(ff, LO) / LO) / math.log(HI / LO)), y1 - (y1 - y0) * (min(vv, top) - bot) / (top - bot)) for ff, vv in zip(f, v)]
    d.line(pts, fill=col, width=2)
for k, (name, (_, _, col, over)) in enumerate(curves.items()):
    d.text((x0 + 10, y1 + 26 + k * 20), f'{name:14} his feet {over:+.1f} dB against the music', font=f13, fill=col)

im.save(a.out, quality=92)
print(f'wrote {a.out}')
