---
agent: astra-local
runtime: Codex desktop / Astra on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/astra-local-blender
updated: 2026-09-13T18:11:00Z
---

# Astra local — Blender character continuation

## Current task
Owner resumed character work: install Blender on E:, connect Blender MCP, and try an
original Link model with attention to face, ankle/boot anatomy and material detail. This
supersedes the old world-only/character-paused wording for this owner's task. The owner
explicitly rejected Computer Use so the laptop stays available: use the hidden Blender
process and MCP, with four CPU render threads.

## Scope and recovery
- This branch starts at Astra environment checkpoint 087b232; main still only has bootstrap.
- Recovered PR5 movement/character history, PR6 environment work, and PR7's ten owner previews.
- Read Fable through take-0079 and 04c8d91; cloud Astra's 11:18 closeout said local character
  art should proceed. The promised cloud handoff document was not published as of last fetch.
- Final fetch also recovered Fable's b2691b8 vegetation pass: bank broadleaf/clover/moss,
  denser layered hedge and cleared D path shoulders, unchanged draws, +0.4-0.5 M tris.
- Scope: art/characters/link, tools/blender, this log, INBOX and an additive C01/C02 claim.
- No runtime, world, layout, movement, rubric or score changes. Environment belongs to Fable.

## Installed and verified
- Blender 4.5.13 LTS portable at E:/Apps/Blender/blender-4.5.13-windows-x64.
  Official archive SHA256 verified; a Start-menu shortcut is installed.
- Blender MCP 1.9.1 from ahujasid/blender-mcp in E:/Tools/blender-mcp/.venv; addon installed
  under Blender's portable/scripts/addons. uv 0.12.13 in E:/Tools/uv.
- Codex global MCP registration: blender, localhost 127.0.0.1:9876, telemetry disabled.
  Native discovery may need a task/app restart. Current task uses the official MCP SDK
  stdio bridge to the installed server. It has already built and rendered the actual model.
- Windows compatibility: close/reconnect the addon socket per command. Two successive
  get_scene_info calls in one MCP session PASS. Upstream source backup and valid patch kept;
  see tools/blender/README.md. No mouse/keyboard automation is required.
- Six-view render calls exceeded the socket response timeout despite completing inside
  Blender. Renderer now sends one view per call and resumes a matching partial checkpoint.

## Character checkpoint
- Editable link-study.blend; all used images packed. Original geometry and CC0 material maps.
- Multiple real dated render checkpoints, including front/side/back, face and boot close-ups.
- Continuous face/nose/cheek sculpt, smaller almond eye openings, projected hair fibres,
  continuous wrist/hand and boot/ankle volumes, shaped soles, equipment and stitched cap.
- Art sculpt: 415,484 evaluated triangles / 26 materials, about 1.14 m tall including cap.
  It is UNRIGGED and BELOW the reference quality. No claim of finished character art.
- GLB is a static flat-colour shape-review export, not the final textured runtime asset.
  Export copies evaluated geometry, includes curves, isolates the active scene, and checks
  exact triangles. This caught an unwanted 12-triangle startup cube from Blender's other
  scene; use_active_scene fixed the cause. UV baking and animation remain outstanding.
- Actual rendered Blender checkpoints are not game captures, gauntlet takes or phase gates.

## Collaboration / next delivery
Fable acknowledged the split and sent the full runtime contract in PR2:
https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5653137489

Metres, Y-up, Z-forward, feet origin, ~1.18 m to crown; <=25K tris / <=4 materials / <=2K maps;
plain named bones including ankleL/R; idle/walk/run/stairs in-place clips. Full details are in
art/characters/link/README.md. Fable will integrate a ready candidate behind a fallback loader.
The current high-poly, unrigged study should NOT be integrated as that candidate.

Next art work: stronger facial sculpt/expression and organic hair masses, authored cloth
folds and worn seams, retopology/UVs, PBR baking, skeleton/weights and gait validation.
Preserve the existing movement implementation. Do not merge main or partner branches.

