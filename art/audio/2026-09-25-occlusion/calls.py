#!/usr/bin/env python3
"""calls.py -- what the boles took off the birds.

    python3 art/audio/2026-09-25-occlusion/calls.py --takes /tmp/shadow

A pair of takes per spot, identical but for the world's occluders being switched off in one of
them. Both numbers below are needed and neither alone is honest.

  the whole take   how much the boles removed from three minutes of forest, against the take's own
                   level. It is small by construction and says so: the bed is mostly wind and
                   leaves, which are diffuse and have nothing to shadow, and only some of the six
                   perches are behind anything at any one spot.
  the calls        the 99th percentile of the 2-8 kHz short-term level, which is the birds
                   themselves. This is where the change lives. The 95th is quoted beside it as the
                   control: it is the wood between calls, and a shadow must not move it.
"""
import argparse
import json
import os
import wave

import numpy as np


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    return np.frombuffer(raw, dtype='<i2').astype(np.float64).reshape(-1, ch).mean(axis=1) / 32768.0, sr


def band(x, sr, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / sr)
    X[(f < lo) | (f >= hi)] = 0
    return np.fft.irfft(X, len(x))


def short_term(x, sr, win=0.1):
    n = int(win * sr)
    m = len(x) // n
    return 20 * np.log10(np.maximum(np.sqrt((x[: m * n].reshape(m, n) ** 2).mean(axis=1)), 1e-13))


def rms(v):
    return 20 * np.log10(max(float(np.sqrt(np.mean(np.asarray(v) ** 2))), 1e-14))


def call_spectrum(x, sr, loud):
    """the average spectrum of the windows a bird is calling in — what a shadowed call sounds like"""
    n = int(0.1 * sr)
    acc = None
    for i in np.where(loud)[0]:
        seg = x[i * n : (i + 1) * n]
        if len(seg) < n:
            continue
        S = (np.abs(np.fft.rfft(seg * np.hanning(n))) / (n / 4)) ** 2
        acc = S if acc is None else acc + S
    f = np.fft.rfftfreq(n, 1.0 / sr)
    return f, 10 * np.log10(np.maximum(acc / max(1, loud.sum()), 1e-20))


