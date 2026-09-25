# Round 51 — the trees' overdraw, measured (fable-4; after fable-2's raster-time map)

fable-2 (`.agents/reviews/fable-2-raster-time-map-722fecde.md`): on SwiftShader a 14 s frame at A is
trees 5.7 s (40 %) for 35 % of the triangles — "per pixel, not per triangle; a cheaper discard path, or
fewer laminae in the depth of a crown, pays more than triangles". This is the per-pixel number.

## Method

In the page (scene hooks): the `trees` group alone visible, `scene.overrideMaterial` = a
MeshStandardMaterial with black diffuse and a linear emissive of exactly 1/255, additive blending,
depth test and depth write off, tone mapping off, output colour space linear, no fog or background;
one `renderer.render` and `readPixels`. Each pixel's red value = the number of tree fragments issued
for it (the upper bound of leaf-shader invocations: with the depth test on, some are rejected early,
but a merged canopy mesh draws its triangles in build order, so most are shaded before a nearer one
overwrites them).

## Numbers (head 722fecde, 1280 × 720)

| view | tree-covered share of the frame | mean fragments per covered pixel | top third of the frame | max | ≥ 32 layers | ≥ 8 layers |
|---|---|---|---|---|---|---|
| A | 41.7 % | **52.2** | 63.7 | 166 | 27.8 % of the frame | 35.5 % |
| C | 51.1 % | **26.5** | 37.0 | 97 | 20.7 % | 38.8 % |

So a canopy pixel at A runs the tree fragment shader on the order of fifty times — the mechanism behind
40 % of the frame for 35 % of the triangles.

## The lever: a depth prepass for the trees

Render every tree mesh first with a depth-only twin (colour writes off, a trivial fragment; the alpha
test kept for the cards), then the colour pass with `depthFunc = EqualDepth`: the leaf shader then
runs once per pixel. Why it is not a trees-only change: the twin's vertex program must match the
colour program exactly (wind, cushions AND the near-canopy fold) or the prepass depth of a folded far
lobe blocks the near part drawn in its place. The existing shadow twins (`giantTreeDepth`,
`whiteTreeDepth`) deliberately never fold (`depthSlots` → `noCanopy`), so three prepass twins built
on `colourSlots` are needed in `materials.ts` (Astra's; `injectWind` is module-private). The trees
side — twin meshes sharing geometry and, for the instanced families, the `instanceMatrix` attribute,
`renderOrder −1`, the colour materials' `depthFunc` — is `trees/index.ts`. Expected on SwiftShader:
the trees' 5.7 s toward ≈ 2–2.5 s (one shaded layer plus a cheap prepass), a frame of 14 → ≈ 11 s,
takes a quarter faster; on integrated GPUs the same overdraw is paid in fill rate.

## Addendum (2026-09-22 20:40 UTC) — the prepass built and timed: no gain on SwiftShader; proposal withdrawn

Prototyped without touching `materials.ts`: each colour material's injected `onBeforeCompile` wrapped
into a twin (identical vertex program — wind, cushions, fold), the fragment replaced by an alpha-test
+ `gl_FragColor = 0`, colour writes off; twins sharing geometry, `instanceMatrix` and `matrixWorld`,
drawn at `renderOrder −1`; the colour materials at `EqualDepth`. The frame was right (A vs the head:
0.40 % of pixels over 2 levels, 0.12 % over 40 — EqualDepth ties at coincident surfaces), so the twins
matched. **Timed like fable-2 (`render` + a 1-px `readPixels`), A, five frames: head median 14 950 ms,
prepass 14 703 ms (−1.7 %, noise) for +72 draws and +3.2 M twin triangles.** The depth rejection does not
skip the leaf shader's cost on this rasteriser — either SwiftShader shades before the depth test for
these programs or the fragment stage is not where the 5.7 s go. Not worth Astra's twins; the ask is
withdrawn. What remains true: fifty layers per canopy pixel; the levers on this machine are the leaf
shader's own cost per sample (`materials.ts`) or fewer fragments issued (fewer / larger laminae and
cards through a crown's depth — a look question).
