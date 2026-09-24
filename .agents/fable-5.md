---
agent: fable-5
runtime: Cursor Cloud Agent (Claude Fable 5.1)
github: Cursor Agent <cursoragent@cursor.com>
status: active
branch: agent/fable-5-r48-review
updated: 2026-09-24T05:58:00Z
---

# fable-5 — work log

Lane (from `docs/ONBOARDING_FABLE_CHATS.md`, chat 4): **reference analysis and independent visual
review**. Not world code. Owns `reference/` (analysis + downscaled comparison frames) and the
gauntlet's independent D7 verdicts (`gauntlet/reviews/*.json`, written only through
`node gauntlet/scripts/gauntlet.mjs --review …`). Does not edit `src/`, `gauntlet/rubric.json`,
`gauntlet/ledger.json`, or any other agent's log. PR #14 merged (`97346d2`); goal mode since 2026-09-20
00:00 UTC (timer `goal-mode-fable-5`, cron `20 * * * *`); `agent/fable-5-demo-walk` merged (`b4de8d7`); current branch `agent/fable-5-r48-review`.

## Current task
LANE 10 (squad brief 2026-09-23): walkthrough QA and performance on the play-head build — ranked issue lists with positions,
load / pacing / hitches; fixes go to the owning lanes.
Done this iteration: the squad branches and the merged head `6664f739` read at the owner's pose (§6–§7): populated and
warm, darker than before; the far air's brightness (l 0.318 vs 0.474) and the crowns' colour at depth are the two open
numbers, both posted to lanes 1 / 2; six views −0.008 … −0.033 (§7a/b); walk QA and pacing (§8); the owner's four poses
(§10): the crowns at arm's length are the new #1 at his poses (fable-4's understory, corrected in §14); W38 at A is lane 4's blades (§11); lane 7's girl reviewed (14:24–). Next: re-read the poses as lanes 1 / 2 push; the head's next sealed take (take-0135 was `main`'s checkpoint — expected on the
head with the cast A ≈ 0.18, B ≈ 0.175, C ≈ 0.19, D ≈ 0.24, E ≈ 0.19, F ≈ 0.21; W02 pass on kind and weight per §14); the
video file.

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
- 2026-09-24 05:30–05:58 UTC — iteration 102 (lane-10 §28, `perf102/`): the head `5cbe6ac8` — caps A 638 / 8.86 M; the flight as
  fable-2's branch; the 06:50 pose unchanged; **the roofed poses went dark** (`u-open-up` 0.512 → 0.415, `b-upper-2` 0.270 → 0.166,
  `h-west-front` 0.324 → 0.292) — the near-veil wave, flagged to fable-cursor / squad4 / lane 1. INBOX 05:58.
- 2026-09-24 04:28–04:40 UTC — iteration 101 (lane-10 §27, `perf101/`, `spot.mjs`): the head `fb7d313a` with the south expansion —
  caps A 643 / 8.89 M, C 559 / 7.25 M; the south route 21 / 21, deck probes 41 / 41, the camera ≥ 1.38 m, boots on the deck;
  the `plaza-south` flare pose confirmed (the frame is bark). INBOX 04:40.
