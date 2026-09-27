# The trees build, line by line — and what 15% of the world build really is

Lane 2, 2026-09-27. Branch `cursor/squad2-treephases-682b`, PR #210.

The owner's load-time question was "where does the world build go". `buildMs` answered it per
system and `buildPhases` (PR #210's first commit) answered it per phase inside trees. Neither
could name a line. This round names the lines, corrects a wrong reading of mine, and then asks
what kind of work the biggest line actually is.

## 1. The giants phase, split

`giantStepMs` in the trees audit. Seven builds on this VM, `quality=high`, medians:

| step | ms | what it is |
| --- | --- | --- |
| `createGiantTree` × 12 (`giantBuildMs`) | 1700 | the authored assets — trunk, boughs, laminae, cards |
| `tail: crown-materials` | 1830 | `createDistantCrownMaterial` → the 1024 px far-crown atlas, built once |
| `tail: mid-place` | 490 | `placeMidTrees` — 400 trees by rejection sampling |
| `tail: sectors` | 330 | the per-sector foliage split, merge and far-foliage batches |
| `near-pool-register` | 140 | the pooled near-base and near-canopy parts |
| `to-world` | 115 | translating 4 geometries per giant and their `aRoot` |
| `sector-merge` + group cull install | 80 | `mergeParts` × 3 sectors, `splitGroupsAtLeaves`, `installGroupCulling` |
| `yield-frame` × 12 | 50 | the loading screen's frames between giants |
| `tail: authored + root kit` | 40 | per-giant authored leaves and cards, the root kit fits |
| `tail: distant-place` | 24 | `placeDistantTrees` — 680 trees |
| `tail: variants` | 10 | `createDistantVariants` + `createMidVariants` |
| `distant-sets` (instancing) | 1 | 28 `InstancedMesh` + 1080 matrices |
| **giants phase total** | **4780** | of the trees system's 8.0–8.3 s |

The loop itself is 2.0 s and is almost entirely `createGiantTree` (1.70 s) plus 0.26 s of
to-world and pool work. The tail is 2.75 s.

**A correction.** Last round I inferred from `giantBuildMs` (1.69 s of a 4.8 s phase) that
"two thirds of the giants phase is the merge and pool work in this lane's file", and called it
the most promising load lever I had found. That was wrong. The merge is 80 ms and the pools are
140 ms. The 3.1 s I could not see was mostly one texture.

## 2. The biggest line is a canvas, and the cost is where you cannot see it

`createFarCrownAtlas` (leaf-cluster-texture.ts, used only by `distant.ts`) paints a 1024 px
four-cell atlas: 1501 clumps, each two 128 px tuft stamps and 4–8 leaflet paths. Splitting it:

| stage | ms |
| --- | --- |
| painting all 1501 clumps | 72 |
| `getImageData(0, 0, 1024, 1024)` | 1717 |
| the alpha-bleed pass over 4 cells | 29 |
| FNV hash (this measurement only) | 7 |
| **total** | **1825** |

Painting is 4% and a single readback is 94%, because Chrome records canvas 2D into a display
list and rasterises it when someone asks for pixels. So the 1.72 s *is* the painting; it is just
billed at the readback.

A probe separates the readback path from the raster work (`/tmp/probe.mjs`, numbers below):

| probe | ms |
| --- | --- |
| blank 1024 px `getImageData` | 0 |
| 1500 flat stamps, then read | 133 |
| the same read again (already rasterised) | 6 |
| all three with `willReadFrequently: true` | 0 / 121 / 10 |

The readback path is free and `willReadFrequently` changes nothing. What costs 1.7 s is
SwiftShader rasterising 3002 full-canvas gradient fills and `destination-in` composites in
software — work a real GPU does in hardware. **This is a VM cost, not a player's cost.**

## 3. How much of the whole build is that?

Patching `getImageData`, `texImage2D`/`texSubImage2D` (canvas sources only), `toDataURL` before
any page script, for one full `quality=high` build (`/tmp/rasterprobe.mjs`):

| path | ms | calls |
| --- | --- | --- |
| `getImageData` | 3216 | 5 |
| `texSubImage2D` from a canvas/image | 3052 | 76 |
| `texImage2D`, `toDataURL`, `createImageBitmap` | 0 | 0 |
| **canvas → pixels, total** | **6268** | 81 |

Against a 42.5 s build (`vegetation` 10.6 s, `trees` 8.2 s, `structures` 7.9 s, `rocks` 6.6 s,
`terrain` 4.2 s, `hardscape` 3.1 s, `atmosphere` 1.0 s, rest < 0.6 s):

**14.8% of the world build on this VM is software canvas rasterisation and upload.** 1.72 s of
it is lane 2's far-crown atlas — the single largest canvas item in the build. The other 85% is
real JS and geometry work that costs a player the same as it costs us, so load-time work is
still worth doing; it just should not start with a texture painter.

For any lane reading this: if your system's build time is dominated by a procedural texture,
check whether it is a canvas before optimising it, and expect the number to shrink on hardware.

## 4. What changed in the code

Two things, both small.

1. `giantStepMs` — the table in §1, published in the trees audit. Twelve `performance.now()`
   pairs, pinned by `gates.test.mjs` so the names stay unique and the two totals keep bracketing
   their parts.
2. One texel-identical reduction in `createFarCrownAtlas`: every clump masked its tone with the
   same scaled crop of the same source (3002 resamples of identical arguments) and cleared the
   stamp before filling it. The crop is now resampled **once** into its own canvas and blitted
   1:1 — `destination-in` reads only the mask's alpha, and a 1:1 blit carries alpha through
   unchanged — and `copy` replaces clear-then-fill, which is what clear-then-fill amounted to.

**Proof it changes nothing:** FNV-1a over the atlas' 4 194 304 texels is `e074ede8` before the
change (two builds) and `e074ede8` after (two builds). Identical texels, so identical in every
view at once.

**And it is not a win.** 1825 / 1829 ms after versus 1823 / 1904 ms before: inside the noise.
It is less work for the same pixels — 3002 fewer clears and 3002 scaled resamples become
blits — which should read better on hardware where these ops are not free, but on this VM the
after looks like its before and I am reporting that rather than claiming it.

## 5. Poses

`owner-0650-north` and `rec-r024-plaza-fork` at 960×540, `--settle 6`, rendered from the commit
before (65df16d4) and the commit after (fca3055f). The frames came out **identical byte for
byte** — same md5 on both poses, `diffmap.mjs` "changed > 8 levels: 0.00 % of the frame", every
8×8 cell 0.0 %, and `compare.mjs --stats` reporting the same mean and thirds on both sides.
Details in `poses.txt`. Counts and gates are untouched by this round: no geometry, no LOD gate
and no material parameter changed.
