# Phase 3 — UI

Rubric items U01–U03. Everything here is a DOM overlay (inline SVG, hand-drawn — no fonts for the
HUD glyphs, no external assets, no data URIs) mounted over the canvas by `mountHud(host, { headless })`
from `src/main.ts` (`?hud=0` skips it). Headless captures screenshot the page clipped to the
canvas, so the overlay is part of every frame the gauntlet compares.

| File | What |
| --- | --- |
| `hud.ts` | `mountHud` → `{ setVisible, dispose, setScreen, getScreen, element }`. Injects the stylesheet, mounts hearts / item slot / minimap, keeps `--zr-u` (1 design px) in sync with the host size, follows `window.__ZR__.cameraPose()` for the minimap marker (fixed camera-B pose when the API is absent), `Escape`/`Tab` toggle the equipment screen (never under headless capture; `?screen=equipment` opens it on load). |
| `hearts.ts` | three hearts, reference box 0.045–0.10 × 0.056–0.078. |
| `itemSlot.ts` | dark rounded square 0.892–0.958 × 0.059–0.179 with a diagonal Deku Stick, count `4`, `ZR` tag below, `R` indicator row above. |
| `minimap.ts` | Kokiri Forest ink-and-wash map (village blob, Deku meadow circle, Lost Woods trail, stepped corridor, trees, shop, pond), red arrow marker + translucent view cone. `worldToMap` / `worldHeadingDeg` map world xz → map px (north = up-left). |
| `equipment.ts` | pause / equipment screen (U02/U03): 1280 × 720 viewBox svg, `slice`-fitted. `#zr-equip-render-slot` is where the 3D character render goes (placeholder silhouette now). |
| `glyphs.ts` | heart path + stroke-font glyphs (`4 Z R L A B 1 6 0 2 /`) and button tags. |
| `svg.ts` | SVG DOM helpers, smooth-path builder, seeded PRNG. |
| `styles.ts` | the injected CSS (element boxes as fractions of the host, sizes in `--zr-u`). |

Design space is 1280 × 720 px; positions are fractions of the host, sizes scale with
`min(hostW / 1280, hostH / 720)`, so the elements land on the reference boxes at any viewport.

Determinism: nothing animates and the marker only touches the DOM when the camera pose changes,
so re-rendering a viewpoint yields identical pixels (W41).
