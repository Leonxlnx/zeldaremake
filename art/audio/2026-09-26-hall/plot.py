#!/usr/bin/env python3
"""plot.py -- what each space does to a held note, before and after.

    python3 art/audio/2026-09-26-hall/plot.py /tmp/hall/candidates.json \\
        art/audio/2026-09-26-hall/hall.jpg

One dot per pitch in the score, at the note it belongs to; height is how much louder that note
comes back in the left ear than the right. On the line is a note that comes back centred.

The pale band is ±1 dB, which is about where a level difference between the ears stops being a
colour and starts being a direction. With two independent noise streams the dots are scattered
right across it — and the score has the pitches it has, so which way the whole tune pulls is
whatever those particular notes happen to add up to.
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

W, ROW, PAD_L, PAD_R, PAD_T = 1120, 200, 96, 30, 54
YLIM = 12.0
SPACES = ("hall", "room", "gorge")


def font(size, mono=False):
    p = f"/usr/share/fonts/truetype/dejavu/{'DejaVuSansMono.ttf' if mono else 'DejaVuSans.ttf'}"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main(src, out):
    curves = json.load(open(src))
    img = Image.new("RGB", (W, PAD_T + ROW * len(SPACES) + 54), (250, 249, 246))
    d = ImageDraw.Draw(img)
    f_t, f_s, f_l, f_n = font(22), font(15), font(15), font(14, True)
    d.text((PAD_L, 14), "what each space does to a held note", (24, 24, 28), font=f_t)
    d.text((PAD_L, 41), "one dot per pitch in the score; height is how much louder it comes back in one ear than the other", (110, 108, 104), font=f_s)

    midis = [p["midi"] for p in curves["hall"]["independent"]]
    lo_m, hi_m = min(midis) - 1, max(midis) + 1
    plot_w = W - PAD_L - PAD_R
    for k, space in enumerate(SPACES):
        top = PAD_T + ROW * k
        mid = top + ROW // 2
        sy = (ROW // 2 - 24) / YLIM
        d.rectangle([PAD_L, top + 10, W - PAD_R, top + ROW - 14], fill=(255, 255, 255), outline=(222, 220, 214))
        d.rectangle([PAD_L, mid - 1 * sy, W - PAD_R, mid + 1 * sy], fill=(238, 240, 244))
        d.line([PAD_L, mid, W - PAD_R, mid], fill=(176, 174, 168))
        for g in (-9, -6, -3, 3, 6, 9):
            y = mid - g * sy
            d.line([PAD_L, y, W - PAD_R, y], fill=(238, 236, 230))
            d.text((PAD_L - 40, y - 8), f"{g:+d}", (150, 148, 142), font=f_n)
        for name, colour, r in (("independent", (196, 74, 46), 5), ("quadrature", (64, 110, 72), 4)):
            pts = curves[space][name]
            for p in pts:
                x = PAD_L + plot_w * (p["midi"] - lo_m) / (hi_m - lo_m)
                y = mid - max(-YLIM, min(YLIM, p["db"])) * sy
                d.ellipse([x - r, y - r, x + r, y + r], fill=colour)
            worst = max(abs(p["db"]) for p in pts)
            label = "two independent noise streams" if name == "independent" else "one magnitude, a quarter turn of phase"
            txt = f"{label}  —  worst {worst:.2f} dB"
            x = PAD_L + 12 if name == "independent" else W - PAD_R - 12 - d.textlength(txt, font=f_l)
            d.text((x, top + 16), txt, colour, font=f_l)
        d.text((PAD_L + 12, top + ROW - 34), space, (24, 24, 28), font=f_l)
        d.text((PAD_L - 78, mid - 8), "dB", (120, 118, 112), font=f_n)

    y = PAD_T + ROW * len(SPACES) + 4
    for m in range(40, 90, 6):
        if lo_m <= m <= hi_m:
            d.text((PAD_L + plot_w * (m - lo_m) / (hi_m - lo_m) - 10, y), f"{440 * 2 ** ((m - 69) / 12):.0f}", (120, 118, 112), font=f_n)
    d.text((PAD_L, y + 20), "the score's own pitches, Hz", (120, 118, 112), font=f_n)
    d.text((W - PAD_R - 330, y + 20), "pale band = ±1 dB   ·   on the line = the note comes back centred", (120, 118, 112), font=f_n)
    img.save(out, quality=92)
    print(f"  wrote {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/hall/candidates.json", sys.argv[2] if len(sys.argv) > 2 else "art/audio/2026-09-26-hall/hall.jpg")
