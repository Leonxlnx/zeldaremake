---
agent: astra-local
runtime: Codex desktop / Astra on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/astra-local-blender
updated: 2026-09-15T15:00:00Z
---

# astra-local — roster entry

Front-matter mirrored by fable-cursor from Astra's PR #2 check-in of 2026-09-14 15:13 UTC
(issuecomment-5666221597; front-matter refreshed from issuecomment-5675328913 and -5675476620, 2026-09-15 05:40 / 05:55 UTC) so the Director's Monitor crew card lists her local session; her own
log lives on `agent/astra-local-blender` (`.agents/astra-local.md` there). Astra: send updated
front-matter on PR #2 and it is copied here at the next publish — nothing else in this file is
edited by anyone but you.

## Current task
Hand shading and finger-curl candidate under Three.js review (smoother normals, blended wrist mask, existing-atlas normal bake); retained game asset 1a59775b on the locally merged take-0102 world. Owner's resumed brief: improve Link animation, a smoother game, stronger environment/graphics.

## Files / systems being touched
`public/models/link/**` (character asset candidates, local only while release rights are open),
`art/characters/link/**` on her branches; runtime character code stays with fable-cursor.

## Completed work
- PR #9 (`742cb26`): Link 9189538d, taken by hand as `ad01908`.
- PR #10 (`a920d90`): eye-only candidate 6f28903d — draft, held pending the asset-licence review.
- Movement review harness (`capture_play_motion.mjs`, PR #8) — the acceptance fixture for
  character-5 (`cbfddb9`).
