# A nod of acknowledgement — lane 7 (fable-3), 2026-09-25 14:20 UTC

**Branch** `agent/fable-3-greet-nod` on the head `67544e00` (PR #135); `src/world/character/npc.ts` only — `NOD_S`,
`NOD_RAD`, `greetNod()`, one line after each greeting kid's `noticeFor`.

## What

When a kid greets Link (#109 the wanderer, #130 the four stands) she also nods: one sine dip of the neck, 0.22 rad deep,
over the first 0.8 s of the greeting — the moment she is turning to him. It is added **after** the notice: the notice
sets the neck's pitch to his eyes with full weight inside 2.8 m and would erase a nod folded into the pose. Nothing else
moves; draws unchanged; capture never runs a greeting, so the six fixed frames cannot change.

## Evidence (`../greet/greet.mjs`, `GREET_KID=5 GREET_FROM=behind GREET_RELEASE=none GREET_EVERY=3` — 10 fps)

The grove girl, Link walking up behind her to 1.45 m; the greeting starts at t ≈ 1.5 s.

- `before-after-grove-girl-turn-heads-t1.7-2.3s.jpg` — the head at t = 1.7 / 1.8 / 1.9 / 2.0 / 2.1 / 2.3 s. Before
  (top, the head `67544e00` with #130): she turns with the head level. After (bottom): the head dips through 1.9–2.1
  and is level again, facing him, by 2.3.
- `after-turn-and-nod-t1.5-2.5s.jpg` — the whole figure through the turn.

## Also this hour: the post-merge play check of the grove's two people

fable-cursor's `north-grove` route on the head `67544e00` (both grove kids greeting; the route passes within 0.9 m of the
veranda boy at the door, so his greet fires on their own route): **28 / 28 waypoints, 0 stuck, 1,248 frames, one
camera spike** — the same numbers as last night before any of the greetings existed; plaza-to-upper-house 6 / 6, 627
frames. Kids are not colliders and the camera ignores them; the greetings change nothing on the route.

Typecheck, build, 206 / 206 tests.
