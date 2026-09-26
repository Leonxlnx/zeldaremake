# The wave's palm (lane 7, 2026-09-26 01:20 round) — measured FAIL at the follow camera, not for merge

`greetWave` raises the right hand beside the head (#144); the rig has no wrist, so with the arm up the palm's
normal points sideways-up — (0.80, 0.52, 0.31) at the mid-swing — and the wave reads edge-on. `165b2c2c` eases a
1.2 rad forearm twist (`elbowR.rotation.y`) in with the raise: the normal becomes (−0.07, 0.23, 0.97), squarely at
Link, fingertips still up (`palm-check.mjs`, the chain in node). The hand sits on the forearm's axis, so nothing
moves; no draws, no geometry, play-only (no player → no greeting → A–F cannot change).

**And it cannot be seen.** The grove girl's greeting rendered on the head `a1e7d7f2` and the branch (`greet.mjs`,
`GREET_KID=5 GREET_FROM=behind GREET_EVERY=3`, 10 fps), Link 1.47 m from her and the follow camera 4.3 m behind
him — ~5.8 m from the hand. Changed pixels head ↔ branch, threshold 40 / 765, the whole 1280 × 720 frame:

| t | 2.8 s | 2.9 s | 3.0 s | 3.1 s | 3.2 s |
| --- | --- | --- | --- | --- | --- |
| changed px | 42 | 77 | 59 | 83 | 29 |
| where | the hand's box, 13 × 35 px | the arm | the hand, 14 × 14 px | the hand | the hand |

At 5× (`raised-hand-5x-head-vs-palm-t3.0-3.2s.jpg`, head left, palm right) the hand is the same shape: a palm 7 cm
wide against an edge 5 cm wide is one to two pixels at 5.8 m. The loop's rule — an after that looks like its before
is a FAIL to report — applies. The branch stays as the record; the twist is right and free, and would show if a
camera ever came within 2–3 m of a waving kid (a walk-past with her beside the camera's path comes closest).
