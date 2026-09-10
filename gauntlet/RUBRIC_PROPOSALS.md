# Rubric change proposals

`gauntlet/rubric.json` is hash-locked. Agents may not edit it. If a threshold is wrong (too easy,
impossible, or measuring the wrong thing), write a proposal here and the owner (`Leonxlnx`) decides.
Approved changes are committed by the owner with the trailer `Rubric-Change-Approved-By: Leonxlnx`
and `node gauntlet/scripts/rubric-lock.mjs --write`.

Format:

```
## <date> — <agent> — <item id>
Current: …
Proposed: …
Why: … (evidence: take id / image path)
Owner decision: pending | accepted <commit> | rejected (reason)
```

## 2026-09-10 — fable-cursor — W04 (probe at (9, −12.5))
Current: `{ "type": "probe", "x": 9, "z": -12.5, "height": 1.2, "tolerance": 0.35 }` — Saria's house
stands on a 1.2 m terrace reached by a 4-step stair.
Proposed: `height: 0.4, tolerance: 0.35` (house threshold ≈ path level, one or two low steps), with
`layout.terraces.houseTerrace.height` and `stairs.house` adjusted to match.
Why: in reference frames B (14 s) and E (24 s) the doorway sits directly on the flagstone path —
the door bottom projects to y ≈ 0.65 with the camera at ~1.6 m, i.e. the threshold is at path level
(≤ 0.4 m up). Our door projects to y ≈ 0.54 in B because of the 1.2 m terrace (evidence:
`gauntlet/tmp/sbs-B_house.png` top vs bottom; take-0018 B/E captures on the monitor). The terrace
also puts our 4-step "house" stair in the centre of B where the reference has a flat path. The
probe height was authored before the frame analysis and now pins the wrong geometry. The
right-side short stair of frame D (0.85–1.0, 0.55–0.78) can stay as a 2-step rise.
Owner decision: pending
