# The standing kids greet Link — lane 7 (fable-3), 2026-09-25 12:30–13:30 UTC

**Branch** `agent/fable-3-stand-greet` on the head `a9deddc8` (PR #130); `src/world/character/npc.ts` only —
`GREET_TURN_RATE`, `Greet` / `newGreet` / `standGreet`, two optional shuffle parameters on `poseLedgeIdle`, and the ledge,
bank and grove girls' drive branches.

## The defect

The standing kids only turned their heads to Link (`noticePlayer`), and the neck's turn fades out past 60°: walk up
behind the grove girl at her washing line and she never knows you are there — `before-after-full-frames.jpg`, top row:
her yaw stays −2.64 through the whole approach, her back to him at 1.45 m.

## The behaviour

The wanderer's greeting (#109) generalised to the standing kids, without the clock hold:

- within **1.7 m** she turns her body to face him and holds it — the head's notice then has him straight ahead; while
  he stays, her body follows him round at the turn rate;
- once he has stayed beyond **2.6 m for 0.6 s** she turns back to her stand's yaw;
- each turn blends over the longer of 0.5 s and the turn at **2.5 rad/s** (a 180° turn takes 1.26 s, not 0.5), with
  the schedule's turn-shuffle under the feet; her dwell look-around fades under the greeting.

Wired into the ledge, bank and grove girls. The veranda boy (#122, unmerged when this was cut) takes the same one-liner
once it lands. Under capture the greeter gets no player (`view ? null : player`, and capture passes none), so every
stand's yaw is exactly what it was: the six fixed frames cannot change.

## Evidence (`../greet/greet.mjs`, `GREET_KID=5 GREET_FROM=behind GREET_SKIP=4`)

Link placed 3.6 m behind the grove girl and 1 m off her axis, heading her way; walks (W) to 1.45 m, stands 3 s.

- `before-after-grove-girl-from-behind-t1.4-3.2s.jpg` — t = 1.4 / 2.0 / 2.4 / 3.2 s. Before (top): her back to him in
  every frame. After (bottom): she comes round 137° in ~1 s (yaw −2.64 → −1.15 → −0.14 → −0.26) and stands facing him.
- `before-after-full-frames.jpg` — the same frames uncropped.
- `after-release-turn-back-t5.0-6.6s.jpg` (`GREET_RELEASE=teleport`: after the stand Link is placed 4.57 m behind her,
  facing her) — she faces him, and 0.6 s later turns back to the line over 1.2 s (yaw 0.22 → −0.94 → −2.30 → −2.64):
  face to the camera, side-on, her back to us at the line.

Two release harnesses failed before that one and are worth knowing: backing off (S) and strafing (D) both ran Link into
the yard's furniture at 1.7–2.6 m — the yard is small — so the release was taken with the state machine's own
definition of "he left" (beyond 2.6 m), placed rather than walked. Her body tracking him while he slid about
(yaw 0.10 → 0.36 → −0.20) is in those runs' logs.

Typecheck, build, 206 / 206 tests. Draws unchanged (a pose moves no geometry in or out).
