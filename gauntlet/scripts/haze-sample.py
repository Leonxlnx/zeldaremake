#!/usr/bin/env python3
"""Sample mean display colour of rectangular regions of an image.

    haze-sample.py <image> "x0,y0,x1,y1[:label]" ...   (fractions of width/height, y down)

Prints per region: mean sRGB, hex, luminance (0..1), HSV hue/saturation and the blue/red ratio —
the numbers the atmosphere lane fits its veil colours against (reference vs render).
"""
import colorsys
import sys

import numpy as np
from PIL import Image


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    img = np.asarray(Image.open(sys.argv[1]).convert('RGB'), dtype=np.float64) / 255.0
    h, w = img.shape[:2]
    print(f'{sys.argv[1]}  {w}x{h}')
    for spec in sys.argv[2:]:
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
