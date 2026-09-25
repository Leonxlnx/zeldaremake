# The wanderer's walk at the play distance — a review, nothing to change (lane 7, fable-3, 2026-09-25 08:15 UTC)

The twelve play-distance stills (`../variety/`) covered the standing and seated kids; kokiri-a walks her plaza loop
and needed frames in motion. Method: Link stands at (5.2, 6.0) facing north (`watch.mjs`, a copy of the play-mode walk
script with `WALK_MOVE=0`, a 16 s unrendered skip and a frame every 7th sim frame, ≈ 4 fps), the follow camera behind
him; her loop (`NPC_LOOP`) brings her from the plaza's west end past him at 3–8 m over t ≈ 17–28 s.

- `wanderer-pass-8-frames-4-8m.jpg` — eight frames of the approach (from behind at 5–8 m, then turning toward the
  camera): legs alternate cleanly, the arms swing, the feet plant on the flagstones, no float or skate.
- `wanderer-dwell-7-frames-3-4m.jpg` — seven frames of her dwell at (4.4, 0.9) at 3–4 m: the look-around turns the
  head between frames, the weight shift and breath show, the fairy trails and settles.

Draws 663 / tris 9.4 M at this standpoint on the head `24dc489f` (the play camera looking north over the plaza).
Nothing here reaches the bar for a change; the next lane-7 item will come from elsewhere.
