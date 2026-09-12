# Astra independent lower-jaw review

Candidate lower-face helper SHA256 b650d79c681689cf1a4c351a8d2cea0bfc36a7f912f44ac2977c371acfb757d7; compared with source9a317b873eae4a036e0ad179027201fdfdb217c1. No production edits by this reviewer.

## Recommendation

No new physical blocker found for a scoped actual render. This is not a likeness acceptance. Review front/profile and under-ear regions in actual rendered06/12/17/18 before accepting the visual change. The new X-only jaw taper keeps the original hair carrier by default; any larger apparent gap under the unchanged hair still requires visual judgment.

## Analytic and neck results

F=(s(y)x,y,z), with s=1−.18 quintic(u), has determinant s in[.82,1]. Its inverse-transpose normal is normalize(nx/s,ny−x*s′*nx/s,nz). The derivative is positive, max4.21875/k=3.63685345 at k1.16; both transition boundaries match through second derivative. Independent finite differences at2,868 lower carrier vertices agree: maximum map float error7.22nm, normal-versus-tangent dot3.96e−8, unit-normal error4.01e−8.

The entire connected neck top disk (all10 nondegenerate triangles) is inside the skull at rest and all four yaw±.95/pitch±.45 corners. This uses full triangle surface separation plus one interior-point parity test, not just sparse vertex samples. Candidate clearance is49.747mm at rest and13.534mm at the worst checked corner; baseline59.581mm and13.949mm respectively. No new top exposure in these bounded poses. Neck sides intentionally intersect the head at their attachment and were not required to be separated.

## Changed lower skull against unchanged hair

The complete affected set is5,652 skull faces versus17,736 hair faces. The nearest-distance check first returned zero for both baseline and candidate with the same witness. That first report conservatively marked a candidate hair intersection; it did not establish a new failure. Full BVH intersection enumeration then resolves it:

- Baseline111 intersecting triangle pairs across32 hair faces.
- Candidate77 pairs across28 hair faces.
-73 exact pairs persist,38 disappear,4 neighboring skull-face pairs appear.
-Zero newly intersecting hair faces; the candidate intersecting hair-face set is a subset of baseline.

The four changed pairings involve existing scalp shell faces45/46/2761 around x±.12,y−.04..−.06,z−.05m behind the temple. They move an existing scalp/skin intersection boundary onto adjacent skull faces. They do not establish a new fringe, eye or separate hair surface crossing. The full coordinates and pair sets are retained in hair-crossing-full.json. This review does not claim zero hair intersections, and it does not silently repair or waive the existing carrier defect.

## Reproducibility and limits

A first pair-enumeration run raced the root's production copy and found0 changed faces. It is rejected and retained as hair-crossing-unpinned-zero.json. The accepted rerun explicitly reads baseline face-geometry.ts/link.ts from pinned9a317 and asserts5,652 changed faces before checking. Independent neck results predate the production copy and also recorded5,652 changed faces.

Contact arithmetic is finite floating-point triangle geometry; the neck check covers five poses rather than a continuous swept domain. Hair/skull pair geometry is head-rigid and therefore invariant under shared head rotations. Root separately owns the exact upper-socket/nine-blink and whole-skull inherited ear-normal checks; they are not duplicated here. No all-pose or reference-quality claim.
