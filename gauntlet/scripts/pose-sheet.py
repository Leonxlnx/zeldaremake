#!/usr/bin/env python3
"""Before | after (| reference) sheets, paired by shot NAME rather than frame order.

    pose-sheet.py --before /tmp/before --after /tmp/after --out art/.../compare
                  [--ref name=path/to/frame.jpg ...] [--label-before "…"] [--label-after "…"]

Each broll run writes its own `shots.json` beside its frames, so two runs taken from different
pose files (one with a pose the other lacks) still pair correctly; unmatched shots are reported and
skipped. A `--ref` frame for a shot is appended as a third panel, scaled to the render's height.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont


def run_frames(folder):
    shots = json.load(open(os.path.join(folder, 'shots.json')))['shots']
    files = sorted(f for f in os.listdir(folder) if f.startswith('f') and f.endswith('.png'))
    return {s['name']: os.path.join(folder, f) for s, f in zip(shots, files)}


def label(img, text):
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    except OSError:
        font = ImageFont.load_default()
    box = d.textbbox((12, 10), text, font=font)
    d.rectangle((box[0] - 6, box[1] - 4, box[2] + 6, box[3] + 4), fill=(0, 0, 0))
    d.text((12, 10), text, fill=(255, 255, 255), font=font)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--before', required=True)
    ap.add_argument('--after', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--ref', action='append', default=[], metavar='NAME=PATH')
    ap.add_argument('--label-before', default='BEFORE')
    ap.add_argument('--label-after', default='AFTER')
    a = ap.parse_args()
    before, after = run_frames(a.before), run_frames(a.after)
    refs = dict(r.split('=', 1) for r in a.ref)
    os.makedirs(a.out, exist_ok=True)
    for name, after_path in after.items():
        if name not in before:
            print(f'skip {name}: no before frame')
            continue
        panels = [Image.open(before[name]).convert('RGB'), Image.open(after_path).convert('RGB')]
        label(panels[0], f'{a.label_before}  {name}')
        label(panels[1], f'{a.label_after}  {name}')
        if name in refs:
            ref = Image.open(refs[name]).convert('RGB')
            ref = ref.resize((round(ref.width * panels[0].height / ref.height), panels[0].height))
            label(ref, f'REFERENCE  {os.path.basename(refs[name])}')
            panels.append(ref)
        gap = 8
        sheet = Image.new('RGB', (sum(p.width for p in panels) + gap * (len(panels) - 1), panels[0].height), (0, 0, 0))
        x = 0
        for p in panels:
            sheet.paste(p, (x, 0))
            x += p.width + gap
        out = os.path.join(a.out, f'{name}.jpg')
        sheet.save(out, quality=88)
        print(out)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
