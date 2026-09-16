---
agent: astra-local
runtime: Codex desktop / Astra on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/astra-local-blender
updated: 2026-09-16T01:30:28.534954+00:00
---

# astra-local — roster entry

Front-matter mirrored by fable-cursor from Astra's PR #2 check-in of 2026-09-14 15:13 UTC
(issuecomment-5666221597; front-matter refreshed from issuecomment-5675328913 and -5675476620, 2026-09-15 05:40 / 05:55 UTC) so the Director's Monitor crew card lists her local session; her own
log lives on `agent/astra-local-blender` (`.agents/astra-local.md` there). Astra: send updated
front-matter on PR #2 and it is copied here at the next publish — nothing else in this file is
edited by anyone but you.

## Current task
Native780M trace complete,2700steps1280x720: rendered step median69.5ms/p95100.2, render submission56.4ms, triangles median7.89M. CPU-only median2.6ms/p957.0. Shared script --native adds D3D11 pipes and actual GPU identity; no route changes. Full traces in2026-09-15-native-performance. Fable owns render-budget/W35/blink fixes; continuing native side-hem repair.

Local round37 integration reviewed: descent f594 -21.95->-1.62mm, peak19.65mm; ascent exact, flat max0.479um difference. Six native GPU views complete, repeat delta2/tolerance pass. Typecheck/build/gaitChain/anti-cheat pass (capture anti-cheat portion not run). Integration published as draft review evidence; B/E W35 repair still required for acceptance. Combined character322c3433 is already pushed in d97f586 for character-8.

Combined delivery322c3433 retained and ready for Fable character-8: hem+331 sleeve weight fixes+reviewed blink shapes. All1620 player records match e5882cc5; morphs exact to1e7074e7. Fable7b8e35b/ddfb652 fetched with descent correction and performance work, local integration next; known B/E W35 follow-up pending.

Rear hem asset e5882cc5 retained: 312 local weight fixes, target stretch 19.14x to 1.72x, all 1620 gameplay records unchanged. Next: left-sleeve weight discontinuities. Blender reopened hidden PID29512 after process disappearance; preview PID35620 port61017.

Brow positioning d5213ba7 pushed in ee2fd6b: corrected fibres crossing hair, thinner cross-sections; 36 game records exactly match parent, build/typecheck and exported-data checks pass. Eyelid/pupil pass68e2a19 passed both CI runs. Native staged blink1e7074e7 is available as a separate integration candidate with blink/blinkHalf morphs, 30-frame60fps timing review, zero eye-overlap pairs at five poses, unchanged base geometry/clips/textures. Runtime integration remains with Fable. Details and candidate are under art/characters/link/progress/2026-09-15-brow-blink-review.

## Files / systems being touched
`public/models/link/**` (character asset candidates, local only while release rights are open),
`art/characters/link/**` on her branches; runtime character code stays with fable-cursor.

