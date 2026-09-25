#!/usr/bin/env python3
"""Owner clarity direction (2026-09-22): the circled region of the owner's screenshot vs the reference's high
crowns. Per region: split 'background' (the bright sky/haze) from 'crown' pixels by luminance (Otsu on the
region), then per horizontal band (top/mid/bottom thirds): crown mean l / sat / hue, background mean l / sat,
the crown-background luminance gap, and the edge sharpness at the crown/background boundary =
mean |grad L| at boundary pixels / the gap (1.0 = a one-pixel edge; 0.2 = a five-pixel blur) plus the
transition width (px) it implies. All at a common scale (region resampled so its width is 450 px)."""
import sys, colorsys
import numpy as np
from PIL import Image
from scipy.ndimage import sobel, binary_dilation, binary_erosion, gaussian_filter

def load_region(path, box_px=None, box_norm=None, width=450):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    if box_px: x0, y0, x1, y1 = box_px
    else: x0, y0, x1, y1 = int(box_norm[0]*w), int(box_norm[1]*h), int(box_norm[2]*w), int(box_norm[3]*h)
    c = im.crop((x0, y0, x1, y1))
    c = c.resize((width, max(1, round(width * c.height / c.width))), Image.LANCZOS)
    return np.asarray(c, dtype=np.float32) / 255.0

def hsl(rgb):
    out = np.zeros_like(rgb)
    for i in range(rgb.shape[0]):
        for j in range(rgb.shape[1]):
            h, l, s = colorsys.rgb_to_hls(*rgb[i, j]); out[i, j] = (h * 360, s, l)
    return out

def otsu(v):
    hist, edges = np.histogram(v, bins=64, range=(0, 1)); c = edges[:-1] + (edges[1] - edges[0]) / 2
    best, thr = -1, 0.5
    for k in range(1, 63):
        w0 = hist[:k].sum(); w1 = hist[k:].sum()
        if w0 == 0 or w1 == 0: continue
        m0 = (hist[:k] * c[:k]).sum() / w0; m1 = (hist[k:] * c[k:]).sum() / w1
        v_ = w0 * w1 * (m0 - m1) ** 2
        if v_ > best: best, thr = v_, c[k]
    return thr

def analyse(rgb, label):
    H = hsl(rgb); L = H[..., 2]; S = H[..., 1]; hue = H[..., 0]
    thr = otsu(L)
    bg = L > thr; crown = ~bg
    gx = sobel(L, axis=1); gy = sobel(L, axis=0); g = np.hypot(gx, gy) / 8.0  # sobel scale → per-pixel gradient
    edge = binary_dilation(bg, iterations=1) & binary_dilation(crown, iterations=1)
    rows = L.shape[0]
    print(f"{label}: region {L.shape[1]}x{rows} px, Otsu split at l {thr:.2f}; background {100*bg.mean():.0f} % of the region")
    for name, sl in (('top third', slice(0, rows // 3)), ('middle', slice(rows // 3, 2 * rows // 3)), ('bottom', slice(2 * rows // 3, rows)), ('whole', slice(0, rows))):
        c = crown[sl]; b = bg[sl]; e = edge[sl]
        if c.sum() < 50 or b.sum() < 50:
            print(f"   {name:10s} (one class only)"); continue
        gap = L[sl][b].mean() - L[sl][c].mean()
        sharp = g[sl][e].mean() / max(gap, 1e-3)
        print(f"   {name:10s} crown l {L[sl][c].mean():.2f} sat {S[sl][c].mean():.2f} hue {np.median(hue[sl][c]):5.0f}°  |  background l {L[sl][b].mean():.2f} sat {S[sl][b].mean():.2f}  |  gap {gap:.2f}  |  edge |∇l|/gap {sharp:.2f} → transition ≈ {1/max(sharp,1e-3):.1f} px  (crown {100*c.mean():.0f} %)")

if __name__ == '__main__':
    analyse(load_region('/tmp/f5/it66/owner-clarity.png', box_px=(100, 60, 550, 357)), "OWNER screenshot, circled region x 100-550 / y 60-357")
    analyse(load_region('/workspace/reference/frames/F_canopy.jpg', box_norm=(0.0, 0.0, 0.5, 0.4)), "REFERENCE F_canopy, high canopy top-left (0-0.5 x 0-0.4)")
    analyse(load_region('/workspace/reference/frames-dense/demo61/d_107.jpg', box_norm=(0.15, 0.0, 0.85, 0.3)), "REFERENCE d_107, crowns over the flight (0.15-0.85 x 0-0.3)")
    analyse(load_region('/workspace/reference/frames-dense/demo61/d_020.jpg', box_norm=(0.0, 0.0, 0.6, 0.35)), "REFERENCE d_020, crowns top-left (0-0.6 x 0-0.35)")
    analyse(load_region('/workspace/reference/frames/B_house.jpg', box_norm=(0.0, 0.0, 1.0, 0.3)), "REFERENCE B_house, top band (0-1 x 0-0.3)")

def shape(rgb, label):
    from scipy.ndimage import binary_opening, label as lab_, generate_binary_structure
    H = hsl(rgb); L = H[..., 2]; hue = H[..., 0]; S = H[..., 1]
    thr = otsu(L); crown = L <= thr; bg = ~crown
    disc = np.array([[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0]], bool)  # r≈2 (5 px)
    disc7 = np.zeros((9,9),bool); yy,xx=np.ogrid[-4:5,-4:5]; disc7[(xx**2+yy**2)<=16]=True  # r=4 (9 px)
    fine = 1 - binary_opening(crown, disc).sum() / max(crown.sum(),1)
    coarse = 1 - binary_opening(crown, disc7).sum() / max(crown.sum(),1)
    edge = binary_dilation(bg, iterations=1) & binary_dilation(crown, iterations=1)
    perim_density = edge.sum() / max(crown.sum(),1)
    labs, n = lab_(crown); sizes = np.bincount(labs.ravel())[1:]; big = sizes[sizes >= 30]
    bg_hue = np.median(hue[bg]); bg_sat = S[bg].mean()
    print(f"{label}: crown detail finer than 5 px {100*fine:4.1f} %, finer than 9 px {100*coarse:4.1f} %; boundary px per crown px {perim_density:.3f}; crown blobs ≥ 30 px: {len(big)} (median {np.median(big) if len(big) else 0:.0f} px); background hue {bg_hue:.0f}° sat {bg_sat:.2f}")

if __name__ == '__main__':
    print()
    shape(load_region('/tmp/f5/it66/owner-clarity.png', box_px=(100, 60, 550, 357)), "OWNER circled region")
    shape(load_region('/workspace/reference/frames/F_canopy.jpg', box_norm=(0.0, 0.0, 0.5, 0.4)), "REFERENCE F_canopy top-left")
    shape(load_region('/workspace/reference/frames-dense/demo61/d_107.jpg', box_norm=(0.15, 0.0, 0.85, 0.3)), "REFERENCE d_107 crowns")
    shape(load_region('/workspace/reference/frames-dense/demo61/d_020.jpg', box_norm=(0.0, 0.0, 0.6, 0.35)), "REFERENCE d_020 crowns")
    shape(load_region('/workspace/reference/frames/B_house.jpg', box_norm=(0.0, 0.0, 1.0, 0.3)), "REFERENCE B_house top band")