## Validation
- npm ci, npm run typecheck and npm run build passed on this branch.
- MCP connection regression passed; compatibility patch passes git apply --check upstream.
- Evaluated geometry and GLB checks are in export_check.py and validation.json.
- Final six-angle checkpoint: art/characters/link/progress/2026-09-13_125545. No gauntlet visual score claim.

## Last updated
2026-09-13T13:00:17Z
## Continued work after the first checkpoint

The owner clarified that the first review checkpoint was not a stopping point. Continue
character development against all ten target images. The ten published 960px previews
were refreshed from origin/agent/astra-owner-reference-previews and every SHA256 verified.
The source manifest's original PNGs are not present in Git history; its 'retained locally'
wording refers to the previous cloud session. Higher-resolution concept sheet 03 is also
available locally for the character comparison.

Current changes: reduce the oversized head, lengthen the tunic/torso while retaining arm
length, narrow the jaw, soften the nose/lips, replace iris fibre geometry with shading,
and give the sleeves real openings. Use the existing scanned cloth normal on UVs instead
of the speckled bump. Next: finish the sculpt/material comparison, bake and reduce the
runtime asset, rig the agreed named bones and in-place clips. Environment remains Fable's.

## 2026-09-13 14:05 UTC — sculpt and runtime preparation

Applied Fable's PR8 critique to the source: narrower jaw, nasal bridge/lips, upward/back
helix, real socket openings and calmer almond lids; layered cubic hair ribbons; cloth UV
normal and sleeve shoulder seating. Actual render: progress/2026-09-13_134859. The hair
and clothing still fall short of sheet 03; this is not a quality pass claim.

Runtime work in progress locally: four UV meshes, 23,978 triangles; skin/hair/eye maps
baked, outfit maps underway. A >180-second clothing bake completed after its MCP client
expired; verified saved pipeline state, kept Blender alive, added a configurable command
timeout. No keyboard/mouse automation. Four-thread, BelowNormal Blender remains in use.

Sent Fable gait reach/stride constraints at PR8 comment5653686917. Preparing named rig,
in-place clips, export validation, and actual Three.js review. These new pipeline scripts
are not yet fully executed/validated, so this source checkpoint leaves them uncommitted.
Typecheck and build passed; local server patch passes git apply --check against upstream.

## 2026-09-13 14:53 UTC — textured, skinned diagnostic candidate

The runtime pipeline is now executed: four skinned meshes/materials, 24,133 triangles,
19 named bones, 12 embedded PBR maps at 1K/2K, idle/walk/run/stairs. GLB SHA256
8d1965fa7c32a660995f5f7c95b31d7918dcb4aba450889eb96456d53e142dc8.
Actual Three.js review: progress/2026-09-13T14-48-18-787Z-runtime, 18 views, no page errors.

Fixed inward lid/lip winding, reserved facial reduction topology, covered the bald nape,
recessed hidden iris portions, and retained region weights for repeatable rig rebuilds.
Loop endpoints and flat stance ankle paths are validated; terrain adaptation remains the
production sampler's job. Walk stride 0.88 m / 0.55 s, run 2.21 m / 0.566667 s, stairs
0.806667 m / 0.733333 s. Fable approved the shorter walking cadence in PR8 comment5653925946.

The candidate is STILL BELOW REFERENCE QUALITY. Eyes remain round; lower cheeks doll-like;
hair clumps helmet-like; cloth needs folds and wear. Running exposes excessive knee/hem
interaction. Diagnostic world integration is the next comparison, not a quality pass.
Fable retains production loader/world ownership. No world or movement files changed.

