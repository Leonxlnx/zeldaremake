"""Does the per-channel offset scale with circle of confusion?

Automatically find strong, isolated, near-vertical edges across the frame. For
each one measure (a) the local blur width from the luma profile - a proxy for the
circle of confusion - and (b) the R/G/B sub-pixel crossing offsets. Then bin the
offsets by blur width.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

EXCLUDE = {  # article overlays / upscaled inset boxes, in source pixels
    "defocus2.jpg": [(0, 0, 680, 540)],
    "halftone.jpg": [(250, 880, 1300, 1040)],
}


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def picture_rows(path, aspect=2.39):
    a = load(path)
    h, w = a.shape[:2]
    if abs(w / h - aspect) < 0.06 * aspect:
        return 0, h
    ph = int(round(w / aspect))
    y0 = max(0, (h - ph) // 2)
    return y0, min(h, y0 + ph)


def excluded(path, x, y, w, h):
    for ex0, ey0, ex1, ey1 in EXCLUDE.get(path, []):
        if x < ex1 and x + w > ex0 and y < ey1 and y + h > ey0:
            return True
    return False


def prof_stats(p):
    d = np.abs(np.gradient(p))
    s = d.sum()
    if s < 1e-9:
        return None
    x = np.arange(len(p))
    c = (d * x).sum() / s
    w = np.sqrt((d * (x - c) ** 2).sum() / s)
    return c, w


def scan(path, span=48, band=24, step=16, min_contrast=0.10):
    """span: half-width of the profile window. band: rows averaged."""
    a = load(path)
    Y = luma(a)
    y0, y1 = picture_rows(path)
    gx = np.gradient(Y, axis=1)
    rows = []
    for y in range(y0 + band, y1 - band, step):
        # column-averaged |gx| over the band -> candidate vertical edges
        g = np.abs(gx[y - band // 2:y + band // 2, :]).mean(axis=0)
        for x in range(span, a.shape[1] - span, step):
            if g[x] < 0.010:
                continue
            if g[x] < g[max(0, x - step):x + step + 1].max() - 1e-12:
                continue  # keep only the local maximum
            if excluded(path, x - span, y - band // 2, 2 * span, band):
                continue
            sub = a[y - band // 2:y + band // 2, x - span:x + span]
            prof = sub.mean(axis=0)
            L = luma(prof)
            if L.max() - L.min() < min_contrast:
                continue
            # require a monotone-ish single step: gradient energy concentrated
            d = np.abs(np.gradient(L))
            if d.max() <= 0:
                continue
            if d.sum() == 0 or (d > 0.35 * d.max()).sum() > span:
                continue
            st = {}
            ok = True
            for i, ch in enumerate("RGB"):
                s = prof_stats(prof[:, i])
                if s is None:
                    ok = False
                    break
                st[ch] = s
            if not ok:
                continue
            sl = prof_stats(L)
            blur = sl[1]
            dRG = st["R"][0] - st["G"][0]
            dBG = st["B"][0] - st["G"][0]
            dRB = st["R"][0] - st["B"][0]
            spread = max(st[c][0] for c in "RGB") - min(st[c][0] for c in "RGB")
            satmax = float((prof.max(axis=1) - prof.min(axis=1)).max())
            rows.append(dict(x=x, y=y, blur=blur, dRG=dRG, dBG=dBG, dRB=dRB,
                             spread=spread, sat=satmax,
                             contrast=float(L.max() - L.min())))
    return rows


def report(path):
    rows = scan(path)
    print(f"\n=== {path}   {len(rows)} usable vertical edges")
    if len(rows) < 8:
        print("   too few edges")
        return
    blur = np.array([r["blur"] for r in rows])
    spread = np.array([r["spread"] for r in rows])
    sat = np.array([r["sat"] for r in rows])
    dRG = np.array([r["dRG"] for r in rows])
    dBG = np.array([r["dBG"] for r in rows])
    edges = [0, 4, 6, 8, 10, 13, 16, 25]
    print("  blur(px)   n   |RGB spread|px      dR-G px          dB-G px      "
          "edge sat")
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (blur >= lo) & (blur < hi)
        if m.sum() < 3:
            continue
        print(f"  {lo:2d}-{hi:<3d} {m.sum():4d}   "
              f"{np.median(spread[m]):5.2f} (p90 {np.percentile(spread[m],90):5.2f})   "
              f"{np.median(dRG[m]):+5.2f} [{np.percentile(dRG[m],10):+5.2f},"
              f"{np.percentile(dRG[m],90):+5.2f}]  "
              f"{np.median(dBG[m]):+5.2f} [{np.percentile(dBG[m],10):+5.2f},"
              f"{np.percentile(dBG[m],90):+5.2f}]   {np.median(sat[m]):.3f}")
    # correlation
    if len(rows) > 10:
        cs = np.corrcoef(blur, spread)[0, 1]
        ca = np.corrcoef(blur, sat)[0, 1]
        print(f"  Pearson r(blur, |RGB spread|) = {cs:+.3f}")
        print(f"  Pearson r(blur, edge saturation) = {ca:+.3f}")
    # sign consistency: is one channel systematically on one side?
    print(f"  sign of dR-G: {100*np.mean(dRG<0):.0f}% negative   "
          f"sign of dB-G: {100*np.mean(dBG<0):.0f}% negative")
    return rows


if __name__ == "__main__":
    for f in sys.argv[1:]:
        report(f)
