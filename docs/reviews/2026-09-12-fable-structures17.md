# Fable structures 17: deliberate integration

The prior house retained an even crown, a narrow entrance and a bough obscuring its window.
Fable's `3ab1222` addresses those review findings; `eadb660` adopts our exact distant-cap
bounds split. This checkpoint imports that work plus take 70 history (`a8b6c38`) and the
additive trunk-seat type contract (`90920a79debb18f10aa4ea1e1f4347e50cb39cd0`).

House, material and distant-house files are exact partner bytes. The two merge conflicts are
resolved deliberately: structures/index.ts keeps our sign/post creation, materials and audit
fields, with their existing disposers inside Fable's new one-shot cleanup; system.ts retains
both our canopyOpenings and his optional trunkSeats declarations. The latter adds types only.
It does not yet publish runtime seats or fix the distant huts' attachment issues.

The reviewed merged index SHA256 is
`400a1a49ef525858d8264f371c6bb83bdeeb3375fcd4a7bfffabe650355c8553`.
No sleeve shader, global lighting, planting or character change is included. The isolated
sprout trial and both rejected-experiment rollbacks remain exact. Fable's agent log and
append-only ledger are imported through ancestry, never rewritten by hand.

## Source and geometry review

The two houses grow from 259,688 to 263,986 unique triangles (+4,298), with 58 house meshes
unchanged and finite attributes throughout. The wider porch/root lips/right pillar, crown,
eave/soffit, bough and dependent foliage change intentionally. All 18 reported base contacts
still sample terrain exactly; moved supports are not claimed position-identical.

Existing inner doorway/frame, thresholds and window/frame geometry remain exact. Under the
same root fixture, 28 window-back rays change Saria from 14 bough / 0 window-frame hits to
0 / 14; the upper house changes from 15 / 0 to 0 / 12. This differs from Fable's browser
1 → 16 window figure because the test setup and foliage masks differ; they are not conflated.
The new Saria branch start intersects actual trunk 0.414 m outward, inside its 0.544 m radius.
Upper-house contact is similarly inside the branch radius.

The existing pole degenerates and narrow inherited cap-join normal opposition are recorded,
not silently claimed fixed. No broad geometry rewrite is justified by this integration.

A new source issue was reported to Fable in PR2 comment 5648120197: nonperiodic atan2 noise
moves duplicated burl-seam vertices apart by 32.7–59.3 mm on Saria, with normal discontinuities.
All sampled B/E seam points are hidden by house geometry. Two sampled points remain potentially
unoccluded by the house in A/F, with projected gaps 1.11 / 0.159 pixels; full-world occlusion
and GPU visibility are untested. This is a real source defect, not an established broad visible
crack. Preserve his implementation and coordinate a narrow seam correction with him.

## Ownership and merge proof

The exact partner factory releases 55 final geometries, 35 watched materials and 10 generated
canvas textures once; 11 actually loaded borrowed maps receive zero disposal events. A second
system disposal is a no-op. Fable's browser count universe differs; this does not claim to
reproduce his 106 / 33 / 12 counts.

The reviewed merged root factory releases 56 final geometries, 39 watched materials, the
10 partner canvases and 5 existing sign/post textures once. Its 11 borrowed maps stay alive;
a second call does nothing. An initial fixture classification mistake labelled sign-owned
DataTextures as borrowed; the classification was corrected from their actual owner without
changing production behavior.

Materials.ts adds ownership registration around existing texture creation only: material data,
generated canvas pixels, shader source, uniforms and keys remain exact. Holding the new house
source fixed, the index merge preserves all original/final buffers, transforms, shadow flags
and pre-existing audits. Our exact 16-line cap grouping is retained.

Independent scripts and detailed CPU receipts are preserved in the working checkpoint under
`gauntlet/tmp/fable-structures17-review/`; they are diagnostic evidence, not a GPU render or
phase-exit test. Root additionally verifies full source hashes and the additive-only type diff,
and runs the production typecheck/build before publication.

## Pending actual decisions

Root personally reviewed take 70 B/reference/strip and A/F/D, plus owner boards 03/04/08,
and submitted a fresh W25 fail with updated grounds through the repository CLI. The restored
window, wider entrance and darker room are retained as real progress; remaining smooth wall
fins and the separate sloping cap still miss the reference arch/crown construction. See
[fresh review and pinned originals](fable-take-0070/W25.md). Our integrated lighting still needs
its own actual comparison; Fable's capture is not substituted for that result.

The separate sleeve proposal remains held. Fable corrected his earlier box attribution in
PR2 comment 5648166807. Both guards use encoded Rec709 p50, no linearization, floored edges:

| Rectangle | Reference p50 | Take 69 | Astra 8714 | Target tolerance |
| --- | ---: | ---: | ---: | --- |
| x 0.20–0.45, y 0.04–0.12 | 0.430496 | 0.316122 | 0.170839 | 0.43 ± 0.03 |
| x 0.05–0.70, y 0.00–0.08 | 0.351195 | 0.324001 | 0.178080 | 0.35 ± 0.03 |

Our baseline fails both; Fable's passes the second only. The first reference rectangle is
mostly hazed canopy/air, while the actual rectangle intersects the near sleeve. These are
composition measures, not matched material masks, and do not justify a screen-band correction.

Pinned diagnosis confirms the same sleeve geometry, materials, shared floor, maps and camera.
Its hemisphere ambient-mean luminance falls from 0.426552 to 0.244636 (ratio 0.57352); the
flat sleeve floor ratio is 0.56904. Same positive textured albedo lies within per-channel ratios
0.48781–0.71635. This establishes a major input difference, not an exact displayed-pixel cause.
At the sampled 5.144 m median depth, old near-distance haze is at most 7.136%, versus zero in
our source; separate mist is unchanged. IBL and post differences also remain in the comparison.
No exact GPU attribution or missing-texture defect is claimed. The frozen angular-response
candidate would further darken sampled floor medians, so both versions remain unapplied.

Production typecheck/build (111 modules), exact reviewed merged-index hash, partner source and
ledger bytes, additive-only types and retained sprout/stone/sign/post/leaf-pod hashes pass.
