---
agent: lego-film
runtime: Cursor Cloud Agent (Opus) + parallel asset sub-agents
github: commits as Cursor Agent
status: active
branch: cursor/lego-star-wars-rots-opening-ed32
updated: 2026-09-26T12:10:00Z
---

# lego-film — work log

## Current task
Owner request, separate from the Kokiri world: a brick-built LEGO Star Wars short of the *Revenge of
the Sith* opening (Battle over Coruscant), rendered to an MP4. Not a Phase 1 rubric item.

v2 cut (owner review of the first cut, ten points): no glitching ships, a real Coruscant, more detail on
the Venator and both interceptors, an audible soundtrack with music, Anakin smiling from the first
frame, every shot aimed at a real ship that blows up, better hair and prints, buzz droids crawling,
the Jedi flipping out of their fighters, bluer sabers. Final 720p render with motion blur running.

Pass 4 (owner, 26 Sep 10:37 UTC: "make it look spectacular, every inch of the Venator one of one, better
ships, seamless angles and animation, stunning backgrounds"): lens/camera/animation work on this branch;
Venator, ship and background upgrades in parallel worktrees, integrated into one commit for the final
render (all 2335 frames from that commit, gated by `final-v5.sh`).

## Files / systems being touched
Only `legosw/` (self-contained: own `index.html`, `vite.config.ts`, `tsconfig.json`, scripts) and five
`lsw:*` script lines in the root `package.json`. Nothing under `src/`, `public/`, `gauntlet/`, `site/`
or `reference/` is touched, so the gauntlet, anti-cheat and the Kokiri build are unaffected. The WIP
site is published to its own branch, `cursor/lsw-wip-site-ed32`.

## Completed work
- `820a4ae8` brick engine: chamfered brick primitives, ABS materials, reversed-Z HDR pipeline, lab.
- `698c02a8` asset interfaces + stubs for the parallel asset agents.
- `f0235a4c` minifigs, shot list, fx, Coruscant, synthesized soundtrack, render script.
- `7ab8609f`..`c69bfd61` hero interceptors, Venator, ARC-170, Invisible Hand + hangar, frigate, vultures,
  tri-fighters, missiles, buzz droids, battle droids; `d3397310` WIP site generator. First cut (17 shots).
- v2: `e35318fa` battle system (`film/battle.ts`: duels with scheduled kills, turbolasers from real
  turrets onto real hulls), crawling buzz droids, jump-out flips, motion blur + Halton-jittered AA on
  every shot; `3f120b5a` deep-blue sabers; `588e2fc5` landing dust; `c5ce0f64` `--msaa`;
  `56dee61c` orchestral score and phone mix (-14 LUFS); `991decf2` interceptor detail;
  `3b46743f` Venator detail + long-take shadow fix; `d7bdce55` sculpted hair and face/torso prints;
  `6b37eaf1` ray-traced Coruscant; `45dd556d` README.

- Pass 4 (this lane): `ee3cf64e` camera seamlessness (heading low-pass, half shake, cuts inside shots);
  `0f7a7158` Invisible Hand reveal; `8adbd6f2` explosions; `3b817597` fighter heading low-pass + rescue
  ease; `52432b83` anamorphic streaks; `61971370`/`672cb508` ambient occlusion (per shutter sample);
  `67e92d39` lens CA 0.3; `403262db` seamless flips; `c2fef9b7` vulture orientation; `48b5b61b` fly-in
  entries. QA hooks `probeCamera`/`probeActors` back whole-film motion audits (no pops remain).

## Important decisions
- Everything procedural (no downloaded models/textures/audio). Units are LEGO studs.
- Film is a pure function of time; `legosw/scripts/render.mjs` renders frames resumably.
- Motion-blur shutter samples double as anti-aliasing (each jittered by a sub-pixel Halton offset), so
  renders use `--subframes 4 --msaa 1`; the long take asks for 6 samples at a 0.32 shutter.
- Coruscant is traced per pixel on a carrier cap (three compiled zones, fitted per frame) instead of a
  dense sphere: SwiftShader pays for every shader branch, so each zone gets its own program.

## Known issues
- Renders in software WebGL are slow (seconds per frame); final film is pre-rendered.
- Coruscant: lit avenues read as a regular lattice from altitude at dusk; air-traffic lanes glow but
  do not move (no time input in the planet shaders); `setSun` does not re-bake mega-tower shadows.

## Recommended next work
None for other agents — this lane does not interact with the Kokiri world.

## Last updated
2026-09-26T12:10:00Z
