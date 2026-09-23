#!/usr/bin/env python3
"""Zoomed before | after (| reference) crops of one region, for reading a change at PR size.

    pose-crop.py --out sheet.jpg --box 0.20,0.02,0.72,0.42 --zoom 2 \
                 "BEFORE=/tmp/before/f0000.png" "AFTER=/tmp/after/f0000.png" "REFERENCE=ref.jpg"

--box is x0,y0,x1,y1 as fractions of each image (y down), so panels of different sizes crop the
same part of the frame.
"""
import argparse

from PIL import Image, ImageDraw, ImageFont


def label(img, text):
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
    except OSError:
        font = ImageFont.load_default()
    box = d.textbbox((14, 12), text, font=font)
    d.rectangle((box[0] - 7, box[1] - 5, box[2] + 7, box[3] + 5), fill=(0, 0, 0))
    d.text((14, 12), text, fill=(255, 255, 255), font=font)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--box', required=True)
    ap.add_argument('--zoom', type=float, default=2.0)
    ap.add_argument('panels', nargs='+', metavar='LABEL=PATH')
    a = ap.parse_args()
    x0, y0, x1, y1 = (float(v) for v in a.box.split(','))
    panels = []
    for spec in a.panels:
        name, _, path = spec.partition('=')
        img = Image.open(path).convert('RGB')
        crop = img.crop((round(x0 * img.width), round(y0 * img.height), round(x1 * img.width), round(y1 * img.height)))
        crop = crop.resize((round(crop.width * a.zoom), round(crop.height * a.zoom)), Image.LANCZOS)
        label(crop, name)
        panels.append(crop)
    h = min(p.height for p in panels)
    panels = [p if p.height == h else p.resize((round(p.width * h / p.height), h), Image.LANCZOS) for p in panels]
    gap = 8
    sheet = Image.new('RGB', (sum(p.width for p in panels) + gap * (len(panels) - 1), h), (0, 0, 0))
    x = 0
    for p in panels:
        sheet.paste(p, (x, 0))
        x += p.width + gap
    sheet.save(a.out, quality=90)
    print(a.out, sheet.size)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
