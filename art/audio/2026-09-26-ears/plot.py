#!/usr/bin/env python3
"""plot.py -- how far under two ears the mono sum reads, per band and per stem.

    python3 art/audio/2026-09-26-ears/plot.py /tmp art/audio/2026-09-26-ears/ears.jpg

The same audio, measured twice: once with the channels' POWERS averaged (what two ears get) and
once with their samples averaged (what a phone gives you, and what every sheet in `art/audio/`
reported until today). The gap is not a constant — it is about 5 dB on the bed, and on the boots
it opens from 3 dB at the bottom to 7 at the top, because a step's body is centred and its tail
through the hall is not.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

W, H, PAD_L, PAD_R, PAD_T, PAD_B = 1100, 470, 104, 210, 72, 62
STEMS = (("bed", (86, 132, 90)), ("mix", (86, 108, 148)), ("steps", (196, 128, 46)))
YLO, YHI = -8.0, 0.0


def font(size, mono=False):
    p = f"/usr/share/fonts/truetype/dejavu/{'DejaVuSansMono.ttf' if mono else 'DejaVuSans.ttf'}"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default()


def main(root, out):
    data = {}
    for stem, _ in STEMS:
        a = json.load(open(os.path.join(root, f"s-{stem}-e.json")))
        b = json.load(open(os.path.join(root, f"s-{stem}-m.json")))
        k = "after" if "after" in a else list(a)[0]
        data[stem] = {band: b[k]["always_db"][band] - a[k]["always_db"][band] for band in a[k]["always_db"]}
    bands = list(data["bed"])

    img = Image.new("RGB", (W, H), (250, 249, 246))
    d = ImageDraw.Draw(img)
    f_t, f_s, f_l, f_n = font(22), font(15), font(15), font(13, True)
    d.text((PAD_L, 16), "what the lane has been measuring with one ear", (24, 24, 28), font=f_t)
    d.text((PAD_L, 44), "the same audio read twice: channel powers averaged, and channel samples averaged", (110, 108, 104), font=f_s)

    x0, x1, y0, y1 = PAD_L, W - PAD_R, PAD_T + 14, H - PAD_B
    d.rectangle([x0, y0, x1, y1], fill=(255, 255, 255), outline=(222, 220, 214))
    sy = lambda v: y1 - (y1 - y0) * (v - YLO) / (YHI - YLO)
    for g in range(-8, 1):
        d.line([x0, sy(g), x1, sy(g)], fill=(238, 236, 230) if g else (176, 174, 168))
        d.text((x0 - 40, sy(g) - 8), f"{g:+d}", (150, 148, 142), font=f_n)
    sx = lambda i: x0 + (x1 - x0) * (i + 0.5) / len(bands)
    legend = []
    for stem, colour in STEMS:
        pts = [(sx(i), sy(max(YLO, min(YHI, data[stem][b])))) for i, b in enumerate(bands)]
        d.line(pts, fill=colour, width=3)
        for p in pts:
            d.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=colour)
        legend.append((stem, colour))
    for i, b in enumerate(bands):
        d.text((sx(i) - len(b) * 3.2, y1 + 8), b, (120, 118, 112), font=f_n)
    d.text((PAD_L, y1 + 30), "band (Hz)", (120, 118, 112), font=f_n)
    d.text((16, (y0 + y1) / 2 - 20), "dB the", (120, 118, 112), font=f_n)
    d.text((16, (y0 + y1) / 2 - 6), "mono sum", (120, 118, 112), font=f_n)
    d.text((16, (y0 + y1) / 2 + 8), "reads low", (120, 118, 112), font=f_n)
    d.text((x1 + 18, y0 + 6), "the always-on level", (24, 24, 28), font=f_l)
    d.text((x1 + 18, y0 + 26), "(the 10th percentile", (120, 118, 112), font=f_n)
    d.text((x1 + 18, y0 + 42), "over time, per band)", (120, 118, 112), font=f_n)
    ly = y0 + 74
    for stem, colour in legend:
        d.rectangle([x1 + 18, ly + 4, x1 + 34, ly + 8], fill=colour)
        d.text((x1 + 42, ly - 3), stem, colour, font=f_l)
        ly += 24
    d.text((x1 + 18, y1 - 52), "music is not here:", (150, 148, 142), font=f_n)
    d.text((x1 + 18, y1 - 36), "its tenth percentile", (150, 148, 142), font=f_n)
    d.text((x1 + 18, y1 - 20), "lands in a rest", (150, 148, 142), font=f_n)
    img.save(out, quality=92)
    print(f"  wrote {out}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp", sys.argv[2] if len(sys.argv) > 2 else "art/audio/2026-09-26-ears/ears.jpg")
