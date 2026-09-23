"""Pinned-pose re-read: before / after frames of the same poses, whole-frame luma stats and a change mask.

  python3 reread.py <before_dir> <after_dir> <shots.json> <out_sheet.jpg> [--label-before X --label-after Y]

Frames are the broll outputs (f0000.png … in shot order). Luma is Rec. 709 on the sRGB-encoded values
(0–1); "top band" is rows 0–12 % of the frame; a pixel "changed" when any channel moves > 8 levels.
Prints one JSON object per pose and writes a before | after | change sheet.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw

CHANGE_LEVELS = 8
TOP_BAND = 0.12


def luma(rgb):
    return (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0


def stats(rgb):
    y = luma(rgb)
    top = y[: max(1, round(y.shape[0] * TOP_BAND))]
    return {
        'mean': round(float(y.mean()), 3),
        'dark<0.25': round(float((y < 0.25).mean()) * 100, 1),
        'bright>0.6': round(float((y > 0.6).mean()) * 100, 1),
        'topBand': round(float(top.mean()), 3),
    }


def main():
    args = sys.argv[1:]
    labels = {'before': 'before', 'after': 'after'}
    for key in ('before', 'after'):
        flag = f'--label-{key}'
        if flag in args:
            i = args.index(flag)
            labels[key] = args[i + 1]
            del args[i : i + 2]
    before_dir, after_dir, shots_path, out_path = args
    shots = json.load(open(shots_path))
    rows = []
    for i, shot in enumerate(shots):
        a = np.asarray(Image.open(f'{before_dir}/f{i:04d}.png').convert('RGB')).astype(np.int16)
        b = np.asarray(Image.open(f'{after_dir}/f{i:04d}.png').convert('RGB')).astype(np.int16)
        changed = np.abs(a - b).max(axis=2) > CHANGE_LEVELS
        ys, xs = np.nonzero(changed)
        box = None
        if len(xs):
            h, w = changed.shape
            box = [round(float(np.percentile(xs, 2)) / w, 2), round(float(np.percentile(ys, 2)) / h, 2),
                   round(float(np.percentile(xs, 98)) / w, 2), round(float(np.percentile(ys, 98)) / h, 2)]
        report = {
            'pose': shot['name'],
            labels['before']: stats(a),
            labels['after']: stats(b),
            'changedPct': round(float(changed.mean()) * 100, 2),
            'changedBox_x0y0x1y1': box,
        }
        print(json.dumps(report))
        heat = (a.astype(np.float32) * 0.35).astype(np.uint8)
        heat[changed] = [255, 60, 40]
        rows.append((shot['name'], a.astype(np.uint8), b.astype(np.uint8), heat))
    tw, th = 480, 270
    sheet = Image.new('RGB', (tw * 3, (th + 22) * len(rows)), (18, 18, 18))
    draw = ImageDraw.Draw(sheet)
    for r, (name, a, b, heat) in enumerate(rows):
        y0 = r * (th + 22)
        for c, (img, tag) in enumerate(((a, labels['before']), (b, labels['after']), (heat, f'changed > {CHANGE_LEVELS} levels'))):
            sheet.paste(Image.fromarray(img).resize((tw, th), Image.LANCZOS), (c * tw, y0 + 22))
            draw.text((c * tw + 6, y0 + 5), f'{name}  |  {tag}', fill=(235, 235, 235))
    sheet.save(out_path, quality=88)


if __name__ == '__main__':
    main()
