# fable-5 — take-0135 read (sealed 2026-09-23 22:09 UTC): it is `main`'s frozen checkpoint, not the head

`data/takes/take-0135/stats.json`: git `67b801db` on **`main`** ("Publish cinematic and frozen checkpoint receipts",
committed 21:30 UTC, `dirty: true`), captured 22:09, 37 min. `main` left the working branch at `6c13f70c` (the take-0129
tick, 09-22) and carries 59 commits of its own (the cinematic / checkpoint chain); `cursor/kokiri-world-phase1-f65e` is
467 commits past that point. **So this take does not see today's head** — none of the squad day (the mid canopy, the
verges, the warm air, the earth flights, the cast, the perf give-backs) is in its frames, and the frames carry the HUD
(hearts, the item box, the map) that the head's captures do not.

| | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| take-0134 (`702086ba`, 09-23 01:27) | 0.2181 | 0.1984 | 0.2130 | 0.2655 | 0.2189 | 0.2253 |
| **take-0135 (`main` `67b801db`)** | 0.2281 | 0.1964 | 0.2038 | 0.2672 | 0.2189 | 0.2265 |
| my expected row for the head at 21:00 (lane-10 §15, with the cast) | ≈ 0.182 | ≈ 0.175 | ≈ 0.189 | ≈ 0.243 | ≈ 0.194 | ≈ 0.208 |

The row sits within ±0.01 of take-0134 — the pre-squad world, as the sheet shows (`fable-5-lane10/take0135-vs-head-A.jpg`: the take's A
is bright grey mist, stone slabs with logs, no violets, no mid canopy; the head's A is the populated, warmer, darker
squad world with earth treads). Score 40 / 50 (phase 35 / 42, weight 66 / 90), **regression W02** (the hero flight) on
`main`'s build; no improvements.

## Verdicts

None filed on this take. The visual items I track (W02 the flight's weight, W10 / W14 / W26, C01) were re-read today on
head builds (lane-10 report §10–§19); filing those reads against a take of a different branch would put head evidence
under `main`'s frames. The head has had no sealed take since take-0134 (`47773f13`, 09-23 00:23) — twenty hours of the
squad's work are untaken. When a take of the head seals, the expected row above is the pre-read (the −0.02 … −0.03 at
A / D / E against take-0134 is the owner-directed squad batch, lane-10 §7a / §15), and W02's flight read (§14: dark 60.8 →
37.4 %, luma 0.242 → 0.300 at the owner's pose, between the demo's two flights) goes on it as **pass on kind and weight,
the hue noted** — not before.
