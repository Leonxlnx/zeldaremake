# Backlog item 5, measured: "gentle life in the air, not spectacle"

Lane 2, 2026-09-29, taking the next unclaimed Backlog item because this lane's own list is empty. **For
lane 1 (`atmosphere/`) and lane 4 (`vegetation/`)** — this measures their work; it changes nothing.

The item is built: `atmosphere/leaves.ts` (96 falling leaves), `atmosphere/motes.ts` (180 motes) and
`vegetation/butterflies.ts` (34 butterflies, whose header cites this very item). What had never been done is
checking the result against the owner's wording, and "gentle" versus "spectacle" is answerable from a frame:
how much of it these elements occupy, how hard they stand out from what is behind them, and whether that
holds half a second later.

`airlife.mjs`: pose, settle with time, **set the clock back and freeze it**, take the frame, hide one family,
take it again. The footprint is the share of pixels that moved; its strength is the mean and max delta on
those pixels. Repeated at t + 0.5 s.

| pose | t | falling-leaves | motes | butterflies |
| --- | --- | --- | --- | --- |
| A_stairs | 12.5 s | 0.152 % · mean Δ 10.4 · max 99 · 786 px | **0 % · max 0** | 0.022 % · 13.1 · 70 · 116 px |
| A_stairs | 13.0 s | 0.250 % · 8.9 · 103 · 1296 px | **0 % · max 0** | 0.021 % · 12.3 · 62 · 111 px |
| owner-0650-north | 12.5 s | 0.092 % · 11.3 · 140 · 475 px | **0 % · max 0** | **0.229 % · 48.2 · 185 · 1189 px** |
| owner-0650-north | 13.0 s | 0.079 % · 12.4 · 105 · 409 px | **0 % · max 0** | 0.210 % · 46.8 · 182 · 1089 px |
| F_canopy | 12.5 s | 0.101 % · 8.0 · 61 · 521 px | **0 % · max 0** | 0.006 % · 33.0 · 149 · 33 px |

## Gentle, not spectacle: yes, comfortably

All three families together occupy **0.1–0.5 % of the frame**. The leaves are the most widespread and the
faintest — 400–1300 pixels at a mean delta of 8–12/255, which is a drift you notice without being drawn to
it. The butterflies are the opposite shape: the **smallest in extent and the most vivid**, 33–1189 pixels at
a mean delta of 33–48/255, which is a pair of lit wings near the path rather than a swarm. For 34
butterflies over the whole village that is the right reading, and nothing here is spectacle by any measure
this frame can give.

## But one third of the ask is not delivering: the motes paint nothing

**Hiding all 180 motes leaves the frame byte-identical** — max delta **0**, not one channel value, at three
poses and two world times, including `F_canopy`, which looks up the stairs into the god rays where dust
should show if it shows anywhere. The object was visible and was hidden (the probe reports one mesh hidden
each time), so this is not the probe missing them.

The motes are the nearest thing in the world to the owner's "fireflies", so this is the part of item 5 that
is unfinished. What is visible from `motes.ts` for whoever picks it up — none of it conclusive, all of it
cheap to check:

- The points are additive with `depthWrite: false` but **`depthTest: true`**, so a mote behind any nearer
  geometry is rejected. In a closed forest at midday that could be all of them.
- The whole object is gated on the sun's shadow depth texture existing with `compareFunction === null`
  (BasicShadowMap). That gate **passed** here — the object was visible — so it is not the cause.
- The fragment keeps a floor for shaded motes: `mix(0.25, 1.0, vLit) * (0.6 + 0.4 * vPulse) * uIntensity`.
  So even a fully shaded mote should paint something unless `uIntensity` is ~0 or the points are not on
  screen — which points at `uIntensity` and at the placement volume against these three poses.

`airlife.mjs` takes `--only <shot>` and prints the table above, so any fix can be read the same way.

## Files

- `airlife.mjs` — the probe.
- `airlife.json`, `fcanopy/airlife.json` — the numbers above.
- `*-t12_5.jpg`, `*-t13_0.jpg` — the base frames each row was measured against.
