# Restart checkpoint — unfinished and visually rejected work

The owner requested an immediate pause and push before restarting the PC. No further
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