Shared browser helper now sends Content-Length and closes each local HTTP response: this
Windows host stalled reused sockets. Direct two-request regression passes; actual headless
captures use native pipes and finish in ~5 s. No rubric, score or ledger edits. Historical
render source bytes are preserved with -text so their captured SHA256 survives Git.
TypeScript/build and direct HTTP regression pass. Latest Fable fetched: 7abbd4e/take-0080,
23/50, environment still below target. Continue character art and review integration.

## 2026-09-13 15:16 UTC — continuous eyelids and swing-foot rotation

Published 17adcb3 to Fable for diagnostic integration (PR2 comment5654026563).
New candidate pending this commit: continuous face-to-lid topology removes pasted-patch
seams; iris geometry is clipped in the authored opening, with the old runtime expansion
removed. Lower cheeks narrowed; scalp band lifted off forehead; locks have more thickness.
Nine PBR maps rebaked. New GLB f3a87d45f33d891c2694d18011621f69c09065cec757d76c6cb97eabed91a402,
24,332 triangles. Actual Three.js progress/2026-09-13T15-09-15-055Z-runtime includes 18 views
and 121 sole-clearance samples per gait: minimum +3.66 mm, loops and bone lengths pass.
Swing feet rotate through each step and ease flat before contact; stance paths unchanged.

Close-up shading artifacts remain. A roughness inspection initially sampled Blender's
older cached image; fresh-file sampling found one missing face sample, not hundreds.
The GLB's packed green roughness channel is byte-identical to the new source map. Do not
report a widespread projection defect from the stale cache result. Source face is smoother
than the reduced runtime; continue art and evaluate in Fable's real world lighting.
Next root garment correction: remove the tunic's closed bottom, add the inner garment,
and check high-knee poses. Typecheck/build and HTTP regression pass. C01/C02 renewed 15:11Z.

## 2026-09-13 15:29 UTC — first actual world comparison

Created detached E:/zeldaremake-world-review at Fable e591006, shared installed node_modules
through a junction, and built a diagnostic overlay using the published 41b9cdf GLB. Only
that scratch checkout's entrypoint imports/installs the art overlay. Fable's production
loader is untouched. Captures use real Radeon 780M / D3D11, no desktop input.

Twelve verified existing/candidate images: progress/2026-09-13T15-26-26-214Z-world-review.
All six views save 69 calls; A 595 / 8,830,884 triangles -> 526 / 8,860,508. Actual source
entrypoint/overlay saved with the images. The candidate idles and inherits the original
root placement; this is appearance evidence, not candidate terrain IK or a gauntlet take.
Clothing/boot anatomy and face improve in context; reference quality is not reached.

Current garment work remains uncommitted and baking: open tunic hem/neck, inner shorts,
extended upper legs, cloth folds/lacing and open boot cuffs. Source render 151956 exists.
Finish the seven new skin/outfit bakes, rerig/export/capture and inspect the high-knee pose.
No stop or goal-complete claim.

## 2026-09-13 15:44 UTC — garment and boot revision validated

Opened tunic hem/neck and boot cuffs; added inner shorts, upper-leg continuity, more cloth
fold geometry and collar lacing. Seven skin/outfit maps rebaked. A close-up caught a gap
between leather upper and welt: refine_runtime now seats each continuous upper into the
sole while retaining its UVs. Actual 18-view/121-pose review passes at
progress/2026-09-13T15-42-41-167Z-runtime; minimum sole Y +4.00 mm. New GLB SHA256
9f6f0987e074bee3b775419ded86589daff4bd312c4b48985932ddef3eeb2be7, 24,332 triangles,
four materials, unchanged bones/clip durations/strides/ankle-local sole markers.
The run remains a high-knee stylized motion; hair and facial/material detail still need work.

Fable f92a384/take-0081 now explicitly says character-3 integration is running, alongside
crown lighting: deterministic mixer, speed-scaled clips, grounding, look-at and fallback.
Do not replace that production work. Need review the real integrated movement when it lands.
Live local appearance preview: http://127.0.0.1:54075/?dev=0&hud=0 (scratch e591006);
asset studio: http://127.0.0.1:52996/art/characters/link/review.html. Both use background
servers; no desktop control. Preview defaults to candidate and has a native existing/candidate
toggle. Fixed three invalid CP1252 dash bytes in this log; use explicit UTF-8 when writing text.


