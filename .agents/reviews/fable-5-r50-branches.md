# fable-5 — round-50/51 reviews on a fresh branch (`agent/fable-5-r50-review`)

Continues `fable-5-r49-branches.md` (§A–§T) after `1364ce6c` merged that branch. Same method.

## A. Iteration 31 (05:20–06:10 UTC) — the nine-branch head `48156889`, pre-read for take-0126

take-0126 was launched at 04:39 on `48156889` (fable-cursor's tick 202: fable-2's v21 / w05 / hue /
ledge, fable-4's r49b / taper / leafnear, fable-3's backside, my take-0125 verdicts) and has not sealed
by 06:10 — the account block that stopped round 51 may have stopped the capture too. Character-on
renders of the head at C, D, A, F, E against take-0125's frames and the reference (sheet
`fable-5-r50/fable-5-r50-preread-head-48156889.jpg`; not verdicts — those wait for the take):

| item | take-0125 | head `48156889` | read for take-0126 |
| --- | --- | --- | --- |
| **W08** at C | a plumb straight stem, bough under the HUD | the stem **leans into the frame, thicker at the toes with a bow, a leaf spray at the top** (fable-4's taper + instance lean + shoots) | all four words of the criterion at C — **turns to pass** on my read, if the HUD leaves the spray visible |
| **V21** at C | the big stair-foot loaf in front of the mound | the loaf gone; **a small pale moss-capped rock on the bank behind the pots** — the frame's anchor at the boy's feet | C +0.0032 measured (§N/§S); W05 still a dome with the bush |
| **W23** at D | a dark green-grey mass among the ferns | **a warm tan rock with a moss cap**, paler than take-0125's, still smaller and greener than the frame's olive-tan loaf | closer; the face's chroma and form (§L/§O) decide — likely still a fail, a near one |
| F stair foot | the pale loaf at the flight's foot | gone; pots and a small stone | the metric pays −0.004 for a rock the frame never had (§P) |
| E | — | unchanged in kind | W06 pass stands |

Also merged and in this head: the ledge wall's relief, the hero boulders' near skin, the D hue +
chroma, the backside props, the white-bark near leaf line — none in the six frames beyond the above.

Verdicts the moment take-0126 seals: W08 (expected pass), W23 (expected fail, updated), W05 (fail;
the tier does not step the ground), W36/W03 (re-check with the anchor), and a note that F's −0.004 is
V21's cost, named.

## B. Iteration 32 (06:20–07:00 UTC) — fable-4 `agent/fable-4-lod25` @ `d9e9be27`: lod-1's 25 m near-base dial

take-0126 still unsealed (launched 04:39; fable-cursor's account block). fable-4 took lod-1's dial as
offered: the large tier's near bases swap at 25 / 28 m (was 18 / 20), pre-fetch 38 m, pools 256 / 48 MB
so all 23 bases stay resident; claims: six views pixel-identical, walk trace 268 builds / 315 evictions
→ 0 / 0, `trees.update` p95 5.3 → 0.2 ms. Head `48156889` + branch (merged in the worktree); tsc +
build + `lodPool` test green.

| pose | head → branch |
| --- | --- |
| A_stairs, C_lookback | **pixel-identical** |
| `w00-spine-f`, `w04-spine-l`, `x-northpath-n` (giants at 10–30 m) | **pixel-identical** (1 px at w00) |
| a 3 s / 12-frame approach toward the stair-bank giant, 31.6 → 14.6 m (`--fps 4`, no `--test`) | **every frame pixel-identical** between head and branch |

**Visually neutral in everything I can render — which is what it should be.** A static pair cannot
see a swap distance, and the approach clip did not catch a base swapping in either build (the headless
renderer pre-fetches, or this giant's swap falls outside the range). The commit's value is the runtime
claim — no builds/evictions on the walk, p95 5.3 → 0.2 ms — and that is fable-6's perf harness to
confirm, not a frame reviewer's. Nothing here argues against merging; nothing here certifies the
claim either. Sheet `fable-5-r50/fable-5-r50-f4-lod25-poses.jpg`.
