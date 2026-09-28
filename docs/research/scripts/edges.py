"""Per-channel edge analysis.

For an edge, fit each colour channel's profile independently and report
  * the sub-pixel 50% crossing position (centroid of |d/dx|), and
  * the transition width (second moment of |d/dx|).

A rigid per-channel translation moves the crossings apart but keeps widths equal.
A per-channel blur radius difference keeps crossings together but changes widths.
A displaced blur kernel changes both, asymmetrically.
"""
import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def profile_stats(p):
    """p: 1-D profile. Return (centroid_px, width_px, contrast)."""
    d = np.abs(np.gradient(p))
    s = d.sum()
    if s < 1e-9:
        return None
    x = np.arange(len(p))
    c = (d * x).sum() / s
    w = np.sqrt(((d * (x - c) ** 2).sum() / s))
    return c, w, float(p.max() - p.min())


def edge(path, box, label, axis="x"):
    a = load(path)
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    prof = sub.mean(axis=0) if axis == "x" else sub.mean(axis=1)
    base = x0 if axis == "x" else y0
    print(f"\n-- {label}\n   {path} x[{x0}:{x1}] y[{y0}:{y1}] across {axis}")
    res = {}
    for i, ch in enumerate("RGB"):
        st = profile_stats(prof[:, i])
        if st is None:
            print(f"   {ch}: flat")
            continue
        c, w, k = st
        res[ch] = (c, w, k)
        print(f"   {ch}: crossing {base + c:8.2f}px   width {w:5.2f}px   contrast {k:.3f}")
    if len(res) == 3:
        cr = {k: v[0] for k, v in res.items()}
        wd = {k: v[1] for k, v in res.items()}
        print(f"   -> offsets rel. G:  R {cr['R']-cr['G']:+.2f}px   "
              f"B {cr['B']-cr['G']:+.2f}px   (R-B {cr['R']-cr['B']:+.2f}px)")
        print(f"   -> widths rel. G:   R {wd['R']-wd['G']:+.2f}px   "
              f"B {wd['B']-wd['G']:+.2f}px")
    return res


def fringe_scan(path, box, label, axis="x"):
    """Report the most saturated columns/rows in a region and their hue,
    which shows which ink is displaced which way."""
    a = load(path)
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    prof = sub.mean(axis=0) if axis == "x" else sub.mean(axis=1)
    base = x0 if axis == "x" else y0
    sat = prof.max(axis=1) - prof.min(axis=1)
    order = np.argsort(-sat)[:10]
    print(f"\n-- {label}  most saturated {axis}-positions")
    print("    pos     R     G     B    sat   reading")
    for i in sorted(order):
        r, g, b = prof[i]
        hi = "RGB"[int(np.argmax(prof[i]))]
        lo = "RGB"[int(np.argmin(prof[i]))]
        name = {("R", "G"): "magenta-ish", ("R", "B"): "yellow-ish",
                ("G", "R"): "cyan-ish", ("G", "B"): "yellow-ish",
                ("B", "R"): "cyan-ish", ("B", "G"): "magenta-ish"}.get((hi, lo), "")
        print(f"   {base+i:4d}  {r:.3f} {g:.3f} {b:.3f}  {sat[i]:.3f}  "
              f"hi={hi} lo={lo} {name}")
