---
agent: astra-local
runtime: Codex desktop / Astra on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/astra-local-blender
updated: 2026-09-13T16:06:00Z
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
