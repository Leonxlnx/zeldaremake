# fable-5 — round-51 reviews (`agent/fable-5-r51-review`)

Continues `fable-5-r50-branches.md` after `1163f77b` merged it. Same method (head + branch in a worktree,
same shot positions, SSIM at 256×144 vs the reference, crops at the defect's pose).

## A. Iteration 35 (09:20–09:50 UTC) — fable-2 `agent/fable-2-w23-move` @ `438be703`: the shot-D boulder to the frame's rock spot

fable-cursor's 07:45 go: `layout.ts` moves `shot-d-boulder` to (−2.0, 0, −7.6) r 0.6 — the path's west
edge in front of the fern bank, ≈ 5 m from D (r 0.75 does not fit the 1.38 m bole–paving gap with 0.3 m
clearance; the size comes from the distance). Union = branch merged with head `f728813e`; build green,
`layout`/`rockgen` tests green — **vegetation's `plants.test` / `carpet.test` go red** (the authored fern
cluster follows the rock), which fable-2 flags as vegetation's contracts to follow before merge.

| view | head → move | SSIM vs reference |
| --- | --- | --- |
| D_log | 14.5 % (the rock + its ferns + the exposed bank) | 0.2640 → 0.2616 (**−0.0024**; fable-2's own measure +0.0005) |
| E_ground | 5.8 %, the left third | **−0.0046** |
| A_stairs | 3.6 % | −0.0008 |
| C_lookback | 3.0 % | −0.0016 |
| `sn-boulder-shotd` | 77 % — the pose looks at the old spot, now bank | — |

**W23 at D — the frame's rock, at last, in light.** A warm tan rounded boulder at the path's west edge in
front of the fern bank, where `d_121`'s and D's rock stands; its stone pixels read **l 0.28, hue 53°,
sat 0.24** against the frame's 0.27 / 52° / 0.36 — luminance and hue matched for the first time, chroma
two thirds. Form is still a moss-capped loaf (the frame's has a fern hat and lit planes), but W23's
criterion ("the hero boulder as in the reference at D") is within reach: **a near pass, decided on the
take.** The price: **E −0.0046** — the rock now stands in E's left third where the reference E shows the
path and the child; the reference's rock *is* at this world spot (D proves it), E simply frames it where
the demo's E did not. A rubric-driven composition change that fable-cursor asked for; name it so, or
accept E's loss as V21's kind. A −0.0008, C −0.0016 are the fern cluster following the rock.

Sheet `fable-5-r51/fable-5-r51-f2-w23-move.jpg`. Note: my head build here is `48156889` (the lod-1 dial
merged since is pixel-identical at every pose I have rendered, r50 §B).

## B. Iteration 36 (10:20–10:55 UTC) — fable-4 `agent/fable-4-cushions` @ `574db8f9`: the emergent bole's bright cushions; and the brown bark's first read at D

The owner's in-game note (06:19): "bright cushion geometry on the emergent bole". fable-4 identified the
near base's 3-D moss cushions and thinned them on the emergent (density 0.05 → 0.03, 3.5–8 cm, cap 120),
naming `materials.ts mossCushion`'s lit end as the pale read (Astra's). Head `f728813e` + branch; build
green.

| pose | head → cushions |
| --- | --- |
| D_log | **pixel-identical** |
| `x-emergent-bole-3m` (2.8 m off the bole at (−3.1, −7.9)) | 2.8 % of pixels — the large pale-green cushion blobs on the bark are mostly gone; moss reads as flecks and sheets on bark |
| `x-emergent-bole-8m` | pixel-identical |

**IMPROVED on the owner's note, at no cost to the frames — merge.** What remains of the pale read at 3 m
is the material's lit end, as fable-4 says — Astra's lever.

**A check that paid for itself:** my first pair used a head build of `48156889` and showed D changing
7.8 % (−0.0017); rebuilt at `f728813e` the cushions are identical at D. The 7.8 % is the head's own
`48156889 → f728813e` delta — **fable-cursor's brown bark** (`shadeFloor.ts`, `trees/materials.ts`;
`BARK_DETAIL_MEAN` linear, floors, tint) merged before the seal — a low-amplitude tint shift over the
trunks (no pixel moves > 24 levels), D −0.0017 vs the reference on my scale. That is take-0127's
world, the owner's "brown trunks the second you step in": re-verdict there. The lod-1 dial (r50 §B)
stays neutral — this delta is not its doing.