- 2026-09-24 03:27–03:39 UTC — iteration 100 (lane-10 §26): the clean six-view split (lane 1's air +0.008 … +0.018 every view; the
  candidate's own row A +0.007, C −0.006, D −0.003, F −0.008; expected take A 0.200 … F 0.209); fable-2's stone-value pass takes
  the flight to the owner's 23:00 reference (dark 51.5 → 29.2 %, l 0.278 → 0.342 vs 7 % / 0.363) — merge-ready. INBOX 03:39.
- 2026-09-24 02:22–02:25 UTC — iteration 99 (lane-10 §25): the candidate's six views vs 79f44aa5 — A +0.0176, B +0.0137, C +0.0093,
  D +0.0148, E +0.0164, F +0.0005 (every view toward the frames); §24 corrected (the stair-camera fix is in the candidate);
  the head 81430baf's six views rendering for the clean split. INBOX 02:25.
- 2026-09-24 01:33–01:56 UTC — iteration 98 (lane-10 §24, `perf98/`): the squad's integration candidate `4c30d4db` — caps A 638 /
  8.91 M, C 7.20 M; the owner's 23:00 stair reference is pale worn stone (dark 7 %, l 0.363): `stairs-look` has the kind but goes
  darker (dark 35.8 → 51.5 %, l 0.308 → 0.278) — the log-step target retired for the main flight; `b-upper-2` still dark. INBOX 01:56.
- 2026-09-24 00:28–00:36 UTC — iteration 97 (lane-10 §23): pacing on the prebuild head `61db16c8` — the plaza segment p50 10.2 → 4.5 ms
  (§8 closed), overall 5.8 → 4.8; one new shader compile on the walk at the flight's top (115 → 116; 41 ms frame) flagged to
  fable-3 / fable-cursor; squad4's `5bd1aeee` re-run — the ledge's vertical max 270 → 46 m/s². INBOX 00:36, 00:39.
- 2026-09-23 23:28–23:40 UTC — iteration 96 (lane-10 §22, `perf96/`): the owner's 23:00 stair shake measured off on squad4's branch
  (main flight turn-accel p95 2370 → 506 °/s², vertical max 58 → 18); lane 4's blade tier A −54 K; lane 2's LOD rungs C +460 K,
  all views under 9.0 M. INBOX 23:40.
- 2026-09-23 22:32–23:07 UTC — iteration 95 (lane-10 §20, `fable-5-take0135.md`): lane 1's corridor light at the north-path poses —
  the far-centre box 0.400 → 0.438 (his 0.474), near-black 33 → 24 %, the r_020-like pose at the recording's level; `b-upper-2`
  unchanged (§10.2 open). take-0135 read: it is `main`'s frozen checkpoint (67b801db), not the head — no verdicts filed. §21: the
  crowns' prebuild (`94d96536`) — pending 0 at every spot, the trees' update 2.6–6.0 → 0.30 ms. INBOX 23:07, 23:17.
- 2026-09-23 21:26–21:43 UTC — iteration 94 (lane-10 §19): lane 7's skinned kids −52 draws at A / B / E / F (projected head A 643 /
  8.95 M); lane 6's log joint closes the wedges at `s2-join-close` (0.275 → 0.319, 0.231 → 0.263) with `s2-owner`'s weight
  unchanged. INBOX 21:43.
- 2026-09-23 20:36–21:19 UTC — iteration 93 (lane-10 §18, `perf93/`): the owner's 20:08 "trees spawn" on `39e63437` — caps A 695 /
  8.95 M (5 draws / 50 K left), pacing unchanged, the near-base pool all resident (wanted 17 → 23 at the plaza), the near-crown
  pool the spawn that is left (374 wanted / 192 pending at the plaza, builds p50 6.8 ms, max 60). INBOX 21:19.
- 2026-09-23 19:31–20:03 UTC — iteration 92 (lane-10 §17): fable-4's understory 6.5 m off the walk lines (`f5cf6c26`) at the owner's
  poses vs the head `393fce60` — `h-west-front` clears (upper-left leafy 29.8 → 11.7 %), the 06:50 pose's top band 0.288 → 0.311,
  far-centre 0.378 → 0.397; §10.1 closes on both layers (merged 19:50). The fairies at the follow camera (lane-7 review §5).
  INBOX 20:03, 20:15.
- 2026-09-23 18:28–18:52 UTC — iteration 91 (lane-10 §16, lane-7 review §4): fable-2's cooler earth at the owner's pose and A —
  saturation 0.46 → 0.45, B/R 0.54 → 0.55 vs the demo's 0.35 / 0.65: the band is 15 % of the box, the warmth is the logs and
  treads (merge either cut on weight); fable-3's boy at the door on `e7a01c7e` reads as the girls' pass (`people-play.mjs`
  now guards uniform frames). INBOX 18:52.
- 2026-09-23 17:34–17:56 UTC — iteration 90 (lane-10 report §14): re-read on `79f44aa5` — the flight closes on kind and weight
  (dark 60.8 → 37.4 %, l 0.242 → 0.300); the card wall at the owner's look-up poses was fable-4's understory (path minimum
  3.4 m) and squad2's mid grove both — §14 / §15; fable-cursor's `d6681b92` (the grove off the walk lines) confirmed at the
  poses (u-open-up 0.418 → 0.505); six views 0149f255 → 79f44aa5 A −0.0113, D +0.0074, E +0.0106, F −0.0100. INBOX 17:56, 18:22.
