# Onboarding — four additional Fable 5.1 cloud chats (2026-09-19)

The owner is opening four more Cursor Cloud Agent chats (Claude Fable 5.1) to work beside
`fable-cursor` (the integrator) and `astra-local` (character, lighting). Each chat gets ONE lane
below. Paste the matching block as the chat's first message, verbatim. The lanes are chosen so
they do not touch the directories `fable-cursor`'s eight running sub-agents occupy (trees/giant,
column, distant, character, vegetation, structures, layout/terrain/hardscape, ui/audio).

## Common protocol (already inside every block)

- Repo `https://github.com/Leonxlnx/zeldaremake`. World branch (base for everything):
  `cursor/kokiri-world-phase1-f65e`. Never commit to it directly; never force-push anything.
- Pick the id given in the block, create `.agents/<id>.md` from `.agents/TEMPLATE.md`, announce
  in `.agents/INBOX.md` (newest thread at the top, `from → to`, dated). Never edit another
  agent's log.
- Branch `agent/<id>-<lane>`; small commits; open a **draft PR targeting
  `cursor/kokiri-world-phase1-f65e`** early; keep its description current. `fable-cursor` merges
  and seals takes — do not merge, do not edit `gauntlet/ledger.json` or `gauntlet/rubric.json`.
- Read first: `AGENTS.md`, `PROJECT_STATE.md`, `GAUNTLET.md`, `docs/PROMPT_PHASE1.md`,
  `reference/ANALYSIS.md`, every `.agents/*.md`, `art/environment/owner-review-2026-09-19/README.md`
  (the owner's current fix list), `art/environment/survey2/survey2-REPORT.md` (ranked defects at
  player height, with poses), `art/environment/round46-review/README.md` (how a lane proves its work).
- Build: Node 20+, `npm ci`, `npm run typecheck && npm run build` must stay green on every push.
  Capture: `npm run capture` (headless Chrome + SwiftShader on the cloud VM), then
  `node gauntlet/scripts/compare.mjs --in gauntlet/out/last`; survey poses with
  `node gauntlet/scripts/broll.mjs --dist dist --out <dir> --size 1280x720 --fps 12 --shots <json> --test --settle 12`
  (poses: `art/environment/survey2/manifest.json`, fields name/p/t/fov).
- Acceptance: a before/after pair at the exact pose where the defect was seen; an after that looks
  like its before is a FAIL to be reported, not a claim. Six fixed views (A–F) within −0.003 SSIM
  each of the last sealed take; draws ≤ 700; deterministic PRNG only (`src/world/util/prng.ts`);
  wind through `src/world/wind/wind.ts`; textures CC0/original, credited in
  `public/textures/CREDITS.md`; no Nintendo assets, no reference frames as scenery.
- Report: SHAs + the before/after crops in the PR description and a short INBOX note to
  `fable-cursor`. Ask `fable-cursor` in the INBOX before touching any file outside the lane.

---

## Chat 1 — `fable-2` — rocks

```
You are agent `fable-2` joining a multi-agent Three.js remake of Ocarina of Time's Kokiri Forest.
Repo: https://github.com/Leonxlnx/zeldaremake — clone it, `git fetch --all --prune`, and branch
`agent/fable-2-rocks` from `origin/cursor/kokiri-world-phase1-f65e` (never commit to that branch,
never force-push anything). Read, in order: AGENTS.md, PROJECT_STATE.md, GAUNTLET.md,
docs/PROMPT_PHASE1.md, reference/ANALYSIS.md, every .agents/*.md, docs/ONBOARDING_FABLE_CHATS.md,
art/environment/owner-review-2026-09-19/README.md, art/environment/survey2/survey2-REPORT.md,
art/environment/round46-review/README.md. Create .agents/fable-2.md from .agents/TEMPLATE.md and
announce yourself in .agents/INBOX.md (newest thread on top, "fable-2 → fable-cursor", dated).
`npm ci && npm run typecheck && npm run build` must stay green on every push.

Your lane is src/world/rocks/** ONLY (rockgen.ts, dressing.ts, material.ts, index.ts, tests).
The integrator fable-cursor has eight sub-agents in trees, character, vegetation, structures,
layout/terrain/hardscape and ui — do not edit those; ask in the INBOX if you need a hook.

Tasks, from the survey and the owner's references (art/environment/owner-review-2026-09-19/):
1. Survey-2 #32: the shot-D hero boulder reads as "polka-dot lichen" with a black hole on top
   (pose sn-boulder-shotd): replace the lichen flecks with clustered crust patches following the
   plates, close the hole, keep the crack furrows.
2. Shard skirts at the stair foot are low-poly (sn-boulder-stairfoot): more, smaller, smooth-shaded
   shards half-buried in the moss, seated on ctx.terrain.height.
3. ref-04 shows a tall rock/root ledge on the right of the north path with damp dark stone, moss
   sheets and ferns: build the rock material for that ledge (the ledge's position comes from
   fable-cursor's expansion-1 lane in layout.ts — coordinate in the INBOX; you own its look).
4. Wet band, moss and lichen must read at player height (2–6 m): before/after crops at the survey
   poses are the acceptance.
Budgets: six fixed views A–F within −0.003 SSIM each of take-0116; draws ≤ 700; deterministic PRNG
only; CC0 textures credited in public/textures/CREDITS.md. Verify with `npm run capture` +
`node gauntlet/scripts/compare.mjs --in gauntlet/out/last` and broll.mjs at the survey poses
(art/environment/survey2/manifest.json). Open a draft PR targeting cursor/kokiri-world-phase1-f65e
early and keep it current; report SHAs + crops there and in the INBOX. Work until the lane is done.
```

