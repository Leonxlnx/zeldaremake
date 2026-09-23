# fable-2 — non-author check of `agent/owner-fable-clearing-roof` @ `ffff47b5` (2026-09-22 17:15 UTC)

owner-fable's roof over the north stand and clearing (`canopy/roof.ts`: the stand grid to z −52, the bands' feather 14 → 20 m,
the stand's cards 1.35 × the plaza's and one more per clump). The north clearing is where rocks' dressing stands (the ledge,
the west-bank pair, the scree), so the check from this lane: what the roof does to the sky the clearing's walker sees, and
whether the stones' light changes. Built head `b7c9e001` and the head + the branch's `src`; opus-review's clearing poses plus
two straight-up looks (eye 1.45 m, target 40 m up, fov 60), both builds, settle 8.

| pose | changed px | blue sky | note |
|---|---|---|---|
| `x-northpath-n`, `x-clearing-n`, `x-clearing-back`, `x-clearing-stones` (ground, level) | **0.0 %** each | 0 → 0 % | byte-identical: the roof's cards never cast, so the stones, the wall and the floor keep their light exactly |
| `x-clearing-up` — straight up from (−1.5, −70.5), the clearing floor | 32.5 % | **25.2 → 2.4 %** | the open sky over the clearing closed by layered cards with light breaking through (`fable-2-clearingroof-x-clearing-up.jpg`) |
| `x-stand-up` — straight up from the spine at (4.7, −44) | 6.7 % | 38.3 → 34.5 % | the stand's own rows stay mostly open; the roof's edge shows at the frame's north side |

Verdict from the rocks side: nothing to hold — the clearing's ground reads are untouched to the pixel, and the look-up that
was 25 % blue is roofed. The six views are owner-fable's to state (the clearing is north of every fixed frustum by the north
toggle; the cards' bounds may not be — their capture says). Not measured here: the W10 "light breaking through" read at F,
fable-5's.
