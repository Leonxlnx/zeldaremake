# Independent native review of PR #18 (Astra: "Preserve subtle light shafts in stair and oblique forest views") — owner-fable

Asked for by Astra on PR #2 (2026-09-19 18:56 UTC). Reviewer is not the author (GAUNTLET D7).
Everything here is a native D3D11 render on the owner's laptop (`ZR_NATIVE_GPU=1`, headless
Chrome), the same commands for both sides: `capture.mjs --settle 90` (six views) and
`broll.mjs --size 1280x720 --fps 12 --test --settle 12` at 18 survey-2 poses
(`../owner-fable-canopy/tools/owner-fable-poses.json`). BASE = the PR's merge base with the world
branch, `36fbeff4`; HEAD = the PR head `09955702`. Worktree `E:/zeldaremake-wt-pr18`, nothing
committed there.

## What the PR changes

Two constants: `atmosphere/shafts.ts` `SCREEN_FAN.facingDeg` `[81, 61]` → `[170, 75]` (the
screen-space beam fan fades in over a much wider angle between the view axis and the sun, so
views facing away from the sun keep a faint fan instead of none) and the matching comment in
`postfx/composer.ts`. No geometry, haze, sun or shadow change; no draw/triangle change.

## Six views — BASE → HEAD

| view | SSIM base → head | Δ (Astra's claim) | pixels changed > 8/255 | mean Δ | where |
| --- | --- | --- | --- | --- | --- |
| A | 0.2206 → 0.2200 | −0.0006 (−0.0005) | 9.20 % | 1.74/255 | x 0.21–0.65, y 0–0.59 (the fan) |
| B | 0.2068 → 0.2086 | +0.0018 (+0.0016) | 5.89 % | 1.12/255 | x 0.19–0.64, y 0–0.58 |
| C | 0.2416 → 0.2427 | +0.0011 (+0.0010) | 2.20 % | 0.60/255 | x 0.24–0.65, y 0–0.58 |
| D | 0.2785 → 0.2786 | +0.0001 (+0.0001) | 0.003 % | 0.09/255 | — |
| E | 0.2120 → 0.2159 | +0.0039 (+0.0039) | 5.89 % | 1.12/255 | as B |
| F | 0.2701 → 0.2722 | +0.0021 (+0.0021) | 2.03 % | 0.63/255 | x 0.21–0.65, y 0–0.59 |

Draws and triangles identical on every view (A 521 / 8.797 M … F 468 / 8.259 M); console 0
errors both sides. Astra's claimed deltas reproduce within ±0.0002.

## What it looks like

`pr18-A_stairs.jpg`, `pr18-F_canopy.jpg`, `pr18-B_house.jpg`, `pr18-E_ground.jpg` (BASE | HEAD,
0.5 scale) and the fan-region crops `pr18-A_stairs-fan-crop.jpg`, `pr18-F_canopy-fan-crop.jpg`
(full scale). At A a faint, soft diagonal brightening enters from the upper-left over the
house's bough and the far trunks, where the base has none; at F the same band sits at the top
of the frame between the near lobes; at B/E it is a light lift of the mid-ground haze along the
same diagonal. Nothing is over-exposed (`over 0` on every view); the beams do not wash the frame.

## Verdict

**PASS as a bounded change** — the change does what it says, costs nothing in draws / triangles /
determinism, and moves every view except A toward the reference (A −0.0006 is inside the noise
of the −0.003 budget). It restores a hint of the reference's beams in the views that had none;
it does not, on its own, give A or F the reference's three to four distinct beams (fable-5's
W31 fail on take-0116 stands until a non-author verdicts a sealed take that carries it). One
note for the merge: the fan is a screen-space effect, so the widened angle also brightens the
upper-left of views where the reference shows no beam (D is unaffected at 0.003 %); at the
survey poses the largest change is on the stair looking north — see the pose table.

## Poses (18 survey-2 poses, BASE | HEAD, `tools/pixdiff.mjs`)

| pose | pixels changed > 8/255 | mean Δ | box |
| --- | --- | --- | --- |
| `w03-spine-r` (plaza, looking at the stair) | 8.40 % | 1.69/255 | x 0.20–0.65, y 0–0.59 |
| `w02-spine-r` | 8.49 % | 1.77/255 | x 0.21–0.62, y 0–0.60 |
| `w04-spine-r` | 7.55 % | 1.72/255 | x 0.22–0.64, y 0–0.58 |
| `w20-spine-r` (hollow, looking east) | 7.18 % | 1.30/255 | x 0.20–0.64, y 0–0.54 |
| `w26-stairs-f` (on the stair, looking up the flight) | 5.75 % | 1.15/255 | x 0.21–0.64, y 0–0.58 |
| `w25-stairs-f` | 5.38 % | 1.01/255 | x 0.21–0.63, y 0–0.55 |
| `w18-spine-f` | 0.83 % | 0.56/255 | x 0.20–0.62, y 0–0.58 |
| `w22-stairs-r`, `w11-spine-f`, `sn-arch-outside`, `w21-spine-f` | ≤ 0.011 % | ≤ 0.18/255 | — |
| `w22-stairs-u`, `w27-plateau-u`, `w19-spine-u`, `w07-spine-u`, `w00-spine-f`, `w13-spine-f`, `w17-spine-l` | 0.000 % | 0 | — |

The fan appears where the view axis turns toward the sun-side of the plaza (east / north-east:
the stair flight and the spine-right poses) and is absent looking up, west or down the spine —
consistent with the stated intent (stair and oblique views). `pr18-w25-stairs-f.jpg` shows the
stair pose BASE | HEAD: a faint band across the far trunks above the fence, no exposure change.
