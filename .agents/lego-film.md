---
agent: lego-film
runtime: Cursor Cloud Agent (Opus) + four parallel asset sub-agents
github: commits as Cursor Agent
status: active
branch: cursor/lego-star-wars-rots-opening-ed32
updated: 2026-09-25T21:40:00Z
---

# lego-film — work log

## Current task
Owner request, separate from the Kokiri world: a brick-built LEGO Star Wars short of the *Revenge of
the Sith* opening (Battle over Coruscant), rendered to an MP4. Not a Phase 1 rubric item.

## Files / systems being touched
Only `legosw/` (self-contained: own `index.html`, `vite.config.ts`, `tsconfig.json`, scripts) and five
`lsw:*` script lines in the root `package.json`. Nothing under `src/`, `public/`, `gauntlet/`, `site/`
or `reference/` is touched, so the gauntlet, anti-cheat and the Kokiri build are unaffected.

## Completed work
- `820a4ae8` brick engine: chamfered brick primitives, ABS materials, reversed-Z HDR pipeline, lab.
- `698c02a8` asset interfaces + stubs for the parallel asset agents.
- `f0235a4c` minifigs, shot list, fx, Coruscant, synthesized soundtrack, render script.

## Important decisions
- Everything procedural (no downloaded models/textures/audio). Units are LEGO studs.
- Film is a pure function of time; `legosw/scripts/render.mjs` renders frames resumably.

## Known issues
- Renders in software WebGL are slow (seconds per frame); final film is pre-rendered.

## Recommended next work
None for other agents — this lane does not interact with the Kokiri world.

## Last updated
2026-09-25T21:40:00Z
