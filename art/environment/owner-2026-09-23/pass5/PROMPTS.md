# Copy-paste prompts — owner review 2026-09-23 23:00, two-hour deadline

One block per agent. Paste exactly; nothing needs editing. Every block is self-contained.

Shared facts each block already carries: the repo, the integration branch
`cursor/kokiri-world-phase1-f65e`, the owner's screenshots at
`art/environment/owner-2026-09-23/pass5/`, and the budget ceilings (camera A ≤ 9.0 M triangles and
≤ 700 draws; it sits at ≈ 8.95 M / 695, so anything added has to pay for itself).

**Job 1 (the stair frame hitch) is taken by fable-squad4 — do not hand it out.**

---

## JOB 2 — the stairs' look against the real game

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/stairs-look`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB: the main stone stairway. The owner (23:00): "the stairs, I don't know if they look that
good or not" — and he sent the real game's stairs as his reference:
art/environment/owner-2026-09-23/pass5/owner-2300-reference-stairs.png, plus
reference/frames-dense/demo61/d_001–d_022 (Link climbing them) and review46 r_020–r_028.

Open his reference and our stairs side by side before you change anything. In his shot the flight is
a LONG, NARROW stairway of many shallow stone treads climbing into mist, the stones irregular and
worn, moss and grass creeping in from both edges, a handrail-less earthen verge either side. Compare
tread depth, riser height, flight width, the number of steps, the nosing profile, how the edges meet
the ground, and the wear/moss. Fix what does not match.

FILES: src/world/hardscape/stairs.ts, logNosings.ts, geometry.ts, material.ts, joints.ts. Stair
shapes in src/world/layout.ts are shared — if you must move them, keep it minimal and say so in
your PR.

SEE IT FIRST, THEN PROVE IT: render the same pose before and after with
`node gauntlet/scripts/broll.mjs --dist dist --out /tmp/before --size 960x540 --shots <poses.json>
--test --settle 6` (pose format in art/environment/owner-2026-09-23/shots.json; s2-approach,
s2-climb and s2-side frame the flight). Walkability after any shape change:
`node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play --only walk,climb` — nine routes,
stuck points name what blocks. An "after" that looks like its "before" is not a result.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original textures
credited in public/textures/CREDITS.md; keep `npm run typecheck` and `npm run build` green and the
tests you touch green (`node --test <file>.test.mjs`); no force-push; never merge PRs. Camera A is
capped at 9.0 M triangles / 700 draws and sits at ≈ 8.95 M / 695 — measure with
`node gauntlet/scripts/pose-counts.mjs --dist dist --out /tmp/counts.json`.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"stairs: <what it fixes>" with before/after crops and how you tested. Keep the description current.
If the PR tool refuses, say so and leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 3 — trees only get detailed when you walk up to them, and "a lot of them look fake"

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/tree-lod-pop`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB, in his words (23:00): "the trees show the brown, but they only get detailed when I come up
close to it, I wish you could stop that" and "a lot of the trees just look fake over here, it's a
weird art style direction". This is his second complaint about tree pop — at 20:08 he asked "why
don't the trees immediately spawn instead of needing me to get close", and `39e63437` answered part
of it by flooring every near-base band at 40 / 44 m and defaulting to the large near-LOD tier. He is
still seeing it, so the remaining swap is elsewhere: the bark relief tier, the crown card → real
crown swap, or the pool's admission order.

WHERE TO LOOK: src/world/trees/lodPool.ts (pool caps, admission, pre-fetch), index.ts (the tier and
band rules, the column "swap rule"), bole.ts and bark-texture.ts (the relief tiers), nearCanopy.ts
and distant.ts (crowns and cards), giant.ts. Read `39e63437` first so you do not undo it.

