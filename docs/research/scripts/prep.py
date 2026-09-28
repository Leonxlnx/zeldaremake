"""Detect letterbox bars and dump magnified crops for visual confirmation."""
import sys
import numpy as np
from PIL import Image


def letterbox(path, thresh=0.02):
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64) / 255.0
    rowmax = a.max(axis=(1, 2))
    live = np.where(rowmax > thresh)[0]
    top, bot = int(live[0]), int(live[-1])
    colmax = a.max(axis=(0, 2))
    livec = np.where(colmax > thresh)[0]
    left, right = int(livec[0]), int(livec[-1])
    h, w = a.shape[:2]
    ph = bot - top + 1
    pw = right - left + 1
    print(f"{path}: {w}x{h} full | picture y[{top}..{bot}] h={ph}  "
          f"x[{left}..{right}] w={pw}  aspect={pw/ph:.3f}")
    return top, bot, left, right


def crop(path, box, out, scale=4):
    x0, y0, x1, y1 = box
    im = Image.open(path).convert("RGB").crop((x0, y0, x1, y1))
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(out, quality=95)
    print(f"  -> {out}  src {x1-x0}x{y1-y0} @ {scale}x")


if __name__ == "__main__":
    for f in sys.argv[1:]:
        letterbox(f)
