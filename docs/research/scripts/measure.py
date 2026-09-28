"""Precise measurement of Spider-Verse screen pitch, screen angle, channel
misregistration and ink-line width, on hand-verified regions of interest.

Fixes over the first pass:
  * zero-pad each tile to PAD before the FFT so period resolution is PAD/k, not
    tile/k (the first pass only ever reported 64/k = 21.33, 16.0, 12.8, ...);
  * reject flat tiles (high-pass RMS floor) so quality is not computed against a
    near-zero noise median;
  * refine the peak location by log-magnitude centroid over a 5x5 neighbourhood,
    giving sub-bin period and angle;
  * measure each colour channel separately, since a CMY screen set should put
    each ink on its own angle.
"""
import numpy as np
from PIL import Image, ImageFilter

PAD = 512


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def highpass(Y, sigma=4.0):
    im = Image.fromarray(np.clip(Y * 255.0, 0, 255).astype(np.uint8))
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(sigma)), dtype=np.float64) / 255.0
    return Y - blur


def spectrum(tile):
    """Zero-padded, Hann-windowed power spectrum plus frequency grids."""
    t = tile - tile.mean()
    ny, nx = t.shape
    t = t * np.outer(np.hanning(ny), np.hanning(nx))
    buf = np.zeros((PAD, PAD))
    oy, ox = (PAD - ny) // 2, (PAD - nx) // 2
    buf[oy:oy + ny, ox:ox + nx] = t
    F = np.fft.fftshift(np.abs(np.fft.fft2(buf)))
    f = (np.arange(PAD) - PAD // 2) / PAD
    FX, FY = np.meshgrid(f, f)
    return F, FX, FY, np.hypot(FX, FY)


def refine(F, FX, FY, idx, half=2):
    """Log-magnitude centroid around idx -> sub-bin (fx, fy)."""
    iy, ix = idx
    y0, y1 = max(0, iy - half), min(F.shape[0], iy + half + 1)
    x0, x1 = max(0, ix - half), min(F.shape[1], ix + half + 1)
    w = np.log1p(F[y0:y1, x0:x1])
    w = np.clip(w - w.min(), 0, None)
    s = w.sum()
    if s <= 0:
        return FX[idx], FY[idx]
    fx = (w * FX[y0:y1, x0:x1]).sum() / s
    fy = (w * FY[y0:y1, x0:x1]).sum() / s
    return fx, fy


def find_peaks(tile, min_px=3.0, max_px=40.0, n=3, rms_floor=0.008):
    """Return [(period_px, angle_deg, quality)] strongest first."""
    rms = float(np.sqrt(np.mean((tile - tile.mean()) ** 2)))
    if rms < rms_floor:
        return []
    F, FX, FY, R = spectrum(tile)
    ann = (R > 1.0 / max_px) & (R < 1.0 / min_px)
    med = float(np.median(F[ann]))
    if med <= 0:
        return []
    work = np.where(ann, F, 0.0)
    out = []
    for _ in range(n):
        idx = np.unravel_index(np.argmax(work), work.shape)
        amp = work[idx]
        if amp <= 0:
            break
        fx, fy = refine(F, FX, FY, idx)
        r = float(np.hypot(fx, fy))
        if r <= 0:
            break
        out.append((1.0 / r, np.degrees(np.arctan2(fy, fx)) % 180.0, amp / med))
        rr = R[idx]
        for sgn in (1, -1):
            d = np.hypot(FX - sgn * FX[idx], FY - sgn * FY[idx])
            work[d < 0.5 * rr] = 0.0
    return out


def roi_screen(path, box, label, pich, sigma=4.0):
    """Measure the screen in one ROI, on luma and on each channel."""
    a = load(path)
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    print(f"\n-- {label}   {path} x[{x0}:{x1}] y[{y0}:{y1}]  ({x1-x0}x{y1-y0}px)")
    planes = [("luma", luma(sub)),
              ("C=1-R", 1.0 - sub[..., 0]),
              ("M=1-G", 1.0 - sub[..., 1]),
              ("Y=1-B", 1.0 - sub[..., 2])]
    for name, P in planes:
        pk = find_peaks(highpass(P, sigma))
        if not pk:
            print(f"   {name:6s}  (flat / no periodic signal)")
            continue
        bits = []
        for p, ang, q in pk[:3]:
            bits.append(f"{p:5.1f}px @{ang:5.1f} deg q={q:5.1f} ({pich/p:5.1f} cyc/picH)")
        print(f"   {name:6s}  " + "\n           ".join(bits))


def channel_offsets(path, box, label, tile=128, step=64):
    """Signed subpixel offsets of G and B relative to R inside a region."""
    a = load(path)
    x0, y0, x1, y1 = box
    res = {"G-R": [], "B-R": []}
    for y in range(y0, y1 - tile + 1, step):
        for x in range(x0, x1 - tile + 1, step):
            R = a[y:y + tile, x:x + tile, 0]
            G = a[y:y + tile, x:x + tile, 1]
            B = a[y:y + tile, x:x + tile, 2]
            if R.std() < 0.03:
                continue
            for k, C in (("G-R", G), ("B-R", B)):
                dy, dx, c = phase_shift(R, C)
                if c > 0.05:
                    res[k].append((dx, dy, c))
    print(f"\n-- {label}   {path} x[{x0}:{x1}] y[{y0}:{y1}]")
    for k, v in res.items():
        if not v:
            print(f"   {k}: no confident tiles")
            continue
        arr = np.array(v)
        dx, dy = arr[:, 0], arr[:, 1]
        print(f"   {k}: n={len(v):3d}  dx median {np.median(dx):+6.2f}px "
              f"(p10 {np.percentile(dx,10):+6.2f} p90 {np.percentile(dx,90):+6.2f})  "
              f"dy median {np.median(dy):+6.2f}px "
              f"(p10 {np.percentile(dy,10):+6.2f} p90 {np.percentile(dy,90):+6.2f})  "
              f"|d| median {np.median(np.hypot(dx,dy)):5.2f}px")
    return res


def phase_shift(a, b):
    """Subpixel shift of b relative to a via phase correlation (dy, dx, conf)."""
    ny, nx = a.shape
    w = np.outer(np.hanning(ny), np.hanning(nx))
    A = np.fft.fft2((a - a.mean()) * w)
    B = np.fft.fft2((b - b.mean()) * w)
    Rf = A * np.conj(B)
    mag = np.abs(Rf)
    Rf = Rf / (mag + 1e-12)
    cc = np.fft.fftshift(np.real(np.fft.ifft2(Rf)))
    iy, ix = np.unravel_index(np.argmax(cc), cc.shape)

    def sub(c, i, n):
        if i <= 0 or i >= n - 1:
            return 0.0
        lo, mid, hi = c[i - 1], c[i], c[i + 1]
        den = lo - 2 * mid + hi
        return 0.0 if abs(den) < 1e-12 else 0.5 * (lo - hi) / den

    dy = (iy - ny // 2) + sub(cc[:, ix], iy, ny)
    dx = (ix - nx // 2) + sub(cc[iy, :], ix, nx)
    return -dy, -dx, float(cc.max())


def edge_profile(path, box, label, axis=1):
    """Per-channel profile across an edge, to read ink-line colour and width."""
    a = load(path)
    x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1]
    prof = sub.mean(axis=0) if axis == 1 else sub.mean(axis=1)
    print(f"\n-- {label}   {path} x[{x0}:{x1}] y[{y0}:{y1}]  profile across edge")
    print("   idx     R     G     B    lum   note")
    lum = luma(prof)
    for i, (r, g, b) in enumerate(prof):
        note = ""
        sat = max(r, g, b) - min(r, g, b)
        if sat > 0.10:
            hue = "R" if r == max(r, g, b) else ("G" if g == max(r, g, b) else "B")
            lowc = "r" if r == min(r, g, b) else ("g" if g == min(r, g, b) else "b")
            note = f"sat {sat:.2f} hi={hue} lo={lowc}"
        print(f"   {x0+i:4d}  {r:.3f} {g:.3f} {b:.3f}  {lum[i]:.3f}  {note}")
