#!/usr/bin/env python3
"""plot.py -- every boot plant on the walk, before and after, against the instrument's own spread.

    python3 art/audio/2026-09-26-hitch/plot.py /tmp/hitch/before /tmp/hitch/after \\
        art/audio/2026-09-26-hitch/hitch.jpg

One dot per boot plant, placed at the metre of plaza it landed on. Height is how far that plant
sat above or below the SAME plant in a smoothly-paced take of the same ground — so a dot on the
line is a step the frame pacing did not touch. The grey band is the instrument reading itself:
two smooth takes of the same build, which is as close as two recordings of this forest ever come.

Dots outside the band in the top panel are steps the player hears as Link breaking into a run on
a plaza he is strolling across.
"""
import math
import os
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import importlib.util

_spec = importlib.util.spec_from_file_location("hitched", pathlib.Path(__file__).with_name("hitched.py"))
H = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(H)

W, ROW, PAD_L, PAD_R, PAD_T = 1180, 250, 92, 28, 46
YLIM = 9.0


def font(size, mono=False):
    name = "DejaVuSansMono.ttf" if mono else "DejaVuSans.ttf"
    p = f"/usr/share/fonts/truetype/dejavu/{name}"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def paired(a, b):
    """(metre, dB) for each plant in b against the plant nearest it on the ground in a"""
    out = []
    for i in range(len(b["amps"])):
        j = int(np.argmin(np.abs(a["walked"] - b["walked"][i])))
        if abs(a["walked"][j] - b["walked"][i]) < 0.22:
            out.append((float(b["walked"][i]), H.db(b["amps"][i]) - H.db(a["amps"][j])))
    return out


def main(before, after, out):
    takes = {(r, m): H.take(root, m) for r, root in (("before", before), ("after", after)) for m in ("smooth", "smooth2", "blocking")}
    band = max(abs(d) for r in ("before", "after") for _, d in paired(takes[(r, "smooth")], takes[(r, "smooth2")]))
    rows = [
        ("before", "before  —  the wall clock", paired(takes[("before", "smooth")], takes[("before", "blocking")])),
        ("after", "after  —  the simulation clock", paired(takes[("after", "smooth")], takes[("after", "blocking")])),
    ]
    xmax = max(m for _, _, p in rows for m, _ in p) + 0.6
    img = Image.new("RGB", (W, PAD_T + ROW * 2 + 54), (250, 249, 246))
    d = ImageDraw.Draw(img)
    f_t, f_l, f_n = font(21), font(15), font(14, True)
    d.text((PAD_L, 12), "every boot plant against the same plant on a smoothly-paced walk", (24, 24, 28), font=f_t)

    plot_w = W - PAD_L - PAD_R
    for k, (key, label, pts) in enumerate(rows):
        top = PAD_T + ROW * k
        mid = top + ROW // 2
        sy = (ROW // 2 - 26) / YLIM
        d.rectangle([PAD_L, top + 12, W - PAD_R, top + ROW - 14], fill=(255, 255, 255), outline=(222, 220, 214))
        # the instrument's own spread
        d.rectangle([PAD_L, mid - band * sy, W - PAD_R, mid + band * sy], fill=(238, 240, 244))
        d.line([PAD_L, mid, W - PAD_R, mid], fill=(176, 174, 168))
        for g in (-6, -3, 3, 6):
            y = mid - g * sy
            d.line([PAD_L, y, W - PAD_R, y], fill=(236, 234, 228))
            d.text((PAD_L - 40, y - 8), f"{g:+d}", (150, 148, 142), font=f_n)
        over = 0
        for m, v in pts:
            x = PAD_L + plot_w * m / xmax
            y = mid - max(-YLIM, min(YLIM, v)) * sy
            hot = abs(v) > 3
            over += hot
            r = 5 if hot else 3.5
            d.ellipse([x - r, y - r, x + r, y + r], fill=(196, 74, 46) if hot else (86, 108, 148))
        d.text((PAD_L, top + 16), label, (24, 24, 28), font=f_l)
        d.text(
            (W - PAD_R - 300, top + 16),
            f"{over} of {len(pts)} plants outside ±3 dB",
            (196, 74, 46) if over > 3 else (60, 120, 80),
            font=f_l,
        )
        d.text((PAD_L - 84, mid - 8), "dB", (120, 118, 112), font=f_n)

    y = PAD_T + ROW * 2 + 6
    for m in range(0, int(xmax) + 1, 4):
        d.text((PAD_L + plot_w * m / xmax - 8, y), f"{m}", (120, 118, 112), font=f_n)
    d.text((PAD_L, y + 20), "metres walked down the plaza spine", (120, 118, 112), font=f_n)
    d.text(
        (W - PAD_R - 420, y + 20),
        f"grey band = two smooth takes of one build (±{band:.1f} dB)   ·   one 300 ms blocking frame a second",
        (120, 118, 112),
        font=f_n,
    )
    img.save(out, quality=92)
    print(f"  wrote {out}")


if __name__ == "__main__":
    a = sys.argv[1] if len(sys.argv) > 1 else "/tmp/hitch/before"
    b = sys.argv[2] if len(sys.argv) > 2 else "/tmp/hitch/after"
    c = sys.argv[3] if len(sys.argv) > 3 else "art/audio/2026-09-26-hitch/hitch.jpg"
    main(a, b, c)