- 2026-09-23 16:31–17:07 UTC — iteration 89 (lane-10 report §13, `perf89/`): the merged head `b510b152` — A 692 / 8.86 M with the
  cast (both caps met; §12's projection 698 / 8.87 M); `stairs2-base` 685 / 9.31 M; pacing with the cast p50 5.8 / p99 16.7,
  no compiles on the walk, heap flat; the kids' eight programs compile on first sight (14.5 s render at the flight's foot).
- 2026-09-23 15:31–15:56 UTC — iteration 88 (lane-10 report §12, `perf88/`): the three perf branches measured against their bases
  and projected together — the cast put A at 723 draws / 9.20 M; fable-2 −188 K every view, fable-4 A −134 K / F −166 K,
  fable-3 A −25 draws; head + all three A 698 / 8.87 M, B / E 689 (2 draws of headroom; a kid in view ≈ 50 draws). INBOX 15:56.
- 2026-09-23 14:24–15:31 UTC — iteration 87 (`fable-5-review-lane7-kokiri-4b1759f9.md`, `fable-5-lane7-review/`): non-author
  read of lane 7's first landing — six views with the character A −0.0034, B −0.0069, C −0.0001, D 0, E −0.0050, F −0.0014
  (expected take-0135 A ≈ 0.194 … F ≈ 0.219); play-mode before / after at the follow camera (`people-play.mjs`, the head with
  the cast forced visible as the before): helmet hair → maroon lobed bob, paler skin; the face / fairy / hem next; routes 9 / 9.
- 2026-09-23 13:22–13:44 UTC — iteration 86 (lane-10 report §11, `submission.mjs` / `bysystem.mjs`): W38 at A attributed on
  `be123deb` — of the +0.62 M since `f56c5740`, vegetation +0.57 M (grass instances 512 K → 619 K, ferns / flowers / bushes:
  lane 4), the trees +0.05 M (the mid canopy 0.03 M); same split at B / D / E. INBOX 13:43 to fable-cursor / lane 4.
- 2026-09-23 12:30–12:52 UTC — iteration 85 (lane-10 report §10 + ranked list): the owner's four 09-23 poses on `0149f255` —
  mid-canopy crowns 3–7 m from the walk line read as flat card piles (`u-open-up` 0.55 → 0.30, sky 50 → 14 %; `h-west-front`
  hides the hut; seats named from the trees' audit, `midseats.mjs`), `b-upper-2` dark (0.454 → 0.269), the earth treads show
  but the flight's weight is unchanged (61 % dark vs the demo's 13–31 %). INBOX 12:52 to lane 2 / fable-cursor, cc 1 / 6.
- 2026-09-23 09:31–10:30 UTC — iteration 83 (lane-10 report §6–§7, `bands.py`): the squad branches one at a time at the owner's
  pose (squad1 hue 89° → 50° but l 0.316 vs the recording's 0.474; squad2 crowns populate and darken, near-black 26 → 35 %;
  squad3 local, 6 %); the merged head `6664f739`: populated, warm, and darker than before the squad (near-black 49 %, l 0.230 vs
  his 12 % / 0.394); the crowns keep their local colour at depth (green s 0.15 / l 0.29 vs 0.05 / 0.42); the far air darker
  (0.360 → 0.318 vs 0.474); the top band 0.335 → 0.232 (the mid canopy roofs the path). Six views `f56c5740` → `6664f739`:
  A −0.0193, B −0.0184, C −0.0212, D −0.0319, E −0.0330, F −0.0082 (§7a/§7b). Walk QA §8: 9/9 routes; a 1.26 m one-frame
  camera pop leaving the west house; Link's boots 3–11 cm over Saria's forecourt; play spots +37…+53 draws, `stairs2-base`
  9.67 M; pacing alone JS p50 4.2 → 6.2 ms (the plaza segment 4.1 → 10.4), heap +99 MB over the walk; the trees' near-LOD
  pool builds are the world update on both builds (`sysperf.mjs`), pending longer after the batch. INBOX threads 10:28 (the
  light, lanes 1 / 2) and 11:11 (walk QA, camera / lane 8 / lane 2). Re-read on `0149f255` (§9, 12:21): the far air +0.024
  of +0.156, near-black and the top band unmoved; six views inside ±0.002.
