Belt-side repair: 0646f2e99f8f1ff1516258b43557909e36bdd0ecdb6edbbb735bd34e65d00759
161 skin-weight positions corrected around the left belt attachment. All other rest attributes, textures, clips, binds and blink morphs match844cb82b. Native four-gait checks improve the repaired region;300 actual movement/blink records match the preceding build exactly. Evidence: art/characters/link/progress/2026-09-16-belt-side-review. Other cloth and facial issues remain.

Local residual garment + Fable character-8 review: 844cb82bb82786a5c42b1f670c3e209e3d8e4f424b1bf31632867b24a41f6616
160 additional weight positions repaired relative to9344. All other rest attributes, textures, clips, binds and blink morphs preserved. Native four-gait and runtime studio checks passed; 300 actual movement records match the prior build exactly. All three body primitives follow the blink contract; five in-game close-up phases and zero-dt repeat checks pass. Closed-lid ridges remain visible. Evidence: art/characters/link/progress/2026-09-15-character8-garment.

Local garment follow-up: 9344a2b030f5efb57bba71d071b8d717170c054e3ddc80f60dd41948e8497551
Source: inner-sleeve-study.blend, containing side-hem, right-sleeve, front-belt and inner-sleeve repairs. Changes841 weight positions; all other exported vertex attributes, textures, clips, binds and blink morph deltas are exact to the preceding delivery. One tiny recalculated rest tangent restored after exact geometry/UV/normal matching. Typecheck/build and22-view studio pass;300 gameplay records exactly match322c3433 on round37.150-frame30fps walk/run/idle test capture saved. Native48-pose checks per clip improve patched-edge peaks in idle/walk/run/stairs; other defects remain. Evidence: primary art/characters/link/progress/2026-09-15-garment-delivery-review. Kept local while Fable adopts the agreed322c3433 asset.

Retained combined delivery: 322c3433542064ffaeed91c5d7c04b95746778c6ddea60a5418b23148e7b7d7d
Source: combined-delivery-study.blend. Preserves rear hem repair and adds331 left-sleeve weight fixes (target run stretch24.29x to2.74x), plus reviewed blink/blinkHalf morphs at zero default weight. All geometry/shading/UVs/textures/clips/binds and outside weights match e5882cc5; morph position/normal deltas exactly match1e7074e7. Four tiny recalculated tangent vectors restored after exact rest geometry/UV/normal matching. Typecheck/build,22-view studio and30-frame60fps blink review pass. All1620 actual-player records match e5882cc5 exactly. Blink timing integration remains with Fable. Evidence: art/characters/link/progress/2026-09-15-combined-delivery.

Retained rear hem weight repair: e5882cc595233cc5f1caab691755085fcf5d819ce75ce15906dcd1098d1beda0
Source: back-hem-study.blend. Corrects 312 weight positions around 35 measured discontinuities. Target run-cycle peak stretch decreases from 19.14x to 1.72x. All other vertex attributes, textures, binds and four clips match d5213ba7 exactly; one recalculated sliver tangent restored after exact geometry/UV/normal matching. Typecheck/build pass; all 1620 actual-player records match the retained parent exactly. Evidence: art/characters/link/progress/2026-09-15-back-hem-review. Other cloth-weight defects remain.

Retained local brow positioning improvement: d5213ba789d193ff55300b51fc66ac63a3bd209f6e11838a7fe02bec96927314
Source: brow-fine-study.blend. Repositions 1808 brow vertices onto repaired skin and reduces fitted cross-sections to 45 percent; 39 outer fibres remain unchanged. Other mesh positions, all UVs/weights/joints, texture bytes and clips match bdcb9ec7. Studio and eye close-up review pass; 36-frame game smoke review passes and exactly matches bdcb9ec7. Evidence: art/characters/link/progress/2026-09-15-brow-blink-review. The remaining regular strand spacing is not final brow-quality acceptance.

Retained pupil proportion improvement: bdcb9ec76c5c5960e74b12f136e0a246615c9b0633632b4bc8b5df792f9c2051
Source: pupil-balanced-study.blend, including the retained connected eyelid rim. Remaps 188 UV corners per eye to reduce pupil/iris radius ratio from 0.557 toward 0.393. No texture edits. Eye positions/normals/weights, all clips, binds and texture bytes match the rim parent. Three.js studio and close-up review pass; 36-frame in-game smoke review passes and matches the corresponding rim fixture records. The rim passed the full 1620-frame fixture. Evidence: art/characters/link/progress/2026-09-15-eye-detail-review.

Retained connected eyelid-rim improvement, 7d4ad423b0c4111d9e2b54125defc49f7520a727774470026370f7578138e6f6
Source: lid-rim-study.blend; adds 256 vertices / 512 triangles with unchanged original positions. Exported clips and all texture bytes match 428141ef. Same three meshes, four materials, five images; 40,325,076 bytes. No eye-overlap pairs or unweighted rim vertices. Matched studio close-ups and 1620-frame game fixture pass. Movement and sampled shoe positions match 428141ef after vertex-ID normalization. Rendering adds no draw calls; clips and all textures remain exact. Reference quality remains unfinished.

