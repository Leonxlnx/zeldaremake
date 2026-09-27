#!/usr/bin/env python3
"""relayers.py -- what the wind is worth, measured twice: through the broken mute and through a mute.

    python3 art/audio/2026-09-26-relayers/relayers.py --before /tmp/layers-before --after /tmp/layers-after

`2026-09-25-layers` asked what each layer of the bed is worth by rendering the same forest with one
layer switched off at a time. `2026-09-26-shadow2` then found that `mute: ['wind']` was not
switching the wind off: `canopyMod` and `hushMod` are CONNECTED to `canopyGain.gain` and
`hushGain.gain`, and a node connected to an AudioParam is summed with that param's automation
rather than scaling it, so zeroing the level left the gust's own depth still driving the same gain.

Its leaf and bird rows are unaffected -- those layers mute by not connecting the voice at all --
but every "no wind" number in that report was measured on a take that still had wind in it. This
re-runs the identical sixteen takes on a build with the bug and a build without, and prints the two
side by side, so what the report has to be corrected by is a measurement rather than an argument.

The measurement is `2026-09-25-layers/layers.py`'s own, imported rather than reimplemented: the
always-on level (the 10th percentile over time) per band, and the longest stretch the wood is left
with nothing audible happening, A-weighted and smoothed over 0.3 s, counted against the full take's
own floor shared across a condition's four mutes.
"""
import argparse
import json
import os

# `layers.py` is a script, not a module: importing it runs its own argparse and exits. So its
# source is taken up to the point where it stops defining things and starts doing them, and
# exec'd. The point of the exercise is that `measure` here is character for character the function
# that produced the numbers being corrected, rather than a second implementation of it that could
# differ in a percentile or a window.
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '2026-09-25-layers', 'layers.py')).read()
_ns = {}
exec(compile(_src[: _src.index('ap = argparse.ArgumentParser()')], 'layers.py', 'exec'), _ns)  # noqa: S102
measure = _ns['measure']

ORDER = ['all', 'noleaves', 'nobirds', 'nowind']


def load(takes):
    meta = json.load(open(os.path.join(takes, 'takes.json')))
    rows = {}
    for t in meta['takes']:
        if t['mute'] == 'all':
            rows[t['id']] = {**t, **measure(os.path.join(takes, f"{t['id']}.wav"))}
    for t in meta['takes']:
        if t['mute'] != 'all':
            floor = rows[f"{t['spot']}-{t['gust']}-all"]['allOnDb']
            rows[t['id']] = {**t, **measure(os.path.join(takes, f"{t['id']}.wav"), floor)}
    return meta, rows


ap = argparse.ArgumentParser()
ap.add_argument('--before', default='/tmp/layers-before')
ap.add_argument('--after', default='/tmp/layers-after')
a = ap.parse_args()

meta, before = load(a.before)
_, after = load(a.after)

print('the longest the wood is left with nothing happening, in seconds\n')
print(f"{'condition':22} {'':9} {'all':>7} {'no leaves':>11} {'no birds':>10} {'no wind':>9}")
for spot in ('open', 'crowns'):
    for gust in ('gusty', 'still-air'):
        if f'{spot}-{gust}-all' not in before:
            continue
        for name, rows in (('before', before), ('after', after)):
            cells = ' '.join(f"{rows[f'{spot}-{gust}-{m}']['quietGapS']:>{w}.2f}" for m, w in zip(ORDER, (7, 11, 10, 9)))
            print(f"   {spot + ', ' + gust:19} {name:>9} {cells}")
        d = after[f'{spot}-{gust}-nowind']['quietGapS'] - before[f'{spot}-{gust}-nowind']['quietGapS']
        print(f"   {'':19} {'the wind':>9} {'':7} {'':11} {'':10} {d:>+9.2f}\n")

print('\nthe always-on level, and what each layer is worth (dB, A-weighted)\n')
print(f"{'condition':22} {'':9} {'all':>7} {'no leaves':>11} {'no birds':>10} {'no wind':>9}")
for spot in ('open', 'crowns'):
    for gust in ('gusty', 'still-air'):
        if f'{spot}-{gust}-all' not in before:
            continue
        for name, rows in (('before', before), ('after', after)):
            base = rows[f'{spot}-{gust}-all']['allOnDb']
            cells = f"{base:>7.1f}" + ' '.join(f"{rows[f'{spot}-{gust}-{m}']['allOnDb'] - base:>+{w}.1f}" for m, w in zip(ORDER[1:], (12, 11, 10)))
            print(f"   {spot + ', ' + gust:19} {name:>9} {cells}")
        db = after[f'{spot}-{gust}-nowind']['allOnDb'] - after[f'{spot}-{gust}-all']['allOnDb']
        wb = before[f'{spot}-{gust}-nowind']['allOnDb'] - before[f'{spot}-{gust}-all']['allOnDb']
        print(f"   {'':19} {'the wind':>9} {'':7} {'':12} {'':11} {db - wb:>+10.1f}\n")

print('(the `all`, `no leaves` and `no birds` columns must not move: those layers mute by not')
print(' connecting the voice, and the fix touched only the wind. Any difference in them is the')
print(" render's own floor, which two takes of identical code sit about 108 dB under.)")
