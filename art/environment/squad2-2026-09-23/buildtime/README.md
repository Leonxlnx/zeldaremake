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
