# Props lane (fable-3) — evidence, first pass

BEFORE = `d06e2753` (the world branch head at onboarding: take-0116's world `973a21e` + log
ticks), built and rendered on this VM. AFTER = `agent/fable-3-props` @ `4f6476f`. Both sides:
`broll.mjs --size 1280x720 --fps 12 --test --settle 12`, quality high, sim time 12.5 s, the
same shots file (`px8.json` in the PR); the six views with `capture.mjs --settle 12`. Labels are
burned into each tile. Everything here is our own render — no reference frame.

## Six fixed views (`six-views-before-after.jpg`)

| view | before SSIM | after SSIM | Δ | draws before → after |
| --- | --- | --- | --- | --- |
| A_stairs | 0.2251 | 0.2246 | −0.0005 | 521 → 519 |
| B_house | 0.2025 | 0.2031 | +0.0006 | 479 → 477 |
| C_lookback | 0.2356 | 0.2340 | −0.0016 | 363 → 365 |
| D_log | 0.2791 | 0.2791 | 0 | 354 → 354 |
| E_ground | 0.2134 | 0.2130 | −0.0004 | 479 → 477 |
| F_canopy | 0.2628 | 0.2614 | −0.0014 | 468 → 473 |

Worst −0.0016 (budget −0.003 each); pHash 22 → 24 in C, unchanged elsewhere; triangles
+0.01–0.06 M per view (A 8.84 M, the highest); 0 console errors; props audit 16 meshes / 44.5 k
triangles / `skipped: []`.

## Survey-2 items

| pose | item | verdict | sheet |
| --- | --- | --- | --- |
| `w28-plateau-d` | #32 crate = smooth flat planks | **PASS** — boards on the `weathered_planks` map at true scale (one column per board), chamfered arrises, nail studs, a barrel and a pot beside it | `w28-plateau-d.jpg`, `-crop.jpg` |
| `w26-stairs-d` | #37 fern frond pierces the plateau pot | **PASS at the pose, by relocation** — the pot stood on the stair bank where the fern scatter is dense; it now stands in the storage corner behind (visible top right), no frond through it at this pose. The general problem (the vegetation does not know about props) is open: INBOX ask to fable-cursor for a prop-exclusion hook | `w26-stairs-d.jpg`, `-crop.jpg` |

## New dressing (before → after at the same pose)

| pose | what | sheet |
| --- | --- | --- |
| `px-door` | two pots on the porch floor left of Saria's doorway (the round-31 handled pot, tipped 20° on the slope at the left, is gone); the tilt is now limited to 9° | `px-door.jpg`, `-crop.jpg` |
| `px-sign` | squat pot west of the signpost (the second sign pot stands behind the post) | `px-sign.jpg` |
| `px-stairfoot` | two pots on the paved apron at the bottom riser's south corner, beside the stair-foot boulder | `px-stairfoot.jpg`, `-crop.jpg` |
| `px-plateau` | the storage corner: barrel, crate, bucket, two pots | `px-plateau.jpg` |
| `px-ladder` | rope-and-plank ladder on the upper house's trunk, up to the eave | `px-ladder.jpg` |
| `px-lip` | the lip deck with its rope railing where the plateau-west fence ends (0.62 m deck — at 0.4 m the lawn's ferns poked through) | `px-lip.jpg` |

## Honest remainders

- Fern fronds still run in front of / into props wherever the lawn is dense (the plateau
  corner's squat pot has leaflets over its rim). Placement was chosen against the deterministic
  scatter at these poses; a vegetation exclusion around prop footprints is the fix.
- The plank map is grey-brown; the crates read a shade greyer than the fences' red-brown
  posts (same map, different tint and shade floor).
- The wheel rings on the pots read at 1–3 m in sun; in deep shade they flatten (the clay's
  shade floor is deliberately low so the pots stay terracotta rather than pastel).
