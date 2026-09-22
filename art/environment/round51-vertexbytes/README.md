# Round 51 — the trees' vertex storage compacted (fable-4; the memory ask, step two — fable-2's rocks recipe)

The writers emit every attribute as Float32 (72 bytes a vertex: position, normal, colour, uv, `aWind`
×3, `aRoot` ×4). Once per geometry, after every build-time read of its arrays, `compactAttributes`
(`trees/index.ts`) stores normalized what the range allows: **normals Int8, colours Uint8 (when the
geometry's colours stay in 0–1), `aWind` Uint16** (stiffness / phase / flutter, 0–1; 16 bits keep the
0–0.035 flutter's resolution). Kept Float32, on purpose: positions; uv (bark tiles to ×27 — Float16
would jitter texels); `aRoot` (world anchors the fold matches to 5 cm, and the `1000 + group +
0.5·shade` / cushion encodings the shaders decode). Range-checked: 18 near-canopy parts with colours
to 2.35 and 76 geometries with an `aWind` component over 1 keep their floats. Pooled parts compact
in `wrap()` before their byte count.

## Bytes (the page at `ready`, 491 tree geometries)

| attribute | head | this branch |
|---|---|---|
| normal | 48.2 MB Float32 | 12.0 MB Int8 |
| colour | 48.2 MB Float32 | 11.7 MB Uint8 (+1.4 MB Float32 kept) |
| aWind | 48.2 MB Float32 | 18.8 MB Uint16 (+10.6 MB Float32 kept) |
| aRoot / position / uv / index | 64.2 / 48.2 / 32.1 / 29.1 MB | unchanged |
| **trees total** | **318.1 MB** | **228.1 MB (−28 %)** |

Near-canopy pool 223.9 → 158.1 MB, near-base pool 33.1 → 26.0 MB (the pools' own accounting).

## Process memory at `ready` (head = be3d03ff with the array release merged)

| | head | this branch |
|---|---|---|
| no warm-up: JS heap / renderer RSS / GPU | 1 384 / 1 973 / 1 680 MB | 1 295 / 1 879 / 1 667 MB |
| `?warmup=1` (the game's path): heap / renderer / GPU | 1 069 / 1 670 / 2 252 MB | 1 069 / 1 674 / 2 191 MB |

With the warm-up the CPU copies are already gone, so the gain is the GPU copy (−61 MB); without it
both copies shrink (−94 MB renderer).

## Six views vs the head (same build path, same settle)

SSIM Δ: A 0.0000, B 0.0000, C 0.0000, D −0.0001, E 0.0000, F 0.0000. Pixels over 8 levels: A 0.00 %,
B 0.00 %, C 0.02 %, D 0.00 %, E 0.00 %, F 0.01 %; over 40 levels: 7 pixels in the six frames (F), max
53. Draws and triangles identical (A 444 / 8.68 M). tsc green, `lodPool.test.mjs` 10/10.