METHOD THAT ACTUALLY FINDS POP: walk the world and watch a tree cross each band.
`node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play --only pacing --routes
upper-house,north-clearing` reports the per-frame JS step, drawn frames and the renderer's program
count along a walk — a program count that grows mid-walk is a shader compile, a visible hitch. Then
render the SAME tree at 45, 35, 25, 15 and 8 m with
`node gauntlet/scripts/broll.mjs --dist dist --out /tmp/ladder --size 960x540 --shots <ladder.json>
--test --settle 6` and put the five frames in a strip: the step where it changes is the pop the
owner sees. Fix that step — either by moving the band out, or by making the two tiers agree in
silhouette and colour so the swap is invisible.

"Looks fake" is the second half: in his reference (reference/frames-dense/review46/r_020–r_028 and
demo61/) the middle-distance trees are ROUND, READABLE CROWNS at every depth with light between
them and brown boles below, not flat cards. Compare ours at 15–40 m against those frames and say in
your PR which of the two problems each change fixes.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original textures
credited in public/textures/CREDITS.md; keep `npm run typecheck` and `npm run build` green and the
tree tests green (`node --test src/world/trees/<file>.test.mjs`); no force-push; never merge PRs.
Camera A is capped at 9.0 M triangles / 700 draws and sits at ≈ 8.95 M / 695 — measure every change
with `node gauntlet/scripts/pose-counts.mjs --dist dist --out /tmp/counts.json`; if you need room,
say so in the PR rather than blowing the cap.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"trees: <what it fixes>" with the distance-ladder strip and how you tested. If the PR tool refuses,
say so and leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 4 — the horizontal seam across the giant trunk, and the milky veil over it

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/trunk-seam`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB. Open art/environment/owner-2026-09-23/pass5/owner-2300-trunk-seam.png. He circled a band
across the giant bole at mid height and said: "the trees, there's a glow that kind of cuts in half,
the top looks a little bit blurry and the bottom looks alright, I don't know if that's from the fog
or not, but it needs to look better."

It is a HARD HORIZONTAL EDGE, not a gradient: below it the bark is saturated brown with visible
relief; above it the trunk is flat, pale and washed under a milky veil, and the same veil sits over
the foliage behind. Two candidates, and you should tell us which it is with a measurement before you
change anything:
  (a) the height fog — src/world/atmosphere/heightfog.ts (HEIGHT_FOG_DEFAULTS, baseHeight, falloff,
      kfHazeColor / heightFog in the injected GLSL). If the fog term is evaluated per VERTEX on a
      bole whose rings are far apart, the fog steps at a ring instead of sweeping; that would give
      exactly this edge. Check the trunk geometry's vertical segment count against where the edge
      falls.
  (b) a bark-relief or material band on the bole — src/world/trees/bole.ts, bark-texture.ts,
      materials.ts, index.ts (near-base bands were floored at 40 / 44 m in `39e63437`).

HOW TO TELL THEM APART IN FIVE MINUTES: render his pose with the height fog off, then with it on.
If the edge survives with fog off it is (b). `node gauntlet/scripts/broll.mjs --dist dist --out
/tmp/x --size 960x540 --shots <pose.json> --test --settle 6`; his pose is roughly the plaza looking
up at the lantern tree — art/environment/owner-2026-09-23/shots.json has neighbours (u-plaza-up,
u-saria-up) and pass4/owner-2008-pose.json is his last one.

Then fix it so the trunk reads as one piece of wood from root to crown, and say in the PR which of
(a) or (b) it was and what the measurement showed. The milky veil over the upper trunk and the
foliage behind it is the same complaint he has made since 09-22 ("substantially less grey washout"):
if it is the fog, bring the upper band's lightness up and its saturation down toward his recording
(reference/frames-dense/review46/r_020–r_028) rather than deleting the mist.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original textures
credited in public/textures/CREDITS.md; keep `npm run typecheck` and `npm run build` green and the
tests you touch green (`node --test <file>.test.mjs`, including
src/world/atmosphere/hazepalette.test.mjs); no force-push; never merge PRs. Camera A is capped at
9.0 M triangles / 700 draws and sits at ≈ 8.95 M / 695 — measure with
`node gauntlet/scripts/pose-counts.mjs`. Say in your PR if a change moves the six hero views A–F a
lot (`node gauntlet/scripts/compare.mjs` or an SSIM read of the same poses).

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"trunk: <what it fixes>" with his pose before/after and the fog-off/fog-on pair that identified it.
If the PR tool refuses, say so and leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 5 — the opening lantern bough is a dead grey slab and its pods stopped glowing

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/lantern-bough`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB. Open art/environment/owner-2026-09-23/pass5/owner-2300-lantern-bough.png — the first thing
he sees when he enters the game. His words: "the main tree branch that sticks out when I first go
into the game — why did those stop glowing? I think they stopped glowing. I don't know if there's
anything wrong with the shaders, but the tree just looks like a dead branch."

