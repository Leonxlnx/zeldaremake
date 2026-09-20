# Far-crown atlas candidate — CPU evidence

The native baseline `w19-spine-u` shows enlarged soft radial clumps on the distant-tree crowns
when seen from below. This candidate changes only `createFarCrownAtlas` in
`src/world/trees/leaf-cluster-texture.ts`: the existing leaf-cluster painter supplies a temporary
alpha stamp, and the smaller lit leaflets use its teardrop outline. The final atlas retains the
same four crown types, clump centres/radii, 1024 × 1024 size, alpha bleed and mip settings.

`cpu-comparison.png` shows the first cell before/after on a plain background. It is a **CPU atlas
preview, not a rendered scene**. `before-atlas.png` and `candidate-atlas.png` contain all four
cells with alpha. The full measurements are in `metrics.json`.

The actual TypeScript painters were run with bundled `@napi-rs/canvas`; no browser or WebGL was
started, and no dependency was added to this repository. Run from the repository root:

```powershell
node art/environment/astra-distance/atlas-cpu.mjs 3dadc4a3
```

The helper resolves the bundled canvas package on this machine. Set `ZR_CPU_CANVAS_PACKAGE` to
an existing compatible package path elsewhere. It does not install anything.

Checks passed:

- Repeated candidate output is byte-identical. Every call/result in the original four
  `far-crown-*` random streams is unchanged; the leaf stamp has an independent fork.
- Texture dimensions, filtering, mipmaps, wrapping and anisotropy are unchanged.
- At 512 pixels per cell, alpha-test coverage changes by +0.65 to +1.03 percentage points;
  the outer bounds move by at most 1.96% of a cell. These are leaf margins around the same crown
  footprint, rather than changes to the authored crown/card dimensions.
- Mean encoded luminance of covered pixels stays within 0.6% at full resolution. The number of
  enclosed gaps of at least four pixels rises from 5 to 63 across the four cells.
- A box-filter alpha mip simulation from 512 to 16 pixels per cell retains coverage within 10%
  of baseline and tone within 3%; small gaps close at distance rather than dissolving the crown.
- `npm run typecheck` and `npm run build` pass; `git diff --check` is clean.

Draw calls, triangles and persistent GPU texture size are unchanged by this candidate. The
temporary 128-pixel canvases and texture are used only while painting, and the texture is
disposed before return. CPU painting took roughly 0.75–0.85 s for the candidate versus 0.33 s
for baseline in warm local runs. Those are startup measurements, not browser frame timings.

The parent's integrated 24-view evidence remains frozen at `3dadc4a3`. This candidate needs a
separate native review at `w19-spine-u`, `w21-spine-l` and the real-tree 119/121 m threshold
pair. Browser alpha filtering, transparency overdraw and the visual interaction with the existing
crown lighting remain unverified here. No colour-space or fog change is included.
