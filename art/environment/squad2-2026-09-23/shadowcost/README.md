# A third of every frame is the sun's depth pass — and the giants' wood is not in it

Two results, one of which corrects my own hypothesis from `../lookbacks/README.md`.

W38's gate (≤ 700 draws, ≤ 9.0 M triangles) is read from `renderer.info` after a composed frame, so
it counts the shadow pass as well as the colour pass. Nobody had split the two. `?shadow=0` sets
`sun.castShadow = false` (`lighting/index.ts`: `ctx.quality.shadows && PERF.shadowMapSize > 0`), so the
difference between two `pose-counts.mjs` runs is the whole depth pass.

## What the depth pass costs (head `905d55ea`, 960 × 540)

| pose | shadows on | shadows off | the depth pass | share of the frame |
| --- | --- | --- | --- | --- |
| hero A | 614 draws / 8.97 M | 440 / 6.06 M | **174 draws / 2.91 M** | 28 % of draws, **32 % of triangles** |
| plateau look-back | 745 / 11.15 M | 529 / 7.45 M | **216 draws / 3.70 M** | 29 % / **33 %** |
| ledge look-back | 673 / 11.23 M | 509 / 7.87 M | **164 draws / 3.36 M** | 24 % / **30 %** |

A third of the triangle budget is the sun's depth map. That is a larger line than any single system's
colour pass — vegetation, the biggest of those, is 2.46 M at hero A. Both look-backs would be inside
the 9.0 M ceiling with the depth pass alone removed (7.45 M and 7.87 M), which is another way of
saying the overage is shadow work as much as it is geometry.

## The giants' wood is not what the depth pass draws

`../lookbacks/README.md` asked whether the giants' wood — 1,508,970 triangles, the largest single
geometry in the trees system, whose sector meshes carry per-giant group culling for the colour pass
only — was paying twice in the depth pass. It is not.

With a temporary flag on the three giant wood sector meshes (`castShadow = false`, verified present in
the built bundle and passed through `ZR_URL_EXTRA`):

| pose | head | giants' wood not casting | difference |
| --- | --- | --- | --- |
| hero A | 614 draws / 8.97 M | 614 / 8.97 M | **0 / 0** |
| plateau look-back | 745 / 11.15 M | 745 / 11.15 M | **0 / 0** |

Zero, both poses. The shadow-caster cull that already runs every frame (`postfx/composer.ts` →
`cullShadowCasters`, `shadowCasterCull: true` by default) plus three's own light-frustum test are
already keeping the giants' wood out of the depth pass at these cameras. The hypothesis was wrong, and
the flag has been reverted — no source change is proposed from it.

So the depth pass's 2.9–3.7 M is somewhere else: the candidates by colour-pass size are vegetation
(2.46–3.75 M), structures (2.0–2.3 M), the columns and the white-barks. Splitting it per system needs
per-system caster toggles, which the capture API does not expose; the cheap next probe is the existing
`?veg=<lodScale>,<grassDensity>` flag — if the shadow delta collapses when the grass thins, the depth
pass is mostly ground cover.

## Method notes

* `?shadow=0` is the whole-pass switch; `?shadow=<size>,<taps>` otherwise sets the map size and taps.
* `pose-counts.mjs --only NONE` skips the six fixed viewpoints and measures only the `--shots` poses.
* Both runs settle 8 frames, and the numbers repeat exactly across runs (the same 614 / 8.97 M read
  three times today), so a difference of zero is a real zero and not noise.
