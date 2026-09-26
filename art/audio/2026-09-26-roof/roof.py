#!/usr/bin/env python3
"""roof.py -- what a roof of leaves is actually worth, per band.

    python3 art/audio/2026-09-26-roof/roof.py --takes /tmp/canopy

Rubric check 10 is *a roof over him changes the sound (level, colour, or both) and the change is
measurable*, scored 3 on "+2.9 dB between gusts, reproduced at a second spot". That is a level,
and `2026-09-25-places` established that **colour is what tells one open place from another** —
level is the axis that check was mis-scored on the first time round.

The canopy term does five things (`ambience.ts`): `CANOPY_SHARE` on the roll's level,
`CANOPY_HALL` on the send, `CANOPY_FLUTTER` on the leaf rate, `flutterPan` on their width, and —
the one nobody has measured — `CANOPY_CLOSE` on `enclosureLp`, which every voice in the bed
passes through on its way out, birds and leaves included. At a closed canopy that filter sits at

    18000 * (900 / 18000) ** 0.5  =  4025 Hz

against 18 kHz in the open. Whether that is audible depends entirely on what the bed has up there
to lose, and an earlier attempt at a canopy filter was reverted for exactly that reason: *"a
filter cannot take away what is not there."*

So: the same spot, the same seed, the term forced to 0, 0.5 and 1, measured per band on the
always-on level (the 10th percentile over time, which is what the owner's complaint is scored on)
and on the loud moments (the 99th, which is where the birds are).
"""
import argparse
import json
import math
import os
import wave

import numpy as np

BANDS = [(60, 250), (250, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]
LEAD = 8.0


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def band_pct(x, rate, lo, hi, pct, win=0.05):
    n = 1 << int(np.floor(np.log2(len(x))))
    f = np.fft.rfftfreq(n, 1 / rate)
    s = np.fft.rfft(x[:n])
    s[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(s, n)
    k = int(rate * win)
    y = y[: len(y) // k * k].reshape(-1, k)
    return db(np.percentile(np.sqrt((y**2).mean(axis=1)), pct))


def aweight(f):
    f = max(f, 1e-6)
    f2 = f * f
    ra = (12194**2 * f2**2) / ((f2 + 20.6**2) * math.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194**2))
    return 20 * math.log10(ra) + 2.0


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/canopy')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'term.json')))
values = meta.get('values') or [0, 0.5, 1]
takes = {}
for v in values:
    for name in (f'canopy-{v}.wav', f'{v}.wav', f'canopy{v}.wav'):
        p = os.path.join(a.takes, name)
        if os.path.exists(p):
            takes[v] = read(p)
            break
if len(takes) < 2:
    raise SystemExit(f'found {len(takes)} takes in {a.takes}: {sorted(os.listdir(a.takes))}')

rate = next(iter(takes.values()))[1]
head = int(LEAD * rate)

for pct, what in ((10, 'the always-on level (the 10th percentile over time)'), (99, 'the loud moments (the 99th — where the birds are)')):
    print(f'\n{what}\n')
    print(f"{'band':>14} " + ' '.join(f'canopy {v}'.rjust(11) for v in values) + '   open to closed')
    for lo, hi in BANDS:
        vals = [band_pct(takes[v][0][head:], rate, lo, hi, pct) for v in values]
        print(f'   {lo}-{hi} Hz'.ljust(17) + ' '.join(f'{x:8.1f} dB' for x in vals) + f'   {vals[-1] - vals[0]:>+8.1f} dB')
    # and the same thing as one number a listener would agree with
    tot = []
    for v in values:
        p = 0.0
        for lo, hi in BANDS:
            p += 10 ** ((band_pct(takes[v][0][head:], rate, lo, hi, pct) + aweight(math.sqrt(lo * hi))) / 10)
        tot.append(10 * math.log10(max(p, 1e-30)))
    print(f"   {'A-weighted':14} " + ' '.join(f'{x:8.1f} dB' for x in tot) + f'   {tot[-1] - tot[0]:>+8.1f} dB')

print('\nand the colour alone — each take normalised to its own broadband level, so only shape is left\n')
ref = None
for v in values:
    x = takes[v][0][head:]
    shape = np.array([band_pct(x, rate, lo, hi, 10) for lo, hi in BANDS])
    shape = shape - 10 * math.log10(sum(10 ** (s / 10) for s in shape))
    if ref is None:
        ref = shape
    rms = math.sqrt(float(((shape - ref) ** 2).mean()))
    print(f'   canopy {v}: {rms:.2f} dB of shape away from the open sky')
print('\n   `2026-09-25-places` measured the thirteen surveyed spots 0.2 to 10.2 dB apart in shape,')
print('   median 4.3. That is the scale this number is read against.')
