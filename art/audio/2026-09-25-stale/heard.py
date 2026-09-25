#!/usr/bin/env python3
"""heard.py -- did each call actually arrive at the loudness and colour the geometry asks for?

    python3 art/audio/2026-09-25-stale/heard.py --takes /tmp/stale \
        --out art/audio/2026-09-25-stale/heard.jpg

`stale.mjs` says what a call was given at booking against what it should have at sounding four
seconds later. That is a property of the geometry and reads the same in both builds -- it is the
size of the problem, not the fix. This measures the fix, out of the two files.

For every call, in the band its own kind sings in:

  level   the energy over the call, before against after, in dB. The change the geometry asks for
          is 20*log10(reach(sounding) / reach(booking)), which `stale.json` carries per call.
  colour  how much of the call sits above 4 kHz, in dB relative to the whole of it. A call's top
          is cut at 7000 - 5200 * distance and multiplied by OCCLUSION_TOP ** shadow, and a
          centroid cannot see that move while the cutoff stays above most of the call's energy.

The `still` take is the control: he does not move, booking and sounding are the same place, and the
two files must be the same file.
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

WIN, HOP = 0.04, 0.01
BANDS = {'whistle': (1400, 6000), 'trill': (2000, 6000), 'chirps': (1200, 6000), 'knock': (700, 4000), 'warble': (900, 4000), 'coo': (300, 1600)}


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read_mono(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def spectrogram(x, rate):
    n = int(round(WIN * rate))
    n += n % 2
    step = int(round(HOP * rate))
    w = np.hanning(n)
    frames = 1 + max(0, len(x) - n) // step
    idx = np.arange(n)[None, :] + step * np.arange(frames)[:, None]
    return np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2, np.fft.rfftfreq(n, 1 / rate)


def call_level(spec, freqs, kind, t0, length=0.9, back=(0.8, 0.2)):
    """
    the call's own energy and its centroid, with the bed measured in the second before it taken off

    Both are on the RESIDUAL, because the bed does not stop while a bird sings and is most of what
    is in the band otherwise. A window that never clears the bed by 6 dB is dropped.
    """
    lo, hi = BANDS[kind]
    sel = (freqs >= lo) & (freqs < hi)
    i0 = int(round(t0 / HOP))
    b0, b1 = i0 - int(back[0] / HOP), i0 - int(back[1] / HOP)
    i1 = i0 + int(length / HOP)
    if b0 < 0 or i1 >= len(spec):
        return None
    bed = np.median(spec[b0:b1][:, sel], axis=0)
    res = np.clip(spec[i0:i1][:, sel] - bed[None, :], 0, None)
    tot = float(res.sum())
    if tot <= float(bed.sum()) * (10 ** 0.6 - 1) * (i1 - i0):
        return None
    f = freqs[sel]
    per = res.sum(axis=0)
    # the share of the call above 4 kHz, in dB. A centroid is the wrong tool for a lowpass that
    # sits above most of a bird's energy: a whistle at 2.7 kHz barely notices its cutoff moving
    # from 7 kHz to 3.7, but what is left of it above 4 kHz certainly does.
    top = float(per[f >= 4000].sum())
    return {'dB': 10 * math.log10(max(tot, 1e-20)), 'top': 10 * math.log10(max(top, 1e-20) / max(tot, 1e-20))}


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/stale')
ap.add_argument('--out', default='')
a = ap.parse_args()

model = {(t['tag'], t['id']): {round(r['at'], 3): r for r in t['rows']} for t in json.load(open(os.path.join(a.takes, 'stale.json')))['takes']}
meta = {tag: json.load(open(os.path.join(a.takes, f'takes-{tag}.json'))) for tag in ('before', 'after') if os.path.exists(os.path.join(a.takes, f'takes-{tag}.json'))}

rows = []
for take in meta['before']['takes']:
    tid = take['id']
    got = {}
    for tag in meta:
        x, rate = read_mono(os.path.join(a.takes, f'{tid}-{tag}.wav'))
        spec, freqs = spectrogram(x, rate)
        got[tag] = {round(at, 3): call_level(spec, freqs, kind, at) for kind, _, _, at in take['spots']}
    calls = []
    for kind, _, _, at in take['spots']:
        k = round(at, 3)
        b, f_ = got['before'].get(k), got['after'].get(k)
        m = model.get(('before', tid), {}).get(k)
        if not b or not f_ or not m:
            continue
        calls.append(
            {
                'kind': kind,
                'at': at,
                'dDb': f_['dB'] - b['dB'],
                # what the geometry asks: the distance's own share and the shadow's, both signed by
                # whether the world moved the call up or down
                'wantDb': m['wantDb'],
                'dTop': f_['top'] - b['top'],
                'wantHz': m['wantHz'],
            }
        )
    if calls:
        rows.append({'id': tid, 'note': take['note'], 'calls': calls})

print('what the two files differ by, per call, against what the geometry asked for\n')
print(f"{'take':6} {'calls':>5}   {'level moved':>11} {'asked':>7}   {'agree':>6}   {'top above 4k moved':>18}  {'cutoff asked':>12}")
for r in rows:
    d = np.array([c['dDb'] for c in r['calls']])
    w = np.array([c['wantDb'] for c in r['calls']])
    hz = np.array([c['dTop'] for c in r['calls']])
    hw = np.array([c['wantHz'] for c in r['calls']])
    agree = float(np.corrcoef(d, w)[0, 1]) if len(d) > 2 and d.std() > 1e-9 and w.std() > 1e-9 else float('nan')
    print(f"{r['id']:6} {len(d):>5}   {np.median(np.abs(d)):>8.2f} dB {np.median(np.abs(w)):>6.2f}   {agree:>6.2f}   {np.median(np.abs(hz)):>15.2f} dB  {np.median(np.abs(hw)):>10.0f} Hz")

if not a.out:
    raise SystemExit(0)

W, H = 1180, 440
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
DOT, LINE = (120, 214, 150), (244, 214, 120)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'Each call: how much its level moved between the two builds, against how much the world asked', font=f22, fill=INK)
d.text((28, 48), 'gold is the line they would sit on if every call arrived at the loudness its own distance and shadow ask for right now', font=f13, fill=DIM)
for col, r in enumerate(rows):
    x0 = 90 + col * 360
    x1 = x0 + 300
    y0, y1 = 100, 380
    d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
    lim = 5.0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sx, sy = (x1 - x0) / (2 * lim), (y1 - y0) / (2 * lim)
    d.line([(x0, cy), (x1, cy)], fill=(38, 42, 48))
    d.line([(cx, y0), (cx, y1)], fill=(38, 42, 48))
    d.line([(x0, cy + lim * sy), (x1, cy - lim * sy)], fill=LINE, width=1)
    for c in r['calls']:
        px = cx + max(-lim, min(lim, c['wantDb'])) * sx
        py = cy - max(-lim, min(lim, c['dDb'])) * sy
        d.ellipse([px - 4, py - 4, px + 4, py + 4], fill=DOT)
    d.text((x0 + 6, y0 + 6), f"{r['id']} — {len(r['calls'])} calls", font=f16, fill=INK)
    d.text((x0, y1 + 8), 'the world asked for (dB) \u2192', font=f13, fill=DIM)
    for v in (-4, -2, 2, 4):
        tx = cx + v * sx
        d.line([(tx, y1), (tx, y1 + 4)], fill=(70, 76, 84))
        d.text((tx - 6, y1 - 18), f'{v:+d}', font=f13, fill=(88, 94, 102))
        ty = cy - v * sy
        d.line([(x0, ty), (x0 + 4, ty)], fill=(70, 76, 84))
d.text((20, 105), 'moved', font=f13, fill=DIM)
d.text((20, 122), '(dB)', font=f13, fill=DIM)
im.save(a.out, quality=92)
print(f'wrote {a.out}')
