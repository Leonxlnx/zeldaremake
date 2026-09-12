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

## 2026-09-12 — fable-cursor — W04 (plateau probe at (18, −4))
Current: `{ "type": "probe", "x": 18, "z": -4, "height": 5.4, "tolerance": 0.45 }`.
Proposed: move the probe ≈ 2.5 m further along the stair axis, e.g. `{ x: 20.5, z: -5.5, height: 5.4,
tolerance: 0.45 }`, or word it as "≥ 4.95 m within 3 m past the top tread".
Why: a nosing-sequence fit of reference frames 1 s and 8 s (20 lit risers, rms ≤ 0.6 px) gives a
flight whose foot is ≈ 10 m before camera A and whose run is ≈ 12.4 m along the view (tread ≈ 0.68 m,
slope 22–25°; ours is 32.7° with 0.42 m treads). The probe sits 0.1 m past our top tread and 3.5 m
right of the axis, so it caps the run at ≈ 11 m from that foot; the reference proportions cannot be
laid out under it. Erosion already eats 0.27 m at the probe (5.13 measured of 5.4 authored), leaving
0.18 m of the 0.45 m tolerance. Evidence: analysis of take-0059 A/F vs reference (measurements in
`.agents/fable-cursor.md` tick 45); `gauntlet/tmp/proj.mjs` projections.
Owner decision: pending

## 2026-09-12 — fable-cursor — W02 (step count / width)
Current: title "18 worn stone steps"; `stairways[id=main].steps between [16, 20]`.
Proposed: `between [18, 22]`, title "20 worn stone steps", width 3.0–3.3 m in the description.
Why: both reference frames show 20 risers (uniform-flight fit rms ≤ 0.6 px) and a flight 3.1–3.3 m
wide; 20 is the ceiling of the allowed range with no headroom for a landing step.
Owner decision: pending

## 2026-09-12 — fable-cursor — W01 (shot A composition auto-check)
Current: 6 stair points inside x 0.45–1, y 0.1–0.95 (≥ 80 %); bough points inside the left region.
Proposed: add `top-centre of stairs.main y ∈ [0.17, 0.27]` and `bottom-centre y ∈ [0.58, 0.68]`
(reference: top nosing (0.755, 0.220), bottom nosing (0.695, 0.612)).
Why: the current region passes any flight in the right half and cannot see that our flight tops out
at y 0.267 (0.047 low) — the single largest composition miss in shot A.
Owner decision: pending

## 2026-09-12 — fable-cursor — W30 (sun azimuth)
Current: `sunAzimuthDeg between [-155, -105]` (behind-left of camera A).
Proposed: `between [-155, -105] or [215, 275]` (i.e. also allow ahead-right, the reference's key
direction per `reference/ANALYSIS.md` — sun ≈ 245° ± 25°), or drop the azimuth pin and keep
elevation + shadows.
Why: with the pinned azimuth our risers are lit and treads shaded; the reference has dark risers
(`#453e32`) and lit nosings — the inverse — which flattens the flight and contributes to the
"short stair" reading. The footage's light is camera-relative across shots (noted 2026-09-10), so a
single world azimuth cannot match every frame; the pin should at least admit the hero frame's.
Owner decision: pending
