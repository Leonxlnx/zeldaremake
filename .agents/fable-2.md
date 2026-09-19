---
agent: fable-2
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-2-rocks
updated: 2026-09-19T09:05:00Z
---

# fable-2 — work log

Lane: `src/world/rocks/**` ONLY (rockgen.ts, dressing.ts, material.ts, index.ts, tests, plus new
rock modules under the same directory). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (Chat 1).
Base: `origin/cursor/kokiri-world-phase1-f65e` @ `d06e2753`. Draft PR targets that branch;
`fable-cursor` merges. I do not touch `layout.ts`, the ledger or the rubric.

## Current task
Rocks pass from survey-2 and the owner's 2026-09-19 references (rubric W23 / W24, W37 held):
1. Survey-2 #32 / #19 — the shot-D hero boulder at `sn-boulder-shotd` reads as polka-dot lichen
   with a black hole on top: lichen as clustered crust patches that follow the plates, the hole
   closed, the crack furrows kept.
2. Survey-2 #17 / #25 — the stair-foot shard skirt at `sn-boulder-stairfoot` is angular low-poly:
   more, smaller, smooth-shaded shards half-buried in the moss, each seated on `ctx.terrain.height`.
3. ref-04 (`art/environment/owner-review-2026-09-19/`) — the tall rock/root ledge right of the
   north path: damp dark stone, moss sheets, a wet foot. I own the material + face builder; the
   position comes from fable-cursor's expansion-1 lane (`layout.ts`) — coordinating in the INBOX.
4. Wet band, moss and lichen must read at player height (2–6 m), not only at touching distance.

## Files / systems being touched
- `src/world/rocks/index.ts` — near-kit skirt stones, lichen dressing parameters, ledge hook.
- `src/world/rocks/rockgen.ts`, `dressing.ts`, `material.ts` — crust patches, hole fix, near fade.
- `src/world/rocks/ledge.ts` (new) — the ref-04 ledge face builder + material variant.
- `src/world/rocks/rockgen.test.mjs` (+ new tests beside it).
Nothing outside `src/world/rocks/` except this log, the INBOX and my evidence under
`art/environment/fable-2-rocks/`.

## Completed work
- (none yet — onboarding: docs read, base built, BEFORE captures at the six views and at the
  survey poses `sn-boulder-shotd`, `sn-boulder-stairfoot`, `sn-boulder-terrace`.)

## Important decisions
- Acceptance per the onboarding block: a before/after pair at the exact survey pose; the six
  fixed views A–F within −0.003 SSIM each of take-0116; draws ≤ 700; deterministic PRNG only.
- The near-LOD kit is the surface the survey poses see (the live camera stands 2 m from the
  rocks); the six hero cameras render the far meshes (hero margin), so near-only changes are
  the safe place for relief, and material fade limits are bounded by camera D's 6.5 m to the
  shot-D boulder's nearest lump.

## Known issues
- (none yet)

## Recommended next work
- Once expansion-1 lands the ledge position in `layout.ts`, wire it to the ledge builder's
  hook (see INBOX thread) and re-run the ref-04 pose.

## Last updated
2026-09-19T09:05:00Z
