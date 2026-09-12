# Astra — environment priority

## Agent
Astra / Codex, ChatGPT Work. Own branch `agent/astra-environment-lighting`, draft PR6 against
Fable's `cursor/kokiri-world-phase1-f65e`. The owner wants environment/world detail first;
character work is paused for a later local Blender MCP session on their PC. No scheduled tasks.

## Current task
Reconcile Fable's published 1cc8f51 ancestry into this branch, then render two bounded material
trials: grain on near instanced column bark and lighting response on the sign's shallow cuts.
PR2 comment 5646560839 records the merge and column scope. The merge conflicts are equivalent
moss-normal explanations and the semantic flight-top id; Fable's version resolves both without
changing their meaning. All other src files merge to the existing Astra source. His log,
append-only ledger, reference notes and review evidence are imported intact. This does not
merge PR2/main or modify his branch.

The new bark trial reuses the existing filtered texture sample to modulate ONLY the near
instanced bark floor by a neutral 0.79–1.21 multiplier, full through 18 m and fading to zero by
24 m. It preserves f630's non-instanced giant treatment, white trees, leaves, global light,
shared floor presets, texture calls, geometry, wind and shadows. CPU floor median +0.51% is a
sampling diagnostic, not a GPU brightness claim. Normal-light cancellation is a separate issue.

The sign trial keeps the readable f630 widths/paths, dark groove bottom and all joinery. It
changes only glyph normal scale, exposed cut-face tint and glyph-only floor lift. Effective
normal depth is 1.125 mm; this is surface shading, not displaced geometry. Actual light decides
which face brightens; no painted directional highlight or emissive edge. Compare S01/S02 with
f630 and 561345b for retained gameplay readability and stronger carved relief.

Capture helper is independently verifying pinned 561345b leaf/PACKS images and then the
64028c4 local upper-flight gain study. Keep those CI sources isolated from this working tree.
Do not queue another wanted capture while the current wanted source is still pending: GitHub
retains only one running and one pending run in this workflow group.

## Files / systems being touched
- Root: `src/world/trees/materials.ts`, `src/world/structures/signMaterials.ts`, own log/review
  docs, claims, and the deliberate merge of already-reviewed Fable source ancestry.
- Root lighting ownership: `atmosphere/`, `lighting/`, `postfx/`, related config and supplemental
  capture definitions. The current gain 1-vs-3 capture controls remain isolated and unchanged.
- Sign and column helpers prepared scratch-only proposals; root reviews/applies/publishes.
- Capture helper: immutable source/gallery verification and ZIPs, no production edits.

## Partner state / coordination
Latest fetched Fable source: 1cc8f51, log tick 50, take-0066. He reports vegetation-13 (foreground
framing) and structures-15 (house cap front colour/streaks, black leaf blobs, hoop bough) active.
His new source for those passes has not landed. Preserve his ownership of foreground and roof.
The earlier source fixes are already deliberately integrated here: a973 vegetation contracts,
ddd24fd columns, bb11762 paving, 77dd665 joint clipping/tone, 86be323 house and a05ffb0 canopy.
He adopted our column-root, cap-winding and moss-normal fixes in 51f2fbb/786084e/d5abc91, and our
formal W25 review/semantic id in 8ee4ea6. His take-0066 reports 23/50; no phase-complete claim.

PR2 comment 5646502912 announces the published leaf/PACKS checkpoint and local light gain study.
Comment 5646399040 narrowly updates the vegetation hold for the reviewed hedge PACKS line on
this branch. Fable's branch and his apply-after-foreground ordering stay untouched; all other
vegetation is frozen here until his published delta can be reconciled. Never replace his newer
plants.ts with an older full file. Fable explicitly handed off signpost/lanternPost in comment
5644903321 and approved the bounded near-giant material trial in 5646342247.

## Completed checkpoints / actual evidence
All named images: https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment .
Each world comparison contains 12 JPEGs but 10 distinct images because B/E share a camera.
Four supplemental details are fixed full-scene production views, not isolated studio renders.

| Source | Change / actual review |
| --- | --- |
| 64028c4 | Local upper-flight gain 1 versus 3, same real 1 m opening, actual shadow guard. CI pending behind 561345b. No visual acceptance yet. |
| 561345b | Reviewed hedge packing plus original leaf-wrapped pods on two posts. Actual world gallery `progress/2026-09-12_143635631-561345b` passes; details pending. |
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
Zero final console errors/warnings or retries. A's column and overhead sleeve were deliberately
outside its near-giant trial. See `docs/reviews/2026-09-12-near-bark-and-sign.md` and actual gallery
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
and shallow sign engraving remain visible weaknesses. Fable owns roof/foreground improvements.
The pod closeups pass and show seated leaves, but their hood is too smooth and thin edge highlights remain. Gain 3 is still awaiting actual review. Existing texture grain cannot
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
Fable: finish/publish foreground and roof work; tell Astra the exact source and active overlap.
Astra: review actual new light and pod images, correct local materials, then reconcile Fable's
published delta. Capture helper checks immutable sources; sign/column helpers stay scratch-only.

## Last updated
2026-09-12T14:41:41.578651+00:00
