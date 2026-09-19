# Gold mode — how a Fable chat keeps working without being re-prompted

A Cursor Cloud Agent chat ends its turn when the task it was given is done. That is why the
`fable-2/3/4/5/6` chats went quiet after their first lane landed: each finished, reported on its
PR, and stopped. To keep working they need (a) a standing loop instead of a single task and (b) a
self-renewing timer that re-delivers the loop every hour — the same mechanism `fable-cursor` runs
on. Paste the block below into EACH chat (`fable-2`, `fable-3`, `fable-4`, `fable-5`, `fable-6`, and
`opus-review` if it is a Cursor chat); it reads its own id from its log.

```
GOLD MODE. You are the agent whose log is `.agents/<your-id>.md` in https://github.com/Leonxlnx/zeldaremake
(you announced yourself there earlier; if you have no log, take the first unclaimed lane in
docs/ONBOARDING_FABLE_CHATS.md and announce). From now on you run a standing loop; the owner does
not want to re-prompt you.

THE LOOP (one iteration = one bounded, verified change):
1. `git fetch --all --prune`. Rebase or branch afresh from `origin/cursor/kokiri-world-phase1-f65e`
   (never commit to it, never force-push). If your previous PR was merged, start a new branch
   `agent/<your-id>-<topic>` and a new draft PR targeting that branch.
2. Read `.agents/INBOX.md` (newest thread first) for anything addressed to you or to "all lanes",
   then `docs/GOLD_MODE.md` §Next items for your id, then the newest of `art/environment/round*-review/README.md`,
   `.agents/reviews/opus-review-*.md`, `reference/ANALYSIS_VIDEO2.md`, and the owner's fix list
   `art/environment/owner-review-2026-09-19/README.md`. Pick the highest-ranked open item in YOUR lane.
3. Do it: before/after at the exact pose where the defect was seen (poses in
   art/environment/survey2/manifest.json, the round READMEs and opus-review's walk manifest), six
   fixed views A–F within −0.003 SSIM of the latest sealed take unless the item is an owner-approved
   look change (the INBOX says so), draws ≤ 700, camera A ≤ 9.0 M triangles, seeded PRNG only,
   `npm run typecheck && npm run build` green, tests green. An after that looks like its before is
   a FAIL you report, not a claim.
4. Commit small, push, keep the PR description current with SHAs + crops + the six-view table, and
   post a short INBOX note "<your-id> → fable-cursor" saying what landed and what you take next.
   fable-cursor merges; do not merge.
5. Go back to 1. Never stop because a lane "feels done" — when your list is empty, take the
   highest-ranked open defect from the newest review that no other agent has claimed in the INBOX,
   or ask fable-cursor in the INBOX for one and keep the loop alive with reviews of other lanes'
   PRs in the meantime (before/after crops at their poses are always useful).

STANDING TIMER: at the start of this session, subscribe a timer for yourself (cron `20 * * * *`,
name `gold-mode-<your-id>`) whose prompt is exactly this block, so the loop re-runs every hour
even after a turn ends. If a timer named `gold-mode-<your-id>` already exists, do not create another.

RULES THAT DO NOT BEND: stay in your lane's files (ask in the INBOX before touching others');
never edit gauntlet/rubric.json or gauntlet/ledger.json by hand; no Nintendo assets, no reference
frames as scenery; CC0/original textures credited; never kill processes you did not start; on a
shared machine serialise heavy captures (fable-cursor's capslot.sh / owner-fable's capslot.mjs).
Deliver, report, repeat.
```

## Next items per id (fable-cursor updates this list; the INBOX overrides it)

### fable-2 — rocks (`src/world/rocks/**`)
1. opus #03: the raised ledge is a flat olive mound — `LAYOUT.rockLedges.north-terrace` is live;
   dress it as ref-04's near-black damp rock-and-root wall (3–3.5 m), ferns only at the foot.
2. opus #10: the shot-D hero boulder is an unreadable dark mass with two black cavities at 2 m.
3. expansion-1's positions (`art/environment/round47-review/README.md`): scree at the ledge flight's
   flanks, a boulder pair on the clearing's west bank, half-buried strata along the terrace face.
4. `pathEdgePebble`: per-candidate draws so path edits stop moving pebbles world-wide.

### fable-3 — props (`src/world/props/**`)
1. The plaza as the demo shows it (`reference/frames-dense/demo61/d_023–d_036`): pots by Saria's
   door and the signpost, a bucket, a crate; keep out of the six frames' foregrounds unless the
   frame shows one.
2. Props for the north clearing: pots and a wooden marker at the stone circle's entrance
   (positions in expansion-1's brief); everything seated on `ctx.terrain.height`.
3. Prop LODs and per-locality merges (≤ 20 draws for the system).

### fable-4 — white-bark trees (`src/world/trees/whitebark.ts`, `bark-texture.ts`)
1. Young white-barks on the clearing's banks at (−7.6, −66.0), (6.2, −71.5), (−6.0, −75.5),
   (7.5, −64.5) — coordinate with trees-31 (far forest) in the INBOX.
2. Crowns at 3–10 m: layered leaf silhouettes with lit rims, not flat cards (fable-5 #6, opus #05).
3. Trunk read at 5–20 m: bark banding that survives the haze (the owner's "detail at longer range").

### fable-5 — reference analysis + D7 reviews (`reference/`, `gauntlet/reviews/`)
1. Re-verdict every visual item on each new sealed take (next: the one after take-0118) — strict,
   with reference|ours crops; U02/U03 on the shipped bag screen.
2. `reference/ANALYSIS_VIDEO2.md` from the owner's 15-minute video when the file reaches your
   chat; until then, extend the three-screenshot analysis with the dense demo frames
   (`reference/frames-dense/demo61/`): per shot, what we have / lack, measured.
3. A player-height walk of each new round (the way opus-review did) with a ranked defect list.

### fable-6 — monitor + perf (`site/**`, `gauntlet/perf/**`, `docs/PERF_*.md`)
1. Native re-measure of `lod-1` when it merges (pool caps, 18 m swaps, warm pass) on the 780M.
2. The monitor's evidence gallery for rounds 47/48 and the player strip for each new take.
3. The `[warmup]` 121 s warm pass: what it renders and a plan to cut it.

### owner-fable — canopy (`src/world/canopy/**`) + decision cards
1. The layered-lobe swap as a bounded PR (Astra and fable-cursor both want it; the owner's
   priority is visible foliage over the −0.003 budget): `NEAR_CANOPY_FLAT_SWAP_M` with a distance,
   transition evaluated in motion, SSIM cost stated.
2. The near shade floors at every distance, same treatment, as a separate PR.
3. The roof over the north clearing (trees-31 dresses the far trunks; hand off by distance).

### astra-local — character + atmosphere
1. Authored clips per character-9's contract (walk heel strike, run flight/plant, stairs, arms,
   jump_start/air/land); PR #21's runtime fix + candidate review with fable-cursor.
2. The Kokiri girl's model per npc-1's rig/clip spec.
3. W31 shafts at A/F (three to four distinct beams), the mist veil at B, sky-gap glow.
