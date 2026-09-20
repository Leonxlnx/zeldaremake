# Props lane (fable-3) — iteration 7: the props' wood toward the fences' red-brown

BEFORE = the world head `e54a74ed`, AFTER = `agent/fable-3-wood` @ `73129594` (one constant:
`WOOD_TINT`). Both built from clean worktrees on this VM; six views `capture.mjs --quality high
--settle 12`, poses `broll.mjs --size 1280x720 --fps 12 --test --settle 12 --quality high` with
`shots.json`, same batch position each side. Labels burned in.

## Measured, not eyeballed

At `px-plateau` (the storage corner, 3 m) the brown pixels of the crate and barrel rendered
**hue 42–43°, sat 0.38, r/g 1.12, b/g 0.70** beside the plateau fence's **hue 27–28°, sat 0.28,
r/g 1.17, b/g 0.84** — a yellow tan next to red-brown (the fence uses the same `weathered_planks`
map under structures' tint and shade floor). A first step, (1.85, 1.42, 0.92) → (1.86, 1.36, 1.01),
moved the rendered hue only 43° → 40°: the sun-lit map and the tone curve pass about 0.3 of a
linear ratio change. So **(2.02, 1.30, 1.12)** — r/g 1.30 → 1.55 and b/g 0.65 → 0.86 in linear —
which renders the crate at **hue 33°, r/g 1.20, b/g 0.75**, luminance 0.294 → 0.287 (held). The
remaining 5° and the saturation gap (0.38 vs 0.28) are the fence's canopy shade and 12 m of haze
against a sun-lit crate at 3 m, not the material.

Every wooden prop shares the constant: crates, the barrel and buckets, the ladder, the platforms
and railing, the marker, the light string's stakes.

## Six fixed views (`six-views-after.jpg`)

| view | take-0122 (sealed, SwiftShader) | before SSIM | after SSIM | Δ | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2179 | 0.2175 | 0.2175 | 0 | 566 → 566 | 8.60 → 8.60 | 1 |
| B_house | 0.2013 | 0.2018 | 0.2018 | 0 | 522 → 522 | 7.75 → 7.75 | 9 |
| C_lookback | 0.2326 | 0.2367 | 0.2367 | 0 | 407 → 407 | 6.94 → 6.94 | 0 |
| D_log | 0.2778 | 0.2775 | 0.2775 | 0 | 396 → 396 | 7.99 → 7.99 | 0 |
| E_ground | 0.2111 | 0.2142 | 0.2142 | 0 | 522 → 522 | 7.75 → 7.75 | 9 |
| F_canopy | 0.2563 | 0.2560 | 0.2560 | 0 | 507 → 507 | 7.92 → 7.92 | 2 |

The props' wood is small and 9–26 m off in every fixed frame: no pixel moves by more than 8 levels
except a handful on the Saria crate (B/E). pHash unchanged; 0 console errors both sides. (The
sealed take's column is fable-cursor's renderer; my VM's before sits within ±0.004 of it per view.)

## The change at its poses

| pose | read | sheet |
| --- | --- | --- |
| `px-plateau` (3 m) | crate, barrel lid and staves, bucket: red-brown where they were yellow tan; the fence behind now the same family | `px-plateau.jpg`, `-crop.jpg` |
| `px-sign` | the Saria crate and bucket by the walk | `px-sign.jpg` |
| `px-ladder` | the rope ladder's rungs against the upper house's bark | `px-ladder.jpg`, `-crop.jpg` |

**Verdict: IMPROVED** at player height; invisible in the six frames by construction.

## Tests

`node src/world/props/geometry.test.mjs`, `npm run typecheck && npm run build` green (the tint is a
constant the builders multiply in; no geometry or PRNG change).
