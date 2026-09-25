# fable-5 — six-view pairs for the waiting queue (`fable-2-cliff-scale` `fbb4a3ee`, `fable-4-wbmed` `2896a08a`) against the head `2225a111` — 2026-09-25 01:29–02:00 UTC

Both in fable-cursor's "waiting, not merged" list; both rendered with the same deterministic capture as every pair this squad
day (`broll.mjs --test --settle 8 --quality high --size 1280x720`, the gauntlet's SSIM). The head's frames are `2225a111`'s
(`0fc66816` differs from it in `src/audio/` only).

| view | `cliff-scale` SSIM / pixels changed | `wbmed` SSIM / pixels changed | vs reference (both) |
| --- | --- | --- | --- |
| A_stairs | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.1732 → 0.1732 |
| B_house | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.1689 → 0.1689 |
| C_lookback | 1.0000 / 0.00 % | 1.0000 / **0.02 %** | 0.1793 → 0.1793 |
| D_log | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.2334 → 0.2334 |
| E_ground | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.1899 → 0.1899 |
| F_canopy | 1.0000 / 0.00 % | 1.0000 / 0.00 % | 0.2029 → 0.2029 |

- **`fable-2-cliff-scale`** (the ledge builder's `scale`, a sandstone palette for the trailer's desert, `?rockLedgePreview` samples
  never in a capture): **pixel-identical at every view** — "byte-identical at scale 1 (the north terrace)" holds from outside.
  Merge-safe by the budget; what it builds is for places that do not exist yet.
- **`fable-4-wbmed`** (the white-bark medium crown back to one lamina in four at 1.8×, 28–44 m): **pixel-identical at A, B, D, E, F;
  C moves 0.02 %** — a few pixels of one white-bark crown at range at C's right. The claimed A +16 k / C +55 k triangles are counts,
  not pixels, and stay far under the cap. Merge-safe by the budget. Not checked here: the crowns' read at a walking pose 28–44 m
  from a white-bark tree, which is the owner's "trees only get detailed up close" the commit answers — fable-4's own before /
  after is the evidence for that.

## `fable-3-lane7-r2` `cb9d38ae` (04:10 — the cast's variety: looks 1–3 take honey-blonde, chestnut and near-black hair under three greens; look 0 and the boy unchanged) — 04:31–04:53 UTC

Against the head `7468bb38`: **six views pixel-identical (1.0000 / 0.00 % at all six)** — look 0 is the fixed frames' girl and she is
untouched, as the commit says. At play distance the variety reads (`fable-5-lane10/lane7-r2-kids-variety-ba.jpg`): the grove girl at the
yard's washing line (Link at (2.6, −98.5) facing her, 3 m) goes from the cast's one maroon bob to **honey-blonde**; the ledge girl
(Link at (−0.6, −75.5), 3 m) to **chestnut** — 0.17 % and 0.01 % of those frames' pixels, all of it hair. The bank girl's pose I did
not frame (she stands on the south-west bank's face; my two poses looked past her). Merge-safe by the budget; the three looks are
what the reference's crowd has and the head's cast lacked.

`squad2-brownwood` `34e5cf63` (03:56) names the wood materials and corrects lane 2's own note — ten lines of names, no render change
to check.

## `fable-4-canopybatch` `b0a05eb5` (09:39 — the batch trims after evictions) and `fable-3-greet` `7016ca6d` (the wanderer greets Link) — 10:27–10:48 UTC

- **`canopybatch` `b0a05eb5`**, against the head `8e20e128`: six views pixel-identical (1.0000 / 0.00 % at all six); the trees row at the
  far bank 200 / 3.63 M and the green 214 / 3.71 M — the batch's draw cut intact and its parts all present after the trim (the
  first-build lesson of 06:53 checked). Merge-safe.
- **`greet` `7016ca6d`** (kokiri-a stops where she is within 1.7 m of Link, faces him, walks on from the same spot after he is
  2.6 m off for 0.6 s; `npc.ts` only): the five plaza routes that pass her — `plaza-loop`, `south-approach`, `saria-front-arc`,
  `plaza-to-upper-house`, `house-west-to-saria-door` — are **frame-identical to the head** (waypoints, frame counts, camera pops
  and turn acceleration all equal, no page errors): her stop never blocks Link's path or moves the camera. The fixed frames cannot
  run her; fable-3's own before / after (t 1.4–4.2 s) is the behaviour's evidence. Merge-safe by the walk.

## `fable-3-veranda-boy` `f65e258e` (12:05 — the grove's second person: a boy at the stilt house's veranda rail, on the published deck, watching the girl at the line) — 12:29–12:40 UTC

- **The walk:** `north-grove` on the branch is frame-identical to the head's (28 / 28, 1,248 frames, the one 0.36 m step at the trunk
  house's door, turn acceleration p95 909 °/s²); probes 64 / 64; no page errors. He stands on the ring the route walks and blocks
  neither Link nor the camera.
- **The cost:** +21 … +25 draws where he is in frame — the yard's look-back 674 → **695** (five under the draw cap; the character
  row 85 → 106), the stilt house from the yard 513 → 536, the gangway's head 391 → 416; the veranda, the rope walk and the
  veranda facing out unchanged (he is behind the camera or the hut there). Triangles +0.01 M.
- **The read** (`fable-5-lane10/veranda-boy-poses.jpg`): from the gangway's head and from the yard he is a small figure at the far
  rail beside the pods — a second person the hamlet lacked; fable-3's own frames carry the closer look. Merge-safe by the walk
  and the draws; the six views cannot see the grove.

## `fable-3-stand-greet` `e1d7831e` (12:52 — the ledge, bank and grove girls turn to face Link within 1.7 m and follow him round) — 13:28–13:45 UTC

The four routes that pass them — `north-grove` (the grove girl at the line), `north-clearing-ledge` (the ledge girl), `plaza-to-south-
bank-top` and `south-approach` (the bank girl) — are **frame-identical to the head's** (waypoints, frame counts, camera pops, turn
acceleration; `northProbes` 64 / 64; no page errors). A turning kid blocks nothing and moves no camera. Merge-safe by the walk;
the fixed frames cannot run her.

## Lane 2's `squad2-lookbacks` (12:56, the same `isolate` method): two poses the bill lacked

The plateau looking back south over the village (17.0, 7.1, −15): **745 draws / 11.15 M**; the ledge top looking back south
(1.42, 7.3, −75.5): 673 / **11.23 M** — vegetation +1.29 M over hero A (3.75 M in the frame), and within the trees' 3.15 M the
three giants' wood at **1.51 M**. Two more rows for `fable-5-lane10-lookback-costs.md`'s table, and the same two payers.
