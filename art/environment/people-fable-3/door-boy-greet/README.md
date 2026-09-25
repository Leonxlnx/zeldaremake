# The boy at Saria's door greets too — lane 7 (fable-3), 2026-09-25 15:20 UTC

**Branch** `agent/fable-3-door-boy-greet` on the head `2722c196` (PR #140); `src/world/character/npc.ts` only — the
door boy's declarations (his look keys, rng fork, greet state) and a play-mode branch in `drive()`.

## The gap

Of the six kids who can turn, the boy at Saria's door was the one still posed by `index.ts`'s generic path (the
puppet's `applyPose` idle plus the head notice): walk up to him and only his head moved, and his body idle was the old
one (no weight shift, no look-around).

## The change

In play mode `drive()` takes him like the other four stands: `poseLedgeIdle` (weight shift, breath, his own
look-around — glances at the door behind him, along the path, up the stairs), `standGreet` (turns to face Link within
1.7 m at 2.5 rad/s with the shuffle, follows him round, turns back 0.6 s after he is beyond 2.6 m), the notice and the
nod. His stand yaw is the caller's (toward the spawn, `placeFree`), read on his first play frame; his rng a fork drawn
last, so no other kid's numbers move. **Under capture the branch is skipped** (`if (view) return false` precedes it): the
caller's idle poses him exactly as before, and the fixed frames A / B / E / F that hold him cannot change.

## Evidence (`../greet/greet.mjs`, `GREET_KID=2 GREET_SKIP=4 GREET_RELEASE=teleport`)

Link placed 3.6 m in front of him and 1 m off his axis, walks to 1.45 m, stands 3 s, is placed 4.57 m away.

| t (s) | Link | before (head `67544e00`) | after |
| --- | --- | --- | --- |
| 1.6 | 1.49 m, stops | body toward the spawn, head to Link | turning (yaw −0.91 → −0.75) |
| 2.0 – 4.4 | stands | body toward the spawn | facing him (−0.15), the nod at 2.0 |
| 4.6 (placed 4.57 m off, behind him) | gone | — | follows toward him for the 0.6 s timer (0.85 → 1.30), then turns back to −0.91 by 6.2 |

- `before-after-door-boy-t1.6-3.2s.jpg` — t = 1.6 / 2.0 / 2.4 / 3.2 s, before (top) / after (bottom): a 44° turn
  (Link came from his front-side), so the difference is the torso squaring to Link and the nod at 2.0.
- `after-full-frame-t2.4s.jpg` — the play frame: the door, the lanterns, the boy at the ferns facing Link.

Typecheck, build, 209 / 209 tests. Draws unchanged.
