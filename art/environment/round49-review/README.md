# Round 49 — the demo's deep world, the plaza's backside, Link's run

World `97c8322` (take-0123, valid, 37/50). Before = take-0121/0122's world, after = each lane's final
build, identical poses. Sheets: `structures32-*.jpg` (the tunnel: `x-arch-tunnel-n`, `x-arch-approach`,
`sn-arch-inside`, `sn-arch-lookout`, D crop, walk sheet), `expansion2-pan-{W,SW,S,SE}-before-after.jpg`
(plaza pans: the west tree-house, the fenced bank + flight + far hut, the bank end; SE is the
byte-identical control), `expansion2-walk-{west,south}-sheet.jpg`, `character10-*.jpg/.png`
(Link: idle/run/stairs sheets, run + accel telemetry, six-view Link crops and pixel diffs).

| item | lane | verdict |
| --- | --- | --- |
| V19 the arch is not a tunnel (no right wall, l 0.43) | structures-32 | PASS — closed tube, frame l 0.405 → 0.145, window:wall 1.5 → 7.4; outer flat-topped silhouette not attempted (D budget) |
| V15 the plaza's backside (west/south/north closure) | expansion-2 | PASS with deviations — west tree-house at 24 m W, fenced bank at 22.7 m SW (due south sits in camera C), far hut at 53 m SW (the NW site's lamp was hidden); six frames byte-identical via live/legacy terrain views |
| W38 camera A over 9.0 M | perf-3 | PASS — 9.11 → 8.66 M, every frame byte-identical (sprout/grass/shadow-caster culling, unpacked packs) |
| Link's run flight + candidate 382ec9ec | character-10 (Astra PR #21) | ADOPT both — root step 9.8 → 5.3 mm, floor-skim 8.8 → 0 m, arms closer, boots smaller; stairs unchanged (descent nosing penetration 72 mm remains: a clip fix, Astra) |

Open after this round: the arch's outer 2.2:1 silhouette (D's SSIM measures it), the flat hero
canopy lobes (Astra's PR #23 swap needs a dark backing — F/C −0.03 as it stands), the bark-mean
sRGB/linear bug (Astra + `lanternBranch.ts`), Astra's combined candidate `1e81bb6c` for the stairs
(character-10b evaluating), fable-5's V16/V17, the goal-mode chats' lanes.
