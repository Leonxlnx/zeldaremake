---
agent: fable-5
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-5-review
updated: 2026-09-19T09:05:00Z
---

# fable-5 — work log

Lane (from `docs/ONBOARDING_FABLE_CHATS.md`, chat 4): **reference analysis and independent visual
review**. Not world code. Owns `reference/` (analysis + downscaled comparison frames) and the
gauntlet's independent D7 verdicts (`gauntlet/reviews/*.json`, written only through
`node gauntlet/scripts/gauntlet.mjs --review …`). Does not edit `src/`, `gauntlet/rubric.json`,
`gauntlet/ledger.json`, or any other agent's log.

## Current task
1. Independent review of **take-0116** (`973a21e`, author fable-cursor) — a strict verdict with
   evidence for every pending visual W-item (W01 W02 W03 W05 W06 W08 W09 W10 W11 W14 W15 W18 W20
   W22 W23 W29 W30 W31 W32 W36) plus a fresh W25 (its verdict on file is from take-0070).
   Evidence: take-0116's six frames from the `monitor` branch, cross-checked against my own
   clean capture of `973a21e` (worktree), crops under `gauntlet/reviews/evidence/fable-5/`.
2. `reference/ANALYSIS_VIDEO2.md` + `reference/frames-video2/` from the owner's 15-minute
   Nintendo of America video. **The video file has not been uploaded to this chat yet**; until it
   arrives the analysis covers the owner's three gameplay screenshots in
   `art/environment/owner-review-2026-09-19/` (0:56, 1:42, 2:22).
3. Top-10 defects with pose/frame + system → `.agents/INBOX.md` for fable-cursor.

## Files / systems being touched
- `reference/ANALYSIS_VIDEO2.md`, `reference/frames-video2/**`, `reference/phash.json` (new
  frame hashes appended so anti-cheat C1 protects them).
- `gauntlet/reviews/*.json` (through the CLI only), `gauntlet/reviews/evidence/fable-5/**`.
- `.agents/fable-5.md`, `.agents/reviews/fable-5-*.md`, my threads in `.agents/INBOX.md`.

## Completed work
- 2026-09-19 09:05 UTC — onboarded; branch `agent/fable-5-review` off
  `origin/cursor/kokiri-world-phase1-f65e` (`d06e275`); read the protocol, the rubric, the survey-2
  report, the round-46 evidence and the owner's 2026-09-19 fix list.

## Important decisions
- Verdicts are on the take's own frames (the six 1280×720 captures the ledger hashes), compared
  with `reference/frames/*.jpg` at the criterion's viewpoint. Survey-2 crops (take-0115) and my
  own player-height renders of `973a21e` are supporting evidence only; where a criterion names a
  viewpoint, that viewpoint decides.
- A criterion is judged as written in `gauntlet/RUBRIC.md`; "reads like the reference" fails when
  a first-glance comparison at 1280 px shows the difference, not only at 400 % zoom.
- Reference frames from the new video are ≤ 640 px wide, comparison only, never scenery; hashes go
  into `reference/phash.json` so C1 catches any reuse as a texture.

## Known issues
- Video not yet available in this chat (asked the owner for a local upload — no YouTube scraping).
- U02/U03 (equipment screen) cannot be judged from a take: the six captures never show the bag
  screen. Needs a dedicated capture (`?screen=equipment`) by a non-author.

## Recommended next work
- fable-cursor: the top-10 list in the INBOX thread becomes round-48 briefs.
- Any non-author with a GPU: re-run the survey-2 poses on the next sealed take so the player-height
  verdicts stay current.

## Last updated
2026-09-19T09:05:00Z
