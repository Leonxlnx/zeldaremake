#!/usr/bin/env python3
"""Band composition at the owner's north-path pose (lane-10 report §1/§5 metrics), reconstructed:
upper-middle band rows 0.12-0.50: bright mist (HLS l > 0.5, s < 0.22), bark/earth brown (h 15-50, l < 0.45, s > SB),
near-black (l < DK), leafy (h 60-170, s > SL, l 0.12-0.6), mean l; far-centre box (0.30-0.70 x 0.15-0.40): mean hex, hue, B/R, l.
Usage: it83-bands.py [--sweep] img [img...]"""
import sys, numpy as np
from PIL import Image

def hls(a):
    mx = a.max(axis=2); mn = a.min(axis=2); l = (mx + mn) / 2; c = mx - mn
    s = np.where(c > 1e-6, c / np.maximum(1 - np.abs(2 * l - 1), 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.zeros_like(l)
    m = c > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    h[rm] = ((g - b)[rm] / c[rm]) % 6
    h[gm] = ((b - r)[gm] / c[gm]) + 2
    h[bm] = ((r - g)[bm] / c[bm]) + 4
    return h * 60, l, s

DK = float(sys.argv[sys.argv.index("--dk") + 1]) if "--dk" in sys.argv else 0.20
SB = float(sys.argv[sys.argv.index('--sb') + 1]) if '--sb' in sys.argv else 0.10
SL = float(sys.argv[sys.argv.index('--sl') + 1]) if '--sl' in sys.argv else 0.15

def measure(p):
    a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float32) / 255
    H, W = a.shape[:2]
    band = a[int(0.12 * H):int(0.50 * H)]
    h, l, s = hls(band)
    mist = ((l > 0.5) & (s < 0.22)).mean() * 100
    brown = ((h >= 15) & (h <= 50) & (l < 0.45) & (s > SB)).mean() * 100
    dark = (l < DK).mean() * 100
    leaf = ((h >= 60) & (h <= 170) & (s > SL) & (l > 0.12) & (l < 0.6)).mean() * 100
    box = a[int(0.15 * H):int(0.40 * H), int(0.30 * W):int(0.70 * W)]
    mc = box.reshape(-1, 3).mean(axis=0)
    hb, lb, sb = hls(mc[None, None, :])
    hexc = '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in mc)
    return dict(mist=mist, brown=brown, dark=dark, leaf=leaf, l=float(l.mean()), box=hexc, bh=float(hb[0, 0]), bl=float(lb[0, 0]), bs=float(sb[0, 0]), br=float(mc[2] / max(mc[0], 1e-6)))

args = [x for x in sys.argv[1:] if not x.startswith('--') and not x.replace('.', '').isdigit()]
print(f"{'image':58s} mist%  brown%  dark%  leaf%  mean-l | far-centre box hex  hue  s     l     B/R")
for p in args:
    m = measure(p)
    print(f"{p[-58:]:58s} {m['mist']:5.1f}  {m['brown']:5.1f}   {m['dark']:5.1f}  {m['leaf']:5.1f}  {m['l']:.3f}  | {m['box']} {m['bh']:5.0f}° {m['bs']:.2f}  {m['bl']:.3f} {m['br']:.2f}")
