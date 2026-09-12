# Proposed correction for notched paving caps

**Pinned proposal evidence; applied in Astra’s environment integration.** No GPU appearance
verdict is implied. The adjacent evidence retains the status of its original verification
snapshot. Current adoption and actual-render review are tracked in `.agents/astra-environment.md`. Apply after Fable's broken-slab pass
`bb11762b1b3d8545e9692234e8120d66533b63e3` (the three hardscape files). This proposal changes
`src/world/hardscape/geometry.ts` and adds one explicit opt-in in `flagstones.ts`.

The smaller broken slabs are retained. Their V-notches occasionally put the cap's ordinary
vertex centroid outside the area from which every boundary edge is visible. The existing
concentric rings and centre fan then fold across a notch: 95 downward top triangles on 19 slabs.

The correction finds that visibility area by intersecting the boundary's inward half-planes.
If needed, it moves only the fan centre to the closest valid point with a small inward margin.
The notch, outer footprint, shoulder, crown height setting, rings and material pipeline remain.
Valid fan centres return unchanged. Only notched paving opts in, so stair geometry stays exact.
A non-star-shaped future cap with no valid fan centre uses Three.js's existing polygon
triangulator; none of the current 619 slabs requires that fallback.

## Reproduce

From the repository root with its normal dependencies installed:

```sh
node docs/proposals/astra-paving-caps/check.mjs
```

The check loads the pinned `bb11762` source and applies the adjacent patch in memory with exact
context/hash checks. It builds actual CPU geometry, including a repeated candidate build, and
writes `gauntlet/tmp/astra-paving-caps-evidence.json`. Production files and the index stay unchanged.

After integrating the required Fable slice, check applicability before applying:

```sh
git apply --check docs/proposals/astra-paving-caps/paving-caps.patch
```

## Verified result

- 619 stones and 86,321 triangles before and after; exactly 19 caps change, 600 cap buffers remain
  identical. All placement, profile, notch and collision-footprint metadata remains identical.
- Downward top triangles: **95 → 0**. Zero degenerate caps, including after the world transform
  and float32 storage. Sampled cap spill outside its boundary: **61 → 0**.
- Cap projected area matches its original boundary within `1.78e-15 m²`.
- Eight stepping-stone meshes and both complete stair meshes remain byte-identical.
- Side/shoulder positions, UVs, colour, moss and soil-stain attributes remain identical. Normals
  on the changed caps/shoulders are recomputed against the corrected surface.
- No slab's minimum sampled top/terrain clearance worsens; rim contact remains identical.
  Existing terrain intersections elsewhere are retained, not declared repaired.
- Fan-centre shifts: 0.49–3.22 cm for 18 caps; 10.20 cm for the worst cap at `(3.931,-22.106)`.
- Repeated geometry hashes match. Semantic TypeScript validation passes through virtual source
  overrides. An isolated U-shaped cap exercises the no-kernel fallback with positive area/winding.

The remaining acceptance step is an actual render of the integrated world. These checks establish
geometry integrity and preserved contracts, not visual similarity or complete contact everywhere.

## SHA-256

| File | Baseline | Candidate |
| --- | --- | --- |
| `geometry.ts` | `792d2093f6f5171a6cf682d930ee61fa2d3368e51e9c1992cb45e6fdf94aee39` | `1de36e8eb2ee8d324de65e07ce75b8dc1ea2d432840fa29d2968d3d5eee2b086` |
| `flagstones.ts` | `f0eab65e99a5db299603d29d03d5501b1218680be497a57fbba21f20a29d9224` | `1531e7eb2cdda4153b29bb60f1259d9b98e1ae01c7685801e412ebed49b7ae84` |

Patch: `36fc803e79a9de00cfac74cc95d1aebb547746437c8eeea326712422c3dc2f90`.
The adjacent evidence retains the affected slab coordinates, checks and exact hashes.
