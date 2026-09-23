#!/usr/bin/env python3
"""
spectra.py — lane 5's measurement and before / after sheets for the audio stems.

  python3 art/audio/2026-09-23-lane5/spectra.py sheet --before /tmp/audio-before --after /tmp/audio-after \
      --stem bed --out art/audio/2026-09-23-lane5/bed-before-after.jpg --json bed.json
  python3 art/audio/2026-09-23-lane5/spectra.py steps --before /tmp/audio-before --after /tmp/audio-after \
      --out steps-before-after.jpg --json steps.json

`sheet` stacks the two stems' spectrograms (0–8 kHz, 60 dB range, same scale) with the waveform
envelope under each, and writes the numbers that decide "buzzy":

  band     third-octave-ish band levels (dBFS RMS) — the 1–5 kHz bands are the hiss the owner hears
  flatness spectral flatness of the steady part (1 = white noise / hiss, 0 = tonal); a natural bed
           sits mid and MOVES, a buzz sits high and still
  drone    the level of the most stationary part of the signal: the 10th-percentile-over-time
           magnitude per bin summed over 40 Hz–10 kHz. A constant bed has drone ≈ its RMS; a bed
           that breathes has drone well below it. This is the number that says "no constant drone".
  mod      modulation depth of the broadband envelope (dB between its 10th and 90th percentile):
           how much the bed breathes.

`steps` cuts each footstep out of the `steps` stem (onsets over a threshold) and reports, per
surface leg of the scripted walk (src/audio/index.ts OFFLINE_WALK), the step count, peak level,
duration, how many separate transients each step contains (heel / roll / toe / grains) and its
spectral centroid — a synthetic "band" is one transient, a real step is several.
"""
import argparse
import json
import os
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    SMALL = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
except OSError:  # pragma: no cover - font layout differs per box
    FONT = ImageFont.load_default()
    SMALL = ImageFont.load_default()

# the scripted walk in src/audio/index.ts OFFLINE_WALK: (label, t0, t1)
LEGS = [
    ('stand', 0.0, 3.0),
    ('grass', 3.0, 8.0),
    ('dirt', 8.0, 13.0),
    ('stone', 13.0, 18.0),
    ('stairs', 18.0, 23.0),
    ('wood', 23.0, 27.0),
    ('hollow', 27.0, 31.0),
    ('leaves', 31.0, 36.0),
    ('run stone', 36.0, 41.0),
    ('stand', 41.0, 45.0),
]


def load(path):
    with wave.open(path, 'rb') as w:
        n, ch, sr = w.getnframes(), w.getnchannels(), w.getframerate()
        raw = w.readframes(n)
    a = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
    a = a.reshape(-1, ch)
    return a, sr


def mono(a):
    return a.mean(axis=1)


def db(v, floor=1e-7):
    return 20.0 * np.log10(np.maximum(v, floor))