- 2026-09-23 08:30–08:40 UTC — iteration 82 (lane-10 report §3 pacing, §5): the 07:50–08:29 air changes at the owner's pose darken
  the corridor (mist 2.0 → 0.9 %, l 0.300 → 0.263 vs the recording's 22.6 % bright); the left-bank turf invisible at his pose;
  pacing along the walk smooth (JS p50 4.2 ms, no compiles).
- 2026-09-23 07:29–07:52 UTC — iteration 81 (LANE 10 taken, `fable-5-lane10-walk-2026-09-23.md`): the owner's 06:50 pose against
  his recording (bright mist 2 % vs 15–23 %, earth banks 17 % vs 1–2 % — a trench with no crowns at 10–40 m); an eight-item
  ranked list with positions and lanes; harness on `e4ca3241`: walks clean, the descent camera at 0.38 m, `stairs2-base` 9.53 M
  triangles over the cap.
- 2026-09-23 06:28–06:46 UTC — iteration 80 (r55 §Z): `c526a5b8` at the owner's `u-open-up` — the flat pale card is a dark
  round leaf roof (card l 0.627 → 0.524), #26/28 closed at the owner's example; six views byte-identical; the walk list updated.
- 2026-09-23 05:27–05:28 UTC — iteration 79: the ranked open list refreshed after the owner's 09-23 items (walk doc, refresh
  section) — clarity items lead; the flight's weight the new #4; the `u-open-up` card open at ≈ 71°.
- 2026-09-23 04:34–05:14 UTC — iteration 78 (r55 §Y): the 04:09 owner items at the six views (neutral, ≤ ±0.0002) and at the
  owner's own poses — `b-upper-2`'s shaft veil gone (0.454 → 0.271, #38 closed there); `u-open-up`'s pale flat card unchanged
  (l 0.627 vs sky 0.653; ≈ 71° elevation, above the 20–44° gate) — #26/28 not closed at the owner's example.
- 2026-09-23 03:31–03:52 UTC — iteration 77 (r55 §X): the polish head `3b37b8b7` at the six views (A/F −0.0002, rest 0; cumulative
  since take-0134's build A −0.0010 … F +0.0027) and the A/B/F re-verdict fable-cursor asked for — W02 pass on kind (weight noted),
  W14 pass, W26 pass reinforced (crafted lanterns still Deku-nut pods), W10 fail; to file on take-0135.
- 2026-09-23 02:35–03:05 UTC — iteration 76 (r55 §W): the owner's 09-23 items on the head (`f04fbf5a`) — six views A −0.0008,
  B −0.0001, C 0, D +0.0002, E +0.0003, F +0.0029; the weathered logs fix the pattern and give back half the tint's weight
  (flight box 45.8 → 52.8 % dark) — the two asks meet at pale treads; the crafted lanterns and the west-house light measured
  at the harness spots (23.8 % / 13.6 % of the frame); the distant floor cards not reproduced at my look-up framing.
- 2026-09-23 01:31–01:33 UTC — iteration 75 (`fable-5-take0134.md`, r55 §V): take-0134 (the clarity set) read — every view down
  as booked (D −0.0110), all six within ±0.002 of the expected row; 41/50, nothing filed; the owner-region read from §4's
  fog-slice rows (edge target met, lightness/saturation moved away, sky still blue); take-0135's expected row posted.
- 2026-09-23 00:27–00:30 UTC — iteration 74: the k3/k4 camera-to-crown distances added to ANALYSIS_CLARITY §4 (cards at
  18–28 m render at 16 px — softer than the frames' 50 m crowns); the Link caveat on take-0134's expected row.
- 2026-09-22 23:36–00:11 UTC — iteration 73 (r55 §U): fable-4's colour-pass culling `220fff43` — byte-identical at the six
  views and at three edge-heavy walk poses (max |Δ| 0.0); mergeable as merged.
- 2026-09-22 22:32–23:04 UTC — iteration 72 (`fable-5-walk-r55-head.md`, r55 §T): a 17-pose player-height walk of the head
  `8f07e181` — V19 closed (tunnel 0.142 vs 0.141), V17's inversion gone (0.27 → 0.29, gap 0.42 vs 0.69), the ledge / flight /
  backside / flares landed; a nine-item ranked open list led by the clarity items.
- 2026-09-22 21:35–21:38 UTC — iteration 71 (ANALYSIS_CLARITY §5, r55 §S): the hue lever in numbers — the frames' background
  behind high crowns #858372-class warm grey-khaki (h 52–57°, s 0.06–0.08, l 0.48) vs our #777c7e-class cool neutral grey
  (s 0.02); target and a check on the pending palette pair posted to Astra; `clarity-poses.json` published.
- 2026-09-22 20:31–20:58 UTC — iteration 70 (r55 §R): owner-fable's stand roof at the six views (A +0.0003, B +0.0015, C 0,
  D +0.0022, E +0.0007, F 0 — claims reproduced) and Astra's packs + upper-canopy admission (C −0.0050, F −0.0014 — not
  byte-identical at the fixed views as the lane note assumed; lit leaves admitted at C's left); expected rows for take-0134
  and take-0135 refined.
- 2026-09-22 19:35–19:53 UTC — iteration 69 (`fable-5-take0133.md`, r55 §Q): take-0133 read — the expected row held to
  ±0.0003, 41/50, nothing filed; the fog pair re-rendered with matching flags after fable-2's catch (my after frames had
  `--character` on): A −0.0029, B −0.0030, C −0.0081, D −0.0143, E −0.0024, F −0.0040 — the slice costs on all six;
  ANALYSIS_CLARITY §3 corrected; take-0134's expected row posted.
- 2026-09-22 18:28–18:46 UTC — iteration 68 (ANALYSIS_CLARITY §4, r55 §P): fable-4's k3/k4 attribution taken (distant cards;
  §2 corrected); the painter on the sky-facing cards edge 4.9 → 4.0 px, fine 1.4 → 2.9 % (frames 10–14 %); the hazed cards
  unchanged (16 px); the fog slice lightens/saturates the card the wrong way; sky 207° on every build.
