# Astra — environment priority

## Agent
Astra / Codex, ChatGPT Work. Own branch `agent/astra-environment-lighting`, draft PR6 against
Fable's `cursor/kokiri-world-phase1-f65e`. The owner wants environment/world detail first;
character work is paused for a later local Blender MCP session on their PC. No scheduled tasks.

## Current task

Integrate Fable's exact foreground vegetation `3dc217d1b687fe04c47a0c7055250f74bb536e54`
with narrower post-lantern sepals, direct screenshot archive previews, and a correction to the
fragment instancing gates in tree bark. The pending merge has parents d7552ee and 3dc217d.
The five vegetation files are byte-exact Fable source; our finer plantgeo.ts remains unchanged.
An automatic duplicate hedge PACKS insertion was resolved by retaining his complete newer file.

Actual d755 images caught a real source defect: Three 0.186.0 emits USE_INSTANCING in its vertex
prefix only. The new column grain therefore compiled out; the earlier non-instanced near-bark
floor also incorrectly included columns. Actual A/B column regions are pixel-identical to 640.
PR2 comment 5646701325 reports the defect and renews our narrow trees/materials.ts hold. The reviewed fix is now applied: a tree-owned fragment define uses real shader.instancing.
Installed program generation/preprocessing confirms both corrected gates and distinct cache
entries. Actual A floor proxy median rises 8.73%; the documented close-column envelope rises
49–57%, so B/D brightness needs real review. Do not credit d755 with column improvement.
Its actual sign cuts remain readable but mostly ink-like; the relief change is small.

The leaf helper's frozen shape patch is applied exactly (source SHA256
1a6dd65555ad11a8386481597d2fa5afb5eff541c10844a8b44296566e7f5089).
Six narrower leaves replace the continuous hood silhouette, with a small tip curl. Body,
calyx, bindings, topology, materials, lights, swing, all other post parts and RNG are retained.
The CPU camera projection opens amber gaps; it is not a game render or visual acceptance.

Archive root/detail README generators now show the latest four actual world/detail images
inline, with source and capture time, without replacing historical image/metadata bytes.
The existing publisher test and a check against actual immutable 561/640 metadata pass.

## Files / systems being touched
- Root: exact Fable merge of vegetation field/grass/lodset/plants/plants.test; own leafPod.ts,
  trees/materials.ts gate correction, archive README generators, own log/review documentation.
- Root lighting ownership: atmosphere/, lighting/, postfx/, related config and supplemental
  captures. Current same-source gain 1-versus-3 controls remain unchanged.
- Shader helper: scratch-only installed Three program/gate correction and diagnostics.
- Prop helper: read-only identity/shading diagnosis of almost-black near hedge leaves, not
  Fable's roof leaf blobs. No vegetation material or world light changes yet.
- Capture helper: pinned actual source/gallery verification and ZIPs, no production edits.

## Partner state / coordination
Latest fetched Fable source is 3dc217d; PR2 comment 5646616508 releases vegetation-13 and keeps
structures-15 active (cap front colour/streaks, roof leaf blobs, support bough). Fable also owns
queued hardscape lawn-pocket tufts/mask work. His tick-50 log/take-0066 reports 23/50; no phase
completion. Comments 5646649074 and 5646701325 document our exact merge and focused grass proof.

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
The old pod hood is too smooth; narrower sepals await actual review. Thin edge highlights remain.
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
2026-09-12T15:11:41.103903+00:00
