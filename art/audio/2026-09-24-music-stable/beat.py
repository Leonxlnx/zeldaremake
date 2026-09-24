#!/usr/bin/env python3
"""
beat.py — what rhythm is the mix's LEVEL moving to?

  python3 art/audio/2026-09-24-music-stable/beat.py --before /tmp/head --after /tmp/branch

The owner (23:00): "the music kind of still shakes whenever I run". The music's own notes are exact
— they are scheduled on the audio clock, and an offline render proves nothing about them because an
OfflineAudioContext has a perfect clock by construction. What can be measured, and is what he is
hearing, is the rhythm of the MIX's amplitude: take the envelope of each stem over a leg of the
scripted walk, remove its mean, and look at its spectrum between 1 and 12 Hz. The tallest line is
the rhythm the level is moving to, and the ratio against the median of that band is how much it
dominates.

A healthy mix moves to the music's beat (76 bpm ≈ 1.27 Hz) whatever the player is doing. If the
tallest line moves to the step rate the moment he runs, the footsteps are pulsing over the music,
and that is the shake.
"""
import argparse
import json
import os
import wave

import numpy as np

# legs of src/audio/index.ts OFFLINE_WALK
LEGS = (('walking stone', 13, 18), ('running stone', 36, 41), ('standing', 41, 45))
MUSIC_BEAT_HZ = 76 / 60.0


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch).mean(axis=1) / 32768.0, sr


def beat(path, t0, t1, win=256):
    x, sr = load(path)
    x = x[int(t0 * sr):int(t1 * sr)]
    n = len(x) // win
    e = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1))
    fs = sr / win
    e = e - e.mean()
    mag = np.abs(np.fft.rfft(e * np.hanning(len(e))))
    f = np.fft.rfftfreq(len(e), 1 / fs)
    sel = (f > 1) & (f < 12)
    m, ff = mag[sel], f[sel]
    k = int(np.argmax(m))
    bg = np.median(m) + 1e-12
    # how much of that band's energy sits on the music's beat rather than anywhere else
    near = np.abs(ff - MUSIC_BEAT_HZ) < 0.35
    return {'hz': float(ff[k]), 'dominance': float(m[k] / bg), 'on_music_beat': bool(abs(ff[k] - MUSIC_BEAT_HZ) < 0.35), 'music_share': float(m[near].max() / m.max())}


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--before', required=True)
    p.add_argument('--after', required=True)
    p.add_argument('--json')
    args = p.parse_args()
    out = {}
    print(f'{"stem":7s} {"leg":15s} {"before: beat":>14s} {"x bg":>6s} {"after: beat":>13s} {"x bg":>6s}  {"the music beat leads":>21s}')
    for stem in ('mix', 'music', 'steps'):
        for leg, t0, t1 in LEGS:
            bp, ap = os.path.join(args.before, f'{stem}.wav'), os.path.join(args.after, f'{stem}.wav')
            if not (os.path.exists(bp) and os.path.exists(ap)):
                continue
            b, a = beat(bp, t0, t1), beat(ap, t0, t1)
            out[f'{stem}/{leg}'] = {'before': b, 'after': a}
            lead = f'{"yes" if b["on_music_beat"] else "NO"} → {"yes" if a["on_music_beat"] else "NO"}'
            print(f'{stem:7s} {leg:15s} {b["hz"]:11.2f} Hz {b["dominance"]:6.1f} {a["hz"]:10.2f} Hz {a["dominance"]:6.1f}  {lead:>21s}')
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(out, f, indent=2)
        print(f'wrote {args.json}')


if __name__ == '__main__':
    main()
