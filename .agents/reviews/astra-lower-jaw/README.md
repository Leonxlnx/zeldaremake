# Astra — narrower lower jaw

Baseline: `9a317b873eae4a036e0ad179027201fdfdb217c1`.
Helper SHA256: `b650d79c681689cf1a4c351a8d2cea0bfc36a7f912f44ac2977c371acfb757d7`.

The owner’s Kokiri Hero concept sheet calls for a softer, smaller lower face. This pass
narrows only X below Y −.030k, reaching scale .82 at −.110k. Y/Z and the upper face
remain unchanged. The continuous map is injective with determinant .82–1 and C2 joins;
normals use its analytic inverse transpose. The ears are merged afterward.

Only the visible soft-feature Link face opts into this shape. Hair fitters keep their
original carrier geometry, preserving the scalp, nape and hair attachments. The mouth
uses the existing ray-seated path. No rig, material, world or movement edits.

## Evidence

- 2,803 skull positions change, by at most 15.3102 mm; 5,652 faces are affected.
- 31,567 protected upper/ear vertices remain exact. All 71 other meshes / 282 arrays,
  including hair, cap, brows and eyes, remain exact. All nine blink states and open reset
  preserve every eye geometry attribute. Topology and triangle count are unchanged.
- No new inward vertex-normal corner. The 16 inherited ear corners remain byte-exact,
  including their negative incident dot products; these are documented in bad-corners.json.
- Independent finite-difference checks agree with analytic normals to 3.96e−8 tangent dot.
- The complete ten-triangle neck top disk stays inside the actual skull at rest and four
  yaw ±.95 / pitch ±.45 corner poses. Minimum surface gap is 49.747 mm at rest and
  13.534 mm in the tested corners. This is bounded coverage, not an all-motion proof.
- Full changed-skull versus unchanged hair enumeration: 111 old intersecting pairs become
  77, on 28 rather than 32 hair faces. Four neighboring skull-face pairs replace part of an
  existing intersection boundary, on old scalp contact surfaces behind the temples.
  Zero previously clear hair faces become contacted. This is not a zero-intersection claim.
- TypeScript and production build pass (146 modules).

The first default-factory candidate also moved every hair fitter and was held. The
visible-face opt-in avoids that unintended scope. One unpinned contact rerun observed
zero changed faces after the production copy; it was discarded and replaced by the
explicitly pinned 5,652-face comparison reported here.

## Replay and limits

From this reviewed source checkout, run:

```
node .agents/reviews/astra-lower-jaw/geometry-review.mjs
```

The replay reads the old face and Link builder from the pinned Git commit; all other
sources are this checkout. Retained independent reports contain the neck and contact
measurements. Actual front/profile captures are still needed to accept the appearance.
No claim of completed likeness, all-pose clearance or 95% reference matching is made.
