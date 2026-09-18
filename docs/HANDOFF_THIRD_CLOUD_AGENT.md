# Handoff for an additional cloud agent

Snapshot verified 18 September 2026. Written by Astra (`astra-local`, Codex desktop).
This is onboarding context, not a claim that the work is finished or that another agent has started.

## Mission and owner direction

Build a convincing, detailed, real-time Three.js forest game inspired by the supplied Ocarina of Time remake footage. The owner wants to demonstrate what AI can build: stronger lighting, sky visibility, natural trees/grass, detailed structures, and a believable animated character. Judge the actual playable camera as well as fixed reference frames.

The owner's latest direction is to continue this environment and Link as a local/demo project; earlier plans for an original map/character and open-source release were superseded. Do not infer permission to publish a release or to relicense assets. Preserve provenance. The package's MIT field does not establish redistribution rights for every model, texture, or reference. New environment assets should follow AGENTS.md: original or documented CC0.

The owner explicitly authorized character work alongside the world, despite the older Phase-1-only wording. Work directly when asked to work; do not create scheduled automations. The desktop owner wants to keep using their laptop, so Astra uses hidden/headless tools rather than taking over mouse/keyboard.

## Who owns what

| Agent | Role | Coordination |
| --- | --- | --- |
| `fable-cursor` | Existing Cursor cloud Fable; world integration, environment geometry and its delegated lanes | PR #2 and `.agents/fable-cursor.md` |
| `astra-local` | Astra on the owner's Windows laptop; Blender character, skin weights, animation, exports; previously coordinated lighting | PR #10, `.agents/astra-local.md` on its branch, PR #2 comments |
| You | Additional cloud agent; choose a distinct ID, e.g. `fable-cloud-2` | Create your own log from `.agents/TEMPLATE.md`; coordinate a bounded lane first |

Do not impersonate the existing Fable, replace their log, or assume their active directories are free. Ask existing Fable for the current survey-2 findings and a non-overlapping task. A useful first contribution is reviewing the published player-height evidence and identifying the largest remaining visual defect; implementation ownership should then be agreed explicitly. Leave character/rig/animation work with Astra unless reassigned by the owner.

## Verified branch and playable state

Repository: https://github.com/Leonxlnx/zeldaremake

| Purpose | Branch / revision at verification |
| --- | --- |
| World integration | `cursor/kokiri-world-phase1-f65e`, `bed040f3` |
| Latest sealed world content | Round 45, take-0115, source `2e00415d` |
| Round-45 evidence commit | `21220842`, `art/environment/round45-review/` |
| Published monitor snapshot | `0e0c931f13fa4114ce118923bd4ef6da12a7d4ef` |
| Last actual playable publication | Monitor commit `e1ad5815`, take-0115 |
| Astra character delivery | `agent/astra-local-link-grounding`, `2734128e`, PR #10 |

Latest published game at this snapshot:
https://raw.githack.com/Leonxlnx/zeldaremake/0e0c931f/play/?dev=0&hud=0

Monitor at the same immutable snapshot:
https://raw.githack.com/Leonxlnx/zeldaremake/0e0c931f/index.html

These links are pinned, not automatically latest forever. Fetch and inspect `origin/monitor` and its `play/` history for a new publication. A heartbeat commit does not mean a new playable build.

Fable's tick163, dated 18 September 20:12 UTC, reports survey-2 finishing: an inspection of183 poses on take-0115. This is a published progress statement, not independent access to their live process. No later survey result was verified for this handoff.

## What Fable changed since Astra's last modelling session

Fable progressed from round39 through round45. Their logs and committed evidence report:

- More tree-base, bark, root and canopy detail; revised leaf-cluster edges and crown placement.
- Near-detail geometry pools and on-demand construction to reduce resident memory (round42). Preserve these optimizations when adding detail.
- Moss colonies on structures, detailed lantern husks/stems, hollow-log bark/interior and broken edges.
- Ground, vegetation, fences and boulder refinements; subsequent fixes driven by player-height surveys.
- Round45: higher lantern clearance over paths/verges, canopy clearance at the plateau walk, distant trees moved away from the path/log footprint, detailed rubble, less saturated fences, readable signpost/hut soffits.

Round45's reported fixed-view A cost is522 draw calls /8.58M submitted triangles. This is not a measured laptop FPS figure. The published take score is23/50; Phase1 is not complete. Respect the actual gauntlet criteria rather than declaring reference quality from these numbers.

Read the evidence READMEs for rounds40–45 on the world branch. Older before/after screenshots must not be presented as proof of later changes.

## Verdant Forest is a required foundation, already accepted by Fable

Owner's source repository: https://github.com/Leonxlnx/verdant-forest

Fable explicitly confirmed retained reuse of tree primitives, white-bark birch, shaped leaf laminae, vein/translucency shading and understory forms. They did not port the entire application. The original near-leaf micro-normal fade was replaced with an equivalent; extra species and original volumetrics were not directly ported.

Confirmation: https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5702697973

Astra reviewed round39 images and found visible gains in coverage/root relief, but broad flat leaves, bright ferns hiding roots and repeated grass fans/dark spikes remained. Fable tick117 explicitly accepted these on the round40 integration checklist. Re-evaluate against round45 rather than assuming these old findings are all still unchanged.

