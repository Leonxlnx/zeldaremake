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
```

## takes.json

```jsonc
{
  "project": "zeldaremake",
  "updatedAt": "2026-09-09T12:00:04Z",
  "monitorCadenceMinutes": 60,           // site turns the banner red when updatedAt is older than 2×
  "heartbeat": { "at": "…", "reason": "…" },   // optional: last no-new-take refresh of updatedAt (CI same-sha run)
  "takes": [                             // chronological, oldest first
    {
      "id": "take-0007",                 // zero-padded, monotonic
      "number": 7,
      "at": "2026-09-09T12:00:04Z",
      "agent": "fable-cursor",           // .agents/<agent>.md
      "sha": "9f2c…", "shortSha": "9f2c1ab", "branch": "cursor/kokiri-world-phase1-f65e",
      "subject": "Stairs: carve 18 individual slabs",   // commit subject
      "phase": 1,
      "items": ["W02", "W15"],           // rubric items this take targeted (claimed)
      "note": "Reference frame 1 shows … ours still …",  // ≥ 200 chars, the agent's comparison note
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
