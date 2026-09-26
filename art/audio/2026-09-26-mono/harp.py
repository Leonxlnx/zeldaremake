#!/usr/bin/env python3
"""harp.py -- why the score sits left of centre, and what puts it back.

    python3 art/audio/2026-09-26-mono/harp.py

The only panned voice in the music is the harp, and its pan is its position in the arpeggio:

    pluck(t0 + i * BEAT * 0.5, chord[idx] + 12 * (lift + 1), vel, (i / (HARP.length - 1) - 0.5) * 0.7);

`i` is doing three unrelated jobs at once. It picks WHERE the note sits in the field, it picks HOW
HARD the note is struck (`i % 2 === 0` is an on-beat eighth and is played louder), and it is what
every rule that thins the figure tests. Three uses of one index, and they correlate:

  * `bar % 4 === 3 && i >= 6`  drops the two RIGHTMOST notes, once every four bars.
  * `i === 5 && bar % 2 === 1` drops another right-of-centre note on every odd bar.
  * `quiet && i % 2 === 1`     drops the odd eighths, which are the right-leaning half.
  * and the accent makes the even eighths — the LEFT-leaning half — louder than the odd ones.

Every one of them leans the same way. This walks the schedule exactly as `music.ts` does, applies
the StereoPanner's own `cos/sin` law, and reports the energy each candidate puts in each channel.
No render: the schedule is arithmetic.
"""
import math

BARS = 16
PHRASE_BEATS = 16
HARP_N = 8


def pan_shipped(i, bar, phrase):
    return (i / (HARP_N - 1) - 0.5) * 0.7


def pan_alt_bar(i, bar, phrase):
    return (i / (HARP_N - 1) - 0.5) * 0.7 * (-1 if bar % 2 else 1)


def pan_alt_phrase(i, bar, phrase):
    return (i / (HARP_N - 1) - 0.5) * 0.7 * (-1 if phrase % 2 else 1)


def velocity(i, quiet):
    """music.ts, without the seeded jitter — which is symmetric and averages out"""
    return (0.6 if quiet else 1.0) * (0.55 + 0.35 * (1 if i % 2 == 0 else 0.5))


def played(quiet):
    """exactly the notes scheduleFlutters' neighbour in music.ts lets through"""
    for bar in range(BARS):
        phrase = (bar * 4) // PHRASE_BEATS
        for i in range(HARP_N):
            if bar == BARS - 1:
                continue
            if phrase == 1 and i not in (0, 4):
                continue
            if (bar % 4 == 3 and i >= 6) or (i == 5 and bar % 2 == 1) or (quiet and i % 2 == 1):
                continue
            yield bar, phrase, i


def lean(pan_fn, quiet):
    L = R = 0.0
    for bar, phrase, i in played(quiet):
        p = pan_fn(i, bar, phrase)
        v = velocity(i, quiet) ** 2
        # StereoPannerNode's equal-power law for a mono input
        a = (p + 1) * math.pi / 4
        L += v * math.cos(a) ** 2
        R += v * math.sin(a) ** 2
    return (R - L) / (R + L), 10 * math.log10(L / R)


def main():
    print("\nwhere the harp's energy lands, over one 16-bar pass\n")
    print(f"  {'pan rule':<34}{'quiet pass':>22}{'full pass':>22}")
    print(f"  {'':<34}{'lean':>10}{'L over R':>12}{'lean':>10}{'L over R':>12}")
    for name, fn in (
        ("as it ships: pan = the note's index", pan_shipped),
        ("…sweeping the other way each bar", pan_alt_bar),
        ("…sweeping the other way each phrase", pan_alt_phrase),
    ):
        q = lean(fn, True)
        f = lean(fn, False)
        print(f"  {name:<34}{q[0]:+10.3f}{q[1]:+11.2f} dB{f[0]:+10.3f}{f[1]:+11.2f} dB")
    print("\n  lean is (R−L)/(R+L): 0 is centred, negative is left.")
    print("  A pass is 16 bars; the tune alternates quiet and full passes, so both have to be near zero.")

    # which notes the thinning removes, and from which side
    for quiet in (False, True):
        kept = [(b, p, i) for b, p, i in played(quiet)]
        allp = [(b, (b * 4) // PHRASE_BEATS, i) for b in range(BARS) for i in range(HARP_N)]
        drop = [x for x in allp if x not in set(kept)]
        mk = sum(pan_shipped(i, b, p) for b, p, i in kept) / max(1, len(kept))
        md = sum(pan_shipped(i, b, p) for b, p, i in drop) / max(1, len(drop))
        print(f"\n  {'quiet' if quiet else 'full '} pass: {len(kept)} notes kept at mean pan {mk:+.3f}, {len(drop)} dropped at mean pan {md:+.3f}")
        print(f"         every rule that thins the figure takes from the right, so what is left leans left")


if __name__ == "__main__":
    main()
