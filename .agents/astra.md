---
agent: astra
runtime: Codex / ChatGPT Work, resuming the owner's Astra role
github: Leonxlnx
status: active
branch: agent/astra-link-movement
updated: 2026-09-11T02:39:00Z
---

# Astra — resumed character work

## Current task
Owner explicitly resumed Astra/Fable collaboration and requested improved original 3D Link with faithful, simple walking, running and jumping. Claim C01/C02/C03; begin with independent movement simulation, smooth locomotion transitions, jump/landing and camera/input correctness. Later owner reference images remain pending; no 95% similarity claim is possible yet.

## Files / systems being touched
- `src/world/character/`: existing Link geometry and rig, animation, player contract, a separate locomotion controller, integration and focused tests.
- `src/camera/follow.ts`: jump input, focus handling and following actual player height.
- `src/main.ts`: minimal control-hint/input-order integration only if needed.
- `.agents/astra.md`, shared `.agents/INBOX.md`, claim tool output and own review evidence.
- Read-only review of Fable's world source, monitor captures, PRs and logs.

## Completed work
- Cloned all branches and recovered the entire `.agents/` history, AGENTS.md, GAUNTLET.md, PROJECT_STATE.md, open PRs #1–#4 and recent commits.
- Based this branch on Fable's `725e681` (includes `8dcc1e1` tree shadows and `24ab5df` vegetation). Main remains the README-only initial commit.
- Read historical Codex logs on props/vegetation branches; their accepted changes already exist in the foundation. Do not blindly merge those stale branches.
- Fable's newest tick 30 says PAUSED by owner, no sub-agents running. Its next planned capture is take-0033 of `24ab5df`; do not impersonate Fable or mark that capture complete.

## Important decisions
- Current owner instruction authorizes character work over the old Phase-1-only prose; preserve locked rubric and existing fixed-camera capture composition.
- Keep Fable's procedural original model/assets. Physics state is separate from closed-form reference animation. No combat or other elaborate moves.
- Work on this branch, push meaningful commits and keep a draft PR targeting `cursor/kokiri-world-phase1-f65e`; never merge Fable's PR or rewrite another branch.
- Before every major task: fetch, reread Fable's newest log/claims and PR activity, inspect changed files, document overlap.

## Known issues
- Existing controller snaps velocity on/off, gait phase follows global time, blocked input still animates, and jumping is absent.
- Camera/input has no blur cleanup and follows ground instead of actual vertical player position.
- Existing reference captures and visual reviews do not prove faithful motion. New movement tests and real rendered evidence are required.
- Previous Work environment could not create WebGL; checking current browser before promising a fresh capture. CI-attested gauntlet remains the completion gate.

## Coordination notes
Fable retains world/lighting/terrain/vegetation ownership. Please avoid `src/world/character/` and `src/camera/follow.ts` while this claim is active; reply in INBOX on your branch or this PR. A separate read-only reviewer is checking movement risks; it is not Fable and cannot approve Fable's work on their behalf.

## Suggested parallel tasks
- Fable: capture the final trees/vegetation checkpoint; continue world similarity and canopy/lighting work, keeping character/camera files separate.
- Independent cross-review of Link after rendered motion evidence is available.

## Last updated
2026-09-11T02:39:00Z
