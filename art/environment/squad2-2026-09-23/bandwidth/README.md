# The band's width swept: 2.5 m is right, and #198's reason for it was wrong twice over

Lane 2, 2026-09-29. Branch `cursor/squad2-treephases-682b`. **No behaviour changed** — one source comment
corrected, and a knob closed.

`TREE_LOD_DITHER_BAND_M = 2.5` came with this justification in `lodFade.ts`: *"wider costs more … and
hero A has 30 K of headroom, so this is the ceiling the budget allows rather than a taste choice."* Two
things made that worth re-opening:

1. **The 30 K is now 275 K.** The scope correction established that W38 binds four viewpoints and hero A
   sits at 8.72 M of 9.0 M with the band on, so the constraint that fixed the width is nine times looser
   than when it was set.
2. **PR #198 measured that a wider band was *less* damaging, and the lane never acted on it**: at a 12 m
   band `D_log` costs 5.65 % of its pixels but only **−0.0015** SSIM against its reference frame, where the
   shipped 2.5 m band costs 2.33 % and **−0.0034**. If a wider band touches more pixels more gently, the
   width is a quality knob and the right value is the widest the budget allows.

Five builds — band off, and 2.5 / 5 / 8 / 12 m — rendered at the same two views with the same `--views`
list and the same settle (`bandcost.mjs`, `frozen.mjs` under it).

## 1. The result: monotone, and the wrong way for #198's claim

| band | A_stairs draws / triangles | spare vs 9.0 M | changed > 2/255 | SSIM vs band-off | **SSIM vs reference** | **Δ** |
| --- | --- | --- | --- | --- | --- | --- |
| off | 559 / 8 626 622 | 373 378 | — | 1.00000 | 0.3132 | — |
| **2.5 m** | **561 / 8 724 803** | **275 197** | 0.39 % | 0.99887 | **0.3128** | **−0.0004** |
| 5 m | 567 / 8 863 807 | 136 193 | 1.25 % | 0.99644 | 0.3125 | −0.0007 |
| 8 m | 568 / 8 879 912 | 120 088 | 2.05 % | 0.99300 | 0.3116 | −0.0016 |
| 12 m | 571 / 8 905 736 | 94 264 | 3.22 % | 0.98887 | 0.3109 | −0.0023 |

| band | D_log draws / triangles | changed > 2/255 | SSIM vs band-off | **SSIM vs reference** | **Δ** |
| --- | --- | --- | --- | --- | --- |
| off | 465 / 8 242 550 | — | 1.00000 | 0.3930 | — |
| **2.5 m** | **468 / 8 258 565** | 2.64 % | 0.99097 | **0.3911** | **−0.0019** |
| 5 m | 472 / 8 294 308 | 5.22 % | 0.97816 | 0.3880 | −0.0050 |
| 8 m | 474 / 8 466 082 | 7.35 % | 0.96841 | 0.3875 | −0.0055 |
| 12 m | 483 / 8 644 032 | 8.39 % | 0.96451 | 0.3871 | −0.0059 |

**#198's own case, at its own width and its own view, comes out the other way**: it read 12 m as
**−0.0015** against 2.5 m's −0.0034 at `D_log`; measured here, 12 m is **−0.0059** against 2.5 m's −0.0019
— worse by three times, not better by two.

**Both views move monotonically further from their reference as the band widens.** So the answer to the
question this round opened is no: **2.5 m is the right width and it should stay**, and **#198's 12 m
reading does not reproduce** — its direction is the other way. That is the second figure from this lane's
own dither chain to fail on re-measurement (the first being `PROPOSAL.md`'s 1.85 %, which #206 and
`gatesweep/` §1 both corrected). The value it defends is right; the reason given for it was not.

## 2. What is worth keeping: the cost saturates, so the budget never bound it

2.5 → 5 m costs **139 004** triangles at hero A. 5 → 8 m costs **16 105**. 8 → 12 m costs **25 824**.
The trees near a gate are clustered rather than evenly spread, so widening past about 5 m catches almost
nothing new — and **even a 12 m band leaves 94 K of W38 headroom**. The budget was never the real
constraint past 5 m; the picture was. So the comment in `lodFade.ts` is corrected to say why 2.5 m holds:
it is the cheapest point on a monotone curve, not a value a ceiling forces.

## 3. The control, and a sharper rule for `frozen.mjs`

Deltas of 0.0004–0.0023 on a base SSIM of 0.31 are small, so they need a noise floor. Two band-off runs
of the same source state:

| | changed > 2/255 | SSIM to each other | reference SSIM | \|Δ ref\| |
| --- | --- | --- | --- | --- |
| A_stairs | **0.00 %** | **1.00000** | 0.3132 vs 0.3132 | **0.0000** |
| D_log | **31.73 %** | 0.90444 | 0.3937 vs 0.3930 | 0.0007 |

A_stairs is perfectly reproducible, so its column above is signal against a zero floor. **D_log moving
31.73 % between two runs of the same build is not a reproducibility failure — it is the world clock**, and
the reason is worth writing down because this lane has misattributed it twice:

`frozen.mjs` calls `setTime(12.5)` **once** and then settles 8 frames **with time** before *every* shot.
So the Nth view in a run is rendered at `12.5 + N × 8/60` seconds of world time, and **the same view at a
different position in the `--views` list is a different moment of wind.** D_log as the 4th view and D_log
as the 2nd view are 0.27 s apart, which is 31.73 % of the pixels in a frame full of alpha-tested leaves.
The docstring's rule — "a comparison must stay inside one run of this script" — is not strong enough; the
rule is **same view list, same position**. All five builds here were rendered with `--views A_stairs,D_log`
for exactly that reason, so §1's rows are directly comparable.

This also retires two loose ends: yesterday's `gatesweep/` note attributing a D_log md5 difference between
a 5-view and a 2-view run to "pool residency" had the wrong cause — it was world time — and **#198's
2.33 % for D_log now looks entirely sound**, sitting between this lane's own 1.76 % (4th view) and 2.64 %
(2nd view) for the same change at the same threshold.

## Files

- `bandcost.mjs` — the sweep: per width, draws, triangles, changed share and SSIM against both the
  band-off render and `reference/frames/<view>.jpg`, which are different questions and are kept apart.
- `widths.json` — §1's rows.

## Reproducing

```bash
for W in 0 2.5 5 8 12; do
  # TREE_LOD_DITHER_BAND_M = $W in src/world/trees/lodFade.ts (and the flag false for 0)
  npx vite build --outDir dist-b$(echo $W | tr -d .)
done
for B in b0 b25 b5 b8 b12; do
  node art/environment/squad2-2026-09-23/frozen.mjs dist-$B /tmp/w-$B --views A_stairs,D_log --settle 8
done
node art/environment/squad2-2026-09-23/bandwidth/bandcost.mjs --base /tmp/w-b0 \
  --width 2.5=/tmp/w-b25 --width 5=/tmp/w-b5 --width 8=/tmp/w-b8 --width 12=/tmp/w-b12
```

**Keep the `--views` list identical across every build**, per §3. Two Chrome jobs at once and no more; with
two live SwiftShader instances this box runs at about 3 GB of free memory and a view takes 6–8 minutes
instead of 2.