Sheet `fable-5-r51/fable-5-r51-f4-cushions.jpg`.

## C. Iteration 37 (11:20–11:55 UTC) — fable-4 `agent/fable-4-slots64` @ `f8536e5a`: `NEAR_CANOPY_SLOTS` 40 → 64

fable-cursor's "next dial" after fable-4's finding that the 40-slot cap, not the 26/30 m radius, kept the
plaza lobes flat. Head `d292437a` + branch; build green.

| pose | head → slots64 |
| --- | --- |
| A, B, C, D, E, F | **pixel-identical** |
| `w27-plateau-u` (straight up from the plateau) | 15 % of pixels — the flat dark crown card at the frame's bottom centre becomes layered leaf clusters; blue sky 20.4 % → **21.5 %** |

**IMPROVED at the look-ups, merge — and not the fix for the sky overhead.** The flat card with its
straight edge is gone from the plateau look-up (the "flat cut-out crown" read from the round-47 walk), the
edges are leafy; the layered lobes are sparser than the card they replace, so the overhead gap (#7 on the
round-50 list) opens by a point rather than closing. #7 remains a canopy-roof item (owner-fable), not a
slot count. Sheet `fable-5-r51/fable-5-r51-f4-slots64-w27.jpg`.

## D. Iteration 38 (12:20–12:50 UTC) — fable-2 `agent/fable-2-stairs-logs` @ `a91dfec2`: round bark-timber nosings + end stakes on the main flight (V18′ / W02 / §9)

fable-cursor's 10:45 offer of the hardscape stairs to the Fable chats; fable-2 took it after §9. One bark
mesh over the stone flight (`logNosings.ts`: structures' logBark recipe on `bark_brown_02`), a log
0.16–0.20 m across along every riser's top edge with its crown ≈ 6 cm proud of the tread and its front
tangent 10 cm past the slab nose, moss on the upper side, damp underside, sawn ends; a stake at each
log end every second step — 20 logs + 20 stakes, 21.3 K tris, +1 draw, behind a `STAIR_LOGS` flag. Head
`d292437a` + branch; build + hardscape tests green.

| view | head → logs | SSIM vs reference |
| --- | --- | --- |
| A_stairs | 1.8 % | 0.1961 → 0.1952 (**−0.0009**) |
| C_lookback | 0.7 % | −0.0016 |
| F_canopy | 2.2 % | 0.2250 → 0.2146 (**−0.0104**; fable-4's review −0.0069) |
| `w23-stairs-f` (head-on from the foot) | 27 % | — |

**The flight is the demo's flight now — the single largest change at A since the giants.** At A every
step carries a dark rounded timber along its edge where the frame has one; the pale cut-slab faces
disappear under the log crowns; head-on the flight is dark log lines over lighter treads, `d_105`'s
read. The end stakes are there at the log ends. **W02 turns to pass on my read at the next take** — the
criterion's letter says "individually cut, weathered stone", the reference it names is log-risered
(§6.6b, §9, RUBRIC_PROPOSALS), and this matches the reference. Still open from §9: the pitch (ours
gentler), the banks rising beside the flight, and the top dissolving into a haze gap (V17).

**F −0.0104 is the price and it is the same kind as V16's**: F looks up the flight from the left, its
pale slabs happened to match the frame's brightness structure, and the darker nosings break that match.
The owner asked for the demo's stairs; this is what the demo's stairs cost at F. **fable-cursor: name it
the owner-approved change it is and merge**; if F's number has to come back, the lever is the treads'
brightness (the frame's treads are pale and lit — V17), not the logs.
Sheet `fable-5-r51/fable-5-r51-f2-stairs-logs.jpg`.
