# The roof over the north stand — owner-fable (GOAL_MODE owner-fable #3; opus-review #01 "no canopy over them")

Owner: "when he walks underneath the thing there's this deep world" (ref-03), and the 2026-09-22
clarity direction: distant and high trees rendered clearly. opus-review's round-47 walk, #01: the
world beyond the arch is "smooth pale-grey truncated cones … **no canopy over them**". fable-4's
round 51 gave the stand its trunks (three depth bands of 26 m poles, `art/environment/round51-northstand/`);
this adds the canopy over them and over the north clearing between them.

Every image is a native D3D11 render on the owner's laptop (`ZR_NATIVE_GPU=1`, headless Chrome,
one capture at a time through `../owner-fable-canopy/tools/capslot.mjs`). BEFORE = the world head
`793a2fa0` (its `dist` frozen before the change); AFTER = `793a2fa0` + this branch's
`src/world/canopy/` change. Poses: `broll.mjs --size 1280x720 --fps 12 --test --settle 12` at
opus-review's walk poses resolved to explicit heights (eye 1.45 m over the sampled ground, aim
1.3 m — `tools/probe-heights.mjs`), plus three up-poses of my own; six views: `capture.mjs --settle 90`.
Rule (round 46): an after that looks like its before is a FAIL, not a claim.

## What changed (`src/world/canopy/roof.ts`, `index.ts`, `roof.test.mjs`)

A second grid pass of the same roof (own PRNG stream `roof-build-stand`, own grid
x −46…52 / z −96…−70, own sector mesh `canopy-roof-stand`), supported not by the layout's giants
(none reach there) but by authored bands over fable-4's depth rows — the flanks either side of the
clearing (|x| 12–34, z −82…−64), the back stand behind the ledge terrace (|x| ≤ 12, z −90…−81)
and the two older rows at z −61…−55 — at the poles' crown height above the local ground
(22 m; the poles are 26 m × 0.85–1.1) with a 14 m feather, so the clearing between the flanks
keeps a fifth of the support and closes with hazy gaps rather than a lid or open sky. Same cards,
same atlas, same material, no shadows, carved along the shaft columns and sun pools as before.

The plaza roof is byte-identical with the pass on: the test builds the roof with `stand: false`
and asserts the same clumps in the same order and the six plaza sectors' five attribute arrays
equal. The card stream is consumed in clump order and the stand's clumps come last.

**Hero frames:** the stand is what camera D looks at through the arch (its nearest band point is
54 m from D; B/E 58 m; A 70 m; C/F never see it), so the plaza roof's 120 m exclusion would
build nothing over it. The stand pass has its own drop distance, `HERO_DROP_STAND_M` — set by the
six-view measurement below, not by argument.

## Six views — BEFORE → AFTER (native)

### First measurement — feather 14 m (`4839a3c6`; a quarter of the cells over the clearing)

| view | SSIM before → after | pixels changed (> 8/255) | where | draws | triangles |
| --- | --- | --- | --- | --- | --- |
| A | 0.2232 → 0.2232 | 0.025 % | x 0.28–0.31, y 0–0.07 | 452 → 453 | 8.825 → 8.827 M |
| B | 0.2004 → 0.2012 (+0.0008) | 0.163 % | x 0.24–0.39, y 0–0.14 | 434 → 435 | 7.930 → 7.932 M |
| C | 0.2210 → 0.2210 | 0.000 % | — | 342 → 342 | 6.827 M |
| D | 0.2714 → 0.2722 (+0.0008) | 0.307 % | x 0.10–0.61, y 0–0.14 | 391 → 392 | 8.021 → 8.022 M |
| E | 0.2207 → 0.2208 (+0.0001) | 0.163 % | as B | 434 → 435 | 7.930 → 7.932 M |
| F | 0.2350 → 0.2350 | 0.000 % | — | 408 → 409 | 8.041 → 8.043 M |

Console 0 errors. The stand roof enters A/B/D/E only in their top band above the arch and the
far trunks, at 50–55 m and beyond in the haze (audit `stand.nearestHeroM`: B/E 50.3, D 50.6,
A 55.2, F 60.7, C none); the reference D has dark canopy there where ours had grey haze, and
D moves toward it. `HERO_DROP_STAND_M` 50 dropped 7 cells of the rows band; the budget did not
need more.

### Second measurement — feather 20 m (about half the cells over the clearing)

_filled from the re-capture_

## Poses — BEFORE | AFTER

_filled from the pose diff and the sheets_

## Provenance

- `tools/probe-heights.mjs` (node, no browser) samples the heightfield for the walk poses;
  `tools/clearing-poses.json` is the rendered list.
- Sheets: `../owner-fable-canopy/tools/sheet.mjs`; pixel diffs: `../owner-fable-canopy/tools/pixdiff.mjs`.