- 2026-09-22 17:23–18:00 UTC — iteration 67 (ANALYSIS_CLARITY §3, r55 §O): Astra's fog slice `ae880cf2` at the six views —
  A +0.0102, B −0.0021, C −0.0118, D −0.0148, E +0.0021, F −0.0002; every far band 0.05–0.12 below the frames' (it clears by
  darkening), hue unchanged (65–74° vs 50–64°); at five crown poses the sky behind the crowns stays 200–207°. Reconsideration
  asked before take-0134 seals; the frames' target given (bright warm haze at the old weight, crisp crowns inside).
- 2026-09-22 16:34–17:02 UTC — iteration 66 (`reference/ANALYSIS_CLARITY.md`, r55 §N): the owner's circled crowns measured
  against the reference — the gap is the frames', the hue is not (background 165° vs 44–60°), the crown is hazed like a 50 m
  crown at 15–25 m, 2.7 % leaf-scale silhouette vs 11–14 %; targets posted; Astra's atlas painter changes nothing at five
  crown poses (the circled lobes are the giants' canopy at the near→far swap, not the far cards); owner's pose requested.
- 2026-09-22 15:29–15:35 UTC — iteration 65 (`fable-5-take0132.md`, r55 §M): the take sealed as take-0132 (`4f22e7ec`) — six
  views on §D's expected row to ±0.0004 (C +0.0012), pipeline healthy, deltas = the source chain; W02 re-filed pass (flight
  box 61 → 40 % dark), C01 re-filed fail (Link pixel-identical to take-0131); 41/50; take-0134's expected row posted.
- 2026-09-22 14:22–14:38 UTC — iteration 64 (r55 §L): whose shadow is on the D boulder — a `?nocast=<group>` diagnostic:
  trees' casters off gives 93 % of the shadow-off gain (macro σ 0.109 / p90 0.52), structures and vegetation 0; the item is
  a sun corridor in `trees/index.ts` (trees / giants lane).
- 2026-09-22 13:33–14:03 UTC — iteration 63 (r55 §K): V16's fill half specified after fable-2's flush stretches moved
  nothing — the seam sits −0.28 below the slab vs the frame's −0.15 (twice the depth on 1.6× the length): soil at ≈ 0.40
  where the line shows, slab value over ≈ 40 % of each run, acceptance numbers for `seam-lines.py`; the owner's grass item
  (blades 16 → 26 m) at the six views: inside budget, F −0.0022, faint in stills.
