"""Measure tone quantisation (posterisation) inside a region.

A toon ramp leaves flat plateaux joined by sharp jumps. So:
  * mask to low-gradient pixels (plateau interiors);
  * histogram their luma finely;
  * cluster the histogram peaks -> the quantisation levels actually present;
  * report the level values and the step sizes between them.

Also reports the fraction of pixels living on plateaux vs in transitions, which
separates "hard toon ramp" from "smooth falloff".
"""
import numpy as np
from PIL import Image, ImageFilter


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def analyse(path, box, label, grad_thresh=0.004, bins=256, min_frac=0.004):
    a = load(path)
    x0, y0, x1, y1 = box
    L = luma(a[y0:y1, x0:x1])
    # mild denoise so JPEG noise does not fill the plateaux
    L = np.asarray(Image.fromarray((np.clip(L, 0, 1) * 255).astype(np.uint8))
                   .filter(ImageFilter.MedianFilter(3)), dtype=np.float64) / 255.0
    gy, gx = np.gradient(L)
    g = np.hypot(gx, gy)
    flat = g < grad_thresh
    frac = flat.mean()
    print(f"\n-- {label}\n   {path} x[{x0}:{x1}] y[{y0}:{y1}]  "
          f"{(x1-x0)*(y1-y0)} px, plateau fraction {frac*100:.1f}%")
    if flat.sum() < 200:
        print("   too few plateau pixels")
        return
    vals = L[flat]
    hist, edges = np.histogram(vals, bins=bins, range=(0, 1))
    centres = 0.5 * (edges[:-1] + edges[1:])
    thr = min_frac * hist.sum()
    peaks = []
    for i in range(1, bins - 1):
        if hist[i] >= thr and hist[i] >= hist[i - 1] and hist[i] >= hist[i + 1]:
            peaks.append((centres[i], hist[i]))
    # merge peaks closer than 1/64 in luma
    merged = []
    for c, n in sorted(peaks):
        if merged and c - merged[-1][0] < 1.0 / 64:
            pc, pn = merged[-1]
            merged[-1] = ((pc * pn + c * n) / (pn + n), pn + n)
        else:
            merged.append((c, n))
    print(f"   {len(merged)} tone levels on plateaux "
          f"(>= {min_frac*100:.1f}% of plateau pixels each):")
    tot = sum(n for _, n in merged)
    for c, n in merged:
        bar = "#" * int(40 * n / max(m[1] for m in merged))
        print(f"     luma {c:.3f}  ({100*n/tot:5.1f}%)  {bar}")
    if len(merged) > 1:
        steps = np.diff([c for c, _ in merged])
        print(f"   step sizes between adjacent levels: "
              f"{', '.join(f'{s:.3f}' for s in steps)}")
        print(f"   mean step {steps.mean():.3f}  -> ~{1.0/steps.mean():.1f} "
              f"levels across the full 0-1 range")
    return merged
