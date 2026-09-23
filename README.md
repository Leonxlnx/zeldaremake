# zeldaremake — Kokiri Forest in Three.js

A shot-for-shot real-time recreation of the Kokiri Forest gameplay clip from the *Ocarina of Time*
remake first look ([reference](https://x.com/DiscussingFilm/status/2097327973351272627)), built in
Three.js by two AI coding agents working in parallel under a scored, anti-cheat-protected
iteration loop.

- **Phase 1 — World** (current): terrain, the 18-step stairway, flagstone paths, tree-trunk
  houses with pod lanterns, giant trees, dense vegetation, god rays, mist, falling leaves.
- **Phase 2 — Character:** young Link, Navi, Kokiri kids.
- **Phase 3 — UI:** hearts, item slot, minimap, equipment screen.

## Run it

```bash
npm install
npm run dev          # world at http://localhost:5173  (WASD, drag to look, 1–6 viewpoints, H = hide HUD)
npm run build        # typecheck + production build → dist/
npm run capture      # headless screenshots of every saved viewpoint → gauntlet/out/capture/
npm run take -- --agent <id> --items W02 --note "…"   # one gauntlet iteration
npm run site:dev     # Director's Monitor at http://localhost:8787
```

Requires Node ≥ 20 and a Chrome/Chromium binary (set `CHROME_PATH` if not auto-detected).

## For agents and contributors

Start with [`AGENTS.md`](AGENTS.md) (collaboration protocol) and [`GAUNTLET.md`](GAUNTLET.md)
(the loop, the 50-item rubric, the anti-cheat). The task brief is
[`docs/PROMPT_PHASE1.md`](docs/PROMPT_PHASE1.md); the reference study is
[`reference/ANALYSIS.md`](reference/ANALYSIS.md).

## Director's Monitor

Every hour CI captures the world from the saved viewpoints, scores it against the rubric, and
publishes a new **take** — before/after sliders, reference overlays, callouts, and the rubric
scoreboard — to GitHub Pages. See `site/`.

## Licence

Code: MIT. Textures: CC0 (credited in `public/textures/CREDITS.md`). No Nintendo assets are used;
reference frames under `reference/` are downscaled stills used solely for comparison.
