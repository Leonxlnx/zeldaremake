# Astra — environment priority

## Agent
Astra / Codex, ChatGPT Work. Root implements lighting, shadows, atmosphere and post-processing.
Own branch `agent/astra-environment-lighting`, draft PR6 against Fable's world branch.

## Current task
Owner explicitly paused character/model work. Improve the whole environment against the ten
new owner concepts, prioritize light/shadows/depth, collaborate through the repo, publish named
actual screenshots regularly. No schedules. No main/other-agent PR merge or force push.
Character work remains parked in its separate worktree/branch and is not represented as finished.

## Ownership and current integration
Fable explicitly agreed (PR2 comment5644519204): Astra owns lighting/postfx/atmosphere and related
config; Fable retains terrain/hardscape/structures/vegetation/placement. Root integrates useful
published slices deliberately, never overwrites the other agent's branch or log.

This branch starts from Fable e17f310. Fable a97302e vegetation is now copied byte-for-byte:
mask-derived planted plaza/bank rims, edge litter and repaired placement contracts. All five
vegetation suites pass. Housebb08/91c changes remain held for the announced floor/back-wall/roof
repair. Latest fetched Fable heada97302e; status/safe-props-scope requested in PR2 comment5644897947.

## Files / systems touched
- `src/world/lighting/`, `src/world/postfx/`, `src/world/atmosphere/`, related `config.ts` fields.
- `reference/owner-concept-previews/`: exact published preview-folder integration from own branch.
- Four `src/world/vegetation/` files: exact Fablea973 integration only, no Astra geometry rewrite.
- Isolated `gauntlet/scripts/*environment*` capture/publication tools and own push/manual workflow.
- Own log and PR2/PR6 coordination. Locked rubric/ledger/scoring definitions unchanged.

## Production decisions
- Golden key3.6 at existing azimuth−128/elevation38; cool hemisphere0.68, IBL0.34,
  sky0xb8c8d2/ground0x6d715a authored directly, without the old hidden warm-white blend.
- Contact AO0.45, contrast1.04, lift0, greenWarm0.08/greenDesat0.02, satSlope0.75,
  bloom0.18; old video-softening disabled, FXAA retained.
- Thin/cool close-middle air: density0.016 after6m; extra far density0.045 after60m.
  Existing height/mist/openness/scatter model retained. Do not hide coarse geometry in haze.
- Shared visible sky/IBL gives closed-direction upper gaps0.30 zenith contribution; horizon/fog
  unchanged. Actual141 review supports a modest improvement, especially C; not a complete bright-air target.
- Shafts follow actual key intensity. Setting1.55 × sun/3.1 gives reviewed gain1.8 at default3.6;
  zero key gives zero sun shafts. World-space key/shafts remain coherent in gameplay; do not rotate
  the sun with the camera or paint screen-space canopy shadows to match footage.
- New owner boards guide style/detail. The old footage rubric remains an honest independent
  diagnostic; no self-awarded pass or95% claim.

## Published checkpoints and actual evidence
All galleries are under https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment .
Each contains12 named JPEGs and raw metadata. B/E share a saved camera/time, hence10 distinct images.

| Source | Work / actual gallery |
| --- | --- |
| 7ffe416 | Environment audit/hooks/capture infrastructure. First run failed on texture GC bookkeeping. |
| 23ea37a | New fog plus historical/light candidate controls; actual gallery `progress/2026-09-12_082225685-23ea37a`, archive d5c37b0. |
| f6a33ea | Narrow capture-state repair + old-fog control; actual gallery `progress/2026-09-12_082955432-f6a33ea`, archive8a3decc. |
| b9b818f | Deliberate merge of owner-preview branch plus sun/shaft coupling. |
| f11517e | Adopted23ea lighting/fog; compared modest near-shadow refinement. Actual gallery `progress/2026-09-12_084515200-f11517e`, archive5f45234. |
| c869c365 | Exact Fablea973 planted-rim integration. |
| 141082b | Adopted near-shadow refinement + shared upper-gap sky study. Actual gallery `progress/2026-09-12_090056345-141082b`, archive2d4f6b4. |
| a57309c | Light-camera texel snapping + focused matrix regression check. Actual capture running since09:01:31UTC; stills will not establish GPU motion quality. |

Root/helper personally reviewed all five distinct23ea/f115/141 views; actual byte/source checks pass.
23ea vsf6: camera/time/controls/scene/layout/character/depth match; only productionheightfog differs.
23ea improves trunk/arch layering, contact readability, cooler depth and localized warm lights.
f115 refinement raises displayP10 about0.017–0.022, withP90 only0.002–0.009 higher; near detail
improves without the old haze wall. It also coherently rebuilds sky ground bounce, so adoption is
not pixel-identical to23ea runtime controls (mean absolute channel difference0.70–0.84/255).
141 preserves null-hook production controls/ray gain, adds brighter upper gaps and16,905 scene
triangles froma973 vegetation. Its26–77 changed depth samples per view are real geometry changes,
not an allegedly light-only comparison. F's longer pale triangular turf edge needs geometry review.

