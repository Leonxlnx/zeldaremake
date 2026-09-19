---
agent: fable-2
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-2-rocks
updated: 2026-09-19T12:45:00Z
---

# fable-2 — work log

Lane: `src/world/rocks/**` ONLY (rockgen.ts, dressing.ts, material.ts, index.ts, tests, plus new
rock modules under the same directory). Onboarded from `docs/ONBOARDING_FABLE_CHATS.md` (Chat 1).
Base: `origin/cursor/kokiri-world-phase1-f65e` @ `d06e2753`. Draft PR targets that branch;
`fable-cursor` merges. I do not touch `layout.ts`, the ledger or the rubric.

## Current task
Rocks pass from survey-2 and the owner's 2026-09-19 references (rubric W23 / W24, W37 held) —
done and reported (INBOX 12:40 UTC, PR #12); waiting on fable-cursor's merge and expansion-1's
`layout.rockLedges` entry for the ledge. Items were:
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
(newest first; PR #12 `agent/fable-2-rocks` → `cursor/kokiri-world-phase1-f65e`)
- `73708d4` + follow-up: the stair-foot "shard skirt" root-caused by draw-range probes (rock
  body only / kit only / far geometry swapped in at `sn-boulder-stairfoot`): it is the rock's own
  moss blanket — the 12 cm `mossSide` swell switched on/off at every micro-relief ridge (the
  cap's `n.y` gate) and at every crack line, a stack of hard-edged slabs. Near builds evaluate
  the swell on a low-frequency normal without the crack term (`mossSwellSmooth`; far byte-
  identical; differential test: blanket cliff edges 1728 → 608). Near kits also adopt the
  embankment strata slabs within reach (collapsed far, rebuilt smaller / smooth-shaded /
  half-buried with companions).
- `033ccc3` the "black holes" root-caused by probes (unlit material → solid, so no gaps; rock
  body only → no holes; dressing only → black domes): the moss cushions' vertex colours were
  palette greens as linear values (≈ 0.05) multiplied into the moss path. Pale neutral vertex
  colour now; regression test.
- `a092203`, `3682d5f`, `c4aa274`: lichen crust field `aLichen` (colonies inside the plates,
  stopped at joints, painted by the near material; the flecks fade out over the same nearW);
  disc plates removed; plate colour joints narrowed (the "slate seams"); crown parting pit damped
  (`strataCrown`); near fade 2.5–6 → 4–6.3 m; collar no longer grimed black, glossier blue-grey
  wet band with a tide line; skirt stones as weathered cobbles + near-only half-buried shards on
  the heightfield; stair-foot near skin smooth-shaded (34°, quarter chips, half plate steps).
- `b6b310a`: `rocks/ledge.ts` — the ref-04 ledge face builder + `layout.rockLedges` hook +
  `?rockLedgePreview=1` dev preview on the north path's east bank; tests.
- `6a7676c`: onboarding (log, INBOX announcement, ledge hook proposal).

## Important decisions
- Acceptance per the onboarding block: a before/after pair at the exact survey pose; the six
  fixed views A–F within −0.003 SSIM each of take-0116; draws ≤ 700; deterministic PRNG only.
- The near-LOD kit is the surface the survey poses see (the live camera stands 2 m from the
  rocks); the six hero cameras render the far meshes (hero margin), so near-only changes are
  the safe place for relief, and material fade limits are bounded by camera D's 7.22 m to the
  shot-D boulder's centre (≥ 6.4 m to its lumps → fade ends at 6.3 m).
- Every new rockgen option defaults to the old behaviour and the far build is asserted
  byte-identical in the tests (`strataCrown`, `mossSwellSmooth`, `lichen`).
- Probe method that worked (kept in `/tmp`, not the repo): render the survey pose with the near
  mesh's material swapped for emissive magenta (gap vs shading), then `geometry.setDrawRange`
  to split the kit (rock body first, then cushions, fragments, skirt), then the far geometry on
  the near mesh. Two of my first three hypotheses were wrong; the probes were not.

## Known issues
- The ledge stands at a preview position only (`LEDGE_PREVIEW`); the real entry is
  expansion-1's (`layout.rockLedges`). Its beds/joints are procedural stone — the "root" part
  of ref-04's "rock/root ledge" is trees' business (INBOX ask if wanted).
- Survey-2 #25 (bank boulders smooth dark domes at 8–15 m) and #34 (plaza joint pebbles as
  smooth ellipsoids) are far-material instanced geometry in the six views — not attempted.

## Recommended next work
- Once expansion-1 lands the ledge position in `layout.ts`, wire it to the ledge builder's
  hook (see INBOX thread) and re-run the ref-04 pose.

## Last updated
2026-09-19T12:45:00Z
