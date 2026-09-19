---
agent: fable-3
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-3-props
updated: 2026-09-19T09:20:00Z
---

# fable-3 — work log

Lane: **village props** — `src/world/props/**` only (index.ts, layout.ts, geometry, tests, README).
Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (chat 2) on 2026-09-19; base
`cursor/kokiri-world-phase1-f65e` @ `d06e2753` (take-0116's world `973a21e` + agents-log ticks).

## Current task
Kokiri village dressing the reference has and we lack, at player-height quality:
1. Clay pots (bulbous, ochre/terracotta, dark rim band, 3 sizes) in clusters by Saria's door, the
   signpost and the stair foot; wooden crates + a small barrel; a rope-and-plank ladder against
   the upper house's trunk; a low wooden platform with a rope railing on the plateau lip.
2. Everything seated on `ctx.terrain.height` with the terrain normal; positions in
   `src/world/props/layout.ts`; out of the six fixed frames' foregrounds.
3. Survey-2 #32 (crate = smooth flat planks, `w28-plateau-d`) and #37 (fern frond pierces the
   plateau pot, `w26-stairs-d`).
4. Wood and clay materials readable at 1–3 m (grain / wheel marks), moss and grime at the base.

Rubric targets: none dedicated to props; W36 (contact), W38 (draws ≤ 700), W41 (determinism)
must hold. Acceptance is before/after at the survey poses + six views within −0.003 SSIM each.

## Files / systems being touched
`src/world/props/index.ts`, `src/world/props/layout.ts`, `src/world/props/geometry.test.mjs`,
`src/world/props/README.md`, new files under `src/world/props/` only. Nothing else; hooks
outside the lane are requested in `.agents/INBOX.md` first.

## Completed work
- (none yet — onboarding, baseline capture of `d06e2753` in progress)

## Important decisions
- Props stay a leaf module: no imports from other systems; textures via `ctx.textures`
  (`weathered_planks`, already credited CC0) plus original procedural `DataTexture`s built in
  pure JS (clay wheel marks, rope twist) so `geometry.test.mjs` keeps running under Node.
- Static meshes are merged per locality (cluster) and material so the whole village dressing
  stays under ~20 draw calls.

## Known issues
- #37 is a vegetation scatter problem (ferns do not know about props); the in-lane fix is a
  pot position the fern rule leaves bare — a prop-exclusion hook in vegetation would be the
  real fix (asked in the INBOX).

## Recommended next work
- (after this lane) a `props` exclusion mask read by the vegetation scatter.

## Last updated
2026-09-19T09:20:00Z
