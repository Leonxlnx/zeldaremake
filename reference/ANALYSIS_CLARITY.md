# The owner's clarity direction (2026-09-22) — the circled crowns measured against the reference

fable-5, 2026-09-22 16:40 UTC. The owner's marked screenshot (Astra's
`art/environment/astra-owner-clarity-2026-09-22/owner-clarity.png`, 897 × 777, a player-height view on the head
of ~15:00) circles the giant's crown at height, x 100–550 / y 60–357: "distant/high trees clear, less grey
washout, the big blurry leaf/crown shapes at height fixed". fable-cursor's ask (INBOX 15:45): measure that region
against the reference — haze luminance/saturation per band, crown edge sharpness. Method (`.agents/reviews/fable-5-r55/clarity.py`): each region resampled to 450 px wide; pixels split into
*background* (the bright sky / haze) and *crown* by an Otsu threshold on luminance; per horizontal third and whole:
crown mean l / sat / median hue, background mean l / sat / hue, the crown–background luminance gap, **edge
sharpness** = mean |∇l| at the crown/background boundary divided by the gap (1.0 = a one-pixel edge; the inverse is
the transition width in px), and **silhouette detail** = the share of the crown mask that a morphological opening
removes (features finer than 5 px / 9 px — leaf-cluster edges score high, smooth lobes score low). Reference regions
chosen where high crowns stand against the bright top of the frame, HUD excluded.

## 1. The owner's region vs the reference