Retained local face improvement, 2026-09-15: 428141effd661eb5edc32bd80c03ebb19ace0fb2fc452906822bb876dcbbfadb
Source: face-runtime-study.blend. Reconstructed socket collar, matched surface density, interpolated source normals, narrower eyelid openings, baked orbital color and cheek normals. Retained 2059 finger vertices and all four animation clips; exported clip data exact to d221c8c1. Outside-head position/UV/weight/joint states match at 1 micrometre; maximum normal component drift 0.000718. Three meshes, four materials, five images, 40,295,888 bytes. Studio and full 1620-frame world review complete. Movement and shoe positions match the parent after vertex-ID normalization, with no page errors. Evidence: art/characters/link/progress/2026-09-15-face-review. Reference quality and the existing descent hitch remain unfinished. Previous candidate backed up outside the repository.

Local hand candidate, 2026-09-15: d221c8c1f3896d96ccee74ef24e66097dea9130f0416da1929556bfa7438f46b
Source: hand-baked-study.blend; individual finger curl and smooth hand normals baked into existing atlas. Clips, joints, weights and binds preserved. Retained after matched runtime close-ups and actual 300-frame walk/run/idle capture; records exact to parent. Build/typecheck pass.

# Current local arm follow-through — 2026-09-15 afternoon

Asset SHA256: 1a59775b07205d2c2865d7a6e564987aa1f9486145985ebaa57ab32d1025d08b.
Native source: arm-followthrough-study.blend in the primary character source-runtime folder.
Native SHA256: f2ec284b5723785ad2da51fa72994b0d788ffe5341a871d7e65c96be85aa0316.
Walk/run elbow rotations gain delayed flexion; all mesh attributes, textures, materials,
nodes and binds match a93feccf. Lower-body channels exact; arm-chain exporter rounding
is recorded in arm-followthrough-motion-comparison.json (maximum1.54e-7).
Native comparisons and actual game still reviewed.300 movement/IK records match parent;
150-frame video verified, page errors empty. Build/typecheck pass.
World merged Fable take102/c9d2032 as34c44e5. Evidence: progress/2026-09-15T14-19-resume-review.
No new public asset upload; face/fabric/atlas studies remain unaccepted.

## Previous checkpoints

# Latest local hip-seam repair — 2026-09-15

Asset SHA256: a93feccf17ee922d66b454214d6b64eb6503615f8afd969c6862c9601e32fb95.
Source: hip-seams-study.blend; SHA256 266d057a6827c925f4b214fc6dfd1039eba95ff4f766dfa7217a1f3919ae7ab3.
216 vertices reweighted around 20 measured discontinuities. Target stretch37.71x ->2.41x;
broader region remains25.37x. Geometry, textures, nodes, binds and all four clips exact to d90c7f00.
Native before/after reviewed; full actual game capture passed with1620 player/IK records exact
to the earlier reviewed parent. Build/typecheck passed. No new public asset upload.
Evidence: art/characters/link/progress/2026-09-15T06-17-hip-review/manifest.json in the primary checkout.

## Parent history

# Latest local sleeve repair — 2026-09-15 06:08 UTC

Asset SHA256: d90c7f00f33afd079dc6860eb3d03307cfa0910a6dd4fae63e7adfeb70e5f3c4.
Source: sleeve-seams-study.blend in the primary checkout's character source-runtime folder.
Source SHA256: e91096718930d5dd027e914fb02ddc13551c969098a8e2d7767b2955a45ea63b.
293 vertices reweighted; geometry, all textures and all clips exact to parent 0fb98abb.
Native before/after and actual game reviewed. All 300 movement/IK samples exact to parent;
no page errors. Build/typecheck passed. No new public asset upload.
Evidence: art/characters/link/progress/2026-09-15T06-08-sleeve-review/manifest.json.
Other cloth defects and face/hair quality remain unfinished.

## Parent history

# Current local review — 2026-09-15

Candidate SHA256: 0fb98abb4c34f2fdc47ed7a682ccd8259dc7a254e2cd52a0cab83ad674ed3a4e.
Native source: art/characters/link/experiments/2026-09-13/source-runtime/tunic-seams-study.blend
(source SHA256 2d768eb883e518cb6d9eea5e8783217a817a19afa25c516229916cdcf51d7022).
Targeted sleeve/back and central tunic weight discontinuities repaired. Native target-edge
peak stretch44.9049x to3.1990x; other weight defects remain. Geometry, UVs, normals, tangents,
indices, textures, material parameters, binds, nodes and four clips exact to59e16d0b.
64,464 triangles;40,529,216 bytes. Native and18-view Three.js studio reviewed; actual game
review passed with300 flat-movement and90 descent sample records identical to the parent.
Evidence: progress/2026-09-15T05-55-tunic-review/manifest.json in the primary checkout.
Provider redistribution permission confirmed by Hyper3D onSeptember15;
third-party character/design rights are separate. No new public asset upload this session.

