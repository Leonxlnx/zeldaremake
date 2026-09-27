# The flight foot's last 0.22 M: it is the vegetation LOD scale, and about 3–4 % of it would do

> **fable-cursor / whoever owns vegetation: this file is the PR description for
> `cursor/squad2-vegmenu-682b`.** The pull-request call is still refused with
> `Validation Failed … "must be a collaborator"` (ninth attempt since 08:20), so please open the PR from
> the branch (base `cursor/kokiri-world-phase1-f65e`) or merge it directly. Evidence only, no source
> change. The queue is `HANDOFF.md` on `cursor/squad2-handoff-682b`; with this branch it is eleven.

`../freshposes/PERF-HEALTH.md` priced the one remaining ceiling breach: the main flight's foot draws
**9.22 M**, 2.7 % over the 9.0 M line, and of that vegetation is **3.471 M** — the only system that has
not moved while everything else came down overnight. This measures which vegetation knob actually pays,
so nobody has to guess.

## The menu (the shipped `?veg=<lodScale>,<grassDensity>` flag, one boot each)

`pose-counts.mjs` at the follow rig's rest pose at `stairs2-base`, head `2b15f687`, settle 8:

| configuration | draws | triangles | delta | ceiling |
| --- | --- | --- | --- | --- |
| default | 547 | **9.223 M** | — | over by 0.22 M |
| grass density 0.9 | 547 | 9.209 M | −0.014 M | over |
| grass density 0.8 | 547 | 9.156 M | −0.066 M | over |
| **veg LOD scale 0.8** | 542 | **7.906 M** | **−1.317 M** | **under** |
| veg LOD scale 0.6 | 523 | 6.972 M | −2.251 M | under |

## What it says

* **Grass density is the wrong knob.** Taking it down a fifth buys 0.066 M — a third of what the pose
  needs, for a visibly thinner lawn.
* **The LOD scale is the lever.** Pulling the vegetation LOD gates in by 20 % saves **1.317 M**, six times
  the 0.22 M required, and drops the pose to 7.91 M.
* So the breach is worth roughly **3–4 % of the LOD scale** if the relation is near-linear around 1.0
  (0.2 of scale ≈ 1.32 M, so 0.22 M ≈ 0.033). A gate pulled in by three or four percent is a different
  proposition from a lawn thinned by a fifth.

## What this measurement does NOT say

Cost only. I have not rendered the look at any of these settings, and pulling vegetation LODs in is a
look change that belongs to the lane that owns it — 20 % almost certainly shows, 3–4 % may not, and only
the owner's poses can settle that. `../freshposes/` has the pose files and `sixcheck.mjs` does the frame
comparison if it helps.

Lane 2's own side is exhausted: the far ring's density and radius, the mid rung, the giants' foliage and
the trees' share of the depth pass are all measured inert or already spent (`../midspend/`, `../farring/`,
`../shadowcost/DEPTH-SPLIT.md`), and the trees gave up 0.314 M at this very pose overnight.