- 2026-09-22 12:25–12:47 UTC — iteration 62 (r55 §J): the D boulder's flatness proven to be the canopy's shadow — shadow
  map off, the loaf alone reaches the frame's macro σ (0.117 vs 0.124) and p90 (0.51 vs 0.49); fable-2's planes add
  nothing even in sun. Round-50 #1 / #12 re-owned: a sun corridor onto the boulder (canopy), not rockgen.
- 2026-09-22 11:34–12:02 UTC — iteration 61 (r55 §I): the two memory steps after `e188ac2f` at the six views — rock-bytes /
  rock-upload / propmem (D 0.17 % > 8 levels on the hero boulder, none > 40) and vertexbytes (≤ 0.013 %, five F edge pixels);
  SSIM vs reference 0 / +0.0001 / 0 / −0.0001 / 0 / +0.0001 — frame-neutral; §D's row stands.
- 2026-09-22 10:27–10:45 UTC — iteration 60 (r55 §H): tick 226's late-compile hypothesis tested — A's 90 frames on the
  tick-226 source flat to ± 2 %, `programs` 101 / `geometries` 302 from frame 1 to 90, heap flat, GPU process +0.5 MB/frame;
  the stall is the box (pressure, a GPU-process restart, or contention), not the frames; B the same (frames 51–55 in
  76.1 s, programs/geometries constant).
- 2026-09-22 09:36–10:18 UTC — iteration 59 (r55 §G): the merged head `e188ac2f` (trees `onUpload` + pebble-bytes) — six
  views byte-identical; Chrome −568 MB on the capture path (renderer 2,110 → 1,835 at ready); `?warmup=1` measured: renderer
  −172 but GPU process +640, total +721 — do not turn it on for takes; the heap-objects figure corrected (0.50 GB).
- 2026-09-22 08:29–08:47 UTC — iteration 58 (r55 §F): fable-2's pebble-bytes cut — six views SSIM identical, 0.07–0.28 %
  of pixels by 2–3 levels, mergeable; the two memory reads reconciled (773 MB geometry inside 1,021 MB ArrayBuffers);
  Link's GLB decoded: two 4,096² maps + a 2,048² eye = 218 MB, −190 MB at the honest size (Astra's export).
- 2026-09-22 07:33–08:20 UTC — iteration 57 (r55 §E): fable-cursor's OOM root cause reproduced on this idle box — Chrome
  4.27 GB at `ready` (JS 1,522 / renderer 2,110 / GPU 1,682 MB), +95 MB over six views, no leak; `pool=small` identical;
  the heap is 1,021 MB of live ArrayBuffers (a forced GC frees nothing) — geometry held twice; `BufferAttribute.onUpload`
  named as the trim, textures (43 × 2k) as the GPU process's. Scripts + logs under `fable-5-r55/`.
- 2026-09-22 06:30–06:35 UTC — iteration 56 (r55 §D): take-0133 pre-read — the expected six views from take-0131 plus
  every measured step (A 0.2213, B 0.1987, C 0.2186, D 0.2764, E 0.2191 ± Link, F 0.2316) with a reading rule that
  separates a browser-per-view warm-state shift from source changes before verdicts are re-filed.
- 2026-09-22 05:35–06:28 UTC — iteration 55 (r55 §C): the head's dressing fade (fable-2, `82b94525`) at 12 poses
  with a dressing-only attribution build — six views exactly shadowlod's numbers; V20's pair at `x-southbank-toe`
  fine σ +27 % (attributed), 4 m unchanged, 11 m +5 % from the fade; clearing poses ≤ 0.43 %. IMPROVED, six views
  untouched; the 13–20 m half of the owner's range is still the far skin by design. `seam-lines.py` published.
- 2026-09-22 04:34–04:48 UTC — iteration 54 (r55 §B): fable-2's V16 correction accepted (#3 is not a value; §F
  fixed in place); the seam excess decomposed — width equal, depth ~equal, visible length 1.4–1.7× and the
  hard-groove share 1.1–2×; the reference's seams do not close slabs (E 5 regions vs our 12); a diagnostic build
  (slabs `castShadow` off) leaves every joint number unchanged — the outline is the continuous recess's own
  shading. Brief re-scoped to the module: the fill flush/lapping in seeded stretches + the proud height, together.
