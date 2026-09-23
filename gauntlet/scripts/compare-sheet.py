#!/usr/bin/env python3
"""
compare-sheet.py — before | after sheets for broll renders taken from the same shots file.

  python3 gauntlet/scripts/compare-sheet.py --before /tmp/owner-baseline --after /tmp/owner-after2 \
      --shots art/environment/owner-2026-09-23/shots.json --out art/environment/owner-2026-09-23/compare \
      [--extra-before /tmp/owner-baseline-new --extra-names b-upper-2,l-saria-under]

broll writes f0000.png … in shot order; this pairs them by shot name, labels each half, and writes
<name>.jpg (1920 × 540 for 960 × 540 frames). --extra-before maps shots rendered in a second
baseline run (by name, in that run's order).
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont


def frames(folder):
    return sorted(f for f in os.listdir(folder) if f.startswith('f') and f.endswith('.png'))


def label(img, text):
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    except OSError:
        font = ImageFont.load_default()
    x, y = 12, 10
    box = d.textbbox((x, y), text, font=font)
    d.rectangle((box[0] - 6, box[1] - 4, box[2] + 6, box[3] + 4), fill=(0, 0, 0))
    d.text((x, y), text, fill=(255, 255, 255), font=font)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--shots', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--extra-before')
    ap.add_argument('--extra-names', default='')
    a = ap.parse_args()
    shots = [s['name'] for s in json.load(open(a.shots))]
    extra = [n for n in a.extra_names.split(',') if n]
    base_names = [n for n in shots if n not in extra]
    before = dict(zip(base_names, frames(a.before)))
    if a.extra_before:
        before.update({n: os.path.join(a.extra_before, f) for n, f in zip(extra, frames(a.extra_before))})
    after = dict(zip(shots, frames(a.after)))
    os.makedirs(a.out, exist_ok=True)
    for name in shots:
        if name not in before or name not in after:
            print(f'skip {name}: before={name in before} after={name in after}')
            continue
        b = before[name] if os.path.isabs(before[name]) else os.path.join(a.before, before[name])
        f = os.path.join(a.after, after[name])
        bi = Image.open(b).convert('RGB')
        ai = Image.open(f).convert('RGB').resize(bi.size)
        label(bi, f'BEFORE  {name}')
        label(ai, f'AFTER  {name}')
        sheet = Image.new('RGB', (bi.width * 2 + 8, bi.height), (0, 0, 0))
        sheet.paste(bi, (0, 0))
        sheet.paste(ai, (bi.width + 8, 0))
        sheet.save(os.path.join(a.out, f'{name}.jpg'), quality=88)
        print(f'{name}: {b} | {f}')


if __name__ == '__main__':
    main()
