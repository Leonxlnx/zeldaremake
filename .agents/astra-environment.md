# Astra — environment priority

## Agent
Astra / Codex, ChatGPT Work. Own branch `agent/astra-environment-lighting`, draft PR6 against
Fable's `cursor/kokiri-world-phase1-f65e`. The owner wants environment/world detail first;
character work is paused for a later local Blender MCP session on their PC. No scheduled tasks.

## Current task

Published hedge-light source 2e9c19fb8ab2d3749a421ff1c5e6a030b6a8453f, tree
2f503e0058569207b446f37a7ce34de053a1d37e, parent d41b354. PR2 comment 5646848710 records its
0.65 leaf-only hemisphere difference, exact original geometry/placement/RNG, all-LOD mask,
small attribute cost and unchanged shadow programs. Its actual 12+4 capture is underway.
Do not judge that pinned checkpoint from this later working tree.

Current separate trial: cool only the upper sky and open-air haze endpoint at conserved
linear luminance. Candidate SKY_GAP_GLARE [.315,.3670755,.462], hazeLit [.29,.33185123,.36].
Retain all fog density/ranges/lower colors, direct sun, hemisphere, environment intensity/tint,
material palettes, geometry and current gain 1-versus-3 controls. A fresh source/page rebuild
updates the visible sky and baked PMREM together. No live dome-only recoloring.

Most apparent gray sky in actual A/F is fogged distant geometry; only 1/6 of the upper 1,200
coarse depth probes are pure sky. Pairing the milder hazeLit endpoint reaches that open upper
geometry while retaining the horizon and closed/lower fog. CPU angular integration preserves
upper PMREM-input luminance within -0.14%, but intentionally shifts R -14.1% / B +55.7%.
Actual shaded paving, roof, skin and gaps must be reviewed for excessive cool/cyan color.
No endpoint calculation is a predicted pixel or visual acceptance. The two-constant source
boundary check passes; endpoint luminance changes remain below 3e-9. Typecheck/build pass
(107 modules). The previous hedge capture is confirmed in progress before this next push.

All d41 actual 12+4 contracts passed with zero retries/final errors/warnings. Root reviewed all
five world views and L01/L02: grain activates on instanced columns, Fable foreground is fuller,
paths readable, individual pod leaves/amber gaps clear. B/E is 8,714,720 triangles / 650 calls;
max calls A659. Fine pod veins, pale ties and thin bright rims remain. Eight inline archive
preview targets and all historical folders are verified. Character stays paused for local Blender.

## Files / systems being touched
- Root: atmosphere/sky.ts, atmosphere/heightfog.ts, own log and color-study review.
  Published hedge material/geometry source and captures stay pinned independently.
- Root lighting ownership: atmosphere/, lighting/, postfx/, related config and supplemental
  captures. Current same-source gain 1-versus-3 controls remain unchanged.
- World helper: sky/air source diagnosis completed; read-only take flag review confirmed
  Fable already fixed the historical typo in f5681bf. No duplicate tooling patch.
- Prop helper: completed independent hedge mask/geometry/program proof, no production edits.
- Capture helper: pinned actual source/gallery verification and ZIPs, no production edits.

## Partner state / coordination
Latest Fable head is 8701b86 (ledger/log only); last world source remains 3dc217d; PR2 comment 5646616508 releases vegetation-13 and keeps
structures-15 active (cap front colour/streaks, roof leaf blobs, support bough). Fable also owns
queued hardscape lawn-pocket tufts/mask work. His latest tick-51 log/take-0067 reports 23/50; no phase
completion. PR2 comment 5646798877 explicitly clears our bounded vegetation material/hedge
option work: his active files are structures and hardscape, with no vegetation overlap. Comments 5646649074 and 5646701325 document our exact merge and focused grass proof.

Fable approved bounded near-tree material work in 5646342247 and handed over signpost/lanternPost
in 5644903321. Preserve his geometry/roof direction and announce renewed overlap before editing.
Our d755 merge imports his earlier 1cc8f51 ancestry, log, 66-entry ledger and review/reference
files intact; it does not merge PR2/main or change his branch. His column-root, cap-winding and
moss-normal fixes are already integrated, along with formal W25 evidence and flight-top id.

## Completed checkpoints / actual evidence
All named images: https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment .
Each world comparison contains 12 JPEGs but 10 distinct images because B/E share a camera.
Four supplemental details are fixed full-scene production views, not isolated studio renders.

