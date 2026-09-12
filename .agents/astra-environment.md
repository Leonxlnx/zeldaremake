# Astra — environment priority

## Agent
Astra / Codex, ChatGPT Work. Own branch `agent/astra-environment-lighting`, draft PR6 against
Fable's `cursor/kokiri-world-phase1-f65e`. The owner wants environment/world detail first;
character work is paused for a later local Blender MCP session on their PC. No scheduled tasks.

## Current task

Starting the independently pinned grass-normal correction after published roof merge
5ea5b6d9be4c8c9e3e6f7ff7348f04961aac34ca, tree 67dff99f334ec61518a9ae369bc8de8f800584cb,
parents a350849 + Fable0f9426c. Actual roof environment run 34705955967 is active.

Before this major step root fetched all refs, read Fable's newest log/commits and PR2 comments,
and claimed W15. PR2 comment 5647251867 announces grass-only materials.ts and existing contract.
Fable has no vegetation overlap: 6128726 hardscape lawn is published, 87d3f31 seals take68;
his new active structures pass adds distant houses and will correct the accepted lower-bough
window occlusion / owned moss-map disposal findings (PR2 5647244951). Do not touch his files.
Integrate the lawn after this grass checkpoint so each actual comparison has one causal change.

The grass shader intentionally tilts normals toward terrain up, but Three's DoubleSide flip
reverses that bias on back faces. The prepared scratch candidate reflects only a negative
terrain-up component after the standard face flip. It preserves horizontal facing and does not
add fill, exposure, texture, geometry or density. Direct lighting and IBL also change; two
actual-image CPU-correspondence anchors can reach NdotSun .997, so actual whole-world review
must reject a pale/uniformly lit lawn. Current contracts preserve all non-grass programs and
original wind/deformation/shadow coordinates, with only one vec3 varying added.

All a350 and 668 actual 12+4 contracts and source/image ZIPs pass. a350 retains faint branching
at L01 without glowing bindings; L02 remains mostly smooth. Hedge veins are too subtle to call
a substantial world improvement. Earlier ab post light 1.2, 84 cooler air and 2e9 sky response
are retained with their independent actual evidence. Crate texture study remains paused.

## Files / systems being touched
- Root: grass-only materials.ts correction + existing materials.test.mjs, own claim/log/review.
  Published 5ea roof merge preserves partner bytes, log and ledger; no further house edits.
- Root lighting ownership: atmosphere/, lighting/, postfx/, related config and supplemental
  captures. Current same-source gain 1-versus-3 controls remain unchanged.
- World helper: read-only roof/support integration review. Crate texture work paused; the earlier
  cosine proposal was not applied. Ordinary root occlusion does not warrant prop relocation.
- Prop helper: independent actual energy review complete; waits for pinned atlas detail review.
- Shadow helper: completed frozen grass-normal diagnosis/proposal; root adopts exact bounded
  patch after coordination. No density/layout/wind changes.
- Capture helper: pinned actual source/gallery verification and ZIPs, no production edits.

## Partner state / coordination
Latest fetched Fable head 87d3f31 seals take68 with 0f9426c roof and 6128726 hardscape lawn.
Read PR2 comments 5647232830 and 5647244951: lawn completed; active structures follow-up adds
budget-capped distant houses and fixes the accepted bough/window and owned moss-map defects.
Our 5ea merge deliberately preserves his roof bytes pending that source. No active vegetation
overlap; his earlier 5646798877 release and our renewed 5647251867 scope are explicit.

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
| a350849 | Actual 12+4 pass: faint irregular branches improve L01; L02 mostly smooth, no luminous bindings. Exactly +1 material/texture/program; geometry/depth/budgets exact. |
| 6686b0b | Actual 12+4 pass: very subtle hedge surface variation; no substantial world improvement. Geometry/depth/budgets exact, no obvious pale glow. |
| ab7796e | Actual world/L01/L02 review: quieter post/rope light, amber retained; keep 1.2. All 12 macro contracts pass; all 16 contracts/ZIPs/history complete. |
| 84ecde9 | Actual 12+4 pass: cooler air/shaded paving, warm sun retained, no obvious cyan veil/seam; unchanged cost/depth. Retained. |
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
thin bright edge highlights persist; intensity 1.2 quiets broader post/rope illumination. Near hedge undersides improve modestly; internal surface detail remains weak.
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
Fable: correct lower bough/window occlusion and dispose owned moss maps; publish active hardscape
lawn work with exact source and overlap. Astra: capture the combined roof checkpoint, then
independently test the grass-normal correction. Crate grain remains lower priority.

## Last updated
2026-09-12T16:42:36.273016+00:00
