#!/usr/bin/env python3
"""
light-pools.py — what the lantern lights put on the world, from probe-look frames.

  python3 gauntlet/scripts/light-pools.py pools --dir /tmp/probe --on on --off off --out sheet.jpg [--json pools.json]
  python3 gauntlet/scripts/light-pools.py steady --dir /tmp/probe --prefix t --pools-dir /tmp/probe --json steady.json

`pools`: for every <on>-<shot>.png with a matching <off>-<shot>.png (probe-look variants with the
lantern lights at their intensity and at 0), the pixels the lights brighten: share of the frame
lifted by more than 3 / 8 levels (8-bit luma), the mean and 99th-percentile lift there, the share
of lit pixels that clip (any channel >= 250) with the lights on against off. Writes an
off | on | lift sheet (the lift × 4 as a heat overlay).

`steady`: for every shot rendered at several clock times (<prefix><time>-<shot>.png, the pods
swinging between them), the mean luma of the pool (the pixels `pools` found lifted by > 3 levels
at that shot) per time and its spread, beside the whole frame's.
"""
import argparse
import glob
import json
import os
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
except OSError:
    FONT = ImageFont.load_default()


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float32)


def luma(img):
    return 0.2126 * img[..., 0] + 0.7152 * img[..., 1] + 0.0722 * img[..., 2]


def label(im, text):
    d = ImageDraw.Draw(im)
    b = d.textbbox((8, 6), text, font=FONT)
    d.rectangle((b[0] - 4, b[1] - 3, b[2] + 4, b[3] + 3), fill=(0, 0, 0))
    d.text((8, 6), text, fill=(255, 255, 255), font=FONT)
    return im


def pools(args):
    rows = []
    stats = {}
    for on_path in sorted(glob.glob(os.path.join(args.dir, f'{args.on}-*.png'))):
        shot = os.path.basename(on_path)[len(args.on) + 1:-4]
        off_path = os.path.join(args.dir, f'{args.off}-{shot}.png')
        if not os.path.exists(off_path):
            continue
        on, off = load(on_path), load(off_path)
        lift = luma(on) - luma(off)
        lit3 = lift > 3
        lit8 = lift > 8
        n = lift.size
        clip_on = (on.max(axis=2) >= 250) & lit3
        clip_off = (off.max(axis=2) >= 250) & lit3
        stats[shot] = {
            'shareLiftOver3': round(float(lit3.sum()) / n, 4),
            'shareLiftOver8': round(float(lit8.sum()) / n, 4),
            'meanLiftInPool': round(float(lift[lit3].mean()), 1) if lit3.any() else 0,
            'p99Lift': round(float(np.percentile(lift, 99)), 1),
            'maxLift': round(float(lift.max()), 1),
            'poolClippedOn': round(float(clip_on.sum()) / max(1, lit3.sum()), 4),
            'poolClippedOff': round(float(clip_off.sum()) / max(1, lit3.sum()), 4),
            'darkened': round(float((lift < -3).sum()) / n, 4),
        }
        heat = np.clip(lift * 4, 0, 255)
        overlay = off * 0.45
        overlay[..., 0] = np.clip(overlay[..., 0] + heat, 0, 255)
        overlay[..., 1] = np.clip(overlay[..., 1] + heat * 0.55, 0, 255)
        tiles = [
            label(Image.fromarray(off.astype(np.uint8)), f'{shot}: lanterns off'),
            label(Image.fromarray(on.astype(np.uint8)), 'lanterns on'),
            label(Image.fromarray(overlay.astype(np.uint8)), f'lift x4: {stats[shot]["shareLiftOver3"] * 100:.1f}% > 3 lv, mean {stats[shot]["meanLiftInPool"]}'),
        ]
        rows.append(tiles)
    if not rows:
        raise SystemExit('no on/off pairs found')
    w, h = rows[0][0].size
    scale = args.width / (3 * w + 16)
    tw, th = int(w * scale), int(h * scale)
    sheet = Image.new('RGB', (3 * tw + 16, len(rows) * (th + 8) - 8), (20, 20, 20))
    for r, tiles in enumerate(rows):
        for c, t in enumerate(tiles):
            sheet.paste(t.resize((tw, th), Image.LANCZOS), (c * (tw + 8), r * (th + 8)))
    sheet.save(args.out, quality=90)
    if args.json:
        json.dump(stats, open(args.json, 'w'), indent=1)
    print(json.dumps(stats, indent=1))


def steady(args):
    by_shot = {}
    pat = re.compile(rf'^{re.escape(args.prefix)}([0-9.]+)-(.+)\.png$')
    for p in glob.glob(os.path.join(args.dir, f'{args.prefix}*.png')):
        m = pat.match(os.path.basename(p))
        if m:
            by_shot.setdefault(m.group(2), []).append((float(m.group(1)), p))
    out = {}
    for shot, frames in sorted(by_shot.items()):
        frames.sort()
        on_path = os.path.join(args.pools_dir, f'on-{shot}.png')
        off_path = os.path.join(args.pools_dir, f'off-{shot}.png')
        if not (os.path.exists(on_path) and os.path.exists(off_path)):
            continue
        pool = (luma(load(on_path)) - luma(load(off_path))) > 3
        lum = [luma(load(p)) for _, p in frames]
        pool_means = [float(l[pool].mean()) for l in lum]
        frame_means = [float(l.mean()) for l in lum]
        stack = np.stack(lum)
        out[shot] = {
            'times': [t for t, _ in frames],
            'poolPixels': int(pool.sum()),
            'poolMeanLuma': [round(v, 2) for v in pool_means],
            'poolSpread': round(max(pool_means) - min(pool_means), 2),
            'poolCv': round(float(np.std(pool_means) / max(1e-6, np.mean(pool_means))), 4),
            'frameMeanLuma': [round(v, 2) for v in frame_means],
            'frameSpread': round(max(frame_means) - min(frame_means), 2),
            'poolPixelStdP95': round(float(np.percentile(stack.std(axis=0)[pool], 95)), 2) if pool.any() else None,
        }
    if args.json:
        json.dump(out, open(args.json, 'w'), indent=1)
    print(json.dumps(out, indent=1))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('pools')
    a.add_argument('--dir', required=True)
    a.add_argument('--on', default='on')
    a.add_argument('--off', default='off')
    a.add_argument('--out', required=True)
    a.add_argument('--json')
    a.add_argument('--width', type=int, default=1500)
    b = sub.add_parser('steady')
    b.add_argument('--dir', required=True)
    b.add_argument('--prefix', default='t')
    b.add_argument('--pools-dir', required=True)
    b.add_argument('--json')
    args = ap.parse_args()
    pools(args) if args.cmd == 'pools' else steady(args)


if __name__ == '__main__':
    main()
