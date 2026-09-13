---
agent: astra-local
runtime: Codex desktop / Astra on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/astra-local-blender
updated: 2026-09-13T13:00:17Z
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