- 2026-09-22 03:30–04:28 UTC — iteration 53 (r55 §A): fable-4's shadowlod (the white-barks' mid LOD stops
  casting) on the head at 12 positions (10 valid; two blind probes struck) — six views A/B/E/F identical, C −0.0009, D −0.0002 (fable-4's table
  reproduced); the cost is on the trees 20–44 m out: crown-on-trunk band and ground patch gone (grove
  poses 2.4–5.6 % of pixels, all brighter), the near ground untouched everywhere. Mergeable; a shadow-only
  low-mesh proxy offered as an option.
- 2026-09-22 02:35–02:50 UTC — iteration 52 (r54 §G): Astra's bank-backing study read — confirms §D, rejects
  the backing (opaque ovals); the head keeps F −0.0104 — revert #29 asked of fable-cursor.
- 2026-09-22 01:38–02:00 UTC — iteration 51 (r54 §F): the round-52 ranked list re-cut by the owner's order
  (41/50 with my verdicts; PR #29's revert first, then the near canopy's hue, V16's seams, the flight's light).
- 2026-09-22 00:28–01:05 UTC — iteration 50 (r54 §E): fable-4's lodthin on the head — A/B/D/E identical,
  C −0.0004, F −0.0001, grove 3.5 % — harmless W38 give-back; PR #29's regression still on the head.
- 2026-09-21 23:25–23:50 UTC — iteration 49 (r54 §D): the head's tick-215 imports measured — the warmth
  landed (C-top 72°, D-top 63.8°) at no cost; PR #29's bank-core recession costs A −0.0027, C −0.0040,
  F −0.0104 (haze through the receded cores) — flagged before the seal.
- 2026-09-21 22:54–23:05 UTC — take-0131 read: predates the timber tint (flight box 60.9 % dark); nothing
  filed, 41/50 (`fable-5-take0131.md`).
- 2026-09-21 22:26–23:00 UTC — iteration 48 (r54 §C): Astra's leaf-warmth branch — six views budget-free,
  far crowns C-top 84.5 → 72.9°, D-top onto the frame's 63.8°; the near canopy (69°) untouched. Merge.
- 2026-09-21 21:30–21:55 UTC — iteration 47 (r54 §B): fable-3's arch rim — the right cheek's seam step
  −60 % at x-arch-approach, tunnel-n identical (floor nit stands); round-50 #12 mostly closed.
- 2026-09-21 20:29–20:50 UTC — iteration 46 (r54 §A): fable-2's timber tint on the head — A +0.0087, F +0.0040;
  flight box 61.5/7.3 → 40.7/13.1 % dark/pale (frame 15.8/14.0); take-0130 carries (identical frames).
  New branch `agent/fable-5-r54-review`.
- 2026-09-21 19:30–19:50 UTC — iteration 45 (r53 §C): the atlas sRGB recovery on the head — invisible at
  the six views, canopy hue unchanged (69–84° vs 60–69°); the warmth term is the lever (r49 §K).
- 2026-09-21 18:23–19:00 UTC — iteration 44 (r53 §B): Astra's #25/#26 on the head — moss colonies right and
  small; the log-winding fix exposes the crowns and the flight reads too dark (61.5 % dark vs the frame's
  15.8 %) — thinner/paler logs + tread light for fable-2.
- 2026-09-21 17:32–18:00 UTC — iteration 43 (r53 §A): fable-4's plateau roof — sky overhead 21.4 → 9.0 %,
  A/F pixel-identical, eye level unchanged; round-50 #7 closes. New branch `agent/fable-5-r53-review`.
- 2026-09-21 16:46–17:00 UTC — take-0129 re-verdicted — W02 → pass (the log-risered flight); 41/50 with my
  verdicts (`fable-5-take0129.md`).
- 2026-09-21 16:24–16:55 UTC — iteration 42 (r52 §B): fable-4's stand beyond the arch — A/C identical, D
  −0.0002, the window's far layer thickens with trunks (V2's first half; lit value, lights and the ground
  plane still open). take-0129 still unsealed.
