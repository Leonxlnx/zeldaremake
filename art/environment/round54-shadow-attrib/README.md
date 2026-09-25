# Round 54 (fable-4) — the sun's depth pass attributed to the trees, by family and by mesh (head `67544e00`, 960 × 540)

squad2's `shadowcost` read (14:01) split the frame for the first time: the depth pass is a third of it — 174 draws / 2.91 M at hero
A — and asked where it goes, with "the columns and the white-barks" among the candidates; its own flag on the giants' sector meshes
read 0 difference and it concluded the giants' wood is not in the pass. Measured here by switching `castShadow` off on the meshes
of one group at a time in the page (two frames, `stats()`), then mesh by mesh inside the two biggest groups:

## By family (`castShadow` off per top-level tree group)

| pose | frame | the depth pass (every caster off) | the trees' share | white-bark | understory | columns | **giants** |
|---|---|---|---|---|---|---|---|
| hero A | 614 / 8.967 M | 170 draws / 2.907 M | **66 draws / 1.322 M** (45 %) | 7 / 0.180 M | 8 / 0.046 M | 11 / 0.297 M | **40 / 0.799 M** |
| the plateau, looking back south (17, 7.1, −15) → (17, 5, 20) | 576 / 9.073 M | 174 / 3.225 M | **57 / 1.269 M** (39 %) | 2 / 0.019 M | 4 / 0.035 M | 11 / 0.410 M | **40 / 0.805 M** |

(The depth pass here matches squad2's 174 / 2.91 M at A to the K; my plateau pose aims lower than theirs, so the frame differs.)

## The giants, mesh by mesh at A

| mesh | shadow draws | triangles in the depth pass |
|---|---|---|
| `giants-sector-0-lantern-tree+north-west-near+north-west+north-east` | **12** | **275 K** |
| `giants-sector-2-south-giant+plaza-south+south-centre+southwest-giant` | **12** | **244 K** |
| `giants-sector-1-plateau-oak+far-plateau+east-giant+stair-bank-giant` | **12** | **236 K** |
| `giant-near-base-stair-bank-giant` | 1 | 32 K |
| the three `giants-canopy-*` meshes | 1 each | 4 K each |

**The three sector meshes cast every one of their 12 material groups from camera A: 36 draws and 755 K triangles of the depth
pass.** squad2's 0 was its flag not reaching the meshes (the composer's `cullShadowCasters` only switches casters OFF whose swept
sphere misses the camera frustum and restores those after the render; it never re-enables one, so a flag applied to the mesh
holds — mine did). The colour pass's group cull (round 52, `onBeforeRender`) does not reach the depth pass, as the code comment says.

## The columns, mesh by mesh at A (the top eleven of thirty casters)

| mesh | triangles in the depth pass |
|---|---|
| `column-col-3-…-high@-3.5,-24.7`, `…-high@15.7,5.2` | 45 K each |
| `column-col-2-…-high@24.2,11.0` | 40 K |
| `column-near-base-seat-6` / `seat-7` | 33 K / 26 K |
| `column-col-emergent-…-high@-3.1,-7.9` | 31 K |
| `column-col-0-…-high@21.2,6.8` | 29 K |
| four `…-medium@…` instances | 10–13 K each |

## What it says

- Of the depth pass's 2.9 M at A, the trees are 1.32 M: the giants' three sector meshes 0.76 M (every group, wood and leaves alike),
  the columns 0.30 M (their high LODs and near bases), the white-barks 0.18 M (the mature trees' round-52 shadow proxies), the
  understory 0.05 M. The other 1.6 M is not trees — vegetation and structures, by squad2's colour-pass sizes.
- The one tree lever of size is the giants' sectors: a **shadow-only low mesh per giant** (the white-barks' proxy recipe — a
  colour-write-off `MeshBasicMaterial` with a depth material, the sector meshes' `castShadow` off) would take their 36 draws and
  0.76 M to ~6 draws and ~0.1 M — but the giants' leaves' shadow is the dapple on the paths, so the proxy would have to carry the
  leaf mass at a density that keeps it, and the shadows' silhouettes coarsen: a look call for the giants' owner, measurable in a day.
  A per-group cull for the depth pass would save nothing at A — the sun's frustum and the plaza's receivers take every group.

Logs: `depth-pass-by-group.log`, `depth-pass-giants-by-mesh.log`, `depth-pass-columns-by-mesh.log` (tools in `/tmp/f4/clarity/scripts/_f4shadowattrib.mjs`, `_f4shadowmesh.mjs`).
