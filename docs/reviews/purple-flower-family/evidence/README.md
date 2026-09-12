# Proposed purple high/medium flower family — scratch only

Frozen against `9ef903c58c3ee70eccaf919d565a1eb19cd1bef1`. Unapplied, no LIVE edits,
no GPU capture or visual approval. Root owns later integration. The original high-only trial
and its worse9 m transition are preserved in `../purple-flower-form-proposal/`, with its full source and hashes; this package includes its frozen transition receipt as
`rejected-high-only-transition.json`. This second proposal is the explicitly authorized narrow scope extension.

## Visible/source diagnosis

Personally reviewed full actual9ef D and actual22-control e2 M11 originals, and original owner
boards05/08/06. Near violet heads read as coarse continuous chips, whereas the boards show
rounded petals, visible centres and gaps. Old high `clusterHead` spends40/52 triangles on a
solid dome, then12 on six pointed rim folds. Medium spends18/26 on the dome and8 on four folds.
It has no separate florets or open corolla. This trial changes real form, not texture noise,
artificial highlights, flower density or world light.

Actual M11 source `e2ee5f076774ab36d1e751b1f1753781795a417d` has byte-identical vegetation
source to9ef. The original near M11 box x0–320/y450–720 contains visibly coarse violet heads;
static source envelopes there span20.97 px median width, up to44.97 px. These projections are
not visibility counts: wind, occlusion, AA and lighting require actual captures.

## Two-file boundary and construction

- `plantgeo.ts` adds a private corolla builder and explicit purple-family wrapper. The existing
  flower body is reused with a selector; original `flowerGeometry` retains its legacy behaviour.
- `plants.ts` opts only purple cluster variants0/1 into the wrapper. Yellow, purple spikes,
  white flowers, all low LODs, hedge leaves, placement, packs, material and wind code stay exact.

Both retained levels use the same six broad, rounded petals, the same phase/reach/width/colour
samples, original head radius/orientation and stem tip. High spends8 triangles per cupped
petal plus4 on a recessed throat:52/head. Medium spends4 triangles per petal plus2 on the
small central surface:26/head. Its six contour vertices are identical to high's; high's extra
neck vertices lie on those contour edges. Only the interior cup is simplified. No dome or
hidden coverage surface fills the gaps behind the petals.

The existing named `head-i` RNG fork supplies every shape parameter. High and medium consume
the same meaningful samples; no dummy random draws or new global stream. Palette values are
unchanged; changed heads distribute those values over petals, so their colour buffers are not
claimed byte-identical. The matte material and all its options remain exact.

## Focused checks

Pinned source and two candidate overlays are loaded in memory by `check.mjs`; no scene renderer. `source.mjs` rebuilds the exact candidate from published Git
objects and four unique-context edits; there are no source snapshots or scratch-file dependencies.

- Four geometries change (two purple variants × high/mid);94 other variant/LOD geometries are
  byte-identical, including yellow, spikes, low and all hedge geometry.
- All10,297 plant instance records, full matrices/tints/variant assignments, packs, thresholds
  and shadow settings remain exact. There are312 purple +6 yellow plants; audit flowers318
  includes both.
- Original stem tubes, leaves, basal rosettes, their normals and relative indices remain exact.
  All28 checked head attachments/orientations/radius values remain exact; ground-offset error0.
- Only28 authorized high/mid `head-i` namespaces change. Parent/other-fork receipts remain exact.
  Each changed geometry repeats deterministically. High/mid common contour positions, UVs and
  colours are byte-identical, while physical normals correctly follow their different interiors.
- Every changed attribute is finite. Every head triangle has positive area and positive projected
  winding along its head axis; vertex normals are unit length within1e-6.
- Both variants remain618 high /436 medium triangles. No new draw/material/texture/uniform or
  attribute name; all material options including shared wind `plantHeight=0.48400115966796875`
  remain exact. That maximum is still supplied by the unchanged low spike variant.

High heads use59 versus49 vertices: +6,160 source attribute bytes. Medium uses40 versus29:
+6,776. Total **+12,936 source bytes**, **+14,112 packed bytes** including the existing aVariant
attribute, or27,048 retained source+packed CPU bytes. GPU attribute storage grows14,112 bytes;
index counts and index element types remain unchanged. Culling and GPU submission counts
still need the real capture; unchanged triangle topology alone is not that verdict.

