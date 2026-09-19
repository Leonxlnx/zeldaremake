---
agent: fable-4
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-4-whitebark
updated: 2026-09-19T09:10:00Z
---

# fable-4 — work log

White-bark tree lane (Verdant Forest port), onboarded 2026-09-19 from
`docs/ONBOARDING_FABLE_CHATS.md` (Chat 3). Base: `origin/cursor/kokiri-world-phase1-f65e` at
`d06e275` (world tree = take-0116's `973a21e`). Draft PR targets that branch; fable-cursor / the
owner merge and seal — I do not merge, do not touch `gauntlet/ledger.json` or `gauntlet/rubric.json`.

## Current task
Survey-2 #31 (`sn-whitebark-base`): the white-bark bases are a painted birch tiling with a ~1 m
vertical repeat and no root flare. Targets W08 (≥ 8 real variants, better than Verdant's), W11
(laminae), W12 (bases within 3 cm of the ground), W37/W38 budgets.

1. Butt flare with 3–5 root toes (fluted foot, toes that dive into the soil), seated on
   `ctx.terrain.height`.
2. Break the tiling: taller bark tile with a second octave, per-variant UV offset + spiral drift,
   dark lenticel bands in the vertex colour, peeling-paper curls at 1–4 m.
3. Crown: the laminae must read as layered leaf silhouettes at 3–10 m, not flat cards.
4. Keep the ≥ 8 variants, the 3-LOD structure and the wind layers.

## Files / systems being touched
`src/world/trees/whitebark.ts`, `src/world/trees/bark-texture.ts` ONLY. Everything else in
`src/world/trees/` (giant, column, bole, distant, placement, nearCanopy, materials, index) belongs
to fable-cursor's trees-30 / distant-1 lanes — not edited. If a hook is needed in `trees/index.ts`
it is asked for in `.agents/INBOX.md` first.

## Completed work
- (none yet — baseline capture of `d06e275` running)

## Important decisions
- **Placement must not reshuffle.** `placeWhiteBark` and the LOD bucketing read each variant's
  LOD-0 `height` and `radius`; the variant RNG stream (`createRng('whitebark/<seed>')`) feeds the
  crown after the trunk and roots. Every new feature draws from a `rng.fork(...)` stream and keeps
  the existing draw order, so the crowns — and therefore the 80 placements — are byte-identical
  and the six fixed views only move where the bases and bark changed.
- Evidence rule (round 46): before/after at the exact survey pose; an after that looks like its
  before is reported as a FAIL.

## Known issues
- (none yet)

## Recommended next work
- (none yet)

## Last updated
2026-09-19T09:10:00Z
