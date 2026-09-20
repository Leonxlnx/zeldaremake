# Round 40 review — the owner's marked defects (take-0110, `1248fd0`)

Matched before/after captures of OUR world (SwiftShader, 1280×720, `quality=high`, simulation
time 12.5 s, HUD hidden, character hidden). Before = `0820f92` (take-0109), after = `1248fd0`
(take-0110). Comparison evidence only; nothing here is runtime content. Lighting is unchanged
between the two (Astra's daylight pass is in both).

## Owner-view sheets (same seven poses, rendered by the orchestrator from the sealed builds)

| file | pose | what to look at |
| --- | --- | --- |
| `r40-plaza-column.jpg` | player height 1.45 m on the plaza, at the left column bole | the smooth pale pipe → cords, furrows, lichen, ragged moss sheets, knee stubs |
| `r40-landing-up.jpg` | stair landing [16.24, 7.2, −7.07], looking up the stair heading | crown outlines: paddles → leaf clumps (rim cards on the cored lobes, rim fans on distant crowns) |
| `r40-landing-back.jpg` | landing, looking back over the plaza | the dressed bank lobes, the lit plaza stones (corridor pools) |
| `r40-limb-below.jpg` | straight up under the lantern limb | twig forks with layered cupped laminae, backlit; moss and vines |
| `r40-pods-3m.jpg` | 3 m from the lantern pods | the limb as a rounded tapering branch with layered leaves; pods and cords unchanged |
| `r40-roof-from-landing.jpg` | landing, looking at Saria's roof | cushion-tuft colonies over a shaded floor, torn moss edge over bark, ferns/trefoils on the crown |
| `r40-grass-a-face.jpg` | player height at the bank face east of the stair foot (the marked right-foreground grass) | fine clustered blades, varied heights, verge band |

## The agents' own sheets (before `0820f92` | after their final commit)

- `trees24-*.jpg` — r40/trees `e155bea`: plaza column, pods at 3 m, limb from below, bank lobes from the plaza and the landing, frame A, the six fixed views.
- `structures25-*.jpg` — r40/struct `c959308`: viewpoint B roof crop at 2×, the crown from the landing at 2×, the landing view.
- `veg21-*.jpg` — r40/veg `3fa2019`: frame A's right foreground, the hero fern from inside (bipinnate pinnae, stem-like rachis), an east-rim verge at 2 m, the bank face at player height, the west-ledge carpet (clump variation, spikes).

## Numbers (six fixed views vs the old first-look frames; the owner has accepted this cost for real detail)

A 0.2376 → 0.2331, B 0.2141 → 0.2050, C 0.2382 → 0.2361, D 0.2933 → 0.2850, E 0.2293 → 0.2156,
F 0.2725 → 0.2608 (mean 0.2475 → 0.2393). Draws 575, 6.23 M triangles on A; vegetation triangles
below round 39's; determinism 0. A rubric proposal to re-reference the comparisons to the owner's
new recording is pending (`gauntlet/RUBRIC_PROPOSALS.md`, 2026-09-16).
