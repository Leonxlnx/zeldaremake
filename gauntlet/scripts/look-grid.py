#!/usr/bin/env python3
"""
look-grid.py — one row per play-test spot: before rest | before highest look | after rest | after highest look.

  python3 gauntlet/scripts/look-grid.py --before /tmp/play-before --after /tmp/play-after --out grid.jpg

Reads playtest.json in each folder to pick, per spot, whichever drag reached the higher view (the
pre-2026-09-23 camera looked up on a DOWNWARD drag) and the matching look-<spot>-*.jpg captures.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont


def pick(run, spot):
    look = {l['id']: l for l in run['look']}[spot]
    up = 'drag-up' if look['dragUp']['elevationDeg'] >= look['dragDown']['elevationDeg'] else 'drag-down'
    return look, up


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    B = json.load(open(os.path.join(a.before, 'playtest.json')))
    A = json.load(open(os.path.join(a.after, 'playtest.json')))
    spots = [l['id'] for l in A['look']]
    W, H = 400, 225
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    except OSError:
        font = ImageFont.load_default()
    sheet = Image.new('RGB', (W * 4, H * len(spots)), (0, 0, 0))
    for r, spot in enumerate(spots):
        cells = []
        for tag, run, folder in (('before', B, a.before), ('after', A, a.after)):
            look, up = pick(run, spot)
            cells.append((f'{tag} {spot} rest {look["rest"]["elevationDeg"]:+.0f}°', os.path.join(folder, f'look-{spot}-rest.jpg')))
            el = look['dragUp' if up == 'drag-up' else 'dragDown']['elevationDeg']
            cells.append((f'{tag} {spot} look up {el:+.0f}°', os.path.join(folder, f'look-{spot}-{up}.jpg')))
        for c, (text, path) in enumerate(cells):
            if not os.path.exists(path):
                continue
            im = Image.open(path).convert('RGB').resize((W, H))
            d = ImageDraw.Draw(im)
            b = d.textbbox((6, 5), text, font=font)
            d.rectangle((b[0] - 3, b[1] - 2, b[2] + 3, b[3] + 2), fill=(0, 0, 0))
            d.text((6, 5), text, fill=(255, 255, 255), font=font)
            sheet.paste(im, (c * W, r * H))
    sheet.save(a.out, quality=84)
    print(a.out, sheet.size)


if __name__ == '__main__':
    main()
