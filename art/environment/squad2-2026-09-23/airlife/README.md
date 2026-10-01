# Backlog item 5, measured: "gentle life in the air, not spectacle"

Lane 2, 2026-09-29, taking the next unclaimed Backlog item because this lane's own list is empty. **For
lane 1 (`atmosphere/`) and lane 4 (`vegetation/`)** — this measures their work; it changes nothing.

> **Corrected 2026-09-29 05:20 UTC.** The first version of this file reported that the 180 motes paint
> nothing and asked lane 1 to look at `motes.ts`. That was a bug in my probe, not in their code: the motes
> do paint, 0.102 % of A_stairs at mean Δ 22.2/255. See the correction section. **Lane 1 has nothing to fix
> here.**

The item is built: `atmosphere/leaves.ts` (96 falling leaves), `atmosphere/motes.ts` (180 motes) and
`vegetation/butterflies.ts` (34 butterflies, whose header cites this very item). What had never been done is
checking the result against the owner's wording, and "gentle" versus "spectacle" is answerable from a frame:
how much of it these elements occupy, how hard they stand out from what is behind them, and whether that
holds half a second later.

`airlife.mjs`: pose, settle with time, **set the clock back and freeze it**, take the frame, hide one family,
take it again. The footprint is the share of pixels that moved; its strength is the mean and max delta on
those pixels. Repeated at t + 0.5 s.

The motes column is from `variantfoot.mjs` instead, for the reason in the correction below.

| pose | t | falling-leaves | motes | butterflies |
| --- | --- | --- | --- | --- |
| A_stairs | 12.5 s | 0.152 % · mean Δ 10.4 · max 99 · 786 px | 0.102 % · 22.2 · 159 · 529 px | 0.022 % · 13.1 · 70 · 116 px |
| A_stairs | 13.0 s | 0.250 % · 8.9 · 103 · 1296 px | not re-measured | 0.021 % · 12.3 · 62 · 111 px |
| owner-0650-north | 12.5 s | 0.092 % · 11.3 · 140 · 475 px | 0.030 % · 17.2 · 105 · 154 px | **0.229 % · 48.2 · 185 · 1189 px** |
| owner-0650-north | 13.0 s | 0.079 % · 12.4 · 105 · 409 px | not re-measured | 0.210 % · 46.8 · 182 · 1089 px |
| F_canopy | 12.5 s | 0.101 % · 8.0 · 61 · 521 px | not re-measured | 0.006 % · 33.0 · 149 · 33 px |

## Gentle, not spectacle: yes, comfortably

All three families together occupy **0.1–0.5 % of the frame**. The leaves are the most widespread and the
faintest — 400–1300 pixels at a mean delta of 8–12/255, which is a drift you notice without being drawn to
it. The butterflies are the opposite shape: the **smallest in extent and the most vivid**, 33–1189 pixels at
a mean delta of 33–48/255, which is a pair of lit wings near the path rather than a swarm. For 34
butterflies over the whole village that is the right reading, and nothing here is spectacle by any measure
this frame can give.

## Correction: the motes do paint — the first reading was my probe's fault

An earlier version of this file said hiding all 180 motes left the frame byte-identical and called that
third of the item unfinished. **That was wrong, and the fault was in `airlife.mjs`, not in `motes.ts`.**

The probe hid a family with `object.visible = false` and then rendered. `motes.ts` writes `points.visible`
itself on **every** frame, at the end of its `update()`:

```ts
if ( sun && depthTex && depthTex.compareFunction === null ) { …; points.visible = true; }
else { uniforms.uHasShadow.value = 0; points.visible = false; }
```

`update()` runs inside `render()`, so the hide was undone before the frame drew. Both frames contained the
motes, the difference was genuinely zero, and the zero meant "the probe changed nothing" rather than "the
family paints nothing". The census line that reported *one mesh hidden* was true and irrelevant — it recorded
the write, not whether it survived. Nothing else in the two families was affected: neither `leaves.ts` nor
`butterflies.ts` writes `.visible` anywhere, so their numbers stand.

Re-measured the way the branch's shadow work was measured — **two builds that differ only in that family's
draw**, same pose, same frozen clock, no runtime hook (`variantfoot.mjs`, the variant sets
`material.visible = false` in `createMotes` and is never committed):

| pose | draws with → without | md5 with → without | footprint |
| --- | --- | --- | --- |
| A_stairs | **559 → 558** | `039e1a76` → `ebbc0ce7` | 0.102 % · 529 px · mean Δ 22.2 · max 159 |
| owner-0650-north | **440 → 439** | `65aee3dc` → `8b37cc48` | 0.030 % · 154 px · mean Δ 17.2 · max 105 |

Exactly one draw call fewer — the motes are a single `Points` — and the frames differ. So the motes are
submitted, they are drawn, and they paint. Their footprint sits between the other two families in every
respect: wider than the butterflies, brighter per pixel than the leaves. **All three parts of item 5
deliver, and the verdict above holds for all three.**

Two fixes went in so this cannot recur: the probe now hides the **material** as well (nothing in the world
writes `material.visible`) and **asserts after the frame that the material hide survived**, which turns a
silently-undone hide into a thrown error instead of a zero; and `dist`/`outDir` being positional is now
checked, because passing a flag there made the page serve the wrong directory and cost a 15-minute
`openWorld` timeout.

The one substantive thing that survives from the earlier note, still unverified and still cheap: the points
are additive with `depthTest: true`, so a mote behind nearer geometry is rejected. That is a design choice
of lane 1's, not a defect, and these two poses show enough motes that it is clearly not suppressing them all.

## Files

- `airlife.mjs` — the probe (hides material + object, asserts the hide held).
- `variantfoot.mjs` — the hook-free footprint: compares two `frozen.mjs` output directories.
- `airlife.json`, `fcanopy/airlife.json` — the leaves/butterflies numbers above.
- `motes/` — the corrected motes measurement: both frames, the counts, the footprint.
- `*-t12_5.jpg`, `*-t13_0.jpg` — the base frames each row was measured against.

## Reproducing the motes row

```bash
node art/environment/squad2-2026-09-23/frozen.mjs dist /tmp/motes-on \
     --poses /tmp/motespose.json --views A_stairs --size 960x540 --settle 8
# add `material.visible = false` after the material in createMotes, then:
npx vite build --outDir dist-motesoff && git checkout src/world/atmosphere/motes.ts
node art/environment/squad2-2026-09-23/frozen.mjs dist-motesoff /tmp/motes-off \
     --poses /tmp/motespose.json --views A_stairs --size 960x540 --settle 8
node art/environment/squad2-2026-09-23/airlife/variantfoot.mjs /tmp/motes-on /tmp/motes-off
```
