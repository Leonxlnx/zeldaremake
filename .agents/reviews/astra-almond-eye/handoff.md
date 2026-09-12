# Astra almond aperture — physical review handoff

Baseline56d13f4bad8d52074b751c1895863ae33ffc4d12 includes the accepted lower jaw and12-lock fringe. Root reports actual56d06/12/17/05 reviewed with scoped shallower-fringe acceptance. This eye candidate itself still requires an actual rendered appearance review after integration.

The sole runtime source change is `LINK_EYE_HALF_HEIGHT=.0165→.0145` in `eye-aperture.ts`. Unit-scale opening height33→29mm; width50mm, physical iris radius16mm, pupil radius9mm, eye anchors, blink clock and optical cap formula stay fixed. The existing shared helper rebuilds the white/lid geometry and their actual skull support. No production source was edited during this review.

Apply `almond-eye.patch` (SHA256bd4160e1d6b99163764d438e33e51cba7c9f8a16e9894dff50610a3eb96d793a). It changes only the aperture constant and the expected physical exposure test:
- `eye-aperture.ts` SHAceef5ca5f1a4db88d8921845438372fb717085a15d506690f270ccaefef10ee8.
- `eye-geometry.test.mjs` SHA2251e44160b567d641f0bd62ed046eba34b271f21df87628bf2aa426b2b60e48.

The original test failure at line127 is retained. Its33mm neutral pigment-strip expectation and independent33mm perimeter encode the previous artistic dimension; they now use29mm. At blink.5838095238, the new independent polygon's top at the physical pupil X is8.35312mm, below the fixed8.5mm pupil-top sample. The old perimeter allowed9.50527mm there. The new coverage is expected and tested, with actual ray absence required outside the authored polygon. A second6mm vertical pupil sample remains exposed during that half blink and continues testing vertical pigment mapping. Width/iris/pupil values and every original UV/radius/curvature/clipping/winding/cache tolerance are unchanged. Updated test passes8448 clipped-layer triangles,34 visible physical UV rays,6 covered points and blink/reset/cache checks. Candidate typecheck passes.

Fresh actual geometry gates passed:

-66nonocular meshes/264arrays exact to56d, including all hair/outfit/cap/brow/mouth buffers; transforms/shadow flags exact. Runtime-loaded source differences are only eye-aperture.ts. Skull is intentionally checked separately because its orbital support remesh changes.
- Nine blink scales1,.85,.7,.5838095,.5,.35,.2,.12,.08, both eyes: full actual white/skull gap≥.661229151mm; lid/hair≥14.107699mm; lid/brow≥1.767581mm. White/lid/lash meshes all clear both brows and complete hair.
- Independent actual triangle ray queries over every lid vertex: skull-field depth error≤2.215e−15m; visible join depth error≤.438nm; fixed outer lid normal error≤1.777e−7 after physical blink scaling. White vertices lie on their freshly fitted fixed optical cap, and the whole inner lid boundary is byte-exact to the white boundary.
- Every actual white/lid/lash attribute is finite and every normal is unit within1e−6 through9blinks; all actual triangles have nonzero area. White/lid projected winding is outward throughout. Lash tubes correctly have both front/back faces.
- All6514original skull pigment entries exact. Both baseline/candidate skulls lack a UV attribute; absence is explicitly checked.6438original vertices strictly outside the union of both orbital-support polygons have exact position/normal bytes. Only18original positions changed, within that support union and on the front face.
- All348existing indexed skull boundary defects/edge counts match. No new zero-area faces; candidate minimum triangle area5.2565e−11m², minimum face-average-normal dot.4014223. New skull33379vertices/66396triangles vs34435/68508; whole actor174140triangles vs176252.
- Actual support construction converges in5refinement passes (previous6), maximum sampled fade error38.3276µm. This source-sampled bound is not a uniform analytic error proof.

One review harness initially assumed a skull UV attribute and stopped; `skull-uv-assumption-failure.json` retains that diagnostic. Both models genuinely have no UV attribute, so the corrected check asserts matching absence and exact pigment values. No physical tolerance was loosened. No runtime source adjustment was needed after the one proposed aperture change.

These checks are on56d plus the eye candidate, before root's separate new cap candidate. Root should preserve both exact source hooks when composing, perform the remaining cap/ocular composition check and required build, then publish actual06/12/17/18 captures. This report is physical validity and a legitimate authored-dimension test update, not visual eye-likeness acceptance or a C01 pass.
