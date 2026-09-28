"""Build the evidence figures for the Spider-Verse style report."""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image, ImageFilter

OUT = "/opt/cursor/artifacts"
os.makedirs(OUT, exist_ok=True)


def load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.float64) / 255.0


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def hp(Y, s=4.0):
    im = Image.fromarray(np.clip(Y * 255, 0, 255).astype(np.uint8))
    return Y - np.asarray(im.filter(ImageFilter.GaussianBlur(s)), dtype=np.float64) / 255.0


# ---------------------------------------------------------------- figure 1
def fig_halftone():
    a = load("halftone.jpg")
    box = (580, 660, 700, 780)
    sub = a[box[1]:box[3], box[0]:box[2]]
    Y = hp(luma(sub))

    fig = plt.figure(figsize=(15, 5.0))
    fig.suptitle("Halftone screen, ITSV collider shot (fxguide still, 1920x1080, "
                 "picture height 803 px)", fontsize=13, y=0.99)

    ax = fig.add_subplot(1, 3, 1)
    ax.imshow(sub, interpolation="nearest")
    ax.set_title("120x120 px crop (nearest-neighbour)", fontsize=10)
    # overlay the measured lattice: 8.0 px pitch, axes at 45 and 135 deg
    p = 8.0
    d = p * np.sqrt(2)           # spacing in (x+y) for 8.0 px perpendicular pitch
    for k in range(-20, 40):
        c = k * d
        ax.plot([60, 120], [c - 60, c - 120], color="#00e5ff", lw=0.6, alpha=0.9)
        ax.plot([60, 120], [c - 120, c - 60], color="#ff2d95", lw=0.6, alpha=0.9)
    ax.axvline(60, color="w", lw=0.8, ls=":")
    ax.set_xlim(0, 120); ax.set_ylim(120, 0)
    ax.text(3, 116, "left: raw   right: measured 8.0 px lattice at 45/135 deg",
            color="w", fontsize=7.5,
            bbox=dict(fc="k", alpha=0.65, pad=1.5, lw=0))
    ax.set_xticks([]); ax.set_yticks([])

    ax = fig.add_subplot(1, 3, 2)
    PAD = 512
    t = (Y - Y.mean()) * np.outer(np.hanning(Y.shape[0]), np.hanning(Y.shape[1]))
    buf = np.zeros((PAD, PAD))
    oy, ox = (PAD - t.shape[0]) // 2, (PAD - t.shape[1]) // 2
    buf[oy:oy + t.shape[0], ox:ox + t.shape[1]] = t
    F = np.fft.fftshift(np.abs(np.fft.fft2(buf)))
    r = 70
    c = PAD // 2
    view = np.log1p(F[c - r:c + r, c - r:c + r])
    ax.imshow(view, cmap="magma", extent=[-r / PAD, r / PAD, -r / PAD, r / PAD],
              origin="lower")
    for ang in (45, 135):
        fx = np.cos(np.radians(ang)) / 8.0
        fy = np.sin(np.radians(ang)) / 8.0
        for s in (1, -1):
            ax.plot(s * fx, s * fy, "o", mfc="none", mec="#00e5ff", ms=13, mew=1.6)
    ax.set_title("power spectrum: two orthogonal peaks\n"
                 "8.0 px @ 45 deg and 8.0 px @ 135 deg", fontsize=10)
    ax.set_xlabel("cycles / px"); ax.set_ylabel("cycles / px")

    ax = fig.add_subplot(1, 3, 3)
    # nearest-neighbour distance histogram from the direct dot-centre method
    from lattice import bandpass, local_maxima, nn_stats
    S = bandpass(luma(a[660:780, 580:700]))
    pts = local_maxima(S)
    d, b = nn_stats(pts)
    ax.hist(d, bins=np.arange(1.5, 24.5, 1.0), color="#3b7dd8", edgecolor="w")
    ax.axvline(8.0, color="#ff2d95", ls="--", lw=1.6, label="8.0 px (FFT)")
    ax.set_xlabel("nearest-neighbour dot distance (px)")
    ax.set_ylabel("count")
    ax.set_title(f"direct dot-centre geometry\n{len(pts)} dots, mode 7.5-8.5 px",
                 fontsize=10)
    ax.annotate("1-2 px bin = JPEG noise\nand merged dots in\nthe darkest band",
                xy=(2.0, 330), xytext=(11.5, 380), fontsize=7.5,
                arrowprops=dict(arrowstyle="->", lw=1.0))
    ax.legend(fontsize=8)
    fig.tight_layout(rect=[0, 0, 1, 0.94])
    fig.savefig(f"{OUT}/01_halftone_lattice.png", dpi=125)
    plt.close(fig)
    print("01_halftone_lattice.png")