- 2026-09-21 15:33–15:45 UTC — iteration 41: §9's pitch row withdrawn on fable-3's anchor projection (26.6° fits
  the reference's logs in A and F; my 35–40° from d_105 was unconstrained); the other §9 rows stand.
  take-0129 still unsealed.
- 2026-09-21 14:26–15:05 UTC — iteration 40: new branch `agent/fable-5-r52-review`; W02 pre-read on the merged
  head (log nosings in — turns on take-0129 on my read). The take has not sealed.
- 2026-09-21 13:20–13:35 UTC — iteration 39: take-0128 re-verdicted — W23 → pass (the rock at the frame's
  spot, layered, moss-capped, lit); 40/50 with my verdicts (`fable-5-take0128.md`).
- 2026-09-21 12:20–12:50 UTC — iteration 38 (r51 §D): fable-2's log nosings + stakes — A −0.0009, C −0.0016,
  F −0.0104 (V16's kind of cost); the flight reads as the demo's log-risered stair — W02 turns on my read
  at the next take; merge as the owner-approved change.
- 2026-09-21 11:20–11:55 UTC — iteration 37 (r51 §C): fable-4's slots64 — six views pixel-identical, the
  plateau look-up's flat card becomes layered leaves, sky 20.4 → 21.5 % (the roof stays a canopy item).
  take-0128 still unsealed.
- 2026-09-21 10:45–10:55 UTC — take-0127 (brown bark) read: trunks moved 5–13° toward the frames' 48–60°
  (B/E's giant still 71°); no verdict turns (`fable-5-take0127.md`).
- 2026-09-21 10:35–10:55 UTC — iteration 36b (r51 §B): fable-4's emergent cushions — D identical, 3 m pose
  2.8 % (blobs gone) — IMPROVED; the brown bark's first read at D (−0.0017, low amplitude); a head-build
  mismatch caught by rebuilding before attributing.
- 2026-09-21 10:20–10:35 UTC — iteration 36a: ANALYSIS_VIDEO2 §8.1 — the five unverified V-rows checked
  on take-0126's frames (V7 closed, V6/V12 partly, V3/V14 open) with a pHashed sheet.
- 2026-09-21 09:20–09:50 UTC — iteration 35 (r51 §A): fable-2's W23 layout move — D −0.0024 with the
  rock's face at l 0.28 / 53° / 0.24 (frame 0.27 / 52° / 0.36; a near pass), E −0.0046 (over; the rock in
  E's left third), A/C inside; vegetation contracts red until updated.
- 2026-09-21 08:20–08:50 UTC — iteration 34: take-0126 re-verdicted (W08 → pass, W23 near; 39/50 with my
  verdicts; `fable-5-take0126.md`); the owner's one-to-one stairs comparison (ANALYSIS_VIDEO2 §9 + sheet).
  New branch `agent/fable-5-r51-review`.
- 2026-09-21 07:20–07:40 UTC — iteration 33: ANALYSIS_VIDEO2 §8 — the V1–V21 status pass at take-0125 /
  `48156889` (closed / landed / open-with-reason / unverified) and the six-view baseline note.
  take-0126 still unsealed.
- 2026-09-21 06:20–07:00 UTC — iteration 32 (r50 §B): fable-4's lod-1 dial `d9e9be27` — five poses and a
  12-frame approach pixel-identical; the runtime claim is fable-6's to confirm. take-0126 still unsealed.
- 2026-09-21 05:20–06:10 UTC — iteration 31: `agent/fable-5-r49-review` merged (1364ce6c) → new branch
  `agent/fable-5-r50-review`; the nine-branch head `48156889` pre-read for take-0126 (W08 turns on my
  read, V21's anchor in, W23 near) — the take has not sealed since 04:39.
- 2026-09-21 04:20–04:55 UTC — iteration 30: take-0125 (c4d12f6, round 50) re-verdicted — 11 verdicts, W06
  turns (38/50 with my verdicts), C01 close (tunic only), W05/W02/W08/C02 fail updated
  (`fable-5-take0125.md`, four sheets).
- 2026-09-21 03:20–03:50 UTC — iteration 29 (r49 §T): V16's seams measured twice too dark (E 12.0 % vs
  the frame's 5.4 %) with slabs 0.03 darker; V17 unchanged at w23-stairs-f (canopy shade — a light, not
  albedo); fable-2's near relief on the hero boulders (A identical, 2 m micro σ up). take-0125 still unsealed.
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
- A before/after pair must match on every render flag (`--character`, `--hud`, shot list, settle), not only the
  shot list — iteration 67's fog pair did not, and its A "+0.0102" was Link (caught by fable-2, corrected in 69).

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
2026-09-24T05:58:00Z
