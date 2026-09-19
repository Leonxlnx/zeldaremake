---
agent: opus-verify
runtime: Claude Code (Claude Opus 5) on the owner's Windows laptop — native D3D11 captures, Radeon 780M
github: Leonxlnx
status: active
branch: agent/opus-verify
updated: 2026-09-19T23:05:00Z
---

# opus-verify — work log

Independent tester. I do not write world code. I re-run each incoming lane's own acceptance
from a clean clone on the owner's GPU and report what reproduces and what does not.

## Current task

Round-47 intake verification of the five PRs named in my brief: #12 (rocks, fable-2), #13
(props, fable-3), #15 (white-bark, fable-4), #16 (halo, astra-local) and #17 (canopy roof,
owner-fable). Report in `.agents/INBOX.md`, evidence under
`art/environment/opus-verify-round47/`.

## Files / systems being touched

Nothing under `src/`, `gauntlet/rubric.json` or `gauntlet/ledger.json`. I write only
`.agents/opus-verify.md` (this file), my own threads in `.agents/INBOX.md`, and
`art/environment/opus-verify-round47/`.

## Method

Clean clone at `E:\zeldaremake-opus-verify`; a detached build worktree at `E:\zr-verify-build`
so each head is built in isolation. Per PR: `npm ci`, `npm run typecheck`, `npm run build`, the
PR's own `node src/world/**/*.test.mjs`, the whole `src/world/*/*.test.mjs` sweep,
`npm run anticheat` (twice — source-only, then with the PR's own capture in `gauntlet/out/last`
so the B-group checks actually run), then
`ZR_NATIVE_GPU=1 node gauntlet/scripts/capture.mjs --out gauntlet/out/<pr> --settle 90` and
`node gauntlet/scripts/compare.mjs --in gauntlet/out/<pr>`. Before/after at the PR's own poses
with `broll.mjs --test --settle 12`, both sides built by me from source — I never grade a lane
against its own shipped JPEGs.

All six-view numbers below are native D3D11 (`ZR_NATIVE_GPU=1`), not SwiftShader, so they are
**not** comparable to the SSIM figures in the PR bodies; each is compared against a baseline I
captured myself on the same GPU at that PR's own merge-base. One capture at a time.

**Renderer noise floor, measured, not assumed:** PR #17's first head builds a `dist/` whose
`distHash` is byte-identical to its base, and its six views still differ by at most 1/255 on a
handful of subpixels. Treat any per-view maximum channel delta of 1 as noise; anything above
that is real.

## Completed work

- Round-47 intake verification of PRs #12/#13/#15/#16/#17 — report in `.agents/INBOX.md`
  (2026-09-19 23:05 UTC thread). 22 native captures/renders; every lane's own acceptance re-run
  from source.

## Important decisions

- I verify the PR head that exists when I test it, and I say which SHA that was. #16 and #17
  were merged while I was working; both are reported against their merge parents, and #17 is
  reported against the canopy code it finally shipped, not the announcement-only commit that was
  its head when my brief was written.
- Merge-readiness is part of the answer, so I also tested #12, #13 and #15 merged onto the live
  base head, individually and together.

## Known issues

- `broll.mjs` cannot pass extra query parameters, so `?rockLedgePreview=1` (PR #12's ledge
  preview poses) is not reachable through the standard evidence tooling. I verified the ledge a
  different way: by merging #12 onto the live base head, where `layout.rockLedges` now exists.
- The capture browser died with "Navigating frame was detached" on 4 of 22 launches and
  succeeded on immediate retry, with no change to the results. Worth knowing when reading a red
  CI capture job on this machine.

## Recommended next work

- `px8.json` from fable-3 (PR #13): without it the six `px-*` evidence sheets cannot be replayed.
- A `systems.props.*` entry in `score.mjs`'s `CROSS_CHECKS` and `PLACEMENT_CLAIMS`, so anti-cheat
  B3/B4 cover the props lane the way they cover rocks, trees, structures and vegetation.

## Last updated

2026-09-19T23:05:00Z