He is right, and there are two separate things in that frame:
  1. THE PODS ARE NOT LIT. The pods hanging from the bough read grey/translucent, while the standing
     lamp post at the right of the SAME frame is lit warm orange. So it is not the exposure — it is
     those pods. Check src/world/structures/lantern.ts and podSkin.ts (the emissive gradient atlas
     and which rows the pod's geometry samples), lanternBranch.ts (the three pods' seats and their
     lights), and anything that recently touched the emissive or the atlas encoding — `git log
     --oneline -20 -- src/world/structures src/world/atmosphere` and look for an sRGB/encoding or
     tone-mapping change.
  2. THE BOUGH READS AS A FLAT GREY SLAB with no leaves. In his opening the bough carries a load of
     foliage; ours has almost none at that range. src/world/structures/foliage.ts and
     lanternBranch.ts.

VERIFY IT THE WAY HE SEES IT — in play mode, not a fixed capture:
`node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play --only look --shots` puts Link on the
plaza and saves JPEGs; the opening bough is overhead there. Also `broll.mjs` at
art/environment/owner-2026-09-23/shots.json's u-plaza-up. Before and after, side by side.

NOTE from the npc lane that applies to you: toggling a light's `visible` changes the light count and
recompiles every lit program — a visible hitch. Change INTENSITY, never `visible`, and keep the
light count constant.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original textures
credited in public/textures/CREDITS.md; keep `npm run typecheck` and `npm run build` green and the
tests you touch green (`node --test <file>.test.mjs`, including podSkin.test.mjs); no force-push;
never merge PRs. Camera A is capped at 9.0 M triangles / 700 draws and sits at ≈ 8.95 M / 695.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"lantern bough: <what it fixes>" with the opening view before/after. If the PR tool refuses, say so
and leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 6 — the canopy when he looks up and outward reads as flat cut-out cards

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/canopy-lookup`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB. Open art/environment/owner-2026-09-23/pass5/owner-2300-foliage-lookup.png — he circled the
whole canopy band. His words: "the foliage in the beginning looks great, but when you go outward the
foliage — I don't know what's wrong, you'll see in the screenshots where I look up, something's
wrong with all the foliage, or it just looks strange. I don't know how to describe it."

What is wrong in that shot, concretely: the near foliage (bottom left) is layered and lit, and
everything past it is FLAT DARK BLOBS WITH HARD SILHOUETTE EDGES floating over a pale grey wash —
card quads seen close to edge-on, with no depth between layers and no light coming through. His
recording (reference/frames-dense/review46/r_020–r_028, demo61/d_101–d_116) has round crowns at
several depths with bright gaps of sky and mist BETWEEN them, and the far ones pale and warm rather
than dark and grey.

FILES: src/world/trees/distant.ts (the far ring and its cards), nearCanopy.ts, src/world/canopy/**
if present, and src/world/atmosphere/ for how the veil sits on them. fable-5's read (squad log
10:28) is still open and is the same problem measured: "the 14–58 m crowns keep their local colour
(green s 0.15 / l 0.29 vs his 0.05 / 0.42) — his distant crowns are pale warm silhouettes most of
the way to the mist with light between them; and they roof the path's top band (0.335 → 0.232, his
0.418) where his recording keeps bright canopy gaps over the path." Give the mid crowns more of the
veil with distance and keep the sky over the path open.

PROVE IT AT HIS POSE, LOOKING UP: art/environment/owner-2026-09-23/shots.json has u-plaza-up,
u-saria-up, u-stairs-up and u-open-up. `node gauntlet/scripts/broll.mjs --dist dist --out /tmp/x
--size 960x540 --shots art/environment/owner-2026-09-23/shots.json --test --settle 6`. Before and
after, side by side, plus the reference frame beside them.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original textures
credited in public/textures/CREDITS.md; keep `npm run typecheck` and `npm run build` green and the
tests you touch green (`node --test <file>.test.mjs`); no force-push; never merge PRs. Camera A is
capped at 9.0 M triangles / 700 draws and sits at ≈ 8.95 M / 695 — measure with
`node gauntlet/scripts/pose-counts.mjs`.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"canopy: <what it fixes>" with the look-up poses before/after. If the PR tool refuses, say so and
leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 7 — the Kokiri need to look better

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/kokiri-quality`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB, his words (23:00): "I wish you could make the other characters look a bit better." He has
asked twice before and judged them unchanged once, so this needs to be visible at the distance he
walks past them — 2–6 m, at player height, in play mode.

