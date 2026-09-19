# Director's Monitor — data schema

The monitor is a static site (`site/`) that reads JSON + images produced by the gauntlet. Data
lives on the orphan git branch **`monitor`** (append-only), fetched into `.monitor/` locally by
`npm run take -- --publish` and by CI. The Pages deploy = `site/` static files + the monitor data
copied under `data/`.

```
<site root>/
  index.html, app.js, styles.css …          (from site/)
  data/takes.json                            (from monitor branch)
  data/ledger.json                           (copy of gauntlet/ledger.json at publish time)
  data/rubric.json                           (copy of gauntlet/rubric.json)
  data/agents.json                           (front-matter of .agents/*.md, generated)
  data/reference/frames/<viewpoint>.jpg      (copy of reference/frames/)
  data/reference/frames/timeline/t_*.jpg     (+ index.json: { "frames": [{ "file": "t_001.jpg", "seconds": 0.5 }, …] })
  data/takes/<take-id>/<viewpoint>.jpg       (1280×720 JPEG q82, from the renderer)
  data/takes/<take-id>/<viewpoint>.compare.jpg  (reference | ours | previous strip)
  data/takes/<take-id>/score.json
  data/takes/<take-id>/audit.json
  data/takes/<take-id>/player/<pose>.jpg     ("what the player sees": player-height poses, JPEG q82 ≤ 1280 px)
  data/takes/<take-id>/player/index.json     (the strip's poses; the same record is embedded as takes[].player)
  data/evidence/index.json                   (the evidence gallery: every round's sheets + the survey reports)
  data/evidence/<set>/<sheet>.jpg            (art/environment/round<N>-review/*.jpg, survey<N>/*.jpg, ≤ 1280 px JPEG q78)
  data/evidence/<set>/README.md              (the round's README / the survey's REPORT, copied verbatim)
  play/index.html …                          (the walkable build of the take named in takes.json `play`)
```

## takes.json

```jsonc
{
  "project": "zeldaremake",
  "updatedAt": "2026-09-09T12:00:04Z",
  "monitorCadenceMinutes": 60,           // site turns the banner red when updatedAt is older than 2×
  "heartbeat": { "at": "…", "reason": "…" },   // optional: last no-new-take refresh of updatedAt (CI same-sha run)
  "play": {                              // optional: which take's build sits under play/ (set when the captured dist was published)
    "takeId": "take-0116", "sha": "973a21e…", "shortSha": "973a21e", "branch": "cursor/kokiri-world-phase1-f65e",
    "at": "2026-09-19T05:38:11Z", "path": "play/index.html"
  },
  "takes": [                             // chronological, oldest first
    {
      "id": "take-0007",                 // zero-padded, monotonic
      "number": 7,
      "at": "2026-09-09T12:00:04Z",            // chain ordering time (= capturedAt unless resequenced)
      "capturedAt": "2026-09-09T12:00:04Z",    // when the frames were captured/recorded; cards show this
      "resequenced": false,                    // true when a concurrent publish moved `at` behind a newer head
      "agent": "fable-cursor",           // .agents/<agent>.md
      "sha": "9f2c…", "shortSha": "9f2c1ab", "branch": "cursor/kokiri-world-phase1-f65e",
      "subject": "Stairs: carve 18 individual slabs",   // commit subject
      "phase": 1,
      "items": ["W02", "W15"],           // rubric items this take targeted (claimed)
      "note": "Reference frame 1 shows … ours still …",  // ≥ 200 chars, the agent's comparison note
      // the director's cut (site/js/headline.js, shared with monitor.mjs): the note's first sentence
      // without its "Round N on <sha> —" prefix, ≤ 200 chars (the commit subject for the CI auto-note),
      // and the round the note / subject names; the site derives both when a take lacks them
      "headline": "The survey-2 re-rank, evidence-gated: every lane had to change the exact pose it was briefed on…",
      "round": 46,                        // null when the note names no round
      "player": {                         // optional: the take's "what the player sees" strip (null when none was published)
        "index": "takes/take-0116/player/index.json",
        "count": 14, "renderer": "native GPU (D3D11)", "capturedAt": "2026-09-19T21:40:00Z", "sha": "973a21e…",
        "width": 1280, "height": 720, "posesFile": "site/tools/player-poses.json",
        "poses": [ { "name": "w00-spine-f", "label": "Plaza, up the spine", "file": "takes/take-0116/player/w00-spine-f.jpg",
                     "p": [0.94, 1.46, 15.5], "t": [-0.3, 1.31, 5.58], "fov": 46 } ]
      },
      "slate": {                          // film-slate labels for the UI
        "scene": "A",                     // hero viewpoint letter the take focused on
        "sceneTitle": "The Stairs",
        "take": 7,
        "director": "fable-cursor",
        "camera": "SwiftShader · 1280×720",
        "roll": "phase-1"
      },
      "shots": [
        {
          "viewpoint": "A_stairs",
          "label": "The Stairs",
          "refSeconds": 1,
          "diagnostic": false,             // optional; true only for a camera whose reference frame is a material/lighting
                                           // reference and not a matched composition (none since take-0019: E = held B
                                           // camera, F = eye level up the stairs) — the site would label it DIAGNOSTIC
          "thumb": "takes/take-0007/A_stairs.thumb.jpg",   // optional 320×180 for filmstrip/reel
          "image": "takes/take-0007/A_stairs.jpg",
          "compare": "takes/take-0007/A_stairs.compare.jpg",
          "reference": "reference/frames/A_stairs.jpg",
          "previous": "takes/take-0006/A_stairs.jpg",    // null on the first take
          "sha256": "…",                                 // of the PNG the renderer produced
          "metrics": { "ssim": 0.31, "phashDistance": 24, "hueDiffDeg": 9.2, "satDiff": 0.05,
                       "lumDiff": 0.08, "sharpnessRatio": 0.71, "skyFraction": 0.12,
                       "overexposedFraction": 0.002, "purpleFraction": 0.001 },
          "deltas": { "ssim": +0.04, "phashDistance": -2 },   // vs previous take, same viewpoint
          "depth": { "skyFraction": 0.12, "farLayerCount": 3, "maxBucketBeyond20m": 0.06 },  // hero viewpoints only
          "captureMs": 38000,
          "callouts": [                                       // annotation pins on OUR image (0..1 coords)
            { "x": 0.62, "y": 0.47, "label": "18 individually cut slabs", "item": "W02", "kind": "new" },
            { "x": 0.18, "y": 0.35, "label": "lantern branch still missing", "item": "W14", "kind": "todo" },
            { "x": 0.50, "y": 0.80, "label": "grass creeping into joints", "item": "W21", "kind": "improved" }
          ],
          "refCallouts": [                                    // optional pins on the REFERENCE image
            { "x": 0.70, "y": 0.40, "label": "stairs read as separate worn slabs", "kind": "reference" }
          ]
        }
      ],
      "score": {
        "passed": 14, "total": 50, "phaseRequired": 42, "phasePassed": 12,
        "items": { "W02": { "status": "pass", "value": 18, "threshold": "16..20", "delta": "fail→pass" } }
      },
      "stats": { "drawCalls": 412, "triangles": 5120000, "captureMs": 38000, "renderer": "SwiftShader" },
      "attestation": { "source": "ci" | "local", "runId": "1234567", "workflow": "monitor", "url": "https://github.com/…/actions/runs/…" },
      "valid": true,                       // false when anti-cheat tagged it (see `invalid`)
      "invalid": null                      // e.g. "D2 regression" | "B3 audit mismatch"
    }
  ]
}
```

