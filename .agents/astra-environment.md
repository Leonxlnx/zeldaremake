# Astra — environment priority

## Agent
Astra / Codex, ChatGPT Work. Own branch `agent/astra-environment-lighting`, draft PR6 against
Fable's `cursor/kokiri-world-phase1-f65e`. The owner wants environment/world detail first;
character work is paused for a later local Blender MCP session on their PC. No scheduled tasks.

## Current task

84ecde9ccafb9057e466544340335d07b31f72c9 is published (tree e74c8a872071ba25334026bfbbd841f9ff297cec,
sole parent 2e9c19f). Its separate upper-air color capture is running as 34702832368.
The two-endpoint source boundary, conserved endpoint luminance and coherent sky/PMREM rebuild
are documented in docs/reviews/2026-09-12-cool-upper-air.md. Actual appearance remains pending.

Current next trial: lower only the two post PointLights from 3.2 to 1.2. Their emissive body/maps,
geometry, placement, animation and other lanterns stay unchanged. Actual bright bindings/rims
have black emissive texels; the internal unshadowed point is the supported first target.
Point-only HDR energy decreases 62.5%; this is not a predicted display brightness reduction.
Review retained amber glow, quieter bindings and the reduced nearby warm light pool in real CI.
Add one minimal postLightIntensities audit reading actual objects in structures/index.ts.
PR2 comment 5646971818 announces that narrow overlap with Fable's active house audit work.

All 2e9 actual 12+4 contracts pass with zero retries/final errors/warnings. Undersides become
modestly greener and clearer, upper leaf surfaces broadly stable; geometry, depth, packing and
calls/triangles match d41. D and S01/S02 JPEGs are identical; L01/L02 only tiny residuals.
Sparse wood pixel changes preclude a pixel-exact wood isolation claim despite exact source mask.
All eight preview targets, historical archive bytes and source/image ZIPs are verified.

## Files / systems being touched
- Root: structures/lanternPost.ts, one structures/index.ts audit line, own log and post-light review.
  Published upper-air and hedge sources stay pinned independently for their actual captures.
- Root lighting ownership: atmosphere/, lighting/, postfx/, related config and supplemental
  captures. Current same-source gain 1-versus-3 controls remain unchanged.
- World helper: frozen scratch-only hedge midrib/four-vein proposal, derivative filtered and
  distance faded, no geometry or texture changes; not yet applied or visually accepted.
- Prop helper: completed source/actual pod light diagnosis, no production edits.
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
| 84ecde9 | Separate cooler upper sky/open-air haze study, conserved endpoint luminance; actual capture running. |
| 2e9c19f | Actual 12+4 pass: modest greener hedge undersides, unchanged geometry/depth/calls/triangles; 0 retries/errors/warnings. |
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
thin bright edge/tie highlights persist. Near hedge undersides improve modestly; internal surface detail remains weak.
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
Astra: review the upper-air color capture, then the isolated post-light trial. Apply a bounded
hedge surface study only after its independent lighting controls are available.

## Last updated
2026-09-12T15:54:57.259566+00:00
