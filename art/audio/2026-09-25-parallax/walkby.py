#!/usr/bin/env python3
"""walkby.py -- how far from its own tree each call came from.

    python3 art/audio/2026-09-25-parallax/walkby.py --takes /tmp/parallax \
        --out art/audio/2026-09-25-parallax/walkby.jpg

`perchSpots` says where the six birds are, in world metres. `birdSpots` says the bearing and the
distance each call was actually given, and the context time it sounded. A `pass` walks a known line
at a known speed with the facing along it, so the listener's place and facing at any moment are
exact. Everything needed to say "that call came from 34 degrees off where its tree is" is therefore
in the render, with no audio analysis at all.

Reported per take:

  bearing   the pan the bed used against the pan the tree asks for, in pan units and in degrees
  distance  the distance the bed used against the real one, in metres, and what that is worth in
            level (a call is scaled by 1 - 0.66 * distance, and filtered at 7000 - 5200 * distance)

The `still` take is the control: he never leaves the spot, so both errors must be zero in every
version of the code, and any reading there is the instrument's own.
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PERCH_PAN = 0.85
PERCH_FAR_M = 28.0

# ---- reading a call's place in the field out of the stereo file ---------------------------------
# The same estimator as `2026-09-25-turning/spin.py`, and for the same reason it is needed twice:
# `birdSpots` publishes the pan the SCHEDULER decided, four seconds before the call is heard, and
# what this branch changes is what the voice does after that. Only the file knows.
WIN, HOP = 0.08, 0.02
BANDS = {'whistle': (1800, 4000), 'trill': (2400, 4200), 'chirps': (1500, 4200), 'knock': (900, 2600), 'warble': (1100, 2200), 'coo': (350, 700)}


def read_stereo(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    x = x.reshape(-1, ch)
    return x[:, 0], x[:, 1] if ch > 1 else x[:, 0], rate


def stft(x, rate):
    n = int(round(WIN * rate))
    n += n % 2
    step = int(round(HOP * rate))
    w = np.hanning(n)
    frames = 1 + max(0, (len(x) - n)) // step
    idx = np.arange(n)[None, :] + step * np.arange(frames)[:, None]
    return np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2, np.fft.rfftfreq(n, 1 / rate)


def heard_pan(lp, rp, t0, over_db=12.0, frames=6):
    """the pan of the first `frames` of a call, against the bed measured in the second before it"""
    i0 = int(round(t0 / HOP))
    b0, b1 = i0 - int(0.75 / HOP), i0 - int(0.2 / HOP)
    if b0 < 0 or i0 + 40 >= len(lp):
        return None
    bl, br = float(np.median(lp[b0:b1])), float(np.median(rp[b0:b1]))
    thr = (bl + br) * (10 ** (over_db / 10) - 1)
    got = []
    for k in range(40):
        dl, dr = lp[i0 + k] - bl, rp[i0 + k] - br
        if dl <= 0 or dr <= 0 or dl + dr <= thr:
            if got:
                break
            continue
        got.append(4 / math.pi * math.atan(math.sqrt(dr / dl)) - 1)
        if len(got) >= frames:
            break
    return float(np.median(got)) if len(got) >= 3 else None


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def at_time(take, lead, t):
    """where he is and which way he faces at context time `t`, from the pass geometry"""
    ax, az = take['from']
    bx, bz = take['to']
    ln = math.hypot(bx - ax, bz - az) or 1.0
    travel = max(0.0, (t - lead) * take['speed']) / ln
    leg = travel % 2
    u = (leg if leg <= 1 else 2 - leg) if take.get('loop') else min(1.0, travel)
    way = -1 if (take.get('loop') and leg > 1) else 1
    return (ax + (bx - ax) * u, az + (bz - az) * u), (way * (bx - ax) / ln, way * (bz - az) / ln)


def pan_for(fwd, to):
    """the one place the convention lives, in python: ambience.ts `panFor`"""
    ln = math.hypot(to[0], to[1]) or 1.0
    return max(-1.0, min(1.0, (to[0] * -fwd[1] + to[1] * fwd[0]) / ln))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/parallax')
ap.add_argument('--out', default='')
a = ap.parse_args()

rows = []
for tag in ('before', 'after'):
    p = os.path.join(a.takes, f'takes-{tag}.json')
    if not os.path.exists(p):
        continue
    meta = json.load(open(p))
    for take in meta['takes']:
        perch = {k: (x, z) for k, x, z in take['perches']}
        wav = os.path.join(a.takes, f"{take['id']}-{tag}.wav")
        band = {}
        if os.path.exists(wav):
            l, r, rate = read_stereo(wav)
            ls, freqs = stft(l, rate)
            rs, _ = stft(r, rate)
            band = {k: (ls[:, (freqs >= b[0]) & (freqs < b[1])].sum(axis=1), rs[:, (freqs >= b[0]) & (freqs < b[1])].sum(axis=1)) for k, b in BANDS.items()}
        calls = []
        for kind, pan, dist, at in take['spots']:
            if kind not in perch:
                continue
            (lx, lz), fwd = at_time(take, meta['lead'], at)
            tx, tz = perch[kind]
            d = math.hypot(tx - lx, tz - lz)
            want_pan = pan_for(fwd, (tx - lx, tz - lz)) * PERCH_PAN
            want_dist = min(1.0, d / PERCH_FAR_M)
            got = heard_pan(*band[kind], at) if kind in band else None
            calls.append(
                {
                    'kind': kind,
                    'at': at,
                    'pan': pan,
                    'heard': got,
                    'wantPan': want_pan,
                    'dist': dist,
                    'wantDist': want_dist,
                    'd': d,
                    # the angle the pan error is worth, at the bearing the tree is really at
                    'degrees': abs(math.degrees(math.asin(max(-1, min(1, pan / PERCH_PAN)))) - math.degrees(math.asin(max(-1, min(1, want_pan / PERCH_PAN))))),
                    # what the distance error is worth in level: a call is scaled by 1 - 0.66 * d
                    'dB': abs(20 * math.log10(max(1 - 0.66 * dist, 1e-3) / max(1 - 0.66 * want_dist, 1e-3))),
                }
            )
        if not calls:
            continue
        lean = [abs(c['heard'] - c['wantPan']) for c in calls if c['heard'] is not None]
        rows.append(
            {
                'tag': tag,
                'id': take['id'],
                'note': take['note'],
                'n': len(calls),
                'nHeard': len(lean),
                'heard': float(np.median(lean)) if lean else float('nan'),
                'heardMax': float(np.max(lean)) if lean else float('nan'),
                'pan': float(np.median([abs(c['pan'] - c['wantPan']) for c in calls])),
                'panMax': float(np.max([abs(c['pan'] - c['wantPan']) for c in calls])),
                'deg': float(np.median([c['degrees'] for c in calls])),
                'degMax': float(np.max([c['degrees'] for c in calls])),
                'm': float(np.median([abs(c['dist'] - c['wantDist']) * PERCH_FAR_M for c in calls])),
                'mMax': float(np.max([abs(c['dist'] - c['wantDist']) * PERCH_FAR_M for c in calls])),
                'dB': float(np.median([c['dB'] for c in calls])),
                'dBMax': float(np.max([c['dB'] for c in calls])),
                'calls': calls,
            }
        )

print('how far from its own tree a call arrived. "booked" is what the scheduler decided, four')
print('seconds early; "heard" is where the voice actually was, read out of the stereo file.\n')
print(f"{'take':16} {'calls':>5}   {'booked off':>10} {'as an angle':>12}   {'heard off':>9} {'worst':>7} {'n':>3}   {'distance off':>12} {'worst':>7}  {'in level':>8}")
for r in rows:
    print(
        f"{r['tag'] + ' ' + r['id']:16} {r['n']:>5}   {r['pan']:>10.3f} {r['deg']:>11.1f}\u00b0   "
        f"{r['heard']:>9.3f} {r['heardMax']:>7.3f} {r['nHeard']:>3}   {r['m']:>9.1f} m {r['mMax']:>5.1f} m  {r['dB']:>6.2f} dB"
    )

if not a.out:
    raise SystemExit(0)

# ---- the figure: every call, where it came from against where its tree is ----------------------
ids = [r['id'] for r in rows if r['tag'] == 'before']
W, H = 300 * len(ids) + 130, 730
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
BEFORE, AFTER, WANT = (226, 106, 106), (120, 214, 150), (244, 214, 120)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'Every call over two minutes: where it was heard from, against where its tree is', font=f22, fill=INK)
d.text((28, 48), 'each pair is one call — the gold ring is the tree\u2019s own bearing, the filled dot is what came out of the file. Up is right.', font=f13, fill=DIM)
d.text((28, 66), 'in the lower row the rings are behind the dots, which is the result: the call and the tree are in the same place.', font=f13, fill=DIM)
for row_i, tag in enumerate(('before', 'after')):
    y0 = 112 + row_i * 300
    colour = BEFORE if tag == 'before' else AFTER
    d.text((28, y0 - 24), f'{tag} — a perch is a bearing from where the wood was drawn' if tag == 'before' else f'{tag} — a perch is a place, and he walks round it', font=f16, fill=colour)
    for col, tid in enumerate(ids):
        x0 = 110 + col * 300
        x1 = x0 + 260
        y1 = y0 + 240
        d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
        d.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)], fill=(38, 42, 48))
        r = next((q for q in rows if q['tag'] == tag and q['id'] == tid), None)
        if not r:
            continue
        span = max(c['at'] for c in r['calls']) or 1
        for c in r['calls']:
            if c['heard'] is None:
                continue
            x = x0 + (x1 - x0) * c['at'] / span
            yw = (y0 + y1) / 2 - ((y1 - y0) / 2) * max(-1, min(1, c['wantPan'] / PERCH_PAN))
            yg = (y0 + y1) / 2 - ((y1 - y0) / 2) * max(-1, min(1, c['heard'] / PERCH_PAN))
            d.line([(x, yw), (x, yg)], fill=(58, 62, 70))
            d.ellipse([x - 3, yw - 3, x + 3, yw + 3], outline=WANT)
            d.ellipse([x - 3, yg - 3, x + 3, yg + 3], fill=colour)
        d.text((x0 + 6, y1 - 20), f"heard {r['heard']:.3f} off, worst {r['heardMax']:.3f}", font=f13, fill=INK)
        short = {'still': 'standing still — the control', 'walk': 'pacing the line at a walk', 'run': 'pacing the same line at a run'}
        d.text((x0, y1 + 6), f"{tid} — {short.get(tid, '')}", font=f13, fill=DIM)
    d.text((24, y0 + 108), 'right', font=f13, fill=DIM)
    d.text((24, y0 + 138), 'left', font=f13, fill=DIM)
im.save(a.out, quality=92)
print(f'wrote {a.out}')
