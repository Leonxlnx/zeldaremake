# Independent floor-moss review

Final verdict: **accept `b266441d` as a bounded visual improvement over `6c13f70c`** for the
identified hardscape floor cushions. Earlier `ba1d4bb1` and `f5cae585` remain held on appearance.
No actionable source/CPU correctness findings. The post-cull GPU triangle budget remains the
parent agent's separate capture; this review does not attest W38 or final environment quality.

The first candidate's CPU findings (`ba1d4bb1`):

- Actual high-density hardscape rebuilt from both commits: all 577 cushion instance matrices,
  tints and variant attributes remain exact; 18 other hardscape meshes are byte-identical.
  The seated rim retains X/Z and ground-height contact. No scatter, layout or terrain changes.
- The rock caller still omits `floorMoss`. A mixed pack containing its four production variants
  is byte-identical between commits. Seed-derived RNG forks consume no parent-stream draws.
- Each of the 72 added leaves has upward winding, a matching unit normal and zero wind weight.
  The rebuilt geometry sphere contains every vertex; existing culling derives its conservative
  sphere from this geometry. No shadow-caster path changed.
- All 72 leaves intersect the actual faceted substrate. Eight of 144 base corners emerge above
  it, but no leaf has both base corners above it. The largest such corner gap is 2.103 mm on the
  largest live pad. This is an emerging leaf edge, not detached geometry; no seating fix needed.
- Cost: 50 to 122 triangles per cushion, or 41,544 additional authored triangles across all
  577 instances before culling, with zero additional draw calls. This is not a rendered W38 total.

Reproduce from the repository root (CPU only, no source edits):

```powershell
node src/world/materials/sprouts.test.mjs
node art/environment/astra-world-resume/review-moss.mjs 6c13f70c ba1d4bb1
node art/environment/astra-world-resume/review-moss.mjs 6c13f70c f5cae585
node art/environment/astra-world-resume/review-moss.mjs 6c13f70c b266441d
```

The independent check reads both Git commits directly and writes `review-moss-<candidate>-cpu.json`
beside this note. It asserts production hardscape instance/geometry parity, unchanged mixed rock-pack
geometry, seated rim preservation, leaf contact/winding/normals and bounding-sphere coverage.
Both checks passed during this review. No production source, tests, shared logs or ledger edited.

Native `ba1d4bb1` review: inspected the untouched `native-pair/{before,after}/w05-spine-d.png`
and `w16-spine-d.png`. The lower contour improves the oversized pebble read, but w05 around
(630,585) and w16 around (868,294) still show a continuous olive body with dark flecks. The leaves
do not yet read as a moss colony. Hold visual adoption. This is a bounded appearance finding,
not a source/contact failure.

Follow-up `f5cae585`: the same independent CPU checks pass. All 577 instance streams and the
18 other hardscape meshes remain exact, as does the mixed rock pack. All 288 leaves enter
the substrate, with matching normals and safe bounds. Fourteen base corners emerge above it,
but no leaf has both roots above it. Cost is 338 triangles per cushion (+166,176 authored
triangles across the full population, zero extra draws).

Native `f5cae585` review: inspected `native-dense/after/w05-spine-d.png` and `w16-spine-d.png`
against the original raw views. Surface detail is denser, but the near w05 pad remains a solid
flat olive chip with fine dark stippling. The continuous substrate still controls its appearance;
shoot density alone does not resolve the moss read. Hold visual adoption of this candidate too.
The parent's bounded post-tint substrate/leaf brightness follow-up is the next comparison.

Final `b266441d`: the production CPU comparison passes with the same counts/contact as `f5cae585`.
All 1,014 negative-U vertices belong to floor moss. Every other sprout/rock vertex has U >= 0,
so the new shade conditional is false for those vertices. Removing that sole conditional yields
the exact baseline vertex-shader logic; the fragment shader is unchanged, and the program cache
key changed. This proves the shared source path, not unrendered pixel identity.

Inspected the original untouched before images again against
`native-shaded/after/{w05-spine-d,w16-spine-d}.png`. At w05 (630,585), the inflated smooth olive
body becomes a low broken patch with small tip relief over darker recesses. At w16 (868,294)
and (1143,262), isolated pea silhouettes become thin ground growth. This resolves the principal
smooth-body defect enough to accept the bounded change. The simple repeated cushion footprint
remains a visible limitation.