def stft(x, sr, win=2048, hop=512):
    w = np.hanning(win).astype(np.float32)
    frames = 1 + max(0, (len(x) - win) // hop)
    out = np.empty((frames, win // 2 + 1), dtype=np.float32)
    for i in range(frames):
        seg = x[i * hop:i * hop + win] * w
        out[i] = np.abs(np.fft.rfft(seg)) / (win / 4)
    freqs = np.fft.rfftfreq(win, 1.0 / sr)
    return out, freqs, hop


BANDS = [(20, 60), (60, 125), (125, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 8000), (8000, 16000)]


def metrics(x, sr):
    mag, freqs, hop = stft(x, sr)
    power = mag ** 2
    out = {}
    out['rms_db'] = float(db(np.sqrt(np.mean(x ** 2))))
    out['peak_db'] = float(db(np.max(np.abs(x))))
    bands = {}
    for lo, hi in BANDS:
        sel = (freqs >= lo) & (freqs < hi)
        bands[f'{lo}-{hi}'] = float(db(np.sqrt(np.mean(power[:, sel].sum(axis=1)))) if sel.any() else -120.0)
    out['band_db'] = bands
    # spectral flatness of the whole stem (geometric / arithmetic mean of the mean spectrum)
    sel = (freqs >= 100) & (freqs <= 10000)
    spec = power[:, sel].mean(axis=0) + 1e-12
    out['flatness'] = float(np.exp(np.mean(np.log(spec))) / np.mean(spec))
    # drone: the level that is there ALL the time (10th percentile over time, per bin)
    floor = np.percentile(power[:, sel], 10, axis=0)
    out['drone_db'] = float(db(np.sqrt(floor.sum())))
    out['drone_under_rms_db'] = float(out['rms_db'] - out['drone_db'])
    # tone: how far the most stubborn narrow peak stands over its own neighbourhood. A sine held
    # under a bed shows up here and nowhere else — this is the number for "a constant drone".
    tsel = (freqs >= 50) & (freqs <= 5000)
    med = np.median(mag[:, tsel], axis=0) + 1e-9
    k = 21
    pad = np.pad(med, (k // 2, k // 2), mode='edge')
    local = np.array([np.median(pad[i:i + k]) for i in range(len(med))]) + 1e-9
    ratio = db(med) - db(local)
    peak = int(np.argmax(ratio))
    out['tone_peak_db'] = float(ratio[peak])
    out['tone_peak_hz'] = float(freqs[tsel][peak])
    # broadband envelope modulation (how much it breathes), 40 ms windows
    win = max(1, int(0.04 * sr))
    n = len(x) // win
    env = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1))
    e = db(env)
    out['mod_db'] = float(np.percentile(e, 90) - np.percentile(e, 10))
    out['env_p10_db'] = float(np.percentile(e, 10))
    out['env_p90_db'] = float(np.percentile(e, 90))
    # the same over the last third only: by then the walk is well away from the lantern pods, so
    # this is the wind bed breathing on its own rather than the listener leaving a light behind
    tail = e[int(len(e) * 2 / 3):]
    out['mod_tail_db'] = float(np.percentile(tail, 90) - np.percentile(tail, 10))
    return out, mag, freqs, hop


def spectrogram_image(mag, freqs, hop, sr, width, height, fmax=8000, dyn=60, top_db=-30):
    sel = freqs <= fmax
    m = db(mag[:, sel]).T  # freq x time
    # resample to the target size (log frequency axis so the bed's low body is readable)
    fr = freqs[sel]
    fr = np.maximum(fr, 20.0)
    ylog = np.log10(fr)
    ytarget = np.linspace(np.log10(40.0), np.log10(fmax), height)
    idx = np.clip(np.searchsorted(ylog, ytarget), 1, len(ylog) - 1)
    m = m[idx]
    xi = np.clip((np.linspace(0, m.shape[1] - 1, width)).astype(int), 0, m.shape[1] - 1)
    m = m[:, xi]
    v = np.clip((m - (top_db - dyn)) / dyn, 0, 1)
    v = v[::-1]  # low frequency at the bottom
    # a calm blue -> green -> warm ramp so quiet air stays dark and hiss shows up
    r = np.clip(v * 2.4 - 1.1, 0, 1)
    g = np.clip(v * 1.9 - 0.35, 0, 1)
    b = np.clip(v * 1.6, 0, 1) * (1 - 0.55 * np.clip(v * 1.6 - 0.6, 0, 1))
    img = (np.dstack([r, g, b]) * 255).astype(np.uint8)
    return Image.fromarray(img)


def envelope_image(x, sr, width, height):
    n = len(x)
    step = max(1, n // width)
    env = np.array([np.max(np.abs(x[i * step:(i + 1) * step])) if (i + 1) * step <= n else 0.0 for i in range(width)])
    img = Image.new('RGB', (width, height), (14, 16, 20))
    d = ImageDraw.Draw(img)
    mid = height // 2
    for i, e in enumerate(env):
        h = int(min(1.0, e * 6.0) * (height / 2 - 1))
        d.line((i, mid - h, i, mid + h), fill=(150, 205, 160))
    d.line((0, mid, width, mid), fill=(60, 66, 74))
    return img


def label(im, text, xy=(8, 6), font=FONT):
    d = ImageDraw.Draw(im)
    b = d.textbbox(xy, text, font=font)
    d.rectangle((b[0] - 4, b[1] - 3, b[2] + 4, b[3] + 3), fill=(0, 0, 0))
    d.text(xy, text, fill=(255, 255, 255), font=font)
    return im


def axes(im, seconds, fmax=8000):
    d = ImageDraw.Draw(im)
    w, h = im.size
    for f in (100, 250, 500, 1000, 2000, 4000):
        y = h - int((np.log10(f) - np.log10(40.0)) / (np.log10(fmax) - np.log10(40.0)) * h)
        d.line((0, y, w, y), fill=(255, 255, 255, 40))
        d.text((w - 46, y - 13), f'{f // 1000}k' if f >= 1000 else str(f), fill=(190, 200, 210), font=SMALL)
    for t0 in range(0, int(seconds) + 1, 5):
        x = int(t0 / seconds * w)
        d.line((x, h - 8, x, h), fill=(190, 200, 210))
        if t0:
            d.text((x + 3, h - 17), f'{t0}s', fill=(190, 200, 210), font=SMALL)
    return im


def sheet(args):
    width = args.width
    sh = args.spec_height
    rows = []
    stats = {}
    for name, folder in (('BEFORE', args.before), ('AFTER', args.after)):
        path = os.path.join(folder, f'{args.stem}.wav')
        a, sr = load(path)
        x = mono(a)
        secs = len(x) / sr
        m, mag, freqs, hop = metrics(x, sr)
        stats[name.lower()] = m
        spec = spectrogram_image(mag, freqs, hop, sr, width, sh)
        axes(spec, secs)
        env = envelope_image(x, sr, width, 74)
        head = (
            f'{name} — {args.stem}: rms {m["rms_db"]:.1f} dBFS   peak {m["peak_db"]:.1f}   '
            f'strongest held tone +{m["tone_peak_db"]:.1f} dB at {m["tone_peak_hz"]:.0f} Hz   '
            f'breathes {m["mod_db"]:.1f} dB'
        )
        label(spec, head)
        band = '  '.join(f'{k.split("-")[0]}–{k.split("-")[1]}: {v:.0f}' for k, v in m['band_db'].items())
        label(env, band, xy=(8, 6), font=SMALL)
        rows.append(spec)
        rows.append(env)
    gap = 6
    total = sum(r.size[1] for r in rows) + gap * (len(rows) - 1)
    out = Image.new('RGB', (width, total), (8, 9, 11))
    y = 0
    for r in rows:
        out.paste(r, (0, y))
        y += r.size[1] + gap
    out.save(args.out, quality=92)
    print(f'wrote {args.out}')
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(stats, f, indent=2)
        print(f'wrote {args.json}')
    for k in ('rms_db', 'peak_db', 'tone_peak_db', 'tone_peak_hz', 'mod_db', 'mod_tail_db', 'drone_db', 'flatness'):
        print(f'{k:22s} before {stats["before"][k]:8.2f}   after {stats["after"][k]:8.2f}')
    print('band (dBFS)            before     after')
    for band in stats['before']['band_db']:
        print(f'  {band:18s} {stats["before"]["band_db"][band]:8.1f}  {stats["after"]["band_db"][band]:8.1f}')


FRAME_S = 0.002


def frame_env(x, sr):
    """2 ms RMS envelope of the signal"""
    win = max(1, int(FRAME_S * sr))
    n = len(x) // win
    return np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1)), win


def find_steps(x, sr, refractory=0.14):
    """
    Step onsets from the envelope's RISE, not an absolute threshold: the hall's tail keeps a level
    gate open across a whole leg, but only a real attack makes the 2 ms envelope jump. An onset is
    a frame where the envelope is 6 dB over its value 10 ms earlier and over 6 % of the stem's peak.
    """
    env, win = frame_env(x, sr)
    e = db(env)
    back = max(1, int(0.010 / FRAME_S))
    floor = db(np.max(env)) - 24.0
    onsets = []
    last = -1e9
    for i in range(back, len(e)):
        t = i * FRAME_S
        if t - last < refractory:
            continue
        if e[i] > floor and e[i] - e[i - back] > 6.0 and e[i] >= e[i - 1]:
            onsets.append(t)
            last = t
    return onsets


PRE_ROLL = 0.045


def step_shape(x, sr, t0, window=0.30):
    """the shape of one step: how many separate hits it holds, how far they are spread, its colour"""
    a = max(0, int((t0 - PRE_ROLL) * sr))
    b = min(len(x), int((t0 - PRE_ROLL + window) * sr))
    seg = x[a:b]
    if len(seg) < 64:
        return None
    env, _ = frame_env(seg, sr)
    e = db(env)
    pk = float(env.max())
    # separate hits: a rise of 4 dB over 6 ms, 10 ms apart — heel, roll, toe and the grains between
    back = max(1, int(0.006 / FRAME_S))
    hits = []
    for i in range(back, len(e)):
        if e[i] - e[i - back] > 4.0 and e[i] >= e[i - 1] and env[i] > pk * 0.05:
            if not hits or (i - hits[-1]) * FRAME_S > 0.010:
                hits.append(i)
    span = float((hits[-1] - hits[0]) * FRAME_S * 1000) if len(hits) > 1 else 0.0
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freqs = np.fft.rfftfreq(len(seg), 1.0 / sr)
    centroid = float((spec * freqs).sum() / max(spec.sum(), 1e-9))
    low = float(spec[(freqs >= 40) & (freqs < 300)].sum())
    high = float(spec[(freqs >= 2000) & (freqs < 10000)].sum())
    return {
        'peak_db': float(db(pk)),
        'span_ms': span,
        'transients': len(hits),
        'centroid_hz': centroid,
        'low_over_high': float(low / max(high, 1e-9)),
    }


def steps_report(args):
    stats = {}
    for name, folder in (('before', args.before), ('after', args.after)):
        a, sr = load(os.path.join(folder, 'steps.wav'))
        x = mono(a)
        found = find_steps(x, sr)
        per = {}
        for lbl, t0, t1 in LEGS:
            if lbl == 'stand':
                continue
            mine = [s for s in found if t0 <= s < t1]
            shapes = [step_shape(x, sr, s) for s in mine]
            shapes = [s for s in shapes if s]
            if not shapes:
                per[lbl] = {'steps': 0}
                continue
            per[lbl] = {
                'steps': len(shapes),
                'peak_db': float(np.mean([s['peak_db'] for s in shapes])),
                'span_ms': float(np.mean([s['span_ms'] for s in shapes])),
                'transients': float(np.mean([s['transients'] for s in shapes])),
                'centroid_hz': float(np.mean([s['centroid_hz'] for s in shapes])),
                'low_over_high': float(np.mean([s['low_over_high'] for s in shapes])),
                'peak_spread_db': float(np.std([s['peak_db'] for s in shapes])),
            }
        stats[name] = per
    if args.json:
        with open(args.json, 'w') as f:
            json.dump(stats, f, indent=2)
        print(f'wrote {args.json}')
    print(f'{"leg":10s} {"steps/5s":>9s} {"peak dBFS":>19s} {"spread":>14s} {"hits":>14s} {"spread ms":>16s} {"centroid Hz":>19s} {"low/high":>16s}')
    for lbl, _, _ in LEGS:
        if lbl == 'stand' or lbl not in stats['before']:
            continue
        b, a = stats['before'][lbl], stats['after'][lbl]
        if not b.get('steps') or not a.get('steps'):
            print(f'{lbl:10s} {b.get("steps", 0):3d}/{a.get("steps", 0)}')
            continue
        print(
            f'{lbl:10s} {b["steps"]:4d}/{a["steps"]:<4d} '
            f'{b["peak_db"]:8.1f} -> {a["peak_db"]:6.1f}  '
            f'{b["peak_spread_db"]:5.1f} ->{a["peak_spread_db"]:5.1f}  '
            f'{b["transients"]:5.1f} ->{a["transients"]:5.1f}  '
            f'{b["span_ms"]:7.0f} -> {a["span_ms"]:5.0f}  '
            f'{b["centroid_hz"]:9.0f} -> {a["centroid_hz"]:6.0f}  '
            f'{b["low_over_high"]:7.2f} -> {a["low_over_high"]:5.2f}'
        )
    if args.out:
        step_sheet(args, stats)


def step_sheet(args, stats):
    """
    One cell per surface, BEFORE and AFTER overlaid: 280 ms from that leg's second step as a 2 ms
    RMS envelope in dBFS on one scale. A single attack and a smooth smear is a noise band; a heel,
    a gap and a toe 80–120 ms later is a footstep. The numbers under each are from `steps`.
    """
    cell_w, cell_h = 430, 186
    span = 0.28
    top_db, bot_db = -14.0, -70.0
    labels = [l for l in LEGS if l[0] != 'stand']
    cols = 4
    rows = (len(labels) + cols - 1) // cols
    width = cols * (cell_w + 10) + 10
    height = rows * (cell_h + 12) + 46
    img = Image.new('RGB', (width, height), (8, 9, 11))
    d = ImageDraw.Draw(img)
    curves = {}
    for name, folder in (('before', args.before), ('after', args.after)):
        a, sr = load(os.path.join(folder, 'steps.wav'))
        x = mono(a)
        found = find_steps(x, sr)
        for lbl, t0, t1 in labels:
            mine = [s for s in found if t0 <= s < t1]
            if not mine:
                continue
            s0 = mine[min(1, len(mine) - 1)]
            # align on the step's own loudest frame (40 ms in), so the two curves are compared by
            # shape rather than by how early each onset happened to trip the detector
            wide = x[max(0, int((s0 - 0.09) * sr)): int((s0 + 0.32) * sr)]
            env, _ = frame_env(wide, sr)
            peak = int(np.argmax(env))
            a0 = max(0, peak - int(0.04 / FRAME_S))
            curves[(name, lbl)] = db(env[a0:a0 + int(span / FRAME_S)])
    for idx, (lbl, t0, t1) in enumerate(labels):
        cx0 = 10 + (idx % cols) * (cell_w + 10)
        cy0 = 30 + (idx // cols) * (cell_h + 12)
        cell = Image.new('RGB', (cell_w, cell_h), (14, 16, 20))
        cd = ImageDraw.Draw(cell)
        plot_top = 38
        for level in (-20, -30, -40, -50, -60, -70):
            gy = int((top_db - level) / (top_db - bot_db) * (cell_h - plot_top - 12)) + plot_top
            cd.line((0, gy, cell_w - 30, gy), fill=(38, 43, 50))
            cd.text((cell_w - 28, gy - 7), str(level), fill=(86, 94, 104), font=SMALL)
        for ms in (0, 50, 100, 150, 200, 250):
            gx = int(ms / 1000 / span * cell_w)
            cd.line((gx, cell_h - 12, gx, cell_h - 6), fill=(80, 88, 98))
            cd.text((gx + 2, cell_h - 14), f'{ms}', fill=(110, 120, 132), font=SMALL)
        # the after goes under: where the before is louder its own curve is what the eye should read
        for name, colour, wide in (('after', (140, 225, 155), 2), ('before', (226, 150, 66), 2)):
            e = curves.get((name, lbl))
            if e is None:
                continue
            pts = []
            for i in range(cell_w - 30):
                k0 = int(i / (cell_w - 30) * len(e))
                k1 = max(k0 + 1, int((i + 1) / (cell_w - 30) * len(e)))
                v = float(np.max(e[k0:k1])) if k1 <= len(e) else bot_db
                gy = int((top_db - np.clip(v, bot_db, top_db)) / (top_db - bot_db) * (cell_h - plot_top - 12)) + plot_top
                pts.append((i, gy))
            cd.line(pts, fill=colour, width=wide)
        b = stats['before'].get(lbl, {})
        a = stats['after'].get(lbl, {})
        cd.text((8, 5), lbl.upper(), fill=(232, 238, 244), font=FONT)
        cd.text(
            (8, 22),
            f'centroid {b.get("centroid_hz", 0):.0f} \u2192 {a.get("centroid_hz", 0):.0f} Hz     '
            f'low/high {b.get("low_over_high", 0):.2f} \u2192 {a.get("low_over_high", 0):.1f}     '
            f'{b.get("steps", 0)} \u2192 {a.get("steps", 0)} steps / 5 s',
            fill=(170, 182, 196),
            font=SMALL,
        )
        img.paste(cell, (cx0, cy0))
    d.text((10, 8), 'ONE FOOTSTEP — 280 ms, 2 ms RMS envelope (dBFS)', fill=(232, 238, 244), font=FONT)
    d.text((width - 220, 8), 'before', fill=(226, 150, 66), font=FONT)
    d.text((width - 150, 8), 'after', fill=(140, 225, 155), font=FONT)
    d.text((10, height - 18), 'the second step of each leg of the scripted walk (src/audio/index.ts OFFLINE_WALK), aligned on its loudest frame at 40 ms; ms on the x axis', fill=(140, 150, 162), font=SMALL)
    img.save(args.out, quality=93)
    print(f'wrote {args.out}')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('sheet')
    s.add_argument('--before', required=True)
    s.add_argument('--after', required=True)
    s.add_argument('--stem', default='bed')
    s.add_argument('--out', required=True)
    s.add_argument('--json')
    s.add_argument('--width', type=int, default=1240)
    s.add_argument('--spec-height', type=int, default=250)
    s.set_defaults(func=sheet)
    t = sub.add_parser('steps')
    t.add_argument('--before', required=True)
    t.add_argument('--after', required=True)
    t.add_argument('--out')
    t.add_argument('--json')
    t.set_defaults(func=steps_report)
    args = p.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()