# ---------------------------------------------------------------- figure 2
def fig_misreg():
    a = load("defocus2.jpg")
    fig = plt.figure(figsize=(15, 5.6))
    fig.suptitle("Defocus rendered as colour-separation misregistration "
                 "(ITSV diner shot, fxguide still)", fontsize=13, y=0.99)

    ax = fig.add_subplot(1, 3, 1)
    sub = a[560:660, 200:330]
    ax.imshow(sub, interpolation="nearest", extent=[200, 330, 660, 560])
    ax.axvline(246, color="#00e5ff", lw=1.0)
    ax.axvline(250, color="#ff2d95", lw=1.0)
    ax.set_title("defocused background, 130x100 px\n"
                 "cyan line = R feature, magenta = G feature", fontsize=10)
    ax.set_xticks([210, 250, 290, 330])

    ax = fig.add_subplot(1, 3, 2)
    prof = a[570:650, 230:300].mean(axis=0)
    x = np.arange(230, 300)
    for i, (ch, col) in enumerate(zip("RGB", ["#d62728", "#2ca02c", "#1f77b4"])):
        ax.plot(x, prof[:, i], color=col, lw=1.5, label=ch)
    ax.axvspan(244, 249, color="#00e5ff", alpha=0.18)
    ax.axvspan(269, 277, color="#ff2d95", alpha=0.18)
    ax.annotate("", xy=(246, 0.27), xytext=(250.5, 0.27),
                arrowprops=dict(arrowstyle="<->", color="k", lw=1.3))
    ax.text(243.0, 0.215, "G lags R by ~4-5 px", fontsize=8.5)
    ax.text(244.5, 0.575, "cyan\nfringe", fontsize=8, ha="center")
    ax.text(273.0, 0.655, "magenta\nfringe", fontsize=8, ha="center")
    ax.set_xlabel("x (px)"); ax.set_ylabel("channel value")
    ax.set_title("per-channel profile, rows 570-650\n"
                 "dark features land at different x per channel", fontsize=10)
    ax.legend(fontsize=8, loc="lower right")
    ax.grid(alpha=0.25)

    ax = fig.add_subplot(1, 3, 3)
    from fringe import fringe, IN_FOCUS, DEFOCUSED
    def series(rows):
        out = []
        for lab, x, y in rows:
            f, c, g = fringe("defocus2.jpg", x, y)
            if c > 0.06:
                out.append(f / c)
        return out
    a_ = series(IN_FOCUS)
    b_ = series(DEFOCUSED)
    ax.boxplot([a_, b_], tick_labels=["in focus\n(n=%d)" % len(a_),
                                 "defocused\n(n=%d)" % len(b_)],
               widths=0.5, patch_artist=True,
               boxprops=dict(facecolor="#cfd8dc"),
               medianprops=dict(color="#d62728", lw=2))
    for i, v in enumerate((a_, b_)):
        ax.plot(np.full(len(v), i + 1) + np.linspace(-.12, .12, len(v)), v,
                "o", ms=5, color="#37474f", alpha=0.85)
    ax.text(1, np.median(a_) + 0.06, f"{np.median(a_):.2f}", ha="center", fontsize=9)
    ax.text(2, np.median(b_) + 0.06, f"{np.median(b_):.2f}", ha="center", fontsize=9)
    ax.set_ylabel("chroma excursion / edge contrast")
    ax.set_title("fringe per unit contrast is ~5x higher\nout of focus "
                 "(in-focus edges still fringe)", fontsize=10)
    ax.grid(alpha=0.25, axis="y")
    fig.tight_layout(rect=[0, 0, 1, 0.93])
    fig.savefig(f"{OUT}/02_defocus_misregistration.png", dpi=125)
    plt.close(fig)
    print("02_defocus_misregistration.png")


