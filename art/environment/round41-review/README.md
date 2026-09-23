# Round 41 review — looking up, the log arch, trunks, wood (take-0111, `7a90aa6`)

Matched before/after captures of OUR world (SwiftShader, 1280×720, `quality=high`, simulation
time 12.5 s, HUD hidden, character hidden). Before = `1248fd0` (take-0110), after = `7a90aa6`
(take-0111). Comparison evidence only. Lighting identical in both.

## Orchestrator sheets (the seven round-40 poses, re-rendered from the two sealed builds)
`r41-plaza-column`, `r41-landing-up`, `r41-landing-back`, `r41-limb-below`, `r41-pods-3m`,
`r41-roof-from-landing`, `r41-grass-a-face` — same cameras as round 40's sheets, so the three
rounds can be read as a sequence with `art/environment/round40-review/`.

## The agents' sheets (before `85df33f` = take-0110 world | after their final commit)
- `trees25-*.jpg` — r41/trees `785c9c4`: `limb-below` (cards → twig forks with layered laminae,
  lit undersides), `landing-up`, `plaza-up`, `terrace-up` (straight up: branches and leaves with
  sun through them), `stairfoot-45`, `pods-3m` (lantern laminae toward olive on the lit face).
- `structures26-*.jpg` — r41/struct `30dbdd3`: the log arch's crown from above (smooth sheet →
  cushion colonies on a carpet), its belly (fissures, grime, hanging leaflet vines), its flank
  (torn moss skirt), Saria's trunk and doorway at 3 m, a rope post and the signpost at 2 m, the
  huts from the landing.
- `veg21-*.jpg` — r40/veg tail `2dbeadc`: the fiddlehead stalk that crossed the lens (5-sided flat
  wedge → 8-sided graded, shaded stem), the west-ledge carpet (fan repetition, dark spikes).

## Numbers
Six fixed views unchanged by design (A 0.2331 → 0.2324, B 0.2050, C 0.2361, D 0.2850 → 0.2843,
E 0.2156 → 0.2158, F 0.2608 → 0.2621; draws and triangles per fixed view identical for the trees
lane, +0.3–0.5 M for structures). At the walking/looking-up poses the near canopy adds
+0.04…+0.25 M triangles and +7…+43 draws (max 454). Resident near-canopy geometry 173 MB — the
one cost pending a decision (dial `NEAR_CANOPY_MAX_Y` 21 → 17 ≈ 120 MB).
