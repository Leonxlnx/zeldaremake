# Fable roof/support integration review — proposed source, CPU evidence

Reviewed source `0f9426c7267d06f13cc96be4591821fce795cb84` against `8701b86381c0c35c9ae68a6ca6cf1b19c349bd56`. Exact SHA-256 hashes for house.ts, materials.ts and index.ts are in `evidence.json`. This review does not change source or award a visual score. Fable was notified in [PR #2 comment 5647226781](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5647226781).

## Corrections requested from Fable

- **Lower bough covers the existing Saria window from B.** Of 28 rays to unchanged window-back triangle centroids, baseline first hits include 7 socket and 6 frame samples; candidate reaches neither, with 14 first hits on `support-boughs`. The new branch begins at angle −1.08, matching the window angle. Clear only the lower attachment/first control points while preserving the upper silhouette; verify in an actual render. These are house-only CPU rays, not full-world visibility or an alpha-tested foliage verdict.
- **Owned moss-map disposal is absent.** structures.dispose disposes materials, which do not dispose their textures. The new procedural albedo adds ~1.33 MiB including mipmaps to the pre-existing normal-map leak. Attach a capMoss dispose listener that removes itself, then disposes exactly mossMaps.normal and mossMaps.albedo. Both are generated here; borrowed TextureLibrary maps must remain untouched.

## Safe integration boundary

house.ts and materials.ts travel together because of new `Noise3D` / `MOSS_ALBEDO_PEAK` imports. index.ts adds only the `houseBough` audit; preserve Astra's post-pod and post-light integration.

Both houses' trunk/eave band, porch, interior/props, door/frame/threshold, roots, windows and soffit buffers are byte-exact. Room, hearth, door, eave, window and pillar audits are unchanged. Remaining terrain bases are an exact subset of baseline with zero height error; two contacts per house disappear with the deliberately removed grounded legs.

The branch attachment is real: radial rays meet the existing window bark skirt (`roots`) 0.484 m from Saria's start, inside its 0.544 m radius; upper first contact is 0.320 m inside a 0.460 m radius. Trunk-only contact tests would miss this skirt. The 33-point bough audit matches its actual swept curve/radius within 0.734/0.489 mm rounding.

House geometry falls **296,576 → 259,688 triangles**, with 58 meshes unchanged and finite attributes. Two-house leafCount falls **10,991 → 3,221**; the −7,770 decrement matches Fable's larger structures-total 13,533 → 5,763. The old normal texture's bytes are unchanged at the pinned diagnostic seed. New albedo is SRGB, normal remains NoColorSpace. Sampled 3D noise is deterministic and continuous across positive/negative integer boundaries.

## Bounded limitations

- The developed-cone UV cut at π lacks duplicated seam vertices: 234/208 rear triangles interpolate jumps up to 3.255/2.657 tiles over ~8/7 cm. Every tested cut centroid is house-occluded or out of frame in all six canonical views; arbitrary rear views may show a smeared strip. This is not a clean seam for every camera.
- Pole degenerates stay 300/276. Face/average-normal opposition remains confined to the existing cap→rim join near v=.72: Saria 140→215, upper 160→99, with none elsewhere on the cap. Do not silently combine a broader rim rewrite with this integration.
- The source's 0.19R apex-disc comment describes a UV offset: geometric v=0 actually collapses to a point. The strict 'unclipped crests' claim is also stronger than the code: the diagnostic albedo seed has ~4.3% channels at 255. These observations do not measure actual displayed brightness.

## Reproduce

From repository root, with normal project dependencies installed and both pinned commits present:

```sh
node docs/reviews/fable-roof-round15/check.mjs
```

The check loads exact Git source through TypeScript, uses real Three geometry/rays, and stubs only diagnostic materials and canvas storage. It writes this folder's compact evidence JSON. It neither builds/captures a game frame nor edits production, the locked gauntlet, reference files or ledger. Generated canvas-byte statistics use a stated diagnostic seed, not the complete runtime canvas RNG prefix. Actual combined GPU views remain required.
