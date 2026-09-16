# Round 39 review — tree bases (trees-23) and grass carpet (vegetation-20)

Matched before/after captures of OUR world (SwiftShader, 1280×720, `quality=high`, simulation time
12.5 s, HUD hidden, character hidden). Before = `78a0ca1` / `36ac68a` (the round-38 seal), after =
`0820f92` (take-0109). Comparison evidence only; nothing here is runtime content.

| file | what |
| --- | --- |
| `treebase-audit-a9ef29f.jpg` | the BEFORE audit that started the pass (owner's complaint): five close-ups at walking height — plaza-south base, north-west base, stair-bank base, lantern-tree base, grass |
| `treebase23-overview.jpg` | the same five poses AFTER, plus four 3 m root shots (3×3) |
| `treebase23-{stairbank,plaza,nwnear,lantern}-roots-3m.jpg` | walking height 1.45 m, 3 m from the bole, looking down at the roots — before (left) / after (right) |
| `treebase23-kit-*.jpg` | Astra's root-base prototype (a57c6dd3, `VITE_ROOT_KIT=1` build) vs the procedural base on the two test boles (plaza-south R 2.2 m, stair-bank R 1.1 m) |
| `treebase23-sixview.txt` | six fixed views: SSIM / draws / tris before → after (±0.0002; the near LOD is off at the fixed cameras by design) |
| `grass20-eye-west-ledge.jpg`, `-crop.jpg` | walking eye 1.45 m, 20° down: blades over soil → closed turf with clump tufts; the crop is native pixels |
| `grass20-eye-southwest-lawn.jpg`, `grass20-closeup.jpg` | two more lawn poses (the close-up is the audit's grass pose) |
| `grass20-view-A_stairs.jpg`, `grass20-view-B_house.jpg` | fixed cameras A and B before/after |
| `grass20-sixview.txt` | six fixed views + carpet audit (17,939 clump cards, 20,068 turf mats, vegetation tris −35 %) |
| `4k-still-A-crops-1280-vs-3840.jpg` | 1:1 crops of shot A at 1280 (upscaled) vs a native 3840×2160 render of the pre-round-38 world — where texture/leaf detail ran out |

Numbers and the agents' full reports are summarised in `.agents/fable-cursor.md` (ticks 111–115).
