"""Fringe metric: chroma excursion beyond the flank-to-flank baseline.

Absolute saturation is the wrong measure - a green jacket next to a red scarf is
very saturated with no misregistration at all. What identifies misregistration is
chroma that departs from the straight interpolation between the two sides of the
edge, because a correctly registered edge (however colourful its two sides) moves
monotonically from one hue to the other.
"""
import numpy as np
from PIL import Image


def load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def fringe(path, cx, cy, half=13, band=20, pad=4):
    """Peak chroma excursion beyond the flank interpolation, in channel units."""
    a = load(path)
    prof = a[cy - band // 2:cy + band // 2, cx - half:cx + half + 1].mean(axis=0)
    n = len(prof)
    A = prof[:pad].mean(axis=0)
    B = prof[-pad:].mean(axis=0)
    t = np.linspace(0, 1, n)[:, None]
    ramp = A[None, :] * (1 - t) + B[None, :] * t
    # opponent chroma coordinates
    def opp(p):
        return np.stack([p[..., 1] - p[..., 0], p[..., 2] - p[..., 1]], axis=-1)
    resid = opp(prof) - opp(ramp)
    L = luma(prof)
    return (float(np.abs(resid).max()),
            float(L.max() - L.min()),
            float(np.abs(np.gradient(L)).max()))


IN_FOCUS = [("cup left edge", 812, 740), ("cup right edge", 906, 780),
            ("cup rim", 870, 640), ("jacket/shirt", 993, 430),
            ("tray edge", 806, 720), ("bench edge", 818, 800)]
DEFOCUSED = [("menu divider", 259, 610), ("menu board A", 150, 600),
             ("menu board B", 380, 600), ("menu board C", 430, 640),
             ("bg right wall", 1420, 400), ("bg right pane", 1520, 360)]

if __name__ == "__main__":
    for name, rows in (("IN FOCUS", IN_FOCUS), ("DEFOCUSED", DEFOCUSED)):
        print(f"\n== {name}")
        vals = []
        for lab, x, y in rows:
            f, c, g = fringe("defocus2.jpg", x, y)
            vals.append(f)
            print(f"   {lab:16s} x={x:4d} y={y:4d}  fringe {f:.3f}  "
                  f"contrast {c:.3f}  max|grad| {g:.3f}")
        print(f"   -> median fringe {np.median(vals):.3f}")
