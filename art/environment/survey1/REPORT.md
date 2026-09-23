# survey-1 — visual-defect survey of take-0113 (HEAD 4907d4d, world tree 18cd211)

Renders: 183 frames at 1280×720 (`gauntlet/scripts/broll.mjs --test`, quality high, time 12.5, HUD + character hidden):
32 walk points × 5 views (w00–w28 path spine + main stair + plateau/fences, w29–w31 Saria's house route),
15 stand-next shots, 6 re-renders of the black `w04-spine-d` pose. Eye = ground + 1.45 m.
Frames: `/tmp/survey1/frames/<name>.png`. Manifest: `/tmp/survey1/manifest.json`. Raw notes: `/tmp/survey1/notes.md`.
Crops: `/opt/cursor/artifacts/survey1-NN-<slug>.jpg` (300×300 from the 1280×720 frame).

Frequency = number of the 183 frames in which the defect is plainly visible. Score = severity × frequency.

## Top 12 (ranked by severity × frequency)

| # | Defect | Example frame / crop | World position | System | Sev | Freq | Fix suggestion |
|---|---|---|---|---|---|---|---|
| 1 | Giant boles are smooth cylinders: orange (stair-bank, north-east), lime-green (north-east, plateau-oak), pale-green camo (lantern-tree, north-west-near). No bark plates, moss is a painted decal, no root flare where they enter grass; at touching distance the bark is a magnified blur | w17-spine-r, w07-spine-l, sn-bole-lantern-tree → `survey1-01`, `-02`, `-03` | stair-bank (10.6, 0, 9.15); north-east (15, 2, −37); lantern-tree (−11.5, 2.6, −7.2); north-west-near (−6, 0, −12.8); plateau-oak (19, 5.4, −21) | `trees/giant` | 3 | 26 | Detail-LOD bark shell within 12 m (displaced plates + fissures + normal map), 3-D moss cushions on the shade side, buttress/root flare kit with litter ring at the ground contact |
| 2 | Column trees = uniform grey/pale smooth cylinders with no bark, no base flare, hard light/dark base seam; crowns against the sky are flat spiky cut-outs | w19-spine-r, sn-arch-outside, w19-spine-u → `survey1-04`, `-05`, `-33` | hollow and north of the arch (−10…12, −20…−70), e.g. col @ (8.8, −26.9), (−3.5, −24.7) | `trees/column` | 3 | 21 | Bark texture + relief on the `-high` column mesh (currently reads as untextured), root-flare seat, leaf-card crowns with depth/translucency |
| 3 | Log arch body = smooth clay/plank surface at all distances; lips are jagged triangular silhouettes; underside at 1 m is wet clay with specular streaks; log ends meet the ground with no root mass | w19-spine-r, sn-arch-inside, w18-spine-f → `survey1-06`, `-07`, `-08` | log arch axis ≈ (−6…24, 4…13, −60…−47) | `structures/logArch` | 3 | 15 | Bark-plate relief + normal map on `log-interior`/`log-ends`, moss/lichen and hanging roots on the belly, remesh the lips with rounded broken-wood profile, root footing + debris at both ends |
| 4 | Bare flat ground: hollow floor west of the path, forest floor under the white-barks, and everything north of the arch is flat pale-green terrain with sparse tufts, no blades/litter/ferns | w21-spine-f, w18-spine-r, w17-spine-l → `survey1-09`, `-10`, `-35` | hollow (−8…0, −20…−36); north plain (0…12, −56…−70) | `vegetation` (+ `terrain` colour) | 3 | 17 | Extend the grass carpet + litter + fern scatter masks to the hollow and the arch's north side; break the terrain albedo with dirt/moss patches |
| 5 | Giant limbs and the lantern bough = smooth pale tubes, no bark, no moss cushion, two leaf sprigs; from below they are plain tapering pipes | w04-spine-f, w00-spine-f, sn-lantern-limb → `survey1-11`, `-12` | lantern limb over the plaza (−11.5→0, 5–6 m up, z ≈ −7…3); giant limbs overhead w06–w11, w23–w29 | `structures/lanternBranch`, `trees/giant` (limbs) | 3 | 12 | Bark relief + thick top-side moss cushion + hanging moss/ferns on the lantern limb (reference frame-03); give giant limbs the same bark shell as the boles |
| 6 | Roots = smooth uniform tubes (dark "spaghetti" over the house-lawn earth face, one arc floats above ground; lime-green octopus skirt of the north-east giant; bent plank-like house roots on the landing) | w09-spine-r, w18-spine-r, w25-stairs-f → `survey1-13`, `-14`, `-23` | house lawn face (3…9, 1…4, −10…−16); NE giant skirt (12…16, 2, −33…−40); landing (13…17, 5.5, −5…−8) | `trees/giant` (rootkit), `structures/house` (roots) | 3 | 12 | Bark-textured, tapering roots that are seated on the heightfield (contact test) with litter/moss at the entry point; fix the floating arc |
| 7 | Big-leaf shrubs = flat polygonal leaf cards on black stick stems, at the lens on the plateau, identical bushes repeated | w27-plateau-r, sn-boulder-terrace → `survey1-15`, `-16` | plateau (17…22, 6, −10…0) and terrace (−12, 4, −20) | `vegetation` (big-leaf bush) | 3 | 8 | Curved/bent leaf geometry with midrib, translucency and per-instance variation; thin out at 0.5 m from the player |
| 8 | Hollow path = flat brown dirt with slabs sitting on it as 10 cm tiles (clean vertical sides, hard shadow); under and north of the arch a gravel disc lies on top of the flagstones with a straight seam | w13-spine-d, w20-spine-d → `survey1-17`, `-18`, `-34` | hollow path (1.8…2.5, 1.3, −17…−30); arch floor (5.2…5.7, 5.7, −50…−57) | `hardscape` (+ `terrain`) | 3 | 9 | Sink the slabs into the dirt (worn edges, soil lip), add grit/pebble relief between them; blend the gravel disc into the paving with a broken edge |
| 9 | Fences: posts and rails are near-black smooth boxes/tubes with no grain or end-grain; rails pass straight through posts; on the plaza the rope-fence rail passes through the stair-foot boulder | w28-plateau-f, sn-fence-post, sn-boulder-stairfoot → `survey1-19`, `-20`, `-25` | plateau fences (18…23, 5.4, −15…2); rope fence (8.2…9.7, 0, 2…3.4) | `structures/fence` | 2 | 8 | Wood-grain albedo/normal + bevelled ends, mortise the rails, ambient/fill on the shade side; move the rope-fence line off the boulder |
| 10 | Blue/purple flower clusters read as saturated flat blobs (no stems, no individual petals, no shading) | sn-signpost, w30-house-l → `survey1-21`, `-22` | signpost bank (4…7, 3, −8…−10), house lawn, plaza west, w16 bank | `vegetation` (flowers) | 2 | 10 | Smaller heads with stems and per-instance hue/brightness variation, darker shaded side, fewer per clump |
| 11 | Earth face behind the house lawn / landing north verge = smooth brown clay wall with faint noise, flat moss pads; the w11/w12 cliff has rock texture but is a flat plane | w08-spine-r, w11-spine-r → `survey1-23` | (2…10, 1…4, −10…−17) and hollow east cliff (5…8, 1…4, −17…−24) | `terrain` | 3 | 6 | Rock/root relief on steep-slope mask (triplanar rock + overhang lip), add exposed roots and ferns on the face |
| 12 | Near-canopy lobes at 5–8 m = huge single-tone dark-green flat shapes (read as cards); leaf masses without internal branch structure | w02-spine-r, w22-stairs-r, sn-boulder-stairfoot → `survey1-24` | over the plaza/stair (3…12, 6…12, −5…12) | `trees` (nearCanopy / canopy) | 2 | 7 | Break each lobe into layered leaf clusters with translucency + visible twigs; darker underside, lit rim |

## Also reported (below the top 12 by score, but several are "the owner would circle it")

| Defect | Frame / crop | Position | System | Sev | Freq | Fix |
|---|---|---|---|---|---|---|
| A log-arch peg pod hangs at head height (bottom 1.3 m, top 2.5 m above ground) dead on the path spine at the arch's north exit — the eye camera sits inside it (black hex prism in w21-l, yellow blob in w21-u/-r) | w21-spine-l → `survey1-29` | pod AABB (5.58…5.94, 5.54…6.76, −56.08…−55.68); ground 4.24 | `structures/logArch` (east peg pods) | 3 | 3 | Raise the east peg pods (cord 0.55/1.2 m) or move them off the walkway; add a ≥ 2.6 m clearance check over `pathSpine` |
| Stair-foot hero boulder: main face is a flat photo texture, the east edge is a saw-blade of thin triangular shards | sn-boulder-stairfoot, w02-r, w22-f → `survey1-25` | (9.1, 0.2, 2.5) | `rocks` | 3 | 4 | Rebuild the shard fringe as rounded facets; parallax/normal relief on the face |
| Doorway threshold slab = flat over-bright white plank with 2-D moss "confetti", hard polygonal outline floating over the bark step | w31-house-d, sn-house-door, sn-signpost → `survey1-26` | (8.5…9.5, 2.4, −8…−9) | `structures/house` (doorway) | 3 | 4 | Stone texture + edge wear, real moss tufts, seat it into the step |
| Distant trees beyond the fences = flat pale cardboard silhouettes with blobby crowns, one "T" tree with a disc crown | w26-stairs-f, w28-r → `survey1-27` | north/east of the plateau (20…60, 6…30, −40…10) | `trees/distant` | 2 | 6 | Two-layer crowns with depth, vary trunk lean/height, fix the disc-crown instance |
| Moss cushions / white ground flowers = pale smooth spheres / pearls on pins | sn-boulder-stairfoot, w06-spine-d, w08-r → `survey1-28` | mound (−3…3, 0, −6…−9), stair foot, house lawn | `vegetation` (moss/flowers) | 2 | 6 | Flatten cushions into lumpy discs with a fuzzy edge; smaller flower heads with stems |
| The hollow-column distant hut is seen from the hollow path straight up as a black flat-shaded slab with a dark pod bowl + glow disc | w13-spine-u (also w12/w14/w15-u) → `survey1-30` | hut on column @ (8.8, −26.9), 8–14 m up | `structures/distantHouse` | 2 | 4 | Underside soffit/ambient on the planks, emissive pod from below (or swap to the full hut LOD inside 20 m) |
| White-bark trunk at 1.5 m = smooth cylinder, no relief, no root flare | sn-whitebark-base, w21-f → `survey1-31` | (−7.4, 1.1, 12.9) | `trees/whiteBark` | 2 | 2 | Base flare + bark relief LOD, moss/litter ring |
| Shot-D boulder: slate stripes read as brick from 4 m, round "polka-dot" lichen discs up close | w08-spine-l, sn-boulder-shotd → `survey1-32` | (−2.6, 0, −9.6) | `rocks` | 2 | 2 | Irregular lichen mask, break the layer stripes |
| Terrace boulder: smeared/stretched texture on the lower face, black holes (unlit cavities/missing faces) | sn-boulder-terrace | (−15, 2.6, −20) | `rocks` | 2 | 1 | Triplanar projection + fill the cavities |
| House-west flight step blocks: side faces are flat near-black planes with a hard top/side break; a diagonal crease on the transition slab | w29-house-d → `survey1-36` | (3.8…6, 0.3…1.6, −8…−7) | `hardscape` (stairs) | 2 | 2 | Bevel + rock texture on the risers, ambient fill |
| Fern fronds piercing a step slab; identical fronds in a wall | w24-stairs-r | (9…11, 3, −3…0) | `vegetation` / `hardscape` | 2 | 1 | Exclusion mask around stair slabs |
| Fiddleheads = flat pale 2-D curls | sn-boulder-shotd | (−2.6, 0, −9.6) | `vegetation` (ferns) | 2 | 1 | Tube geometry or darker, thinner cards |
| Black notches at the north-west-near bole base | w07-spine-l, sn-boulder-shotd | (−6, 0, −12.8) | `trees/giant` | 2 | 2 | Check for inverted/missing faces on the rootkit |
| Signpost plank = flat box, no bevel/wear; pots plain terracotta; interior = primitive boxes/spheres | sn-signpost, w26-d, sn-house-door | (6.9, 2, −9.3); landing; Saria's interior | `structures/signpost`, `props` | 1 | 7 | Edge wear + grain normal; pot rims/cracks; interior props are Phase-2 anyway |
| Stray near-canopy / falling-leaf card at the lens | w05-spine-u, w21-spine-r | plaza / arch | `trees/nearCanopy`, `atmosphere/leaves` | 1 | 2 | Fade cards within 0.4 m of the camera |
| `w04-spine-d` rendered as one uniform colour RGB(11,15,10) — identical pose re-rendered clean (x04d-same) | w04-spine-d vs x04d-same | (0, 1.45, 3.56) looking 30° down | transient (particle through the lens or capture hiccup) | 2 | 1 | If a leaf particle: near-camera fade; otherwise ignore |

### Lighting / atmosphere / postfx (Astra's lane — reported, not judged)

| Observation | Frames | Crop |
|---|---|---|
| Far pod lanterns at 30–40 m are shapeless bloom orbs 4–5× the pod size | w07-f, w11-f, w12-f, w13-f, w15-f, w18-f | `survey1-34` |
| Over-exposed sun patches on the hollow floor and on the plaza flagstones (w06-l/-d washed out) | w17-l, w19-l, w19-f, w06-l, w06-d | `survey1-35` |
| Saria's interior is near-black (no fill); pod over the stair over-bright | w31-f, sn-house-door, w23-r | — |
| Fence posts, column trunks and the distant hut have no fill on their shade side (read as pitch black) — partly material, partly ambient | w27-f, w26-l, w13-u | `survey1-20`, `-30` |

## Per-system defect counts (frames in which at least one defect of that system is visible)

| System | Frames | Distinct defects | Worst sev |
|---|---|---|---|
| `trees/giant` (boles, limbs, roots) | 46 | 5 | 3 |
| `vegetation` (bare ground, big-leaf cards, flower blobs, moss spheres, bald mound, ferns) | 41 | 8 | 3 |
| `trees/column` | 21 | 3 | 3 |
| `structures/logArch` (incl. head-height pod) | 18 | 5 | 3 |
| `hardscape` (dirt tiles, gravel seam, step blocks, over-bright slabs) | 13 | 5 | 3 |
| `structures/fence` | 8 | 3 | 2 |
| `structures/house` (roots, threshold, interior, roof moss up close) | 8 | 4 | 3 |
| `rocks` | 8 | 5 | 3 |
| `terrain` (earth face, cliff plane) | 6 | 2 | 3 |
| `trees` canopy / nearCanopy | 7 | 2 | 2 |
| `trees/distant` | 6 | 1 | 2 |
| `structures/lanternBranch` | 5 | 1 | 3 |
| `structures/distantHouse` | 4 | 1 | 2 |
| `trees/whiteBark` | 2 | 1 | 2 |
| `props` | 6 | 2 | 1 |
| `structures/signpost` | 2 | 1 | 1 |
| `atmosphere` / lighting / postfx (Astra) | 14 | 4 | — |

## Five best frames (do not regress)

1. `w18-spine-d` (3.86, 4.94, −38.16) looking down — flagstones with real relief, mossy joints, pebbles, leaf litter; the north-path paving is the strongest hardscape in the world (also w01-d, w09-d, w15-d…w19-d).
2. `w12-spine-l` (1.92, 1.33, −20.32) 45° left — shaded bank with ferns, litter, low plants, a dark mossy bole and sun patches: the closest to the owner's frame-03 look.
3. `w07-spine-r` (0.54, 1.47, −5.41) 45° right — Saria's house: west flight with moss treads, trunk bark, vines, door pods, pebbles.
4. `w10-spine-u` (1.69, 1.43, −14.33) straight up — layered canopy with branch structure, sunlit leaf edges, sky gaps (also w16-u, w17-u, w22-u).
5. `w23-stairs-d` (6.4, 1.45, −0.3) — main stair with layered risers, moss on the treads, mushrooms at the nosing (also w24-d). Honourable mentions: `w26-stairs-d` (landing forest floor: grass + ferns + big-leaf), `w31-house-u` (door lintel bark + pods).

Sheet: `/opt/cursor/artifacts/survey1-best-frames.jpg`.