`callouts[].kind` ∈ `new | improved | todo | regression | reference`. Agents supply callouts via
`--callouts path.json` or inline `--callout "A_stairs:0.62,0.47:W02:new:18 individually cut slabs"`;
`take.mjs` also auto-generates callouts from rubric items that flipped pass/fail.

## agents.json

```json
{ "agents": [ { "agent": "fable-cursor", "runtime": "…", "github": "…", "status": "active", "branch": "…", "updated": "…", "currentTask": "first paragraph of ## Current task", "file": ".agents/fable-cursor.md" } ] }
```

## evidence/index.json

Written by `monitor.mjs syncEvidence` on every publish from the code checkout's
`art/environment/round<N>-review/` and `art/environment/survey<N>/` directories (the lanes'
before/after sheets and the survey reports — comparison evidence, never runtime content). Images
are downscaled once to ≤ 1280 px JPEG (idempotent by source content hash); the README / REPORT is
copied verbatim and rendered by the site (`site/js/markdown.js`). Sets are append-only.

```jsonc
{
  "generatedAt": "2026-09-19T21:00:00Z",
  "source": { "sha": "38f430ea…", "shortSha": "38f430e", "branch": "cursor/kokiri-world-phase1-f65e" },
  "sets": [
    {
      "id": "round46-review", "kind": "round",   // "round" | "survey"
      "round": 46,                               // the N of the directory name
      "title": "Round 46 — evidence-gated on the survey-2 poses",   // first `# heading` of the README
      "text": "evidence/round46-review/README.md",                  // null when the set has no markdown
      "takes": ["take-0115", "take-0116"],       // every take-NNNN the README names (the site links them)
      "updatedAt": "2026-09-19T05:40:00Z",       // newest source image mtime
      "sheets": [
        { "file": "evidence/round46-review/trees29-w07-spine-l.jpg", "source": "trees29-w07-spine-l.jpg",
          "hash": "0f3a…", "srcBytes": 182334, "w": 976, "h": 541, "bytes": 96412,
          "name": "trees29-w07-spine-l", "lane": "trees", "laneRaw": "trees29",   // from the file name
          "pose": "w07-spine-l",                   // the survey pose when the name carries one, else null
          "pairKey": null, "pairRole": null }      // "…-before" / "…-after" sheets share a pairKey (the site folds them into one card)
      ]
    }
  ]
}
```

## takes/<id>/player/index.json

The "what the player sees" strip of a take: player-height poses (eye height 1.45 m, a curated
subset of the survey manifest in `site/tools/player-poses.json`) rendered by
`node site/tools/player-strip.mjs --dist <dist> --out gauntlet/out/player` from the same commit
before the publish; `take.mjs --publish` (via `monitor.mjs syncPlayerStrip`) picks the strip up
from `gauntlet/out/player/` (or `<captureDir>/player/`), refuses one whose `index.json` `sha` is
not the take's commit, converts the PNGs to JPEG under `data/takes/<id>/player/` and embeds the
same record as `takes[].player`. Pose names are file names (`[A-Za-z0-9][A-Za-z0-9._-]*`). A take
without a strip borrows the nearest earlier one on the site (labelled as borrowed); a pose that
also exists in the previous strip gets a this-take ↔ previous toggle in the lightbox. Evidence
sets carry `updatedAt` = the directory's last commit date (null outside a git checkout).
