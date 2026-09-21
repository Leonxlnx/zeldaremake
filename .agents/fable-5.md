---
agent: fable-5
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-5-r48-review
updated: 2026-09-20T07:46:00Z
---

# fable-5 — work log

Lane (from `docs/ONBOARDING_FABLE_CHATS.md`, chat 4): **reference analysis and independent visual
review**. Not world code. Owns `reference/` (analysis + downscaled comparison frames) and the
gauntlet's independent D7 verdicts (`gauntlet/reviews/*.json`, written only through
`node gauntlet/scripts/gauntlet.mjs --review …`). Does not edit `src/`, `gauntlet/rubric.json`,
`gauntlet/ledger.json`, or any other agent's log. PR #14 merged (`97346d2`); goal mode since 2026-09-20
00:00 UTC (timer `goal-mode-fable-5`, cron `20 * * * *`); `agent/fable-5-demo-walk` merged (`b4de8d7`); current branch `agent/fable-5-r48-review`.

## Current task
Done this iteration: round 50 measured, pending calls re-measured, take-0125 pre-read (see Completed).
Next: take-0125's full re-verdict the moment it seals; astra's split; the video file.

## Previous current task (superseded)
Goal-mode loop. Next iteration: **re-verdict every visual item on take-0120** when it seals (the
monitor's last take is 0118 at `d168b93`; 0120 was queued at tick 178) — strict, reference | ours
crops, U02/U03 on the shipped bag screen with a non-author `?screen=equipment` render. Still waiting
for the owner's 15-minute video file in this chat (local upload; no YouTube scraping) — when it
lands: `ffmpeg` frames at his marked moments → `reference/frames-video2/`, hashes → `phash.json`,
§2/§3 of `ANALYSIS_VIDEO2.md` rewritten on clean frames.

## Files / systems being touched
- `reference/ANALYSIS_VIDEO2.md`, `reference/frames-video2/**`, `reference/phash.json`.
- `gauntlet/reviews/*.json` (CLI only), `gauntlet/reviews/evidence/fable-5/**`.
- `.agents/fable-5.md`, `.agents/reviews/fable-5-*.md`, my threads in `.agents/INBOX.md`.

## Completed work
- 2026-09-21 01:20–03:00 UTC — iterations 27–28 (r49 §R–§S): round 50 measured on the head (B −0.0119,
  C −0.0111, F −0.0164 from the demo-scale slabs — V16 answered, the metric punishes it; D/E gain); the
  V21 and taper calls re-measured on the round-50 head (unchanged); take-0125 pre-read (C01 closer, W06
  likely turns, W05 still a dome). take-0125 not yet sealed.
- 2026-09-21 00:20–00:45 UTC — iteration 26 (r49 §Q): fable-2's W05 rock half at C — C −0.0010, stones
  on the slope, the mound unchanged; W05 needs the terrain to tier (vegetation-27 / terrain).
- 2026-09-20 23:20–23:45 UTC — iteration 25 (r49 §P): V21 'shrink' variant — C +0.0019 / F −0.0042: F's
  loss is the head's pale loaf the frame never had; 'replace' (C +0.0032) is the variant, an owner-approved
  look change for fable-cursor to name.
- 2026-09-20 22:20–23:15 UTC — iteration 24 (r49 §O): the owner's NPC hide measured on character-on
  frames (C −0.0018, D −0.0007, E +0.0037 — the next take's baseline); fable-2's chroma step (face sat
  0.18 → 0.20, tint spent); fable-4-taper's tip (C +0.0009, all four W08 words at C — turns on the next take).
- 2026-09-20 21:20–21:45 UTC — iteration 23 (r49 §N): fable-2's V21 anchor at C — C +0.0032 (landed), A
  −0.0007, F −0.0043 (over budget); call for fable-cursor (owner-approved composition or a smaller
  stair-foot stone for F).
- 2026-09-20 20:20–21:10 UTC — iteration 22 (r49 §M): fable-2's D hue half (face 67° → 59°, sat unchanged
  at 0.16 vs the frame's 0.36 — IMPROVED, chroma next) and fable-3's backside props (six views +
  w04 pixel-identical; crate/bucket + waymarker at their poses — merge). Merge queue posted for
  fable-cursor, absent since 17:19.
- 2026-09-20 19:20–20:15 UTC — iteration 21 (r49 §L): fable-4's instance-matrix lean (C +0.0002, four
  poses identical — IMPROVED), fable-2's wall relief (micro σ 0.039 → 0.047) + pair value (IMPROVED),
  fable-2's D form planes (do not read at D: canopy shadow — a lighting question). Caught an outlier head
  render (diffuse whole-frame difference) by re-rendering.
- 2026-09-20 18:20–19:20 UTC — iteration 20 (r49 §J–§K): fable-4's taper `606ec987` (A/B/D/E pixel-identical,
  C Δ 0 — IMPROVED); astra's tip `64d5b7c9` re-measured — still over budget (C −0.0102, F −0.0125) but the
  leaf warmth puts the far crowns on the §7.1 hue target (C-top 84° → 66°); split recommended. My
  nearCanopy-revert isolation did not build.
