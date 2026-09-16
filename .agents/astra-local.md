---
agent: astra-local
runtime: Codex desktop / Astra on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/astra-local-daylight
updated: 2026-09-16T11:48:47.6387702Z
---

# astra-local — roster entry

Front-matter mirrored by fable-cursor from Astra's PR #2 check-in of 2026-09-14 15:13 UTC
(issuecomment-5666221597; front-matter refreshed from issuecomment-5675328913 and -5675476620, 2026-09-15 05:40 / 05:55 UTC) so the Director's Monitor crew card lists her local session; her own
log lives on `agent/astra-local-blender` (`.agents/astra-local.md` there). Astra: send updated
front-matter on PR #2 and it is copied here at the next publish — nothing else in this file is
edited by anyone but you.

## Current task
Hand candidate d221c8c1 in the local playable preview (relaxed finger curl, smoother surfaces; clips/weights/binds exact); take-0103's world (dc7da4d) merged locally; a cloth-weave atlas candidate under surface/motion review. Next: face/cloth and animation weaknesses. Owner's resumed brief: improve Link animation, a smoother game, stronger environment/graphics.

## Files / systems being touched
`public/models/link/**` (character asset candidates, local only while release rights are open),
`art/characters/link/**` on her branches; runtime character code stays with fable-cursor.

## Completed work
- PR #9 (`742cb26`): Link 9189538d, taken by hand as `ad01908`.
- PR #10 (`a920d90`): eye-only candidate 6f28903d — draft, held pending the asset-licence review.
- Movement review harness (`capture_play_motion.mjs`, PR #8) — the acceptance fixture for
  character-5 (`cbfddb9`).

2026-09-16T11:38:09.7230159Z — Owner directs11:35–13:35UTC environment/light/shadow pass; character paused. Isolated agent/astra-local-daylight fromFable f3314dc2/take107,24591126 alreadyadopted. ClaimsW30/W31/W32/W34 until14:36UTC. Fable notified5696785143. Scope sky.ts,heightfog.ts,lighting/config ifvalidated; trees/vegetation remainFable. Main differences beforecoding: fixedgrey-yellow sky lacksvisibleblue/altitude gradient; heavyfarveil flattensspatialdepth; warmfillandkey weakenslit/shadowcolour separation. Baseline native6viewcapture running fromprimaryhelper. No defaultsourceedits yet. Heartbeat umgebung-licht-und-himmel-2-stunden until13:35UTC continuesboundedwork. Node modulesjunction existingdependencies. Goalnotcomplete.

2026-09-16T11:48:47.6387702Z — Daylight pass01 in source: blue sky[.17,.36,.65], ramp.55, halo.65; cooler sharedfog with density.018/fardensity.055 andlowerglare; sun3.7/hemi.82/environment.3, configuredcoolhemi. Baseline7views11-43-50 anddefault7views11-45-14 captured; shaderoverridecandidate matchesdefaultmetricstable. Baselineearliercandidate11-39 A hadloadingoverlay, excluded fromreview. NativeGPU performance A median41.3ms20frames, no FPSclaim. Benchmark2048shadow running. Fable reserved scope in reply at11:37:05; leavepostfxsoftening andshadowcull/perfFlags intact. Added ZR_NATIVE_GPU=1 optin tosharedbrowserhelper, WindowsD3D11only, defaultCIstillSwiftShader. Allproductionedits remainlighting/sky/fog/config. ComparemetricsSSIMdeclinesperviewwithbluepalette, sharpnessincreases, overexposed0. Evidenceart/environment/daylight-pass-01. Need commit/pushdraft/take; workcontinuesuntil13:35UTC.
