# Pre-merge check of `agent/fable-3-south-props` @ `c872ec8a` (head `3c6cc553` merged in) — fable-3, 2026-09-24 15:45

For fable-cursor, so the tip can merge without spending a capture slot on it: one build of the tip, counts at every fixed
view and owner pose (`pose-counts.mjs`, settle 6), then the six-view capture with the scene checks on (`capture.mjs`,
settle 12, high). Tests 141 / 141, typecheck and build green.

## Draws / triangles (budget ≤ 700 / ≤ 9.0 M)

| pose | draws | triangles | head 11:20 full check (`f04d9529`) |
| --- | --- | --- | --- |
| A_stairs | 641 | 8.88 M | 639 / 8.87 M |
| B_house | 630 | 8.29 M | 628 / 8.29 M |
| C_lookback | 565 | 7.91 M | 571 / 7.93 M |
| D_log | 563 | 8.63 M | 562 / 8.63 M |
| E_ground | 630 | 8.29 M | 628 / 8.29 M |
| F_canopy | 601 | 8.01 M | 599 / 8.01 M |
| owner-0650-north | 534 | 8.83 M | 533 / 8.83 M |
| rec-r024-plaza-fork | 641 | 8.04 M | — |
| owner-0650-west | 492 | 6.75 M | — |
| south far-bank look-back (my approximation) | 842 | 10.09 M | 818 / 9.30 M at their exact pose; 853 / 10.18 M at mine on the same head — the 30 m cull's −11 |

The +1–2 draws at A / B / E / F against the 11:20 check are the belts' own mapped materials (one per girl or boy in
frame) and the contact-AO decal mesh (one per visible locality); C is −6 (the south props cull from C at 30 m, hidden
behind the trunk there anyway). Everything stays under budget except the far-bank look-back, which was over before this
branch and is exp-south2's.

## Scene checks (`capture.mjs` with checks, the tip)

`checks-c872ec8a.json`: 4 terrain probes (W04) all within tolerance (worst gap 0.27 of 0.45 m); placements — litter
373 / 374 (min 0.97), tree bases 159 / 160 (min 0.99), grass 400 / 400, boulders 33 / 33, structure bases 60 / 60;
no warnings; the determinism frame of A recorded (`A_stairs.det.png` equals `A_stairs.png`).

## Six views vs the reference, the tip against the pure head (`3c6cc553`), both captured here at high, settle 12

| view | head `3c6cc553` | tip `c872ec8a` | Δ | draws head → tip |
| --- | --- | --- | --- | --- |
