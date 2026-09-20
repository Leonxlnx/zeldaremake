---
agent: fable-6
runtime: Claude Code (Claude Fable 5.1) on the owner's Windows laptop (Radeon 780M)
github: Leonxlnx
status: active
branch: agent/fable-6-monitor-perf
updated: 2026-09-19T19:30:00Z
---

# fable-6 — work log

Lane (from `docs/ONBOARDING_FABLE_CHATS.md`, chat 5): **Director's Monitor + performance
profiling**. No world code. Owns `site/**`, `gauntlet/scripts/lib/monitor.mjs`, `site/SCHEMA.md`,
`gauntlet/scripts/perftrace.mjs` and the new `docs/PERF_2026-09-19.md`. Does not edit
`src/world/**`, `src/ui/**`, `gauntlet/rubric.json`, `gauntlet/ledger.json`, `take.mjs`, or any
other agent's log. Runs on the same laptop as `astra-local` and `owner-fable`: every capture is a
native D3D11 render (`ZR_NATIVE_GPU=1`), one capture at a time, headless Chrome only.

## Current task
Both halves delivered: PR #19 (draft → world branch) carries the Director's Monitor as a
director's cut and `docs/PERF_2026-09-19.md` with the native profile of take-0116 and the `lod-1`
brief (posted in the INBOX 2026-09-20 00:05 UTC). Waiting on fable-cursor's review / merge; the
next publish with this code lights up the headline, the evidence gallery and the play-link SHA on
the live monitor, and a strip staged under `gauntlet/out/player` lights up the player strip.

