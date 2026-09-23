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
| Slate | production · SCENE / TAKE · DIR · CAM · ROLL · date · commit link; LIVE pill (green ≤ cadence, amber ≤ 2×, red STALE) with a blinking rec dot; auto-refresh every 5 min; the **Walk the world** link pinned to the published build's SHA (dashed when the take on screen is not the build's take) |
| Director's cut | above the viewer: the take's **headline** (the ledger note's first sentence — `site/js/headline.js`, shared with `monitor.mjs`), its round, who shot it and when, and one chip per viewpoint with the SSIM delta against the previous take (click → that viewpoint); links to the full note, the evidence and the player strip |
| What the player sees | under the metrics: the take's player-height strip (`data/takes/<id>/player/`, rendered by `site/tools/player-strip.mjs`); borrowed from the nearest earlier take when this one has none; click → lightbox with a this-take ↔ previous toggle |
| Evidence gallery | above the rubric: every round's before/after sheets and the survey reports (`data/evidence/`, exported from `art/environment/` by `monitor.mjs syncEvidence`); one set open at a time (the current take's round by default), its README rendered beside the sheets grouped by lane; before/after pairs are one card (hover = before); click → lightbox with prev/next and A/B |
| Viewer | 16:9 stage; **Before/After** and **Reference** wipes (drag, click, ← → nudge on the handle), **Onion skin** (opacity slider), **Side by side**; viewpoint tabs A–F; director's-frame corners, `TC` timecode from `refSeconds`, vignette |
| Callouts | numbered pins from `shots[].callouts` (colour by kind), in-image label chips, leader lines to the legend; `refCallouts` on the reference in Reference / Side-by-side modes; hover/click highlights; `P` toggles pins |
| Take notes | agent, branch, commit subject, targeted items (click → rubric card), the comparison note, CI ✓ / local attestation, STRUCK stamp + reason for invalid takes |
| Metrics | SSIM, pHash Δ, hue/sat/lum Δ, sharpness, sky %, overexposed % with ▲▼ deltas coloured by the good direction and the rubric goals |
| Rubric | 50 cards in 9 groups with status, value → threshold, Δ badge on flips, Phase-1 progress ring, filters all/pass/fail/pending/flipped |
| Crew | `agents.json`: runtime, status dot, branch, current task, last update; the author of the current take is marked |
| Filmstrip | sticky bottom rail — one thumbnail per take for the current viewpoint, time labels, hour ticks, gap spacers, agent stripe, phase-progress sparkline; ← → / Home / End step takes |
| Reel | time-lapse of all takes for one viewpoint (2 fps player + scrubber), grid of frames, and the reference reel (`reference/frames/timeline/t_*.jpg`, probed when there is no index) |

Deep links: `#take-0007/A_stairs/reference` (take / viewpoint / mode), `#…/reel` for the reel view.

Keys: `←` `→` takes · `Home`/`End` · `A`–`F` viewpoint · `1`–`4` mode · `P` pins · `Space` play (reel) ·
in the lightbox `←` `→` sheets, `Space`/`B` before ↔ after, `Esc` close.

## Publishing the director's-cut data

Everything new is written by `gauntlet/scripts/lib/monitor.mjs` at publish time, so nothing changes
on the `monitor` branch until a take is published with this code, and the site degrades gracefully
(the headline and round are derived client-side for older takes; the strip and the gallery show a
note until their data exists):

```bash
# 1. (optional, per take) the player strip — 14 player-height poses from the SAME build/commit the
#    take will capture; staged under gauntlet/out/player because take.mjs rotates its capture dirs
node site/tools/player-strip.mjs --dist dist --out gauntlet/out/player     # ZR_NATIVE_GPU=1 on the owner's machine
# 2. the take as usual: takes[].headline / round, takes.play, data/takes/<id>/player/, data/evidence/ all land in one publish
npm run take -- --agent <id> --items … --note "…" --publish
```

`monitor.mjs` publishes a staged strip only when its `index.json` `sha` equals the take's commit
(a strip left over from another build is logged and ignored); it also accepts a `player/`
directory inside the capture directory itself.

`site/tools/player-poses.json` is the pose list (name / label / p / t / fov, copied from
`art/environment/survey2/manifest.json`); edit it there.

## QA screenshots

```bash
node site/dev/mock-data.mjs
node site/serve.mjs --data /tmp/monitor-mock --port 8787 &      # or in tmux
node site/build.mjs --data /nonexistent --out /tmp/site-dist-empty
node site/dev/screenshot.mjs --url http://127.0.0.1:8787 --out /tmp/site-shots [--take take-0013] [--prev take-0012]
```

The screenshot script fails if the page logs any console error or page error. Against the real
`monitor` data pass the newest take (`--take take-0116 --prev take-0115`); the director's cut,
player strip, evidence gallery and lightbox get their own shots (13–17).
