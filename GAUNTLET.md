# THE GAUNTLET — iteration loop, 50-item rubric, and anti-cheat

The gauntlet is the loop every agent runs, the rubric it is scored against, and the machinery
that makes the score impossible to fake. Nobody — human or agent — declares the world "done".
`npm run gauntlet:verify-exit` does, in CI, with an attested report.

Read this whole file once. Then run the loop until it exits on its own.

---

## 1. The loop

One iteration = one **take**. A take is a commit + a headless capture of every saved viewpoint +
an automated score + a written comparison note. Takes are appended to `gauntlet/ledger.json`
(hash-chained) and published to the Director's Monitor.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 0. SYNC      git fetch --all; read AGENTS.md, .agents/*, PROJECT_STATE.md,  │
│              open PRs, gauntlet/claims.json                                 │
│ 1. CLAIM     npm run gauntlet -- --claim W02,W15 --agent <id>              │
│              (claims expire after 3 h; overlapping claims → pick another)   │
│ 2. LOOK      open reference/frames/<shot>.jpg for the claimed items AND the │
│              latest take of the same viewpoint (gauntlet/out/last/ or the   │
│              monitor). Write down the 3 biggest differences BEFORE coding.  │
│ 3. BUILD     implement in your owned directory only; npm run typecheck      │
│ 4. TAKE      npm run take -- --agent <id> --items W02,W15                   │
│              --note "…≥200 chars of specific reference differences…"        │
│              → builds, captures 6 viewpoints, compares to reference,        │
│                scores all 50 items, appends to the ledger, writes           │
│                gauntlet/out/last/, and (with --publish) pushes the take to  │
│                the monitor branch                                           │
│ 5. JUDGE     did the claimed items' metrics improve? did anything regress?  │
│              a regression on a previously-passing item FAILS the take       │
│ 6. COMMIT    git add -A && git commit && git push; update .agents/<id>.md   │
│ 7. REVIEW    review ONE visual item of the OTHER agent's latest take        │
│              (npm run gauntlet -- --review W25 --verdict pass|fail          │
│               --evidence <path> --agent <id>) — you may not review your own  │
│ 8. REPEAT    go to 0. Exit only when `npm run gauntlet:verify-exit` passes  │
└────────────────────────────────────────────────────────────────────────────┘
```

Minimum cadence: one take per hour of work. If an hour passes without a take, the ledger shows
the gap and `verify-exit` counts it against the coverage requirement (§4.E).

### What "improve" means

Every rubric item has a machine metric or a reviewer verdict. A take improves an item when its
metric moves toward the threshold. `score.mjs` prints a delta table against the previous take.
Attack the largest gaps first; if a system is fundamentally weak, rebuild it rather than tuning.

---

## 2. The rubric (50 items)

The machine-readable rubric is `gauntlet/rubric.json`; the human-readable version is
`gauntlet/RUBRIC.md`. The JSON is hash-locked (`gauntlet/RUBRIC.lock`). Items are grouped:

| Range | Group | Count |
| --- | --- | --- |
| W01–W07 | Composition, terrain, ground | 7 |
| W08–W14 | Trees | 7 |
| W15–W22 | Vegetation & wind | 8 |
| W23–W24 | Rocks | 2 |
| W25–W29 | Structures | 5 |
| W30–W37 | Lighting, atmosphere, image match | 8 |
| W38–W42 | Performance & engineering | 5 |
| C01–C05 | Character (Phase 2) | 5 |
| U01–U03 | UI (Phase 3) | 3 |

Verification kinds:

- `auto` — computed by `gauntlet/scripts/score.mjs` from the capture (`audit.json`, `stats.json`,
  pixels, terrain probes). Deterministic, no opinion.
- `visual` — a reviewer compares the capture with the reference frame against the listed
  criterion and records a verdict with evidence. **The reviewer may not be the author.**
- `both` — auto gate must pass AND a visual verdict must be recorded.

Phase 1 exit requires every W item to pass. C and U items are scored but not required until their
phase.

---

## 3. Commands

```bash
npm run build                      # typecheck + vite build
npm run capture                    # headless capture → gauntlet/out/capture/
npm run compare                    # metrics vs reference frames for the last capture
npm run score                      # 50-item score for the last capture (+ delta vs previous)
npm run anticheat                  # all integrity checks (also runs in CI)
npm run take -- --agent <id> --items W02 --note "..." [--publish]
npm run gauntlet                   # anticheat + capture + compare + score, one shot
npm run gauntlet:verify-exit       # can Phase 1 be declared complete? (exit code)
npm run gauntlet -- --claim W02,W15 --agent <id>
npm run gauntlet -- --review W25 --verdict pass --evidence gauntlet/out/last/B_house.png --agent <id>
```

---

## 4. Anti-cheat

The purpose is simple: the only way to raise the score is to make the world better. Each rule
lists *what it prevents* and *how it is enforced* (`gauntlet/scripts/anti-cheat.mjs` unless noted).

### A. Rubric integrity — you cannot move the goalposts

| # | Rule | Enforcement |
| --- | --- | --- |
| A1 | `rubric.json` is hash-locked | `RUBRIC.lock` must equal `sha256(rubric.json)`; CI fails otherwise |
| A2 | Thresholds can only get stricter | `rubric.baseline.json` is the frozen original; any threshold that is easier than baseline fails |
| A3 | Rubric edits need the human | a commit touching `rubric.json` must carry the trailer `Rubric-Change-Approved-By: Leonxlnx` and update the lock in the same commit; agents may propose changes in `gauntlet/RUBRIC_PROPOSALS.md` instead |
| A4 | Items cannot be deleted or re-numbered | item id set must equal the baseline's |

### B. Evidence integrity — you cannot fake the pictures or the numbers

| # | Rule | Enforcement |
| --- | --- | --- |
| B1 | Screenshots come from the renderer, never from disk | `capture.mjs` screenshots the live canvas; the take records `sha256` of each PNG and of `dist/`; the monitor rejects images whose hash is not in the ledger |
| B2 | Only CI-attested scores count | reports carry `attestation.source = "ci"` with the Actions run id + sha; local reports are `"local"` and cannot satisfy `verify-exit` |
| B3 | Audits are cross-checked against the scene graph | e.g. `vegetation.grassInstances` must be ≤ the instance count actually found under the `vegetation` group; `hardscape.flagstones` must match geometry counts; mismatches fail the item **and** the take |
| B4 | Placement claims are spot-checked | systems expose `samplePositions`; `score.mjs` probes them against the terrain mask (no grass on flagstones, tree bases within 3 cm of ground) |
| B5 | Determinism gate | two captures of the same build must differ by < 0.5 % pixels (W41); a flaky render cannot hide behind noise |
| B6 | Console must be clean | any `pageerror` or console error during capture fails W42 |

### C. Content integrity — you cannot paste the reference in

| # | Rule | Enforcement |
| --- | --- | --- |
| C1 | No reference frames as textures | every image in `public/`, `src/`, `dist/` is perceptually hashed and compared with `reference/phash.json`; Hamming distance ≤ 12 fails |
| C2 | No video/iframe/matte scenery | `src/` is scanned for `VideoTexture`, `<video`, `<iframe`, `.mp4`, `twimg`, `x.com`, imports from `reference/`, data-URI images > 50 KB; runtime `audit.scene.forbidden` must be empty |
| C3 | No flat backdrop pretending to be depth | `__ZR__.depthHistogram()` at each hero viewpoint: excluding sky, no single 1 % depth bucket beyond 20 m may hold > 35 % of pixels |
| C4 | Assets are credited | every file in `public/textures/**` must appear in `public/textures/CREDITS.md` with a licence |
| C5 | No Nintendo assets | filename/metadata scan for `nintendo|zelda|oot|kokiri.*\.(glb|gltf|png)` originating outside `src/` generators; any hit requires a `CREDITS.md` line proving original authorship |

### D. Process integrity — you cannot shortcut the loop

| # | Rule | Enforcement |
| --- | --- | --- |
| D1 | Ledger is an append-only hash chain | each entry stores `prevHash`; CI recomputes the chain; a broken chain fails everything |
| D2 | No regressions | a take that flips a previously-passing item to fail is marked `regressed` and does not count toward D4 |
| D3 | Claims before work | takes must reference claimed items; the claim must predate the take |
| D4 | Minimum iterations | `verify-exit` needs ≥ 24 valid takes with distinct commit SHAs |
| D5 | Real diffs | each counted take must change ≥ 20 lines under `src/` or `public/` vs the previous counted take |
| D6 | Written comparison notes | each take's `--note` must be ≥ 200 chars and < 0.7 Jaccard-similar to any earlier note (no copy-paste) |
| D7 | Cross-review only | visual verdicts are invalid if `reviewer == take author`; each agent must file ≥ 1 review per 3 takes |
| D8 | No self-declared completion | `PROJECT_STATE.md` may only say Phase 1 is complete if `gauntlet/reports/verify-exit.json` exists with `attestation.source = "ci"` and `pass = true`; CI diff-checks the statement |

### E. Effort integrity — the loop cannot end early

| # | Rule | Enforcement |
| --- | --- | --- |
| E1 | ≥ 10 hours of active build | first→last valid take ≥ 10 h apart **and** takes present in ≥ 10 distinct clock hours |
| E2 | Every major pass has evidence | the 21 iteration passes in `docs/PROMPT_PHASE1.md` map to rubric groups; each group needs ≥ 2 takes that targeted it (`--items`) |
| E3 | Hourly monitor | CI publishes a take every hour from `main`; a stale monitor (> 2 h) turns the site banner red and blocks `verify-exit` |

### What happens on a violation

`anti-cheat.mjs` exits non-zero and prints the rule id. CI marks the commit red. The ledger entry
(if any) is tagged `invalid: <rule>` and never counts. Fix the cause — not the check.

---

## 5. Take anatomy

```
gauntlet/out/last/
  A_stairs.png … F_canopy.png       renderer screenshots (1280×720)
  A_stairs.compare.png …            [reference | ours | previous] strip with metrics burned in
  audit.json                        every system's audit + scene graph rollup
  stats.json                        draw calls, triangles, git info, renderer string
  compare.json                      per-viewpoint SSIM / pHash / hue / saturation / sharpness / depth histogram
  score.json                        50 items: status, value, threshold, delta vs previous take
  console.log
```

`ledger.json` entry (abridged):

```json
{ "id": "take-0007", "at": "2026-09-09T12:00:04Z", "sha": "…", "agent": "fable-cursor",
  "items": ["W02","W15"], "note": "…", "score": {"passed": 14, "total": 50},
  "images": {"A_stairs": "sha256:…"}, "distHash": "sha256:…",
  "attestation": {"source": "local"}, "prevHash": "sha256:…", "hash": "sha256:…" }
```

---

## 6. Exit

`npm run gauntlet:verify-exit` passes when, using only CI-attested ledger entries:
all 42 W items pass on the latest take, D4/D5/D6/D7 hold, E1/E2/E3 hold, the chain is intact and
the anti-cheat is green. Then — and only then — update `PROJECT_STATE.md` to say Phase 1 is complete
and open the Phase 2 (character) branch.

Until then: another take.
