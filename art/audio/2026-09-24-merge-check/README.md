# Lane 5 — does any of this fit together? A merge check across the whole queue

Branch `agent/squad5-cadence` (the stack's tip); the verified merge itself is pushed as
`agent/squad5-merge-check`, which is **not a feature branch** and has no PR.

The integration head has not moved since 11:20. Eight lane-5 PRs are waiting on it, and three world
branches — `exp-ruins`, `exp-north`, `exp-south2` — all edit `src/audio/`. Before anyone merges
anything, the useful question is whether they fit. They do, and here is the arithmetic so nobody has
to rediscover it.

## The queue

The lane's stack, newest first, all off the head at `3c6cc553`:

| PR | branch | what |
| --- | --- | --- |
| #58 | `squad5-cadence` | the offline walk stepped at 55 % of the game's rate; job 8 re-checked live |
| #56 | `squad5-birds` | the birds answer the wind's lulls |
| #55 | `squad5-standing` | the crowns were inert and backwards; `renderOffline({ at })`; the exp-ruins waterfall audit |
| #53 | `squad5-jump` | a jump left the ground in silence |
| #52 | `squad5-music-file` | a dropped-in track set the mix by its own mastering level |
| #49 | `squad5-music-shape` | the score's pad never stopped; phrase dynamics |
| #46 | `squad5-live-capture` | the audio ran on rAF, so the game was silent for six seconds |
| #50 | `squad5-surface-gaps` | the plateau lookout sounded like lawn (independent of the stack) |

#58 → #56 → #55 → #53 → #52 → #49 → #46 is one line, so merging #58 lands seven. #50 is off the head
on its own and merges cleanly either before or after.

Between them they touch nine files and nothing outside `src/audio/` except `public/audio/README.md`
(the page the owner reads before dropping a music file in):

```
public/audio/README.md   src/audio/{ambience,footsteps,index,music}.ts   + four .test.mjs
```

## Against the world branches

| merged into the stack | result |
| --- | --- |
| `agent/fable-cursor-exp-north` | **clean — no conflicts** |
| `agent/fable-cursor-exp-south2` | **clean — no conflicts** |
| `agent/fable-cursor-exp-ruins` | two conflicts, both in `src/audio/index.ts` |

Both ruins conflicts are "both sides added a field", and this is the whole resolution:

**1. the live `ambience.update` call** — mine captures `lastGust` so `stats().gust` can report it,
theirs passes `falls`. Keep both:

```ts
lastGust = o.wind?.uniforms.uGust.value ?? 0.4;
ambience.update(t, { gust: lastGust, …, gorge: s.gorge, falls, windDir: … });
```

**2. the `stats()` fallbacks** — mine adds `pushOffs` to the footsteps default, theirs adds `fall` to
the ambience one. Keep both:

```ts
...(live?.footsteps.stats() ?? { steps: 0, gaitSteps: 0, surfaces: {}, lastSurface: null, landings: 0, pushOffs: 0 }),
...(live?.ambience.stats()  ?? { birds: 0, flutters: 0, glints: 0, fairiesNear: 0, windLean: 0, fall: 0 }),
```

## Verified, not asserted

`agent/squad5-merge-check` **is** that merge, resolved. On it:

| | |
| --- | ---: |
| `npm run typecheck` | clean |
| `npm run build` | green |
| every `*.test.mjs` in the repo | **171 / 171** |
| `playtest.mjs --only walk` | **11 / 11 routes reached, 0 stuck** |
| the south probes | **41 / 41** |
| page errors | **0** |

## And a real interaction check, not just a textual one

Two files merging without a marker does not mean two features agree. The two worth checking:

- the ruins' **`outcropCover`** sits next to this stack's canopy work in `surfaceAt`. It turns out to
  be the rock skin **underfoot** — "whole over the platform, its ragged outline diving under the
  turf" — not a roof, so it neither feeds nor fights `skyOpening` or `CANOPY_SHARE`. (I expected the
  opposite and was going to recommend wiring it to `enclosure`; reading it first saved a wrong
  recommendation.)
- the ruins' **waterfall layer** is its own source with its own distance gate, independent of the
  bed's roll. Audited separately in `../2026-09-24-standing/` — it passes, no change wanted.

## What this does not tell you

Only that the pieces fit and the checks pass. It is not a review of the world branches, and the
merge branch is a reference rather than something to merge: take the two hunks above when the time
comes.
