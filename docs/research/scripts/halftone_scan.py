"""Locate halftone screens in a frame and measure pitch + screen angle.

Method
------
1. Band-pass the image (subtract a Gaussian blur) so broad painted content does
   not dominate the spectrum. A printer's screen is a narrow-band signal; the
   artwork under it is broadband and low-frequency.
2. Slide a Hann-windowed tile, take |FFT|, and find the strongest peak inside a
   spatial-frequency annulus corresponding to periods of 3.5-28 px.
3. Peak quality = peak / median(annulus). A real screen gives a very sharp peak
   (quality >> 10) plus a conjugate twin; painted detail does not.
4. For square-dot screens the FFT shows TWO orthogonal fundamentals. Report both
   so the lattice orientation is unambiguous.

Angle convention: angle of the wave vector, measured CCW from +x, in [0,180).
A wave vector at A degrees means the rows of dots run at A+90 degrees.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

TWO_PI = 2.0 * np.pi


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def highpass(Y, sigma=4.0):
    im = Image.fromarray(np.clip(Y * 255.0, 0, 255).astype(np.uint8))
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(sigma)), dtype=np.float64) / 255.0
    return Y - blur


def picture_box(path, aspect=2.39, tol=0.06):
    """Return (y0, y1) of the live picture area, assuming centred letterbox."""
    a = load(path)
    h, w = a.shape[:2]
    if abs(w / h - aspect) < tol * aspect:
        return 0, h
    ph = int(round(w / aspect))
    if ph >= h:
        return 0, h
    y0 = (h - ph) // 2
    return y0, y0 + ph


def overlay_mask(a):
    """Mask out the article's red arrows and white caption text."""
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    red_arrow = (R > 0.55) & (G < 0.25) & (B < 0.25)
    white_text = (R > 0.92) & (G > 0.92) & (B > 0.92)
    bad = red_arrow | white_text
    im = Image.fromarray((bad * 255).astype(np.uint8))
    grown = np.asarray(im.filter(ImageFilter.MaxFilter(9)), dtype=np.uint8) > 0
    return grown


def peaks(patch, min_px, max_px, n=2):
    """Return up to n distinct spectral peaks: (period, angle_deg, quality)."""
    p = patch - patch.mean()
    if p.std() < 1e-5:
        return []
    ny, nx = p.shape
    p = p * np.outer(np.hanning(ny), np.hanning(nx))
    F = np.fft.fftshift(np.abs(np.fft.fft2(p)))
    fy = (np.arange(ny) - ny // 2) / ny
    fx = (np.arange(nx) - nx // 2) / nx
    FX, FY = np.meshgrid(fx, fy)
    R = np.hypot(FX, FY)
    ann = (R > 1.0 / max_px) & (R < 1.0 / min_px)
    if not ann.any():
        return []
    med = np.median(F[ann]) + 1e-12
    work = np.where(ann, F, 0.0)
    out = []
    for _ in range(n):
        idx = np.unravel_index(np.argmax(work), work.shape)
        if work[idx] <= 0:
            break
        r = R[idx]
        period = 1.0 / r
        ang = np.degrees(np.arctan2(FY[idx], FX[idx])) % 180.0
        out.append((period, ang, F[idx] / med))
        # suppress this peak and its conjugate so the next one is distinct
        for sy, sx in ((1, 1), (-1, -1)):
            d = np.hypot(FX - sy * FX[idx], FY - sx * FY[idx])
            work[d < 0.6 * r] = 0.0
    return out


def scan(path, tile=64, step=32, min_px=3.5, max_px=28.0, sigma=4.0, qmin=14.0):
    a = load(path)
    y0, y1 = picture_box(path)
    bad = overlay_mask(a)
    Y = highpass(luma(a), sigma)
    hits = []
    for y in range(y0, y1 - tile, step):
        for x in range(0, a.shape[1] - tile, step):
            if bad[y:y + tile, x:x + tile].mean() > 0.02:
                continue
            tl = Y[y:y + tile, x:x + tile]
            pk = peaks(tl, min_px, max_px, n=2)
            if not pk or pk[0][2] < qmin:
                continue
            hits.append(dict(x=x, y=y, p1=pk[0], p2=pk[1] if len(pk) > 1 else None))
    return a, (y0, y1), hits


def report(path, tile=64, step=32, qmin=14.0, topn=12, dump=0):
    a, (y0, y1), hits = scan(path, tile=tile, step=step, qmin=qmin)
    ph = y1 - y0
    print(f"\n=== {path}  {a.shape[1]}x{a.shape[0]}  picture height {ph}px  "
          f"tile={tile} qmin={qmin}")
    if not hits:
        print("  no screen-like periodic signal found")
        return
    hits.sort(key=lambda h: -h["p1"][2])
    print(f"  {len(hits)} tiles with quality>={qmin}")
    print("   qual  period_px  angle  cyc/picH   ortho(period,angle,q)     x    y")
    for h in hits[:topn]:
        p, ang, q = h["p1"]
        o = h["p2"]
        os_ = f"{o[0]:6.2f} {o[1]:6.1f} {o[2]:5.1f}" if o else "        --        "
        print(f"  {q:5.1f}  {p:8.2f}  {ang:6.1f}  {ph/p:8.1f}   {os_}  {h['x']:5d} {h['y']:5d}")
    ps = np.array([h["p1"][0] for h in hits])
    angs = np.array([h["p1"][1] for h in hits])
    print(f"  period px: median {np.median(ps):.2f}  p10 {np.percentile(ps,10):.2f}  "
          f"p90 {np.percentile(ps,90):.2f}   -> cycles/picH median {ph/np.median(ps):.1f}")
    hist, edges = np.histogram(angs, bins=12, range=(0, 180))
    print("  wave-vector angle hist (15 deg bins): " +
          " ".join(f"{int(e)}:{c}" for e, c in zip(edges[:-1], hist)))
    if dump:
        stem = path.rsplit(".", 1)[0]
        for i, h in enumerate(hits[:dump]):
            pad = tile // 2
            x0 = max(0, h["x"] - pad); yy0 = max(0, h["y"] - pad)
            box = (x0, yy0, min(a.shape[1], h["x"] + tile + pad),
                   min(a.shape[0], h["y"] + tile + pad))
            im = Image.open(path).convert("RGB").crop(box)
            im = im.resize((im.width * 6, im.height * 6), Image.NEAREST)
            im.save(f"{stem}_screen{i}.png")
        print(f"  dumped {min(dump, len(hits))} crops as {stem}_screen*.png")
    return hits


if __name__ == "__main__":
    dump = int(sys.argv[1]) if sys.argv[1].isdigit() else 0
    files = sys.argv[2:] if dump else sys.argv[1:]
    for f in files:
        report(f, dump=dump)
