# Link hair review against the owner's new video

Native Blender comparisons, September16. Runtime remains24591126; neither candidate is promoted.

- `hair-before.png` / `hair-after.png`: current normal atlas with additional filtered relief from the previously authored native groom bake.228431pixels change; geometry and all pixels outside the mask remain exact beforePNG serialization. The gain is too small to address the broad sculpted hair forms. Rejected for delivery.
- `tips-after.png`:36head-bound rooted strands,4032triangles, maximum root gap0.1802mm. Source-atlas projection gives dark wire-like ends because freed tips can sample neighbouring regions. Rejected.
- `tips-colour-after.png`: same geometry with constant linear golden albedo(.56,.31,.105), roughness.48. Dark texture artefacts are reduced, but isolated whiskers do not replace the broad underlying locks. Rejected for delivery; no game export justified.

The next hair pass must change the broader lock breakup and coverage, rather than add isolated whiskers or turn up an existing normal bake. The reference also calls for finer directional strands and more varied root-to-tip colour; these trials do not achieve it. The existing face/rig/animation remains the baseline.

Scripts and native renders are reproducible work evidence, not runtime assets or art acceptance. Native sources stay locally beside these files: hair-relief-study.blend, hair-tips-study.blend, character-review.blend. The colour correction is recorded separately in refine_tip_colour.py; the initial tip source preserves the rejected projected-atlas result. The full comparison reference is in PR11 art/environment/owner-video-review.
