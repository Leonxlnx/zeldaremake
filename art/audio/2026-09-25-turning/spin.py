#!/usr/bin/env python3
"""spin.py -- does a bird move across the field while he turns, or stay nailed where it was booked?

    python3 art/audio/2026-09-25-turning/spin.py --takes /tmp/spin \
        --out art/audio/2026-09-25-turning/spin.jpg

A bird's pan is `sin(bearing - facing)`, and `scheduleBirds` works it out on a four-second
lookahead. If the pan is decided once, a call heard while the listener is turning stays exactly
where it was booked for its whole length; if it follows him, it sweeps across the field at the turn
rate. That is the signature this measures, and it needs no ground truth about where the perch is:
the bird's own movement during its own call either happens or it does not.

The pan is read out of the stereo file. `StereoPannerNode` is equal-power, so a source at pan p
arrives as L = cos((p+1)pi/4), R = sin((p+1)pi/4) and p = 4/pi * atan(R/L) - 1. The bed underneath
is panned too (the leaf roll leans with the wind), so each call's L and R are taken against the
background measured in the second before it, and only frames where the call stands 6 dB over that
background are used.

Call times come from the render itself: `renderOffline` now hands back the bed's stats, and
`birdSpots` carries the context time each call was booked to sound.
"""
import argparse
import json
import math
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def read_stereo(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    x = x.reshape(-1, ch)
    return x[:, 0], x[:, 1] if ch > 1 else x[:, 0], rate


WIN = 0.08
HOP = 0.02
# each kind sings in its own part of the spectrum (`birdCall`), and a band that fits the whistle is
# 2 kHz above the dove. Reading each call in its own band is what brought the still-listener control
# down from 0.45 pan units of apparent movement to 0.15.
BANDS = {
    'whistle': (1800, 4000),
    'trill': (2400, 4200),
    'chirps': (1500, 4200),
    'knock': (900, 2600),
    'warble': (1100, 2200),
    'coo': (350, 700),
}


def stft(x, rate, win=WIN, hop=HOP):
    """|X|^2 once per channel; a band is then a slice of it rather than another transform"""
    n = int(round(win * rate))
    n += n % 2
    step = int(round(hop * rate))
    w = np.hanning(n)
    frames = 1 + max(0, (len(x) - n)) // step
    idx = np.arange(n)[None, :] + step * np.arange(frames)[:, None]
    return np.abs(np.fft.rfft(x[idx] * w, axis=1)) ** 2, np.fft.rfftfreq(n, 1 / rate)


def band_power(spec, freqs, lo, hi):
    return spec[:, (freqs >= lo) & (freqs < hi)].sum(axis=1)


def pan_of(l, r):
    """the equal-power pan a left/right pair implies, -1 hard left to +1 hard right"""
    l = max(l, 1e-20)
    r = max(r, 1e-20)
    return 4 / math.pi * math.atan(math.sqrt(r / l)) - 1


def sweep(lp, rp, t0, length=1.1, back=(0.75, 0.2), over_db=12.0):
    """
    Where the call sits in the field, frame by frame, for as long as it stands over the bed.

    Returns (times, pans) with times relative to the call's onset. The background is the median of
    the second before it, subtracted in power -- the bed does not stop while a bird sings, and it is
    panned itself, so a raw L/R of the mixture is the bed's pan as much as the bird's.

    The run is CONTIGUOUS from the first frame that qualifies and stops at the first that does not.
    Skipping past failing frames instead stitched a leaf flutter arriving halfway through a call
    onto the same straight line as the call, which produced slopes of 1.3 pan/s in the standing
    control -- a listener who is not turning, where the true answer is exactly zero.
    """
    i0 = int(round(t0 / HOP))
    b0, b1 = i0 - int(back[0] / HOP), i0 - int(back[1] / HOP)
    if b0 < 0 or i0 + int(length / HOP) >= len(lp):
        return np.array([]), np.array([])
    bl = float(np.median(lp[b0:b1]))
    br = float(np.median(rp[b0:b1]))
    thr = (bl + br) * (10 ** (over_db / 10) - 1)
    ts, ps = [], []
    for k in range(int(length / HOP)):
        i = i0 + k
        dl = lp[i] - bl
        dr = rp[i] - br
        if dl <= 0 or dr <= 0 or dl + dr <= thr:
            if ts:
                break
            continue
        p = pan_of(dl, dr)
        # A pan cannot move faster than the turn does: at the fastest rate here that is 0.018 pan
        # units between frames, so a jump of MAX_JUMP is ten times anything real and means the
        # estimate has lost the bird -- a trill's own 30 Hz envelope beating against the frame rate,
        # or a leaf turning over on one side of him. The run ends there.
        if ps and abs(p - ps[-1]) > MAX_JUMP:
            break
        ts.append(k * HOP)
        ps.append(p)
    return np.array(ts), np.array(ps)


MAX_JUMP = 0.2


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/spin')
ap.add_argument('--out', default='')
a = ap.parse_args()

PERCH_PAN = 0.85
rows = []
for tag in ('before', 'after'):
    p = os.path.join(a.takes, f'takes-{tag}.json')
    if not os.path.exists(p):
        continue
    meta = json.load(open(p))
    for take in meta['takes']:
        l, r, rate = read_stereo(os.path.join(a.takes, f"spin-{take['turn']}-{tag}.wav"))
        ls, freqs = stft(l, rate)
        rs, _ = stft(r, rate)
        band = {k: (band_power(ls, freqs, *b), band_power(rs, freqs, *b)) for k, b in BANDS.items()}
        spans, slopes, calls = [], [], []
        for kind, pan, dist, at in take['spots']:
            lp, rp = band[kind]
            ts, ps = sweep(lp, rp, at)
            if len(ts) < 6:
                continue
            spans.append(float(ps.max() - ps.min()))
            slopes.append(float(np.polyfit(ts, ps, 1)[0]))
            calls.append({'kind': kind, 'at': at, 'booked': pan, 't': ts.tolist(), 'p': ps.tolist()})
        if not spans:
            continue
        # What the turn rate asks of a call: d(pan)/dt = PERCH_PAN * omega * cos(bearing - facing).
        # The MEDIAN of that over calls caught at unrelated facings is 0.707 of its maximum, since
        # the median of |cos| is 1/sqrt(2) — so that, and not the maximum, is what the median of the
        # measurements has to be compared with.
        want = PERCH_PAN * math.radians(take['turn'])
        rows.append(
            {
                'tag': tag,
                'turn': take['turn'],
                'n': len(spans),
                'span': float(np.median(spans)),
                'slope': float(np.median(np.abs(slopes))),
                'want': want,
                'wantMedian': want / math.sqrt(2),
                'calls': calls,
            }
        )

print(f"{'take':18} {'calls':>5} {'median sweep':>13} {'median |slope|':>15} {'the turn asks of the median':>28}")
for r in rows:
    print(f"{r['tag'] + ' @ ' + str(r['turn']) + ' deg/s':18} {r['n']:>5} {r['span']:>12.3f}  {r['slope']:>13.3f}    {r['wantMedian']:>24.3f} pan/s")

if not a.out:
    raise SystemExit(0)

# ---- the figure: every call's path across the field, before against after ----------------------
turns = sorted({r['turn'] for r in rows})
W, H = 260 * len(turns) + 120, 740
BG, INK, DIM = (17, 19, 22), (238, 240, 243), (120, 128, 138)
BEFORE, AFTER = (226, 106, 106), (120, 214, 150)
im = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(im)
f13, f16, f22 = font(13), font(16), font(22)
d.text((28, 20), 'One bird, one call: where it sits in the stereo field while he turns', font=f22, fill=INK)
d.text((28, 48), 'each line is one call, up to 1.1 s of it; up is right, down is left. A call that follows him leans; a call booked once is flat.', font=f13, fill=DIM)
d.text((28, 66), 'the two grey guides in each panel are the steepest lean that turn rate allows \u2014 a bird dead ahead of him, or dead behind', font=f13, fill=DIM)
for row_i, tag in enumerate(('before', 'after')):
    y0 = 112 + row_i * 300
    colour = BEFORE if tag == 'before' else AFTER
    d.text((28, y0 - 24), f"{tag} \u2014 the pan decided once, on a 4 s lookahead" if tag == 'before' else f'{tag} \u2014 the pan follows his facing', font=f16, fill=colour)
    for col, turn in enumerate(turns):
        x0 = 100 + col * 260
        x1 = x0 + 220
        y1 = y0 + 250
        d.rectangle([x0, y0, x1, y1], outline=(44, 48, 54))
        d.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2)], fill=(38, 42, 48))
        d.text((x0, y1 + 6), f'turning {turn}\u00b0/s', font=f13, fill=DIM)
        row = next((q for q in rows if q['tag'] == tag and q['turn'] == turn), None)
        if not row:
            continue
        # the steepest a call may lean at this rate: PERCH_PAN * omega, for a bird dead ahead
        if row['want'] > 0:
            dy = ((y1 - y0) / 2) * min(1, row['want'] * 1.1)
            for s in (-1, 1):
                d.line([(x0, (y0 + y1) / 2), (x1, (y0 + y1) / 2 - s * dy)], fill=(74, 80, 88), width=1)
        for c in row['calls']:
            pts = [(x0 + (x1 - x0) * min(1, t / 1.1), (y0 + y1) / 2 - ((y1 - y0) / 2) * max(-1, min(1, p))) for t, p in zip(c['t'], c['p'])]
            if len(pts) > 1:
                d.line(pts, fill=colour, width=2)
        d.text((x0 + 6, y1 - 20), f"median lean {row['slope']:.2f} of {row['wantMedian']:.2f} pan/s", font=f13, fill=INK)
    d.text((24, y0 + 118), 'right', font=f13, fill=DIM)
    d.text((24, y0 + 148), 'left', font=f13, fill=DIM)
im.save(a.out, quality=92)
print(f'wrote {a.out}')
