# Stair contact study on integrated source 6c13f70c

**The corrected outer-timber replay fails contact and natural posture.** At 2026-09-21 17:30 UTC the knee audit discovered that all 20,160 timber tube-side triangles were wound inward, opposite their authored normals. The default FrontSide rays missed the outer crown. The earlier positive-gap timber result below is superseded; it was not valid physical-clearance evidence. Root reversed only the side indices, preserving all 1,120 cap triangles. `knee-peaks/log-winding-check.mjs --before` fails the old source; the current source passes with all 21,280 triangles aligned and FrontSide/DoubleSide peak rays identical. The original negative evidence remains in `knee-peaks/log-winding-check.json` and `log-winding-check-before.json`.

With outward timber, exact e3ef + support + guard has **139/470 ascent frames penetrating, worst −36.001 mm at 129**, and **119/470 descent frames penetrating, worst −16.019 mm at 522**. This change corrects what the ray can see; root, knee and planted-motion traces are unchanged. Ascent 129 is planted R, whose SINK support remains below the physical crown. Descent 522 hits the existing 0.3 m correction limit. Raw results are in `knee-peaks/outward-logs/stair-swing-working.json`. The guard is a final hip-turn contact check, not a replacement for true stance support or a natural-foot-placement solution.

The integrating agent applied the guard and support changes after review; this audit made evidence/test edits only. The adopted character sources match the replayed and TypeScript-checked compound sources after newline normalization (`compound-source-check.json`, `adopted-source-equality.json`). The remainder of this report preserves the historical progression and states the original tested geometry where applicable.

The stone-only pass was not a pass for the new rendered stairway. The production scene also contains `stairs-main-logs`. Its geometry was absent from both the older CPU fixture and `ground.attachSurface`. Root identified the mismatch during integration; the expanded fixture builds the same `buildLogNosings(def, WORLD.seed)` mesh used by hardscape and raycasts both meshes.

The current negative control uses exactly 14,085 stone triangles and 21,280 timber/stake triangles. Their position hashes are `0f864dc2…` and `d7ce71da…`; full hashes, index hash, sampled grid and source hashes are in the JSONs. It does not instantiate the rest of the world's scenery.

| Asset, source sampler without logs | Ascent minimum | Descent minimum | Frames penetrating timber on descent |
| --- | ---: | ---: | ---: |
| `ea93932d…` accepted native run asset | +2.647 mm | −67.323 mm | 8; worst −54.532 mm at 249 |
| `e3ef74a0…` combined upright-stairs asset | +2.647 mm | −74.451 mm | 4; worst −48.027 mm at 186 |

The original sampler can be 244.85 mm below a raycast timber top at the front overhang, where the point falls outside the analytic upper tread and original stone. These are measured misses, not a conjectural risk. See `logs-negative-control.json`, `ea939-with-logs/`, and `combined-with-logs/`.

The combined asset reduces peak knee bend from 162.351°→149.834° uphill and 155.031°→147.140° downhill in the unchanged sampler. Its largest uphill planted drift is 2.577 mm, compared with 6.744 µm before. Flat idle/walk/run lower-body skeleton hashes match. Therefore the claim that the newly combined export leaves contact unchanged is too strong.

With the **corrected timber support and guard**, the combined asset's minima are +2.661 mm uphill / +4.174 mm downhill. However, the higher sampled surfaces require peak knee bends of **174.670° uphill at 331 / 166.820° downhill at 375**, up to **9.135 mm** of planted drift uphill, and root steps of **30.946 / 23.446 mm**. The guard preserves every root Y, both peak knee bends, planted-drift maxima and flat hashes compared with timber support alone. Its seven-marker scratch stays in bounds and finite. These facts justify contact correctness, not natural-posture acceptance. `log-support-and-guard-summary.json` retains the full comparison.

The accepted `ea939…` asset plus both corrections also clears all measured markers, but retains six ascent reach clamps and ≈177° knee folds; prefer the composed asset only after native review. The `ad05…` torso candidate has identical 940-frame stair lower-body traces and flat lower-body hashes to `e3ef…` in the explicitly recorded source/sampler configuration (`torso-lower-body-invariance.json`).

The exact-mesh support regression samples 540 grid-center positions, including 58 actual timber hits. It fails the old source with **202.916 mm** missing support and passes the proposed inclusion with less than **0.00001 mm** underestimation. Stone-only surface values and analytic placement heights remain exactly equal at all 540 points. This is independent of the character clip and reuses the real mesh generators.

`hip-clearance.patch` and `verification.json` describe the separately verified final-footprint guard on the accepted asset **against stone only**. Its exact source passes TypeScript and matches the in-memory CPU proposal. It makes the 940 stone-only frame minima positive, preserves every root Y and the flat hashes, and fixes descent 274/449. At 449 the price is thigh flexion 104.857°→121.264° and a 47.448 mm higher knee. The patch remains a contact guard, not a complete natural-posture correction. The original 1703 report is preserved at `E:/zeldaremake-astra-link-run/art/characters/link/progress/2026-09-20-natural-run-audit/revalidated-1703/`.

All replays measure steady frames 120–589 per direction after warming from 80. The original dense native trace supplies X/Z and yaw. Changed stair-animation candidates reuse the already recovered clip phases; fitting their changed pelvis to the old pelvis would be invalid. Ground-source snapshots can be pinned with `--ground-ref=6c13f70c`, so an in-progress support-grid edit cannot silently alter the negative control. Eight actual extreme-sole markers are checked per pose; full boot-mesh, arbitrary-path and transition coverage still requires native validation.

The diagnostic and proposed source transform are copied into this directory. `motion-input.json` preserves, without rounding, the 1,320 stair input rows and only the fields the replay consumes from the original native trace. Its provenance records the full original manifest hash. `phase-reference.json` retains the exact recovered shifts. This makes the replay independent of an absolute path to the old worktree; historical raw outputs still record the original input path and hash.

```powershell
$env:ZR_NATIVE_GPU='0'
# Expected failure against source 6c13, then success against current timber inclusion.
node art/characters/link/progress/2026-09-21-stair-clearance/ground-log-contact-check.mjs --before
node art/characters/link/progress/2026-09-21-stair-clearance/ground-log-contact-check.mjs
# Current production source, exact composed asset, actual stone and timber meshes.
node art/characters/link/progress/2026-09-21-stair-clearance/stair-swing-diagnostic.mjs --working-source --with-logs --asset=art/characters/link/progress/2026-09-21-motion-integration/stairs-upright-candidate.glb --asset-sha=e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552 --phase-reference=art/characters/link/progress/2026-09-21-stair-clearance/phase-reference.json --manifest=art/characters/link/progress/2026-09-21-stair-clearance/motion-input.json --output-dir=art/characters/link/progress/2026-09-21-stair-clearance/rerun
```

Before production adoption, add `--production-proposal` to apply only the hip guard in Vite memory and choose a separate output directory. Do not add it after the guard already exists in the selected source. No renderer or production-file edit is involved. Native full motion validation, including transitions and visual posture, remains the integration gate.
