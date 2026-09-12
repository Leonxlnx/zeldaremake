# Hedge leaf surface study

Separate source after `ab7796e`; the post-light and upper-air controls are already pinned.
Fable explicitly released this bounded vegetation scope in PR2 comment 5646798877; the new
material-only study was announced in 5646996750. House/roof/hardscape remain his work.

## Actual need and pixel scale

Original owner board05 shows broad leaves with primary/secondary veins and waxy surfaces.
Actual 2e9/84ec near hedge leaves have shaped laminae but weak internal detail. Their existing
UVs put the midrib at u=.5 and base/tip at v=0/1. The normalized aLeafSurface tag already
distinguishes laminae from stems at every LOD. No geometry change is needed.

611 projected leaves in F's near hedge region have median length 19.75 pixels and perpendicular
width 3.97 pixels. Only 40 are at least 18 pixels long and 6 wide. Most can support a midrib;
edge-on leaves cannot carry reference-board-sized surface detail. CPU wind/ray projection is
approximate and plant-only, not a full-world GPU visibility mask.

The tree material's existing 11-cycle vein pattern would span a median .852 cycles per pixel at
43 exact-F leaf probes, too dense. This original hedge response uses four secondary pairs
(.302 cycles/pixel median), filtered by derivatives; it imports no tree-system internals.

## Candidate boundary

Only the hedge opts into leafSurfaceDetail. A box-filtered central band and four secondary pairs
modulate inherited albedo and roughness. Derivatives execute before the lamina mask; unresolved
bands fade according to their pixel footprint, with an additional 18–24 m distance fade before
the 26 m medium-LOD transition. No speckle, texture, bump, new material object or geometry.

Subtract each band's uniform-UV average to add contrast with near-neutral average color, keeping
the inherited hue. The hard albedo multiplier bound is .9832–1.2632; roughness .81634–.87134
from the .82 base. Uniform 256² UV integration averages 1.000218; the 43 F probes average
1.000146, range .9832–1.10299. These are material multipliers, not predicted display brightness.

The .65 sky transmission, all wind/lighting uniforms, original geometry/tags, packing, RNG,
placements, LODs and both shadow programs remain exact. A distinct program suffix prevents
cache collisions with ordinary bushes. No renderer draw or geometry cost is added.

## Validation and actual gate

The scratch proposal drives installed Three r186 parameters/cache keys and WebGLProgram
expansion into a no-op GL sink, then preprocesses real prefixes/chunks. UV/tag bindings,
seven opt-out programs, unchanged uniform sets/deformation/shadow programs and no effect on
wood, unresolved bands or distances >=24 m pass. This is not GPU compilation or rendering.
The existing material suite checks cache isolation, live wind and exact shadow passes with
and without sky transmission, plus ignored opt-in flags on unrelated vegetation families.

Typecheck/build (107 modules), existing material suite and exact candidate/source boundary pass.
Actual CI remains pending. Compare matching candidate images with historical
ab7796e for this change; the current within-source pair still tests canopy gain 1 versus 3.
Inspect near F/A leaves for useful subtle internal structure without bright strokes or grainy
edge-on patterns. Still captures cannot prove motion stability; the derivative/distance bounds
reduce risk but do not constitute a GPU motion verdict. No visual acceptance is claimed yet.
