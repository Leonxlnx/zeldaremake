# fable-5 — round-55 reviews (`agent/fable-5-r54-review`, continued)

Continues `fable-5-r54-branches.md`. Same method: the branch tip merged over the head's source
(here the merge-base `073f5ff2` *is* the head's source — `dc69f2e1` is docs-only), both built the same
way, rendered in the same session with the same settle (`broll.mjs --test --settle 8`, 1280×720,
quality high), SSIM at the gauntlet's 256×144 against `reference/frames/*.jpg`, pixels counted at
full resolution with a > 6-level luma threshold.

## A. Iteration 53 (03:30–04:55 UTC) — fable-4's `agent/fable-4-shadowlod` @ `7164ff29`: the white-barks' mid LOD stops casting shadows (W38 give-back)

One line in `trees/index.ts` (`mesh.castShadow = l < (label === 'whitebark' ? 1 : 2)`): the white-bark
meshes standing 20–44 m from the camera no longer write the shadow map; the columns' mid LOD keeps
casting (fable-4 measured the columns too and did not ship them — E −0.0032). Twelve positions:

| view | changed px (> 6) | signed Δ where changed | SSIM vs reference | fable-4's own table |
| --- | --- | --- | --- | --- |
| **A_stairs** | 0 (pixel-identical) | — | 0.2013 → 0.2013 (0) | 0 |
| **B_house** | 0 (max Δ 2.3) | — | 0 | 0 |
| **C_lookback** | 0.50 % | **+12.6** (brighter: shade gone) | 0.2105 → 0.2096 (**−0.0009**) | −0.0006 |
| **D_log** | 0.14 % | +7.1 | 0.2619 → 0.2617 (−0.0002) | −0.0002 |
| **E_ground** | 0 (max Δ 2.5) | — | 0 | 0 |
| **F_canopy** | 1 px | — | 0 | 0 |
| `sn-whitebark-base` (survey-2) | **2.39 %** | +17.8 | — | not measured |
| `wb-grove-10m` (my grove pose) | **5.58 %** | +12.0 | — | not measured |
| `wnw-south` (10, 1.5, 40 → the grove, 32 m) | **2.92 %** | +15.6 | — | not measured |
| `wnw-east` (34, 1.5, 22 → WNW, the east meadow) | 0 | — | — | — |
| ~~`wnw-plaza-east`~~, ~~`wnw-northeast`~~ | struck | — | — | badly placed probes: the camera inside a bush / under the terrace geometry — their 0.17 % / 0.06 % mean nothing |

**Six views: within budget, reproduced.** A/B/E/F pixel-identical, C −0.0009 (fable-4 −0.0006 — same
direction, the settle's noise apart), D −0.0002. C's change is the hazed bank behind the lantern limb
(top and middle thirds only; the bottom third 0 %), exactly where fable-4 put it.

**What the give-back costs, and where.** At every pose the near ground (the bottom third of the
frame) is untouched — 0.0–0.3 % — because the trees whose shade reaches the player's feet are the near
LOD, which still casts. The loss is on the trees 20–44 m out and the ground at *their* feet:

- **Crown-on-trunk shade.** A young white-bark's crown shaded a band of its own trunk; at 20–44 m that
  band is gone and the trunk is lit top to bottom (`wb-grove-10m` right crown: mean l 107 → 110, 8.8 %
  of the crop changed; the far-right trunk pair 92 → 94, 17 %). The crown itself reads flatter — the
  darker interior leaves were the crown's own shadow (centre-right crown: 28 % of its pixels changed,
  +4 levels).
- **Ground contact.** From `wnw-south` the grove stands 32 m off and threw a soft patch onto the meadow
  at ~20 m from the camera; the patch is gone (meadow under the grove: 85 → 88, 9.2 % changed). Under
  the haze the patch was faint, and so is its absence — but the trees now sit on the meadow without a
  shadow to root them.
- The one valid probe east of the plaza (`wnw-east`, the meadow with a near white-bark at the frame's
  left and trees 20–40 m out) does not change by a pixel: the mid-band trees there are columns or
  giants, which keep casting. Two more probes I placed blind (`wnw-northeast`, `wnw-plaza-east`) landed
  under the terrace geometry and inside a bush — struck from the evidence, kept in the table so the
  count of positions is honest.

Sheets: `fable-5-r55/fable-5-r55-f4-shadowlod-grove-crown.jpg` (the crown-on-trunk band, before |
after), `fable-5-r55/fable-5-r55-f4-shadowlod-wnw-south.jpg` (the grove's meadow patch),
`fable-5-r55/fable-5-r55-f4-shadowlod-heat.jpg` (C, the grove, the base pose and `wnw-south`: head |
branch | where it changed).

**Verdict: mergeable as a W38 give-back** — six views inside −0.003, the near ground untouched
everywhere, the only cost a soft loss of self-shade and ground contact on white-barks 20–44 m out,
under haze that already takes 60 % of it at 30 m. Reported plainly so the trade is a choice, not a
surprise: the grove poses lose 2–6 % of their pixels to it, all brighter.

**An option, fable-4's call (not a request):** fable-2's map said "a lower LOD for the shadow pass
alone would keep the shadows and lose most of it". Three.js has no per-pass geometry on an
`InstancedMesh`, but a shadow-only proxy does the same thing: a second `InstancedMesh` on the *low*
geometry for the mid bucket, `castShadow = true`, its material `colorWrite = false` (+ `depthWrite =
false`) so the main pass draws nothing — the mid trees keep a crown-on-trunk band and a ground patch at
one lamina in 16, for ≈ one extra draw per variant (+10, against 345–450 used of 700). The saving fable-4
measured (A 8.74 → 8.68 M, C 6.93 → 6.69 M) would shrink by the low mesh's shadow triangles only.

Triangles and draws were not re-measured here (`broll --test` gives frames, not stats); the frame
deltas are what this review adds.

## take-0133 — capturing (A written 03:12, seal ≈ 05:45); re-verdict follows when it seals.
