# Fable roof and rising branch integration

Deliberate ancestry merge of 0f9426c7267d06f13cc96be4591821fce795cb84 into a350849.
Partner house.ts and materials.ts are adopted byte-exact, together with his log and take-67
ledger. The only shared index integration adds houseBough while retaining Astra post material,
ownership cleanup and actual post-light audit. Partner branch, PR2 and main remain untouched.
Coordination: PR2 comments 5647132216 / 5647158080 / 5647226781.

## Changed appearance and boundaries

Fable replaces y-constant roof fields with deterministic 3D noise, uses developed-cone UVs,
adds a coarse moss albedo map, reduces straw/leaf clumps, and replaces the old hoop/floor prop
with a branch rising behind the crown. His reported image scores are partner measurements;
this merge requires its own actual combined-world images before visual acceptance.

Pinned CPU comparison against 8701b86381c0c35c9ae68a6ca6cf1b19c349bd56 verifies:

- Both trunk, porch, interior, door/threshold/window, roots and soffit buffers are byte-exact.
- Remaining ground contacts are an exact subset with zero terrain-height error. Removed
  contacts belong to the deliberately removed ground legs.
- The two houses retain 58 meshes; triangles fall 296,576 to 259,688. All attributes are finite.
- Both 33-point branch audits match actual sweep geometry within sub-millimetre rounding.
- Generated moss normal bytes are unchanged at the pinned diagnostic seed; albedo is SRGB,
  normal NoColorSpace. The new owned 512-square albedo costs about 1.33 MiB with mipmaps.

Typecheck/build (108 modules) and the post material ownership test pass on the merged source.
The read-only mesh/texture diagnostic is evidence about construction, not a GPU image score.

## Reported issues awaiting partner correction

The new lower branch begins at angle -1.08, also the existing window angle, and obscures the
round Saria window from canonical B. On 28 unchanged window-back centroid rays, baseline
first hits include 7 socket and 6 frame samples; candidate has zero window/frame samples
and 14 support-bough hits. These rays test both houses, not full-world alpha-tested foliage.
Attachment to the window bark skirt is real; this is an occlusion regression. Fable was asked
to clear only the lower attachment/control points while preserving the improved upper sweep.

Generated moss normal and albedo lack disposal: disposing their material does not release
textures, and TextureLibrary does not own them. Fable was asked for a one-shot capMoss dispose
listener releasing only these two owned maps. Initial merge preserves his exact source.

The unsplit pi UV cut interpolates a 3.26 / 2.66-tile jump across the rear strip; all tested
cut centroids are hidden/outside all six canonical views. Arbitrary rear views can expose
a smear. Existing top/rim transition sensitivity remains; opposed face/vertex normals are
confined to v around .72, not a new broad inversion. These limitations are documented rather
than silently replacing partner geometry.

The pinned reproducible CPU diagnostic and exact evidence are preserved in
[fable-roof-round15](fable-roof-round15/README.md).
