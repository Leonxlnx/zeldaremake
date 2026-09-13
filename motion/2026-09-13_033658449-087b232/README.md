# Bank hedge LOD sweep

Source: 087b232df3be643ed868a83c03f94c5c306c55be; status: complete; simulation time: 12.5 s.

Actual full-scene camera samples, original PNG bytes. Fixed simulation/light controls; ordinary setPose forces LOD rebucketing. Not an interactive hysteresis timing test, benchmark or gauntlet score.

Expected target LODs are inferred from the actual source-generated roots and existing horizontal-distance selector. The public API reports aggregate audits, not per-instance observed LODs. setPose forces onCameraMove, bypassing the interactive 0.6 m update gate.

Unmodified full-frame PNG originals and sweep.json are the evidence. No derived animation replaces them. Inspect both threshold crossings and their return frames. Source terrain clearance does not prove visibility through the rest of the world; inspect target projections and recorded scene depth. A blocked target makes this view inconclusive.

| Frame | Expected bank LODs | Original |
| --- | --- | --- |
| H01-in | 1 / 1 | [PNG](H01-in-attempt0.png) |
| H02-in | 1 / 1 | [PNG](H02-in-attempt0.png) |
| H03-in | 0 / 1 | [PNG](H03-in-attempt0.png) |
| H04-in | 0 / 1 | [PNG](H04-in-attempt0.png) |
| H05-in | 0 / 0 | [PNG](H05-in-attempt0.png) |
| H06-in | 0 / 0 | [PNG](H06-in-attempt0.png) |
| H07-out | 0 / 0 | [PNG](H07-out-attempt0.png) |
| H08-out | 0 / 1 | [PNG](H08-out-attempt0.png) |
| H09-out | 0 / 1 | [PNG](H09-out-attempt0.png) |
| H10-out | 1 / 1 | [PNG](H10-out-attempt0.png) |
| H11-out | 1 / 1 | [PNG](H11-out-attempt0.png) |

Expected LOD 0 is high, 1 is mid. Return-pose byte/depth/audit comparisons are recorded without concealing differences. This supplemental artifact does not change phase-exit evidence or publish a gallery.
