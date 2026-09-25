---
agent: opus-cinematic-b
runtime: Claude Code (Opus 5.5) on the owner's laptop, native GPU through capslot
github: Leonxlnx
status: finished
branch: agent/opus-cinematic-b-sept25
updated: 2026-09-25T05:00:00+02:00
---

# opus-cinematic-b — work log

## Current task
Done: the owner's 30–40 s cinematic trailer of the phase1 world for X (brief of 2026-09-25). The film, poster,
contact sheet, verification and README are in `art/environment/opus-cinematic-b-sept25/`.

## Files / systems being touched
- `art/environment/opus-cinematic-b-sept25/**` (new): the recorder, assembly, review tools, soundtrack pipeline, shots and the film
- `src/world/character/{glbLink,animation}.ts` and `public/models/link/{link-runtime.glb,SOURCE.md}`: copied unchanged from `agent/opus-cinematic-sept24` @ 991de9bb
- `src/world/character/index.ts`: only that branch's Navi hover change
- Raw frames and intermediates live in the git-ignored `gauntlet/out/opus-cinematic-b-sept25/`

## Completed work
- 2ef05b06: Link's repaired play-mode motion on the phase1 base; typecheck and build green.
- The trailer commit on this branch: the film, the recorder and pipeline changes, and the review evidence summary (see the folder README).

## Important decisions
- **Resolution.** Native 1920×1080, the size the world's point sprites, grass rings and LOD bands were tuned at. A full 1080 frames takes about 25 min on the 780M. 4K was not rendered.
- **Hiding without recompiles.** Every shot hides the kids, and camera shots also hide Link and Navi. This is done by hiding their drawables and dimming their lights for the render call only (record.mjs), so the light count never changes and no program recompiles between shots. Toggling the groups cost 4–5 min per switch.
- **Persistent Chrome profile.** The recorder keeps its own Chrome profile, so the GPU shader cache survives between runs (boot 264 s → about 170 s).
- **Per-shot `hide`.** Shots can hide named objects through the composer's own `__ATMO_HIDE__`: `butterflies` (a butterfly at the low walk lens), `falling-leaves` (a leaf on Link's hood on the stairs) and `signpost-runes` (the sign's rune lettering, which read as Latin text).
- **Stair start.** The stair start was chosen by a start-offset search over the step logs: +5 cm puts all 11 stances on their treads, with gaps of 0.0–1.1 mm.

## Known issues
- **Stair riser shading.** Every riser shows a harlequin triangle split (hardscape). Filed as a separate task; not changed here.
- **Distant canopy cards.** Far canopy cards are smeared at the grove's back, and some far trunks have pale cut-off tops in the fog.
- **Navi's core.** It reads as a hard disc close up.
- **Grove sign.** The grove signpost's runes and the north signs would need the same hide if framed. `__ATMO_HIDE__` hides only the first object with a given name.

## Recommended next work
- Fix the stair riser facet shading in `src/world/hardscape` (owner of hardscape).
- A 4K master is possible with the same `shots.json` (`--size 3840x2160`, about 4× render time, split with `--only` under 45 min per capslot job). Point sprites and grass rings would need retuning for 4K first.

## Last updated
2026-09-25T05:00:00+02:00
