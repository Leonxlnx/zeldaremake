# The east verge gets a ground cover (lane 4, 2026-09-24 07:00)

## The problem, found by looking at the world as it is now

Re-rendered lane 4's poses on the current head and the asymmetry the owner complained about on
09-23 has **flipped**. His left side is a closed turf with violets, fronds and shrubs. The right —
the slope east of the north path, between camera C and the main stairs — is a bare olive margin
beside the paving.

The probe says why:

| ground | blades / m² | blade p50 |
| --- | --- | --- |
| west verge z −6…−12 | 487 | 0.150 m |
| **east verge z −6…−12** | **737** | **0.133 m** |
| **east verge z 0…−6** | **290** | **0.043 m** |

It is not short of blades — it is short of anything with a *face*. `field.ts LOW_ZONES` covers it,
and that zone does three things at once: cuts the turf's height (which is its job — frame 46 shows
the stair foot over it, frame 56 nothing above ≈ 0.5 m), cuts its density, and — with
`sightlineC` over the same ground — keeps every plant off it. So there was nothing lying on the
soil at all.

## What changed

**`grass.ts`** — the low zone's *density* cut, 0.35 → `LOW_ZONE_THIN` 0.1. Its **height** cut is
untouched: the zone's contract is height and the height rule does that on its own.

**`plants.ts`** — a ground-cover pass on the same zone: clover, low broad leaves
(`LOW_GROUND_LEAF` 0.5–0.95 scale) and moss beds. Nothing in it is over ≈ 0.3 m, so every height
contract on that ground still holds by construction — the 0.55 m cap over `[1.5, −16, 7, −4]`,
camera C's stair-foot box (which only tests plants over **0.35 m**) and the C-bank count. Frame
46's own trodden earth (`cFoot`) and the trodden strip take none of it: those are bare by design.

The moss keeps out of every viewpoint's ultra ring. Camera C *stands in this zone*, and a cushion
inside its 6 m ring is ≈ 1 100 triangles — the first run put 316 of them there, 349 K, and
`plants.test` caught it. The clover and the leaves close the ground in that ring instead.

## Measured

| ground | blades / m² before → after | plants added |
| --- | --- | --- |
| east verge z 0…−6 | 290 → **381** | — (that strip is `cFoot` and paving) |
| east verge z −6…−12 | 737 → **845** | clover 269 → 322, weeds 28 → 41 |
| east verge z −12…−18 | 355 → **440** | clover 505 → 581, weeds 77 → 105 |

Blade heights are unchanged (p50 0.133 / 0.147 m; the p95 falls slightly). World totals: blades
628 K → 632 K, clover 9 090 → 9 467, weeds 5 825 → 5 934.

Rendered at lane 4's four poses: the owner's north pose changes 4.3 % of pixels, the plaza pose
1.5 %, and the two that look west or up the corridor are **byte-identical** — the change is exactly
where the zone is. `east-verge-before-after.jpg` is the crop: the bare ground under the mossy mound
fills with green, and nothing in the frame gets taller.

Vegetation budget: camera C 2.600 M triangles / 129 draws, camera A 3.261 M / 145 — A's grass
tiles actually fall (0.987 → 0.945 M) because the walked-verge near tier now trims more of them.

`npm run typecheck`, `npm run build` green. **43 of 43 test files pass.**
