# fable-5 — take-0132 (`4f22e7ec`, sealed 15:28 UTC after six starts; the capture the logs called take-0133): read + re-verdict

## The pre-read held: the browser-per-view pipeline is healthy

r55 §D predicted the six views from take-0131 plus every source step measured in pairs. The seal:

| view | take-0131 | take-0132 | Δ | §D expected | miss |
| --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2153 | **0.2209** | **+0.0056** | 0.2213 | −0.0004 |
| B_house | 0.1989 | 0.1987 | −0.0002 | 0.1987 | 0 |
| C_lookback | 0.2237 | 0.2198 | **−0.0039** | 0.2186 (0.2195 without shadowlod) | +0.0012 (+0.0003) |
| D_log | 0.2766 | 0.2765 | −0.0001 | 0.2764 | +0.0001 |
| E_ground | 0.2194 | 0.2194 | 0 | 0.2191 ± Link | +0.0003 |
| F_canopy | 0.2381 | **0.2319** | **−0.0062** | 0.2316 | +0.0003 |

Every view inside the ±0.002 reading rule; B and E — which no source step touches — moved 0.14 % of their
pixels, the pipeline's own noise. The deltas are the source, as booked: **A +0.0056 is the timber tint (+0.0087)
less PR #29's bank cores (−0.0027); C −0.0039 and F −0.0062 are PR #29 (−0.0040 / −0.0104) less the tint's F
+0.0040** (r54 §A, §D). The stats say shadowlod is in the build (A 444 draws / 8.68 M — fable-4's post-shadowlod
numbers), so C's expected is 0.2186 and the miss +0.0012 — still inside the rule; the capture's settle-90 dapple
on C's hazed bank costs less than my settle-8 pair measured. Draws 335–444, A 8.68 M: inside W38.

## Verdicts: 41/50 unchanged; two re-filed on this take

| item | verdict | why |
| --- | --- | --- |
| **W02** | **pass (re-filed, reinforced)** | the first sealed take with the timber tint: flight box (0.60–0.92 × 0.25–0.70) dark 61.1 → **40.2 %** (frame 15.9), pale 7.3 → **13.0 %** (frame 13.9), mean l 0.249 → **0.301** (frame 0.344) — r54 §A predicted 40.7 / 13.1 / 0.300. Pale timber lips over dark troughs, the treads showing between; what stays dark is the canopy shade over the treads (V17, a light item). `evidence/fable-5/take-0132-W02-A-flight.jpg` |
| **C01** | **fail (re-filed, unchanged)** | Link at E is pixel-identical to take-0131 (the same gated pixel counts and medians) — Astra's #26 import in this take did not touch his rendered colours. Tunic 73.8° / 0.28 / 0.21 vs the frame's 57° / 0.25 / 0.35 in matched boxes: 0.14 darker, 17° greener. Skin and hair matched since take-0125. `evidence/fable-5/take-0132-C01-E-link.jpg` |
| W10 | fail (carries) | F's canopy: PR #29's receded bank cores let more haze through the lobes than take-0131 did (F −0.0062, 4.7 % of F's pixels moved by > 20 levels) — worse, not better |
| W23, W03, W06, W08, W15, W29, W32, W36 | pass (carry) | the paving, the boulder, the banks and the arch did not change between the takes by more than 0.5 % of any frame's pixels except at A/C/F, where the change is the flight, the bank cores and the rim (§A–§B of r54) |
| W05, W09, W30, W31, C02, U02, W37 (auto) | fail (carry) | untouched by the source chain |

Score 41/50 (Phase 1 36/42) — the same as take-0131; no regressions, no improvements booked by the gauntlet,
one visual item reinforced (W02) and one confirmed unchanged (C01).

## For the next take (0134, the head at `bc7481bb`)

Since this take's build the head has taken: `onUpload` for trees / rocks / props, pebble-bytes, rock-bytes,
vertexbytes (r55 §F, §G, §I — all frame-neutral to the fourth decimal) and the grass blades to 26 m (r55 §K.2:
A −0.0002, B −0.0002, C −0.0005, D 0, E +0.0004, **F −0.0022**). **Expected take-0134: A 0.2207, B 0.1985,
C 0.2193, D 0.2765, E 0.2198, F 0.2297.** PR #29 is still the head's largest open six-view cost (F now
−0.0104 −0.0022 against take-0131's frame); the D boulder's sun corridor (r55 §J/§L) and V16's fill (r55 §K.1)
are the two ranked items with a measured path.
