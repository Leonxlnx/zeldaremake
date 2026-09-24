---
agent: opus-cinematic
runtime: Claude Code (Opus 5.5) on the owner's Windows laptop, with background sub-agents (camera scout, recorder, sound)
github: Leonxlnx
status: idle
branch: agent/opus-cinematic-sept24
updated: 2026-09-24T22:35:00Z
---

**2026-09-24 22:35 UTC — parked on the owner's change of plan.** Link's head fix and play-mode body
overlays are finished and CPU-checked, but not yet reviewed as GPU video. The cinematic was not
recorded. See `art/environment/opus-cinematic-sept24/README.md` for what is done and what is not.
The GPU slot (capslot) is free; no job of mine is running.

# opus-cinematic — work log

## Current task
The owner's new 30-second 4K cinematic (docs/OPUS_CINEMATIC_HANDOFF.md), started from
`codex/walk-arms-sept24` @ `7b0103fa` (PR #59). The owner (2026-09-24, in chat) additionally asked
this agent to fix Link's play-mode motion before filming: the head snap when turning slowly
right → left, a stiff idle / standing pose, and more natural walk / sprint / jump.

## Files / systems being touched
- `src/world/character/glbLink.ts`, `src/world/character/index.ts` — play-mode-only overlays
  (the GLB `link-runtime.glb` 8d7efa78… and every clip contract value are unchanged; fixed
  captures with `loco == null` keep the old arithmetic). Kept in their own commits for Astra.
- `art/environment/opus-cinematic-sept24/**` — recorder, shot plans, sound, receipts, delivery.
- `.agents/opus-cinematic.md` (this file), one INBOX entry.
- GPU: `capslot.mjs opus-cinematic`, one headless native job at a time.

## Completed work
- `7ac5fa5a` head-turn fix + play-mode body overlays; CPU check `art/environment/opus-cinematic-sept24/motion/check-body.mjs` PASSED, natural-legs check PASSED.
- Partial (unverified) cinematic tooling: `record.mjs`, `assemble.mjs`, `scout/`, `audio/` in `art/environment/opus-cinematic-sept24/`.

## Important decisions
- No Blender / GLB change: the owner asked for the fix tonight and Blender MCP is Astra's. The
  motion work is procedural and play-mode only (chest / arms / root weight shift), so the pinned
  clip contract (run 1.20 m / 28/60 s, 2.2 m/s) and the natural-legs check stay valid.
- Film source is frozen per take and recorded in the delivery receipts (commit, bundle, GLB sha).

## Known issues
- Pre-existing at 7b0103fa: a zero-dt re-pose moves the legs by up to 8.6 mm (stance-pin state)
  and the elbows by ~1 mrad; `check-body.mjs BASELINE=7b0103fa` reproduces it.

## Recommended next work
- Astra: review the overlay constants (glbLink.ts BODY_* / IDLE_* / ARM_ADDUCT) against a Blender
  pass; port the head fix to canonical (`glbLink.ts` lookAt, `index.ts` Navi anchor).

## Last updated
2026-09-24T22:12:00Z
