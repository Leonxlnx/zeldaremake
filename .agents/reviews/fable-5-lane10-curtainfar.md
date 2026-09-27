# `agent/fable-4-curtainfar` `9baa882f` — a far rung for the giants' authored curtains, dark by default — the decision card measured (fable-5, lane 10)

**Read 2026-09-26 07:31–08:50 UTC, on the branch's own build** (its base is nearbox `ad40ecda`, so nearbox's frames and counts are the
"off" column; the branch itself changes nothing with the constant at Infinity). `?curtainfar=<m>[,<every>,<scale>]` builds a thinned twin
of each giant's eye-detail laminae (`giants-authored-leaves-*`, 13–257 K triangles a giant): every n-th lamina kept and grown about its
base — 1 in 2 at √2 keeps the leaf area, 1 in 4 at 1.8 is the family trees' medium rule — and swaps to it past `m` with 3 m of
hysteresis. `tsc` green, the lodPool tests 22 / 22. The mechanism is the owner's decision card; here are its numbers.

## The six views — untouched at every distance tried

At 25 m, both rules: A B C D E F **1.0000 / 0.00 %**, and the fixed views' counts identical to nearbox's (A 575 / 8.510 M). Every hero
camera stands inside 25 m of the curtains it sees — the "shot-D curtains" are the ones authored for D and stand close to it; the 45 m in
fable-4's table is their distance from the green. So the sealed frames do not enter this call.

## In play — what the two rules cost, and what changes on screen

| pose | off (nearbox) | 25 m, 1 in 2 at √2 | 25 m, 1 in 4 at 1.8 | 35 m, 1 in 2 |
| --- | --- | --- | --- | --- |
| the east green (43, 4) → W — the curtains 45 m off | 652 / 9.747 M | 9.598 M (−149 K), **SSIM 1.0000 / 0.00 %** | 9.523 M (−224 K), **1.0000 / 0.00 %** | 9.604 M (−143 K), 1.0000 / 0.00 % |
| the far bank (4.06, 42.8) → N — the plaza's crowns 30–45 m | 680 / 9.659 M | 9.538 M (−121 K) | 9.458 M (−200 K) | 9.501 M |
| the plaza (0.5, 3) → S | 493 / 6.714 M | 6.660 M (−54 K), 1.52 % of pixels, the top row only | 6.660 M (**the same −54 K**), 1.52 % | 6.714 M (nothing past 35 m) |
| the east lookout (47.5, 7.5) → W | — | 623 / 9.523 M | 623 / 9.449 M | — |

**The two rules are pixel-identical to each other at every pose** (1 in 2 ↔ 1 in 4: 0.00 % at the green, the plaza and the lookout, 0.02 %
at the far bank) while their triangle counts differ by 75–80 K. So whatever changes on screen when a curtain goes far is **not the
thinning** — at 25–45 m the laminae are under a pixel either way, and 1 in 2 at √2 or 1 in 4 at 1.8 read the same.

**What does change is the shadow.** The far twin is built with `castShadow = false`, and a hidden near mesh casts nothing — so a curtain
past the distance stops casting. The plaza frame shows it cleanly: Link and the ground are pixel-identical (rows 2–5: 0.00 %), the top
row's tiles change 7–15 % and **brighten** (mean luma +0.3 to +1.0) where a curtain outside the frame used to throw its shadow on the
far crown, and the −54 K is the same for both rules because it is that curtain's depth-pass triangles leaving, not a colour-pass twin
(`it151-curtainfar-plaza-top-base-25m.jpg`, before above, after below). At the far bank the giants' crowns read coarser and flatter in
the crop (`it151-curtainfar-farbank-crowns-base-1in2-1in4.jpg`) — their self-shadow gone — but that frame moves 9–10 % between sessions
on its own (the bridge's sway and Link's idle phase), so I do not put a number on the far bank's change; the plaza's 1.5 % is the clean one.

## What this says for the card

1. **As built, "far" means "no shadow" as well as "fewer leaves"** — the look change the owner would be approving is the crowns losing
   their self-shadow and their cast past the distance, which is not what the card describes. The fix is the trees' own pattern: the twin
   casting (`castShadow = true` with the depth material — a coarser shadow, the leaf area kept by √2), or the near mesh kept as a cast-only
   proxy while hidden, as the near kits do (#161). With the shadow kept, the rules' visible change is the 0.00 % above — and then the card
   is a pure budget call: −150 K (1 in 2) or −225 K (1 in 4) at the green, similar at the far bank, nothing at the six views.
2. **The distance:** 25 m and 35 m pay the same at the green (the curtains there are 37 m from the camera to their sphere's face); 35 m
   pays nothing at the plaza. If the shadow is kept, 25 m is the better number — it reaches the far bank's crowns too; if it is not, no
   distance is free of the brightening.

**Verdict on the branch as pushed: dark by default, ships nothing, and the mechanism works — but the twin must cast before the switch is
turned on anywhere.** Re-measured the hour that lands.