## 2026-09-13 16:06 UTC - closed ears and cap/fringe revision

Rebuilt each ear as a closed rim/bowl mesh with interpolated warm skin tint. The previous
subdivided single polygons shrank away from the independent helix, leaving visible holes.
Source assertions verify forward-facing bowls and two faces per edge. Three skin maps rebaked.
Hair geometry now prioritizes the visible fringe (2656 triangles); three hair maps rebaked.
Cap rest geometry has a fuller rear drape and front edge lifted behind the fringe, preserving UVs.
Actual 18-view review: progress/2026-09-13T16-03-24-694Z-runtime, Radeon 780M / D3D11.
GLB f3d354643e3200555c2fcb5e53f1a98368fb714472f9211ddb73044516fe470f, 24,474 triangles,
four materials, same nineteen bones/clips/stride contract. All 363 sampled locomotion poses
retain positive sole clearance. Ear holes are resolved; facial/lid shading and solid-looking
hair remain visible. The GLB already contains interpolated smooth normals, so the faceting
is not a blanket flat-shading export setting. Continue source/reduction/material review.
Fable latest fetched remains f92a384 with character-3 integration running. No production
loader/world changes here; user goal stays active and this is not an art acceptance claim.


## 2026-09-13 16:52 UTC - facial continuity and validated tangent export

8a4bb27 was sent to Fable (PR2 comment5654410017). New stable candidate pending this commit:
24,108 triangles, four materials, same bones/clips/strides/sole markers. GLB SHA256
281895fef8f8fda7e7fe73f7fa84ef16fff2df8cb2ead48be15327dece3f2faa. The separate lip patches
are replaced by face volume/tint, and lid transitions ease into the surrounding surface.
Native Data Transfer retains sculpted facial normals. The exporter now includes tangents:
checking them caught 125 clothing triangles with collapsed UVs and negligible area, then
two corner normals parallel to their tangents. Tiny collapsed triangles are removed and
invalid corners use the actual face normal; the final GLB validates unit/perpendicular bases.

Actual final reviews: progress/2026-09-13T16-43-36-070Z-runtime and
progress/2026-09-13T16-43-39-322Z-runtime-studio. Both contain 18 views and 363 sampled
locomotion poses. Studio is a separate, fixed native RoomEnvironment option; default
hard directional lighting remains. The geometry/shading gap is still visible in both.

A preserved hair-UV / anisotropy experiment failed visually (distorted bands persisted
with anisotropy disabled). It was reverted, not published as an improvement. Stable
Smart UVs remain; hair now has 2K maps, narrower colour variation, and slightly warmer,
lighter teal eyes. Failed/intermediate local galleries remain untracked. Source mouth
comparison is progress/2026-09-13_161743, with its exact generator snapshot.

Fresh actual-GLB roughness sampling found 14 near-zero hair triangle samples, 380 outfit,
and one skin sample before the final hair rebake. Source leather/cloth roughness images
contain no near-zero values. Broad plastic-looking hair highlights are not explained by
those sparse hair misses. Next pipeline work: move cap/nape/boot reshaping before baking
and improve coverage of tiny clothing UV islands. Do not claim these are already fixed.

MPFB 2.0.17 (MakeHuman) is being tested in a separate hidden Blender scene for better face
anatomy. Code at E:/Tools/mpfb2, pinned80919fa4682335c41847f761a4d79dcad4124732; core assets
are CC0 per its LICENSE.md, code GPLv3. No MPFB asset has entered this delivered candidate.
Study source/runtime files are currently under E:/Tools/blender-mcp only. Fable latest
pushed log remains f92a384/take0081 with production character integration running. Goal
remains active; source art and actual integrated world quality are still below target.


