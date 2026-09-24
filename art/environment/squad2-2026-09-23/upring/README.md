# squad2 — Backlog item 4, "the distant ring's floor cards seen straight up in the open north (a dark flat disc overhead)"

**Taking Backlog item 4** (`docs/SQUAD_2026-09-23.md` §Backlog), lane 2's list being settled. The item's
premise turns out to be wrong in two ways, and the real defect is next door in lane 2's own row
("the canopy roof"). This is the diagnosis; the change it calls for needs a six-hero-frame verification
and is the next iteration's job.

> **fable-cursor: this and `../treepop/README.md` are the PR description for `agent/squad2-treepop`.**
> The squad chat's pull-request tool is still refused by GitHub on this repository (`Validation Failed
> … "must be a collaborator"`, POST `/pulls`) on every attempt. The branch is pushed and green; please
> open it (base `cursor/kokiri-world-phase1-f65e`) or merge it.

## What is actually overhead

Pose `open-north-up80` (`poses.json`): the play camera's own spot in the open ground north of the arch
(`playtest.mjs`'s `open-north`, Link at (1.5, −40), camera (1.5, 4.75, −37.1)) pitched to 80°, so the
frame spans 57° – 103° of elevation. 720 × 405, no character, settle 6.

`probe-look.mjs --pick` at the middle of the flat field names **`canopy-roof-1` / `canopy-roof-0` at
18.1 m and 21.7 m** — not the distant ring. Marking the far layer's crown material red lights only the
bottom-left corner, so the ring is in frame but is not what fills the view. And the field is **pale**,
not dark.

Marking the roof material red instead (`roof-marked-up80.png`) measures where the roof is. Share of each
row of the frame that is roof, top (103°) to bottom (57°):

| row (y) | elevation | roof |
| --- | --- | --- |
| 0.00 – 0.13 | ≈ 100° | 36.5 % |
| 0.13 – 0.25 | ≈ 95° | 58.9 % |
| 0.25 – 0.38 | ≈ 90° | 63.3 % |
| 0.38 – 0.50 | ≈ 85° | 65.0 % |
| 0.50 – 0.63 | ≈ 78° | 29.0 % |
| **0.63 – 0.75** | **≈ 72°** | **0.1 %** |
| **0.75 – 0.88** | **≈ 65°** | **0.0 %** |
| **0.88 – 1.00** | **≈ 60°** | **2.7 %** |

The roof covers 32 % of the frame and contributes to 24.6 % of its pixels (base vs the roof hidden), and
it works where it exists — a ragged leafy silhouette, not a disc. **Below about 72° of elevation it is
simply not there**, and what fills those rows is sky and height fog with nothing in front of it: a
featureless pale field with a hard edge against the giants' foliage. That is the "flat disc overhead",
and it is a HOLE in the roof, not a card in it.

## Why the hole is exactly there

Two constants in `canopy/roof.ts`, and the gap between them:

- **`HERO_DROP_M = 120`** — the main roof drops any clump that projects inside one of the six hero
  frames within 120 m. A, B, D and E stand at z ≈ −8 … +9 looking north, so their frusta cover the
  airspace over the whole walkable north well inside 120 m: the main pass builds nothing there.
- **`ROOF_STAND_BOUNDS.zMax = −52`**, and the stand bands themselves start at `zMin −61 / zMax −55`.
  The pass that exists to roof the far north only builds at z ≤ −55.

So the airspace over **z ≈ −20 to −55 has no roof from either pass**. A walker at z −37 looking up at
57–72° is looking at the roof plane (20 m above ground) over z ≈ −46 to −50 — squarely in that gap. The
audit agrees: `canopyRoof.dropped.heroFrame` 81 for the main pass, and `stand.nearestHeroM` shows the
nearest built stand clump at 50.3–60.7 m from B / E / D / A / F.

The drop is already frustum-aware (`inHeroFrame` projects the clump's card box into each viewpoint), so
the rule is not crude — the radius is just large enough to cover everywhere the owner walks. Its own
comment says the value "moves up if it does not [hold the −0.003 budget]", i.e. it was raised for safety
rather than measured down.

## What the fix needs, and why it is not in this commit

Lowering `HERO_DROP_M` (or tightening the projection test to the frames' top edge, which is the only
part of a hero frame a 20–37 m roof can reach) would close the hole. It moves the six fixed frames by
construction, so it needs A–F rendered before and after and the SSIM stated — about half an hour of
SwiftShader, more than this iteration had left after the diagnosis. Doing it half-verified would be
worse than not doing it, so it is the next item, with the numbers above as its brief.

Two things to carry into it: the reference's look-up from the clearing (review46, and the demo's
d_101–d_116 under the arch) is canopy with sky patches, not an open field; and `canopy-roof` casts no
shadow, so closing the hole cannot change the ground dapple, the sun pools or the ray mask — only the
sky the walker sees.

## Files

- `poses.json` — the two look-up poses (the second, `clearing-up80`, lands inside a bole and is not used).
- `roof-hole.jpg` — the frame beside the same frame with the roof marked red.
- `base-up80.png`, `roof-marked-up80.png`, `roof-hidden-up80.png` — the three probe frames.
- `pick-up80.json` — the `--pick` reads that named `canopy-roof-0/1` at 18–22 m.
