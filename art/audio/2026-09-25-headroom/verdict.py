#!/usr/bin/env python3
"""verdict.py -- does the mix still sit where the level work left it? Exits non-zero if not.

    node art/audio/2026-09-24-level/worstcase.mjs --dist dist --out /tmp/worst
    ffmpeg -y -i /tmp/worst/worst.webm -ar 44100 -ac 2 /tmp/worst/worst.wav
    python3 art/audio/2026-09-25-headroom/verdict.py --take /tmp/worst/worst.wav

PR #63 gain-staged the game from -32.6 LUFS to -23.6 and left the worst case's true peak at
-7.3 dBFS, and nothing has checked it since. It is the one piece of this lane's work with a number
the OWNER feels directly — he sets his volume by ear, and a mix that drifts out of the normal band
puts him back to cranking his system — and it is also the number most easily moved by accident,
because every change that makes an event louder or more frequent pushes on it.

So this is a gate rather than a report. The thresholds are the level work's own reasoning:

  loudness    -26 to -17 LUFS. The band it argued for; outside it the trim needs re-sizing.
  true peak   under -3 dBFS. The trim left 7.3 dB of room; losing more than half of it means
              something has changed enough to look at.
  clipping    none, ever.

Measured on the WORST CASE and not on a walk, because headroom is sized against the worst case and
an average cannot fail. `worstcase.mjs` builds it: running and jumping continuously on the
flagstones under the densest cluster of lanterns in the world, with the score playing.
"""
import argparse
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '2026-09-23-lane5'))
from balance import load, loudness  # noqa: E402

BAND = (-26.0, -17.0)
PEAK_CEILING = -3.0


def true_peak_db(x):
    """4x oversampled, because a sample peak under full scale can still reconstruct over it"""
    n = len(x)
    up = np.fft.irfft(np.fft.rfft(x), n * 4) * 4
    return 20 * np.log10(max(float(np.max(np.abs(up))), 1e-12))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--take', required=True)
    ap.add_argument('--band', nargs=2, type=float, default=BAND)
    ap.add_argument('--ceiling', type=float, default=PEAK_CEILING)
    args = ap.parse_args()

    a, sr = load(args.take)
    lufs, lk = loudness(a, sr)
    tp = max(true_peak_db(a[:, c]) for c in range(a.shape[1]))
    clipped = int(np.sum(np.abs(a) >= 0.999))

    rows = [
        ('integrated loudness', f'{lufs:.1f} LUFS', args.band[0] <= lufs <= args.band[1], f'{args.band[0]:.0f} to {args.band[1]:.0f}'),
        ('true peak (4x)', f'{tp:.1f} dBFS', tp < args.ceiling, f'under {args.ceiling:.0f}'),
        ('clipped samples', str(clipped), clipped == 0, 'none'),
    ]
    width = max(len(r[0]) for r in rows)
    ok = True
    for name, got, passed, want in rows:
        ok = ok and passed
        print(f'{name:{width}s}  {got:>12s}   {"ok" if passed else "FAIL"}   (wants {want})')
    print(f'{"short-term p10 / p50 / p99":{width}s}  {np.percentile(lk, 10):.1f} / {np.percentile(lk, 50):.1f} / {np.percentile(lk, 99):.1f} LUFS')
    print()
    print('the mix is where the level work left it' if ok else 'THE MIX HAS MOVED — re-size the trim or find what pushed it')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