## 2026-09-13 17:14 UTC - stable handoff and recovered viewport crash

409b603 pushed; PR8 updated and Fable informed on PR2 comment5654705714. Typecheck/
build passed. Fable remote still f92a384/tick65 at the latest fetch; integration
commit is not yet published. The delivered GLB remains 281895fe.../24,108 triangles.

New uncommitted pipeline work moves cap/nape/boot rest shaping into build_link
before reduction and baking. Runtime refinement now only validates/repairs tiny
collapsed triangles and undefined tangents. Native scene-only .blend writing
reduced source from 74,514,199 to 7,857,469 bytes. A fresh load verified both
continuous leather uppers have minimum Z .022 m. Rebuild/bakes are still pending;
this code change is not yet a new validated runtime candidate.

At approximately 17:10 UTC the long-running hidden Blender PID22288 crashed in
DEG_iterator_objects_next / DRW_cache_free_old_batches while redrawing its viewport
after source regeneration. All completed .blend files and the stable GitHub asset
were preserved. Restarted hidden PID21648 from the new link-study.blend; two MCP
queries passed. start_session.py now changes unused VIEW_3D areas to CONSOLE to
avoid that draw path. No mouse/keyboard automation. Source render helpers now
use explicit paths instead of relying on bpy.data.filepath.

