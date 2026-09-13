# Restart checkpoint — unfinished and visually rejected work

Preferred next comparison: `source-runtime/hardware-candidate.glb`,
SHA256 `faefa7211a70c0da647fb869b1cef4af4edba7c52be965ce01bcacfdeb22214b`.
It adds baked brass response to six existing boot fittings, retaining the iris candidate's
54,786 triangles, three materials and existing rig/clips. Studio 23:44:54 and full
a98e9ea world comparison 23:45:34 complete their local checks. The prior iris handoff is
`source-runtime/iris-material-candidate.glb`, SHA256
`cfc48d365699bd9310b7b10d8584b2248529eca6d69874bdf696859632a567a6`.
The previous53K handoff is `source-runtime/eye-candidate.glb`
from97d0ad0, SHA256 `4e0b3a217495e7db98ff842a71e701eb5f6e6c535120449889da52971712c400`.
Hair-bake, added lid surfaces and scanned-material studies remain unaccepted.
Do not replace the handoff merely because a newer file exists.

At22:34 UTC, native lattice and neighbouring-skin UV studies are also archived.
`lid-fit-candidate.glb` (f4b41844...) and `orbital-uv-candidate.glb` (b93852a4...)
retain54,786 triangles,3materials and the existing rig/clips. Both complete their
studio and six-view actual-world checks. Hard socket joins remain visible, so neither
replaces the preferred iris handoff. `eye-seating-study` is visibly rejected and
not exported. Exact hashes/results are in their validation files and Astra's log.

At23:17 UTC, `connected-lid-candidate.glb` (968ec082...) completes studio23:01:15
and actual-world23:04:37 at58,282triangles/4materials. The connected topology removes
folded lid quads, but the resulting lids are too full and skin joins remain visible.
It also stays unaccepted. The79e3343b wrong-UV export is explicitly rejected: preserve
UV names across edit-mode changes, then assert the exported lid texture uses UV1.

The official Microsoft TRELLIS.2 head test generated against unchanged reference06,
then its GLB export was rejected at the anonymous GPU quota. No head was downloaded.
Use E:/Tools/trellis-client/Scripts/python.exe for trellis_head_trial.py. Its private
on-disk guard prevents duplicate submissions; inspect the existing job before doing
anything further. No private HF token, paid endpoint or background-editing service is
used. Check trellis-head-request.json for the recorded current status, not this note.

At 23:47 UTC, `face-smooth-candidate.glb` (5a9969f1...) is also unaccepted. A native
normal-map on/off diagnostic shows that the source map compensates for flat mesh normals.
The separate local normal smoothing/4K normal bake softens the mouth and still exposes
angular nose shading in the actual WebGL review; it does not replace the preferred asset.
Repeated export now skips normalization of already-normalized skin weights, eliminating
tiny repeated rounding changes. The final hardware export is byte-identical on repetition.
The earlier ef75d97b export remains `hardware-first-export.glb` for its historical captures.

**Resumed 18:08 UTC with the owner's explicit instruction.** The pause notes below
describe the saved restart checkpoint. New Rodin studies and native material/eye
experiments are listed in `rodin-provenance.json` and `rodin-files.json`; all remain
unaccepted. The delivered game GLB is unchanged. The newer integration capture uses
the existing W41 image metric; exact native-GPU screenshot hashes remain unequal.

At19:33 UTC, all Rodin jobs are complete. The newest isolated `generated-runtime/candidate.glb`
uses the two-view Gen-2.5 geometry, reduced to24K triangles, and the validated409b603
rig/clips. Its actual18-view WebGL review and363 sampled locomotion poses pass; face,
eye and material quality remain unaccepted. This file is separate from the delivered
runtime. See `.agents/astra-local.md` for exact hashes, failed trials and current state.

To reproduce that candidate, load the `rodin-text-multiview-gen25/review.blend` scene
in the hidden Blender session. `prepare_generated_runtime.py` also needs the exact
409b603 `art/characters/link/link-runtime.blend` cached as
`E:/Tools/blender-mcp/link-runtime-409b603.blend` (its hash is asserted). Run prepare,
then `rebake_generated_normals.py`, then
`node art/characters/link/capture_runtime.mjs --asset experiments/2026-09-13/generated-runtime/candidate.glb --studio`.
The scripts intentionally reject overwriting an existing in-memory candidate; preserve
manual edits before clearing that generated scene. Original studies remain separate.