- 2026-09-20 17:40–17:50 UTC — iteration 19b (r49 §I): fable-2's backside rocks (merged) at their poses —
  V20's pale pair is on the south bank (IMPROVED; smaller and greyer than `d_087`'s); D with the loaf +
  value half on the head −0.0003.
- 2026-09-20 17:20–17:40 UTC — iteration 19a: correction — fable-4's lean `ea86f8c1` re-rolled 18 outer-ring
  placements my six-view pair could not see (reverted by fable-4); W08's take-0123 note re-filed (the
  stem is plumb; the bough is the landed half), §B corrected with a method note (placement-sensitive
  commits need the instance-transform check, not pixels).
- 2026-09-20 16:20–16:55 UTC — goal-mode iteration 18: the round-49 walk of `97c8322` at 15 player-height
  poses (12 paired with the round-48 walk + 3 backside looks); the round-50 list re-cut by the owner's
  order (`fable-5-walk-r49-head.md`, five sheets). Sky overhead still 20.5 %.
- 2026-09-20 16:00–16:15 UTC — take-0123 (97c8322, 37/50) read: C +0.0046 recovered, nothing outside
  budget; W08 re-filed fail (lean + bough in, taper missing), W36/W03 re-checked pass
  (`fable-5-take0123.md`).
- 2026-09-20 15:20–16:10 UTC — goal-mode iteration 17: reference §7 — the owner's re-priority measured
  (foliage hue 60–64° vs ours 69–84° in the canopy; paving detail matches, boulders/walls flat in the
  large); fable-2's W23 value half `39568e37` at D — face l 0.21 → 0.24, D −0.0004, IMPROVED not closed
  (r49 §H). Caught a stale-bundle render of my own before reporting.
- 2026-09-20 14:20–15:10 UTC — goal-mode iteration 16 (r49 §F–§G): astra's environment branch
  `a9eccd15` measured against the head — C −0.0253, F −0.0301, D −0.0091, B −0.0053, E −0.0037 (the
  near crown cores' dark mass gone), plus an off-head ledger entry on the branch — reported as not
  mergeable; fable-3's second tint step `73129594` — six views pixel-identical, crate hue 42° → 31°.
- 2026-09-20 13:22–14:05 UTC — goal-mode iteration 15 (r49 §E): structures-32's tunnel measured at the
  V19 poses, before `ca562e76` / after `69d16c4f` — six views pixel-identical; at the `d_121` pose frame
  0.395 → 0.147 (ref 0.141), window:wall 1.5 → 5.8 (ref 5.0), both walls present. V19's tonal half
  closed; the window's content (trunks and lights, no ground) is the open half.
- 2026-09-20 12:36–13:25 UTC — goal-mode iteration 14 (r49 §C–§D): fable-2's D loaf `e5867d7e` on
  `ca562e76` — D 0.78 % px for −0.0008, a rock in the frame but its face l 0.21 vs the reference's lit
  0.27 (composition fixed, value inverted); fable-3's wood tint `424478eb` — six views pixel-identical,
  3–4° of hue at the pose, unchanged to the eye.
- 2026-09-20 11:31–12:15 UTC — goal-mode iteration 13 (r49 §B): fable-4's lean `ea86f8c1` (+ marks
  retire) measured on head `e54a74ed` — C 3.27 % of pixels for −0.0006 (the survey tree leans across
  the frame), the rest ≤ 0.05 %; grove/base/tunnel 9–22 %. IMPROVED; W08's last half is taper.
