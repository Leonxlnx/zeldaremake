#!/usr/bin/env python3
"""after.py -- the same takes either side of the step cut, and the things it must not have broken.

    python3 art/audio/2026-09-26-release/after.py --before /tmp/release/before --after /tmp/release/after

`pulse.py` measures one render. This measures two and subtracts, because an after that measures
like its before is the failure mode this is guarding against.

The first sheet is the answer: how far the music's beat and the player's step rate each stand over
the background of the mix's envelope spectrum, and which of them is the strongest rhythm.

The rest is what a level change can quietly cost, each of which is checked rather than asserted:

  the control      the compressor-bypassed takes go nowhere near `SFX_TRIM`, so if the change did
                   only what it claims, they did not move. Not byte for byte: an offline render is
                   reproducible but not bit-identical -- two renders of the SAME code differ by
                   about -108 dB relative, which is the instrument's own floor. A real change shows
                   at -15 dB, so there are ninety decibels between "unchanged" and "changed" and
                   nothing to tune.
  the gait gap     a trim on the bus scales both gaits alike, so a run must still be as far over a
                   walk as it was. If this narrowed, the cut came off the wrong place.
  over the bed     the owner's other complaint is the background. A step buried under it would be
                   trading one complaint for the other.
  headroom         the steps are the loudest transient in the game, so the worst case the master is
                   staged against can only fall -- but it is measured here rather than argued.
  the tail         the hall answering a step is taken off the panner and bypasses the trim, so a
                   step necessarily gets that much wetter. This is the size of the side effect.
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


def env_spectrum(x, rate, lead):
    x = x[int(lead * rate) :]
    env = np.abs(x)
    k = int(rate / 200)
    env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
    env = env - env.mean()
    n = 1 << int(np.floor(np.log2(len(env))))
    spec = np.abs(np.fft.rfft(env[:n] * np.hanning(n))) ** 2
    return spec, np.fft.rfftfreq(n, k / rate)


def line(spec, f, hz, half=0.25, lo=0.4, hi=8.0):
    near = (f >= hz - half) & (f <= hz + half)
    around = (f >= lo) & (f <= hi)
    return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[around])), 1e-30))


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def floor_db(x, rate, lead, window=0.05):
    """the always-on level: the 10th percentile of the short-term rms over time, not the mean"""
    x = x[int(lead * rate) :]
    k = int(rate * window)
    x = x[: len(x) // k * k].reshape(-1, k)
    return db(np.percentile(np.sqrt((x**2).mean(axis=1)), 10))


def relative_diff_db(p0, p1):
    """how big before-minus-after is against the take itself, in dB"""
    a, _ = read(p0)
    b, _ = read(p1)
    n = min(len(a), len(b))
    a, b = a[:n], b[:n]
    return db(np.sqrt(((a - b) ** 2).mean())) - db(np.sqrt((a**2).mean()))


# the render's own floor is about -108 dB relative; a real change shows at -15. Anything under
# this did not move, and there is no value between here and a real change for the choice to matter.
UNCHANGED_DB = -80


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/release/before')
ap.add_argument('--after', default='/tmp/release/after')
a = ap.parse_args()

lead = json.load(open(os.path.join(a.before, 'takes.json')))['lead']
sides = (('before', a.before), ('after', a.after))

print("the mix's envelope: how far each rhythm stands over the background of its own spectrum\n")
print(f"{'gait':6} {'':8}   {'music 1.2 Hz':>13} {'step rate':>10} {'the step rate is':>17}")
for gait in ('run', 'walk'):
    step_hz = SPEED[gait] / STRIDE[gait]
    for name, d in sides:
        x, rate = read(os.path.join(d, f'{gait}-mix-on.wav'))
        spec, f = env_spectrum(x, rate, lead)
        beat, step = line(spec, f, BEAT_HZ), line(spec, f, step_hz)
        verdict = 'OVER the music' if step > beat else 'under the music'
        print(f'{gait:6} {name:>8}   {beat:>10.1f} dB {step:>7.1f} dB  {step - beat:>+7.1f} dB, {verdict}')
    print()

print('the control -- how much each take moved, against itself\n')
print(f"{'take':22} {'before minus after':>19}")
for gait in ('run', 'walk'):
    for stem, tag in (('mix', 'off'), ('steps', 'off'), ('mix', 'on'), ('steps', 'on')):
        name = f'{gait}-{stem}-{tag}'
        d = relative_diff_db(os.path.join(a.before, f'{name}.wav'), os.path.join(a.after, f'{name}.wav'))
        if tag == 'off':
            verdict = 'the render floor: the bypassed path did not move' if d < UNCHANGED_DB else 'MOVED -- the cut did more than it claims'
        else:
            verdict = 'the cut' if d > UNCHANGED_DB else 'DID NOT MOVE -- the cut did nothing'
        print(f'   {name:19} {d:>14.1f} dB   {verdict}')

print('\nwhat the cut must not have cost\n')
print(f"{'gait':6} {'':8} {'step peak':>10} {'over the bed':>13} {'hall under the step':>21}")
peaks = {}
for gait in ('run', 'walk'):
    for name, d in sides:
        steps, rate = read(os.path.join(d, f'{gait}-steps-on.wav'))
        mix, _ = read(os.path.join(d, f'{gait}-mix-on.wav'))
        dry, _ = read(os.path.join(d, f'{gait}-steps-dry.wav'))
        n = min(len(steps), len(mix), len(dry))
        steps, mix, dry = steps[:n], mix[:n], dry[:n]
        head = int(lead * rate)
        peak = db(np.abs(steps[head:]).max())
        peaks[(gait, name)] = peak
        bed = floor_db(mix - steps, rate, lead)
        t = math.sqrt(float(((steps - dry)[head:] ** 2).mean()))
        dd = math.sqrt(float((dry[head:] ** 2).mean()))
        print(f'{gait:6} {name:>8} {peak:>8.1f} dB {peak - bed:>10.1f} dB {db(t) - db(dd):>18.1f} dB')
    print()

print('the gait gap -- a bus trim scales both gaits alike, so this is the number that must not move\n')
for name, _ in sides:
    gap = peaks[('run', name)] - peaks[('walk', name)]
    print(f'   {name:>8}   a run peaks {gap:+.2f} dB over a walk')