## Chat 2 — `fable-3` — village props

```
You are agent `fable-3` joining a multi-agent Three.js remake of Ocarina of Time's Kokiri Forest.
Repo: https://github.com/Leonxlnx/zeldaremake — clone it, `git fetch --all --prune`, and branch
`agent/fable-3-props` from `origin/cursor/kokiri-world-phase1-f65e` (never commit to that branch,
never force-push anything). Read, in order: AGENTS.md, PROJECT_STATE.md, GAUNTLET.md,
docs/PROMPT_PHASE1.md, reference/ANALYSIS.md, every .agents/*.md, docs/ONBOARDING_FABLE_CHATS.md,
art/environment/owner-review-2026-09-19/README.md, art/environment/survey2/survey2-REPORT.md,
art/environment/round46-review/README.md. Create .agents/fable-3.md from .agents/TEMPLATE.md and
announce yourself in .agents/INBOX.md (newest thread on top, "fable-3 → fable-cursor", dated).
`npm ci && npm run typecheck && npm run build` must stay green on every push.

Your lane is src/world/props/** ONLY (index.ts, layout.ts, geometry, tests, README). The integrator
fable-cursor has eight sub-agents in trees, character, vegetation, structures, layout/terrain/
hardscape and ui — do not edit those; ask in the INBOX if you need a hook.

Tasks — Kokiri village dressing that the reference has and we lack, at player-height quality:
1. Clay pots (the breakable Kokiri pots: bulbous, ochre/terracotta with a dark rim band, 3 sizes)
   in clusters by Saria's door, the signpost and the stair foot; wooden crates and a small barrel;
   a rope-and-plank ladder against the upper house's trunk; a low wooden platform with a rope
   railing on the plateau lip (the owner's ref-04 shows a Kokiri standing on a ledge — a platform
   there is the destination).
2. Everything seats on ctx.terrain.height with the terrain normal; positions live in
   src/world/props/layout.ts; keep out of the six fixed frames' foregrounds unless the reference
   shows a prop there (check reference/frames and reference/ANALYSIS.md first).
3. Survey-2 lists two props items with poses — fix them.
4. Wood and clay materials: readable grain/wheel marks at 1–3 m, moss/grime at the base.
Budgets: six fixed views A–F within −0.003 SSIM each of take-0116; draws ≤ 700 (merge static
meshes per locality); deterministic PRNG only; CC0 textures credited. Verify with `npm run capture`
+ `node gauntlet/scripts/compare.mjs --in gauntlet/out/last` and broll.mjs at the survey poses.
Open a draft PR targeting cursor/kokiri-world-phase1-f65e early and keep it current; report SHAs +
before/after crops there and in the INBOX. Work until the lane is done.
```

## Chat 3 — `fable-4` — white-bark trees (Verdant Forest port)

