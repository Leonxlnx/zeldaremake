# Link hair review against the owner's new video

Native Blender comparisons, September16. Runtime remains24591126; neither candidate is promoted.

- `hair-before.png` / `hair-after.png`: current normal atlas with additional filtered relief from the previously authored native groom bake.228431pixels change; geometry and all pixels outside the mask remain exact beforePNG serialization. The gain is too small to address the broad sculpted hair forms. Rejected for delivery.
- `tips-after.png`:36head-bound rooted strands,4032triangles, maximum root gap0.1802mm. Source-atlas projection gives dark wire-like ends because freed tips can sample neighbouring regions. Rejected.
- `tips-colour-after.png`: same geometry with constant linear golden albedo(.56,.31,.105), roughness.48. Dark texture artefacts are reduced, but isolated whiskers do not replace the broad underlying locks. Rejected for delivery; no game export justified.

The next hair pass must change the broader lock breakup and coverage, rather than add isolated whiskers or turn up an existing normal bake. The reference also calls for finer directional strands and more varied root-to-tip colour; these trials do not achieve it. The existing face/rig/animation remains the baseline.

Scripts and native renders are reproducible work evidence, not runtime assets or art acceptance. Native sources stay locally beside these files: hair-relief-study.blend, hair-tips-study.blend, character-review.blend. The colour correction is recorded separately in refine_tip_colour.py; the initial tip source preserves the rejected projected-atlas result. The full comparison reference is in PR11 art/environment/owner-video-review.

## Fringe deformation follow-up

`fringe-shape-before.png` / `fringe-shape-after.png`:1072 existing vertices moved up to14.5mm to taper/shorten central locks asymmetrically. Boundary positions stayed fixed and no triangles reversed, but the portrait exposed an angular crease at the parting. Not accepted.

The first normal check found six corners at one unchanged-position vertex33146 bordering a changed face. Normal support was corrected to include all vertices of changed incident faces; outside that support, maximum decoded normal error is.000581. This is a local shading-support correction, not permission to alter unrelated normals.

`fringe-smooth-before.png` / `fringe-smooth-after.png`: eight iterations smoothing the displacement and a global scale bound prevent local triangle-area ratios outside.5–2.1277vertices move up to3.359mm; boundary fixed,0 reversed triangles, outside normal error.000581. The angular crease is avoided, but the visual change is too small to replace the thick lock structure. Also not promoted. Strong deformation of the old bounded patch is not the route to a substantially different hair silhouette; the next substantial hair pass needs complete lock surfaces and their attachments handled together.

Native sources fringe-shape-study.blend and fringe-smooth-study.blend stay local. Their scripts reuse study_hair_surface.py from the existing experiment directory. No runtime GLB or animation was changed in this follow-up.
