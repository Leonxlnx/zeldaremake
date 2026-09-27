#!/usr/bin/env python3
"""pad.py -- the sfx compressor against a plain gain doing the same job.

    python3 art/audio/2026-09-26-pad/pad.py --takes /tmp/pad

The compressor on the sfx bus was added to stop the player's footsteps being the strongest rhythm
in the mix. It works, and three later measurements say it is an odd way to do it: every step is in
full four-to-one compression, so it is a fixed pad with a wobble; the wobble is worth 0.4 dB across
a factor of sixteen in release; and it flattens a run into a walk.

So set them the same task. Pick the pad that lands a run's step rate exactly where the shipped
compressor lands it, and then compare what each charges for that result:

  the step level     how loud the player's own footsteps are, which is what a pad spends
  the gait gap       how far a run peaks over a walk -- the one thing the player's feet tell him
                     about his own speed, and the thing four-to-one compression squeezes out
  the crest          peak over rms within a step: whether a boot still sounds like a boot landing
                     or like a boot being turned down while it lands

The bypassed path is linear, so every pad is arithmetic on takes already made -- the same trick
`-release/price.py` used: with the dry steps rendered once, a pad of p dB is exactly
`mix_off - (1 - 10**(-p/20)) * dry_off`.
"""
import argparse
import json
import math
import os
import wave

import numpy as np

BEAT_HZ = 1.2
STRIDE = {'walk': 0.44, 'run': 0.60}
SPEED = {'walk': 1.2, 'run': 2.2}


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def env_spectrum(x, rate, lead):
    x = x[int(lead * rate) :]
    env = np.abs(x)
    k = int(rate / 200)
    env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
    env = env - env.mean()
    n = 1 << int(np.floor(np.log2(len(env))))
    return np.abs(np.fft.rfft(env[:n] * np.hanning(n))) ** 2, np.fft.rfftfreq(n, k / rate)


def line(spec, f, hz, half=0.25, lo=0.4, hi=8.0):
    near = (f >= hz - half) & (f <= hz + half)
    around = (f >= lo) & (f <= hi)
    return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[around])), 1e-30))


def over_beat(mix, rate, lead, step_hz):
    spec, f = env_spectrum(mix, rate, lead)
    return line(spec, f, step_hz) - line(spec, f, BEAT_HZ)


def envelope(x, rate, win=0.004):
    n = max(2, int(win * rate))
    return np.sqrt(np.convolve(x * x, np.ones(n) / n, mode='same'))


def onsets(x, rate, min_gap):
    """peaks in the envelope's rise, at least `min_gap` apart -- the `-perstep` detector"""
    e = envelope(x, rate)
    d = np.diff(e, prepend=e[0])
    thr = np.percentile(d, 99.0)
    gap = int(min_gap * rate)
    out, i = [], 0
    while i < len(d):
        if d[i] > thr:
            j = min(len(e), i + int(0.02 * rate))
            out.append(int(i + np.argmax(e[i:j])) if j > i else i)
            i += gap
        else:
            i += 1
    return np.array(out)


def step_shape(steps, rate, lead):
    """the median step's peak, and its crest over the 40 ms it lives in"""
    x = steps[int(lead * rate) :]
    n = int(0.04 * rate)
    # 150 ms apart: a walk's stride is 367 ms and a run's 273, and a heel and its toe are 50-100
    at = onsets(x, rate, 0.15)
    peaks, crests = [], []
    for i in at:
        seg = x[i : i + n]
        if len(seg) < n:
            continue
        pk = float(np.abs(seg).max())
        rms = float(np.sqrt((seg**2).mean())) or 1e-12
        peaks.append(pk)
        crests.append(db(pk) - db(rms))
    return db(np.median(peaks)), float(np.median(crests)), len(peaks)


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/pad')
ap.add_argument('--pads', default='0,2,4,6,8,10,12,14')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'takes.json')))
lead = meta['lead']
pads = [float(v) for v in a.pads.split(',')]

