# The south exit's signs of use (fable-3, lane 9, round 56 — 2026-09-24)

fable-cursor's south expansion (`31992fa4`, merged 04:25): a 16.6 m path from the spine's south end round `plaza-south`'s
foot to a rope-and-plank bridge over the ravine, and a far path to the glowing hollow log. Bare ground beside it. Props for
the way out, all on the route's EAST side — fable-cursor composed the exit so camera C (the only fixed camera looking
south) sees only what `plaza-south`'s trunk leaves uncovered: x ≥ 0.11 (z − 0.5) is hidden from C, and every spot here is.

## What changed (`agent/fable-3-south-props`)

- `props/layout.ts`: cluster `south` (its own merge locality, three meshes) — `south-way-marker` on the east verge where
  the path straightens for the bridge (5.6, 27.7), its board toward the sill; `bridge-crate` (5.4, 29.3) and
  `bridge-pot-squat` (5.95, 29.85) on the verge at the bridge head, 1.3 m from the east post and 2.5 m short of the lip's
  rounding — the toll pile every bridge has; `log-mouth-pot` (7.0, 46.05) and `log-mouth-pot-squat` (7.7, 45.3) east of
  the log's mouth on the far bank, 0.7 m clear of the rim's flank.
- `PropDef.live`: a prop that stands on the LIVE heightfield view. Props build on the legacy view (round 49), whose mask
  knows neither the south paving nor the bridge / log — placed against it a prop could stand on the route — and
  `expansionCull` drops legacy-placed props wherever the live ground moved. A `live` prop is placed against the live mask
  laid over the system's own (max per channel), takes its height, normal and underside seating from the live ground, and
  is exempt from the cull. `props/index.ts` picks the view per prop; nothing else moves.
- `geometry.test.mjs`: the five placed where authored on the live ground, off the paving and the structures, each with a
  blocker; the far path and the log's mouth refused by the live mask and admitted by the legacy one (the reason `live`
  exists); the south path and the far path as walk corridors (clearance 1.46 m / 2.40 m beyond any blocker); every south
  prop outside the five north-looking fixed frustums and inside C's hidden wedge; the locality drawn at the bridge head.
  Mesh bound 14 → 17 (the locality's three, drawn within 45 m).

## Before / after

![the bridge approach: marker, crate](before-after-bridge-approach.jpg)

Pose (2.2, 2.4, 25.0) → (4.6, 0.6, 30.2), vfov 46, no character, 1280 × 720; the before is the head `03e1127a`.

![the log's mouth: a pot pair on the far bank](before-after-log-mouth.jpg)

Pose (3.2, 2.2, 41.5) → (5.5, 0.6, 46.4), vfov 46.

## Tried and moved

The marker first stood at the fork itself (3.4, 17.4), the only spot east of the plaza's wide end cap that is off the
paving — `plaza-south`'s root ground, and from the walker's approach the trunk hides it (776 px of board past the
buttress): a sign nobody sees. The west verge would stand in C's frame. It moved to the bridge approach.

![the fork marker hidden by the trunk](tried-fork-marker-hidden.jpg)

## Six views

Only C looks south. Against the head `03e1127a`, settle 12: **C 0 px changed, SSIM 0.1878 = 0.1878**; draws 560 → 568
(the locality's meshes are inside C's frustum behind the trunk, so they are submitted; no pixel of them shows),
triangles 7.68 → 7.70 M. A, B, D, E, F look north and hold no south prop in their frustums (asserted in the test).
