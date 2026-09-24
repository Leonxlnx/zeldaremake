# The bud coil is a flattened helix, not a disc (lane 4, 2026-09-24 09:35)

## First, a correction

Last iteration I wrote that the fiddlehead coil "is a flat spiral", "a ribbon, not a tube", and that
giving it thickness was the outstanding work. **That was wrong, and I had not checked the code when
I said it.** `plantgeo.ts` already builds the coil with `tube()` — 976 triangles at the ultra tier
before this change. It is round.

What is actually wrong is subtler and is the real reason it reads as a washer.

## The real defect

The coil was wound in **one plane**. Its only travel out of that plane was a fixed 4 mm swell:

```ts
.addScaledVector(V(-radial.z, 0, radial.x), Math.sin(u * Math.PI) * 0.004)
```

Against a ring radius of 26–40 mm, 4 mm is a disc — the coil is three to five times wider than it
is thick. And the offset was **absolute** while the ring scales with the plant, so the shot-D hero
stalks (twice the height, hence twice the ring) made it seven to eleven times wider than thick.
Worse, the × 1.7 lateral widening I removed yesterday had been *hiding* this: it thickened the coil
in the one axis that made it look round from camera D, which is why the cheat existed at all.

A crozier is a **flattened helix** — it travels out of its own plane as it tightens — so it reads as
a coil from any angle. Ours could not.

## The change

The out-of-plane offset is now proportional to the ring radius: a progressive helix plus a mid
swell (`COIL_HELIX` 0.34, `COIL_SWELL` 0.16 of R). The ultra tier's tube also goes from 6 sides to
8, which is what stops the faceting showing at the 2–4 m a walker passes them.

The rng stream is untouched — no extra draws — so every bud stands exactly where it stood.

## Measured

| pose | SSIM | pixels changed > 8/255 |
| --- | --- | --- |
| **D_log** (the frame the stalks were authored for) | **0.9997** | **0.05 %** |
| `bfly-verge` (the west verge as he walks it) | 0.9970 | 0.27 % |
| `bud-close` (4 m from the stalks) | 0.9907 | 0.83 % |

`bud-coil-before-after.jpg` is the pair at 4 m: the coils open into a visible winding instead of a
closed flat ring, and the leftmost stalk finally reads as a crozier.

**Cost at the hero views: none.** The ultra tier goes 976 → 1 184 triangles a bud, but no bud is
ever placed within `FIDDLEHEAD_ULTRA_M + 0.2` of a fixed camera (a rule in `plants.ts`), so the
hero frames carry no ultra fiddleheads at all — camera A's fiddlehead submission is 0.050 M before
and after. Only a walker inside 3.5 m pays, and that is a few buds at +208 triangles each.

`npm run typecheck`, `npm run build` green; **44 of 44 test files pass.**

## What is left

The coil now has depth; the stalks are still lit flatter than the reference's, which is a shading
question (the coil takes the plant palette's single tone rather than the reference's lit crown over
a shaded underside) rather than a geometry one. That is worth its own look at the materials, not
another geometry edit.