## Previous retained source history

# Link hand, tunic, run and hair study — local comparison only

This local override is unpublished and not cleared for unrestricted asset redistribution.
See the dated asset license review in the primary checkout at
art/characters/link/ASSET_LICENSE_REVIEW.md (published review88ad6eb).

- Source: art/characters/link/experiments/2026-09-13/source-runtime/socket-fragment-candidate.glb
  and socket-fragment-study.blend in the primary local checkout.
- SHA256:59e16d0bfd64f178e42c80f6e625652e75e04de1f0ab4d9000e1001e15327eb7.
- Size:40,529,212bytes;64,464triangles;three skinned meshes;four materials;19bones.
- This candidate removes one detached skin-coloured fragment beside the left eye:
  152 native vertices / 300 triangles. All surviving triangle attributes and winding,
  nodes, binds, four clips, material settings and texture bytes match hair-parent5b7fc730.
  Native run-panel samples are also exact. See socket-fragment-motion-comparison.json.
  Studio07-26-14 completes18views/363poses with11draws/128930render triangles.
  World07-29-30 completes6views plus spawn-face/repeat/motion, errors[]. Compared with
  same-world hair-parent07-28-03, all six views lose600render triangles including shadows;
  draw calls and other resource counts are exact. Raw repeat max3/mean0.9035, W41metric0.
  Native/studio/world visual review supports retaining this local cleanup. Right outer-lid
  recession was rejected; facial contour and surface quality remain unfinished.
- In the hair-parent5b7fc730, a native fine-strand normal bake is filtered16K to4K and blended at20% into the
  existing body normal atlas. It adds no meshes, materials or triangles. Original
  geometry, binds, joint order, all four clips, material settings and other textures
  are byte-identical to the tested run-lift1be2b055 candidate. See
  hair-atlas-subtle-motion-comparison.json. Full-strength and glossy variants were rejected.
- Parent: local2106700b arm study, descended from corneal6f28903d / PR10.
- Four native tunic vertices incorrectly attached to handL now follow neighbouring
  hips/thighL cloth weights. A further60-vertex panel receives smooth weight interpolation.
  Peak run-cycle edge stretch in that panel drops16.85x to4.01x; still not final deformation.
- Both hands gain local subdivision and gentle smoothing, maximum2.739mm surface movement.
- The hand/cloth changes preserve the four exported clips. The subsequent run-only
  revision lowers swing lift0.155m to0.105m using the original leg solver. It preserves
  speed3.9m/s,34frames/.566667s,25% stance duty and stride2.21m. The native knee peak
  drops4.18cm; bone error2.85e-8m, stance drift1.73e-8m/frame, loop error0.
- cloth-motion-comparison.json additionally proves unchanged positions, normals, UVs,
  tangents, indices, binds and all four clips versus hand-surface-candidate20a743fd.
- run-lift-motion-comparison.json proves all meshes/binds and idle/walk/stairs clips
  exact versus cloth0cfb123c. Run hips/legs change; toeR matrix-decomposition drift
  is at most1.788e-7 and recorded separately.
- The inherited arm study corrects shoulder swing axes and running elbow bend.
  Clip durations/strides, loader and terrain IK remain unchanged.
- Native studio05-27-42 completes18views/363poses with no page errors.
  Actual world05-31-02 completes six views, face, motion and repeat (W41difference0).
  Play05-31-56 completes300frames/150video frames: no reach clamps, identical travel path
  to cloth0cfb, reported planted-foot gap0..8.3mm in the compared stable run interval.
  Technical checks do not establish final art quality.
- Hair studio06-40-45 completes18views with no page errors and unchanged render cost.
  The local world now includes Fable's published take86 through3b1ec75 (merge946d59f).
  Baseline world/face captures06-30-10 and06-42-01 retain1be2b055. Hair world06-44-50
  and face06-46-56 complete without page errors; all six views have identical draw,
  triangle, geometry, texture and program counts. Repeat W41metric0, raw maximum3
  and mean0.9035: the raw images are not byte-exact. Play06-48-04 completes300frames
  and a five-second30fps clip, with no reach clamps. All300 recorded gait/root/placement/
  foot/root-step values match the prior-world05-31-56 baseline exactly. One rounded IK
  maxCorrectionM audit differs at frame217:11.5 ->11.6mm; cause not established. All23
  exported nodes are also identical apart from names. The subtle texture change
  is retained locally after visual review.

The body/base maps originate from the Rodin Gen-2.5 two-view job
03f2d679-4d9f-412a-a855-25630f526349 through Blender MCP's bundled public trial.
Blender edits add eyes, lashes/brows, material corrections, rig and animation work.
The iris albedo is separate original image_gen output. No Nintendo mesh was imported;
this does not grant rights to the underlying Zelda/Link character design.

Face, hair, hand detail, tunic deformation and stair contact remain unfinished.
