# The pale blobs in the west verge were mine — an anamorphic cheat (lane 4, 2026-09-24 09:10)

Last iteration I flagged "large pale-yellow blobby shapes that read as flat stickers" in the west
verge and said they were not the butterflies and I would not guess whose they were. This iteration
I found out: **they are lane 4's.**

## How they were identified

`probe-look --pick` at four points on the shapes named the meshes under them — `fiddleheads-lod1-*`
in three of the four. Then a variant that lights `veg-fiddleheads` red confirmed it beyond doubt:
the marked frame turns exactly those shapes red and nothing else (`buds-marked.jpg`, middle panel).

## What they are

The **shot-D hero bud stalks** (`plants.ts`, `plants/fiddleheads-shotD`) — three authored stalks at
`HERO_CLUMP_ANCHOR`, matched to reference frame 56's "lit mass left of the mossy rock… five or six
tall unopened bud stalks, their yellow-green coils standing above the rock". They are the one place
the concept sheet's 0.25–0.45 m bud is deliberately outgrown, at roughly twice scale.

They were also **stretched × 1.7 sideways**. That widening was tuned from camera D alone, and the
coil geometry is a flat spiral: at twice scale and 1.7 × width, seen from anywhere but D, it reads
as a pale ring cut from cardboard. The owner walks within 4 m of them on his main route.

## The change

One constant: `TALL_BUD_WIDTH`, the coil's width as a multiple of its height scale, **1.7 → 1.25**.
The coil stays wider than its stalk and stops magnifying its own flatness. The **height is
untouched**, so frame 56's tall stalks and every contract on them stand — `plants.test` pins the
heights (0.25–0.9 m, ≥ 2 stalks over 0.45 m) and the roots' projection into camera D's box, and
nothing pins the width.

## Measured

| pose | SSIM before → after | pixels changed > 8/255 |
| --- | --- | --- |
| **D_log** (the frame they were authored for) | **0.9999** | **0.03 %** |
| `bfly-verge` (the west verge as he walks it) | 0.9975 | 0.20 % |
| `bud-close` (4 m from the stalks) | 0.9921 | 0.68 % |

Camera D's scored composition is untouched — the cheat was buying almost nothing even at the camera
it was tuned for. `npm run typecheck`, `npm run build` green; **44 of 44 test files pass.**

## Honest limit

`shotd-buds-before-after.jpg` is the pair at 4 m. They are **narrower and read more as buds on
stalks — but they are still flat**, because the coil geometry is a flat spiral and no scale change
fixes that. Giving the coil real thickness (a swept tube rather than a ribbon) at the 'ultra' and
'high' tiers is the rest of this fix, and it is a geometry change in `plantgeo.ts` worth doing on its
own with its own before/after, not tacked onto a constant edit.
