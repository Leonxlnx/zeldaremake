#!/usr/bin/env python3
"""Before | after evidence sheet at one pose, identical normalised region.
usage: ba.py <before.png> <after.png> <x0> <y0> <x1> <y1> <out.jpg> --pose NAME [--before-label L] [--after-label L] [--label TEXT] [--width W] [--stack]
"""
import argparse
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


def crop_norm(im, x0, y0, x1, y1):
    w, h = im.size
    return im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('before'); ap.add_argument('after')
    ap.add_argument('x0', type=float); ap.add_argument('y0', type=float); ap.add_argument('x1', type=float); ap.add_argument('y1', type=float)
    ap.add_argument('out'); ap.add_argument('--pose', required=True)
    ap.add_argument('--before-label', default='BEFORE take-0116 @973a21e'); ap.add_argument('--after-label', default='AFTER world head @3d50f6c8')
    ap.add_argument('--label', default=''); ap.add_argument('--width', type=int, default=1400); ap.add_argument('--stack', action='store_true')
    a = ap.parse_args()
    b = crop_norm(Image.open(a.before).convert('RGB'), a.x0, a.y0, a.x1, a.y1)
    c = crop_norm(Image.open(a.after).convert('RGB'), a.x0, a.y0, a.x1, a.y1)
    region = f'x {a.x0:.2f}–{a.x1:.2f}  y {a.y0:.2f}–{a.y1:.2f}'
    header = 28
    f = font(15)
    if a.stack:
        w = a.width
        ph = int(w * c.height / max(c.width, 1))
        b = b.resize((w, ph), Image.LANCZOS); c = c.resize((w, ph), Image.LANCZOS)
        out = Image.new('RGB', (w, (ph + header) * 2 + (24 if a.label else 0)), (20, 20, 20))
        d = ImageDraw.Draw(out)
        d.rectangle((0, 0, w, header - 2), fill=(90, 60, 30)); out.paste(b, (0, header))
        d.text((6, 5), f'{a.before_label}  {a.pose}  {region}', fill=(255, 255, 255), font=f)
        y2 = ph + header
        d.rectangle((0, y2, w, y2 + header - 2), fill=(30, 90, 40)); out.paste(c, (0, y2 + header))
        d.text((6, y2 + 5), f'{a.after_label}  {a.pose}  {region}', fill=(255, 255, 255), font=f)
        if a.label:
            d.text((6, (ph + header) * 2 + 4), a.label, fill=(230, 230, 230), font=font(14))
    else:
        half = a.width // 2
        ph = int(half * c.height / max(c.width, 1))
        b = b.resize((half, ph), Image.LANCZOS); c = c.resize((half, ph), Image.LANCZOS)
        out = Image.new('RGB', (half * 2 + 4, ph + header + (24 if a.label else 0)), (20, 20, 20))
        out.paste(b, (0, header)); out.paste(c, (half + 4, header))
        d = ImageDraw.Draw(out)
        d.rectangle((0, 0, half, header - 2), fill=(90, 60, 30)); d.rectangle((half + 4, 0, half * 2 + 4, header - 2), fill=(30, 90, 40))
        d.text((6, 5), f'{a.before_label}  {a.pose}  {region}', fill=(255, 255, 255), font=f)
        d.text((half + 10, 5), f'{a.after_label}  {a.pose}  {region}', fill=(255, 255, 255), font=f)
        if a.label:
            d.text((6, header + ph + 4), a.label, fill=(230, 230, 230), font=font(14))
    out.save(a.out, quality=88)
    print(a.out, out.size)


if __name__ == '__main__':
    main()