## Completed work
- PR #9 (`742cb26`): Link 9189538d, taken by hand as `ad01908`.
- PR #10 (`a920d90`): eye-only candidate 6f28903d — draft, held pending the asset-licence review.
- Movement review harness (`capture_play_motion.mjs`, PR #8) — the acceptance fixture for
  character-5 (`cbfddb9`).


Shoulder follow-up: retained 39a55c95 after four-gait, 22-view studio and 300-frame gameplay comparison. Only 192 skin-weight positions change; all other exported attributes, clips, binds, images and blink shapes preserved. Typecheck/build pass. Evidence: art/characters/link/progress/2026-09-16-upper-seams-review. Fable owns the pending blink-transition and environment improvements; broader visual quality remains unfinished.



2026-09-15T23:23:30.167455+00:00 — Retained run75f42cd2, lift0.065m/pitch0.25rad.1620gameplay checks complete;1320stair records exact to round37 baseline. Flat maxverticalstep10.13to7.52mm; minshoe gap-9.1to-8mm. Native stance/loop/clearance pass. Otherclips/restassets preserved. Evidence2026-09-16-run-low-arc-review. No active jobs. Cloth/face/environment quality unfinished.


2026-09-15T23:52:45.110587+00:00 — Retained face0c28cb62: localized nose normal bake +391 mouthcorners. Zero bakepadding resolveslipartifact. Native preservation and GLB checks pass;36game records exact,5blink phases pass;openclosedimagesreviewed. Evidence2026-09-16-nose-shading-review + neutral-mouth-review. Current asset updated; eye/cheek/hairquality unfinished. No active jobs.


2026-09-16T00:24:17.130970+00:00 — Retained alert eyelid3f6cb6f3:774positions,aperture19.93to23.23mm,closedendpointpreserved.21nativephases noeyeoverlap/triangleflip.36gamerecordsexactto0c28;5blinkphases/zerodtpass;openhalfclosedimagesviewed. Evidence2026-09-16-alert-eyelid-review. Otherface/hair/clothqualityunfinished. Noactivejobs.

2026-09-16T00:36:00Z — Pushed alert eyelid 3f6cb6f3 as 9c66fa8 / PR10 after typecheck/build. Fable handoff comment 5690201680; remote adeaa71 is a heartbeat, 8b/W35/perf still pending. Blender healthy. Native curved closure candidate created from alert eyelids: 687 vertices, 1.5 mm arc, unchanged neutral face, 21 phases zero eye overlaps or relative triangle reversals. Half/closed renders viewed; subtle improvement only, vertical ridges unresolved. Not exported/promoted. Evidence: progress/2026-09-16-curved-closure-review. No running render/capture jobs. Next compare curvature in-game before considering retention; continue larger hair/face/cloth gaps.

2026-09-16T00:45:54.509415+00:00 — Integrated Fable character8b from af5ede8 with latest 3f6cb6f3 asset. Native tests/typecheck/build pass; actual quick-release blink fixed (frame6 idle phase1, then smooth opening to0 byframe14). Matched tone-b A/B has identical36movement/24rapid records. Rejected tone-b sharpening/blur locally: exaggerated face seams/hair edges. Retained previous postfx, W35 still pending. Evidence2026-09-16-blink8b-review. Curved lid candidate9332ca34 tested in-game, not promoted: ridges remain. No active jobs.

2026-09-16T00:55:14.437297+00:00 — Retained blink normal field 17d18d15: visible closed-lid ridges substantially reduced in game/studio. Only morph NORMAL accessors change; all original binary bytes and rest attributes/positions preserved. 36 game records exact to previous asset; 18 studio views + five blink phases pass. Four full-closure native self-intersections remain, so geometry is not fixed. Native source has required export post-process metadata. Fable latest c5fb83e/take0105/perf dispatch observed. Git auto pack process36044 still live BelowNormal; capture/render jobs done.

2026-09-16T01:03:59.655221+00:00 — Retained corner separation4741cf3e atop17d18d15.17nativevertices max.096mm;41phases zero self/globe contacts;21phases no relative triangle reversals. Original binary/animatednormals retained; only new morph POSITION accessors. Game36records exact;5blink phases pass;closedimage reviewed. Evidence2026-09-16-corner-separation-review. Claims C01/C02 renewed01:01:23UTC to04:01:23. No active capture/render jobs. Git pack36044 still running BelowNormal.

2026-09-16T01:11:29.984276+00:00 — Native lower-run lateral tunic study on current4741cf3e:1172weight positions, all sampled front contacts reduced (455/1429/350/1335/455 to430/1233/347/1243/430), four-gait48pose checks pass, run severeedge samples714to327. Matching frame26renders viewed: modest gain; major belt bunching/thigh exposure remains. Not exported/promoted. Evidence2026-09-16-lower-run-lateral-review, candidate lower-run-lateral-study.blend; nativeweight patch saved. No Blender/capture jobs active. Fable handoff still latest4741cf3e/73ccdc0.

2026-09-16T01:18:08.603309+00:00 — Remaining shoulder seam native candidate on4741cf3e: 202weight positions, three measured shoulder/chest boundaries. Targetedrunstretch15.87to2.77; broader717edge fourgait check passes (runpeak15.87to9.35, severe samples1614to84). Frontframe0 renders reviewed, modest gain. Saved remaining-shoulders-study.blend/evidence2026-09-16-remaining-shoulders-review; not exported or promoted, needs rear/side/game views. Fable a9ef29f adopted4741cf3e and9c70c3c reverts tone-b; acknowledged PR2. No active render/capture/gitpack jobs.

2026-09-16T01:30:28.534954+00:00 — Retained shoulder55cc8ef3:202nativepositions/586exportvertices, only9290joint-weight bytes differ. Rest/binds/clips/blinknormals preserved. Native baseline roundingmax9.35e-5 recorded. Corrected rear comparison aspect800squarevs720x820; bones exact, matched renders inspected. Game01-26-08 passes300samples identicalto23-16-09 baseline; runframe152viewed,150frame movieencoded/validated. Evidence2026-09-16-remaining-shoulders-review. Noactivejobs. Otherhem/face/hairqualitystillunfinished.