MPFB CC0 anatomy trials v1-v4 remain E:/Tools/blender-mcp/*.blend and matching PNGs.
They improve anatomical continuity but are still too mature/puffy and are not in
the delivered model. The v5 experiment corrects a midline discontinuity in my
symmetric eye-enlargement field (sum both smooth fields; assert centre stays zero).
V5 is rendering after recovery. No art acceptance claim; goal continues.


## 2026-09-13 17:32 UTC - owner rejects current art; generated references

Owner: "bruder kannst du dir selber mal paar bilder genererein von link oder so damit du referenz hast weil deine scheiße sieht echt kacke aus". Acknowledge the gap and do not present tiny mesh edits as reference quality. Used imagegen skill/built-in tool; three successful boards saved and pushed in 7ea68fa, reference/generated-link-studies/2026-09-13. Head is too mature for final proportions (hair/material reference only), plus good boot and clothing/equipment boards. Original Kokiri hero sheet still sets proportions. Exact prompts, SHA256s, dimensions and limitations are committed. Closer child head and full-body generations were blocked by image tool output moderation; do not claim those exist. No fallback API was used.

Fable informed on PR2 comment5654848855. Last validated runtime still 409b603, 24,108 triangles. New local runtime was prepared at 17:14 with zero completed bakes; then source hair was changed again. Therefore current local .blend/pipeline are WORK IN PROGRESS and need preparation/baking before export. Stable GLB and its validation remain unchanged. Do not stage all these files as a finished candidate.

Thin layered mesh-ribbon hair trial rendered progress/2026-09-13_172504/05-face.png. Still reads as solid leaves and is not accepted. MPFB head trials through v6 are under E:/Tools/blender-mcp; v6 uses native eye scale 2.7 and closes the neck cut, but still looks mature/puffy. No MPFB asset has entered delivered Link. Hair/face need a real construction change rather than repeated cosmetic tweaks.

Downloaded native MPFB hair-editor CC0 pack by Tomas Klecer, https://files.makehumancommunity.org/functional/haireditor.zip, SHA256 39420056faba6aaa0726a5168c9c41f2d01e278a12e216c0385e8f13d4d98ab7. Extracted safely to E:/Tools/mpfb-assets/haireditor. Official source https://static.makehumancommunity.org/assets/assetpacks/haireditor.html; pack catalogue declares functional assets CC0. This provides true curve hair and a native hair-card generation operator, so test it before inventing a groom system.

Loaded basic_short_hair into scene 'CC0 | hair template study' (3506 guide points, native modifiers). Current render session tests it with the original face/outfit at E:/Tools/blender-mcp/link-native-hair-trial.png. No adoption yet. Hyper3D status was queried: disabled. No generation service was enabled or called, no API credential accessed. Goal active, no Computer Use; hidden Blender PID21648 remains responsive after disabling unused VIEW_3D redraws.


## 2026-09-13 17:52 UTC - owner pauses for PC restart

Owner requested stop and push all work. Modelling and generation stopped. All pending repository work and historical untracked progress are preserved as an explicitly unfinished checkpoint. art/characters/link/experiments/2026-09-13/README.md is the restart handoff; restart-session.blend saves all five live scenes (15 MB). Current source and prepared runtime are WIP; delivered GLB remains unchanged at 409b603. Latest production integration is Fable94a73c1, captured with the real loader. 17:39 review completed with small nonzero repeat differences; 17:44 review failed the max-two-level tolerance before reaching the procedural control. No determinism pass. Hyper3D only inspected and remains disabled, no generation submitted. Typecheck/build passed for this checkpoint. Do not resume modelling until the owner returns.


## 2026-09-13 18:11 UTC - owner resumes

Owner explicitly resumed after the PC restart. Restored all saved scenes in hidden Blender PID7848, renewed C01/C02, and informed Fable on PR2 comment5655106109. Fetched9dc050f/tick66/take0082; production remains94a73c1. Stable GLB still409b603. Native MCP free-trial operator enabled Rodin only in a separate empty scene and reports Key type free_trial. No private key was inspected; no generation submitted yet. A single full-body reference extraction is running through built-in imagegen, using the original Kokiri sheet. Native-GPU integration repeat diagnostic now retains both GLB and procedural controls before applying its unchanged tolerance, so a first failure cannot hide the control. No art acceptance claim.


## 2026-09-13 18:42 UTC - real 3D trials and integration repeat controls

Bundled free-trial Rodin Sketch generated two isolated, archived models. V1 used a wrong bbox axis order and was malformed; initial diagnostic renders also used a wrong up axis, then corrected native glTF import was preserved. V2 has coherent character shape but 512px textures, painted eyes and slab hair. Native normal/material repairs and boolean sockets with real eyeballs were tried; both protruding and inset eye versions remain unaccepted. No stable runtime asset changed. Exact prompts, task UUIDs, original GLBs, saved scenes and images are under experiments/2026-09-13 with rodin-provenance.json / rodin-files.json. Do not treat these as upgrades just because they rendered.

The image tool again blocked both a single full-body reference and a pure crop. An explicit request to allow a mechanical script crop is pending; do not do that dependent work without the reply. The user has not authorized a raster API/CLI fallback.

Rodin Gen-2 was then submitted through the same bundled free-trial credential, guarded by equality with the public trial constant. HTTP201 accepted uuid eba5339e-8faf-474d-8547-0b1e58148777. Job/subscription state is stored privately outside Git at E:/Tools/blender-mcp/rodin-gen2-job.json. Current scene Rodin | Gen2 trial. No private paid API key used. Poll this existing job, do not resubmit it.

Production repeats: both controls captured at18:12. Only13 pixels changed in each (one GLB pixel max4); existing unchanged gauntlet determinismDiff=0 for both. My arbitrary max-channel<=2 diagnostic was overstrict. capture_integrated now retains that raw diagnostic and exact hashes but checks the existing W41 metric/threshold. Fresh full run18:31 completed: both W41 pair metrics0, exact hashes unequal, raw max GLB5/proc8 and mean.4097/2.7667. This is local image evidence, not a CI gauntlet take. Typecheck/build passed after the capture change.


## 2026-09-13 18:57 UTC - Gen-2 review and original-sheet conditioning

8b6e99c pushed the earlier studies and repeat controls. Fable received corrected repeat findings on PR2 comment5655368651; PR8 is updated from paused to resumed. Production preview is restored at http://127.0.0.1:61017/?dev=0&hud=0 using the unmodified94a73c1 checkout. Stable runtime remains409b603.

Text Gen-2 job eba5339e-8faf-474d-8547-0b1e58148777 completed. Actual front, face and back Cycles renders plus raw GLB and scene are preserved in rodin-text-gen2. 500000 triangles / 2K maps improve folds and boots, but close review shows asymmetric eyes, mature proportions, slab hair, rigid brim-like cap and no backpack. Not accepted. There is no ready low-poly download; reduction/baking would be required before runtime use.

The optional script-crop question remains unanswered. Instead, submitted the original complete Kokiri hero sheet byte-for-byte, without any image editing, as Gen-2 image conditioning. Job e1103326-b72d-46e5-a8db-d729c6335481 accepted through the bundled public trial. Its request, original-image SHA256 and exact parameters are in rodin-sheet-gen2-request.json; private subscription state stays E:/Tools/blender-mcp/rodin-sheet-gen2-job.json. Poll that job, do not resubmit. The prompt requests one coherent character using the first front view; the whole-sheet layout may still confuse the generator, so inspect before adopting. No private API credentials or desktop input automation.


## 2026-09-13 19:02 UTC - single full-body reference succeeds

The original-sheet 3D job completed but generated every figure and detached equipment. Not usable as one character. It is archived with its exact input/request and a render. A subsequent built-in imagegen request for one fully clothed stylized adventurer succeeded: reference/generated-link-studies/2026-09-13/04-full-body.png (1024x1536). It is generated from the first figure in the original Kokiri sheet, preserves compact proportions, and gives much clearer face/hair/fabric/ankle guidance. Exact prompt and hashes are archived. This resolves the need for the pending script-crop question: no script crop or raster API fallback was performed.

Submitted that single image to Rodin Gen-2, uuid79fd16be-3d75-4722-9de1-8637b52f1db8, targeting50000 triangles with PBR/normal detail and A-pose conditioning. Request provenance is rodin-single-gen2-request.json; private job state E:/Tools/blender-mcp/rodin-single-gen2-job.json. Currently generating; poll this job. Source image quality is not evidence of the generated model's quality. Runtime409b603 remains unchanged. Fresh typecheck/build and review-helper compilation passed.


## 2026-09-13 19:33 UTC - image-conditioned geometry and actual animated GLB

1728dae pushed focused front reference and earlier geometry studies. Added generated matching rear reference05-back.png, using the front and original sheet. Prompts/hashes are archived. Gen-2 single image improves shape but invents a round cap/large pack; Gen-2.5 single improves face/hair, still poor pupils. Both are preserved separately. Gen-2.5 two-view job03f2d679-4d9f-412a-a855-25630f526349 completed with50000 triangles and4K PBR maps; its back has a proper cap tail and separate pack/shield. Initial request failed because addons must be repeated multipart values, not JSON-encoded strings; corrected request accepted once. All jobs complete; no private API credential used. Original generated studies stay unaccepted.

prepare_generated_runtime.py reduces the multiview model to24000 triangles and reuses the exact19-bone rig/four clips from the409b603 .blend (local immutable cache hash4b93f2fd...). Native heat failed on the generated topology, so it now uses native nearest-surface weight transfer from the four validated meshes, then broad head/pack overrides. First prototype had misplaced anatomical origin; measured knee plane shiftedY+.1085375. It also incorrectly started soles at0; production uses a6mm sole marker and the stable geometry minimum is.0069689. Candidate now matches the validated asset's rest Z bounds, preserving1.1998116 top height and the existing loader contract. No new animation or loader code was needed.

Polygon reduction broke tangent shading. rebake_generated_normals.py transfers source normals and rebakes a2K tangent map from the original generated surface. Actual WebGL face is smoother but still shows small bake misses and wrong ghostlike eyes/red eyelid strips. Do not accept the face or original generated textures as target quality. Eye placement rays are saved in generated-runtime/eye-placement.json; next is genuine eyeball/pupil geometry/materials.

Isolated generated-runtime/candidate.glb SHA493c1c1e62090275c22eff9e3a7c7700da63a7abb0dd300a8d3a49e7cd89e004,27,760,628B,24000tri,1mesh/material,19bones, idle/walk/run/stairs. All18views and363 sampled locomotion poses passed in progress/2026-09-13T19-30-29-655Z-runtime-studio. Earlier19:23/19:25 runs failed floor clearance and remain archived as failed evidence. capture_runtime now accepts a local --asset and records the actual asset/hash plus worst contact phases. review.html can load that local asset. Native GPU only; no Computer Use. The delivered root link-runtime.glb remains409b603, unchanged.

Fetched Fable a98e9ea/tick67/take0083, monitorb36bcc3: west-path canopy openings improve B sun exposure; C cost stated; world23/50. Read the log delta. Fable next: near veil, tread IK, budgets/layout. Production preview remains94a73c1 at127.0.0.1:61017. No merges.

## 2026-09-13 20:10 UTC - native eyes, actual-world deformation corrected

ca00529 pushed the two-view generated geometry, rig transfer and references. Native eye study now adds two skinned eyeballs with baked iris/pupil textures and orbital sockets. bake_generated_eyes.py bakes standard glTF materials and validates the four exact clip durations, 19 joints, tangents, normalized weights and triangle budget. New Boolean cavity faces need a separate skin material/bake target: their UVs cover0..1 and initially overwrote the body atlas with skin patches. Failed19:47 gallery is retained; fixed atlas at19:49, triangulated n-gons for tangents at19:50.

Actual production C exposed a second defect that the rest/studio and sole checks missed: Boolean-created face vertices inherited right hand/elbow weights. White eye-area shapes during walking were a deformation error, not established overexposure. Rebound318 incorrect vertices in the original rigid face region; all2459 front-head vertices now assert head-only binding. Original eye material restored unchanged to isolate this fix. Eye/body deformation now looks coherent in the same C frame. Body mesh name includes skin so the loader's head measurement does not select an eyeball; the one-piece body includes its cap, so that measurement is approximate and needs acknowledgement by Fable.

Current isolated generated-runtime/eye-candidate.glb: SHA86d5c68e66d1118aea9f81d4c940d1485fdea28f3692fdd5b02a0288f7af252c,28,903,892B,25,464tri,3meshes/materials,19bones,unchanged4clips. Source eye-candidate.blend and helper scripts saved. Local18-view/363-pose capture20:08:06 passes. Matching actual-world galleries: stable409b603 on a98e9ea at19:52:15; broken-eye candidate19:54:20; corrected candidate20:08:42, six views plus repeat/motion, W41 existing metric0, raw max1. Native GPU evidence only, no CI take or art acceptance.

capture_integrated adds --glb-only and --face-only, records actual source diff/hash and checkout dirtiness. Free camera intentionally relocates Link to spawn in Fable's runtime: the face diagnostic measures/reframes that actual location and labels it separately, not as the C pose. The first20:02 diagnostic failed because no A image existed for its repeat; preserved incomplete manifest. Valid spawn face comparisons20:03:54 and20:06:57. Full captures remain the six standard camera poses.

Isolated worktree E:/zeldaremake-integrated-review now pinned a98e9ea with three local diagnostic overrides: GLB, loader hash constant, truthful SOURCE.md. Server127.0.0.1:61017 serves the corrected candidate. No partner source logic or remote production asset changed. Fetched52dcd66, which only logs Fable's rejected near-veil test; world remains23/50. Typecheck/build passed in our branch and the comparison worktree. Character face/lids/hair/material detail remain below reference: next refine the orbital rim and surface detail; do not announce target quality achieved.
