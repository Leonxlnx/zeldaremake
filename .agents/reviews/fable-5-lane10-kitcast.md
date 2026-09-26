# `agent/fable-2-kit-cast-proxy` (PR #161) `4f2f4586` / `efe7b9c3` — the hero near kits cast through their far skin — non-author read (fable-5, lane 10)

**Read 2026-09-25 22:00–22:45 UTC on the tip `efe7b9c3` (the head `bc2e015f` merged; `4f2f4586` is the one commit, 28 lines in
`rocks/index.ts`).** The near kit stops casting (`nearMesh.castShadow = false`); a `castProxy` — the far mesh's geometry under a
`MeshBasicMaterial({ colorWrite: false, depthWrite: false })`, `castShadow`, `visible` only while the kit is active — casts in its
place. The kit's 65–107 K triangles leave the sun's depth pass; the 15–17 K far skin casts instead. The same pattern the trees'
shadow proxies use.

## The six views — pixel-identical

| view | head `e438c6e5` → branch | vs reference |
| --- | --- | --- |
| A_stairs | 1.0000 / 0.00 % | 0.1732 → 0.1732 |
| B_house | 1.0000 / 0.00 % | 0.1690 → 0.1690 |
| C_lookback | 1.0000 / 0.00 % | 0.1791 → 0.1791 |
| D_log | 1.0000 / 0.00 % | 0.2334 → 0.2334 |
| E_ground | 1.0000 / 0.00 % | 0.1899 → 0.1899 |
| F_canopy | 1.0000 / 0.00 % | 0.2029 → 0.2029 |

By construction: a kit is active only within `min(12, hero − 1.5)` m of the camera, `hero` being the nearest fixed camera's distance,
so no fixed view ever sees a kit — or, now, its proxy's shadow.

## In play, where a kit is active

The pose has to be chosen for it. My costs-sheet pose at the flight's foot (Link (3.6, −0.4) facing up the flight, the camera at
(−0.7, −0.4)) is 10.2 m from the stair-foot boulder (9.1, 2.5) — past the kit's 9.1 m activation there — so the rocks row is 25 draws /
0.20 M on both builds and the frames are identical. **Link at (5.8, 0.5) facing up the flight** puts the camera 7.9 m from the boulder,
the kit active:

| | head `e438c6e5` | branch `efe7b9c3` |
| --- | --- | --- |
| the frame | 529 draws / 9.13 M | 530 draws / 9.08 M |
| the rocks row alone (`isolate`) | 25 draws / 0.32 M | **26 draws / 0.28 M** |
| the frame, head ↔ branch | SSIM 0.9999, 0.23 % of pixels over 8/255 — all of it on the boulder's shadow edge (tiles 6–8 of row 4) | |

−0.04 M for +1 draw (the proxy's colour-pass draw, which writes nothing): the arithmetic of one 65 K kit — its 65 K leave the depth pass,
the 15 K skin enters it and is submitted once more, unwritten, in the colour pass. The author's 0.06–0.09 M is at a pose with a bigger kit
or two active; at mine it is one. Beside the boulder facing south (Link (7.5, −1.5)) the kit is not active on either build (32 / 0.39 M
both).

**The shadow:** the boulder's, as the commit says — the cushions' 6–12 cm swell is the only part that no longer casts, and at 8 m it is
the shadow's edge moving by a few pixels (`it141-kitcast-shadow-head-branch.png`: the head left, the branch right, the boulder with
its cushions, pots and paving reading the same).

## Verdict

**PASS for merge.** Pixel-identical at the six views; in play −0.04 M at the one pose I could activate a kit, one draw more, the
shadow the boulder's. The small print for the author: the proxy adds a colour-pass draw per active kit that writes nothing — a layer the
main camera does not render would keep the depth pass and drop that draw, if the draw count ever matters more than the triangles.