At20:10 UTC, `generated-runtime/eye-candidate.glb` adds native eyes and repaired orbital
weights. SHA256 `86d5c68e66d1118aea9f81d4c940d1485fdea28f3692fdd5b02a0288f7af252c`.
The25,464-triangle candidate passes18 studio views,363 sampled poses and a full actual
production-loader comparison on Fable a98e9ea. Reference quality is not achieved.
Open `eye-candidate.blend` for the current scene; `refine_generated_eyes.py` constructs
the study from the base scene, then `bake_generated_eyes.py` prepares/exports it.
The latter also repairs Boolean face weights, checks head-only binding and prevents
socket UVs from overwriting the body colour atlas. Exact history and failed evidence
are recorded in `.agents/astra-local.md`.

At20:41 UTC, `source-runtime/eye-candidate.glb` preserves the original50K geometry
(51,440 triangles with native eyes). It avoids reduction and restores original
triangle-corner normals after the Boolean cuts. Current SHA256
`00989528b44019ba9340e6da2c0c6f0b4c79d133a472c4cec31db5e238a41a45`.
Studio18views/363poses pass; world comparison is pending. Use `preserve_source:true`
with prepare/refine, then `restore_source_normals.py`, then bake with
`scene:"Link | source eye study",folder:"source-runtime"`.
The separate lid-runtime folder contains unaccepted ring/normal-bake experiments;
the fitted-cage image is visibly rejected despite a better normal-pixel metric.

At20:50 UTC the source candidate adds0.9mm rounded orbital edges: SHA256
`4e0b3a217495e7db98ff842a71e701eb5f6e6c535120449889da52971712c400`,52,946triangles.
Both studio and the full Fable a98e9ea world comparison pass their technical checks.
Latest world gallery: `progress/2026-09-13T20-45-58-203Z-integrated`.
The separate eye-depth study is still unaccepted; the exported candidate is unchanged by it.

The historical pause checkpoint follows. The owner requested an immediate pause and push before restarting the PC. No further
modelling or external generation should start until the owner resumes the task.

- Last validated runtime: commit 409b603, GLB SHA256
  `281895fef8f8fda7e7fe73f7fa84ef16fff2df8cb2ead48be15327dece3f2faa`.
- Three generated reference boards and their exact prompts: commit 7ea68fa,
  `reference/generated-link-studies/2026-09-13`. The head board is too mature;
  the original Kokiri hero sheet still sets proportions.
- Current source/pipeline are unfinished: rest shaping moved before baking, scene-only
  saves introduced, then a rejected thin ribbon hair trial changed the source again.
  Current runtime preparation is stale and has zero completed bakes. Prepare again
  before baking; do not replace the validated GLB with this state.
- `restart-session.blend` preserves all five currently loaded scenes, including native
  curve-hair and MPFB v5/v6 anatomy studies. These are separate rejected studies, not
  approved replacements. Hair trials are either too short or a long straight curtain;
  anatomy studies still have mature/puffy features and poor eye/neck transitions.
- MPFB 2.0.17 core anatomy is CC0, code GPLv3, pinned upstream commit
  `80919fa4682335c41847f761a4d79dcad4124732` at https://github.com/makehumancommunity/mpfb2.
  Native curve hair is from Tomas Klecer's CC0 functional hair-editor pack:
  https://static.makehumancommunity.org/assets/assetpacks/haireditor.html.
  Download https://files.makehumancommunity.org/functional/haireditor.zip,
  SHA256 `39420056faba6aaa0726a5168c9c41f2d01e278a12e216c0385e8f13d4d98ab7`.
  No MPFB or downloaded hair has entered the delivered runtime GLB.
- Fable's actual production integration is 94a73c1 in clean local checkout
  `E:/zeldaremake-integrated-review`. Typecheck/build passed there. The production
  loader and procedural fallback both loaded in the 17:39 native-GPU review.
  `progress/2026-09-13T17-39-00-856Z-integrated` has twelve standard views plus a
  repeat and motion image. Its repeat is NOT byte-identical (max channel difference 1).
  The later 17:44 repeat exceeded the diagnostic tolerance and stopped before the
  procedural control. Cause remains unknown; no determinism pass is claimed.
- All previously untracked progress folders are archived in this checkpoint at the
  owner's request. `archived-progress.json` lists them. Some are partial/failed trials;
  inclusion does not make them successful tests or accepted art.
- Hidden Blender recovered after a viewport crash. `tools/blender/start_session.py`
  disables unused VIEW_3D draws by switching them to CONSOLE. Native MCP now appears
  in the tool catalogue. No mouse/keyboard automation was used.
- Hyper3D was only inspected. It remains disabled; no free trial was activated, no
  generation submitted, and no private API credential used.

After the owner resumes, load this saved session or the intended individual .blend
through the existing hidden Blender startup script. Blender is installed at
`E:/Apps/Blender/blender-4.5.13-windows-x64/blender.exe`; MCP/runtime remains under
`E:/Tools/blender-mcp`. The old browser preview on port 54075 was an appearance overlay,
not the new production checkout. Restart local preview servers as needed.
