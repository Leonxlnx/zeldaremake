#!/usr/bin/env python3
"""pulse.py -- is the strongest rhythm in the mix the music's beat, or the player's feet?

    python3 art/audio/2026-09-26-limiter/pulse.py --takes /tmp/limiter

The compressor on the sfx bus exists for one sentence the owner said: the music *"kind of still
shakes whenever I run"*. Its comment names the mechanism exactly -- "in the mix's envelope the
strongest rhythm then stops being the music's beat and becomes the step rate" -- which is a
measurable claim and has never been measured with the compressor switched off.

So: the mix's broadband envelope, its spectrum, and the height of two lines in it --

  beat        the music's own, 1.2 Hz (76 bpm)
  step rate   1.2 / 0.44 = 2.73 Hz at a walk, 2.2 / 0.60 = 3.67 at a run

each against the median of the envelope spectrum around them, which is the background a rhythm has
to stand over to be heard as one. And the steps stem's own peak at each gait, so what the
compressor costs the gait difference is on the same page as what it buys.
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
    """the broadband envelope's spectrum, decimated to 200 Hz first"""
    x = x[int(lead * rate) :]
    env = np.abs(x)
    k = int(rate / 200)
    env = env[: len(env) // k * k].reshape(-1, k).mean(axis=1)
    env = env - env.mean()
    n = 1 << int(np.floor(np.log2(len(env))))
    spec = np.abs(np.fft.rfft(env[:n] * np.hanning(n))) ** 2
    return spec, np.fft.rfftfreq(n, k / rate)


def line_over_background(spec, f, hz, half=0.25, lo=0.4, hi=8.0):
    near = (f >= hz - half) & (f <= hz + half)
    around = (f >= lo) & (f <= hi)
    return 10 * math.log10(max(spec[near].max(), 1e-30) / max(float(np.median(spec[around])), 1e-30))


def peak_db(path, lead):
    x, rate = read(path)
    x = x[int(lead * rate) :]
    return 20 * math.log10(max(np.abs(x).max(), 1e-9))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/limiter')
a = ap.parse_args()

meta = json.load(open(os.path.join(a.takes, 'takes.json')))
lead = meta['lead']

print("the mix's envelope: how far each rhythm stands over the background of its own spectrum")
print(f"\n{'gait':6} {'compressor':>11}   {'music 1.2 Hz':>13} {'step rate':>10} {'the step rate is':>17}")
rows = []
for t in meta['takes']:
    g = t['gait']
    step_hz = SPEED[g] / STRIDE[g]
    for tag in ('on', 'off'):
        x, rate = read(os.path.join(a.takes, f'{g}-mix-{tag}.wav'))
        spec, f = env_spectrum(x, rate, lead)
        beat = line_over_background(spec, f, BEAT_HZ)
        step = line_over_background(spec, f, step_hz)
        rows.append({'gait': g, 'tag': tag, 'beat': beat, 'step': step, 'stepHz': step_hz})
        verdict = 'over the music' if step > beat else 'under the music'
        print(f'{g:6} {tag:>11}   {beat:>10.1f} dB {step:>7.1f} dB  {step - beat:>+7.1f} dB, {verdict}')

print(f"\nand the steps stem itself:\n\n{'gait':6} {'compressor':>11} {'peak':>10}")
peaks = {}
for t in meta['takes']:
    for tag in ('on', 'off'):
        p = peak_db(os.path.join(a.takes, f"{t['gait']}-steps-{tag}.wav"), lead)
        peaks[(t['gait'], tag)] = p
        print(f"{t['gait']:6} {tag:>11} {p:>8.1f} dB")
for tag in ('on', 'off'):
    if ('walk', tag) in peaks and ('run', tag) in peaks:
        print(f"  compressor {tag}: a run is {peaks[('run', tag)] - peaks[('walk', tag)]:+.2f} dB over a walk")
