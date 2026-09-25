#!/usr/bin/env python3
"""The owner's four 09-23 poses: before (it78-ob = a5dbf45f) vs after (it85-owner = 0149f255).
Per pose: pixels moved (>6 / >20 / >40 levels), mean luma, bright share (luma > 0.6), dark share (< 0.25), leafy share
(HLS h 60-170, s > 0.15); plus the flight box on s2-owner (x 0.50-0.95, y 0.20-0.95: dark < 0.25 / pale > 0.45 / mean luma)
against the demo's step frames d_094 / d_104."""
import json, numpy as np
from PIL import Image
exec(open('/tmp/f5/it83-bands.py').read().split('DK =')[0])
shots = [s['name'] for s in json.load(open('/tmp/f5/it78-owner.json'))]
def load(p): return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32) / 255
def luma(a): return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114
def comp(a):
    L = luma(a); h, l, s = hls(a)
    return dict(l=L.mean(), bright=100 * (L > 0.6).mean(), dark=100 * (L < 0.25).mean(), leafy=100 * ((h >= 60) & (h <= 170) & (s > 0.15) & (l > 0.12) & (l < 0.6)).mean())
for i, name in enumerate(shots):
    b = load(f'/tmp/f5/it78-ob/f{i:04d}.png'); a = load(f'/tmp/f5/it85-owner/f{i:04d}.png')
    d = np.abs((a - b) * 255).max(axis=2)
    cb, ca = comp(b), comp(a)
    print(f"{name:12s} moved >6 {100*(d>6).mean():5.1f} % >20 {100*(d>20).mean():5.1f} % >40 {100*(d>40).mean():5.1f} % | luma {cb['l']:.3f} → {ca['l']:.3f} | bright(>0.6) {cb['bright']:.1f} → {ca['bright']:.1f} % | dark(<0.25) {cb['dark']:.1f} → {ca['dark']:.1f} % | leafy {cb['leafy']:.1f} → {ca['leafy']:.1f} %")
def flight(a, box=(0.50, 0.20, 0.95, 0.95)):
    H, W = a.shape[:2]; r = a[int(box[1] * H):int(box[3] * H), int(box[0] * W):int(box[2] * W)]; L = luma(r)
    return 100 * (L < 0.25).mean(), 100 * (L > 0.45).mean(), L.mean()
print('--- the flight at s2-owner (x 0.50-0.95, y 0.20-0.95): dark / pale / mean luma')
for name, p in (('a5dbf45f', '/tmp/f5/it78-ob/f0000.png'), ('0149f255', '/tmp/f5/it85-owner/f0000.png')):
    d, pl, l = flight(load(p)); print(f'  {name:9s} dark {d:.1f} % pale {pl:.1f} % l {l:.3f}')
for name, p, box in (('d_104', '/workspace/reference/frames-dense/demo61/d_104.jpg', (0.79, 0.03, 0.865, 0.28)), ('d_094', '/workspace/reference/frames-dense/demo61/d_094.jpg', (0.0, 0.24, 0.11, 0.58))):
    d, pl, l = flight(load(p), box); print(f'  demo {name} dark {d:.1f} % pale {pl:.1f} % l {l:.3f}')
