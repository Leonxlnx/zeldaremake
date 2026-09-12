# Fable distant huts 901b65b — independent source integration review

**Recommendation:** the reviewed host/recess work is suitable for deliberate integration after the isolated grass checkpoint. No blocking source/geometry/contact defect was demonstrated by the bounded checks. Actual integrated images remain the appearance/cost gate; the glowing circular/arch rims are already reported by root as an art follow-up, not grounds to discard the host/recess work.

Reviewed commit `901b65b9ec45a1355cf3169d245e93892d98b7da`, partner head `fc853db`, against LIVE source `e8ccfe6779a8b89bb8fbb1362b58c247598a4b57`. Read the complete three-file change, AGENTS, current project/root state and Fable's tick55 log. Fable owns distant huts and the upcoming house/burl work. No LIVE production/log/claim changes, build or render. Prior successful 7eba geometry/RNG proof was not repeated; one current tree construction supplied actual seats and host geometry for these targeted new checks.

## Exact integration boundary

| File | Action and conflict status |
| --- | --- |
| `src/world/structures/distantHouse.ts` | Exact 901b source. LIVE e8 is byte-exact 901b's parent; no conflict. |
| `src/world/structures/materials.ts` | Exact 901b source, or its isolated distantGlow comments/color delta. LIVE e8 is byte-exact parent; no conflict. |
| `src/world/structures/index.ts` | Add only the six audit lines: `distantHostSource`, `distantDegenerateTriangles`, `distantGlowTints` and comments. Scratch three-way merge is clean. Preserve Astra sign/post helpers and their disposal. |

The already reviewed prerequisite tree publication/fix is `7eba56e` + `bb3b7bf`, touching `trees/{column,giant,index,tubePath}.ts`; root handles that ancestry separately, preserving its existing canopy publication. The shared interface is already present in LIVE. Do not copy partner's whole structures/index over Astra's extras.

Fable already has **the identical cap-only consolidation block**: move distant capMoss meshes into `distant-house-caps`, consolidate that group separately, aggregate its draw audit. Exact string comparison across parent/candidate/LIVE and scratch integrated index passes. No cap grouping regression is needed or proposed.

`git apply --check` of the complete 901b patch passes against LIVE. Scratch `integrated-index.ts` differs from e8 by exactly the six audit lines. Frozen hashes:

- `candidate-distantHouse.ts`: `e274324d3b534906a31c771d180b8156ee065815400288c6e7d69645761bd15d`
- `candidate-materials.ts`: `a1ff83add8f3c3ef13a8fe1f9da7ce432b23ae6dbd69ffb7ac24473dcc2d7da1`
- `integrated-index.ts`: `18dacf009704de2683b78500fddbc21902eb38b61147db855634868138e92bea`

## Hosts, bands and actual contacts

The nearest-base resolver picks exact published hosts inside 1.5 m: hollow→seat-3, north-east→north-east, west→seat-1. Each nearest distance is zero; second choices are 2.981 / 7.480 / 5.920 m away. Current matching is unambiguous. Floor uses seat baseY plus authored floor, centre uses axisAt(floor) plus retained offset. Wall radius grows to cover nominal radius plus axis drift and 6 cm clearance under worst taper/wobble. Fallback remains explicit and audited as constants/mixed/shared.

| Hut | New nominal radius | Audited conservative clearance | Sampled actual high-detail bole→wall minimum |
| --- | ---: | ---: | ---: |
| hollow | 1.650 m | .185 m | .2146 m, 952 section samples |
| north-east | 2.480 m | .153 m | .1679 m, 1,794 section samples |
| west | 1.700 m | .944 m | .9996 m, 884 section samples |

All 54 short rays through the source opening interiors are clear of their own actual host geometry, including branches. Recess vertex clearance from the nominal bole is at least .670 m. These are targeted own-host checks, not full-world visibility or exhaustive mesh collision proofs.

Two limits are important but do not invalidate current hosts:

- The 0.1 m band loop omits the final 5 cm and can miss piecewise ring maxima. Exact endpoints/ring-knot evaluation finds current required-radius understatements of only .059 mm / 0 / .510 mm, well within the retained margins. This is a sampled nominal guarantee, not an exact bark-skin guarantee for future seats/seeds.
- `bareHeight` is not used to reject a host. North-east's floor is 8 m above its base while bareHeight is 4.930 m; west's upper band also crosses its branch-origin limit. The radius audit proves neither whole-hut branch clearance nor canopy visibility. Current opening checks pass, and later images must assess surrounding branches.

## Recess geometry, winding and cleanup

New geometry has **9,661 triangles, zero zero-area triangles, zero nonfinite attributes and zero triangle/vertex-normal opposition**. All tested window/door tunnels, backs and floors face their intended interior. The grid cut and front rims provide actual 0.30/0.35 m recesses rather than the old flat glow discs. Lamp discs sit at 65% depth. The capped pod profile, four fins, stems and bracket connections are actual geometry.

`dropDegenerate` only removes index triples whose squared cross-product area is ≤1e-14; surviving positions/normals/UV/colors are retained. It removes former cap-pole degenerates and new pod-apex/fin collapses. Source geometry audit agrees with independent triangle enumeration.

Window backs are **overlapping approximations, not welded shells**: the curved tunnel's back can lie −.191 to +.061 m from the planar back disc on north-east. Its projected contour remains inside the back disc with at least 8.9 mm coverage; no demonstrated open seam follows from the plane mismatch alone. Oblique/full-scene appearance remains an image question.

## Materials, resources and costs

No new material, texture, light or shader hook. `distantGlow` changes from orange×2.2 to white×2.2; vertex tints carry the hue. Peak lamp/pod tint becomes 2.2, lime is no longer double-tinted orange, rim peak is 1.76. These are maxima: the pod body's existing per-height color gradient is dimmer toward its top, so not every pod fragment is fully fog-exempt. MeshBasic glow is intentionally unlit and unshadowed; warm rims are a stylistic emissive approximation, already raised to Fable by root.

The new recess meshes reuse `mats.recessBark`; bark/wood/cap materials and borrowed maps remain shared. Material factory ownership/disposal is otherwise unchanged. Consolidation disposes old merged geometries; system teardown disposes final scene geometries and shared materials once, plus existing generated texture owners. No new borrowed map enters the owned list. This is a source ownership assessment, not a repeat of the full prior disposal suite.

Against actual9ef's 5,217 distant triangles: **+4,444 → 9,661**. Before consolidation meshes grow 10→13, adding one recess mesh per hut. The new material/layout/shadow flags match the existing recess bucket, so no additional final bucket is expected; camera culling/submitted triangles still require integrated capture. New material totals: bark4,210; recess369; cap924; wood1,416; glow2,742. No FPS claim.

## Evidence files

`evidence.json`: current host selection/band sampling, per-part winding/finite/degenerate checks, nominal recess clearance.
`contacts.json`: actual own-host sections/opening rays and curved-window-back comparison.
`integration.json`: source pins, exact three-file boundary, clean merge/apply check, retained cap/sign/post blocks, costs/hashes.
`check.mjs` / `contacts.mjs`: scratch-only exact-Git-source CPU reproduction with diagnostic material stubs and metadata capture. No source render images are fabricated. Existing full prior tree/RNG proofs remain under `gauntlet/tmp/fable-trunk-seats-review/`.
