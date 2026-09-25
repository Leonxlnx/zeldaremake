# The waymarkers' chevrons (owner rubric #1 / #10) — fable-3, 2026-09-24 21:00

`2b40b289` on `agent/fable-3-south-props` (`props/geometry.ts markerGeometry`). The three waymarkers (the west fork, the
circle's entrance, the south route) carried blank crossboards. Each board now has a chevron carved into both side faces
near its tip, pointing the way the board does: two dark-stained strips (3.5 mm proud, 9 mm wide, 7.5 cm long) meeting
at the apex 62° apart. 8 strips per board, ≈ 100 triangles a marker; the wood material, so no draw.

- `before-after-south-marker-chevrons-3m.jpg` — the south waymarker from the path at 3 m: the short board's chevron
  toward the plaza, the long board's toward the bridge.

The strips draw from the marker's rng, so each marker's tag now sways a few degrees differently than before — seeded,
deterministic, inside the marker. D (the one fixed view that can hold the circle marker) before/after: table below.

| view | before `964d8862` | after `2b40b289` | Δ | draws |
| --- | --- | --- | --- | --- |
| D_log | 0.2511 | 0.2511 | 0 | 561 / 8.63 M both |

D changes by 0 px — the circle marker is behind the log's root mass from D; A / B / C / E / F hold no marker (the west
fork's is behind A's camera, the south's culls from C at 30 m). Tests 160 / 160.
