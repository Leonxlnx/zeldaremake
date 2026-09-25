# The seated girl's gaze — lane 7 (fable-3), 2026-09-25 06:40 UTC

**Branch** `agent/fable-3-sitter-gaze` on the head `1a183570`; `src/world/character/npc.ts` only (`SEAT_CHIN_UP`,
`poseSeated`, `noticePlayer`).

## The defect

From the play-distance review (`people-fable-3/variety/`): the girl seated on the main flight's second tread read
hunched with her face hidden — at the follow camera's 1.5 m eye, 5–7 m off, her fringe covered her eyes. The cause is
in the pose, not the hair: `poseSeated` rounds the back 0.30 rad forward over the tipped pelvis (hips −0.16, chest
+0.16 + 0.30) and the neck took only 0.08 of it back, so her resting gaze sat 0.22 rad below level. And `noticePlayer`
— the kids' head turn to Link — computed the pitch to his eyes correctly but applied it as a neck angle relative to
the chest, so the sitter, even when she noticed him beside her, looked 0.3 rad below his face.

## The change

- `SEAT_CHIN_UP = 0.25` replaces the 0.08: the head sits a hair below level while the back stays rounded.
- `noticePlayer` takes the torso's pitch (`hips.rotation.x + chest.rotation.x`) out of the neck angle, so the clamp
  sees the world pitch to his eyes and the neck carries the torso back out. For a standing kid the torso pitch is a
  few hundredths of a radian (the lean and the weight shift), so their notice moves by ≤ 0.07 rad toward his eyes.

## Evidence

`before-after-seated-girl-5.6-7.3-10.3m.jpg` — before (top) / after (bottom), the real follow camera with Link beside
her at 1.2 m and 3.0 m (the notice on, camera 5.6 and 7.3 m) and at 6.0 m (past the 5 m notice range, camera 10.3 m:
the resting gaze). `before-after-stair-foot-play-frame.jpg` — the full play frame at the stair foot. Draws 638 / 643 /
651 before and after (a pose change moves no geometry in or out).

## The fixed frames

Unchanged by construction: `drive()` returns before the seat branch under capture (`if (view) return false`), and
`noticeFor` returns without a player (capture passes none) — the six frames never run either path. A captured on
the branch as a smoke test: see the line below.

| view | branch `43b88869` vs the head capture | draws / tris |
| --- | --- | --- |
| A | byte-identical (`cmp`) to `7468bb38`'s A — so also across #89–#95, which sit between that head and this branch's base | 628 / 8.97 M |
