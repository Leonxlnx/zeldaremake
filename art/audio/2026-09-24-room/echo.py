#!/usr/bin/env python3
"""echo.py -- what comes back after the boot, and how long it takes.

    python3 art/audio/2026-09-24-room/echo.py --takes /tmp/room \
        --out art/audio/2026-09-24-room/room.jpg

A room is not a level, it is a *time*. Sound covers 343 m in a second, so a wall two metres away
answers 12 ms after the boot does and keeps answering itself for a third of a second. What that
does to a walk is fill the gaps: outdoors a footstep is a transient with silence behind it, indoors
the silence is never reached before the next boot lands.

So the measurement is the distribution of the short-term level across a leg of the walk, and the
whole result is in two of its percentiles:

  p95   the steps themselves. A room must not move this. If it does, the change is a fader.
  p50   the middle of the walk, which is mostly the quiet between one boot and the next. A room
        cannot leave this alone, because the space is still sounding there.

Quoted beside them, the same two takes subtracted: what the room put in that the open air did not,
against the steps' own level.

Deliberately NOT measured per step. The obvious metric -- reflected energy in a window after each
onset, against the direct -- is contaminated here and reads backwards: steps arrive 300 ms apart and
the room's tail is 320 ms, so the previous step's reflections are still sounding inside the next
step's "direct" window. That inflates the denominator and makes a room look *less* reflective than
the open air, which is what this file reported until the overlap was noticed.

The decay after the last step is reported but not drawn. It barely separates the three spaces, and
honestly so: the shared 1.5 s hall is under every footstep in this world already, and it outlasts a
hut. What a small room changes is the first third of a second, not the last.
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '2026-09-23-lane5'))
from spectra import load, mono  # noqa: E402

# the last step of the run, and the stand that follows it (OFFLINE_WALK)
TAIL_AT = 40.70
TAIL_MS = 600.0
# every leg of OFFLINE_WALK that has boots in it: (label, t0, t1)
LEGS = [('grass', 3.0, 8.0), ('dirt', 8.0, 13.0), ('stone', 13.0, 18.0), ('stairs', 18.0, 23.0), ('wood', 23.0, 27.0), ('hollow', 27.0, 31.0), ('leaf', 31.0, 36.0), ('run stone', 36.0, 40.7)]
# the legs whose between-step gaps are quoted in the report
GAP_LEGS = ['wood', 'stone', 'run stone']
GAP_WIN = 0.02
# the trace's plot box in the clip-video background; the playhead is swept across exactly this span
CARD_BOX = (72, 1180, 150, 400)

BG = (17, 19, 22)
GRID = (44, 48, 54)
INK = (236, 238, 240)
DIM = (140, 146, 154)
SPACES = [('open', 'outdoors', (214, 162, 96)), ('room', 'in a hut (0.7)', (124, 196, 130)), ('bore', 'in the log bore (1.0)', (150, 170, 240))]


def _font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def short_term(x, sr, win=GAP_WIN):
    n = int(win * sr)
    m = len(x) // n
    e = np.sqrt((x[: m * n].astype(np.float64).reshape(m, n) ** 2).mean(axis=1))
    return 20 * np.log10(np.maximum(e, 1e-12))


def tail(x, sr):
    """the decay after the last step of the run, from its own loudest moment onward"""
    i = int(TAIL_AT * sr)
    seg = x[i : i + int((TAIL_MS + 200) * 1e-3 * sr)].astype(np.float64)
    k = max(1, int(0.002 * sr))
    p = np.convolve(seg**2, np.ones(k) / k, mode='same')
    c = 10 * np.log10(np.maximum(p, 1e-16))
    # the onset detector fires on the envelope's rise; the decay starts at the peak that follows it
    return (c - c.max())[int(np.argmax(c)) : int(np.argmax(c)) + int(TAIL_MS * 1e-3 * sr)]


def rt(curve, sr, drop=20.0):
    """ms for the decay to fall `drop` dB from its peak — a room's size, heard"""
    below = np.where(curve < -drop)[0]
    return below[0] / sr * 1000 if len(below) else float('nan')


