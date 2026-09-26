#!/usr/bin/env python3
"""fable-5's seam-line read (r55 §B) — V16's joints as LINES, so length, width and depth separate.

usage: python3 seam-lines.py <view> <label>=<image> [<label>=<image> ...]
       view ∈ E_ground | C_lookback | D_log (fable-5's paving boxes; E walls Link's column off)
       e.g. python3 seam-lines.py E_ground reference=reference/frames/E_ground.jpg head=take/E_ground.png

Read: luma at 640 px wide; d = gaussian(L, 3 px) − L (blur-difference, "darker than its surround");
mask = d > 0.04 inside the box, specks < 6 px dropped, thinned to one-pixel lines (Zhang–Suen).
  line px / kpx      visible seam length per 1,000 box pixels    (reference E 55, head 073f5ff2 88)
  width px           mask area / line length                    (2.2–2.6 both sides — not a lever)
  depth              mean d along the line, and its p90
  line > 0.12        share of the line that reads as a hard groove (reference E 12 %, head 23 %)
  share > 0.12       fable-5's original joint-dark share (reference E 1.3 %, head 5.2 %)
  regions            not-seam regions ≥ 60 px after closing the lines (reference E 5, head 12 — the
                     frame's seams do not close slabs; ours close every one)
Needs numpy, pillow, scipy."""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, label, binary_dilation

BOXES = {'E_ground': (0.3, 0.75, 0.7, 1.0), 'C_lookback': (0.45, 0.62, 1.0, 1.0), 'D_log': (0.35, 0.72, 0.7, 1.0)}
LINK = {'E_ground': (0.42, 0.58), 'C_lookback': None, 'D_log': None}


def luma640(p):
    im = Image.open(p).convert('RGB')
    w, h = im.size
    im = im.resize((640, round(h * 640 / w)), Image.LANCZOS)
    a = np.asarray(im, dtype=np.float32) / 255.0
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def zhang_suen(img):
    img = img.copy().astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2 = P[:-2, 1:-1]; p3 = P[:-2, 2:]; p4 = P[1:-1, 2:]; p5 = P[2:, 2:]
            p6 = P[2:, 1:-1]; p7 = P[2:, :-2]; p8 = P[1:-1, :-2]; p9 = P[:-2, :-2]
            nb = [p2, p3, p4, p5, p6, p7, p8, p9]
            B = sum(n.astype(np.int32) for n in nb)
            seq = nb + [p2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.int32) for i in range(8))
            c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0) if step == 0 else (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            m = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if m.any():
                img[m] = 0
                changed = True
    return img


def analyse(L, view, sigma=3):
    x0, y0, x1, y1 = BOXES[view]
    h, w = L.shape
    d = gaussian_filter(L, sigma) - L
    sub = d[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    valid = np.ones_like(sub, dtype=bool)
    barrier = np.zeros_like(valid)
    if LINK[view]:
        ex0, ex1 = LINK[view]
        cw = sub.shape[1]
        barrier[:, int((ex0 - x0) / (x1 - x0) * cw):int((ex1 - x0) / (x1 - x0) * cw)] = True
        valid &= ~barrier
    m04 = (sub > 0.04) & valid
    lab, _ = label(m04)
    sizes = np.bincount(lab.ravel())
    keep = sizes >= 6
    keep[0] = False
    m04 = keep[lab]
    sk = zhang_suen(m04)
    length = int(sk.sum())
    on = sub[sk == 1]
    regions, _ = label(~(binary_dilation(m04 | (sk == 1), iterations=1) | barrier))
    rs = np.bincount(regions.ravel())[1:]
    return {
        'line px/kpx': 1000 * length / valid.sum(),
        'width px': m04.sum() / max(length, 1),
        'depth': float(on.mean()) if length else 0.0,
        'depth p90': float(np.percentile(on, 90)) if length else 0.0,
        'line > 0.12': float((on > 0.12).mean()) if length else 0.0,
        'share > 0.12': float(((sub > 0.12) & valid).sum() / valid.sum()),
        'regions ≥ 60 px': int((rs >= 60).sum()),
    }


if __name__ == '__main__':
    view = sys.argv[1]
    print(f'{view}  box {BOXES[view]}' + (f'  Link column {LINK[view]} walled off' if LINK[view] else ''))
    for arg in sys.argv[2:]:
        label_, path = arg.split('=', 1)
        o = analyse(luma640(path), view)
        print(f"{label_:14s} line {o['line px/kpx']:5.1f} px/kpx  width {o['width px']:4.2f}  depth {o['depth']:.3f} (p90 {o['depth p90']:.3f})  "
              f"line>0.12 {100*o['line > 0.12']:4.1f} %  share>0.12 {100*o['share > 0.12']:4.1f} %  regions {o['regions ≥ 60 px']}")
