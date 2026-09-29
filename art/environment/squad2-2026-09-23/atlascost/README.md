# The far-crown atlas: 2.0 s of the trees system's build, and where it actually goes

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`.

The owner's standing priority includes **"make all the trees load in ASAP so it doesn't look bad"**, and
this branch's §5 closed with the admission that none of the builder work answered it: the world build's
trees phase moved 8395 → 8367 ms against a 700 ms run spread. So this round went at the build from the
other end — not the near-LOD pool that fills in after load, but the serial cost of `trees.create()`
itself, which the first frame waits on (`main.ts` awaits `createWorld` before the render loop starts;
`world/index.ts` builds systems in a serial `for … await` loop).

## 1. Where the trees' 8.4 s sits, and what the biggest single line is

From `chunks/buildphases.mjs` (3 runs, the numbers this branch already recorded):

| system | ms | | trees phase | ms |
| --- | --- | --- | --- | --- |
| vegetation | 11 587 | | giants | 4 955 |
| structures | 8 514 | | columns | 1 313 |
| **trees** | **8 395** | | white-barks | 931 |
| rocks | 7 117 | | distant-mid-and-publish | 530 |
| terrain | 4 133 | | understory | 66 |
| hardscape | 3 580 | | | |

and inside the giants' tail, one line stands out: **`crown-materials` 1 960 ms** — 23 % of the trees
phase and 4.4 % of the whole 44.9 s build. It is two calls: `createDistantCrownMaterial` for the far
layer, which builds the 1024² far-crown atlas, and the mid layer's, which already **reuses** that atlas
(`{ atlas: distantCrown.map }`). So the 1.96 s is one procedural texture.

## 2. The measurement trap that nearly sent me the wrong way

Instrumenting `createFarCrownAtlas` phase by phase read like this (`total` 1 897 ms):

| part | ms | calls |
| --- | --- | --- |
| `getImageData` (1024²) | **1 781** | 1 |
| the JS bleed loops | 50 | 1 |
| `blit` (`drawImage` of the stamp) | 31 | 3 002 |
| `paintTuft` (tone fill + mask) | 12 | 3 002 |
| leaflet paths | 19 | 1 501 |
| the tuft, the clump generation | 3 | — |

Read literally that says the **readback** is 94 % of the atlas and all the drawing is 62 ms, which is
what I first believed. It is wrong. A 4 MB readback at 2.3 MB/s is not a copy, and canvas 2D commands
are **queued**: the per-op timers measure the time to *enqueue* a command, and the first synchronisation
point pays for rasterising everything queued behind it.

**The decisive test** — a 1×1 `getImageData` immediately before the full one:

| part | ms |
| --- | --- |
| `getImageData(0, 0, **1, 1**)` | **1 889** |
| `getImageData(0, 0, 1024, 1024)` right after | **17** |

One pixel costs 1.89 s and four megabytes cost 17 ms. **The atlas's cost is its drawing**, and any
"per-op" number from a canvas timer in this file is an enqueue time, not work.

## 3. The candidate that failed: `willReadFrequently`

`canopy/atlas.ts` already builds its depth atlas with `getContext('2d', { willReadFrequently: true })`,
and the literal reading of §2's first table says that hint is exactly the fix. Measured on the same
instrumentation, with the hint on the atlas, the stamp and the mask:

| | `getImageData` | atlas total |
| --- | --- | --- |
| without the hint | 1 781 ms | 1 897 ms |
| **with the hint** | 1 752 ms | 1 853 ms |

**Noise, not a win** — as §2 explains, there was no GPU→CPU transfer to remove. Reverted.

One thing to know if anyone tries it: the atlas's pixels are **not bit-stable across page loads** here.
An FNV-1a of the finished `Uint8Array` read `3326bd80`, `fef99dd6` and `5c4d387e` on three loads whose
drawing was identical or differed only by an added 1×1 read, so a texture hash cannot be used to prove
a canvas change is pixel-neutral in this environment, in either direction. Frames are stable (§4); the
canvas raster is not.

**Also for lanes 4 and structures, corrected:** `vegetation/clump-atlas.ts` (`coverage()`, twice) and
`structures/house.ts` (the fibre fleck) do the same read-after-drawing, and those two systems are the
build's largest at 11.6 s and 8.5 s. I nearly sent both lanes a one-word "fix". **Do not add the hint
on the strength of a readback timer** — measure with a 1×1 read first, as above, and if the drawing is
the cost the hint buys nothing.

## 4. What shipped: the stamp painted at the size it is used

Every clump paints a tone-over-mask stamp and blits it at `pr * 2` px, where the body and rim radii put
`pr` at 8–32 px of the 512 px cell — so the blits land at **16–64 px** while the stamp was painted at
**128²**, four to sixteen times more pixels than any blit could carry. The two tone fills per clump are
~3 000 full-stamp rasterisations.

`STAMP = 64` (the stamp, the mask it is masked with — still a 1:1 blit — and the tone gradient):

| | atlas total | of which the first sync point |
| --- | --- | --- |
| 128² stamp | 2 008 ms | 1 889 ms |
| **64² stamp** | **1 268 ms** | **1 150 ms** |

**−740 ms, −37 % of the atlas**, off the serial path the first frame waits on. 64² still meets or
exceeds every blit's destination size.

**And it does not change the picture**, at a hero view and at the look-back where the distant and mid
crowns cover most of the frame (`frozen.mjs`, clock frozen, same poses both sides):

| pose | draws | triangles | SSIM | pixels > 2/255 | mean Δ | max Δ |
| --- | --- | --- | --- | --- | --- | --- |
| hero-A | 559 → 559 | 8 626 622 → same | **1.00000** | 0.030 % (154 px) | 5.6/255 | 32 |
| plateau-back | 687 → 687 | 10 888 866 → same | **1.00000** | 0.114 % (592 px) | 5.6/255 | 37 |

**The crown band charter does not move at all** (`band.mjs`, band y 0.10–0.45):

| pose | mean | across-columns sd | within-column sd |
| --- | --- | --- | --- |
| hero-A, before **and** after | 93.4 | 24.64 | 26.47 |
| plateau-back, before **and** after | 68.8 | 22.71 | 34.59 |

For scale, this branch's §1 (`forceSinglePass`) moved **0.213 %** of A_stairs at max Δ 28 and was
accepted; this moves 0.030 % at the same view and buys 0.74 s of load.

## 5. What is left in the atlas, sized

Of the ~1.15 s remaining at the first sync point: ~3 000 scaled `drawImage` blits onto the 1024²
canvas, ~10 000 leaflet paths (4–8 per clump, `save`/`rotate`/two quadratics/`fill`), and the four
cells' composite. Next candidates, in the order I would measure them:

1. **The leaflet paths** — 1 501 clumps × 4–8 paths. A build with the leaflet loop skipped prices the
   whole family in one run; if it is a large share, a cheaper path (one pre-rendered leaflet stamp
   blitted at a rotation, or fewer paths at a size no blit resolves) is the same argument as §4.
2. **The blits** — their cost scales with destination area, so it is the atlas `size` (1024²) and the
   clump count that price them, not the stamp. The mid layer sees this atlas at 12 m, so `size` is a
   look call, not a free one.
3. **The body clump count** (300 per cell, 220 columnar) — a look call for the same reason.

## Files

- `atlas-ms.json` — the four instrumented runs (baseline, the hint, the 1×1 flush test, `STAMP = 64`).
- `before/`, `after/` — the two poses' frames and `counts.json` from `frozen.mjs`.
- `stamp-plateau.jpg` — before, after and the amplified difference at the look-back.

## Reproducing

The phase numbers need temporary timers inside `createFarCrownAtlas` (never committed — a canvas timer
there measures enqueue time anyway, see §2). The shipped change needs none of that:

```bash
npx vite build --outDir dist-before   # at the commit before this one
node art/environment/squad2-2026-09-23/frozen.mjs dist-before /tmp/atlas-before \
     --poses art/environment/squad2-2026-09-23/giantwood/poses.json --size 960x540 --settle 8
node art/environment/squad2-2026-09-23/frozen.mjs dist /tmp/atlas-after \
     --poses art/environment/squad2-2026-09-23/giantwood/poses.json --size 960x540 --settle 8
node art/environment/squad2-2026-09-23/airlife/variantfoot.mjs /tmp/atlas-before /tmp/atlas-after
node art/environment/squad2-2026-09-23/band.mjs --band 0.10,0.45 /tmp/atlas-{before,after}/plateau-back.png
```
