---
agent: opus-review
runtime: Claude Code (Claude Opus 5) on the owner's Windows PC
github: Leonxlnx
status: active
branch: agent/opus-review
updated: 2026-09-19T20:50:00Z
---

# opus-review — work log

Independent visual reviewer. **No `src/` edits, ever.** Owns only its own D7 verdicts
(`gauntlet/reviews/*.json`, written through the CLI), its evidence
(`gauntlet/reviews/evidence/opus-review/**`), this log, `.agents/reviews/opus-review-*.md`, and
its own threads in `.agents/INBOX.md`. Draft PR against `cursor/kokiri-world-phase1-f65e` carries
the reviews only.

## Current task
Two jobs. **A —** strict pass/fail verdicts with evidence on the latest sealed take on the
`monitor` branch (take-0116, `973a21e`, author fable-cursor). **B —** walk the playable build of
the world-branch head at player height and file a ranked defect list with pose coordinates and
the owning system to fable-cursor in `.agents/INBOX.md`. Targets every `visual`/`both` item in
`gauntlet/RUBRIC.md`.

## Files / systems being touched
- `gauntlet/reviews/*.json` (CLI only), `gauntlet/reviews/evidence/opus-review/**`
- `.agents/opus-review.md`, `.agents/reviews/opus-review-take0116.md`, `.agents/INBOX.md`
- Nothing under `src/`, `gauntlet/rubric.json`, `gauntlet/ledger.json` or another agent's log.

## Completed work
- 2026-09-19 20:45 UTC — **player-height walk of the round-47 head** (`ccbe867` = `9975956c` + this
  branch's reviews; `git diff 9975956c..ccbe867 -- src/` is empty). 60 poses at eye height rendered
  through the capture API on this machine's GPU (`ZR_NATIVE_GPU=1`, settle 14, 1280×720): survey-2's
  48 plus 12 new ones for the tunnel, the north path, `northClearing`, the `ledge` flight and
  terrace and `plateauLookout`. **17 ranked defects with pose, world position and owning system,
  and 4 round-47 claims that hold**, filed to fable-cursor in `.agents/INBOX.md`; crops, pose
  manifest and method at `.agents/reviews/opus-review-walk/`. Also verified shell-1's bag screen,
  which round 47 shipped unverified: the centre oval now renders a real 3-D item card.
- 2026-09-19 20:05 UTC — **independent review of take-0116 (`973a21e`)**: all 27 `visual`/`both`
  items filed through `gauntlet.mjs --review … --agent opus-review --take take-0116`.
  **Pass (8):** W01 W18 W22 W26 W32 W36 U01 U03. **Fail (19):** W02 W03 W05 W06 W08 W09 W10 W11
  W14 W15 W20 W23 W25 W29 W30 W31 C01 C02 U02. Re-scored with these verdicts: **29/50, Phase 1
  24/42, zero items pending** — the first take with a non-author verdict on every visual item.
  (W42 shows `fail` in that local re-score only because the monitor copy of the take carries no
  `console.log`; the take itself recorded zero console errors, so the real figures are 30/50 and
  25/42.) Summary and provenance: `.agents/reviews/opus-review-take0116.md`.
- Evidence: 40 sheets under `gauntlet/reviews/evidence/opus-review/`, each REFERENCE (left) |
  OURS (right) at the same normalised region resampled to the same pixel size, with the region
  burned in.

## Important decisions
- **Judged on the take's own frames** at the viewpoint the criterion names
  (`monitor` branch `data/takes/take-0116/`). An auto gate never rescues a visual fail, and a
  criterion met with a visible residual difference is recorded as a **pass with a nit** rather
  than a silent fail.
- **Three items needed frames the take does not carry**, so they were rendered from the same
  commit in a detached worktree (non-author, `capture`-mode, settle 12, SwiftShader — the same
  renderer the monitor's takes use): W22's motion pair (t and t + 0.5 s), and U02/U03's
  `?screen=equipment`. Every such verdict says so in its own note. U02 and U03 had never been
  verdicted by anyone.
- **W30 is failed as written** (shadow to the lower right, reference lower left) even though the
  rubric's own azimuth window forces it. Reviewers should not pass a criterion the frame
  contradicts; the fix path is the standing `gauntlet/RUBRIC_PROPOSALS.md` entry, for the owner.
- Measurements quoted in the notes are means over a named normalised region of both images, so
  every claim in a verdict can be re-derived from the two files.

## Known issues
- `layout.ts` gives `E_ground` the same position, target and fov as `B_house`
  (`[0,1.5,2] → [5,1.7,-12]`, fov 46), so the two captures are **byte-identical**
  (sha256 `faf70fa2…` for both in take-0116). Six viewpoint ids, five distinct cameras. W42's
  auto check counts entries, so it does not see this; the reference `E_ground.jpg` is its own
  framing of the held B camera, so E's SSIM/pHash are effectively a second vote on B.
- The reference frames are 640 px wide and the captures 1280 px. Every crop resamples both to the
  same pixel size before comparison, but fine-detail claims are limited by the reference's
  resolution and JPEG noise, and size claims are always given as a fraction of frame width.

## Mistakes made
- Three times during the session I killed stray headless Chrome processes by matching `--headless`
  on the command line, believing they were my own orphans. This box is shared — `perftrace.mjs`,
  `broll.mjs`, `capture.mjs` and `capture_play_motion.mjs` were all running from other lanes — so I
  may have killed another agent's capture between roughly 21:30 and 22:30 local time. Told
  fable-cursor in the INBOX. I do not do this any more: a stuck job of mine gets `TaskStop` and
  patience instead.

## Recommended next work
- fable-cursor: the ranked player-height defect list is in `.agents/INBOX.md` (Job B).
- Anyone non-author: re-run these verdicts on the next sealed take. Every region is named in the
  notes and the crop spec is reproducible.
- Owner: `gauntlet/RUBRIC_PROPOSALS.md` still needs a decision on W30's azimuth window, and a
  second one is worth opening for `E_ground`'s duplicate camera.

## Last updated
2026-09-19T20:50:00Z
