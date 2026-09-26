#!/usr/bin/env python3
"""price.py -- what every candidate step trim would do, exactly, from three takes.

    python3 art/audio/2026-09-26-release/price.py --takes /tmp/release/before

`SFX_TRIM` is a plain gain on the sfx bus, downstream of the compressor, so changing it scales one
linear part of the mix and nothing else:

    mix = rest + dry + tail

`rest` is the bed and the music, which never touch the sfx bus. `tail` is the hall and the room
answering the steps -- taken off the panner, so it bypasses the compressor AND the trim. `dry` is
the only part the trim moves. Two of the three are already on disk:

    dry           = {gait}-steps-dry.wav   (stem steps, limiter on, reverb off)
    rest + tail   = {gait}-mix-on.wav - dry

so the mix at a trim `c` dB lower is exactly `mix_on - (1 - 10**(-c/20)) * dry`, with no second
render and no model. The rows below are therefore measurements of a signal arithmetically identical
to what the graph would produce, not predictions -- and the chosen row is re-rendered and
re-measured afterwards anyway (`pulse.py` over /tmp/release/after).

The columns are the ones `2026-09-26-limiter` left open: how far the music's beat and the player's
step rate each stand over the background of the mix's envelope spectrum, and the difference between
them, which is the owner's *"the music kind of still shakes whenever I run"* as a number. Beside
them the two things a cut could break -- how loud a step still is, and how far it stands over the
always-on level of everything else, because the bed is the other thing he has complained about and
burying his own footsteps under it would be trading one complaint for the other.
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


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/release/before')
ap.add_argument('--cuts', default='0,1,2,3,4,5,6,8')
a = ap.parse_args()

lead = json.load(open(os.path.join(a.takes, 'takes.json')))['lead']
cuts = [float(v) for v in a.cuts.split(',')]

for gait in ('run', 'walk'):
    mix, rate = read(os.path.join(a.takes, f'{gait}-mix-on.wav'))
    steps, _ = read(os.path.join(a.takes, f'{gait}-steps-on.wav'))
    dry, _ = read(os.path.join(a.takes, f'{gait}-steps-dry.wav'))
    n = min(len(mix), len(steps), len(dry))
    mix, steps, dry = mix[:n], steps[:n], dry[:n]
    tail = steps - dry
    head = int(lead * rate)
    step_hz = SPEED[gait] / STRIDE[gait]
    # what a step has to be heard over: the bed and the music at their always-on level
    bed_floor = floor_db(mix - steps, rate, lead)

    print(f'\n{gait} at {SPEED[gait]} m/s, {step_hz:.2f} steps a second')
    print(f"{'trim':>7} {'step peak':>10} {'over the bed':>13}   {'music 1.2 Hz':>13} {'step rate':>10} {'the step rate is':>17}")
    for c in cuts:
        g = 10 ** (-c / 20)
        after = mix - (1 - g) * dry
        spec, f = env_spectrum(after, rate, lead)
        beat, step = line(spec, f, BEAT_HZ), line(spec, f, step_hz)
        peak = db(np.abs((steps - (1 - g) * dry)[head:]).max())
        verdict = 'over the music' if step > beat else 'under the music'
        mark = '   <- shipped' if c == 0 else ''
        print(f'{-c:>4.0f} dB {peak:>8.1f} dB {peak - bed_floor:>10.1f} dB   {beat:>10.1f} dB {step:>7.1f} dB  {step - beat:>+7.1f} dB, {verdict}{mark}')

    t = math.sqrt(float((tail[head:] ** 2).mean()))
    d = math.sqrt(float((dry[head:] ** 2).mean()))
    print(f'   the hall answering a step sits {db(t) - db(d):.1f} dB under it today, and bypasses the trim, so a cut of c dB puts it c dB nearer')
