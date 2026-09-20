# Village props

Owned leaf module: `src/world/props/**` (lane `fable-3`, 2026-09-19; first pass `codex`, rounds
31–32 `fable-cursor`). No shared layout, terrain, vegetation, structures or renderer changes;
`src/world/index.ts` registers `{ name: 'props', create }` (async — the wood maps load through
`ctx.textures`).

## What it builds

| kind | geometry | material |
| --- | --- | --- |
| pot | lathed closed profile (outer wall, rolled lip, inner wall, solid floor), 3 thrown shapes (`variant` 0 classic belly / 1 tall neck / 2 squat wide mouth), per-pot radius wobble | clay: procedural wheel-ring colour + normal `DataTexture`s (`materials.ts`), vertex-coloured ochre body, dark rim band and shoulder line, firing flash, dark cavity |
| crate | corner battens, 4–5 horizontal boards per side, 4 lid boards, floor boards, nail studs; one board askew | wood: `weathered_planks` colour/normal/roughness (CC0, credited) — every board on its own column of the map at true scale, chamfered arrises paler, end grain darker |
| barrel | 18 coopered staves on a bulged profile, board lid, 4 iron hoops | wood + iron |
| bucket | 14 staves, floor, 2 hoops, rope handle | wood + iron + rope |
| ladder | two laid ropes from a pegged crossbar on a house trunk to the ground, boards lashed between them | rope (procedural three-strand map) + wood |
| marker | a Kokiri waymarker: squared post with a diamond cap, two crossboards lashed at different heights and angles (the long one points along +z, the way the path goes), nail studs, a small tag hanging on a rope from the long board's tip; stands vertical, foot conformed | wood + rope + iron |
| lightString | the demo's string of small lights along a bank (frame A, measured on its pixels: a near-horizontal string at (0.49–0.54, 0.47) on the bank left of the flight; `d_011`, `d_087` show the motif elsewhere): a slim stake at each end seated on the ground, a thin cord drooping through the authored nodes, a glowing pod hung under the cord every 0.3 m; placed as drawn (no footprint probe) | wood + rope + glow (emissive 2.3 yellow-green, fog-exempt like the lantern pods; no halo) |
| platform | posts to their own ground, joists, deck boards, rope railing on three sides with lashings, ladder when the deck is high | wood + rope |
| platform, `dais: true` | the lookout railing: bound to `LAYOUT.plateauLookout` (position, yaw, width) and hardscape's `lookout` slab (depth, proud height) — four posts rising from the turf through the stone dais to 0.88 m over its top (inset from the bevel; they stand on the ground wherever hardscape hides the slab by distance), two rope courses on the plaza side and both short sides, one step block on the turf at the fence side; no deck of its own (the character ground learns the slab top) | wood + rope |

Hooks: after placement the system publishes `ctx.shared.propFootprints` (`{ x, z, r }` per placed
prop, `r` the prop's own ground footprint) — vegetation builds after props and keeps its ferns out
of those discs. The hook-bound lookout railing is placed exactly (no footprint probe or nudge).

Placement (`layout.ts` → `index.ts`): every prop is seated on `ctx.terrain.height`; small props
follow the terrain normal up to 9° and are otherwise set level into the slope, and their
underside (the lowest 8 cm) is conformed to the sampled heightfield (8 mm embed). Footprint probes
reject the `path` / `stairs` / `structure` / `cliff` masks, giant trunks, house trunks (porch
sector aware), hero boulders, npc spots (0.8 m) and the signpost; `paving` admits flagstones (the
stair-foot pots), `pad` admits a house pad (the doorway pots and the crate beside the porch). A
prop that finds no legal spot within 1.05 m is skipped and reported (`audit.skipped`), never
relocated across the village.

Draw calls: a `cluster` is a place (placement, audit, `audit.clusterBounds`); clusters belong to a
merge locality (`localityOf` in `layout.ts`: the seven village clusters → `village`, the north
clearing → `clearing`), and each locality is ONE mesh per material — 9 meshes for the whole system
(≤ 9 draws per pass in a frame). Each locality is distance-culled as one (`CLUSTER_VISIBLE_M`,
45 m, through `update` / `onCameraMove`): the clearing never rides into the six frames' passes.

## Clusters

`saria-door` (2 pots on the porch floor, viewer's left of the door), `signpost` (2 pots, bucket,
crate), `stair-foot` (2 pots on the apron at the bottom riser's south corner, the light string on the house terrace's bank above the lawn pocket left of the flight), `plateau` (crate,
barrel, bucket, 2 pots by the plateau-north fence), `upper-house` (the rope ladder),
`plateau-lip` (the rope railing on the lookout dais past the end of the plateau-west fence), `west`
(the tall platform under the lantern tree), `north-clearing` (the waymarker and two pots on the
north-east corner of the clearing's entrance, two low pots on the flight-side corner — off the
north paving's mask, outside the disc).

## Verification

`node src/world/props/geometry.test.mjs` (Node 20+): builders (chamfered box winding, pot
proportions and bands, crate board columns, barrel parts), procedural map determinism, every
authored prop placed, counts, tilt limit, B_house projections of the door dressing, the lookout
railing at its hook with the ropes above the slab top and outside A–D, one published footprint
per placed prop, geometry determinism / finiteness / attributes, contact gaps of the seated
vertices, compact cluster bounds, placement rules, disposal. Then `npm run typecheck && npm run build`.

Visual acceptance is before/after at the survey poses (`art/environment/survey2/manifest.json`)
and the six fixed views within −0.003 SSIM of the sealed take — see PR #13 and `.agents/fable-3.md`.
