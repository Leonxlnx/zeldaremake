"""Measure halftone dot pitch/angle and RGB misregistration in Spider-Verse frames.

Halftone: local 2D FFT, find dominant non-DC peak -> period (px) and screen angle.
Misregistration: per-tile phase correlation between colour channels -> subpixel offset.
"""
import sys
import glob
import numpy as np
from PIL import Image


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def window2d(n, m):
    return np.outer(np.hanning(n), np.hanning(m))


def dominant_period(patch, min_px=2.5, max_px=80.0):
    """Return (period_px, angle_deg, peak_strength) of strongest periodic component."""
    p = patch - patch.mean()
    if p.std() < 1e-6:
        return None
    n, m = p.shape
    p = p * window2d(n, m)
    F = np.fft.fftshift(np.abs(np.fft.fft2(p)))
    cy, cx = n // 2, m // 2
    fy = (np.arange(n) - cy) / n          # cycles/px
    fx = (np.arange(m) - cx) / m
    FX, FY = np.meshgrid(fx, fy)
    R = np.hypot(FX, FY)
    mask = (R > 1.0 / max_px) & (R < 1.0 / min_px)
    if not mask.any():
        return None
    Fm = np.where(mask, F, 0.0)
    idx = np.unravel_index(np.argmax(Fm), Fm.shape)
    r = R[idx]
    if r <= 0:
        return None
    period = 1.0 / r
    # angle of the wave vector; grid line direction is perpendicular
    ang = np.degrees(np.arctan2(FY[idx], FX[idx])) % 180.0
    # strength = peak / median of the annulus
    ann = Fm[mask]
    strength = Fm[idx] / (np.median(ann) + 1e-9)
    return period, ang, strength


def scan_halftone(path, tile=96, step=48, top=40):
    im = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0
    Y = luma(im)
    h, w = Y.shape
    rows = []
    for y in range(0, h - tile, step):
        for x in range(0, w - tile, step):
            r = dominant_period(Y[y:y + tile, x:x + tile])
            if r is None:
                continue
            period, ang, strength = r
            rows.append((strength, period, ang, x, y))
    rows.sort(reverse=True)
    return im.shape, rows[:top], rows


def phase_shift(a, b, upsample=32):
    """Subpixel shift (dy,dx) that best aligns b onto a, via phase correlation."""
    n, m = a.shape
    wnd = window2d(n, m)
    A = np.fft.fft2((a - a.mean()) * wnd)
    B = np.fft.fft2((b - b.mean()) * wnd)
    Rf = A * np.conj(B)
    Rf /= (np.abs(Rf) + 1e-12)
    cc = np.fft.fftshift(np.real(np.fft.ifft2(Rf)))
    iy, ix = np.unravel_index(np.argmax(cc), cc.shape)
    # parabolic subpixel refinement
    def sub(c, i, axis_len):
        if i <= 0 or i >= axis_len - 1:
            return 0.0
        lo, mid, hi = c[i - 1], c[i], c[i + 1]
        den = (lo - 2 * mid + hi)
        return 0.0 if abs(den) < 1e-12 else 0.5 * (lo - hi) / den
    dy = (iy - n // 2) + sub(cc[:, ix], iy, n)
    dx = (ix - m // 2) + sub(cc[iy, :], ix, m)
    return dy, dx, cc.max()


def scan_misreg(path, tile=192, step=96):
    im = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0
    h, w, _ = im.shape
    out = []
    for y in range(0, h - tile, step):
        for x in range(0, w - tile, step):
            R = im[y:y + tile, x:x + tile, 0]
            G = im[y:y + tile, x:x + tile, 1]
            B = im[y:y + tile, x:x + tile, 2]
            if R.std() < 0.02:
                continue
            rb = phase_shift(R, B)
            rg = phase_shift(R, G)
            out.append((x, y, rb[0], rb[1], rb[2], rg[0], rg[1], rg[2],
                        float(R.std())))
    return (h, w), out


if __name__ == "__main__":
    mode = sys.argv[1]
    files = sys.argv[2:] or sorted(glob.glob("*.jpg"))
    for f in files:
        if mode == "halftone":
            shape, top, allrows = scan_halftone(f)
            print(f"\n=== {f}  {shape[1]}x{shape[0]}")
            print(" strength  period_px  angle_deg   x    y     period/frameH")
            for s, p, a, x, y in top[:18]:
                print(f" {s:7.1f}  {p:8.2f}  {a:8.1f}  {x:4d} {y:4d}   1/{shape[0]/p:6.1f}")
            strong = [(p, a) for s, p, a, x, y in allrows if s > 12]
            if strong:
                ps = np.array([p for p, a in strong])
                ang = np.array([a for p, a in strong])
                print(f" tiles with strength>12: {len(strong)}")
                print(f" period px: median {np.median(ps):.2f}  p10 {np.percentile(ps,10):.2f}  p90 {np.percentile(ps,90):.2f}")
                hist, edges = np.histogram(ang, bins=18, range=(0, 180))
                print(" angle histogram (10 deg bins):",
                      " ".join(f"{int(e)}:{c}" for e, c in zip(edges[:-1], hist)))
        else:
            (h, w), rows = scan_misreg(f)
            print(f"\n=== {f}  {w}x{h}  misregistration (R vs B, R vs G)")
            rows.sort(key=lambda r: -(r[2] ** 2 + r[3] ** 2))
            print("   x    y   RB_dy  RB_dx  |RB|   conf   RG_dy  RG_dx  |RG|")
            for x, y, rbdy, rbdx, rbc, rgdy, rgdx, rgc, sd in rows[:20]:
                print(f" {x:4d} {y:4d} {rbdy:6.2f} {rbdx:6.2f} {np.hypot(rbdy,rbdx):5.2f} {rbc:5.2f} "
                      f" {rgdy:6.2f} {rgdx:6.2f} {np.hypot(rgdy,rgdx):5.2f}")
            mags = np.array([np.hypot(r[2], r[3]) for r in rows])
            print(f" tiles {len(rows)}  |RB| median {np.median(mags):.2f}  p90 {np.percentile(mags,90):.2f}  max {mags.max():.2f}")
