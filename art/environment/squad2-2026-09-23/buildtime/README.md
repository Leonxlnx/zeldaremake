# Where the load goes: the trees are a fifth of it, vegetation a quarter, the canopy roof 0.1 %

The owner's standing priority sentence opens with "make all the trees load in ASAP so it doesn't look
bad". Every load discussion since has been about pools, warm-up passes and resident bytes; nobody had
published **which systems the build time is actually spent in**. `__ZR__.perf().buildMs` has it per system,
and one boot is all it takes.

Head `2b15f687`, `quality=high`, this VM (Chrome + SwiftShader, 4 cores, no GPU), no warm-up pass:

| system | build | share |
| --- | --- | --- |
| **vegetation** | **10,739 ms** | **24.7 %** |
| trees | 8,311 ms | 19.1 % |
| structures | 8,171 ms | 18.8 % |
| rocks | 6,790 ms | 15.6 % |
| terrain | 3,769 ms | 8.7 % |
| hardscape | 3,222 ms | 7.4 % |
| character | 999 ms | 2.3 % |
| atmosphere | 983 ms | 2.3 % |
| props | 360 ms | 0.8 % |
| lighting | 104 ms | 0.2 % |
| **canopy (the roof)** | **56 ms** | **0.1 %** |
| **total** | **43,503 ms** | |

## Reading it

* **The trees are a fifth of the build, not the bulk.** The sentence that started this lane's work reads as
  if the trees are what keeps the player waiting; they are 19.1 %, behind vegetation's 24.7 % and level with
  structures' 18.8 %. Any serious attack on load time has to take three systems, not one.
* **The canopy roof is free**: 56 ms, a tenth of a percent, for the layer that closes the sky over the whole
  village (`../roofsky/`).
* The four heaviest builders — vegetation, trees, structures, rocks — are **78 %** of the build between them.

## The caveat that matters

These are this VM's numbers: four cores, software rasterisation, 43.5 s total, where the owner's machine
boots the same world in a fraction of that. Absolute milliseconds do not transfer. The **shares** should,
because every one of these systems is CPU-bound geometry building rather than draw submission — but if a
load decision is going to be made on this, it wants one run on the owner's hardware to confirm the ranking
before anyone optimises against it.

Lane 2's own share is measured and small: the roof at 0.1 %, and the trees' 19.1 % already carrying the
pool work, the batch and the LOD rungs that this lane and fable-4 have spent the week on.

## Re-run after Link shipped at 2048² (head `1232f1d3`, 07:15 on the 27th)

`bb1b5bab` swapped the runtime model for `link-runtime-2k.glb` — 31.5 MB against 54.4 — because a 4096²
map that fails to decode on a memory-limited device leaves glTF's white base colour. The build cost of
that, measured the same way:

| system | before | after | delta |
| --- | --- | --- | --- |
| **character** | 999 ms | **592 ms** | **−407 ms (−41 %)** |
| vegetation | 10,739 | 11,307 | +568 |
| terrain | 3,769 | 4,110 | +341 |
| structures | 8,171 | 8,007 | −164 |
| rocks | 6,790 | 6,702 | −88 |
| trees | 8,311 | 8,408 | +97 |
| **total** | **43,503 ms** | **43,938 ms** | +436 |

**The character's saving is real** — 41 % off its build, from a model 23 MB smaller, and the only system any
commit in this window touched.

**The total is not readable from one sample.** Vegetation, terrain, structures and rocks moved by −164 to
+568 ms with nothing committed against them, so this VM's per-system noise is **±0.5 s** between runs and
the +436 ms total sits inside it. That bounds every single-sample build comparison, including the table
above this section: it can rank systems (the shares are stable and large) but it cannot resolve a change
smaller than about half a second, and a load claim at that scale needs three runs a side.

## Correction: three samples on one head, and the first run is the outlier

The section above bounded this VM's noise at **±0.5 s per system** from two runs. That was pessimistic and
partly wrong, because those two runs were on **different heads** and the first of them was the first boot
after a fresh build. Three runs on one head (`1232f1d3`), nothing else changed:

| system | run 1 | run 2 | run 3 | mean | spread |
| --- | --- | --- | --- | --- | --- |
| vegetation | 10,666 | 10,579 | 10,605 | 10,617 | **87** |
| trees | 8,585 | 8,232 | 8,288 | 8,368 | 353 |
| structures | 7,882 | 7,783 | 7,799 | 7,821 | 99 |
| rocks | 6,727 | 6,545 | 6,500 | 6,591 | 227 |
| terrain | 4,117 | 4,412 | 4,115 | 4,215 | 297 |
| hardscape | 3,234 | 3,099 | 3,110 | 3,148 | 135 |
| atmosphere | 1,030 | 747 | 969 | 916 | 283 |
| character | 570 | 562 | 571 | **567** | **9** |
| **total** | **43,323** | **42,391** | **42,456** | **42,723** | **932 (2.2 %)** |

Three things follow:

* **the real same-head spread is 1–4 % per system**, not half a second flat — 87 ms on vegetation, 99 on
  structures, 353 on trees (the noisiest of the big ones);
* **run 1 is the outlier every time** (43.3 s against 42.4 s twice): it is the first boot after a fresh
  `npm run build`, so the assets are cold. Discard it, or take the median;
* the **character at 567 ± 9 ms** puts the 2K model's saving (999 → 567 ms) an order of magnitude outside
  the noise, so that one stands as measured.

So the rule for a load claim on this VM is: three runs, drop the first, and treat anything under ~150 ms
per system or ~1 s on the total as unresolvable. The share ranking — vegetation, trees, structures, rocks
at 78 % between them — is stable across all three runs and remains the usable part.