WHERE THEY ARE: src/world/character/npc.ts, kokiri.ts, and their placement in
src/world/character/index.ts. What already landed today: the girl by the signpost with a lock-lobed
maroon bob, tunic sheen and fold ridges (`65606fe4`, `4b1759f9`), the boy at Saria's door
(`e7a01c7e`), the fairies readable at 5 m (`044fb636`), heads turning to Link within 5 m
(`e43ae92f`). Do not redo those — go after what is still weak at 2–6 m: faces (eyes, brow, mouth as
actual geometry rather than a texture at that range), hands, hair silhouette, the tunic's hem and
belt, leg and arm proportions against Link's, and the idle motion (they should breathe and shift
weight, not hold a pose).

REFERENCE: art/environment/owner-review-2026-09-19/ref-01*.png (the girl with her fairy by the
signpost) and reference/frames-dense/demo61/d_023–d_036 and d_090–d_104 (kids on the path and the
bank).

NOTE THAT WILL BITE YOU: npc.ts must not toggle a light's `visible` — a light-count change
recompiles every lit program and hitches the frame. Use intensity and keep the count constant.

PROVE IT IN PLAY MODE at his distance: `node gauntlet/scripts/playtest.mjs --dist dist --out
/tmp/play --only look --shots` saves JPEGs with Link in the world; the girl stands at camera B's
left. Plus `broll.mjs --character` at a 2–3 m pose of each character, before and after.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original assets only;
keep `npm run typecheck` and `npm run build` green and the tests you touch green
(`node --test <file>.test.mjs`); no force-push; never merge PRs. Camera A is capped at 9.0 M
triangles / 700 draws and sits at ≈ 8.95 M / 695, so watch what extra head geometry costs when the
kids are visible.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"kokiri: <what it fixes>" with 2–3 m before/after of each character. If the PR tool refuses, say so
and leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 8 — the music shakes when he runs

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/music-stable`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB, his words (23:00): "the music kind of still shakes whenever I run with the characters, so
that needs to be fixed too — the music needs to stop shaking." "Still" means he reported it before
and it was not fixed. At 20:08 he said "LOWER THE WHITE NOISE", which was answered in `b99166cd`;
this is a different, ongoing complaint: the MUSIC wobbles in pitch or level while he RUNS.

THE LIKELY CAUSES, in the order I would check them:
  1. Scheduling drift — the music is generated on the WebAudio graph
     (src/audio/music.ts, graph.ts, index.ts). If note starts are scheduled from a JS timer or from
     the render loop's `dt` rather than from `audioContext.currentTime` on a lookahead, every frame
     hitch (and running causes hitches — LOD pools, grass streaming) shifts the beat and it "shakes".
     Schedule ahead on the audio clock; never from requestAnimationFrame.
  2. A modulation tied to the player — `o.detune.value` is set in music.ts (around line 115) and a
     vibrato depth is connected to `detune`. If anything in there reads player speed or position,
     running bends the pitch.
  3. A gain or filter driven by locomotion — check whether footsteps (src/audio/footsteps.ts) or the
     ambience bed duck or sidechain the music per step.

PROVE IT OFFLINE, which is exact and fast: `audio/index.ts renderOffline()` renders the mix to a WAV
without a browser. Render 20 s standing still and 20 s of the run loop, then plot/measure the
music bus's fundamental over time (a pitch track or an FFT peak per 100 ms) — a stable line versus a
wobbling one is your before/after, and it is the evidence the owner can actually be shown. There is
a precedent to copy in art/audio/2026-09-23-owner-2008/.

RULES: no Nintendo assets and no copyrighted melodies — the music is original; keep
`npm run typecheck` and `npm run build` green and the audio tests green (`node --test
src/audio/footsteps.test.mjs` and any you add); no force-push; never merge PRs.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"music: <what it fixes>" with the two offline renders and the pitch/level measurement. If the PR
tool refuses, say so and leave the report in art/environment/<your-branch>/README.md.
```