Feedback: https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5703324476

Latest Astra check-in: https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5704340140

## Character: default versus experiments

Verified world source `src/world/character/glbLink.ts` declares the retained asset SHA256:

`2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4`

This character includes the retained garment-weight repairs, blink work and reviewed run motion. The arm motion uses a retargeted CC0 Quaternius animation; that does not change the separate model provenance. Read `public/models/link/SOURCE.md` before exporting or replacing anything.

Astra's latest original leather forearm guards are a separate candidate, **not the default character**:

`e2e20a28e7348670b0c2b637d029398fb9dd0b01538d1216f2c5f0c75d0df478`

Four skinned additions, six baked512-square PBR images. Original binary, meshes, rig, clips and existing images are preserved by the merger;19 joint bind matrices verified. Candidate completed18 studio views,8 guard closeups and300 actual-game walk/run/idle frames without runtime errors or reach clamps. Isolated native elbow tests are not proof of all animated collisions. Angular guard rims and lacing separation still need work; do not promote automatically. Hair experiments also remain separate because their visual gain was limited.

Details, scripts, screenshots and manifests on PR10's branch:
`art/characters/link/progress/2026-09-16-owner-video-review/README.md`

Five requested before/after comparisons, including clear baseline labels and Fable evidence:
`art/progress/2026-09-16-five-comparisons/README.md`

Online: https://github.com/Leonxlnx/zeldaremake/blob/agent/astra-local-link-grounding/art/progress/2026-09-16-five-comparisons/README.md

The reproducible standalone guard addon and scripts are committed. Large native `.blend` studies and some full merged experimental GLBs are laptop-local; a cloud clone does not contain every native source. Request a specific missing artifact rather than claiming access to the laptop.

## Safe cloud onboarding

1. Fetch all branches and read `AGENTS.md`, `PROJECT_STATE.md`, every `.agents/` file, `GAUNTLET.md`, `docs/PROMPT_PHASE1.md`, `reference/ANALYSIS.md`, and current open PRs. Historical log headings can be stale: also read dated recent entries and PR comments.
2. Start a new branch from the latest world integration branch, not old `main` and not Astra's older character integration checkout. Use your own agent branch; never force-push someone else's.
3. Announce your distinct ID and proposed scope in `.agents/INBOX.md` and PR2. Check `gauntlet/claims.json` and coordinate with Fable before touching their live lanes. Claims expire; an expired timestamp alone is not evidence that a cloud lane was abandoned.
4. Use Node20+, `npm ci`, then `npm run typecheck` and `npm run build`. Read existing capture helpers before writing replacements. The documented cloud setup uses Chrome/SwiftShader; detect the executable available in your environment.
5. Capture a baseline from the exact source you will edit. Compare identical camera, time, quality and renderer settings; include a normal player-height and upward view where relevant.
6. Make a bounded visual change, run appropriate checks and the required gauntlet loop. Save real renderer images and provenance, commit/push small coherent changes, and open a draft PR targeting the world branch. Coordinate integration with Fable.

Useful starting commands in a clean cloud clone:

```bash
git fetch --all --prune
gh pr list --state open
git log -8 --oneline origin/cursor/kokiri-world-phase1-f65e
git switch -c agent/fable-cloud-2-review origin/cursor/kokiri-world-phase1-f65e
npm ci
npm run typecheck
npm run build
```

Change that branch name if your ID or agreed task differs. Do not run checkout/reset operations over someone else's uncommitted work.

## Contracts to preserve

- Independent world systems communicate through `WorldContext`; don't import another system's internals.
- `src/world/layout.ts` owns composition; terrain height/normal/mask come from the shared heightfield. Log justified layout changes.
- Shared deterministic PRNG and wind; no `Math.random` in world code.
- Keep rendering, audit counts, LOD, memory and disposal correct. More geometry alone is not acceptance.
- Reference frames, supplied videos and generated concept boards are comparison references, never runtime scenery.
- Never weaken hash-locked rubric thresholds, hand-edit the append-only ledger or self-approve visual criteria. `gauntlet:verify-exit` with CI attestation governs phase completion.
- Coordinate edits to character, camera, capture API, global lighting and shared world entry points. Do not wholesale cherry-pick Astra's branch into Fable's newer world to retrieve a document or image.

## Desktop context, for coordination only

Astra's original `E:/zeldaremake` checkout contains substantial uncommitted/native experimental work. Delivery checkout: `E:/zeldaremake-integrated-review`; lighting preview checkout: `E:/zeldaremake-daylight`. These Windows paths are not available from your cloud VM. Do not assume their processes are running after a restart.

Blender work uses MCP/headless automation on the laptop. Do not copy local tool configuration or credentials into the repository. No additional agent has been launched by writing this handoff.

## First requested response from the new agent

After reading and syncing, report your distinct ID, exact world revision, what Fable says is currently occupied, the bounded task you propose to own, and the baseline screenshots you will use. Start from the latest survey findings instead of restarting the project or duplicating Astra's character experiments.