## Files / systems being touched
- `site/**` (app.js, js/*.js, styles.css, index.html, SCHEMA.md, README.md, dev/*).
- `gauntlet/scripts/lib/monitor.mjs` (headline derivation, evidence + player-strip export at
  publish time; the publish pipeline itself — `take.mjs` — stays fable-cursor's).
- `gauntlet/scripts/perftrace.mjs` (additions only, defaults unchanged).
- `docs/PERF_2026-09-19.md` (new), `gauntlet/perf/**` evidence for this round (new files only).
- `.agents/fable-6.md`, my threads in `.agents/INBOX.md`.

## Completed work
- 2026-09-19 23:50 UTC — perf §4–§7: each system alone per hero view (trees 30 % / vegetation
  21–27 % / structures 14–23 % of the triangles; the character's 129 draws for 0.17 M tris); the
  six views per variant (F −0.0086 at 18 and 25 m = the stair-bank giant 13.6 m from F; A/C/D
  byte-identical; the pool change byte-identical); the native ablations (shadow map a third of
  the frame: 2048/8 −19 %, off −34 %; pixels the other third: scale 0.75 −27 %; composer 2–7 ms;
  vegetation LOD 0 %); the warm-up retry (78 s, 64 s the warm pass); the brief for `lod-1` (§7).
- 2026-09-19 22:50 UTC — perf §3 / §5.1 / §5.2 in `docs/PERF_2026-09-19.md`: the 780M frame is
  per-pixel bound (GPU finish 100 ms of a 142 ms step, flat from 8.1 to 10.7 M tris); the
  near-canopy pool cap (64 MB vs 125 MB demand) is the hitch story — pools at 192 / 32 MB give
  0 builds / 0 evictions and trees.update 3.9 → 0.6 ms with byte-identical frames; 18 m swaps cost
  +1–2 % tris and are affordable only with the pool change (`lod18prewarm`: p95 159 ms vs 243, no
  synchronous build). Traces in `gauntlet/perf/r48/`.
- 2026-09-19 22:10 UTC — `d423436` review round on the monitor + perf tooling (65-agent adversarial
  review, 5 finders × 2 skeptics per finding): an attribute-breakout XSS through the evidence card's
  `--ar` style and a RegExp built from published data closed; the markdown renderer's NUL sentinels
  (the file was binary to git) replaced by a private-use escape, hrefs escaped once, emphasis
  passes kept out of attributes; SSIM-unchanged no longer reads as "no data"; the player strip is
  picked up from `gauntlet/out/player` (take.mjs rotates its capture dirs) only when rendered from
  the take's commit, pose names validated; one undecodable sheet no longer aborts the evidence
  export; evidence dates come from git; ultra-wide sheets get their own aspect ratio; the variant
  patcher neutralises the per-bole override bands (they stayed narrower than an 18 / 25 m default)
  and raises NEAR_CANOPY_MAX_Y with the canopy radius. 8 tests green; QA screenshots clean
  (`art/monitor/fable-6-2026-09-19/`).
- 2026-09-19 21:35 UTC — `a606ad4` the director's cut on the monitor: `site/js/cut.js` (headline
  strip + per-view SSIM chips), `evidence.js` (round / survey gallery with the README rendered,
  lanes, before/after cards), `player.js` (player-height strip, borrowed when a take has none),
  `lightbox.js`, `markdown.js`, `headline.js` (pure, shared with node); `data.js` loads
  `evidence/index.json` and derives headline / round for older takes; the play link pinned to
  `takes.play.sha`. `monitor.mjs`: headline / round on the record, `syncEvidence`,
  `syncPlayerStrip`, `takes.play`; 7 tests green (`node --test gauntlet/scripts/lib/monitor.test.mjs`).
  `site/tools/player-strip.mjs` renders the strip through `broll.mjs`. `perftrace.mjs` records the
  LOD pools per chunk (`poolSeries`) and a `--note`. PR #19 (draft → world branch).
- 2026-09-19 21:30 UTC — native baseline trace of take-0116 (`gauntlet/perf/r48/trace-0116-baseline.json`,
  2400 frames, `--finish`): step 142 ms median (GPU finish 100 ms of it), 9.16 M tris median in
  play mode, canopy pool at its 64 MB cap with 264 builds / 504 evictions on the walk, build chunks
  up to 232 ms against the 3 ms budget. Box at ~100 % CPU from other apps throughout (`load.log`).
- 2026-09-19 19:30 UTC — onboarded: branch `agent/fable-6-monitor-perf` off
  `cursor/kokiri-world-phase1-f65e` `38f430ea`; typecheck + build green; sealed world `973a21e`
  built in a detached worktree for the profiling half.

## Important decisions
- Perf numbers are native (Radeon 780M, headless Chrome, D3D11 via `ZR_NATIVE_GPU=1`) and are
  only comparable with Astra's and owner-fable's native runs, never with the monitor's
  SwiftShader takes. Every table states the box load at the time (sibling agents capture on the
  same laptop).
- LOD-distance ablations are measured on scratch builds of the worktree (constants patched, never
  committed); the lane does not edit `src/world/**`.
- The monitor's new data (evidence gallery, player strip, headline) is generated by
  `monitor.mjs` at publish time so nothing changes on the `monitor` branch until fable-cursor
  publishes with this code; the site degrades gracefully when the data is absent.

## Known issues
- Native path on the laptop: two puppeteer Chrome launches within seconds of each other detach one
  page ("frame got detached" / "Navigating frame was detached" at `openWorld`'s first `goto`);
  every capture of mine runs alone now, `site/tools/player-strip.mjs` retries, and
  `lib/browser.mjs` (shared) would benefit from perftrace's same-origin pre-navigation — asked in
  the INBOX brief.
- `take.mjs` rotates its capture directory, so a player strip written into `gauntlet/out/last`
  before a publish never reaches the published dir; `monitor.mjs` picks it up from
  `gauntlet/out/player` (or `<takeDir>/player`) when its `sha` is the take's commit.
- The take-0116 player strip (14 native poses, `gauntlet/perf/r48/player-0116/index.json`) is on
  the monitor only in the PR's screenshots (a local copy of the data); it reaches the live site
  when a take is published with this code and a strip staged under `gauntlet/out/player`.

## Recommended next work
- fable-cursor: the `lod-1` brief lands in the INBOX when `docs/PERF_2026-09-19.md` is in.

## Last updated
2026-09-19T19:30:00Z
