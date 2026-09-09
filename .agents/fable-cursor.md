---
agent: fable-cursor
runtime: Cursor Cloud Agent (Claude Fable 5.1, 1M context) + parallel sub-agents
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: cursor/kokiri-world-phase1-f65e
updated: 2026-09-09T09:10:00Z
---

# fable-cursor — work log

## Current task
Bootstrapping the whole Phase 1 foundation in one branch so the second agent can join safely:

1. Vite + Three.js r186 + TypeScript scaffold with frozen module contracts
   (`src/world/system.ts`, `layout.ts`, `terrain/heightfield.ts`, `wind/wind.ts`, `capture/api.ts`).
2. Collaboration protocol (`AGENTS.md`, `.agents/`, `PROJECT_STATE.md`, `INBOX.md`).
3. The Gauntlet: 50-item rubric (`gauntlet/rubric.json`, hash-locked), loop (`GAUNTLET.md`),
   anti-cheat + capture/compare/score/take tooling, CI workflows.
4. The Director's Monitor live site (`site/`) — hourly before/after takes on GitHub Pages.
5. First real content passes on every world system via parallel sub-agents (terrain+hardscape,
   trees, vegetation, structures, atmosphere+lighting), then integration + reference-comparison
   loop iterations.

Rubric targets this session: W01–W42 first passes; hard focus on W02 (stairs), W03 (flagstones),
W08/W09 (trees), W15 (grass), W25/W26 (house + lanterns), W30–W32 (light + haze), W37 (shot match).

## Files / systems being touched
Everything under `src/`, `gauntlet/`, `site/`, `reference/`, `.github/`, root docs — this is the
bootstrap. Once this branch is up, ownership follows the map in `AGENTS.md`. Sub-agents each own
one `src/world/<system>/` directory and do not touch the others.

## Completed work
- Scaffold renders all 6 saved viewpoints headlessly (SwiftShader) in ~20 s; capture API + audit
  rollup working (`gauntlet/scripts/capture.mjs`).
- Reference clip analysed frame by frame; layout authored to the four hero shots
  (`src/world/layout.ts`, `reference/manifest.json`, `reference/frames/`).
- 50-item rubric written and locked; `rubric-lock.mjs --check` passes.
- (commits listed in PR once pushed)

## Important decisions
- **Units/axes:** metres, +Y up, +X east, −Z north. Plaza = origin. Camera eye ≈ 1.75–1.9 m.
- **Sun:** azimuth −128°, elevation 34° (light from WNW-high, i.e. behind-left of shot A) — measured
  from shadow direction on the plaza in frames 1/14/24. Match before "improving".
- **Fog:** cool blue-grey `#c5d1cf`, near 28 / far 190, plus a separate ground-mist layer. Fog is
  NOT allowed to hide unfinished terrain (rubric W32 + depth-histogram check).
- **Determinism:** `createRng` everywhere; capture mode fixes sim time at 12.5 s before each shot.
- **Stairs:** 18 steps, rise 0.30, tread 0.42, width 2.7 (counted on frame 1 / crop). Direction
  (1, −0.35) from base (7.5, 0, −1.5).
- **Textures:** CC0 only, `public/textures/<set>/{color,normal,roughness,ao,height}.jpg`, 1K–2K,
  credited in `public/textures/CREDITS.md`.
- **Takes** live on the orphan `monitor` branch (append-only), never in feature branches, so two
  agents cannot conflict on take data.

## Known issues
- All world systems are placeholder massing until the sub-agent passes land (this session).
- Far hills are one low-res mesh; distant layering is the atmosphere agent's job.
- The first capture of a fresh page sometimes returns a black frame before shaders finish
  compiling — `capture.mjs` needs the variance-retry guard (tooling task).

## Recommended next work (for the second agent)
Pick anything NOT claimed in `gauntlet/claims.json`. Good self-contained candidates:
- `src/world/rocks/` — hero boulders with ridged displacement, cracks, moss, scree (W23, W24).
- `src/world/postfx/` — SMAA/TAA-quality AA, SSAO/GTAO, restrained bloom for lanterns (W35, W36).
- `src/world/trees/distant.ts` — 400+ LOD'd far trees for horizon layering (W13).
- Reviews: file visual verdicts on my takes (`npm run gauntlet -- --review …`) — I cannot review
  my own (GAUNTLET.md D7).

## Last updated
2026-09-09T09:10:00Z
