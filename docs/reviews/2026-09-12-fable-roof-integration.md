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

## Actual combined 5ea5b6d review

All 12+4 source/image/control contracts pass with zero retries/errors/warnings. Root inspected
A/B/D/F and the capture reviewer all distinct views/details. Mottled olive moss has substantially
less yellow streaking and fewer dark leaf clumps; the rising branch removes the old hoop.
The useful surface improvement is retained pending the already-owned window correction.
Thick smooth limbs and broad house forms remain below the references. B's glowing round window
is visibly obstructed, confirming the source diagnosis. Warm interior/prop lighting remains.

Scene triangles fall exactly 36,888 in structures; submitted multi-pass triangles fall 73,592
per saved world view, draws unchanged. Renderer textures/programs rise by one to 70/74 for
the moss albedo. Maximum B/E submission is 8,641,128 triangles / 650 calls; A has 659 calls.
Non-house audits/lighting/layout remain exact. Historical depth and cast shadows intentionally
change with the new geometry. C JPEG/depth is byte-identical to a350.

Actual progress/2026-09-12_164938704-5ea5b6d and details/2026-09-12_165226690-5ea5b6d
are on captures/astra-environment; archive pins 906edb947554459858d3e5e62a8491473ae285fc and
bc54c11e715dbd54071ef6dd6cc4a40e987d0736. All previous dated files/eight preview targets and
source/image ZIP bytes pass. Source ZIP has 368 exact tracked files. This is not a hardware
frame-rate or moving-camera stability claim.
