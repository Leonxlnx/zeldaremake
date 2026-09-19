# fable-5 — independent visual review of take-0116 (`973a21e`, author fable-cursor)

Filed 2026-09-19 09:40–10:10 UTC through `node gauntlet/scripts/gauntlet.mjs --review <item> … --agent fable-5 --take take-0116`.
Records: `gauntlet/reviews/<item>.json`. Evidence: `gauntlet/reviews/evidence/fable-5/take-0116-*.jpg` —
each is REFERENCE (left, `reference/frames/<view>.jpg`) | OURS (right, the take's frame) at the same
normalised region, resampled to the same pixel size.

## Provenance

- Frames judged: the six 1280×720 captures the ledger hashes for take-0116 (`monitor` branch
  `data/takes/take-0116/`). Cross-check: a clean headless render of `973a21e` in a detached worktree
  (`capture.mjs --quality high --settle 8`) matches all six at pHash Hamming 0 / SSIM 0.993–0.994 (the
  residual is the monitor's JPEG), so the verdicts stand on the actual build.
- Supporting player-height renders of the same SHA at survey-2 poses (`broll.mjs --test --settle 8`):
  `sn-whitebark-base`, `sn-boulder-shotd`, `w23-stairs-f`, `w09-spine-d`, `w18-spine-f`, `w20-spine-r`,
  `w13-spine-f`, `w04-spine-r`, `sn-arch-outside`. Where a criterion names a viewpoint, that viewpoint
  decides; the player-height frames only explain *why* something does or does not read.
- Rule applied: a criterion is judged as written in `gauntlet/RUBRIC.md`; "reads like the reference"
  fails when the side-by-side at 1280 px shows the difference at first glance. Auto gates are noted but
  do not rescue a visual fail.

## Verdicts (21 W + 3 C/U)

| item | verdict | one-line reason |
| --- | --- | --- |
| W01 | **pass** | stairs, branch (+ pods at 0.21/0.26 vs 0.208/0.255), plaza, fence line in the reference regions; nits: flight tops out at y 0.13 vs 0.25, Saria's dome fills the centre gap |
| W02 | fail | at A the 20 treads are parallel even bands in one cool tone with bare nosings; the individually-cut read exists at 2 m (`w23-stairs-f`) but does not survive to the frame |
| W03 | fail | at E: 1–1.5 m pale blue-grey tiles with continuous orange grout, no greenery in the joints; thickness/bevels/crack only read at 1.5 m (`w09-spine-d`) |
| W05 | fail | C embankment is a smooth lawn mound + boulder + dome bush; no terracing, no erosion |
| W06 | fail | E transition is grass → flat orange band → slab, a two-tone hard edge; pebble pile at the house base |
| W08 | fail | every white-bark is a straight smooth pale pole with a painted 1 m tiling and no flare (`sn-whitebark-base` confirms); no lean/taper/branching hierarchy reads |
| W09 | fail | giants are smooth cylinders (moss-washed at B left, orange wall at the house, hazed cones at C, green camo at D left); no buttress flare, no fissures at frame scale |
| W10 | fail | F's upper half is flat grey sky + single-tone flat lobes + the house eave; no layered canopy, no light through it |
| W11 | fail | near-canopy discs over the plaza (F upper right, B top right) are single-tone flat cut-outs — survey-2 #07 unchanged |
| W14 | fail | limb position + pods match; the limb is a pale smooth tube half the reference's thickness with sprigs, no moss, no bark |
| W15 | fail | flanks are a short pale hay carpet on a lawn with a bare patch at the stair foot and a hard grass/slab edge |
| W18 | **pass** | purple in the D left foreground where the reference has it; nit: sprinkled, oversized trumpet blooms vs one clump of small flowers |
| W20 | fail | no moss on the A stair nosings; the cap's eave is a clean arc; cap reads as smooth paint |
| W22 | **pass** | own motion pair: grass 6.6/255, branch leaves 4.5, canopy 0.5–0.7, no lock-step; nit: far crowns read static |
| W23 | fail | D boulder is unlit behind ferns, unreadable; at 2 m (`sn-boulder-shotd`) slate seams, a black cavity and lichen polka dots — survey-2 #32 unchanged |
| W25 | fail (fresh) | proportions + cap now right; interior black (l < 0.08) vs l 0.32 lit room; smooth trunk wall vs knotted bark columns; 3 pods in a row vs 7–8 clustered |
| W29 | fail | arch silhouette is a rounded mound (≈ 1:1) with 5×-size bloom orbs; reference is a flat-topped log ≈ 2.2:1 with pinpoint lanterns and depth beyond |
| W30 | fail | shadows fall lower-right; reference lower-left — the known W30 auto-window conflict; fix path is `RUBRIC_PROPOSALS.md` |
| W31 | fail | no shafts read at A or F; the reference has 3–4 beams from the upper left |
| W32 | **pass** | D reads in 4 planes; nit: the far plane beyond the arch is a flat wall |
| W36 | **pass** | nothing floats at E; nit: identical-ellipsoid pebble scatter |
| C01 | fail | silhouette passes; skin cream `#8f7b61` vs tan `#89612e`, tunic saturated vs olive, no undershirt, cap from behind a pale mint sack |
| C02 | fail | shield is the right object but the spiral is ~45 % of the face vs ~70 % and the face is smooth; the Kokiri Sword is not visible in any back view |
| U01 | **pass** | hearts, item slot (stick, 4, ZR/R) and minimap at the reference positions; nits: minimap ~15 % larger, more saturated, no parchment |

Not filed: **U02 / U03** — the equipment screen is never in a take's six captures; a non-author needs a
dedicated `?screen=equipment` capture to judge them.

Score with these verdicts (`score.mjs --in <take-0116 copy> --reviews gauntlet/reviews`): **28/50, Phase 1
25/42**, 17 fail, 5 pending → 2 pending (U02, U03) once C01/C02/U01 are counted.

## The pattern behind the fails

Sixteen of the twenty-one W fails are the same finding from three angles: the auto gates count the
right *things* (20 steps, 555 stones, 10 white-bark variants, 12 giants, laminae, moss flags, god-ray
flag) but at the criterion's viewpoint the *surface* is one tone with clean edges — treads, slabs,
poles, cylinders, discs, tubes. The reference's signature is edge-detail (moss over nosings, grass in
joints, fissures, root flares, torn leaf silhouettes) on calm big shapes; ours has the big shapes and
even tones, with the detail either absent or only visible under 2 m. The two lighting fails (W30, W31)
are the second theme: the shadow direction is mirrored by the rubric's own window, and the shafts the
reference frames are built around are not visible.
