#!/usr/bin/env python3
"""echo.py -- does the ravine answer the boot, and does it answer from where the rock is?

    python3 art/audio/2026-09-26-ravine/echo.py --takes /tmp/ravine --tag before

Three takes of the same scripted walk. `gorge0` and `gorge1` force the space term the whole way, so
subtracting them leaves the ravine and nothing else. `shipped` forces nothing, so the term comes
from the walk itself -- 1 on the bridge leg, 0 everywhere else -- and says whether the ravine stays
where the ravine is.

Four questions, in the order that matters.

1. DOES ANYTHING HAPPEN AT ALL. `gorge1` minus `gorge0`, against the take's own level. Two renders
   of identical code differ by about -108 to -112 dB (`2026-09-24-room`, `2026-09-26-release`), so
   anything at that depth means the boots do not know where they are standing.

2. DOES IT STAY WHERE THE CUT IS. `shipped` against `gorge0`, leg by leg. The bridge must move and
   the stair flight must not.

3. WHAT IT DID TO THE WALK. The room lesson, unchanged: a space is not a fader.

     p95   the steps themselves -- a space must NOT move this, or the change is a level
     p50   the middle of the leg, mostly the quiet between one boot and the next -- a space cannot
           leave this alone, because it is still sounding there

4. WHERE THE ROCK IS. The part a hut could not be asked. At mid-span the ravine is 5 m to each wall
   and 8.8 m deep, so at 343 m/s a wall answers 29 ms after the boot and the floor 51 ms, and
   nothing comes back before 29 ms.

   Measured on ONE boot, not averaged over the walk. `2026-09-24-room` established why: a walk's
   steps are 300-370 ms apart and a space's tail is longer than that, so the previous boot's
   reflections are still sounding inside the next boot's window and the profile reads as a floor
   rather than a delay. `OFFLINE_WALK` opens with three seconds of standing, so the first step of
   the walk has nothing sounding behind it and is the only clean look at the impulse this take has.
"""
import argparse
import math
import os
import wave

import numpy as np

# OFFLINE_WALK legs, as (label, t0, t1). The bridge is the last one, appended with the south exit.
LEGS = [
    ('grass', 3.2, 8.0),
    ('dirt', 8.2, 13.0),
    ('flagstones', 13.2, 18.0),
    ('the stair flight', 18.2, 23.0),
    ('deck planks', 23.2, 27.0),
    ('the log bore', 27.2, 31.0),
    ('leaves', 31.2, 36.0),
    ('a run on stone', 36.2, 41.0),
    ('the bridge', 45.5, 50.0),
]
BRIDGE = LEGS[-1]
WALL_MS = 2 * 5.0 / 343 * 1000
FLOOR_MS = 2 * 8.8 / 343 * 1000


def read(path):
    with wave.open(path, 'rb') as w:
        n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64) / 32768.0
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), rate


def db(v):
    return 20 * math.log10(max(float(v), 1e-12))


def cut(x, rate, t0, t1):
    return x[int(t0 * rate) : int(t1 * rate)]


def levels(x, rate, window=0.02):
    k = max(1, int(rate * window))
    x = x[: len(x) // k * k].reshape(-1, k)
    return np.sqrt((x**2).mean(axis=1))


ap = argparse.ArgumentParser()
ap.add_argument('--takes', default='/tmp/ravine')
ap.add_argument('--tag', default='before')
a = ap.parse_args()

off, rate = read(os.path.join(a.takes, f'{a.tag}-gorge0.wav'))
on, _ = read(os.path.join(a.takes, f'{a.tag}-gorge1.wav'))
# The `shipped` take was added to this script after the "before" pair was rendered. On the before
# it would have been the same file as `gorge0` to the last bit, because nothing read the term at
# all — which is the whole finding — so its absence is handled rather than faked.
ship_path = os.path.join(a.takes, f'{a.tag}-shipped.wav')
have_ship = os.path.exists(ship_path)
ship = read(ship_path)[0] if have_ship else off
n = min(len(off), len(on), len(ship))
off, on, ship = off[:n], on[:n], ship[:n]

print(f'--- {a.tag} ---\n')
print('1. does anything happen (the term forced the whole way, one take minus the other)\n')
o, d = cut(off, rate, *BRIDGE[1:]), cut(on - off, rate, *BRIDGE[1:])
rel = db(np.sqrt((d**2).mean())) - db(np.sqrt((o**2).mean()))
print(f'   on the bridge   {rel:>8.1f} dB under the take   ' + ('the render floor: the boots do not know' if rel < -80 else 'the ravine'))

print('\n2. does it stay where the cut is (the shipped term, leg by leg)\n')
if not have_ship:
    print('   no `shipped` take here — it postdates this pair, and on it nothing read the term')
else:
    print(f"{'':22} {'shipped minus no-ravine':>25}")
    for label, t0, t1 in LEGS:
        o = cut(off, rate, t0, t1)
        d = cut(ship - off, rate, t0, t1)
        r = db(np.sqrt((d**2).mean())) - db(np.sqrt((o**2).mean()))
        print(f'   {label:22} {r:>17.1f} dB   ' + ('unchanged' if r < -80 else 'the ravine'))

print('\n3. what it did to the walk\n')
print(f"{'':22} {'p95 (the steps)':>17} {'p50 (between them)':>20}")
for label, t0, t1 in (('the bridge', *BRIDGE[1:]), ('the stair flight', 18.2, 23.0)):
    lo, ln = levels(cut(off, rate, t0, t1), rate), levels(cut(ship, rate, t0, t1), rate)
    print(f'   {label:22} {db(np.percentile(ln, 95)) - db(np.percentile(lo, 95)):>+14.2f} dB {db(np.percentile(ln, 50)) - db(np.percentile(lo, 50)):>+17.2f} dB')
print('   (a space moves the second and not the first; a fader moves both)')

print('\n4. where the rock is -- one boot, with nothing sounding behind it\n')
# the first step of the walk, after the opening three-second stand
i0 = int(2.9 * rate)
win = np.abs(off[i0 : i0 + int(2.0 * rate)])
first = i0 + int(np.argmax(win > 0.02 * win.max()))
direct = db(np.abs(off[first : first + int(0.05 * rate)]).max())
tail = on - off
answer = db(np.abs(tail[first : first + int(0.9 * rate)]).max())
print(f'   the boot at {first / rate:.2f} s peaks at {direct:.1f} dB; the ravine answers {answer - direct:.1f} dB under it\n')
b = int(rate * 0.002)
prof = np.abs(tail[first : first + int(0.07 * rate)])
prof = prof[: len(prof) // b * b].reshape(-1, b).max(axis=1)
silent_to = 0
for j, v in enumerate(prof):
    if db(v) - direct > -90:
        break
    silent_to = (j + 1) * 2
for j, v in enumerate(prof):
    ms = j * 2
    mark = '   <- the walls, 5 m off' if abs(ms - WALL_MS) < 1.1 else ('   <- the floor, 8.8 m down' if abs(ms - FLOOR_MS) < 1.1 else '')
    lvl = db(v) - direct
    bar = '' if lvl < -90 else '#' * max(0, int((lvl + 70) / 2))
    print(f'   {ms:>4} ms  {"silence" if lvl < -90 else f"{lvl:7.1f} dB"}  {bar}{mark}')
print(f'\n   silent for the first {silent_to} ms; the rock at mid-span cannot answer before {WALL_MS:.0f}')