- 2026-09-20 10:25–11:10 UTC — goal-mode iteration 12 (r49 §A, new branch `agent/fable-5-r49-review`):
  fable-4's marks-retire `5fe58488` measured on head `0990b2c7` — five views pixel-identical, C Δ 0;
  the soft vertex band between the tile's crisp bands is gone at the grove. IMPROVED, merge.
- 2026-09-20 09:32–10:10 UTC — goal-mode iteration 11 (§O): fable-2's eight pebble looks `a3c644b2`
  measured on head `5e525dea` — six views inside budget (worst −0.0004), the looks land on the
  path-edge scatter; at opus #16's pose the joint pebbles at 1–2 m are pixel-identical (they are the
  hardscape's joint grit, not `pathEdgePebble`) — reported, hardscape half open.
- 2026-09-20 08:20–09:25 UTC — goal-mode iteration 10 (§M): three lanes' answers to take-0121
  measured as head (`acec3210`, perf-3 in) + commit. fable-4's low boughs IMPROVED (C: pole → limb
  with lobe; B −0.0003 the whole cost); fable-3's measured string IMPROVED (A −0.0005, C +0.0030,
  E +0.0022; my §J string position corrected); fable-2's W23 far look does not reach frame D — the
  D boulder is > 99 % hidden behind the fern bank (372 px visible; reference 5.4 % of the frame),
  reported as a FAIL with the occlusion sheet. take-0122 (37/50) sealed meanwhile: its C −0.0048
  bisected across the five merges (fable-2 pebbles −0.0022 + fable-3's first strings −0.0029, the rest
  ≈ 0); my 13 standing passes re-checked on its frames, all stand (§N).
- 2026-09-20 07:20–07:46 UTC — goal-mode iteration 9 (§L): fable-3's light-string tweak measured
  as head + commit (A −0.0001, C +0.0010, F +0.0005 — inside the budget); fable-2's merged wall
  second pass checked at 3 m (IMPROVED). Small iteration; no new take.
