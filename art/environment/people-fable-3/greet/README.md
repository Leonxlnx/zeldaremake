# The wanderer greets Link — lane 7 (fable-3), 2026-09-25 08:30–10:00 UTC

**Branch** `agent/fable-3-greet` on the head `cd9400b2` (PR #109); `src/world/character/npc.ts` only — the `GREET_*`
constants, the `greet` state, the wander branch of `drive()`, `schedTime()` and `walkerFaceAt()`.

## The defect

kokiri-a walks her plaza loop as a pure schedule of `t`. When Link walked up to her she turned her head (the notice)
and walked on — `before-full-frames.jpg`: he stops 1.44 m from her; she finishes her dwell, turns for her next leg and
passes his shoulder at 1.2 m. A Kokiri stops and faces you.

## The behaviour

- Within **1.7 m** she stops where she is, turns to face him and stands; her body follows him if he moves round her,
  the head's notice does the rest.
- Once he has been beyond **2.6 m for 0.6 s** (hysteresis, so a player idling at the edge does not make her stutter)
  she turns back and walks on from exactly where she stopped.
- The loop's clock is held for the pause (`paused` / `frozen`), so her schedule stays a function of (t − paused): no
  pop on either side. The stop-and-turn and the turn-back each blend over 0.5 s, the walk weight fading with the
  blend and the schedule's own turn-shuffle under the feet. Her fairy's lag taps are mapped through the held clock
  (`schedTime`) and take her greeting yaw, so it stays over her head instead of walking on without her.
- Capture never drives her (`if (view) return false` precedes the wander branch) and passes no player: the six fixed
  frames cannot run any of this. The play routes only meet her if they pass within arm's reach of her loop.

## Evidence (`greet.mjs`, the real follow camera, 1280 × 720, a frame every 6th sim frame)

After an 18 s skip she is dwelling at (2.2, 2.3). Link is placed 3.6 m in front of her and 1.0 m off her axis, heading
parallel to her facing (so she stays beside him in frame), walks (W) until 1.5 m, stands 3 s, backs (S) 2.2 s, stands.

- `before-after-link-walks-up-t1.4-4.2s.jpg` — t = 1.4 / 2.2 / 3.0 / 4.2 s, before (top) and after (bottom). Before:
  she turns away and walks past; gone from the crop by 3.0 s. After: she turns 44° to him within 0.4 s (yaw −1.00 →
  −0.24) and stands facing him through the whole stand; when he backs and slides round her, her body tracks him
  (−0.27 → −0.76).
- `before-full-frames.jpg`, `after-full-frames.jpg` — the same eight frames uncropped.
- The release (`GREET_RELEASE=walkpast`: after the stand Link walks on past her 2.2 s, then the camera turns back to
  her 20° off the Link–girl line while he stands) — `after-pass-by-and-release-full-frames.jpg`,
  `after-release-turn-back-t6.6-8.6s.jpg`:

| t (s) | Link | her | yaw |
| --- | --- | --- | --- |
| 1.4 – 4.2 | stands 1.44 m off | stands facing him | −0.24 |
| 4.4 – 6.4 | walks past, 1.04 → 2.42 m | her body follows him round | −0.21 → 0.23 → 0.84 → 1.31 → 1.71 |
| 6.6 | 2.62 m — beyond 2.6 | still facing him; the 0.6 s release timer runs | 1.75 |
| 7.2 – 7.8 | stands | released: turns back toward her next leg | 1.75 → 0.51 → 0.70 → 0.75 |
| 8.2 – 10.0 | stands | walks on from (2.2, 2.3) toward (3.6, 3.8) | 0.75 |

  The turn-back reads 1.75 → 0.51 → 0.70 → 0.75: the schedule resumed inside her dwell's last 0.3 s and its own turn
  segment (−1.0 → 0.75) ran under the 0.5 s blend, so she settles from 14° past her heading. Not perceptible at 0.4 s
  frame spacing (the crops); noted so nobody hunts for it later.

Draws at the stand: 600–660 (the plaza in play mode; unchanged by a pose). Typecheck, build, 199 / 199 tests on the branch; 206 / 206 with the head `eb3687cb` merged in.