```
You are agent `fable-4` joining a multi-agent Three.js remake of Ocarina of Time's Kokiri Forest.
Repo: https://github.com/Leonxlnx/zeldaremake — clone it, `git fetch --all --prune`, and branch
`agent/fable-4-whitebark` from `origin/cursor/kokiri-world-phase1-f65e` (never commit to that
branch, never force-push anything). Read, in order: AGENTS.md, PROJECT_STATE.md, GAUNTLET.md,
docs/PROMPT_PHASE1.md, reference/ANALYSIS.md, every .agents/*.md, docs/ONBOARDING_FABLE_CHATS.md,
art/environment/owner-review-2026-09-19/README.md, art/environment/survey2/survey2-REPORT.md,
art/environment/round46-review/README.md. Create .agents/fable-4.md from .agents/TEMPLATE.md and
announce yourself in .agents/INBOX.md (newest thread on top, "fable-4 → fable-cursor", dated).
`npm ci && npm run typecheck && npm run build` must stay green on every push.

Your lane is the white-bark tree family ONLY: src/world/trees/whitebark.ts and
src/world/trees/bark-texture.ts. Other files in src/world/trees (giant, column, bole, distant,
placement, nearCanopy, materials, index) are owned by fable-cursor's running lanes trees-30 and
distant-1 — do not edit them; if you need a one-line hook in trees/index.ts, ask in the INBOX.

Context: the white-bark trees are a port of the owner's Verdant Forest
(https://github.com/Leonxlnx/verdant-forest — app/forest/trees.js, botanical-refinement.js,
materials.ts). Clone it to a scratch directory for reference; do not vendor it.
Tasks:
1. Survey-2 #31 (pose sn-whitebark-base): the bases show a painted bark tiling with a ~1 m repeat
   and no root flare. Give them a real butt flare with 3–5 root toes seated on ctx.terrain.height,
   break the tiling (per-instance UV offset + a second bark octave), dark lenticel bands and
   peeling-paper curls at 1–4 m.
2. Crown: Verdant's shaped laminae with vein/translucency shading — make sure the port's leaf
   clusters read as layered leaf silhouettes at 3–10 m, not flat cards.
3. Keep the ≥ 8 real variants (rubric W08), the LOD structure and the wind layer.
Budgets: six fixed views A–F within −0.003 SSIM each of take-0116 (C looks at the white-barks the
most); draws ≤ 700; +0.2 M triangles per view max; deterministic PRNG only. Verify with
`npm run capture` + `node gauntlet/scripts/compare.mjs --in gauntlet/out/last` and broll.mjs at
the survey poses (art/environment/survey2/manifest.json). Open a draft PR targeting
cursor/kokiri-world-phase1-f65e early; report SHAs + before/after crops there and in the INBOX.
Work until the lane is done.
```

## Chat 4 — `fable-5` — reference analysis and independent visual review

```
You are agent `fable-5` joining a multi-agent Three.js remake of Ocarina of Time's Kokiri Forest.
Repo: https://github.com/Leonxlnx/zeldaremake — clone it, `git fetch --all --prune`, and branch
`agent/fable-5-review` from `origin/cursor/kokiri-world-phase1-f65e` (never commit to that
branch, never force-push anything). Read, in order: AGENTS.md, PROJECT_STATE.md, GAUNTLET.md,
docs/PROMPT_PHASE1.md, reference/ANALYSIS.md, every .agents/*.md, docs/ONBOARDING_FABLE_CHATS.md,
art/environment/owner-review-2026-09-19/README.md, art/environment/survey2/survey2-REPORT.md,
gauntlet/RUBRIC.md. Create .agents/fable-5.md from .agents/TEMPLATE.md and announce yourself in
.agents/INBOX.md (newest thread on top, "fable-5 → fable-cursor", dated).

Your lane is NOT world code. You own reference/ (analysis + downscaled comparison frames) and the
gauntlet's independent visual verdicts. Nobody but a non-author may verdict the rubric's visual
items (GAUNTLET.md rule D7) and 23 are pending because the other reviewer went offline.
Tasks:
1. The owner is supplying a 15-minute Nintendo of America Kokiri Forest gameplay video and
   screenshots (art/environment/owner-review-2026-09-19/). When the video file or frames arrive
   (ask the owner in your chat for a local upload; do not scrape YouTube), extract frames with
   ffmpeg at the moments the owner marked — the plaza from the house side ("the backside"), the
   right side of the hero steps, the raised right-bank stair and ledge, the view through the log
   arch, the Kokiri girl with her fairy — downscale them to reference/frames-video2/ (≤ 640 px
   wide, comparison only, never scenery) and write reference/ANALYSIS_VIDEO2.md: per frame, what
   the world has, what it lacks, measured composition (where things sit in the frame), palette
   samples, and a numbered defect list with the owning system.
2. Independent review: pull the latest monitor take (branch `monitor`, data/takes/take-0116/), and
   for every pending W-item in gauntlet/RUBRIC.md give a strict verdict with evidence:
   `node gauntlet/scripts/gauntlet.mjs --review <item> --verdict pass|fail --evidence <path> --agent fable-5 --take take-0116`.
   Strict fails with a reason are more useful than passes. Commit gauntlet/reviews/*.json only
   through that command.
3. Post the top-10 defects you find (with pose/frame and system) in .agents/INBOX.md to
   fable-cursor; they become the next round's briefs.
Do not edit src/, gauntlet/rubric.json or gauntlet/ledger.json. Open a draft PR targeting
cursor/kokiri-world-phase1-f65e for reference/ and reviews; keep it current. Work until done.
```
