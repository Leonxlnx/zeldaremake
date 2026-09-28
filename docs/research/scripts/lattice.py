"""Direct geometric measurement of a halftone lattice.

Finds dot centres as local maxima of the band-passed signal, then reports the
nearest-neighbour distance and bearing distributions. This is independent of any
interpretation of the Fourier peaks, so it cross-checks measure.py.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def bandpass(Y, lo=1.0, hi=6.0):
    def g(s):
        im = Image.fromarray(np.clip(Y * 255.0, 0, 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), dtype=np.float64) / 255.0
    return g(lo) - g(hi)


def local_maxima(S, rad=1, frac=0.25):
    im = Image.fromarray(((S - S.min()) / (np.ptp(S) + 1e-9) * 255).astype(np.uint8))
    dil = np.asarray(im.filter(ImageFilter.MaxFilter(2 * rad + 1)), dtype=np.float64)
    cur = np.asarray(im, dtype=np.float64)
    thr = frac * 255.0
    ys, xs = np.where((cur >= dil) & (cur > thr))
    return np.stack([xs, ys], axis=1).astype(np.float64)


def nn_stats(pts, kmax=4):
    if len(pts) < 8:
        return None
    d2 = ((pts[:, None, :] - pts[None, :, :]) ** 2).sum(-1)
    np.fill_diagonal(d2, np.inf)
    order = np.argsort(d2, axis=1)
    dists, bears = [], []
    for i in range(len(pts)):
        for j in order[i, :kmax]:
            d = np.sqrt(d2[i, j])
            if not np.isfinite(d) or d < 1.5 or d > 60:
                continue
            v = pts[j] - pts[i]
            dists.append(d)
            bears.append(np.degrees(np.arctan2(v[1], v[0])) % 180.0)
    return np.array(dists), np.array(bears)


def run(path, box, label):
    a = load(path)
    x0, y0, x1, y1 = box
    S = bandpass(luma(a[y0:y1, x0:x1]))
    pts = local_maxima(S)
    st = nn_stats(pts)
    print(f"\n-- {label}  {path} x[{x0}:{x1}] y[{y0}:{y1}]  {len(pts)} dot candidates")
    if st is None:
        print("   too few dots")
        return
    d, b = st
    print(f"   nearest-neighbour distance: median {np.median(d):.2f}px  "
          f"mode-ish p25 {np.percentile(d,25):.2f}  p75 {np.percentile(d,75):.2f}")
    hist, edges = np.histogram(d, bins=np.arange(1.5, 30.5, 1.0))
    peak = edges[np.argmax(hist)]
    print(f"   distance histogram peak at {peak:.1f}-{peak+1:.1f}px  "
          f"(n={hist.max()} of {len(d)})")
    hb, eb = np.histogram(b, bins=12, range=(0, 180))
    print("   bearing hist (15 deg bins): " +
          " ".join(f"{int(e)}:{c}" for e, c in zip(eb[:-1], hb)))
    dom = eb[np.argmax(hb)]
    print(f"   dominant NN bearing {dom:.0f}-{dom+15:.0f} deg")


if __name__ == "__main__":
    run("halftone.jpg", (580, 660, 700, 780), "ITSV collider AM dot screen")
    run("halftone.jpg", (560, 700, 680, 790), "ITSV collider AM dot screen (darker band)")