| region | crown l | crown sat | crown hue | background l · hue | gap | edge transition | detail < 5 px / < 9 px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **owner, circled** (the giant's crown, ≈ 15–25 m) | **0.39** (0.36 top → 0.44 bottom) | 0.11 | **64°** (top 62°, bottom 93°) | 0.58 · **165° cyan-grey** | 0.19 | **6.6 px** (4.9 top → 6.7 bottom) | **1.2 % / 2.7 %** |
| reference F_canopy, high canopy 0.05–0.45 × 0.14–0.40 | 0.34 | 0.11 | 51° | 0.58 · 44° warm | 0.24 | 4.7 px (3.2 at the bottom) | 2.1 % / **10.7 %** |
| reference B_house, crowns over the house 0.15–0.75 × 0–0.28 | 0.32 | 0.12 | 64° | 0.44 · 60° | 0.12 | 3.4 px (2.7 at the bottom) | 6.8 % / **14.4 %** |
| reference d_020, crowns top-left 0.15–0.60 × 0–0.35 | 0.27 | 0.12 | 46° | 0.42 · 57° | 0.15 | 4.7 px | 1.3 % / 2.8 % |
| reference d_107, the far crowns over the flight 0.15–0.80 × 0–0.28 (≈ 50 m, hazed) | 0.46 | 0.07 | 53° | 0.63 · 49° | 0.18 | 9.6 px | 0.8 % / 1.6 % |

Per band in the owner's region (top → middle → bottom third): crown l 0.36 / 0.38 / 0.44, sat 0.15 / 0.11 /
0.06, hue 62° / 64° / 93°; background l 0.60 / 0.59 / 0.55, sat 0.16 / 0.06 / 0.08; edge 4.9 / 5.1 / 6.7 px.
The crown gets lighter, greyer and softer toward the bottom of the circle — that is the haze thickening toward the
horizon on a crown that is not far away.

**What the numbers say, in the owner's three words:**

1. **"Grey washout" is a hue, not a value.** The luminance gap between the circled crown and its background
   (0.19–0.24) is the frames' (0.12–0.24). What differs is the *colour* of both: the background behind our high
   crowns is a cyan-grey at **165°** (blue sky mixed with grey haze) where every reference frame's is a **warm
   haze at 44–60°**, and our crown reads 62–93° (green-grey, 93° at the hazed bottom) against the frames' 46–64°
   (warm olive). The frames have no blue sky anywhere (`ANALYSIS.md`: 0 %), so a crown at height in the footage is a
   dark warm silhouette on warm light; ours is a grey-green cloud on cool light. Lever: the sky / haze colour and
   the haze tint on crowns — Astra's fog lane; fable-cursor's own pending palette correction ("sky/hemi warm
   greys 0xcfd3c8 / 0xe2dfd0 / 0xc9c8b4") is the same item.
2. **The crown is hazed like a far one.** At 0.39 the circled crown sits between the frames' near-high crowns
   (0.27–0.34, F / B / d_020, ≤ 25 m) and their far ones (0.46, d_107 at ≈ 50 m); its edges (6.6 px) likewise sit
   between the frames' near (3.4–4.7 px) and far (9.6 px). The giant's crown at 15–25 m is being drawn with the
   haze weight the frames give a crown at 50 m. Lever: the haze density / height curve at 15–30 m and how much of
   it the crown lobes take — Astra's fog lane.
3. **"Big blurry shapes" is silhouette scale.** Only **2.7 %** of the circled crown's mask lives in features finer
   than 9 px; the frames' near-high crowns carry **10.7–14.4 %** — leaf-cluster edges the size of a hand, not
   lobes the size of a house. Our high lobes score like the frames' 50 m crowns (1.6–2.8 %) although they are
   three times nearer. Lever: leaf-scale edges on the far-crown cards — exactly what Astra's atlas painter
   (`b7c9e001`, merged 16:17) is for; §2 below measures it — and a shorter alpha transition (ours 6.6 px, the
   frames' near-high 3.4–4.7).

Targets, for whoever briefs it: at 15–25 m a high crown at **l 0.30–0.35, hue 45–60°**, on a background at
**hue 45–60°**, with an edge transition **≤ 4.5 px** and **≥ 10 %** of its silhouette finer than 9 px. The gap
(0.19–0.24) is already right and must not be spent.

Sheet: `.agents/reviews/fable-5-r55/clarity-owner-vs-reference.jpg`.

## 2. Astra's far-crown atlas painter (`b7c9e001`) at five plaza crown poses, before | after — no distant cards in frame, so nothing to see (corrected by §4)

> **Correction (18:30):** fable-4's hide-and-diff at two west-meadow poses that reproduce the owner's symptom
> (`art/environment/round52-clarity-attrib/`, k3 (−41, 14) and k4 (−24, 30) toward the far-hut knoll) attributes
> **100 % of the soft crown forms to `trees/distant`'s far crown cards** (29 % / 69 % of the region's pixels; the
> white-barks are the crisp clusters at the edges, the canopy roof 1.5–12.6 %). My inference below — that the circled
> lobes are the giants' canopy at the near→far swap — was drawn from plaza poses that frame no distant cards, and is
> withdrawn. The painter's domain *is* the circled crowns; §4 measures it where they are.

Before `f9c58007`, after `b7c9e001` (the painter: "seeded leaf shapes instead of blurred clumps" on the far-crown
atlas), same shot list, the character on, five player-height poses looking up at giants' crowns from the plaza
(`clarity-nw-giant` (0, 1.6, 4) → (−8, 12, −20); `clarity-w-giant` (2, 1.6, 10) → (−8, 10, −14);
`clarity-stairbank-giant` (−2, 1.6, 14) → (6, 12, −6); `owner-like-south-centre-29m` (0, 1.6, −2) → (−4.5, 15, 27);
`owner-like-plaza-south-18m` (−2, 1.6, 4) → (4.4, 14, 20.5)): **0.02–0.06 % of pixels change, none by more than
28 levels; every clarity number identical to the digit** (e.g. `clarity-w-giant` upper region: crown l 0.34, hue 87°,
edge 2.8 px, detail < 9 px 16.1 % — before and after). The painter's cards are the far LOD's; the crowns the owner
circled are the giants' canopy lobes at 15–30 m, which these poses show at their *near* look — and at that look
they already meet the targets (edge 2.6–3.4 px, detail < 9 px 7.6–16 %, crown l 0.28–0.41). So the loss the owner
sees is **between the near lobes and the far cards** — the giants' canopy swap (26 / 30 m) and the haze weight on
whatever is drawn there — not the far-crown atlas.

What these poses also show, against the reference: **the background behind every high crown is blue sky at hue
200–207°, sat 0.14–0.32** (the frames: 44–60°, sat 0.07–0.11) — the strongest single number in this file, and the
one the owner's eye calls "grey washout". Crown hue 77–87° (the frames 46–64°).

Not done: the owner's exact pose (an open lawn, a lone giant ahead-left, white-barks right) is not in the survey
manifest and my guesses from the plaza look up into the canopy instead of across a lawn at it. **Ask:** the
position/heading of the owner's screenshot (the local preview logs the pose; `__ZR__.cameraPose()`), or the
lane that reproduces it adds it to `art/environment/survey2/manifest.json` as `owner-clarity-1` — then §1's
numbers can be re-read on our build before and after each change, with the same script.

## 3. Astra's height-fog clarity slice (`ae880cf2`: hazeDensity 0.018 → 0.008, hazeFarDensity 0.055 → 0.008, farShadeMin 0.30 → 0.65) at the six views — clearer, but darker than the frames, and the hue did not move

Before `b7c9e001`, after `ae880cf2`, same shot list. "Far box" = the hazed far band of each view (A/B/E 0.30–0.75 × 0.05–0.30,
C 0–1 × 0–0.35, D 0.30–0.70 × 0.15–0.45, F 0.30–0.90 × 0–0.30); mean l, micro σ (2 px residual, local contrast), sat, and the
hue of its coloured pixels.

| view | SSIM vs reference | far band mean l: reference · before · after | far hue: ref · before · after | far micro σ: ref · before · after |
| --- | --- | --- | --- | --- |
| A | 0.2013 → 0.2115 (**+0.0102**) | 0.479 · 0.426 · **0.363** | 57° · 72° · 67° | 0.017 · 0.026 · 0.029 |
| B | 0.1838 → 0.1817 (−0.0021) | 0.414 · 0.403 · **0.350** | 58° · 63° · 65° | 0.027 · 0.025 · 0.026 |
| C | 0.2095 → 0.1977 (**−0.0118**) | 0.374 · 0.326 · **0.282** | 51° · 73° · 72° | 0.023 · 0.023 · 0.023 |
| D | 0.2622 → 0.2474 (**−0.0148**) | 0.501 · 0.451 · **0.377** | 51° · **203°** · 68° | 0.018 · 0.013 · 0.014 |
| E | 0.2055 → 0.2076 (+0.0021) | 0.411 · 0.403 · **0.350** | 64° · 63° · 65° | 0.021 · 0.025 · 0.026 |
| F | 0.2118 → 0.2116 (−0.0002) | 0.399 · 0.318 · **0.280** | 50° · 72° · 74° | 0.019 · 0.028 · 0.025 |

Three readings:

1. **It clears by darkening.** Every far band drops 0.04–0.07 in luminance and lands **0.05–0.12 below the frames'**
   (D 0.377 against 0.501; C 0.282 against 0.374). The frames' far bands are *bright*: aerial perspective in the
   footage lifts the distance toward a warm light, with the crowns dark and crisp inside it (§1). Halving the haze
   removes the veil and the light with it. C −0.0118 and D −0.0148 are the largest single-step six-view losses of these
   rounds — larger than PR #29's F −0.0104 — and A's +0.0102 (the far left of A was a grey wall the frame has as dark
   trunks) does not pay for them.
2. **The hue did not move** — 65–74° after against the frames' 50–64°, the same 10–20° too green as before. The one
   hue win is D, whose far band was blue (203°: sky through the haze) and is now 68°; that is the slice removing the
   blue sky's contribution, not warming the haze. §1's finding stands: the owner's "grey washout" is the colour of the
   haze and sky, and density is the wrong knob for it.
3. **Local contrast barely changes** (micro σ +0.000–0.003; F −0.002): the far detail the owner wants "clear" is not
   in these bands at these distances whatever the density — that is the silhouette-scale item (§1 finding 3, §2).

**What the frames ask for instead** (the same numbers, as a target): far bands at **l 0.40–0.50** (not 0.28–0.38),
**hue 50–64°** (not 65–74°), with crowns *inside* them at l 0.27–0.34 and ≤ 4.5 px edges — i.e. the haze at its old
weight or near it, **warmed and brightened**, and the crown silhouettes made crisp against it. Density 0.018 → 0.008
should be reconsidered before take-0134 seals with it; a warm haze colour (`ANALYSIS.md`: 0x95968b → 0xa3a399 far,
the pending palette line) at the old density is the measured direction.

**The same slice at the five crown poses of §2** (crown / background split, whole region): crown l moves ± 0.02
(0.41 → 0.39, 0.34 → 0.35, 0.28 → 0.27, 0.24 → 0.23, 0.20 → 0.20), crown hue 2–5° warmer (77° → 73°, 87° → 82°),
**the sky behind the crowns stays at 200–207° and gets brighter** (0.58 → 0.62, 0.55 → 0.60 — less veil over the blue),
edges 2.3–3.5 px before and after, fine silhouette 7–23 % before and after (the crowns at ≤ 15 m were never the
blurry ones). Against §1's targets the slice moves nothing that was off: the background hue (165–207° vs 45–60°) is
untouched, the silhouette scale is untouched, and at the six fixed views it darkens the distance the frames keep
bright. The clarity the owner asked for is in the sky/haze *colour* and the crown *silhouettes*; the density was the
one knob that also moves the frames the wrong way.

## 4. Where the circled crowns actually are (fable-4's k3 / k4, the west meadow): the painter and the fog slice measured on the distant cards themselves

fable-4's poses reproduce the owner's symptom (large soft khaki forms, blue sky, grey haze): **k3** (−41, 1.75, 14) →
the far-hut bole (−41, 12, 35.7) from the south; **k4** (−24, 1.9, 30) → the same from the east. Three builds, the
character on: before the painter (`f9c58007`), the painter (`b7c9e001`), the fog slice (`ae880cf2`). Two boxes that
hold *only* distant cards and their background (no white-bark clusters): k3 (0.30–0.62 × 0.03–0.30), the blob behind
the hut against the sky; k4 (0.00–0.42 × 0.00–0.30), the far crown at the top-left, in haze.

| box | build | crown l | sat | hue | background l · hue | gap | edge | finer than 5 / 9 px |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| k3, cards against sky | before painter | 0.41 | 0.13 | 68° | 0.66 · **207°** | 0.25 | 4.9 px | 0.4 / 1.4 % |
| | **painter** | 0.40 | 0.14 | 67° | 0.66 · 207° | 0.26 | **4.0 px** | **1.4 / 2.9 %** |
| | fog slice | **0.46** | **0.20** | 64° | 0.66 · 207° | 0.20 | 4.5 px | 2.2 / 4.5 % |
| k4, cards in haze | before painter | 0.22 | 0.12 | 66° | 0.49 · 65° | 0.28 | **16.1 px** | 0.2 / 0.3 % |
| | painter | 0.21 | 0.12 | 67° | 0.47 · 63° | 0.26 | 15.8 px | 0.3 / 0.4 % |
| | fog slice | 0.19 | 0.14 | 65° | 0.47 · 63° | 0.27 | 15.4 px | 0.3 / 0.4 % |
| the owner's circle | | 0.39 | 0.11 | 64° | 0.58 · 165° | 0.19 | 6.6 px | 1.2 / 2.7 % |
| **the frames' near-high crowns** | | **0.27–0.34** | 0.10–0.16 | **46–64°** | 0.42–0.58 · **44–60°** | 0.12–0.24 | **3.4–4.7 px** | 2–7 / **10.7–14.4 %** |

Readings:

1. **The painter does what it says, where a card stands against the sky:** k3's blob goes from a smooth lobe to a
   ragged leafy edge — transition 4.9 → 4.0 px (the frames' 3.4–4.7 met), silhouette detail finer than 9 px
   1.4 → 2.9 % (a fifth of the way to the frames' 10.7–14.4 %). Hue, lightness and the sky behind it do not move.
   Sheet `.agents/reviews/fable-5-r55/clarity-k3-cards-triple.jpg`.
2. **Where the card is in haze, nothing registers:** k4's far crown has a 16 px transition and 0.3 % fine detail on all
   three builds — the haze at that distance blurs whatever the atlas paints. That is §1 finding 2 (the crown hazed like
   a 50 m crown) and the fog slice does not fix it: edge 15.4 px, l 0.19.
3. **The fog slice lightens and saturates the sky-facing card the wrong way:** k3 crown l 0.41 → **0.46**, sat 0.13 →
   **0.20** — the `farShadeMin` 0.30 → 0.65 lift — against the frames' 0.27–0.34; at the six views the same slice
   darkens the far bands (§3). Both moves are away from the frames.
4. **The sky behind the cards is 207° on every build.** Nothing landed today touches the one number that the owner's
   eye reads as "grey washout" (§1 finding 1).

**For take-0134's read against the owner's region:** expect the k3-class crowns crisper at the edge (met) but still a
third of the frames' leaf-scale detail, lighter and more saturated than the frames', on a blue sky; the k4-class crowns
unchanged. The clarity items that remain, by size: the sky/haze colour (the frames' warm 44–60°), the haze weight on
cards at 15–30 m (the k4 case), leaf-scale silhouette to ≥ 10 % (the painter's next step), and the far bands' lightness
restored at the six views (§3).

