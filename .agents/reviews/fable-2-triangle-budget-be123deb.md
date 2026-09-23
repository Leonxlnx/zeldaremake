# fable-2 — camera A's triangle budget by system on the head `be123deb` (after the squad's lanes 1–5, fable-4's understory, lane 6): 9.15 M, +0.41 M since the 09-22 map, over W38's 9.0 M

Method as `fable-2-triangle-budget-110453d4.md`: the page's `__ZR__.isolate(system)` at A with the shadow map on and off (the
capture harness, `--settle 4`, character shown as the take has it); "shadow pass" = with − without. Numbers are the renderer's
`info.render` for the isolated system, so they sum to the frame within a few tens of thousands.

| system | main pass (no shadow) | shadow pass | with shadow | 09-22 map (`110453d4`): main / with shadow | Δ with shadow |
|---|---|---|---|---|---|
| trees | 1.56 M (155 draws) | 1.29 M | **2.85 M** (214 draws) | 1.73 / 3.06 M | -0.21 M |
| vegetation | 2.19 M (114 draws) | 0.30 M | **2.49 M** (126 draws) | 1.72 / 1.95 M | +0.54 M |
| structures | 1.29 M (74 draws) | 0.72 M | **2.01 M** (119 draws) | 1.25 / 1.93 M | +0.08 M |
| hardscape | 0.53 M (14 draws) | 0.23 M | **0.75 M** (18 draws) | 0.52 / 0.75 M | +0.00 M |
| terrain | 0.28 M (21 draws) | 0.35 M | **0.63 M** (33 draws) | 0.28 / 0.63 M | -0.00 M |
| rocks | 0.15 M (24 draws) | 0.09 M | **0.24 M** (35 draws) | 0.15 / 0.24 M | +0.00 M |
| character | 0.07 M (15 draws) | 0.07 M | **0.14 M** (20 draws) | 0.07 / 0.14 M | +0.00 M |
| props | 0.04 M (5 draws) | 0.04 M | **0.09 M** (10 draws) | 0.04 / 0.09 M | -0.00 M |
| atmosphere | 0.00 M (3 draws) | 0.00 M | **0.01 M** (4 draws) | — | — |
| canopy | 0.01 M (7 draws) | 0.00 M | **0.01 M** (7 draws) | — | — |
| **frame** | **445 / 6.12 M** | **3.03 M** | **597 / 9.15 M** | 334 / 5.77 M → 450 / 8.74 M | **+0.41 M** |

Reading. The +0.41 M since `110453d4` is **vegetation's main pass (+0.47 M: the squad's lane-4 verges — violets, fronds, clover
on the walked edges — and the grass to 26 m)**; trees are net −0.21 M (fable-4's sector groups and colour-pass culling gave more
than the mid-canopy layer and the understory took at A); structures +0.08 M (the crafted lanterns, the huts' features). Hardscape,
terrain, rocks, character and props are unchanged to the ten-thousand. The shadow pass is 3.03 M of the 9.15 (33 %): trees' casters
1.29 M, structures' 0.72 M, terrain's 0.35 M, vegetation's 0.30 M.

Where the 150 K+ to get back under 9.0 M sits, by size and by what the frames would notice least: (1) vegetation's main pass at A
(2.19 M, 114 draws) — the verges' near blades are what the owner asked for, so the candidate is the grass beyond 16 m at A
(the 26 m extension was +150 K in §65) or a card LOD for the fronds past 10 m; (2) trees' shadow casters (1.29 M) — a coarser
caster for the crowns' cards, as fable-4's shadowlod did for the boles (−240 K at C in `c938a862`); (3) structures' shadow pass
(0.72 M) — the lantern frames and the huts' ribs / ladders casting at 25–45 m. Rocks (0.24 M) and hardscape (0.75 M, 18 draws)
have nothing left to give that a walker would not see.