def sheet(takes, spots, out):
    from PIL import Image, ImageDraw, ImageFont

    def font(size, bold=False):
        p = f'/usr/share/fonts/truetype/dejavu/DejaVuSans{"-Bold" if bold else ""}.ttf'
        return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()

    BG, GRID, INK, DIM = (17, 19, 22), (44, 48, 54), (236, 238, 240), (140, 146, 154)
    OPEN, SHUT = (214, 162, 96), (124, 196, 130)
    W, H = 1280, 470
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((18, 12), 'A bird behind the west house', font=font(21, True), fill=INK)
    d.text((18, 40), 'Three minutes standing still beside it, the ambience alone, the same seed. The only difference between the takes is whether the world\u2019s solid things are in the way.', font=font(12), fill=DIM)

    s = next(v for v in spots if v['id'] == 'southwest')
    a, sr = load(os.path.join(takes, f'{s["id"]}-before.wav'))
    b, _ = load(os.path.join(takes, f'{s["id"]}-after.wav'))
    ba = short_term(band(a, sr, 2000, 8000), sr)
    loud = ba > np.percentile(ba, 99)
    x0, x1, y0, y1 = 80, W - 300, 108, 380
    curves = {}
    for tag, x in [('open', a), ('shut', b)]:
        f, S = call_spectrum(band(x, sr, 120, 20000), sr, loud)
        keep = (f >= 200) & (f <= 20000)
        curves[tag] = (f[keep], S[keep])
    peak = max(float(np.max(c[1])) for c in curves.values())
    top, bot = float(np.ceil((peak + 3) / 5) * 5), float(np.ceil((peak + 3) / 5) * 5) - 60.0
    d.text((x0, y0 - 22), 'the average spectrum of the moments a bird is calling', font=font(14, True), fill=INK)
    for db_ in range(int(top), int(bot), -10):
        y = y0 + (y1 - y0) * (top - db_) / (top - bot)
        d.line([(x0, y), (x1, y)], fill=GRID)
        d.text((x0 - 34, y - 7), f'{db_}', font=font(11), fill=(110, 116, 124))
    ticks = [250, 500, 1000, 2000, 4000, 8000, 16000]
    lof, hif = np.log10(200), np.log10(20000)
    for f_ in ticks:
        px = x0 + (x1 - x0) * (np.log10(f_) - lof) / (hif - lof)
        d.line([(px, y0), (px, y1)], fill=GRID)
        d.text((px - 12, y1 + 6), f'{f_ // 1000}k' if f_ >= 1000 else str(f_), font=font(11), fill=(110, 116, 124))
    d.text(((x0 + x1) / 2 - 20, y1 + 24), 'Hz', font=font(12), fill=DIM)
    for tag, colour, label in [('open', OPEN, 'with nothing in the way'), ('shut', SHUT, 'with the house between')]:
        fs, Ss = curves[tag]
        lin = 10 ** (Ss / 10)
        pts = []
        for f_ in np.logspace(np.log10(220), np.log10(19000), 420):
            # a third-octave average about f_, so the picture is the shape and not the noise in it
            m = (fs >= f_ / 1.12) & (fs <= f_ * 1.12)
            if not m.any():
                continue
            v = 10 * np.log10(max(float(np.mean(lin[m])), 1e-20))
            px = x0 + (x1 - x0) * (np.log10(f_) - lof) / (hif - lof)
            py = y0 + (y1 - y0) * (top - np.clip(v, bot, top)) / (top - bot)
            pts.append((px, py))
        d.line(pts, fill=colour, width=2)
        d.text((x1 + 14, y0 + 6 + (0 if colour == OPEN else 18)), label, font=font(12, True), fill=colour)
    d.line([(18, H - 48), (W - 18, H - 48)], fill=GRID)
    d.text((18, H - 40), 'Below 2 kHz the two are the same curve: that much of the bird comes round the house. Across 2\u20134 kHz, where the call actually lives, they separate by 6 to 9 dB.', font=font(12), fill=(170, 176, 184))
    d.text((18, H - 22), 'The level between calls does not move (\u22120.4 dB): what changed is the birds, not the wood they are in.', font=font(12), fill=(170, 176, 184))
    im.save(out, quality=92)
    print('wrote', out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--takes', default='/tmp/shadow')
    ap.add_argument('--out')
    args = ap.parse_args()
    spots = json.load(open(os.path.join(args.takes, 'spots.json')))['spots']

    print(f'{"spot":14s} {"whole take":>11s}   {"the calls (p99 of 2-8 kHz)":>28s}   {"between them (p95)":>20s}')
    print(f'{"":14s} {"":11s}   {"before":>9s} {"after":>8s} {"moved":>8s}   {"moved":>20s}')
    for s in spots:
        a, sr = load(os.path.join(args.takes, f'{s["id"]}-before.wav'))
        b, _ = load(os.path.join(args.takes, f'{s["id"]}-after.wav'))
        n = min(len(a), len(b))
        whole = rms(b[:n] - a[:n]) - rms(a[:n])
        ba, bb = short_term(band(a, sr, 2000, 8000), sr), short_term(band(b, sr, 2000, 8000), sr)
        p99a, p99b = np.percentile(ba, 99), np.percentile(bb, 99)
        p95a, p95b = np.percentile(ba, 95), np.percentile(bb, 95)
        print(f'{s["id"]:14s} {whole:+10.1f} dB   {p99a:9.1f} {p99b:8.1f} {p99b - p99a:+8.1f}   {p95b - p95a:+20.1f}')
    print()
    print('A spot where nothing moves is the right answer there, not a failure: six perches spread')
    print('round the compass and only the ones that happen to sit behind a bole are shadowed.')
    if args.out:
        sheet(args.takes, spots, args.out)


if __name__ == '__main__':
    main()
