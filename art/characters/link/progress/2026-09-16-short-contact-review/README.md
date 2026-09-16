# Shorter-contact run

Asset `611c44253d6ae4fcd182adf5c15a98f94c3bfa20305bcd4202546173be9c1719` retains speed3.9m/s, stride1.82m, and cycle28/60s. Each foot's stance fraction changes0.25→0.20. The shorter planted path lets the pelvis stay higher without the prior reach-driven drops. Added flight bounce decreases45→12mm. The existing leg solver reconstructs all leg poses; no runtime smoothing is added.

The native action is baked at120fps over frames0–56, preserving the cycle duration. This reduces between-key planted-ankle interpolation error. The editable action is `run-contact-action.blend`; inspect it at120fps. Full local source: primary workspace `art/characters/link/experiments/2026-09-13/source-runtime/run-contact-study.blend`, scene `Link | shorter contact run study`.

Only run hip/leg channels change fromace15add. Other run channels and timing, all other clips, mesh, weights, bind matrices, images, and reviewed blink data remain exact. Export transfers only animation channels into the retained GLB; do not substitute the full native export, which lacks the separate blink-normal postprocess.

Validation:

- Native loop closes exactly; stance solver residual3.10e-8m, bone-length error4.88e-8m.137-phase clearance passes: minimum sole height4.06→5.71mm. Minimum knee-to-hip vertical separation63.4→91.0mm.
- 57 matching phases: regional triangle-contact total 27,253→24,286, peak 1,325→750. Thirty phases worsen. This is a heuristic count, not penetration depth or a claim that the garment is fixed. Matched native views show reduced peak bunching.
- 300 actual-game frames complete without page errors or reach clamps. Walking measurements stay unchanged. Running peak vertical hip step 31.59→9.59 mm; maximum second difference 26.25→12.90 mm. Stopping peak step worsens 15.65→18.56 mm while maximum second difference improves 21.91→12.50 mm; its 95th-percentile step improves 13.06→10.32 mm.
- The audited run shoe minimum gap changes −6.4→−7.0 mm, with no samples below −20 mm. Ground contact remains imperfect. Video capture contains 150 frames at 30 fps, checked with ffprobe. Still 152 and matched native renders were inspected; metrics are not a substitute for subjective animation review.
- Stair clips and runtime logic are unchanged from the preceding 1,620-frame review, whose 1,320 stair records matched its baseline. That full sweep was not repeated for this run-only follow-up.

The lower-pelvis smoothing experiment was rejected because it increased cloth contacts despite better torso measurements. Character hair, facial detail, garment topology, and final animation quality remain unfinished.
