"""Per-channel feature displacement, robust to JPEG 4:2:0 chroma subsampling.

Phase correlation fails on these frames: JPEG stores full-resolution luma and
half-resolution chroma, so R, G and B all carry an identical full-res luma term
that pins any whitened correlation peak at zero lag. Instead, locate the same
dark feature independently in each channel and compare its sub-pixel position.

For each window we take a column-averaged profile, require exactly one dominant
dark feature (one clear minimum), and compute each channel's minimum position by
parabolic fit. The spread of the three positions is the misregistration.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

EXCLUDE = {"defocus2.jpg": [(0, 0, 680, 540)],
           "halftone.jpg": [(250, 880, 1300, 1040)]}


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


def smooth1d(v, s=1.2):
    k = int(max(3, round(s * 6)) | 1)
    t = np.arange(k) - k // 2
    g = np.exp(-0.5 * (t / s) ** 2)
    g /= g.sum()
    return np.convolve(v, g, mode="same")


def min_pos(v):
    """Sub-pixel position of the minimum of v, by parabolic fit."""
    i = int(np.argmin(v))
    if i <= 0 or i >= len(v) - 1:
        return None
    lo, mid, hi = v[i - 1], v[i], v[i + 1]
    den = lo - 2 * mid + hi
    if abs(den) < 1e-9:
        return float(i)
    return i + 0.5 * (lo - hi) / den


def unimodal(v, tol=0.55):
    """True if v has one clear dominant minimum (others are much shallower)."""
    d = v.max() - v.min()
    if d < 0.06:
        return False
    i = int(np.argmin(v))
    # find other local minima
    others = []
    for j in range(1, len(v) - 1):
        if v[j] <= v[j - 1] and v[j] <= v[j + 1] and abs(j - i) > 3:
            others.append(v[j])
    if not others:
        return True
    return (min(others) - v.min()) > tol * d


def coc_from_profile(v):
    """Transition width proxy: contrast / max|gradient|, in px."""
    g = np.abs(np.gradient(v)).max()
    if g < 1e-6:
        return None
    return float((v.max() - v.min()) / g)


def scan(path, win=34, band=20, step=8):
    a = load(path)
    L = luma(a)
    y0, y1 = picture_rows(path)
    rows = []
    for y in range(y0 + band, y1 - band, step * 2):
        for x in range(0, a.shape[1] - win, step):
            if excluded(path, x, y, win, band):
                continue
            sub = a[y:y + band, x:x + win]
            prof = sub.mean(axis=0)
            Lp = smooth1d(luma(prof))
            if not unimodal(Lp):
                continue
            c = coc_from_profile(Lp)
            if c is None:
                continue
            pos = {}
            ok = True
            for i, ch in enumerate("RGB"):
                p = min_pos(smooth1d(prof[:, i]))
                if p is None:
                    ok = False
                    break
                pos[ch] = p
            if not ok:
                continue
            vals = np.array([pos[c_] for c_ in "RGB"])
            spread = float(vals.max() - vals.min())
            if spread > 14:
                continue  # different features, not a misregistration
            gm = np.abs(np.gradient(Lp))
            sat = (prof.max(axis=1) - prof.min(axis=1))
            edge_sat = float((sat * gm).sum() / (gm.sum() + 1e-9))
            rows.append(dict(x=x, y=y, coc=c, spread=spread, edge_sat=edge_sat,
                             dRG=pos["R"] - pos["G"], dBG=pos["B"] - pos["G"],
                             dRB=pos["R"] - pos["B"]))
    return rows


def report(path):
    rows = scan(path)
    print(f"\n=== {path}   {len(rows)} unimodal windows")
    if len(rows) < 20:
        print("   too few")
        return rows
    coc = np.array([r["coc"] for r in rows])
    spr = np.array([r["spread"] for r in rows])
    es = np.array([r["edge_sat"] for r in rows])
    print(f"  CoC proxy px: p10 {np.percentile(coc,10):.1f} median "
          f"{np.median(coc):.1f} p90 {np.percentile(coc,90):.1f}")
    print(f"  edge chroma : p10 {np.percentile(es,10):.3f} median "
          f"{np.median(es):.3f} p90 {np.percentile(es,90):.3f}")
    print("\n  binned by edge chroma (how coloured the edge fringe is):")
    print("   chroma      n   RGB spread px           |dR-G|        |dB-G|   CoC px")
    qs = np.percentile(es, [0, 25, 50, 75, 90, 100])
    for lo, hi in zip(qs[:-1], qs[1:]):
        m = (es >= lo) & (es < hi)
        if m.sum() < 5:
            continue
        print(f"  {lo:.3f}-{hi:.3f} {m.sum():5d}   "
              f"{np.median(spr[m]):5.2f} (p90 {np.percentile(spr[m],90):5.2f})   "
              f"{np.median(np.abs([r['dRG'] for r in rows])[m]):5.2f}   "
              f"{np.median(np.abs([r['dBG'] for r in rows])[m]):5.2f}   "
              f"{np.median(coc[m]):5.2f}")
    print("\n  binned by CoC proxy (defocus):")
    print("   CoC px      n   RGB spread px           edge chroma")
    qs = np.percentile(coc, [0, 25, 50, 75, 90, 100])
    for lo, hi in zip(qs[:-1], qs[1:]):
        m = (coc >= lo) & (coc < hi)
        if m.sum() < 5:
            continue
        print(f"  {lo:5.2f}-{hi:5.2f} {m.sum():5d}   "
              f"{np.median(spr[m]):5.2f} (p90 {np.percentile(spr[m],90):5.2f})   "
              f"{np.median(es[m]):.3f}")
    print(f"\n  Pearson r(edge chroma, RGB spread) = {np.corrcoef(es, spr)[0,1]:+.3f}")
    print(f"  Pearson r(CoC, RGB spread)         = {np.corrcoef(coc, spr)[0,1]:+.3f}")
    print(f"  Pearson r(CoC, edge chroma)        = {np.corrcoef(coc, es)[0,1]:+.3f}")
    dRG = np.array([r["dRG"] for r in rows])
    dBG = np.array([r["dBG"] for r in rows])
    big = spr > np.percentile(spr, 75)
    print(f"\n  on the most-misregistered quartile (n={big.sum()}):")
    print(f"    dR-G median {np.median(dRG[big]):+5.2f}px  "
          f"[p10 {np.percentile(dRG[big],10):+5.2f}, p90 {np.percentile(dRG[big],90):+5.2f}]  "
          f"{100*np.mean(dRG[big]<0):.0f}% negative")
    print(f"    dB-G median {np.median(dBG[big]):+5.2f}px  "
          f"[p10 {np.percentile(dBG[big],10):+5.2f}, p90 {np.percentile(dBG[big],90):+5.2f}]  "
          f"{100*np.mean(dBG[big]<0):.0f}% negative")
    # is B between R and G?
    between = np.mean([(min(r['dRG'],0) <= r['dBG'] <= max(r['dRG'],0))
                       for r in np.array(rows)[big]])
    print(f"    B lies between R and G in {100*between:.0f}% of cases")
    return rows


if __name__ == "__main__":
    for f in sys.argv[1:]:
        report(f)
