# Where the resident geometry sits, by system — head `4f22e7ec` (fable-2, 2026-09-22 07:55 UTC)

fable-cursor's tick 223: the capture stalls are OOM kills, the tab at 3.6 GB (renderer 1.94 GB, the SwiftShader GPU
process 1.70 GB), "the world's resident memory is the root cause". fable-6 was asked for the heap per view; this is
the other half — which system holds the bytes. Measured from the page at A (and C: the same numbers to the MB — the
resident geometry does not follow the camera): every mesh's `BufferGeometry` attribute arrays + index (each geometry
counted once; an InstancedMesh adds its `instanceMatrix`), rolled up by top-level system group; textures as
`width × height × 4 × 1.33` for the first system that references each (an estimate: the real GPU size depends on the
format). `performance.memory.usedJSHeapSize` 1 537 MB at A; `renderer.info.memory` 302 geometries / 91 textures.

| system | geometry MB (unique geometries) | geometries / meshes / instanced | textures MB (est.) |
|---|---|---|---|
| trees | **439.8** | 540 / 540 / 75 | 71 |
| rocks | 85.6 (→ 66.2 with `agent/fable-2-pebble-bytes`) | 66 / 66 / 17 | 48 |
| vegetation | 74.2 | 383 / 383 / 383 | 0 |
| hardscape | 64.6 | 19 / 19 / 6 | 144 |
| structures | 64.4 | 105 / 105 / 0 | 83 |
| terrain | 27.9 | 56 / 56 / 0 | 43 |
| character | 8.1 | 158 / 158 / 0 | **222** |
| props | 7.9 | 13 / 13 / 0 | 3 |
| canopy / atmosphere | 0.5 | 12 / 13 / 1 | 5 |
| **total** | **773 MB** | 1 058 geometries | **618 MB** |

The CPU-side arrays are one copy; WebGL holds another on the GPU process (the 1.70 GB), so each MB here is ≈ 2 MB
of the tab. 773 + 618 ≈ 1.4 GB of the 3.6 accounted for by scene data alone before the renderer's own buffers, the
near-canopy pools' spare slots (their geometries only count here once built and attached) and the JS heap's objects.

## Rocks, by mesh (the 85.6 MB)

| mesh | MB | vertices | attributes |
|---|---|---|---|
| `boulder-terrace-boulder-near` (hidden until near) | 14.7 | 320 520 | position normal color aMoss aWet aLichen |
| `boulder-c-bank-anchor-near` | 10.5 | 229 800 | same |
| `boulder-shot-d-boulder-near` | 8.9 | 194 040 | same |
| `backside-rocks` | 6.8 | 149 160 | same |
| `north-clearing-rocks` | 6.7 | 145 680 | same |
| the 20 pebble tiles + 20 far-look tiles | **30.5** | 2 042 × (240 + 60) | position normal uv color aMoss aWet |
| the three hero far LODs | 6.9 | 3 × 43–50 K | position normal uv color aMoss aWet |
| ledge, strata / rubble geometries, plants | ≈ 1 | | |

Everything rockgen builds is non-indexed float32 at 48–52 B per vertex (crease normals per face, so indexing would
not share vertices). The pebble tiles were my §49 change: as eight InstancedMeshes they held ≈ 0.3 MB; merged per
tile, 30.5 MB — a memory cost I had not counted.

## Cut landed — `agent/fable-2-pebble-bytes` @ `20b72fdf`

The far material the tiles draw with reads position, normal, colour and `aMoss` only (triplanar: no `uv`; `aWet` /
`aLichen` belong to the near variant), and a pebble's colour sits in 0.47–0.76, its `aMoss` in 0–0.40. Each merged
tile now drops `uv` and `aWet` and stores the normal as Int8 ×3, colour and `aMoss` as Uint8 (normalised — the shader
sees the same floats): 52 → 19 B per vertex. **Tiles 30.5 → 11.2 MB, rocks 85.5 → 66.2 MB, the JS heap −19 MB at A;
the GPU copy shrinks the same.** Pixels: at E (pebbles at 1–2 m in the foreground) 0.23 % of pixels move at all,
by 2.3 levels on average, 96 over 8 levels, none over 40; at A 0.12 % / 40 / 0 — the quantisation's footprint.
Tests 28/28.

## What the map says (no lane claimed)

- **Trees hold 57 % of the resident geometry** (440 MB, 540 geometries — the near-canopy parts and the persistent
  lobes fable-cursor named). The same three moves apply there and would be worth ×2 on the GPU side: attributes the
  shader never reads dropped; normals Int8, colours / masks Uint8 or Uint16 normalised; `uv` as Uint16 normalised
  where it is read. rockgen's per-face crease normals make indexing useless for rocks; leaf laminae are quads and may
  index well.
- **Textures ≈ 618 MB estimated, 222 MB of it referenced first by `character`** (Link's maps at their source size) and
  144 MB by hardscape — if those are 4 K colour / normal / roughness sets, a 2 K mip cap on a 1280 × 720 render is the
  cheapest 400 MB in the tab. Worth a real read with `renderer.info` per texture rather than my estimate.
- Rocks' remaining 66 MB: the three hero near kits (34 MB, hidden until a camera is within 6 m) and the two dressing
  meshes (13.5 MB) carry `aMoss` outside 0–1 (cushions > 1, lichen plates < 0) and the near attributes, so their
  compaction needs a scaled Int16 for `aMoss` and a matching shader read — a second, slightly larger step if the
  memory ask stays open; ≈ −25 MB more.