Natural local boxes change. High's largest axis expansion is6.867 mm. Medium's largest is
17.667 mm (variant0 +x), because its old random contour was narrower. High and medium now have
identical local boxes. Maximum height change is high +0.094/-1.615 mm and medium -0.011/+3.350 mm.
All candidate vertices remain inside1.435×original head radius radially and0–0.601×radius axially,
within the old intended head envelope (rim up to1.6×radius, apex0.8×radius). This preserves scale,
not every old random extreme. Instance scale applies to these local differences. No new
whole-world contact/occlusion clearance is claimed beyond exact grounded stems/placement.

## Actual source silhouette at the9 m switch

`lod-silhouette-evidence.json` projects14 heads from existing instances0 and2 at exactly9 m
horizontal root distance using D's bearing/eye height. It measures unions of real source
triangles on a common1/8-pixel lattice. It does not render an image or model wind, full-world
occlusion, AA, material response or GPU lighting.

| High/medium comparison | Existing family | First high-only trial | Shared family |
| --- | ---: | ---: | ---: |
| Median silhouette intersection/union | 0.7764 | 0.4524 | 0.8655 |
| Median symmetric difference | 12.66 px² | 34.58 px² | 5.53 px² |

Shared-family IoU spans0.7526–0.8790; its difference spans4.06–8.11 px². The new high surface
occupies median1.078×its medium silhouette. Identical boundary vertices do not imply identical
projected silhouettes: high's concave interior remains visible from some bearings. The concrete
9 m geometry mismatch is smaller than baseline in this diagnostic, not declared invisible.

## Preserved16 m low transition

Low is intentionally unchanged:21 triangles/head, five stems/heads versus seven in high/mid
for both actual variants. It already uses a different cheap skeleton/arrangement. The
`low-transition-evidence.json` compares unions of all heads per plant at16 m, because matching
individual head indices would be misleading.

| Instance/variant | Old medium→low IoU | New medium→low IoU | Old/new symmetric difference |
| --- | ---: | ---: | ---: |
| 0/0 | 0.0622 | 0.0494 | 156.78 /133.00 px² |
| 2/1 | 0.0834 | 0.0752 | 145.97 /127.19 px² |

These very low overlaps reveal the inherited skeletal switch. New medium's overlap ratio is
slightly worse, while absolute difference is smaller because its open heads cover less area.
Neither statistic grants a visual pass. New medium heads span6.23–9.43 px at16 m in these
samples; this existing transition still deserves observation in the matched movement capture.
The proposal does not silently extend into low or mask this mismatch with a dome.

## Portable reproduction / frozen hashes

```sh
node <review-directory>/check.mjs
node <review-directory>/typecheck.mjs
```

Run from the repository root after installing its locked dependencies. The directory may be
moved intact. The original checks passed with zero TypeScript diagnostics; the adapted checks
reproduce those same receipt values without writing the checkout. They require the pinned Git
objects and the project dependencies, not the original scratch directory or capture metadata.
No new measurements or test suite were added. Receipt whitespace is compacted; original and
portable file hashes are recorded in `provenance.json`. The rejected high-only receipt is
preserved evidence, not rerun by this family check.

`edits.json` is the reviewable source delta; `source.mjs` requires each old context to occur
exactly once and verifies complete baseline/candidate SHA-256 values. Production application
and visual approval remain root-owned. The source patch itself remains frozen at the following hash.

Patch SHA-256: `c9614139fb3d0643f0fafb59b09cee66c665e25926b2aced05f754157dc60b6e`.

| File | Baseline SHA-256 | Candidate SHA-256 |
| --- | --- | --- |
| plantgeo.ts | 98ccdc110e23283097b1b9366bec39aabf3d7f914e4419deb5f19a35957a02f9 | 8446563ea0521492a2c89fd99d0209edf51158af60ad383929393f7b4afb3cc8 |
| plants.ts | 29a50da8a741b38a5a1d991d817d4977562113ec4ef325364d41d1d2c37f8b64 | 203c90cdbd9723bbb51866d7a99fd14a958515c125c0e0436bddfd9104897ae0 |

Actual acceptance remains pending: judge legible petal/centre form in D/M11, retained violet
mass and world composition, plus both distance switches. Geometry proof is not a quality award.
