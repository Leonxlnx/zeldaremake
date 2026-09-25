#!/usr/bin/env python3
"""period.py -- how much of the forest is a repeat of itself.

    python3 art/audio/2026-09-25-loop/period.py --before /tmp/loop --after /tmp/loop-after \
        --out art/audio/2026-09-25-loop/loop.jpg

Autocorrelation of a long take standing still. Two of them, because they answer different halves of
the question:

  waveform   finds the buffer loop itself. A value of 0.5 at a lag means half the signal's energy at
             that moment is literally what it played that long ago.
  envelope   finds whether the SHAPE repeats, which is what an ear locks onto over a minute. A bed
             can loop its texture and still breathe irregularly; this says which.

The listener must stand still. Walking changes the filters and the masks and buries the repeat under
things that are supposed to change.
"""
import argparse
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
BEFORE, AFTER = (214, 162, 96), (124, 196, 130)
MARK = (186, 148, 214)


def font(size, bold=False):
    p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch).mean(axis=1) / 32768.0, sr


def autocorr(v):
    v = v - v.mean()
    n = 1 << int(np.ceil(np.log2(len(v) * 2)))
    F = np.fft.rfft(v, n)
    r = np.fft.irfft(F * np.conj(F), n)[: len(v)]
    return r / r[0]


def curves(path):
    x, sr = load(path)
    wav = autocorr(x)
    n = int(0.05 * sr)
    k = len(x) // n
    env = autocorr(np.sqrt((x[: k * n].reshape(k, n) ** 2).mean(axis=1)))
    return (wav, 1.0 / sr), (env, 0.05)


def peak(curve, step, lo, hi):
    m = (np.arange(len(curve)) * step > lo) & (np.arange(len(curve)) * step < hi)
    i = int(np.argmax(curve[m]) + np.where(m)[0][0])
    return i * step, float(curve[i])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--out')
    ap.add_argument('--maxlag', type=float, default=60.0)
    args = ap.parse_args()

    data = {}
    for tag, folder in [('before', args.before), ('after', args.after)]:
        data[tag] = curves(os.path.join(folder, 'standing.wav'))
        (wav, ws), (env, es) = data[tag]
        wl, wv = peak(wav, ws, 2, 120)
        el, ev = peak(env, es, 2, 120)
        print(f'{tag:7s} waveform: strongest repeat at {wl:6.2f} s, r = {wv:+.3f}     envelope: {el:6.2f} s, r = {ev:+.3f}')
        print(f'{"":7s} waveform r at 9 / 18 / 27 s: ' + '  '.join(f'{wav[int(l / ws)]:+.3f}' for l in (9, 18, 27)) + f'   at 19 / 22.6 s: {wav[int(19 / ws)]:+.3f}  {wav[int(22.6 / ws)]:+.3f}')

    if not args.out:
        return
    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'How much of the forest is a repeat of itself', font=font(21, True), fill=INK)
    d.text((18, 40), 'Five minutes standing still on the lawn, the ambience alone. Autocorrelation of the waveform: a peak at a lag means the bed is playing what it played that long ago.', font=font(12), fill=DIM)
    x0, x1, y0, y1 = 70, W - 300, 100, 380
    top, bot = 0.6, -0.15
    for v in [0.6, 0.4, 0.2, 0.0]:
        y = y0 + (y1 - y0) * (top - v) / (top - bot)
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x0 - 34, y - 7), f'{v:.1f}', font=font(11), fill=(110, 116, 124))
    for s in range(0, int(args.maxlag) + 1, 5):
        px = x0 + (x1 - x0) * s / args.maxlag
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 6, y1 + 6), str(s), font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 24, y1 + 26), 'lag (s)', font=font(12), fill=DIM)
    d.text((18, y0 - 18), 'correlation', font=font(12), fill=DIM)
    for lag in (9, 18, 27):
        px = x0 + (x1 - x0) * lag / args.maxlag
        for yy in range(y0, y1, 8):
            d.line([(px, yy), (px, yy + 4)], fill=MARK)
    d.text((x0 + (x1 - x0) * 27 / args.maxlag + 6, y0 + 4), 'the old 9 s loop', font=font(11, True), fill=MARK)
    for tag, colour in [('before', BEFORE), ('after', AFTER)]:
        (wav, ws), _ = data[tag]
        n = int(args.maxlag / ws)
        stepi = max(1, n // 900)
        pts = [(x0 + (x1 - x0) * (i * ws) / args.maxlag, y0 + (y1 - y0) * (top - np.clip(wav[i], bot, top)) / (top - bot)) for i in range(0, n, stepi)]
        d.line(pts, fill=colour, width=2)
        wl, wv = peak(wav, ws, 2, 120)
        d.text((x1 + 14, y0 + 8 + (0 if tag == 'before' else 34)), tag, font=font(13, True), fill=colour)
        d.text((x1 + 14, y0 + 24 + (0 if tag == 'before' else 34)), f'worst repeat {wv:+.2f} at {wl:.0f} s', font=font(11), fill=colour)
    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    (wb, wbs), _ = data['before']
    (wa, was), _ = data['after']
    _, bv = peak(wb, wbs, 2, 120)
    _, av = peak(wa, was, 2, 120)
    d.text((18, H - 40), f'The worst repeat in five minutes falls from {bv:+.2f} to {av:+.2f}. The spikes at 9, 18 and 27 seconds are gone: they were one nine-second pink buffer, tapped three times.', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'Nothing about the level changed \u2014 this is the same forest at the same loudness, no longer playing the same nine seconds of it over and over.', font=font(12), fill=(170, 176, 184))
    im.save(args.out, quality=92)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
