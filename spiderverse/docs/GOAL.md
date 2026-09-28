# Goal (authoritative record)

The saved goal in the agent tooling still describes the earlier ~10-second prototype. The goal
tool only supports status changes, not edits to its text, so **this file is the authoritative
objective**. Updated 2026-09-28 07:40 UTC by the owner.

## Objective

A finished **two-minute (~120 s) narrative film, _Into the Ant-Verse_**: original ant
characters and an original world, with painterly 3D forms, ink accents, selective halftones,
mixed animation cadence and comic-book action inspired by *Spider-Man: Into / Across the
Spider-Verse*. A real story - not a stretched loop, still montage or padded credits.

## Story beats (owner's outline; may be improved if the result stays coherent)

| Time | Beat |
| --- | --- |
| 0-18 s | Hungry colony and waiting young ants establish the promise; the courier spots a precious crumb. |
| 18-42 s | Approach, climb, extract the heavy crumb with personality and physical comedy; a descending mug threatens the route. |
| 42-72 s | Mug impact, debris, chase and a motivated wall-run, with clear geography and crumb continuity. |
| 72-96 s | Water cuts off home; the crumb appears lost; it is solved with an object established earlier. |
| 96-114 s | A connected, escalating rescue delivers the food to the colony. |
| 114-120 s | Warm emotional payoff. |

## Craft requirements

- ~14-20 purposeful shots; expressive acting; varied lenses and camera heights; motivated
  transitions; readable action; contact shadows; believable weight; strong silhouettes; a
  consistent colour script.
- 1920x804 or better, 24 fps, ~120 s, H.264 MP4 + AAC, `+faststart`.
- Original music, ambience and foley with a clear arc, a clean mix and no clipping.
- Everything original: no downloaded models, textures, fonts or sounds.

## Process requirements

- Preserve source, references, useful assets and every previous video in versioned
  checkpoints (git tags `antverse-cpNN-*`, videos under `spiderverse/checkpoints/`).
- Do not touch the unrelated Kokiri Forest project in this repository.
- Maximise useful parallelism with exclusive file ownership; the coordinator integrates and
  resolves continuity.
- Inspect an early look frame and a full timed animatic; render shots in recoverable batches;
  fix weak scenes.
- Review every shot and the full sequence. Verify duration, dimensions, full-file decode, audio
  presence and continuity. **Audio is reviewed by measurement (loudness, peaks, spectrograms,
  onset alignment); no agent in this production can listen, and no report may claim it did.**
- New sub-agents run on Claude Opus 5.5 Max (`claude-opus-5-5-max`).

## Deliverables

Final downloadable MP4, poster frame, exact file locations, and a concise quality and
verification report.
