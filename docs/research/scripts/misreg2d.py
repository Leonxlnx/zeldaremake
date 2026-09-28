"""2-D per-channel displacement field, measured on band-passed local windows.

The earlier whole-tile phase correlation returned ~0 because the channels share
almost all of their low-frequency content, which pins the correlation peak at the
origin. Band-passing first isolates the edge scale where the misregistration
lives, so the correlation peak becomes meaningful.

Also estimates a local circle-of-confusion proxy as contrast / max|gradient|,
which is window-size independent (the second-moment estimate used before
saturated at the window width).
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


def gauss(A, s):
    im = Image.fromarray(np.clip(A * 255.0, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), dtype=np.float64) / 255.0


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


def shift2d(a, b, maxshift=8.0):
    """Subpixel (dx, dy) of b relative to a, restricted to |d| <= maxshift."""
    ny, nx = a.shape
    w = np.outer(np.hanning(ny), np.hanning(nx))
    A = np.fft.fft2((a - a.mean()) * w)
    B = np.fft.fft2((b - b.mean()) * w)
    Rf = A * np.conj(B)
    Rf /= (np.abs(Rf) + 1e-12)
    cc = np.fft.fftshift(np.real(np.fft.ifft2(Rf)))
    cy, cx = ny // 2, nx // 2
    r = int(np.ceil(maxshift))
    win = cc[cy - r:cy + r + 1, cx - r:cx + r + 1]
    iy, ix = np.unravel_index(np.argmax(win), win.shape)

    def sub(v, i, n):
        if i <= 0 or i >= n - 1:
            return 0.0
        lo, mid, hi = v[i - 1], v[i], v[i + 1]
        den = lo - 2 * mid + hi
        return 0.0 if abs(den) < 1e-12 else 0.5 * (lo - hi) / den
    dy = (iy - r) + sub(win[:, ix], iy, win.shape[0])
    dx = (ix - r) + sub(win[iy, :], ix, win.shape[1])
    peak = float(win[iy, ix])
    return -dx, -dy, peak


def coc_proxy(L):
    """contrast / max|grad| ~ edge transition width in px."""
    gy, gx = np.gradient(L)
    g = np.hypot(gx, gy).max()
    if g < 1e-6:
        return None
    return float((L.max() - L.min()) / g)


def run(path, win=40, step=20, lo=0.8, hi=5.0, sat_min=0.07):
    a = load(path)
    h, w = a.shape[:2]
    y0, y1 = picture_rows(path)
    bp = np.dstack([gauss(a[..., i], lo) - gauss(a[..., i], hi) for i in range(3)])
    L = luma(a)
    sat = a.max(axis=2) - a.min(axis=2)
    out = []
    cy, cx = (y0 + y1) / 2.0, w / 2.0
    for y in range(y0, y1 - win, step):
        for x in range(0, w - win, step):
            if excluded(path, x, y, win, win):
                continue
            sub = L[y:y + win, x:x + win]
            if np.ptp(sub) < 0.10:
                continue
            s = sat[y:y + win, x:x + win]
            gy, gx = np.gradient(sub)
            gm = np.hypot(gx, gy)
            if gm.max() < 0.02:
                continue
            edge_sat = float((s * gm).sum() / (gm.sum() + 1e-9))
            R = bp[y:y + win, x:x + win, 0]
            G = bp[y:y + win, x:x + win, 1]
            B = bp[y:y + win, x:x + win, 2]
            dxRG, dyRG, pRG = shift2d(G, R)
            dxBG, dyBG, pBG = shift2d(G, B)
            if min(pRG, pBG) < 0.05:
                continue
            c = coc_proxy(sub)
            if c is None:
                continue
            # bearing of the R-vs-G displacement, and bearing from frame centre
            mag = np.hypot(dxRG, dyRG)
            ang = np.degrees(np.arctan2(dyRG, dxRG)) % 360.0
            rad = np.degrees(np.arctan2(y + win / 2 - cy, x + win / 2 - cx)) % 360.0
            out.append(dict(x=x, y=y, coc=c, edge_sat=edge_sat,
                            dxRG=dxRG, dyRG=dyRG, dxBG=dxBG, dyBG=dyBG,
                            mag=mag, ang=ang, rad=rad))
    return out


def report(path):
    rows = run(path)
    print(f"\n=== {path}   {len(rows)} windows")
    if len(rows) < 10:
        print("   too few")
        return rows
    coc = np.array([r["coc"] for r in rows])
    mag = np.array([r["mag"] for r in rows])
    es = np.array([r["edge_sat"] for r in rows])
    print(f"  CoC proxy px: p10 {np.percentile(coc,10):.1f}  median "
          f"{np.median(coc):.1f}  p90 {np.percentile(coc,90):.1f}")
    bins = [0, 3, 5, 7, 10, 14, 20, 40]
    print("  CoC(px)    n   |dR-G| px            dxR-G px          dyR-G px      edge_sat")
    for a1, b1 in zip(bins[:-1], bins[1:]):
        m = (coc >= a1) & (coc < b1)
        if m.sum() < 4:
            continue
        dx = np.array([r["dxRG"] for r in rows])[m]
        dy = np.array([r["dyRG"] for r in rows])[m]
        print(f"  {a1:2d}-{b1:<3d} {m.sum():5d}   "
              f"{np.median(mag[m]):5.2f} (p90 {np.percentile(mag[m],90):5.2f})   "
              f"{np.median(dx):+5.2f} [{np.percentile(dx,10):+5.2f},{np.percentile(dx,90):+5.2f}]  "
              f"{np.median(dy):+5.2f} [{np.percentile(dy,10):+5.2f},{np.percentile(dy,90):+5.2f}]   "
              f"{np.median(es[m]):.3f}")
    print(f"  Pearson r(CoC, |dR-G|)   = {np.corrcoef(coc, mag)[0,1]:+.3f}")
    print(f"  Pearson r(CoC, edge_sat) = {np.corrcoef(coc, es)[0,1]:+.3f}")
    print(f"  Pearson r(edge_sat, |dR-G|) = {np.corrcoef(es, mag)[0,1]:+.3f}")
    # is the displacement radial from frame centre?
    strong = [r for r in rows if r["mag"] > 0.8]
    if len(strong) > 10:
        d = np.array([(r["ang"] - r["rad"] + 180) % 360 - 180 for r in strong])
        print(f"  displacement bearing minus radial bearing (n={len(strong)}): "
              f"median {np.median(d):+.0f} deg, "
              f"|<45deg| {100*np.mean(np.abs(d)<45):.0f}%  "
              f"|>135deg| {100*np.mean(np.abs(d)>135):.0f}%")
        ax = np.array([r["ang"] for r in strong])
        hb, eb = np.histogram(ax, bins=12, range=(0, 360))
        print("  absolute displacement bearing hist (30 deg bins): " +
              " ".join(f"{int(e)}:{c}" for e, c in zip(eb[:-1], hb)))
    return rows


if __name__ == "__main__":
    for f in sys.argv[1:]:
        report(f)
