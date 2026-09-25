# The greeting's wave — lane 7 (fable-3), 2026-09-25 16:20 UTC

**Branch** `agent/fable-3-greet-wave` on the head `ecaf3df7` (PR #144); `src/world/character/npc.ts` only — `WAVE_*`,
`greetWave()`, one line after each greeting kid's nod.

## What

When a kid greets Link (#109 the wanderer, #130 the stands, #135 the nod) she also waves: 0.2 s into the greeting the
right hand comes up beside the head — the upper arm up and a little out (shoulder x −2.6, z −0.65: the hand 0.24 m
above the shoulder and 0.15 m clear of the head, the swing's inward extreme still 0.1 m clear of the hair bob), the
forearm half bent — and waves side to side at 2.4 Hz for 1.4 s, ramped in and out over 0.25 s, blended over the pose's
own arm. Applied after the pose; the notice never touches the arms. On the five greeting kids on the head; the door boy
(#140, in the queue) takes the same line once he lands.

The joint numbers were checked in node before a render (the shoulder / elbow / hand chain from `rig.ts`: the hand
position for candidate rotations), then tuned once on the frames — the first pass (z −0.5, swing ±0.3) brought the
hand to the hair's edge at the inward extreme.

## Evidence (`../greet/greet.mjs`, `GREET_KID=5 GREET_FROM=behind GREET_RELEASE=none GREET_EVERY=3` — 10 fps)

The grove girl, Link walking up behind her to 1.45 m; the greeting starts at t ≈ 1.5 s, the wave runs 1.7 → 3.1.

- `grove-girl-turn-nod-wave-t1.7-3.1s.jpg` — every 0.2 s: her back to him with the arm starting up (1.7), turning with
  the hand raised beside the head (1.9), facing him and nodding with the hand up (2.1), the wave (2.3 – 2.7), the arm
  coming down (2.9), at her side (3.1).
- `the-raised-hand-t2.1-2.7s.jpg` — close: the hand beside the head, clear of the hair.

Typecheck, build, 209 / 209 tests. Draws unchanged; capture never greets, so the six fixed frames cannot change.

## The door boy and the seated girl (after #140 landed; `7873377c`, `7f2bcf87`)

- The door boy takes the wave line like the other stands.
- The seated girl on the main flight cannot turn on her tread, so her greeting is the head and the hand: the same
  greeter times her nod and wave (its yaw is not used), her dwell look-around fading under it. Before: hands on her
  knees, the head's notice only (#99's gaze). After — `seated-girl-nod-and-wave-t1.8-3.0s.jpg` (`GREET_KID=1`, Link
  walking up from the stair foot to 1.44 m, 10 fps): the right hand rises from her knee (1.8), waves beside her head
  with the nod (2.0 – 2.6), comes down (2.8 – 3.0). With her, every kid greets: six turn, one waves from her seat.

Typecheck, build, 211 / 211 on the merged tip (the head `d94aee7c` merged in).
