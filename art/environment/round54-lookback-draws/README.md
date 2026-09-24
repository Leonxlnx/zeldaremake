# Round 54 (fable-4) — where the trees' draws go at the plateau's look-backs (head `3c6cc553`)

fable-2 (18:15, cc all lanes) isolated the systems at the east green's look west: trees 250 draws / 3.54 M, "most of it will be
per-tree meshes and their shadow pass at a distance where a card would do". Measured mesh by mesh instead: every mesh of the
`trees` group that the main pass draws at the pose, by an `onBeforeRender` hook on each (the shadow pass does not call the hook,
so its draws are the casting meshes' groups, listed separately); 896 × 776, quality high, clock frozen, HUD on. Trees' total from
hiding the group: **258 draws / 3.44 M at the green (43, 4) → the plaza** (frame 765 / 8.86 M), **232 / 3.35 M behind the lookout
fence (47.5, 8)** (frame 737 / 8.76 M). The main pass + the casting groups account for 245 and 215 of them; the rest is the
shadow pass's own culling of casters my count includes.

## The green (43, 4), eye 2 m, → the plaza

| part (name pattern) | meshes drawn | main-pass draws | casting (shadow draws) | triangles (K) |
|---|---|---|---|---|
| giants | giant-near-canopy-east-giant-lobe# | 26 | 26 | 0 | 179 |
| giants | giants-sector#-plateau-oak+far-plateau+east-giant+stair-bank-giant | 1 | 12 | 12 | 236 |
| giants | giants-sector#-lantern-tree+north-west-near+north-west+north-east | 1 | 12 | 12 | 275 |
| giants | giants-sector#-south-giant+plaza-south+south-centre+southwest-giant | 1 | 12 | 12 | 244 |
| columns | column-near-canopy-seat#-lobe# | 18 | 18 | 0 | 94 |
| distant | distant#-far | 6 | 12 | 0 | 5 |
| distant | mid#-near | 5 | 10 | 0 | 27 |
| distant | mid#-far | 5 | 10 | 0 | 31 |
| white-bark | whitebark-wb##-low | 10 | 10 | 0 | 112 |
| columns | column-col##-high@#,# | 3 | 3 | 3 | 114 |
| columns | column-near-base-seat# | 3 | 3 | 3 | 93 |
| giants | giant-near-canopy-stair-bank-giant-lobe# | 6 | 6 | 0 | 92 |
| distant | distant#-near | 2 | 4 | 0 | 2 |
| white-bark | whitebark-wb##-high | 2 | 2 | 2 | 103 |
| understory | understory-us##-low | 4 | 4 | 0 | 3 |
| columns | column-col##-medium@#,# | 2 | 2 | 2 | 25 |
| giants | giant-near-canopy-east-giant-limb# | 4 | 4 | 0 | 43 |
| columns | column-col##-low@#,# | 3 | 3 | 0 | 21 |
| giants | giant-near-canopy-plateau-oak-lobe# | 3 | 3 | 0 | 23 |
| white-bark | whitebark-roots | 1 | 1 | 1 | 10 |
| giant-detached-boughs | giant-detached-leaves-southwest-giant | 1 | 1 | 1 | 4 |
| understory | understory-us##-high | 1 | 1 | 1 | 8 |
| understory | understory-us##-medium | 1 | 1 | 1 | 2 |
| giants | giant-near-base-east-giant | 1 | 1 | 1 | 31 |
| giants | giant-near-base-plateau-oak | 1 | 1 | 1 | 39 |
| giants | giant-near-base-stair-bank-giant | 1 | 1 | 1 | 33 |
| giants | giant-near-canopy-south-giant-lobe# | 2 | 2 | 0 | 19 |
| giants | giant-near-canopy-plateau-oak-limb# | 2 | 2 | 0 | 30 |
| giants | giants-canopy#-plateau-oak+far-plateau+east-giant+stair-bank-giant | 1 | 1 | 1 | 4 |
| giants | giants-canopy#-lantern-tree+north-west-near+north-west+north-east | 1 | 1 | 1 | 4 |
| giants | giants-canopy#-south-giant+plaza-south+south-centre+southwest-giant | 1 | 1 | 1 | 4 |
| giant-detached-boughs | giant-detached-cards-southwest-giant | 1 | 1 | 1 | 0 |
| giants | giants-authored-leaves-east-giant | 1 | 1 | 0 | 16 |
| giants | giants-authored-leaves-stair-bank-giant | 1 | 1 | 0 | 14 |
| giants | giants-authored-leaves-plateau-oak | 1 | 1 | 0 | 257 |
| giants | giants-authored-leaves-lantern-tree | 1 | 1 | 0 | 29 |
| giant-detached-boughs | giant-detached-wood-southwest-giant | 1 | 1 | 0 | 2 |
| columns | column-col-emergent#-low@#,# | 1 | 1 | 0 | 7 |
| columns | column-col-hut-host#-low@#,# | 1 | 1 | 0 | 7 |
| giants | giant-near-canopy-south-giant-limb# | 1 | 1 | 0 | 9 |
| giants | giant-near-canopy-stair-bank-giant-limb# | 1 | 1 | 0 | 9 |
| giants | giants-authored-cards-east-giant | 1 | 1 | 0 | 1 |
| giants | giants-authored-cards-stair-bank-giant | 1 | 1 | 0 | 1 |
| **total** | 131 | **182** | **57** | |

## Behind the lookout fence (47.5, 8), eye 1.7 m, → the plaza

| part (name pattern) | meshes drawn | main-pass draws | casting (shadow draws) | triangles (K) |
|---|---|---|---|---|
| giants | giants-sector#-plateau-oak+far-plateau+east-giant+stair-bank-giant | 1 | 12 | 12 | 236 |
| giants | giants-sector#-lantern-tree+north-west-near+north-west+north-east | 1 | 12 | 12 | 275 |
| giants | giants-sector#-south-giant+plaza-south+south-centre+southwest-giant | 1 | 12 | 12 | 244 |
| giants | giant-near-canopy-east-giant-lobe# | 16 | 16 | 0 | 115 |
| distant | distant#-far | 6 | 12 | 0 | 5 |
| columns | column-near-canopy-seat#-lobe# | 12 | 12 | 0 | 64 |
| distant | mid#-near | 5 | 10 | 0 | 34 |
| distant | mid#-far | 5 | 10 | 0 | 32 |
| white-bark | whitebark-wb##-low | 10 | 10 | 0 | 112 |
| white-bark | whitebark-wb##-high | 3 | 3 | 3 | 172 |
| columns | column-near-base-seat# | 3 | 3 | 3 | 93 |
| white-bark | whitebark-wb##-high-shadow | 3 | 3 | 3 | 28 |
| columns | column-col##-low@#,# | 5 | 5 | 0 | 36 |
| understory | understory-us##-low | 4 | 4 | 0 | 4 |
| columns | column-col##-high@#,# | 2 | 2 | 2 | 69 |
| giants | giant-near-canopy-east-giant-limb# | 4 | 4 | 0 | 43 |
| giants | giant-near-canopy-stair-bank-giant-lobe# | 3 | 3 | 0 | 65 |
| distant | distant#-near | 1 | 2 | 0 | 2 |
| white-bark | whitebark-roots | 1 | 1 | 1 | 10 |
| giant-detached-boughs | giant-detached-leaves-southwest-giant | 1 | 1 | 1 | 4 |
| understory | understory-us##-medium | 1 | 1 | 1 | 2 |
| columns | column-col##-medium@#,# | 1 | 1 | 1 | 13 |
| giants | giant-near-base-east-giant | 1 | 1 | 1 | 31 |
| giants | giant-near-base-south-giant | 1 | 1 | 1 | 34 |
| giants | giant-near-base-stair-bank-giant | 1 | 1 | 1 | 33 |
| giants | giants-canopy#-plateau-oak+far-plateau+east-giant+stair-bank-giant | 1 | 1 | 1 | 4 |
| giants | giants-canopy#-lantern-tree+north-west-near+north-west+north-east | 1 | 1 | 1 | 4 |
| giants | giants-canopy#-south-giant+plaza-south+south-centre+southwest-giant | 1 | 1 | 1 | 4 |
| giant-detached-boughs | giant-detached-cards-southwest-giant | 1 | 1 | 1 | 0 |
| giants | giants-authored-leaves-east-giant | 1 | 1 | 0 | 16 |
| giants | giants-authored-leaves-stair-bank-giant | 1 | 1 | 0 | 14 |
| giants | giants-authored-leaves-plateau-oak | 1 | 1 | 0 | 257 |
| giants | giants-authored-leaves-lantern-tree | 1 | 1 | 0 | 29 |
| giant-detached-boughs | giant-detached-wood-southwest-giant | 1 | 1 | 0 | 2 |
| columns | column-col-emergent#-low@#,# | 1 | 1 | 0 | 7 |
| columns | column-col-hut-host#-low@#,# | 1 | 1 | 0 | 7 |
| giants | giant-near-canopy-south-giant-lobe# | 1 | 1 | 0 | 9 |
| giants | giant-near-canopy-plateau-oak-limb# | 1 | 1 | 0 | 16 |
| giants | giants-authored-cards-east-giant | 1 | 1 | 0 | 1 |
| giants | giants-authored-cards-stair-bank-giant | 1 | 1 | 0 | 1 |
| **total** | 107 | **157** | **58** | |

## Reading

- **It is not the per-tree meshes.** The white-barks are 10 instanced draws for 40 trees in the low LOD (no shadow past 44 m) plus
  two high-LOD trees by the camera; the understory 4–6; the distant layer's bands 32–36 (two groups each, no shadow). A card would
  not replace them — they are already one draw per variant.
- **Two thirds are the giants, by design.** (1) The three plaza sector meshes: 12 material groups each, main and shadow, 72 draws
  at both poses. (2) The near-canopy lobes and limbs of the giants whose crowns stand within 30 m of the camera — the east giant
  (26 lobes + 4 limbs at the green, 16 + 4 at the fence), the stair-bank giant, the plateau oak, the south giant — and the seated
  columns' lobes (18 / 12): **63 / 32 separate meshes, one draw each, no shadow**. The near canopy's 64 slots are a triangle
  budget (the comment above `NEAR_CANOPY_KEEP`); its draw count is the slot count, because each lobe is its own pooled mesh so the
  sector's far foliage can be folded per lobe.
- **The one structural lever I see is those lobes' draws**: a giant's shown lobes drawn as one mesh with per-lobe geometry groups
  (a hidden lobe = a zero-count group, free; the fold slots stay per lobe) would take 45 → ~5 at the green and, at camera A under
  the plaza's giants, up to 64 → ~6. It fights the pool's memory tier (the lobes are built lazily so the 214 active lobes are not
  resident at once) and it is owner-fable's near canopy (`trees/nearCanopy.ts`, the pool residency in `index.ts`), so it is a
  question in the INBOX, not a change. Everything else in the trees' share is per-material or per-band already.

Draw lists: `green-west.drawlist.json`, `lookout-fence-west.drawlist.json` (mesh, top group, instanced, instances, groups, triangles,
castShadow). Renders `/tmp/f4/r190/L`; dist `/tmp/f4/r187-dist-head`.