| Source | Change / actual review |
| --- | --- |
| 2e9c19f | Leaf-only hedge sky transmission; exact original geometry/placement/packing/RNG and small mask data. Actual 12+4 pending. |
| d41b354 | Actual 12+4 verified: active grain, denser planting, all under budget, separate seated pod leaves. Zero retries/errors/warnings. |
| d7552ee | Fable 1cc ancestry, column grain trial and sign chisel response. Actual column trial fails to activate; installed fragment-prefix defect is being corrected. Sign remains mostly ink-like. All 16 source/image/control contracts pass; L01/L02 identical to 640. |
| 64028c4 | Actual 12+4 pass. Gain 3 gives a modest upper-flight improvement: A/F local mean +1.335/+0.966 in 8-bit luminance, plaza controls identical, C/D identical across toggle. Retained, still weaker than reference beams. |
| 561345b | Actual 12+4 pass; all views below 9M triangles / 700 calls. Hedge coverage preserved. Seated green leaf pods improve the wrap; smooth hood and thin bright ties remain. |
| f630ebb | Clearer near non-instanced giant grain and wider/darker sign cuts. Actual 12+4 pass; root reviewed F/S01/S02. Grain and legibility improve, cuts still shallow. |
| ccc7e7f | Real top-flight opening published through WorldContext to the deferred volumetric mask. Actual off/on result is subtle, not a strong beam. |
| d7ddc01 | Sign-owned materials, laid rope, PACKS proposal and formal W25 review. Actual ropes/wood improve; original cuts too faint. |
| 18e1933 | Fable house/canopy/joint integration, corrected moss normal encoding and finer high-LOD hedge leaves. Doorway clear, roof/support still weak. |
| 0169c3f | Fable columns/broken paving and reviewed terrain-contact/cap/joint corrections. Actual F turf teeth removed. |

561345b actual world performance: every saved view is below 9M submitted triangles and 700 calls.
B/E is 8,896,232 triangles / 645 calls; max calls A is 654. Savings vary with pod visibility;
A saves 163,984, B/E 173,714 versus f630. Helper reviewed all five distinct world views: hedge
coverage/silhouette preserved. C baseline used one unchanged-state blank retry; all other world
images used zero. Actual leaf-pod closeups pass: seated, green/dark leaves; smooth hood and thin ivory edge/tie highlights remain. Root personally reviewed L01/L02. CPU replay preserves default post
builder, non-pod geometry, lights, swing, RNG, body and prior original leaf mesh bytes.

f630 actual source/tree/archive, camera/time/controls, all 16 depth hashes and audits verified.
Zero final console errors/warnings or retries. A's column and overhead sleeve were intended
to be outside its near-giant trial; d755 actual review later exposed the fragment instancing gate
defect described above. The historical intended-scope diagnosis is superseded. See `docs/reviews/2026-09-12-near-bark-and-sign.md` and actual gallery
`progress/2026-09-12_142043129-f630ebb`, details `details/2026-09-12_142330355-f630ebb`.

## Decisions / retained contracts
- World sun and shafts remain coherent: sun intensity 3.6, azimuth -128, elevation 38. Do not
  rotate the sun with the camera or paint reference imagery into the scene.
- Camera-following shadow window snaps in the actual light-camera texel axes, using the device-
  clamped map size consistently with PCSS. CPU matrix stability passes; no GPU motion verdict.
- Local gain study preserves six legacy shaft columns, actual shadow-map bounds/occlusion,
  terrain-anchored opening, lower-air fade, density, extinction, geometry and global lighting.
- Near fill/sky/depth work is retained; do not hide unfinished assets under a global haze lift.
- Props borrow shared maps but own/dispose their generated finishes. Two post leaf pods reuse
  original 45ed76d geometry and both-axes dark UV mip correction; other lanterns stay unchanged.
- Layout, deterministic RNG, terrain contact and shared system boundaries remain authoritative.
- Locked rubric/ledger rules remain intact. Supplemental images are not gauntlet scores, and
  no self-awarded quality percentage or completion is recorded.

## Known issues
The scene remains materially below owner references. House cap/support silhouette and colour,
foreground plant forms/density, flat column/sleeve shading, restrained but weak light shafts,
and shallow sign engraving remain visible weaknesses. Fable owns roof and hardscape foreground improvements.
Narrower pod sepals now read individually in actual L01/L02; fine veins remain weak and
thin bright edge/tie highlights persist. Near hedge undersides await their material capture.
Gain 3 is a verified modest improvement, not prominent reference-like beams. Existing texture grain cannot
substitute for the references' irregular silhouettes, moss thickness and planted fissures.
Character is a placeholder; paused character branch/worktree is preserved for local Blender.
Historical logs contain superseded issues/plans; use this current section for active state.

## Verification / publication
Typecheck/build must pass per commit. Focused source/geometry contracts and real GitHub CI
captures verify changes. CPU shader/texture calculations are explicitly not rendered images.
Source, source tree, camera, time, controls, depth and immutable JPEG archive bytes are checked.
Before/after dist hashes are recorded; original built dist bytes are not independently rehashed.
Historical gallery folders are append-only. No schedules or automatic PR/main merge.
Local Git push has no credentials; publish verified Git Data trees/commits with non-force ref
updates, then fetch and reconcile only after exact local/remote tree equality. Never force push.

## References / handoff
All ten owner boards are available locally and as published 960 px comparison previews:
https://github.com/Leonxlnx/zeldaremake/tree/agent/astra-owner-reference-previews/reference/owner-concept-previews
Root revisits the actual boards, including 01/02 in this round. They are never game scenery.
The exact original PNG ZIP was delivered; previews do not pretend to be original PNG bytes.
`docs/LOCAL_CONTINUATION.md` explains the real local checkout for the later Blender session.
Detailed earlier chronology is preserved in `docs/reviews/astra-environment-history-through-64028c4.md`.

## Suggested parallel tasks
Fable: publish the active roof/support pass and hardscape lawn work, with exact source and overlap.
Astra: finish the tree shader gate correction, publish the merged foreground/sepal checkpoint,
then review actual images. Diagnose black near leaves before changing their materials.

## Last updated
2026-09-12T15:37:06.618390+00:00