def added(x, ref, sr, t0=0.0, t1=None):
    """what a space put into a take that was not in the open one, against that take's own level"""
    s = slice(int(t0 * sr), int(t1 * sr) if t1 else min(len(x), len(ref)))
    a, b = x[s].astype(np.float64), ref[s].astype(np.float64)
    n = min(len(a), len(b))
    lvl = lambda v: 20 * np.log10(max(float(np.sqrt(np.mean(v**2))), 1e-14))
    return lvl(a[:n] - b[:n]) - lvl(b[:n])


def card(takes, sr, out_dir):
    """the two backgrounds the clip video sweeps a playhead across, one per take"""
    leg, t0, t1 = next(l for l in LEGS if l[0] == 'wood')
    W, H = 1280, 480
    x0, x1, y0, y1 = CARD_BOX
    top, bot = -18.0, -78.0
    traces = {s: short_term(takes[s][int(t0 * sr) : int(t1 * sr)], sr) for s, _, _ in SPACES[:2]}
    for playing, label, colour in SPACES[:2]:
        im = Image.new('RGB', (W, H), BG)
        d = ImageDraw.Draw(im)
        d.text((40, 24), 'Four seconds of walking on planks', font=_font(26, True), fill=INK)
        d.text((40, 60), 'the same walk, the same seed \u2014 the only difference is whether he is inside a hut', font=_font(14), fill=DIM)
        d.text((40, 96), f'now playing: {label}', font=_font(20, True), fill=colour)
        for db_ in range(-20, int(bot), -10):
            y = y0 + (y1 - y0) * (top - db_) / (top - bot)
            d.line([(x0, y), (x1, y)], fill=GRID)
            d.text((x0 - 34, y - 8), f'{db_}', font=_font(12), fill=(110, 116, 124))
        for space, lab, col in SPACES[:2]:
            st = traces[space]
            pts = [(x0 + (x1 - x0) * i / len(st), y0 + (y1 - y0) * (top - np.clip(v, bot, top)) / (top - bot)) for i, v in enumerate(st)]
            d.line(pts, fill=col if space == playing else tuple(c * 2 // 3 for c in col), width=2 if space == playing else 1)
            p50 = float(np.percentile(st, 50))
            y = y0 + (y1 - y0) * (top - p50) / (top - bot)
            d.line([(x0, y), (x1, y)], fill=col if space == playing else tuple(c * 2 // 3 for c in col))
            d.text((x1 + 8, y - 8), f'{p50:.0f}', font=_font(13, True), fill=col if space == playing else tuple(c * 2 // 3 for c in col))
        d.text((x1 + 8, y0 - 6), 'the middle of', font=_font(11), fill=DIM)
        d.text((x1 + 8, y0 + 7), 'the walk (p50)', font=_font(11), fill=DIM)
        d.text((40, H - 40), 'The peaks are the boots and they land on top of each other. What moves is the quiet in between: the room is still sounding when the next boot arrives.', font=_font(14), fill=(170, 176, 184))
        im.save(os.path.join(out_dir, f'card-{playing}.png'))
        print('wrote', os.path.join(out_dir, f'card-{playing}.png'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/room')
    ap.add_argument('--tag', default='after')
    ap.add_argument('--out')
    ap.add_argument('--card', help='write the clip video backgrounds to this directory instead')
    args = ap.parse_args()

    takes, curves = {}, {}
    for space, _, _ in SPACES:
        a, sr = load(os.path.join(args.takes, f'{args.tag}-{space}.wav'))
        takes[space] = mono(a)
        curves[space] = tail(takes[space], sr)

    if args.card:
        return card(takes, sr, args.card)

    open_ = takes['open']
    for space, label, _ in SPACES:
        print(f'{space:6s} adds {added(takes[space], open_, sr):+6.1f} dB against the steps   falls 20 dB in {rt(curves[space], sr):4.0f} ms')
    print()
    print(f'{"leg":10s} {"the steps (p95)":>34s}   {"between them (p50)":>34s}   added')
    for leg, t0, t1 in LEGS:
        cells = []
        for pct in (95, 50):
            cells.append('  '.join(f'{np.percentile(short_term(takes[s][int(t0 * sr) : int(t1 * sr)], sr), pct):6.1f}' for s, _, _ in SPACES))
        print(f'{leg:10s} {cells[0]:>34s}   {cells[1]:>34s}   {added(takes["room"], open_, sr, t0, t1):+6.1f}')
    print(f'{"":10s} {"open   room   bore":>34s}   {"open   room   bore":>34s}')

    if not args.out:
        return

    W, H = 1280, 496
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'The peaks do not move; the quiet between them does', font=_font(21, True), fill=INK)
    d.text((18, 40), 'The same walk, the same seed, the space term forced. Short-term level, 20 ms windows. Amber = outdoors, green = in a hut (0.7).', font=_font(12), fill=DIM)

    # top: four seconds of walking on planks, the hut's own floor, both takes over each other
    leg, t0, t1 = next(l for l in LEGS if l[0] == 'wood')
    x0, x1, y0, y1 = 64, W - 250, 96, 276
    top, bot = -18.0, -78.0
    d.text((x0, y0 - 20), f'the {leg} leg \u2014 {t1 - t0:.0f} s of walking on planks, which is what a hut has underfoot', font=_font(14, True), fill=INK)
    for db_ in range(-20, int(bot), -10):
        y = y0 + (y1 - y0) * (top - db_) / (top - bot)
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x0 - 30, y - 7), f'{db_}', font=_font(11), fill=(110, 116, 124))
    for space, label, colour in SPACES[:2]:
        st = short_term(takes[space][int(t0 * sr) : int(t1 * sr)], sr)
        pts = [(x0 + (x1 - x0) * i / len(st), y0 + (y1 - y0) * (top - np.clip(v, bot, top)) / (top - bot)) for i, v in enumerate(st)]
        d.line(pts, fill=colour, width=1)
        # the two p95s land on top of each other, which is the point, so only one is labelled
        marks = [(np.percentile(st, 50), 'between them (p50)')] + ([] if space == 'open' else [(np.percentile(st, 95), 'the steps (p95) \u2014 both takes')])
        for v, tag in marks:
            y = y0 + (y1 - y0) * (top - v) / (top - bot)
            d.line([(x1 + 4, y), (x1 + 16, y)], fill=colour)
            d.text((x1 + 20, y - 7), f'{v:.0f}  {tag}', font=_font(11, True), fill=colour)

    # bottom: the same two percentiles on every leg
    by0 = 330
    d.text((18, by0 - 24), 'Every leg of the walk: what the hut does to the steps, and to the quiet between them', font=_font(14, True), fill=INK)
    colw = (W - 60) / len(LEGS)
    for i, (leg, t0, t1) in enumerate(LEGS):
        cx = 30 + colw * (i + 0.5)
        d.text((cx - 26, by0), leg, font=_font(11, True), fill=INK)
        for j, (pct, tag) in enumerate(((95, 'steps'), (50, 'between'))):
            o95 = np.percentile(short_term(takes['open'][int(t0 * sr) : int(t1 * sr)], sr), pct)
            r95 = np.percentile(short_term(takes['room'][int(t0 * sr) : int(t1 * sr)], sr), pct)
            y = by0 + 24 + j * 38
            d.text((cx - 26, y), tag, font=_font(10), fill=DIM)
            d.text((cx - 26, y + 14), f'{o95:.0f}', font=_font(12, True), fill=SPACES[0][2])
            d.text((cx + 6, y + 14), f'{r95:.0f}', font=_font(12, True), fill=SPACES[1][2])
            lift = r95 - o95
            d.text((cx + 34, y + 14), f'{lift:+.0f}', font=_font(12, True), fill=INK if abs(lift) > 2 else (96, 102, 110))

    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    a = added(takes['room'], open_, sr)
    d.text((18, H - 40), f'Subtract the two takes and what the hut added sits {abs(a):.1f} dB under the steps themselves. It lands between the boots, not on them: the loud end of every leg is within a decibel of the open air.', font=_font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'The open take is unchanged to the renderer\u2019s last bit \u2014 outdoors nothing is built, and a step outdoors costs exactly what it did.', font=_font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
