# Fixed foot target after an extra root drop

The production guard now reads the retained world foot target when computing its vertical slack. Its LF-normalized source SHA256 is `439ad6a48b8740fdbe6407ee6a782ffaa61cce86af43d4ee55f4d5b3007ae72b`; the prior raised-heel guard was `9eacc0538670e1fa75e13d08e0c0793ba5a7e38c1869b1621e428edfcca4e052`. The isolated proposal files remain local; the existing tracked portable check includes the regression.

The independent default-asset replay preserves all 1,320 recorded frames, including joints, root, ankle rotations, pins, full-foot contacts and per-frame surface-query counts. All 537 low-sole and 4,701 fully foot-owned vertices stay clear; minimum gaps remain +1.186769 mm uphill / +1.264448 mm downhill, with no reach clamps. [Compact source/report receipts and exact-comparison result](validation.json). This establishes preservation on the tested route; the synthetic root-drop regression demonstrates the defect. It does not demonstrate improved stair posture. The separate 600-frame flat-run check also passes with unchanged motion and exact protected matrices. Typecheck/build pass (`index-BZ2VyYJT.js`).

The per-foot stage creates a world ankle target by subtracting the rotated sole marker from `soleP + delta`. The later `extraDrop + overlayDrop` stage lowers the root and the cached hip, knee, ankle and sole positions, while retaining the world target and `delta`. The subsequent IK solve preserves `qTilt * qAnkle`. Therefore, `soleP.y + delta` in the hip guard is stale by the root drop: it is no longer the requested sole height. The guard's target, quaternion and geometric clearance checks already use the retained endpoint.

The correction reads `leg.target.y + _hipFootprint[soleIndex + 1]` after the existing contact initialization, which already computed that rotated sole-marker offset. It preserves `leg.g + leg.hold` as the lower envelope. It adds no surface queries, quaternion work or allocations. This is the desired endpoint height used by the existing guard; it does not change reach clamping or claim that an unreachable target equals the solved ankle.

The saved default `4dcf89c5` player report contains two ascent frames and 23 descent frames with a nonzero recorded extra drop. Descent frame 601 also records a hip turn of 0.3848 radians and an extra/attack drop of 0.0006 m. Those audit values are rounded; the internal pre-guard endpoint was not saved there. This identifies an exercised code path, not a measured pose improvement. The separate CLEAR-interval study is not evidence for this bug: its problematic frames have zero extra drop.

## Small portable regression

The existing `2026-09-21-complete-foot/check.mjs` executes the raw source's contact initializer, rotated marker and slack expression. The fixture has nonidentity ankle and tilt quaternions, a fixed world ankle target, and a 40 mm downward translation of the cached sole position.

| Fixture | Previous source | Corrected source |
| --- | ---: | ---: |
| Slack before root drop | 50 mm | 50 mm |
| Slack after root drop, same world foot target | 10 mm | 50 mm |
| A 20 mm ankle lowering, with clear footprint | Incorrectly exceeds scalar budget | Allowed |
| A 60 mm lowering that penetrates the floor | Raw footprint guard rejects | Raw footprint guard rejects |

The check passes the integrated source and fails the previous source at `Root drop must not consume fixed-target foot clearance`. All existing family, rigid heel and endpoint checks remain active. The actual-player comparison used the same frozen geometry and controls as its saved raised-heel baseline, with this scalar expression as the only runtime change. Raw frame dumps remain local; their hashes and the effective baseline source map are retained in the compact receipt. No GPU capture or new asset was needed.

From a repository checkout with dependencies installed:

```powershell
node art/characters/link/progress/2026-09-21-complete-foot/check.mjs
```

The check needs no historical model, Git revision or local player report.