# ---------------------------------------------------------------- figure 3
def fig_inkline():
    a = load("2.jpg")
    fig = plt.figure(figsize=(14, 5.0))
    fig.suptitle("Coloured ink line on a silhouette edge "
                 "(ITSV Gwen still, 2000x838)", fontsize=13, y=0.99)

    ax = fig.add_subplot(1, 3, 1)
    ax.imshow(a[600:720, 950:1030], interpolation="nearest",
              extent=[950, 1030, 720, 600])
    ax.axvline(988, color="#ffd400", lw=0.9, ls="--")
    ax.set_title("hood (white) | suit (black), 80x120 px", fontsize=10)

    ax = fig.add_subplot(1, 3, 2)
    prof = a[620:700, 975:1000].mean(axis=0)
    x = np.arange(975, 1000)
    for i, (ch, col) in enumerate(zip("RGB", ["#d62728", "#2ca02c", "#1f77b4"])):
        ax.plot(x, prof[:, i], color=col, lw=1.8, marker="o", ms=3, label=ch)
    ax.axvspan(985, 990, color="#00e5ff", alpha=0.2)
    ax.text(981.0, 0.36, "cyan ink band\n5-6 px wide", fontsize=8.5, ha="center")
    ax.set_xlabel("x (px)"); ax.set_ylabel("channel value")
    ax.set_title("G and B coincide; R alone is displaced\n"
                 "-> the cyan plate is the offset one", fontsize=10)
    ax.legend(fontsize=8); ax.grid(alpha=0.25)

    ax = fig.add_subplot(1, 3, 3)
    chroma = prof[:, 1] - prof[:, 0]
    ax.plot(x, chroma, color="#00838f", lw=1.8, marker="o", ms=3)
    ax.axhline(0, color="k", lw=0.8)
    pk = int(np.argmax(chroma))
    ax.annotate(f"peak G-R = {chroma[pk]:.3f}\nat x={x[pk]}",
                xy=(x[pk], chroma[pk]), xytext=(x[pk] - 11, chroma[pk] - 0.02),
                fontsize=8.5, arrowprops=dict(arrowstyle="->", lw=1.1))
    ax.set_xlabel("x (px)"); ax.set_ylabel("G - R  (cyan-ness)")
    ax.set_title("the stroke is chromatic, not a grey\nantialiasing ramp",
                 fontsize=10)
    ax.grid(alpha=0.25)
    fig.tight_layout(rect=[0, 0, 1, 0.93])
    fig.savefig(f"{OUT}/03_ink_line.png", dpi=125)
    plt.close(fig)
    print("03_ink_line.png")


# ---------------------------------------------------------------- figure 4
def fig_posterise():
    fig, axes = plt.subplots(1, 3, figsize=(14.5, 4.4))
    fig.suptitle("Tone quantisation: broad flat plateaux joined by large jumps",
                 fontsize=13, y=0.99)
    targets = [("2.jpg", (800, 130, 960, 330), "Gwen white hood"),
               ("kid.jpg", (600, 300, 1000, 700), "kid.jpg mid region"),
               ("curvatture.jpg", (500, 300, 1300, 800), "curvatture.jpg mid region")]
    for ax, (p, box, name) in zip(axes, targets):
        a = load(p)
        x0, y0, x1, y1 = box
        L = luma(a[y0:y1, x0:x1])
        Lm = np.asarray(Image.fromarray((np.clip(L, 0, 1) * 255).astype(np.uint8))
                        .filter(ImageFilter.MedianFilter(3)), dtype=np.float64) / 255.0
        gy, gx = np.gradient(Lm)
        flat = np.hypot(gx, gy) < 0.004
        ax.hist(Lm[flat], bins=192, range=(0, 1), color="#3b7dd8")
        ax.set_title(f"{name}\nplateau fraction {100*flat.mean():.0f}%", fontsize=10)
        ax.set_xlabel("luma on plateaux"); ax.set_ylabel("px")
        ax.grid(alpha=0.25)
    fig.tight_layout(rect=[0, 0, 1, 0.92])
    fig.savefig(f"{OUT}/04_tone_quantisation.png", dpi=125)
    plt.close(fig)
    print("04_tone_quantisation.png")


if __name__ == "__main__":
    fig_halftone()
    fig_misreg()
    fig_inkline()
    fig_posterise()