---

## JOB 9 — more of the video's world, fast

```
You are joining a team of Opus chats finishing a Three.js / Vite / TypeScript remake of Kokiri
Forest (Zelda: Ocarina of Time first-look remake) in https://github.com/Leonxlnx/zeldaremake. The
owner is recording a video in TWO HOURS. Work fast, land something visible, push early.

SETUP: clone, `git checkout cursor/kokiri-world-phase1-f65e`, `git checkout -b agent/world-expand`,
`npm ci`, `npm run typecheck`, `npm run build`. Read AGENTS.md and
art/environment/owner-2026-09-23/pass5/README.md (the owner's words and screenshots, 23:00).

YOUR JOB, his words (23:00): "good job for expanding the back, but I need you to start adding some
more stuff quickly, like that you saw in the other videos." At 20:08 he said "no expansion to the
environment past the stuff" — he wants the world he can walk to to keep going.

Two expansion branches were started and are NOT merged; pick up whichever is further along rather
than starting a third: `agent/fable-cursor-exp-east` (a village lane on the east plateau after the
main stairs: shop, a taller house, a small house, a lookout) and `agent/fable-cursor-exp-south` (the
south exit: a path through the south giants to a rope bridge over a misty ravine and a lit tunnel
mouth). `git fetch --all` then `git log --oneline origin/agent/fable-cursor-exp-east` and
`...exp-south` to see what is there.

WHAT TO BUILD, from his references: reference/frames-dense/demo61/ (the 61 s clip, index in
reference/frames-dense/README.md) and review46/r_020–r_028 — the path splitting off into the woods,
tree-trunk houses with mossy dome roofs, the signpost, fences on the upper ledge, the hollow log
arch. Ground the player can actually walk on is worth more than set dressing he cannot reach.

NON-NEGOTIABLE: every new area must be WALKABLE and must not break the old ones.
`node gauntlet/scripts/playtest.mjs --dist dist --out /tmp/play --only walk,climb` runs nine routes
and names stuck points; add a route for your new ground. Everything sits on
`ctx.terrain.height/normal/mask` (src/world/terrain/heightfield.ts is the only way to know ground
height) and positions belong in src/world/layout.ts.

RULES: deterministic randomness only (src/world/util/prng.ts, no Math.random in world code); no
Nintendo assets, never use reference frames as textures or scenery; CC0 or original textures
credited in public/textures/CREDITS.md; `src/world/index.ts` takes one-line additions only; keep
`npm run typecheck` and `npm run build` green and the tests you touch green; no force-push; never
merge PRs. Camera A is capped at 9.0 M triangles / 700 draws and sits at ≈ 8.95 M / 695 — new
geometry outside the six hero views is cheap, inside them is not; measure with
`node gauntlet/scripts/pose-counts.mjs`.

DELIVER: commit small, push often, open a DRAFT PR into cursor/kokiri-world-phase1-f65e titled
"world: <what it adds>" with walk-route results and screenshots from inside the new ground at player
height. If the PR tool refuses, say so and leave the report in art/environment/<your-branch>/README.md.
```
