---
agent: fable-5
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-5-review
updated: 2026-09-19T10:25:00Z
---

# fable-5 — work log

Lane (from `docs/ONBOARDING_FABLE_CHATS.md`, chat 4): **reference analysis and independent visual
review**. Not world code. Owns `reference/` (analysis + downscaled comparison frames) and the
gauntlet's independent D7 verdicts (`gauntlet/reviews/*.json`, written only through
`node gauntlet/scripts/gauntlet.mjs --review …`). Does not edit `src/`, `gauntlet/rubric.json`,
`gauntlet/ledger.json`, or any other agent's log. PR #14 (draft → `cursor/kokiri-world-phase1-f65e`).

## Current task
Waiting for the owner's 15-minute Nintendo of America video file in the fable-5 chat (asked for a
local upload; no YouTube scraping). When it lands: `ffmpeg` frames at the owner's marked moments →
`reference/frames-video2/`, hashes → `reference/phash.json`, full `reference/ANALYSIS_VIDEO2.md`
(currently INTERIM on his three screenshots). Then a re-review of whichever take is sealed next.

## Files / systems being touched
- `reference/ANALYSIS_VIDEO2.md`, `reference/frames-video2/**`, `reference/phash.json`.
- `gauntlet/reviews/*.json` (CLI only), `gauntlet/reviews/evidence/fable-5/**`.
- `.agents/fable-5.md`, `.agents/reviews/fable-5-*.md`, my threads in `.agents/INBOX.md`.

## Completed work
- 2026-09-19 10:20 UTC — INBOX to fable-cursor: verdict list + **top-10 defects** with frame/pose and
  owning system for round 48 (`.agents/INBOX.md`, thread "take-0116 verdicts filed + top-10").
- 2026-09-19 09:40–10:10 UTC — **independent review of take-0116 (`973a21e`)**: 21 W-items + C01,
  C02, U01 filed through the CLI (`gauntlet/reviews/`), evidence crops reference | ours at the same
  normalised region under `gauntlet/reviews/evidence/fable-5/`, summary + provenance at
  `.agents/reviews/fable-5-take0116.md`. Pass: W01 W18 W22 W32 W36 U01. Fail: W02 W03 W05 W06 W08
  W09 W10 W11 W14 W15 W20 W23 W25 (fresh) W29 W30 W31 C01 C02. Re-scored: 28/50, Phase 1 25/42.
  Provenance: own clean headless render of `973a21e` (worktree, `capture.mjs --settle 8`) matches
  the monitor's six frames at pHash Hamming 0 / SSIM 0.993–0.994; own motion pair used for W22;
  nine survey-2 poses rendered on the same SHA (`broll.mjs --test`) as supporting evidence.
- 2026-09-19 09:20 UTC — `reference/ANALYSIS_VIDEO2.md` (INTERIM) + `reference/frames-video2/`:
  the owner's 0:56 / 1:42 / 2:22 screenshots with a crop→full-frame mapping, measured composition
  tables, 28 palette samples, a 14-item defect list (V1–V14) with owning systems, and the frame
  targets for when the video arrives. pHashes registered; anti-cheat C1 re-run green (68 rasters).
- 2026-09-19 09:05 UTC — onboarded; branch `agent/fable-5-review` off `d06e275`; PR #14 opened.

## Important decisions
- Verdicts are on the take's own frames at the criterion's viewpoint; player-height renders explain
  *why* something does or does not read but do not override the frame. Auto gates never rescue a
  visual fail; a "nit" is recorded in the note when the criterion is met but a difference remains.
- W30 is failed as written (shadows lower-right vs the reference's lower-left) even though the
  rubric's own azimuth window forces it — the fix path is `gauntlet/RUBRIC_PROPOSALS.md`, and
  reviewers should not silently pass a criterion the frame contradicts.
- Video-2 frames stay ≤ 640 px, comparison only; every file under `reference/frames-video2/` is
  hashed into `reference/phash.json` before it is committed.

## Known issues
- Video file not yet in this chat; §2 of the analysis covers three screenshots with YouTube chrome
  (positions ±0.03, hue biased ~5–10° warm by the red/white overlays).
- U02/U03 cannot be judged from a take (no equipment-screen capture). Needs a non-author capture
  with `?screen=equipment`.
- The C01/C02 verdicts are on the procedural Link in `973a21e`; Astra's Blender model (PRs #8/#10)
  is not in that build.

## Recommended next work
- fable-cursor: round-48 briefs from the INBOX top-10; a `RUBRIC_PROPOSALS.md` entry for W30's
  azimuth window (owner decides); a `?screen=equipment` capture in `take.mjs` so U02/U03 can be
  reviewed.
- Any non-author: re-run this review on the next sealed take — `.agents/reviews/fable-5-take0116.md`
  lists the regions; the evidence images are reproducible with the same crops.

## Last updated
2026-09-19T10:25:00Z
