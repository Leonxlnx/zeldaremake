# The girl by the signpost, and the cast comes back (fable-3, lane 7, 2026-09-23)

The owner asked twice for "the people" (06:50); fable-cursor handed lane 7 to fable-3 at 12:55: the kids
stay procedural (`character/kokiri.ts` — no Kokiri asset exists), so the promise is a clear visible step at
the follow camera's 4–8 m, not Link's sculpt. Start with the girl by the signpost with her fairy (ref-01,
demo d_023–d_036), then bring the cast back (`backgroundCast.visible = false` since the owner's 09-20
request) with the girl walking her loop, and keep the light count constant.

## What the follow camera saw (before)

Rendered on the head (`be123deb`) with the cast forced visible, 5 m from the girl on the first tread of the
hero flight (kokiri-b, the sitter — at broll's simulation time the walker, kokiri-a, is dwelling at (4.4, 0.9)
across the plaza; the girls share every line of the build, only the look index differs): a smooth brown
helmet of hair hugging the skull, orange-tan skin, a flat green tunic cylinder, a head a quarter of her
height. ref-01 / d_024 have a wide maroon bob with a sheen, pale peach skin, cloth with folds, and a
head-and-hair a third of the height.

## What changed (`agent/fable-3-kokiri-girl`)

`character/kokiri.ts`
- **Proportions** — the head joint (pivoted at the head centre) is scaled ×1.14 (`HEAD_SCALE`): head and
  hair become a third of the height, with the face, hair and band tuned at r 0.13 growing together. The
  skull's underside meets the shoulder line as in d_024; the collar tucks under the bob's hem.
- **Hair volume** — the bob r × 1.10 → 1.16 with a 0.20 hem flare (was 0.11) and seven soft lobes below the
  band so the outline reads as locks; the crown dome r × 1.14 → 1.18 (its edge still inside the band, at
  the back too where the band dips); the side locks moved to the bob's cut edge, thicker, 5 mm clear of
  the cheek; the nape tufts a little bigger.
- **Hair material** (`girlHair`) — the footage's maroon (0x7e2f33; the old 0x93412f brick rendered
  orange-brown) under a 512 × 256 canvas: nine broad locks across u (a dark valley and a lighter core
  each, widths uneven), fine strands in long runs, a shade toward the hem, a lift at the crown; roughness
  0.9 → 0.58 so the sun leaves a sheen where the crown turns. Every hair part carries UVs onto it: the
  spheres their own, the fringe a grid (`shell` takes a UV function now), the clumps re-laid (`clumpUv`).
- **Cloth** (`girlCloth`) — a 256 × 128 canvas on the tunic: four drape valleys in step with the skirt's
  `cos(4a + 0.7)` fold ridges (`skirtPanel` lays u out as a / 2π now, the lathed upper's UVs are turned to
  the same convention), shade under the belt and along the hem, a two-texel weave, a soft mottle; the
  upper carries four shallow geometric fold ridges (`ovalLathe` folds) it never had.
- **Skin** — 0xbd8a62 → 0xd3a98a (all four looks paler in step): the pale peach of the footage.
- Same meshes per kid; the belt torus and the headband leave the shadow pass (their shadows fall on the
  skirt and the hair a centimetre under them).

