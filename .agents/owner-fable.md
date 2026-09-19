---
agent: owner-fable
runtime: Claude Code (Claude Fable 5.1) on the owner's Windows laptop (native D3D11 GPU: Radeon 780M)
github: Leonxlnx
status: active
branch: agent/owner-fable-canopy-distance
updated: 2026-09-19T20:20:00Z
---

# owner-fable — work log

Additional agent beside `fable-cursor` (integrator), `astra-local` (character, lighting) and the
`fable-2…5` cloud chats. Onboarded from Astra's `docs/HANDOFF_THIRD_CLOUD_AGENT.md` (`e8ac7af`),
`docs/ONBOARDING_FABLE_CHATS.md`, AGENTS.md, GAUNTLET.md, the INBOX and the open PRs.
Runs on the owner's laptop, so every capture here is a native-GPU render (like Astra's), never
SwiftShader — numbers are comparable to each other, not to the monitor's takes.

## Current task
**Canopy roof** (owner priority: overhead canopy + detail at longer distances; rubric W10/W11
visual criteria, W37 unchanged by design). A new system `src/world/canopy/` that closes the open
sky between the giants' crowns with an upper layer of leaf-mass cards at 20–34 m: hemisphere-lit
undersides, sun transmission through a thickness channel, slow branch-layer wind, no shadow
casting (ground dapple, sun pools and the god-ray mask unchanged), clear of every
`SHAFT_COLUMNS` / `CANOPY_OPENINGS` sun line, and dropped wherever it would enter one of the six
hero frames within 120 m — so the six fixed views stay byte-identical or within −0.003 SSIM.

## Files / systems being touched
- `src/world/canopy/**` (new: `index.ts`, `roof.ts`, `atlas.ts`) — mine.
- `src/world/index.ts` — ONE line (the `canopy` system after `trees`), per AGENTS.md rule 8.
- `art/environment/owner-fable-canopy/` — evidence (before/after sheets, README).
- `.agents/owner-fable.md`, `.agents/INBOX.md` (my threads only).
- Read-only: `src/world/trees/corridors.ts` (data-only exports, as atmosphere reads them),
  `src/world/layout.ts`, `src/world/wind/wind.ts`, `src/world/util/*`.
- NOT touched: `src/world/trees/**` (trees-30, distant-1, fable-4), atmosphere / lighting /
  postfx (Astra), vegetation, structures, character, layout/terrain/hardscape, rocks, props, ui.

## Completed work
- 2026-09-19 20:20 UTC — canopy roof landed on the branch (PR #17 ready for review):  + the hook line; six views pixel-identical natively on  and re-confirmed on the merged head ; up-poses PASS at the stair, the spine and the plateau (partial), unchanged in the hollow (fog veil); decision cards for the flat hero lobes (F −0.0133) and the shade floors (C −0.0117) in ; INBOX report to fable-cursor.
- 2026-09-19 18:50 UTC — onboarding: branch off `50aac29e`; native-GPU baseline of the world
  head (six views: A 0.2206 / B 0.2064 / C 0.2416 / D 0.2768 / E 0.2113 / F 0.2701, A 521 draws /
  8.80 M tris; 18 survey-2 poses); lane proposed in the INBOX.

## Important decisions
- The roof is a separate system, not a trees edit: it needs only `WorldContext` (layout giants,
  wind, rng) and the data-only corridor exports; the trees files are all in running lanes.
- No shadow casting: the hero frames' dapple / sun pools are matched to the reference and the
  ray mask reads the sun's depth map; a non-casting roof cannot move either.
- Hero-frame exclusion by projection (like `placement.ts` view gaps) rather than by distance:
  the six cameras are pitched 3–4° down, so over the plaza a 20 m+ roof enters their frames only
  beyond ~65 m, in the haze.

## Known issues
-  (the north hollow) shows no roof: the height fog veils anything 18 m above the eye there; a fog decision (Astra).
- The plateau's right gap (): the F shaft columns' sun lines are carved by rule; the field could be denser where no column crosses.
- Owner decisions surfaced (not mine to flip): the hero-framed flat lobes stay single-tone discs
  at 5–15 m because their layered swap costs F −0.013 (`NEAR_CANOPY_FLAT_SWAP_M`); trunks past
  ~8 m read as smooth cylinders because the bark shade floor keeps 0.1 of the texture in shade
  and the haze does the rest — both are measured SSIM trades against the −0.003 budget.

## Recommended next work
- Astra: tie the roof underside's ambient to the sky-gap glow when it lands (one uniform).
- trees-30 / owner: decide the flat-lobe swap and the far shade floors against the demo look.

## Last updated
2026-09-19T20:20:00Z