- 2026-09-20 06:25–07:19 UTC — goal-mode iteration 8: **player-height walk of the round-48 head
  `89473888`** (GOAL_MODE #3; 20 poses, before = `3d50f6c8`) with the merged round-49 ranked list —
  `.agents/reviews/fable-5-walk-r48-head.md` + six sheets; fable-4-budget (W38) checked visually
  neutral (§K). INBOX note to fable-cursor + the round-49 lanes.
- 2026-09-20 06:00–06:23 UTC — **take-0121 (`cf8083b`, round 48) re-verdicted**: 27 visual items
  filed (15 pass / 12 fail), U02/U03 from an own `?screen=equipment` render, W22 from an own motion
  pair, 26 sheets; re-scored **36/50, Phase 1 31/42** (take-0120: 30). Newly passing since
  take-0116: W03 W11 W14 W15 W20 W25 W29. Summary + ranked round-49 list in
  `.agents/reviews/fable-5-take0121.md`; INBOX note to fable-cursor + all lanes.
- 2026-09-20 05:20–05:54 UTC — goal-mode iteration 7 (§J): **the hero flight is log-risered**
  (`d_105`/`d_013`/`d_107` + the A frame) — V18 withdrawn, V18′ filed at sev 3, W02 wording
  proposal for fable-cursor, evidence sheet; fable-3's light strings verified at A's reference
  positions and value (A +0.0001, F −0.0009); fable-2's clearing cull harmless. `ANALYSIS_VIDEO2.md`
  §6.6b. INBOX note to fable-cursor + hardscape-31.
- 2026-09-20 04:20–04:55 UTC — goal-mode iteration 6 (§I): fable-2's wall at 3 m IMPROVED
  (crest, beds, damp gradient, foot slabs; C/D identical) + flight-flank scree landed; fable-4's
  texture-octave bands PASS at 5 m (near-black torn bands + chevrons; saplings now marked; C +0.0003).
  Five sheets; INBOX note.
- 2026-09-20 04:20 UTC — U02/U03 pipeline ready for take-0120: `.agents/reviews/fable-5-tools/equip-screen.mjs`
  renders `?screen=equipment` headlessly (full-page shot, 84 s on this VM; verified on the head —
  Deku Stick card in the oval, grid, tabs). Also filed there: `before-after-sheet.py`, `ssim-pair.mjs`
  (the gauntlet's 256×144 SSIM + pixDiff for two frames, optional reference) — the tools behind every
  number in `fable-5-r48-branches.md`.
- 2026-09-20 03:35–04:30 UTC — goal-mode iteration 5 (§H): `agent/fable-3-merge` (props per
  locality) pixel-identical at B/C/E and five props poses; `agent/fable-4-crowns` (crown albedo)
  IMPROVED — leaves −16…−29 %, under the haze, B/E identical, C +0.0001; shape still flat cards.
  Three sheets; INBOX note.
- 2026-09-20 03:00–04:00 UTC — goal-mode iteration 4 (§G): fable-2's shot-D value commit
  `20513c24` verified as head + commit (cherry-pick worktree): face l 0.156 → 0.201 at 2 m with the
  ferns unchanged, D pixel-identical at the compare size — IMPROVED, safe to merge; fable-3's 45 m
  cluster cull `0b46deb7` — props still draw at 5.6/11 m, A pixDiff 0.01 %. Method note: the lane
  branches still sit on `3d50f6c8`, so branch-vs-head renders differ by the other lanes' merges —
  cherry-pick the commit onto the head for a clean read.
- 2026-09-20 01:45–03:10 UTC — goal-mode iteration 3 (`agent/fable-5-r48-review` off `0987e060`
  after fable-cursor merged the previous branch): the lane branches' new commits re-checked
  (§E of `fable-5-r48-branches.md`): **fable-4's trunk-read commits on `b61e0ff8` = an after that
  looks like its before** (bands −8 % at 5 m, B/C/E 0.03–0.05 % of pixels, saplings excluded by
  code); the head's `1812a6f0` doubles them (band cores −37…−41 %, IMPROVED, not a birch's marks
  yet; young stems unchanged). fable-3's clearing entrance props land at three poses + the tunnel
  view. **The merged head `0987e060` measured against `3d50f6c8`: six views ≤ 0.08 % of pixels,
  Δ SSIM ≥ 0** (§F). Tooling finding: `broll.mjs --test` shot order shifts the wind phase — compare
  only at the same batch position. Five sheets; INBOX note posted.
- 2026-09-20 01:00–01:45 UTC — goal-mode iteration 2: **non-author before | after of the three
  goal-mode lane branches** that cannot open PRs (`agent/fable-2-ledge`, `agent/fable-3-lookout`,
  `agent/fable-4-r48`): each built and tested in its own worktree, rendered at the poses of its
  defect against the head `3d50f6c8`; D_log/F_canopy measured head→branch (fable-2/3 pixel-identical,
  fable-4 0.08 % of D, +0.0001 SSIM). fable-2 ledge IMPROVED (the mound is a rock wall; smooth
  boulder read, bare foot, cut above the crest still open), fable-4 trees landed (first verticals in
  the tunnel view), fable-3 railing FIXED on the hook. `.agents/reviews/fable-5-r48-branches.md` +
  ten sheets in `fable-5-r48/`; INBOX note to fable-cursor cc the three lanes.
- 2026-09-20 00:05–00:55 UTC — goal-mode iteration 1 (`agent/fable-5-demo-walk`, from head `3d50f6c8`):
  **`reference/ANALYSIS_VIDEO2.md` §6** — the six demo segments the hero frames miss
  (`frames-dense/demo61/`: the 9–11 s orbit, the walk to the door, the top-down, the stair foot
  looking up, the run to the arch, under the arch), each measured and compared with the head at the
  equivalent pose (own `broll.mjs` renders, 14 poses + 3 follow-ups); defects V15–V21. **Player-height
  walk `.agents/reviews/fable-5-walk-3d50f6c8.md`**: before (`a0e06cf4`, the head just before the
  three merges) | after (`3d50f6c8`) at the poses where fable-2/3/4's defects were recorded — crate
  FIXED, pierced pot FIXED, white-bark scars + straight cut FIXED (toes near-black), stair-foot and
  shot-D boulders IMPROVED, the ledge UNCHANGED (expected; fable-2 #1) — plus a 10-item ranked open
  list. 15 sheets under `.agents/reviews/fable-5-walk/`. PR creation through the agent tool failed
  with GitHub "must be a collaborator" (twice); branch pushed, fable-cursor told in the INBOX.
- 2026-09-19 10:20 UTC — INBOX to fable-cursor: verdict list + **top-10 defects** with frame/pose and
  owning system for round 48 (`.agents/INBOX.md`, thread "take-0116 verdicts filed + top-10").
- 2026-09-19 09:40–10:10 UTC — **independent review of take-0116 (`973a21e`)**: 21 W-items + C01,
  C02, U01 filed through the CLI (`gauntlet/reviews/`), evidence crops reference | ours at the same
  normalised region under `gauntlet/reviews/evidence/fable-5/`, summary + provenance at
  `.agents/reviews/fable-5-take0116.md`. Pass: W01 W18 W22 W32 W36 U01. Fail: W02 W03 W05 W06 W08
  W09 W10 W11 W14 W15 W20 W23 W25 (fresh) W29 W30 W31 C01 C02. Re-scored: 29/50, Phase 1 25/42, 2 pending (U02, U03).
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
- The Cursor PR tool cannot open a PR for `agent/fable-5-demo-walk` (GitHub validation "must be a
  collaborator", 2026-09-20 00:50 UTC). The branch is pushed and rebased on the head; fable-cursor
  can merge from the branch or open the PR. Re-try at the next iteration.
- `reference/frames-dense/README.md`'s timing table is off for d_087–d_122 (documented in
  `ANALYSIS_VIDEO2.md` §6 header; the file is fable-cursor's — not edited).
- Video file not yet in this chat; §2 of the analysis covers three screenshots with YouTube chrome
  (positions ±0.03, hue biased ~5–10° warm by the red/white overlays).
- U02/U03 cannot be judged from a take (no equipment-screen capture). Needs a non-author capture
  with `?screen=equipment`.
- The C01/C02 verdicts are on the procedural Link in `973a21e`; Astra's Blender model (PRs #8/#10)
  is not in that build.

## Recommended next work
- fable-cursor: V15 (plaza closure W/S/N — the owner's "backside"), V16 (slab 2×/joint 2× and the
  polarity, measured from above), V19 (the arch is not a tunnel: 3× too bright, no right wall) are
  the three new sev-3 items for round 49 briefs; V17 (the flight's inverted gradient) for Astra.
- fable-cursor: round-48 briefs from the INBOX top-10; a `RUBRIC_PROPOSALS.md` entry for W30's
  azimuth window (owner decides); a `?screen=equipment` capture in `take.mjs` so U02/U03 can be
  reviewed.
- Any non-author: re-run this review on the next sealed take — `.agents/reviews/fable-5-take0116.md`
  lists the regions; the evidence images are reproducible with the same crops.

## Last updated
2026-09-20T07:46:00Z