`character/npc.ts` — the four fairy point lights ride on the npc group, not inside the fairy bodies
(`structures/index.ts` keeps the north posts' lights in the scene for the same reason): a light that
leaves or joins the scene changes `NUM_POINT_LIGHTS`, the key every lit program is compiled on — the free
camera parking on a viewpoint hid the ledge girl's fairy, capture toggled the bank fairy's `light.visible`.
Now the lights are positioned from `anchor + offset(t)` each frame and dimmed by a `glow` factor (0 for the
ledge fairy under capture, 0 for the bank fairy under capture, as round 50 had it). The audit reports
`glow` and `lightInScene` per fairy.

`character/index.ts` — `backgroundCast.visible = true`: the walker on her plaza loop by the signpost, the
sitter on the steps, the boy at Saria's door, the ledge and bank girls, on their round 47–50 spots (the
demo's d_090–d_104: kids on the path and the bank). **Shadow-pass scoping**: the sun's shadow window is a
92 m box fitted ahead of the camera, so every kid in the village was drawn into it each frame — a full
set of shadow submissions per kid whether the camera saw them or not (camera A read 723 draws with the
cast back). A kid whose shadow reach (2.6 m; 7 m for the ledge girl, whose shadow can fall down the ledge
face) misses the view frustum cannot shadow a visible pixel, and stops casting until it can. `castShadow`
is no program key; the toggle recompiles nothing. The audit reports `kidShadowCasting` / `kidShadowMeshes`.

## Before / after

![5 m, the follow camera: the girl on the first tread](before-after-5m.jpg)

Pose: (5.2, 2.75, 6.3) → (9.0, 1.75, 3.6), vfov 46, high quality, 1280 × 720, `--character`, settle 8. The
before is the head `be123deb` with the cast forced visible (a throwaway build, nothing committed).

![the walker at her dwell, 2.6 m and 5 m](before-after-walker.jpg)

Poses: (2.3, 2.2, −0.66) → (4.4, 1.45, 0.9), vfov 40; (0.6, 2.7, −2.1) → (4.4, 1.5, 0.9), vfov 46 — the walker
(kokiri-a, look 0) where the loop has her at t ≈ 13.2 s, facing the camera.

## Play mode

`kokiri-play-walk` (artifact): `?test=1` at 960 × 540, Link placed at (0.8, 6.2) facing the stair foot,
two seconds standing, then W held for six — the sitter on the steps with her fairy, the walker at her verge
spot, the boy at Saria's door. Programs 111 → 112 over the walk (one material's first draw), no light-count
recompile. Draws 711 → 537 as the plaza leaves the frame; the walk ends in the verge's understory (the
route, not the cast). Standing at (3.0, 7.5) facing the stair foot (the plaza, Saria's house, the flight
and three kids in frame): head 604 draws / 9.98 M, branch 779 / 10.05 M — the cast in play mode costs
≈ 175 submissions where three kids and their shadow passes are in view. From that spot the walker's loop
is behind an understory bush for most of her circuit (a sightline note for lanes 2 / 4: the scatter does
not know `NPC_LOOP`).

## Six views

Measured against the exact head build (`be123deb`, cast hidden — the sealed state) at settle 12. The cast's
return is an owner-approved look change: the six frames show the kids again where round 47–50 pinned them
(the walker and the sitter per `VIEW_TABLE`), so the −0.003 rule does not apply to those pixels.

| view | SSIM vs ref, head | branch | Δ | SSIM head↔branch | changed px | draws head → branch | M tris head → branch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 0.2035 | 0.1991 | −0.0044 | 0.9826 | 15 339 | 597 → 698 (final 692) | 9.15 → 9.19 |
| B | 0.1836 | 0.1773 | −0.0063 | 0.9720 | 26 880 | 589 → 690 (final 684) | 8.30 → 8.33 |
| C | 0.1794 | 0.1793 | −0.0001 | 0.9916 | 5 163 | 472 → 525 | 6.77 → 6.80 |
| D | 0.2430 | 0.2430 | 0 | 1.0000 | 0 | 557 → 557 | 8.53 → 8.53 |
| E | 0.1946 | 0.1901 | −0.0045 | 0.9720 | 26 880 | 589 → 690 | 8.30 → 8.33 |
| F | 0.2159 | 0.2145 | −0.0014 | 0.9922 | 11 950 | 547 → 648 | 7.99 → 8.03 |

The six frames are the branch at `b1ebee6b` (the scoping); the final (`8651fce3`: thinner brows, cuffs out of the shadow
pass, no neck mesh) was re-captured at A and B — A 692 draws, B 684, and against `b1ebee6b`'s frames 8 px changed in A,
30 px in B (the walker's brows; a cuff's shadow sliver). C–F's draws at the final are those minus the cuffs' and the neck's
submissions per kid in frame.

Every changed pixel is a kid, her fairy, her shadow or her fairy's light pool (`diff-A.jpg` … `diff-F.jpg`: the walker
at A's right edge and B / E's left edge as the footage has her, beside Link in F; the boy at Saria's door in B / E / F; the
sitter on the steps in C). D sees no kid and is byte-identical — with every kid inside its shadow window, that is the
shadow-pass scoping doing its job (D drew 557 before the cast came back and 557 after). The SSIM against the reference drops
where the kids appear (A, B, E): the frames now hold our kids where the footage holds its own — the cost of the cast being
in the frames at all, the same as before the 09-20 hide, not of this pass.

Draws: the cast costs ≈ 100 submissions where three kids are in frame (each kid is 22–25 meshes over 13 joints, drawn again
in the shadow pass when in view, plus a contact shadow and a three-part fairy). Without the scoping A read 723. The remaining
lever, if the perf pass needs it: one canvas atlas per kid so every joint is one submission (skin / cloth / leather share a
joint today) — roughly half the main-pass cost.

![where A changed](diff-A.jpg)
![where B changed](diff-B.jpg)
![where F changed](diff-F.jpg)