shipped = {}
print('the shipped path -- compressor, its makeup gain, and the trim that takes both back\n')
print(f"{'gait':6} {'step over beat':>15} {'step peak':>10} {'crest':>8} {'steps':>7}")
for gait in ('run', 'walk'):
    mix, rate = read(os.path.join(a.takes, f'{gait}-mix-on.wav'))
    steps, _ = read(os.path.join(a.takes, f'{gait}-steps-on.wav'))
    ob = over_beat(mix, rate, lead, SPEED[gait] / STRIDE[gait])
    pk, crest, n = step_shape(steps, rate, lead)
    shipped[gait] = {'over': ob, 'peak': pk, 'crest': crest}
    print(f'{gait:6} {ob:>+12.1f} dB {pk:>7.1f} dB {crest:>5.1f} dB {n:>7}')
print(f"       a run peaks {shipped['run']['peak'] - shipped['walk']['peak']:+.2f} dB over a walk")

print('\n\na plain gain on the bypassed path, doing the same job\n')
rows = {}
for gait in ('run', 'walk'):
    mix, rate = read(os.path.join(a.takes, f'{gait}-mix-off.wav'))
    steps, _ = read(os.path.join(a.takes, f'{gait}-steps-off.wav'))
    dry, _ = read(os.path.join(a.takes, f'{gait}-dry-off.wav'))
    n = min(len(mix), len(steps), len(dry))
    mix, steps, dry = mix[:n], steps[:n], dry[:n]
    step_hz = SPEED[gait] / STRIDE[gait]
    print(f'{gait} at {SPEED[gait]} m/s')
    print(f"{'pad':>6} {'step over beat':>15} {'step peak':>10} {'crest':>8}")
    rows[gait] = []
    for p in pads:
        g = 10 ** (-p / 20)
        ob = over_beat(mix - (1 - g) * dry, rate, lead, step_hz)
        pk, crest, _ = step_shape(steps - (1 - g) * dry, rate, lead)
        rows[gait].append((p, ob, pk, crest))
        mark = '   <- matches the compressor' if abs(ob - shipped[gait]['over']) < 0.35 else ''
        print(f'{-p:>3.0f} dB {ob:>+12.1f} dB {pk:>7.1f} dB {crest:>5.1f} dB{mark}')
    print()


def pad_for(gait, target):
    """the pad that lands the step rate where the compressor lands it, straight-lined"""
    r = rows[gait]
    for i in range(1, len(r)):
        (p0, v0, _, _), (p1, v1, _, _) = r[i - 1], r[i]
        if (v0 - target) * (v1 - target) <= 0 and v0 != v1:
            return p0 + (p1 - p0) * (target - v0) / (v1 - v0)
    return None


def interp(gait, p, col):
    r = rows[gait]
    for i in range(1, len(r)):
        if p <= r[i][0]:
            (p0, *v0), (p1, *v1) = r[i - 1], r[i]
            return v0[col] + (v1[col] - v0[col]) * (p - p0) / (p1 - p0)
    return r[-1][1 + col]


print('the same result, and what each charges for it\n')
p = pad_for('run', shipped['run']['over'])
if p is None:
    print('   no pad in the sweep reaches the compressor\u2019s result')
else:
    pk_run, pk_walk = interp('run', p, 1), interp('walk', p, 1)
    print(f"{'':26} {'run step rate':>14} {'step peak':>10} {'crest':>8} {'gait gap':>10}")
    print(f"   {'compressor + trim':22} {shipped['run']['over']:>+11.1f} dB {shipped['run']['peak']:>7.1f} dB {shipped['run']['crest']:>5.1f} dB {shipped['run']['peak'] - shipped['walk']['peak']:>+7.2f} dB")
    print(f"   {f'a plain {p:.1f} dB pad':22} {interp('run', p, 0):>+11.1f} dB {pk_run:>7.1f} dB {interp('run', p, 2):>5.1f} dB {pk_run - pk_walk:>+7.2f} dB")
    print(f"\n   the pad buys the same rhythm with {pk_run - shipped['run']['peak']:+.1f} dB of step level")
    print(f"   and hands back {(pk_run - pk_walk) - (shipped['run']['peak'] - shipped['walk']['peak']):+.2f} dB of the difference between a walk and a run")
