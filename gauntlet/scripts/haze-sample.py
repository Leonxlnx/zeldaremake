#!/usr/bin/env python3
"""Sample mean display colour of rectangular regions of an image.

    haze-sample.py <image> "x0,y0,x1,y1[:label]" ...   (fractions of width/height, y down)

Prints per region: mean sRGB, hex, luminance (0..1), HSV hue/saturation and the blue/red ratio —
the numbers the atmosphere lane fits its veil colours against (reference vs render).

With --hsl it prints instead the per-pixel-mean HSL lightness and saturation and the near-black
share (pixels with l < 0.12), the vocabulary fable-5's lane-10 walk reviews use.
"""
import colorsys
import sys

import numpy as np
from PIL import Image


def hsl(px):
    """per-pixel HSL hue (deg), saturation and lightness for an (N, 3) array"""
    mx, mn = px.max(axis=1), px.min(axis=1)
    lightness = (mx + mn) / 2
    d = mx - mn
    sat = np.where(d < 1e-9, 0.0, d / np.maximum(1 - np.abs(2 * lightness - 1), 1e-9))
    hue = np.zeros_like(mx)
    nz = d > 1e-9
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    hue = np.where(nz & (mx == r), ((g - b) / np.where(nz, d, 1)) % 6, hue)
    hue = np.where(nz & (mx == g), (b - r) / np.where(nz, d, 1) + 2, hue)
    hue = np.where(nz & (mx == b), (r - g) / np.where(nz, d, 1) + 4, hue)
    return (hue * 60) % 360, sat, lightness


def main() -> int:
    args = [a for a in sys.argv[1:] if a != '--hsl']
    as_hsl = '--hsl' in sys.argv
    if len(args) < 2:
        print(__doc__)
        return 2
    img = np.asarray(Image.open(args[0]).convert('RGB'), dtype=np.float64) / 255.0
    h, w = img.shape[:2]
    print(f'{args[0]}  {w}x{h}')
    if as_hsl:
        for spec in args[1:]:
            box, _, label = spec.partition(':')
            x0, y0, x1, y1 = (float(v) for v in box.split(','))
            crop = img[int(y0 * h):max(int(y1 * h), int(y0 * h) + 1), int(x0 * w):max(int(x1 * w), int(x0 * w) + 1)]
            hue, sat, lig = hsl(crop.reshape(-1, 3))
            lit = lig > 0.06  # hue/saturation of near-black pixels is noise
            print(
                f'  {label or box:<22} l {lig.mean():.3f}  s {sat[lit].mean():.3f}  hue {hue[lit].mean():5.1f}'
                f'  near-black(l<0.12) {100 * (lig < 0.12).mean():5.1f}%  l p10 {np.percentile(lig, 10):.3f} p90 {np.percentile(lig, 90):.3f}'
            )
        return 0
    for spec in args[1:]:
        box, _, label = spec.partition(':')
        x0, y0, x1, y1 = (float(v) for v in box.split(','))
        crop = img[int(y0 * h):max(int(y1 * h), int(y0 * h) + 1), int(x0 * w):max(int(x1 * w), int(x0 * w) + 1)]
        r, g, b = crop.reshape(-1, 3).mean(axis=0)
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        hue, sat, _ = colorsys.rgb_to_hsv(r, g, b)
        p10, p90 = np.percentile(crop.reshape(-1, 3).mean(axis=1), [10, 90])
        print(
            f'  {label or box:<22} rgb {r:.3f} {g:.3f} {b:.3f}  #{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}'
            f'  lum {lum:.3f}  hue {hue*360:5.1f}  sat {sat:.3f}  B/R {b/max(r,1e-6):.3f}  p10 {p10:.3f} p90 {p90:.3f}'
        )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
