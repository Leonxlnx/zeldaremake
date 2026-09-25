# Round 51 — six viewpoints in one page: pools, heap and frame cost per view (fable-4, for fable-cursor's tick-220 ask)

fable-cursor (05:05 UTC): capture sessions degrade across views — A took 63 min, then B stalled in one
5-frame call; suspects the near-canopy / near-base pools since `lod25` / `slots64` and the persistent
bank lobes. Asked for a multi-view walk with `performance.memory`, pool bytes and build counts.

Method: the head 770689c0 built and served; ONE page (`__ZR__`), `setViewpoint` A → B → C → D → E → F
→ A again, 24 frames rendered per view in 4-frame calls, `__ZR__.audit()` before and after each
view's frames. Headless Chromium / SwiftShader at 1280 × 720, quality high, machine load 0.1.

| view | ms per frame, first 4 → last 4 | JS heap used | canopy pool resident / pinned · MB · built / evicted | base pool resident · MB · built / evicted | shown parts · triangles | CPU update · render-issue ms |
|---|---|---|---|---|---|---|
| A | 7 526 → 14 081 | 1 526 MB | 426 / 77 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 77 · 646 K | 1.7 · 4.2 |
| B | 14 530 → 14 711 | 1 529 MB | 426 / 60 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 60 · 507 K | 1.9 · 7.3 |
| C | 12 545 → 10 377 | 1 530 MB | 426 / 70 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 70 · 549 K | 1.9 · 6.1 |
| D | 13 220 → 16 032 | 1 533 MB | 426 / 57 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 57 · 478 K | 2.0 · 7.7 |
| E | 15 347 → 14 877 | 1 533 MB | 426 / 60 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 60 · 507 K | 3.1 · 4.7 |
| F | 13 534 → 12 115 | 1 534 MB | 426 / 68 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 68 · 576 K | 2.0 · 6.5 |
| A again | 13 135 → 14 029 | 1 534 MB | 426 / 77 · 223.9 · 0 / 0 | 23 · 33.1 · 0 / 0 | 77 · 646 K | 1.8 · 4.5 |

## Reading

- **No accumulation.** The heap grows 8 MB over seven views; both pools are fully resident from load
  (the design since `lod25`: every part within the caps stays) and never build or evict on a
  viewpoint switch — pinned counts just follow the view (57–77 shown parts). Pool residency is a
  fixed 224 + 33 MB, not growth; a player walking the plaza carries the same fixed set.
- **No degradation across views.** Wall time per frame is 12–16 s of SwiftShader rasterisation from
  the second 4-frame call on, view after view, A again included; the CPU side (world update 2–3 ms,
  render issue 4–8 ms) is negligible. A's first four frames were cheaper (7.5 s) — the only
  within-view change, and it goes the wrong way for a warm-up theory of the pools (they were pinned
  before the first frame: shown 77 → 77).
- So a 63-minute A and a stalled B are not the trees' pools in this page. With the full capture
  (determinism pass, motion pass, depth images) under load 7 and several 1.5 GB Chromium heaps, the
  box's memory pressure / swap is the likelier cause; the fresh-page-per-view fix stands either way.

Raw samples: `pools-walk.json`.
