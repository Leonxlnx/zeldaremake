"""Measure ink-line width and colour on silhouette edges.

An ink line shows up as a narrow band, a few pixels wide, whose colour departs
from both sides of the edge. For a scanline crossing an edge we find the run of
pixels whose hue differs from the linear interpolation between the two flanking
plateaux, and report its width and its mean colour.
"""
import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def hexof(c):
    return "#%02X%02X%02X" % tuple(int(round(np.clip(v, 0, 1) * 255)) for v in c)


def analyse(path, box, label, axis="x", pad=6):
    a = load(path)
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    prof = sub.mean(axis=0) if axis == "x" else sub.mean(axis=1)
    base = x0 if axis == "x" else y0
    n = len(prof)
    left = prof[:pad].mean(axis=0)
    right = prof[-pad:].mean(axis=0)
    t = np.linspace(0, 1, n)[:, None]
    ramp = left[None, :] * (1 - t) + right[None, :] * t
    resid = prof - ramp
    # chromatic departure from the straight interpolation between the plateaux
    dev = np.abs(resid - resid.mean(axis=1, keepdims=True)).sum(axis=1)
    print(f"\n-- {label}\n   {path} {axis} {base}..{base+n-1}   "
          f"flank A {hexof(left)}  flank B {hexof(right)}")
    thr = 0.35 * dev.max()
    idx = np.where(dev > thr)[0]
    if len(idx) == 0:
        print("   no distinct ink band")
        return
    # contiguous run containing the peak
    pk = int(np.argmax(dev))
    lo = hi = pk
    while lo - 1 in idx:
        lo -= 1
    while hi + 1 in idx:
        hi += 1
    width = hi - lo + 1
    band = prof[lo:hi + 1].mean(axis=0)
    lum_band = float(luma(band))
    print(f"   ink band {base+lo}..{base+hi}  width {width} px  "
          f"colour {hexof(band)}  luma {lum_band:.3f}")
    print(f"   flank lumas: A {float(luma(left)):.3f}  B {float(luma(right)):.3f} "
          f"-> band is {'darker than both' if lum_band < min(luma(left), luma(right)) else 'not darker than both'}")
    print("   per-px across the band:")
    for i in range(max(0, lo - 3), min(n, hi + 4)):
        r, g, b = prof[i]
        mark = "<<" if lo <= i <= hi else "  "
        print(f"     {base+i:4d} {hexof(prof[i])}  R{r:.3f} G{g:.3f} B{b:.3f} "
              f"lum {float(luma(prof[i])):.3f} {mark}")
