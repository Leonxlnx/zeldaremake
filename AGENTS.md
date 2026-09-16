# AGENTS.md — Kokiri Forest Remake (Three.js)

This file is the persistent collaboration protocol for every coding agent (and human) working in
this repository. Read it fully before touching anything. Then read `PROJECT_STATE.md`,
every file in `.agents/`, `GAUNTLET.md`, and the open PRs.

## Project goal

Recreate the Kokiri Forest gameplay clip from the *Ocarina of Time* remake first-look
(https://x.com/DiscussingFilm/status/2097327973351272627, 61 s, 1280×716) as a real-time
**Three.js** world — shot for shot: the long stone stairway, the flagstone paths, the tree-trunk
houses with mossy dome roofs and glowing pod lanterns, the signpost, the fences on the upper
ledge, the giant trees, the god rays, the falling leaves, the fairy. Same art direction
(clean, colourful, stylised-realistic), **one-to-one composition**, and *more* fine detail than
the reference where technically possible. Original or CC0 assets only.

Order of work: **World → Character → UI.** Phase 1 (now) is WORLD ONLY. Do not build the final
player, combat, enemies, HUD, menus, inventory or progression yet.

The full task brief lives in `docs/PROMPT_PHASE1.md`. The reference analysis lives in
`reference/ANALYSIS.md`. Reference frames live in `reference/frames/` (comparison only — never
as scenery, see GAUNTLET.md).

## Current phase

**Phase 1 — World.** Exit criteria are defined by `GAUNTLET.md` (`npm run gauntlet:verify-exit`
must pass in CI), not by anyone's opinion.

## Who is here

| Agent id | Where it runs | Log file | GitHub identity |
| --- | --- | --- | --- |
| `fable-cursor` | Cursor Cloud Agent (Claude Fable 5.1) + parallel sub-agents | `.agents/fable-cursor.md` | commits as *Cursor Agent* |
| `codex` | Codex (ChatGPT Work), started by the owner | `.agents/codex.md` | commits as `Leonxlnx`; branches `agent/codex-*` |
| `Leonxlnx` | human owner / director | — | `Leonxlnx` (also `nexiumbiz-debug`) |

Any further agent: pick a short stable id, create `.agents/<your-id>.md` from
`.agents/TEMPLATE.md`, and announce yourself in `.agents/INBOX.md`.

## Architecture rules (read before editing code)

1. **Systems are independent modules.** `src/world/<system>/index.ts` exports `create(ctx)` and
   returns a `WorldSystem` (`src/world/system.ts`). Systems talk only through `WorldContext`
   (terrain sampling, wind uniforms, sun, quality, textures). Never import another system's
   internals. This is what makes parallel work safe.
2. **`src/world/layout.ts` is the single source of truth for WHERE things are.** Read freely;
   change values only when a reference comparison demands it and log the change.
3. **`src/world/terrain/heightfield.ts` is the only way to know ground height.** Everything that
   touches the ground samples `ctx.terrain.height/normal/mask`. Contact must be exact.
4. **Deterministic randomness only** (`src/world/util/prng.ts`). No `Math.random` in world code —
   captures must be reproducible or before/after diffs are meaningless.
5. **Wind is shared** (`src/world/wind/wind.ts`). Inject `WIND_GLSL` and call the layer function
   that matches your asset; never a global synchronised sine.
6. **Register an audit** (`ctx.audit(name, fn)`) for every system. The rubric's automated checks
   read those numbers — and cross-check them against the scene graph (see GAUNTLET.md).
7. **Assets:** `public/textures/<set>/{color,normal,roughness,ao,height}.jpg`, credited in
   `public/textures/CREDITS.md`. CC0 (Poly Haven, ambientCG) or original only. No Nintendo assets,
   no frames of the reference video, no AI-generated matte paintings used as scenery.
8. `src/world/index.ts` is the one file everybody touches — one-line additions only.
9. Keep `npm run typecheck && npm run build` green on every commit you push.

### Ownership map (Phase 1)

| Directory | System | Notes |
| --- | --- | --- |
| `src/world/terrain/`, `src/world/hardscape/` | terrain, stairs, flagstones | heightfield interface is frozen |
| `src/world/rocks/` | boulders, scree, pebbles | fable-cursor first pass (bootstrap), then hands to `codex` |
| `src/world/props/` | Kokiri props: pots, crates, ladders, platforms, rope railings | offered to `codex`; own positions in `props/layout.ts` |
| `src/world/trees/` | white-bark trees (Verdant port), giant trees, distant trees | see Verdant Forest below |
| `src/world/vegetation/` | grass, ferns, flowers, bushes, moss, litter | first pass by fable-cursor (landed e528348); **owned by `codex` from 2026-09-09 11:55 UTC** |
| `src/world/structures/` | houses, lanterns, signpost, fences, lantern branch, log arch | |
| `src/world/atmosphere/`, `src/world/lighting/`, `src/world/postfx/` | sun, sky, haze, mist, god rays, particles, AA/AO | |
| `src/camera/`, `src/capture/` | dev camera, capture API | shared infrastructure |
| `gauntlet/` | rubric, anti-cheat, capture/compare/score tooling | rubric.json is hash-locked |
| `site/` | Director's Monitor (live before/after site) | |
| `reference/` | analysis + downscaled frames | comparison only |

Before starting on a directory, check `gauntlet/claims.json` and the other agent's log. If they
are active there, pick another system or coordinate in `.agents/INBOX.md`.

### Verdant Forest

https://github.com/Leonxlnx/verdant-forest is the technical/asset foundation (same owner).
`app/forest/trees.js`, `understory.js`, `botanical-refinement.js`, `vegetation.ts`,
`compact-grass.ts`, `materials.ts`, `volumetrics.ts` are the useful parts. **The white-bark trees
are especially important** — port and improve them, do not replace them with generic procedural
trees. Clone it to a scratch directory; do not vendor the whole Next.js app into this repo.

## Git / PR workflow

- Never work directly on `main`.
- Branch names: `agent/<agent-id>-<system>` (e.g. `agent/fable-world-terrain`) or the Cursor
  cloud format `cursor/<name>-<suffix>`. Descriptive > formulaic.
- Small coherent commits. Push often. Open a PR early (draft is fine) so the other agent can see
  the work; keep the PR description current.
- Before a large refactor or a merge: `git fetch --all`, read the other agent's log and open PRs,
  and check `gauntlet/claims.json`.
- Never force-push a shared branch. Never rewrite the other agent's commits.
- CI (`.github/workflows/gauntlet.yml`) runs typecheck, build, anti-cheat, capture and scoring on
  every push/PR. A red gauntlet blocks merge.

## How agents communicate

1. **Your own log** `.agents/<agent-id>.md` (template in `.agents/TEMPLATE.md`): current task,
   files/systems being touched, completed work with commit hashes, decisions, known issues,
   recommended next work, last-updated timestamp. Update before a major task, after finishing a
   subsystem, and before ending a session. Never edit the other agent's log.
2. **`.agents/INBOX.md`** — short messages addressed to a specific agent, newest at the top,
   each with a date and `from → to`. Reply under the message. Delete threads once resolved.
3. **`gauntlet/claims.json`** — claim rubric items / directories before working (`npm run gauntlet -- --claim W02,W03 --agent <id>`); claims expire after 3 h.
4. **`PROJECT_STATE.md`** — shared state only; update only when an integrated milestone changes.
5. **The Director's Monitor** (`site/`, published by CI) shows every take from every agent with
   before/after images, so both agents (and the owner) can see what changed each hour.

## How to check what the other agent recently changed

```bash
git fetch --all --prune
git log --all --oneline --since="2 days ago" --author-date-order | head -50
git branch -r --sort=-committerdate | head
gh pr list --state open
cat .agents/*.md
cat gauntlet/claims.json
```

## Things that must not be casually rewritten

- `src/world/terrain/heightfield.ts` (interface) — everything sits on it.
- `src/world/layout.ts` — composition is measured against it.
- `src/capture/api.ts` — the gauntlet drives the page through it.
- `gauntlet/rubric.json` — hash-locked; see GAUNTLET.md for the only legitimate change path.
- `gauntlet/ledger.json` — append-only hash chain of takes; never edit by hand.
- Anything under `.agents/` that is not your own file.

## Cursor Cloud specific instructions

- Headless WebGL2 works in this VM via Chrome + SwiftShader (`/usr/local/bin/google-chrome`).
  `npm run build && npm run capture` renders all viewpoints in ~20–60 s.
- `npm run dev` serves the world on port 5173; `npm run site:dev` serves the monitor on 8787.
- ffmpeg is available for extracting reference frames (`npm run ref:extract`).
- Use the GUI browser only for interactive inspection; automated evidence comes from `npm run take`.
