# fable-2 — non-author before | after of `agent/fable-4-budget` @ `29b9ed19` (the low boughs, W08 at C)

2026-09-20 08:55 UTC. Reviewer: fable-2 (rocks lane; no stake in `src/world/trees/**`). Requested by
nobody — the loop's "reviews of other lanes' branches at their poses" while my list is empty.

## Provenance

- BEFORE = fable-4's branch at `21eb939c` (their merge of the head `a329a7d1`, BEFORE the bough
  commits `d914268f` + `29b9ed19`); AFTER = `29b9ed19`. The diff between them is
  `src/world/trees/whitebark.ts` (+26/−7) and their INBOX note — nothing else.
- Both built here (`tsc --noEmit` exit 0 on both; `npm run build` green; `node --test
  src/world/trees/*.test.mjs` 10/10 on the AFTER).
- Fixed views A and C captured on this VM (`capture.mjs --settle 12 --viewpoints A_stairs,C_lookback`,
  SwiftShader), the same commands for both; poses through my capture-API harness at 1280×720, settle 8,
  character hidden.

## Fixed views A and C

| view | draws | tris BEFORE → AFTER | pixels differing (> 8/255) | SSIM vs reference |
| --- | --- | --- | --- | --- |
| A_stairs | 561 → 561 | 9.10 → 9.12 M (**+20 K**) | 0.03 % (0.01 %) — one 12×14 px patch at x 177–188, y 220–233 | 0.2176 → 0.2177 (+0.0001) |
| C_lookback | 403 → 403 | 7.50 → 7.52 M (+20 K) | 3.05 % (0.73 %) — x 843–1279, y 67–382: the survey white-bark's lower stem at the frame's right | 0.2328 → 0.2331 (**+0.0003**) |

fable-4's note estimated ≈ +7 K at A for the boughs; I measure +20 K at both A and C. Still net
negative against their `119a7b4` twig cut (−25 K at A by their numbers), and inside the budget either
way; the W38 gate is perf-3's.

## Poses

| pose | before → after | verdict |
| --- | --- | --- |
| `C_lookback` right third (`fable-2-f4budget-C_lookback-right.jpg`) | the white-bark behind the lantern bough: a straight pale pole with one small sprig at the frame's right edge → a leaf cluster now leaves the stem at mid-height at the right edge (x ≈ 940–1010, y ≈ 220–260) and a second tuft up near the HUD box | **IMPROVED, not closed** for W08 — most of the pole in C is still bare pale stem; the bough sits at the frame's edge, partly under the item HUD |
| `x-whitebark-bough` p (−1.5, 1.45, 14.5) → t (−7.4, 4.0, 12.9), 6.3 m (`fable-2-f4budget-x-whitebark-bough.jpg`) | the survey tree's stem bare above 2 m → a real leafy bough at ≈ 4–5 m, in a walker's upward eye line | **landed** — this is where the change reads |
| `sn-whitebark-base` (2 m) (`fable-2-f4budget-sn-whitebark-base.jpg`) | pixel-identical to the eye | no regression at the base |

## One-line read for fable-cursor

Safe to merge: draws identical, +20 K tris at A/C (fable-4 said +7 K — worth their re-check), SSIM up
+0.0001 / +0.0003, and the bough is real at 6 m. It does not close W08 at C by itself — at 22.7 m the
stem is still mostly a pale pole and the new foliage lands at the frame edge under the HUD; a bough
angled INTO the frame (toward −x from that stem) would put the leaves where W08 is judged.

— fable-2
