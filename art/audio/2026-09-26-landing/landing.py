#!/usr/bin/env python3
"""landing.py -- what a landing is worth, over the falls this game can actually produce.

    python3 art/audio/2026-09-26-landing/landing.py

Rubric check 24 is *landing after a drop sounds, and scales with the fall*, and it scores **4** —
"nothing left to want here" — on the evidence `landingStrength(fallM)`, tested. The test asserts
the function is monotone. Nobody has asked what it is worth over the falls the game can make.

The falls the game can make are not open-ended. There is no fall state in the character system at
all: `loco.jump` is created only on a jump press and `airHeight` is non-zero only while its phase
is `air`, so walking off a ledge does not fall — the root stays on the terrain. Every landing in
this game is the end of a deliberate jump, and its apex is 0.6 m walking and 1.0 m running
(`JUMP_APEX_WALK_M` / `JUMP_APEX_RUN_M`). Jumping OFF something adds the drop below it.

So the reachable range is 0.6 m to about 9.4 m — a standing jump, to a jump into the ravine — and
this prints what the shipped curve does across it, against what the physics of an impact asks.
"""
import math

FLOOR = 0.45
SLOPE = 0.32
APEX_WALK = 0.6
APEX_RUN = 1.0
# the drops the world affords under a jump: the plateau is 5.4 m and the ravine 8.8
FALLS = [
    (APEX_WALK, 'a standing or walking jump'),
    (APEX_RUN, 'a running jump'),
    (1.72, 'where the clamp bites'),
    (3.0, 'off a low ledge'),
    (5.4 + APEX_WALK, 'off the plateau'),
    (8.8 + APEX_WALK, 'into the ravine'),
]


def shipped(h):
    return max(FLOOR, min(1.0, FLOOR + h * SLOPE))


def db(a, b):
    return 20 * math.log10(a / b)


base = shipped(APEX_WALK)
print('what the shipped curve is worth over the falls the game can make\n')
print(f"{'fall':>8} {'strength':>9} {'over a walking jump':>21} {'the physics asks':>18}")
for h, label in FALLS:
    print(f'{h:>6.1f} m {shipped(h):>9.3f} {db(shipped(h), base):>18.2f} dB {10 * math.log10(h / APEX_WALK):>15.1f} dB   {label}')

print(f'\n   on FLAT ground every landing spans {db(shipped(APEX_RUN), base):.2f} dB, where the physics asks {10 * math.log10(APEX_RUN / APEX_WALK):.1f}')
print(f'   and everything from {(1 - FLOOR) / SLOPE:.2f} m up is identical, where a jump into the ravine asks {10 * math.log10((8.8 + APEX_WALK) / APEX_WALK):.1f} dB over a walking one')

print('\n\nwhy it cannot simply be widened: the output range is boxed at both ends\n')
print(f'   the floor, {FLOOR}, is "a landing is at least a step" — a landing is both boots at once and')
print(f'      `STEP_FORCE_WALK` is 0.42, so a landing under about that is quieter than walking')
print('   the ceiling, 1.0, is the level the master is staged against: the worst case is a')
print('      run-and-jump take, so every landing in it is at the top of this curve')
print(f'\n   that is {db(1.0, FLOOR):.1f} dB of output for {10 * math.log10((8.8 + APEX_WALK) / APEX_WALK):.1f} dB of input. Every curve between those endpoints only')
print('   redistributes it, and the three worth pricing are below.')

print('\n')
print(f"{'option':34} {'walk vs run jump':>17} {'walk vs the ravine':>19} {'ordinary landings':>19}")


def row(name, f, note=''):
    b = f(APEX_WALK)
    print(f'   {name:31} {db(f(APEX_RUN), b):>14.2f} dB {db(f(8.8 + APEX_WALK), b):>16.2f} dB {db(f(APEX_RUN), shipped(APEX_RUN)):>16.2f} dB {note}')


row('as it ships', shipped)
# amplitude goes as the square root of the fall, which is the impact's own scaling
row('physics slope from the floor', lambda h: max(FLOOR, min(1.0, FLOOR * math.sqrt(h / APEX_WALK))))
# a soft saturation that reaches the ceiling at the world's deepest drop instead of at 1.72 m
tau = (8.8 + APEX_WALK) / math.log(100)
row('saturating at the deepest drop', lambda h: max(FLOOR, min(1.0, FLOOR + (1 - FLOOR) * (1 - math.exp(-h / tau)))))
# the physics slope, but anchored so the landing a player hears most is left exactly where it is
row('physics slope, run jump held', lambda h: max(FLOOR, min(1.0, shipped(APEX_RUN) * math.sqrt(h / APEX_RUN))))

print('\n   Every one of them buys range at the top by spending level on the landings that happen')
print('   constantly. The last column is what an ordinary running jump loses.')
print('\n   The last row is the interesting one. Hold the landing a player hears most where it is,')
print('   give it the physics slope, and the ceiling is reached at')
print(f'      {(1.0 / shipped(APEX_RUN)) ** 2:.2f} m against the shipped {(1 - FLOOR) / SLOPE:.2f} — and the range grows by {db(1.0, shipped(APEX_RUN) * math.sqrt(APEX_WALK / APEX_RUN)) - db(1.0, base):.2f} dB.')
print('   Two thirds of a decibel, for making every landing in the game slightly quieter. That is')
print('   churn, and it is the answer: the curve is close to the best it can be between its ends.')

print('\n\nand the fourth option, raising the ceiling, priced against the headroom that exists\n')
# the worst case, re-measured 2026-09-26 on a run-and-jump take with the current pad
WORST_BEFORE_TRIM = -17.9
TRIM = 9
REQUIRED = 6
free = -(WORST_BEFORE_TRIM + TRIM)
print(f'   the worst case measured {WORST_BEFORE_TRIM} dBFS before the trim, so {free:.1f} dB is free after it')
print(f'   `level.test.mjs` requires {REQUIRED}, which leaves {free - REQUIRED:.1f} dB of slack')
print(f'   the worst case IS a run-and-jump take, so raising the landing ceiling spends that slack')
print(f'      one for one: a ceiling of {10 ** ((free - REQUIRED) / 20):.2f} instead of 1.0 uses all of it')
print(f'   and that slack is what the trim left "for sources nobody has measured yet"')
