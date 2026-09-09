# Director's Monitor

A static, GitHub-Pages-hosted "video-assist monitor" for the Kokiri Forest remake. Every hour CI
publishes a **take** — six screenshots of the Three.js world from the saved viewpoints, scored
against the 50-item rubric — and this site shows it like a film set: slate, before/after wipe,
reference overlay, numbered callouts, take notes, metrics, rubric board, crew roster, filmstrip
timeline and a time-lapse reel.

Plain HTML/CSS/JS (ES modules), system fonts, no build step for the assets, no dependencies,
no CDNs or analytics. Data contract: [`SCHEMA.md`](./SCHEMA.md).

```
site/
  index.html  styles.css  app.js  js/*.js  assets/*.svg   ← the site
  serve.mjs                dev server (maps /data/* to a data dir)
  build.mjs                Pages build (site + data → one folder)
  dev/mock-data.mjs        realistic mock data dir for development
  dev/screenshot.mjs       headless-Chrome QA screenshots
  SCHEMA.md                data contract (shared with the gauntlet tooling)
```

## Run locally

```bash
# 1. data: either fetch the real monitor branch into .monitor/ (npm run take -- --publish does
#    this) or generate mock data:
node site/dev/mock-data.mjs                      # → /tmp/monitor-mock (needs /tmp/take0_scaffold/*.png)

# 2. serve
node site/serve.mjs --data /tmp/monitor-mock --port 8787     # default data dir: .monitor/
open http://localhost:8787/
```

Without a `takes.json` the site shows its designed waiting state ("waiting for the first take —
next capture at the top of the hour") with the reference reel and the rubric still visible.

## Build / deploy (GitHub Pages)

```bash
node site/build.mjs --data .monitor --out dist-site
# dist-site/           index.html, styles.css, app.js, js/, assets/, .nojekyll
# dist-site/data/      takes.json, rubric.json, agents.json, ledger.json, takes/, reference/
```

- All data is fetched **relative** (`./data/takes.json`), so it works under
  `https://<user>.github.io/zeldaremake/` or any sub-path.
- The build succeeds without a data dir: it writes an empty
  `{ "project": "zeldaremake", "updatedAt": null, "takes": [] }` and falls back to the repo's
  `gauntlet/rubric.json`, `reference/frames/` and `.agents/*.md` front-matter so the waiting state
  is still useful.
- A Pages workflow only needs: check out `main`, fetch the `monitor` branch into `.monitor/`,
  run `node site/build.mjs --data .monitor --out dist-site`, upload `dist-site/`.

## UI

| Area | What it shows |
| --- | --- |
| Slate | production · SCENE / TAKE · DIR · CAM · ROLL · date · commit link; LIVE pill (green ≤ cadence, amber ≤ 2×, red STALE) with a blinking rec dot; auto-refresh every 5 min |
| Viewer | 16:9 stage; **Before/After** and **Reference** wipes (drag, click, ← → nudge on the handle), **Onion skin** (opacity slider), **Side by side**; viewpoint tabs A–F; director's-frame corners, `TC` timecode from `refSeconds`, vignette |
| Callouts | numbered pins from `shots[].callouts` (colour by kind), in-image label chips, leader lines to the legend; `refCallouts` on the reference in Reference / Side-by-side modes; hover/click highlights; `P` toggles pins |
| Take notes | agent, branch, commit subject, targeted items (click → rubric card), the comparison note, CI ✓ / local attestation, STRUCK stamp + reason for invalid takes |
| Metrics | SSIM, pHash Δ, hue/sat/lum Δ, sharpness, sky %, overexposed % with ▲▼ deltas coloured by the good direction and the rubric goals |
| Rubric | 50 cards in 9 groups with status, value → threshold, Δ badge on flips, Phase-1 progress ring, filters all/pass/fail/pending/flipped |
| Crew | `agents.json`: runtime, status dot, branch, current task, last update; the author of the current take is marked |
| Filmstrip | sticky bottom rail — one thumbnail per take for the current viewpoint, time labels, hour ticks, gap spacers, agent stripe, phase-progress sparkline; ← → / Home / End step takes |
| Reel | time-lapse of all takes for one viewpoint (2 fps player + scrubber), grid of frames, and the reference reel (`reference/frames/timeline/t_*.jpg`, probed when there is no index) |

Deep links: `#take-0007/A_stairs/reference` (take / viewpoint / mode), `#…/reel` for the reel view.

Keys: `←` `→` takes · `Home`/`End` · `A`–`F` viewpoint · `1`–`4` mode · `P` pins · `Space` play (reel).

## QA screenshots

```bash
node site/dev/mock-data.mjs
node site/serve.mjs --data /tmp/monitor-mock --port 8787 &      # or in tmux
node site/build.mjs --data /nonexistent --out /tmp/site-dist-empty
node site/dev/screenshot.mjs --url http://127.0.0.1:8787 --out /tmp/site-shots
```

The screenshot script fails if the page logs any console error or page error.
