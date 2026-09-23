# Round 44 review — the survey's ranked defects (take-0114, `e2a3b72`)

Before = the survey-1 frames at `18cd211` (take-0113; `art/environment/survey1/`), after = `e2a3b72`
(take-0114), same poses from the survey manifest, rendered with `broll.mjs --settle 12`. Comparison
evidence only; lighting identical in both.

## Orchestrator sheets (`r44-<pose>.jpg`)
| pose | survey item | what to look at |
| --- | --- | --- |
| `w17-spine-r` | #1 NE giant bole + #6 lime root skirt | corded dark bole, seated bark roots, moss cushions |
| `w19-spine-r` | #2 columns + #3 log body | column cords and root flare; bark plates and humus skirt on the arch |
| `w21-spine-f` | #4 bare north plain + head-height pod | forest floor to the horizon; the pod lifted to 2.56 m clearance |
| `w13-spine-d`, `w20-spine-d` | #8 hollow slabs / arch gravel seam | seated domed stones in soil lips; ragged gravel edge with slab tongues |
| `w08-spine-r` | #11 earth face + #6 house roots | root-ridge relief, damp foot; roots no longer float/climb |
| `sn-fence-post` | #9 fences | grain, chamfered head, mortised rails |
| `sn-boulder-stairfoot` | rocks + rope fence | filleted rim, plated face, lichen colonies; the rope line off the rock |
| `w27-plateau-r` | #7 bushes | veined cupped laminae on tapered stems; the lens-clearance |
| `sn-signpost` | #10 flowers | smaller varied violet heads on stems |
| `w31-house-d` | threshold | worn stone threshold, moss film at the rim |
| `sn-lantern-limb` | #5 limbs | bark sleeve with cords and moss on the lantern bough |

## The agents' sheets
`trees27-*` (r44/trees `832dc92`), `veg23-*` (r44/veg `eb26eb1`), `structures28-*` (r44/struct
`287e96b`), `ground1-zoom-*` (r44/ground `e281067`) — before/after at their own poses, incl.
`trees27-pooltest-settle3-vs-90` (the on-demand pool cleared as a cause of the survey's smooth boles).

## Numbers
Six fixed views: A 0.2285, B 0.2058, C 0.2342, D 0.2839, E 0.2142, F 0.2618 (mean 0.2381; D −0.002 is
the house-west flank in frame 56 s's smooth shadow). Draws 520 / 8.57 M tris on A; sampler byte-identical;
flagstones 530 → 555 (the hollow's stones now paved); log peg pod min path clearance 1.96 m (the
head-height one 2.56 m). Left for round 45: the east giant's bough lobe at eye height on the plateau
walk, a distant-band column trunk standing in the arch's north sight line, columns beyond 15 m pale
in haze, the stair-foot rubble skirt's pale domes, the plateau "T" card lobe.
