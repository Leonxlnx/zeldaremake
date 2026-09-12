# East-bank grass height profile: preserved source evidence

This records the reviewed 11-line `grass.ts` trial against source
`e8ccfe6779a8b89bb8fbb1362b58c247598a4b57`. It shortens irregular patches of grass on the elevated
shaded east flank so existing fern and broad-leaf groups can read more clearly. Strong existing
clusters retain tall islands. It adds no plants and changes no density, roots, materials or lights.
Visual retention is decided separately from this source proof.

The original 9ef [A](https://github.com/Leonxlnx/zeldaremake/blob/6c0888409116600733cc06b5391791a582deb0b1/progress/2026-09-12_200727869-9ef903c/A_stairs-candidate.jpg)
and [F](https://github.com/Leonxlnx/zeldaremake/blob/6c0888409116600733cc06b5391791a582deb0b1/progress/2026-09-12_200727869-9ef903c/F_canopy-candidate.jpg)
show a dense layer of narrow grass tips. Owner boards 02/05/08 show clearer leaf groups and broken
ground planting. The bank already has ferns: the source/depth-screened F wall region contains
46 ordinary and 7 hero-fern centres alongside 10,994 grass roots. These are coarse source
projections, not a count of visible pixels. Terrain and authored normal blending are coherent;
this trial does not alter Fable's bank geometry or treat the problem as missing ferns.

## Reproduce without temporary files

With the project dependencies installed from its lockfile, run:

```sh
node docs/reviews/east-bank-grass-profile/proof.mjs
```

The proof reads historical Git objects. [edit.json](edit.json) contains only the unique context
and 11 inserted lines, plus full original/candidate SHA256 hashes. The original hash is verified,
the context must occur exactly once, and the candidate is reconstructed and verified in memory.
No full candidate file, scratch directory, capture metadata, browser or app build is required.
The proof writes only [verification.json](verification.json) in this directory.

It runs the existing full grass comparison and subsequent non-grass placement comparison,
then checks every substantive frozen measurement against [expected.json](expected.json).
[provenance.json](provenance.json) records the source and original frozen evidence hashes.

## What the proof establishes

- Of 499,880 grass blades, 20,574 change inside the bounded elevated shade region. All roots and
  479,306 unaffected matrix/data rows remain exact. Width/yaw, type, dry tint and random phase
  remain exact for every blade. The original 12 mm root sink is preserved; stored-coordinate
  height error remains at most 3.50 micrometres.
- The full grass and subsequent plant random trace matches across 10,243,658 observed calls.
  All 13 non-grass item lists match completely, including 996 ordinary ferns, 18 hero ferns,
  12 hedges and 3,477 weeds: counts, roots, variants, matrices and colors.
- All grass base position/normal/UV/index arrays match at all three LODs. Instance matrices
  remain finite, positive and nonsingular. This establishes static/source geometry integrity,
  not an exhaustive animated-wind intersection test.
- The existing cluster field controls patchiness. The shade zone's 2 m feather, the 1.2–2 m
  elevation ramp and the C sight-line/trim protections bound the change. Intended minimum
  height scale is 0.38, with ordinary Float32 rounding in stored matrices. Changed-blade median
  height falls from 0.24576 to 0.15637 m; there is no uniform cutting plane.
- Existing height-derived stiffness intentionally increases: median +0.05582, p90 +0.17596,
  maximum +0.37910. Wind phase/source remain exact, but actual moving shapes can differ.
  Height audit mean/CV update through the original calculation. Recorded conservative sphere
  radii stay exact because tall maxima remain in every affected tile.
- Every saved-camera `grass.update` distance-based tile/LOD/triangle inventory matches.
  No geometry, material, texture, attribute, blade count or draw inventory is added. Those
  inventories are not measured camera/shadow-frustum submissions or GPU timings. Grass
  continues not to cast shadows; the actual renderer still determines full-scene cost.

## Retained static projection and limits

[projection-summary.json](projection-summary.json) retains the original archive/source/image
hashes and compact A/F/C region results. It does not require the large original metadata and
is **not recomputed by the portable source proof**. In the A/F wall regions, changed static
blade-tip displacement has median 5.58/4.06 px and p90 13.51/10.53 px. This supports one actual
form trial; it is not a prediction of screenshot improvement.

The original depth filter uses 80×45 cells and a loose 1.3 m allowance. It cannot identify exact
visible blades. Projection omits wind, including the changed stiffness response. The C stair-foot
control region has no changed rows; that does not establish an unchanged whole C image.
Other occlusion, reach, shadows and the complete render remain outside these source checks.

Retain the trial only if actual A/F planting reads as a quieter, broken grass layer with clearer
existing fern/leaf groups. Reject a scalped or artificial bank, or a merely shorter version of the
same wall. Do not compensate with lighting changes or added plants. This supplemental evidence
does not alter gauntlet scores or phase-exit criteria.