## Shadow stability correction
Old target snapping used worldX/Z1m increments, fractional texels in the rotated4096 shadow map.
New `shadowframe.ts` snaps desired target in the real shadow-camera right/up axes at92/mapSize m.
Window extent, sun direction, depth centering, bias, filter and caster geometry stay the same.
The actual Three.js LightShadow matrix regression checks7,680 coordinates across two bearings,
two map sizes and walking/turning/terrain paths: old fractional drift0.499texel; new residual
2.96e-12. Target moves at most half a texel per light axis. This is not a GPU shimmer verdict.

Independent review confirmed basis, aliasing and render order, but found a device-clamp edge:
Three may clamp requested4096 to a device's2048 limit. Current follow-up resolves the effective
map size before creating the snapper AND installs physical PCSS with that same size. Lighting is
first in SYSTEMS, so this still precedes environment/world material compilation.4096 appearance
should remain unchanged. Typecheck/build104modules and focused shadow test pass.
Technique: https://learn.microsoft.com/en-us/windows/win32/dxtecharts/common-techniques-to-improve-shadow-depth-maps#moving-the-light-in-texel-sized-increments

## References / downloads
All ten960px JPEG previews published and verified at branch `agent/astra-owner-reference-previews`,
commitf5ef8bad071ace0c0426c70848619f6504f93797, tree da58bac7893b439f6a89851b060aa5d83dfbd212;
PR7. These are clearly labeled compressed comparisons, never game scenery or original PNG bytes.
Original PNG upload stalled on large payloads; no rejected approval or successful-original-upload
claim. Exact originals were delivered as a verified36,516,933-byte ZIP, SHA256
0c0dd850b99727cea5d350c48d83f6fa47a0cf52fd9dabf77680eadcb26949fc. Owner authorized publication.
Verified screenshot ZIPs for23ea/f6/f115 have been delivered;141 packaging follows verification.
Source ZIPf115 was delivered with CRC verification; newer source remains available on the branch.

## Capture integrity
Push/manual workflow only, no schedules. Same source/camera/time/geometry/fog within each pair;
retained depth, requested controls and actual light/composer audits. Renderer memory allocation
counters are recorded separately; simulation/draw/audit invariants remain strict. Two zero-dt
settling frames suffice for the history-free composer; safe blank-buffer retries retain state.
Publisher validates complete image/source bundles, appends immutable dated folders and retries
non-force pushes from the latest archive head. This never writes or scores a gauntlet take.
Do not queue multiple wanted captures: GitHub permits one running + one pending per group.
Local browser access was rejected earlier; actual rendering uses CI, not a browser bypass.

## Known issues and Fable coordination
- Coarse/puffy paving, sparse/planar plants, angular house roof and looping supports remain far
  below the concepts. Fable agreed to smaller broken cells/less cushion shape inside current travel
  envelope first (PR2 comment5644687709). Tree pass should create real clustered canopy openings.
- Actual0062 B pale taper pixels(995,355)/(1002,371) hit ROOM FLOOR faces1556/1559, not jamb roots;
  upper patches hit back wall. Deep room floor follows terrain+0.05 into the bank. Fable acknowledged
  level pad/foundation/back-wall fix; not yet published. Hearth91c fixes buried assembly only.
- Roof retains excessive domeDisp/front-face colour and a thatch normal on shared moss. Fable plans
  rounded relief, house-specific moss normal and branched support-boughs. No W25 acceptance.
- Actual141 F near-right paving edge shows repeated pale turf teeth, longer aftera973. Independent
  CPU/source attribution in progress; do not compensate with darker light or blindly replace plants.
- Far-air/trunk contrast still needs asset-aware review. Individual lamp channels clip slightly;
  new fill/grade reduces this modestly. No global contrast escalation.
- Character remains placeholder on this environment branch; anatomy/garments are paused elsewhere.
- Local git push has no credentials; use verified Git Data trees/commits then normal non-force ref
  updates and fetch/reconcile the matching local tree. Never reconstruct remote commit bytes by guess.

## Suggested parallel work
Fable: floor/back-wall/roof construction, canopy openings/dark trunk geometry, smaller paving.
Capture helper: retrieve/verify actual141/a573 galleries and report visible regressions.
Read-only reviewer: attribute F turf teeth to exact generator/mesh; preserve other-agent ownership.

## Last updated
2026-09-12T09:06:27.176486+00:00
