# Kokiri Forest reference — visual analysis ("the bible")

Source: https://x.com/DiscussingFilm/status/2097327973351272627 — 60.95 s, 1280×716, H.264, screen-recorded
(the last ~0.5 s shows an iOS control-centre overlay; ignore t > 60.4 s).
Frames: `/tmp/reference/frames/f_001…f_061.png` (1 fps, full res), downscaled hero frames in `reference/frames/`.
Screen positions below are normalised (x, y) in 0..1 from the top-left. "Link = 1.25 m" is the scale anchor everywhere.

Companion data: `reference/palette.json` (swatches + per-frame stats computed with the gauntlet's own `colorStats`).

---

## 0. Executive summary (what matters most)

1. **The image is olive/khaki, low-saturation and low-key**, not "lush green". Every hero frame has mean hue 47–51°,
   mean saturation 0.16–0.19, mean luminance 0.35–0.39 (64×36, sky masked — the rubric's W34 metric), **zero sky pixels**
   by the rubric's definition and zero over-exposed pixels. Sunlit grass reads `#60623c`, shaded grass `#434d1a`,
   flagstones `#a79774`/`#746d5d`, bark `#6c604a`/`#473e33`. A stock Three.js scene with hue-100° grass and a blue
   sky will fail W34 on hue by 40°+. This is the single biggest risk.
2. **Haze is warm grey, dense and starts early.** Mid-distance (10–20 m) haze `#696960`–`#7a796d`, far (30–60 m)
   `#8d8e85`, canopy gaps `#aca896`. Nothing is blue. Contrast at 16 m (the house) is already ~35 % lost; the log arch
   at ~30 m is ~60 % hazed. The current linear fog (near 28 / far 190, colour `#c5d1cf`) gives ~1 % haze at 30 m and is
   too blue/bright — switch to exponential/height haze (density ≈ 0.03 m⁻¹ equivalent) with colour ≈ `#95968b`.
3. **Sun.** Character shadows in four different camera headings triangulate to a fixed world sun ≈ **WSW (bearing
   245° ± 25°) in the footage's minimap compass, elevation ≈ 38° ± 8°**. In shot A the sun is therefore *ahead-right*
   of the camera and Link's shadow falls toward the viewer's lower-left. The god-ray shafts, however, always enter from
   the upper-left of the frame in every heading (SSW, SW, N, WNW, SE) — they are a screen-anchored effect, not the
   shadow light. The rubric pins azimuth to [−155°, −105°] (behind-left of shot A) so keep `-128°`; raise elevation to
   ~38°; build the shafts as a screen-space/anchored effect so they always come from the upper-left as in the reference.
4. **Layout topology.** Confirmed from the 8→13 s orbit and the minimap camera cone: from the plaza, the **main stairs
   and the tree-house are on nearly opposite sides (~150° apart)**, the log arch is ~85° anticlockwise of the stairs,
   and the lantern limb hangs between the stairs and the log path. `layout.ts` has stairs→log correct (−69°) but the
   house only −32° from the stairs (same side). Because rubric W04 pins the terrace heights to fixed coordinates, do
   **not** rotate the world — instead treat each viewpoint as its own composition (§2, §14 give concrete numbers) and
   fix scale: stairs rise ≈ 0.24 m per step (not 0.30), the lantern limb only 2.5–3 m up, house door ~11–12 m from Link, lantern pods in two colours.
5. **What makes it expensive** (§12): individually cut stones with bevels and moss joints, contact shadows, three-plane
   haze, leaf-level silhouettes against bright gaps, two-colour glowing pods with leaf caps, a sparkle-trailing fairy,
   falling leaves, and *restraint* — very little detail noise; big calm shapes with detail only at edges.

---

## 1. Shot list

Camera constants measured from Link (1.25 m): eye height **1.75–1.85 m**, distance to Link **4.2–5.2 m**, pitch
**3–6° down** in the normal follow camera. Vertical FOV is not directly measurable (scale ambiguity) — Link filling
0.35 of the frame height at 4.5–5 m gives **vFOV ≈ 40° ± 4° (hFOV ≈ 66–70° at 16:9)**; the layout's `fov: 46`
(hFOV 74°) is slightly wide but acceptable. Headings are from the minimap camera cone (north = up on the minimap).

| t (s) | Shot | Camera | Heading | Link | Project viewpoint |
| --- | --- | --- | --- | --- | --- |
| 0.0–7.0 | **A hold** | static, 5.2 m behind Link, h 1.8 m, pitch ≈ 5° down | SSW (≈202°) | idle, plaza centre, screen (0.50, 0.53–0.88), back to camera, slightly turned right; Navi at (0.455, 0.57) | **A_stairs (1 s)** |
| 7.0–13.0 | **Orbit** | player swings the camera clockwise ~160° around a stationary Link, dipping to ~4 m at 8 s | SSW→SW (8 s)→W (9 s)→WNW (10 s)→NW (11 s)→NNW (12 s)→N (13 s) | stationary; appears to rotate from back view to front view | **F_canopy (8 s)** = camera looking straight up the stair axis, eye level, canopy fills the top half |
| 13.0–24.9 | **B hold** | 4.3 m in front of Link, h 1.75 m, pitch ≈ 3° | N (≈0°) | idle, facing camera, (0.50, 0.57–0.91) | **B_house (14 s)**, **E_ground (24 s)** (same camera; E = lower 45 % of the frame) |
| 24.9–40.5 | **Pause menu** | — | — | Equipment tab. 25 s transition (oval empty) → Kokiri Tunic (25.5–31) → Deku Shield (~31.5–33) → Kokiri Sword (33–40.5) | **UI_inventory (34 s)** |
| 40.5–43.0 | B hold again | identical to 13–24 s | N | idle | — |
| 43.0–45.0 | Walk to house | pans left following Link; at 44 s the house is on the LEFT (door 0.28, 0.45), Link ~8 m away walking W; then Link turns 180° | N→NNW→N | walking | — |
| 45.0–47.5 | **C** | camera S/SW of Link, h ≈ 1.7 m, pitch ≈ 8° down, pans right and starts rising | WNW→NW | walks toward and past the camera heading S | **C_lookback (46 s)** |
| 47.5–51.5 | Top-down | rises to a 60–70° down view, h ≈ 6–7 m, follows Link | NW→(short cone) | walks S past the kid and the stair foot | — |
| 51.5–55.0 | Descend | drops back behind Link to eye level; stairs ahead-right, kid right, lime pod lantern right; strong shafts | S→SSW | standing at the stair-foot area (≈5 m W-SW of the plaza centre), then turns | 54 s ≈ shot A from 4 m further west |
| 55.0–58.5 | **D** | yaws left ~50°, follows Link at 4.5 m, h 1.8, pitch ≈ 4° | SSW→SE | turns and runs toward the log arch | **D_log (56 s)** |
| 58.5–60.4 | Under the arch | arch fills the top of the frame (58 s: x 0.25–0.75, y 0.25–0.45; 60 s: dark underside with 3 orange lanterns); exposure drops (lum 0.39→0.20); fade to black | SE | running under the log | — |

Scene-change detection (`select=gt(scene,0.25)`) fires only at 24.9 s (menu in) and 40.5 s (menu out); every other
transition is a continuous camera move. Shot D is not a cut from 54 s — it is a fast yaw + Link turning (44.7–45.3 s
whip verified at 30 fps).

---

## 2. Element inventory per hero frame (with `layout.ts` comparison)

### 2.1 Frame 1 s — A_stairs (heading SSW)

| Element | Screen (x, y), size | Notes / measurement |
| --- | --- | --- |
| **Main stairway** | bottom riser centre (0.69, 0.62), ends x 0.58–0.80; top landing (0.76, 0.25); 18 ± 1 steps | Bottom step ≈ 10.8 m from camera (5.8 m from Link); width 282 px at that depth → **2.7–2.8 m**. Top is 4–9° above the horizon (frame 1 vs frame 8 give 3.6 m vs 5.0 m) → **total rise ≈ 4.2 ± 0.7 m → 0.22–0.26 m per step**; run ≈ 7.5 m → **tread ≈ 0.42 m** (slope ≈ 30°, clearly shallower than the 0.30 m risers now in the layout). Treads are distinct slabs, lit `#746d5d`, rounded/chipped edges; risers in shadow `#453e32`; grass + moss in joints and along both edges. Ascent direction ≈ 12–23° right of the view axis (rises to the upper-right). |
| Stair flanks | left flank (0.52–0.62, 0.40–0.65); right flank (0.78–1.0, 0.35–0.60) | Grass embankments; the right one is ~0.45 m above the plaza and carries the Kokiri kid. Ferns + tall grass tufts on the left flank. |
| Fence posts + landing | (0.74–0.86, 0.14–0.25) | Thin pale posts with rails at the stair top; behind: haze, tree trunks, a hedge. |
| **Kokiri kid** | (0.86–0.91, 0.42–0.70) | ~1.15 m tall, dark-green sleeveless tunic, auburn hair, standing on the raised grass right of the stair foot, ~6 m from the camera (≈2.5 m right of Link, +0.45 m up). |
| **Lantern limb** | thick horizontal limb from (0.0, 0.31) to (0.33, 0.36); moss on top | Height ≈ 4–5 m, thickness ≈ 1.2–1.5 m, 10–15 m away. **Two orange pod lanterns** hang on ~1 m cords at (0.208, 0.395) and (0.255, 0.379). A rounded dark mass (giant trunk/stump) sits behind its right end at (0.20–0.40, 0.18–0.32). |
| Lantern post (near) | (0.04–0.10, 0.48–0.56) | Small leaning sapling/post with **one lime pod (0.056, 0.526) and one orange pod (0.08, 0.514)**, leaf caps. |
| Big lime lantern (right) | (0.915–0.94, 0.30–0.37) | A yellow-green bell pod with a green leaf cap, hanging from the right flank's vegetation above the kid; brightest emissive in the frame (`#b3a23e`). |
| **Navi** | (0.455, 0.57), ~0.03 tall | White-blue orb + 4 wings; a curved **sparkle trail** of ~15 golden dots (0.42–0.60, 0.53–0.60). |
| **Link** | (0.47–0.53, 0.53–0.88) | Back view, Deku Shield on back. Shadow toward the viewer's lower-left, length ≈ 1.2× his height projected. |
| **Plaza flagstones** | y 0.62–1.0 | Irregular polygonal slabs 0.6–1.4 m, warm grey-beige `#9e8b66` (far) / `#898060` (shaded), moss/grass in the joints, occasional fallen leaf. |
| Purple flowers | (0.0–0.14, 0.58–0.66) | Low clumps of small violet flowers along the left verge. |
| **Light shafts** | from (0.20–0.35, 0.0) to (0.40–0.55, 0.50), ~25° from vertical, leaning down-right | Broad, soft, 3–4 beams; core `#8f8b7c`. |
| Mist | (0.30–0.65, 0.30–0.60) | Ground mist pools at the stair foot and along the path; `#7a796d`. |
| Canopy | (0.0–1.0, 0.0–0.20) | Dark leaf masses with bright gaps `#aca896`; tall pale trunks at (0.55–0.70, 0.0–0.30). |
| HUD | hearts (0.045–0.10, 0.06–0.09); item slot (0.895–0.96, 0.03–0.17); minimap (0.79–0.97, 0.78–0.95) | See §11. |

**Versus `layout.ts` (viewpoint A: pos (0.4, 1.8, 8.6) → target (8.6, 3.0, −4.8), heading 31.5°, pitched 4.6° up).**
- Stairs `base [7.5,0,−1.5]` = 7.6 m from origin, appears at only +3.5° right (reference +12°) and the camera looks
  slightly *up* (reference 5° *down*). Keep the base and re-aim: **target (6.3, 0.5, −5.2)** (heading 23°, pitch 5° down).
  The bottom riser then projects to (0.64, 0.57) and, with `rise 0.24`, the stair top to ≈ (0.82, 0.22) — matching the
  reference (0.69, 0.62) / (0.76, 0.25). Link's Phase-2 spawn for this shot is on the camera axis 5.2 m ahead:
  **(2.4, 0, 3.8)** → projects to (0.49, 0.52–0.80).
- `rise: 0.3` → **0.24**, `tread: 0.42` ✓, `steps: 18` ✓, `width: 2.7` ✓. Stair top ≈ 4.3 m at ≈ (14.6, −4.0); let the
  heightfield ramp the remaining 1.1 m up to the pinned 5.4 m at (18, −4) (the reference shows exactly this: a landing,
  then more slope with fences and the upper house).
- Lantern branch `from [−10.5,5.8,−6.8] to [3.0,3.9,0.2]` is **too high and too short in frame**: its near end
  projects to y ≈ 0.11 and its midpoint to y ≈ 0.0 (off the top), so the W01 "≥ 60 % inside x 0–0.45, y 0.1–0.75"
  check is at risk. The reference limb sits at y 0.31–0.36 with its lanterns at y ≈ 0.38–0.40, i.e. **only ≈ 2.5–3 m
  above the ground** with the pods hanging at ≈ 1.5–1.9 m (child-scale world). Recommend
  **`from [−5.5, 4.0, −6.3] to [3.5, 2.6, −3.0]`**, radius 0.7 m, moss top, 2 orange pods on 1 m cords at 30 % and 55 %
  along it (project to ≈ (0.08, 0.38) and (0.25, 0.33)); 73 % of the limb is then inside the W01 region. Move the
  `lantern-tree` trunk to ≈ (−7.5, 2.0, −7.5) so the limb grows out of it. Add the small **lantern post** 3.2 m
  camera-left of Link's spot, **(−0.55, 0, 2.55)**: a short leaning post with a lime + an orange pod at ≈ 1.1 m (the
  pods sit just below the eye line, x ≈ 0.08, y ≈ 0.56; reference 0.06, 0.52).
- `npcSpots.kokiri-a [10.8,0.9,2.2]` → **[4.7, 0.45, 4.8]**: 2.5 m camera-right of Link's spot, on a +0.45 m grass
  verge (lands at +25° right, ≈ 6 m from the camera, exactly as in the reference — the kid is much *nearer* than the
  stair foot, which is why he swings across the stairs during the 8→9 s orbit). Two lime pods hang over this spot at
  ~2.6 m (frame 8).
- There is **no raised west ledge visible left of the plaza in A**; the left third is flat verge + flowers under the limb.
  The pinned west ledge (−11, 0) = 2.6 m is off-screen (−84°) — fine, but keep its slope gentle so it does not creep
  into the frame.

### 2.2 Frame 8 s — F_canopy (heading SW, straight up the stair axis)

| Element | Screen | Notes |
| --- | --- | --- |
| Stairway | foot (0.42, 0.60), top (0.42, 0.22), dead-on | Confirms the stairs' axis = SW; stair foot ≈ 7 m from Link. |
| Hedge/embankment wall right of stairs | (0.55–1.0, 0.15–0.45) | Mossy stone-and-earth wall ~2–2.5 m high with **fence posts along its top** (0.60–0.75, 0.14–0.17); this is the NW flank terrace. |
| Kid + two lime pods | kid (0.63–0.67, 0.42–0.62); pods (0.60, 0.36), (0.72, 0.38) | The pods hang from a small arbour over the kid's grass patch. |
| Upper house | (0.13–0.25, 0.13–0.20) | A second, smaller tree-house with a roof at the top-left of the stairs, ~25 m away, plus fences (0.45–0.55, 0.15) and a lamp post (0.45, 0.15). |
| Canopy / shafts | upper 45 % of the frame | Dense leaf masses at the top-left and top-right, bright gap top-centre (0.35–0.55, 0.0–0.10), 4 shafts leaning down-right from (0.15–0.35, 0). Sky fraction (blue) = 0. |
| Link | (0.45–0.55, 0.56–0.93) | Camera only ~3.8 m behind him. |

**Versus `layout.ts` viewpoint F (pos (0,1.7,4) → target (−6,14,−14), fov 55, pitched up 34°).** This does not match
frame 8, which is an *eye-level* shot along the stair axis with the canopy filling the top half (camera ≈ 1.7 m high,
pitch ≈ 3° down, 4.4 m behind Link, stair foot ≈ 11–13 m away). Recommend **F = position (−3.0, 1.7, 2.0), target
(8.3, 1.07, −2.0), fov 42** (on the plaza, looking along `stairs.main.dir`): the stair foot projects to ≈ (0.51, 0.63) and
the top (4.3 m) to ≈ (0.51, 0.25) — reference (0.42, 0.60) / (0.42, 0.22). Link's spot for this shot: (1.15, 0, 0.55).
W10's `skyFraction ≤ 0.45` is trivially met (reference = 0); what matters for W37 is the composition.

### 2.3 Frame 14 s — B_house (heading N)

| Element | Screen | Notes / measurement |
| --- | --- | --- |
| **Tree-house trunk** | (0.62–1.0+, 0.10–0.60) | Door ≈ 16 m from camera (≈ 11.5 m from Link). Trunk width ≈ 7 m (**radius ≈ 3.5 m**), base at y 0.58, dome top at y 0.10 → dome top ≈ 6.5–8 m above the terrace (keep **roofHeight 6.5**). Bark warm brown `#6c604a` lit / `#473e33` shade, deep vertical fissures, buttress roots. |
| Mossy dome roof | (0.66–1.0, 0.10–0.30) | Moss-green cap `#8b8948` with grass tufts and leaf clusters; reads like a giant cut stump overgrown. |
| Door | (0.775–0.84, 0.40–0.53) | Arched opening ~1.5 m × 1.1 m, dark interior with a **warm lamp** at (0.782, 0.405) `#b7895d`; a Kokiri figure stands beside it at (0.86, 0.47–0.53). |
| Big limb | from the trunk at (0.62–0.72, 0.15–0.30) leaning left | A near-horizontal branch with leaf clusters; **3 pod lanterns hang from vines** under it: lime (0.736, 0.293), orange (0.763, 0.321), lime (0.794, 0.309), each ~0.35 m with a green leaf cap. |
| **Signpost** | plank (0.565–0.60, 0.44–0.49), post base (0.585, 0.56) | ~12 m from camera; plank ≈ 0.5 × 0.4 m, warm tan wood `#a9834c` with two rows of rune-like carvings; total height ≈ 1.1 m. Stands on the path just left of the house front. |
| **Navi** | (0.565, 0.585) | Right of Link's head. |
| **Link** | (0.47–0.53, 0.57–0.91) | Facing camera; see §10. |
| **Kokiri kid** | (0.0–0.06, 0.30–0.75) | Left edge, ~3.7 m from the camera, 1.8 m W / 1.3 m S of Link. |
| North path + terrace | path (0.30–0.60, 0.45–0.60) receding; small stone steps (0.20–0.25, 0.33–0.40); mossy boulder terrace (0.18–0.45, 0.28–0.45) | Path climbs gently N-NW to a mossy boulder terrace ~18–20 m away with 4–5 small steps and a lime pod on it (0.235, 0.33). |
| House terrace ramp | (0.72–0.88, 0.58–0.70) | 3–4 flat stones stepping up ~0.5–0.8 m to the door threshold. |
| Grass patches | (0.18–0.30, 0.60–0.68), (0.56–0.68, 0.58–0.66), (0.0–0.20, 0.70–0.80) | Olive tufts `#60623c` lit, `#434d1a` shade, 0.15–0.35 m tall, between stones. |
| Fern / broadleaf clumps | (0.90–1.0, 0.55–0.75), (0.30–0.42, 0.50–0.58) | Large-leaf plants + a purple flower clump at the right edge (0.95, 0.60). |
| Giant trees / canopy | trunk left (0.0–0.10, 0.0–0.40), trunk centre-left (0.28–0.36, 0.0–0.25); canopy across the top 20 % | Pale hazed trunks 20–40 m away `#707167`. |
| Shafts | faint, from (0.10–0.25, 0.0) leaning down-right | Much weaker than in A. |

**Versus `layout.ts`.** House `[12.5,1.2,−11.5]`, radius 3.2, roof 6.5, 3 lanterns: door ends up ≈ 19.6 m from the
layout's camera B (reference 16 m). Suggested: `trunkRadius 3.5`, keep `roofHeight 6.5` (dome top reads 6.5–8 m above
the terrace), `lanterns 3` (2 lime + 1 orange) hanging from the limb on vines, plus the **door lamp**. Move the signpost
from `[7.6,1.2,−9.6]` to **`[5.5, 1.0, −9.8]`** so it sits just right of centre like the reference. The reference camera
here is lower and farther than in A: Link 0.34 of the frame tall with his head at y 0.57 → **camera ≈ 1.55 m high,
≈ 5.3 m in front of Link, pitch ≈ 0°**. Viewpoint B → **position (−1.6, 1.55, 5.6), target (4.6, 1.6, −12.0), fov 46**:
door → (0.73, 0.48), dome top → (0.74, 0.21), signpost → (0.56, 0.50), Link → (0.48, 0.57–0.85), north steps → (0.28,
0.58) — all within 0.05 of the reference. `kokiri-b [−6.5,0.1,−2]` → **[−2.6, 0, 1.6]** so the kid is cut by the left
edge (x ≈ 0.05) about 4 m from camera B.

### 2.4 Frame 24 s — E_ground (same camera as B)

Everything in §2.3 applies. Ground detail used for materials:
- Flagstones 0.6–1.6 m across, 5–7-sided, **bevelled edges 3–6 cm**, height jitter ≤ 4 cm; lit face `#a79774`, mid
  `#958663`, joints of dark soil `#575026` 3–8 cm wide with moss and 5–15 cm grass sprouts every ~0.5 m of joint.
- Verge: grass 0.15–0.35 m, olive; occasional broadleaf weeds; leaf litter sparse (1 leaf per ~0.5 m²) — the reference is
  *tidy*, not littered.
- Link's shadow is crisp at 4.3 m with a soft 5–8 cm penumbra; contact darkening under his boots.

### 2.5 Frame 46 s — C_lookback (heading WNW, camera S of Link)

| Element | Screen | Notes |
| --- | --- | --- |
| **Main stairs** | foot (0.10–0.20, 0.60–0.66), rising to the upper-left off-frame at (0.0, 0.30) | ~7–8 m away; we see their right flank and the treads' ends; ~8 steps visible. |
| Stair embankment / hedge | (0.0–0.35, 0.15–0.40) | Dark mossy bank with shrubs above the stairs. |
| **Kokiri kid** | (0.34–0.38, 0.47–0.63) | On the grass between stairs and Link, ~7 m away. |
| Lime pod lantern | (0.195, 0.38) | Hanging from foliage at the stair flank (the same pod as A's big right lantern). |
| Orange lantern (far) | (0.405, 0.405) | Tiny, on a post near the path. |
| Mossy boulder | (0.22–0.33, 0.55–0.63) | ~1.2 m, layered rock, moss on top. |
| Giant tree | trunk (0.50–0.62, 0.0–0.35), canopy top | ~25–30 m away, heavily hazed (`#696960` region), spreading limbs. |
| Boulder terrace (right) | (0.75–1.0, 0.35–0.55) | Raised mossy bank with a stone stair fragment (0.98, 0.55). |
| Path | from Link toward (0.65–0.80, 0.55–0.65) | Flagstones continue right-back (N-NE) toward the house. |
| **Link** | (0.46–0.54, 0.55–0.91) | Walking toward camera; Navi (0.565, 0.565). |
| Falling leaves | (0.45, 0.55), (0.62, 0.62) | 2–4 visible at any time. |

**Versus `layout.ts` viewpoint C (pos (3.2,1.8,−9.5) → (3.9,2.5,3.5), heading 177°).** The layout's stairs land at
−25° (left) at ~9 m — correct side, correct-ish distance. Recommend **position (3.6, 1.7, −8.5), target (3.0, 0.5, 5),
fov 46** (pitch ≈ 5° down): the stair foot projects to (0.10, 0.68) (reference 0.10–0.20, 0.60–0.66), Link 4.3 m ahead at
(3.35, 0, −4.3) → (0.51, 0.52–0.86), `kokiri-a` (4.7, 4.8) → (0.42, 0.49) at 13 m (reference 0.36, 0.55 at 7 m — the NPC
wanders; fine). Move the hero boulder `stair-foot [9.5,0.2,1.6]` → **[5.9, 0.1, −3.0]**, radius 0.7 (north verge of the
stairs path, projects to ≈ (0.27, 0.62)). The far centre is closed by `south-giant` (12, 0, 22) at x ≈ 0.30 and
`south-centre` (−4.5, 0, 27) at x ≈ 0.62, 31–36 m away in haze — good; give one of them the spreading limbs of the
reference's centre tree. Add a raised mossy bank with shrubs on the right (the layout's `houseTerrace` edge at
x ≈ 6–9, z ≈ −8…−12 serves) and hedge/shrubs above the stairs on the left.

### 2.6 Frame 56 s — D_log (heading SE, camera behind Link)

| Element | Screen | Notes |
| --- | --- | --- |
| **Log arch** | (0.40–0.62, 0.27–0.42); opening centre (0.51, 0.37) | ~30 m from Link (58 s: fills x 0.25–0.75 at ~15 m → **outer radius ≈ 4 m**, opening ≈ 5.5 m wide × 4 m high). Massive fallen hollow trunk lying across the path, bark ridges, moss + ferns on top, heavily hazed (`#646055`). **Orange lanterns** on it at (0.615, 0.335) and (0.45, 0.445); at 60 s three orange pods hang under it. |
| Main stairs | right edge (0.85–1.0, 0.55–0.78), ~6 steps visible | Same stairway as A, now at +25–30° right — confirms stairs ≈ 55° clockwise of the log direction. |
| Mossy boulder | (0.10–0.22, 0.66–0.75) | Layered rock 1.0 m, moss cap `#70683b`. |
| **Purple flowers** | (0.17–0.27, 0.60–0.67), (0.05–0.12, 0.55–0.60) | Desaturated violet `#4f3558` (s 0.25, l 0.28). Only 0.02 % of the frame passes the rubric's purple test — see §13. |
| Ferns / broadleaf | (0.05–0.14, 0.55–0.68) | Fronds `#69692e`. |
| Ground mist | (0.28–0.65, 0.40–0.55) | Warm grey pool `#7a796d` in the hollow before the arch. |
| Far trees | (0.10–0.35, 0.10–0.45) | Pale trunks `#707167` in haze `#8d8e85`; at least 3 depth planes read. |
| Canopy / limb | (0.80–1.0, 0.0–0.30) | A big dark limb + leaves top-right. |
| Shafts | (0.15–0.40, 0.0–0.50), leaning down-right | |
| Falling leaves | (0.33, 0.08), (0.46, 0.22), (0.74, 0.24), (0.68, 0.68), (0.90, 0.27) | 5+ large leaves, 0.2–0.4 m, tumbling. |
| **Link** | (0.46–0.54, 0.55–0.90) | Running away; shadow toward the lower-left; Navi ahead at (0.435, 0.55). |

**Versus `layout.ts`.** Log arch `[6,1.8,−34]`, radius 3.6, yaw 15: distance is fine (reference ~30 m from Link's D
position); set **radius 4.0**, `lanterns 3` (orange). Viewpoint D `(1.2,1.9,−1.0) → (5.5,3.2,−40)` looks up (+2°) and
cannot show the stairs. In the reference the camera is NW of the stair foot with the foot only ~8 m away at +25–30°
right, the log dead ahead, pitch ≈ 6° down. With the layout's stairs at bearing 79° (from the origin) and the log at
10°, the camera position that reproduces this is on the plaza's south edge: **position (3.5, 1.85, 5.4), target
(6, −2, −34), fov 46** (heading 4°, pitch 5.7° down): log-arch opening → (0.50, 0.34) (reference 0.51, 0.37), stair
bottom riser → (0.82, 0.69) with the flight running off the right edge (reference 0.87, 0.72 → off-frame), Link 4.5 m
ahead at (3.8, 0, 0.9) → (0.50, 0.54–0.85). Move `heroBoulders.shot-d-boulder [−3.6,0,−11]` → **[−0.8, 0, −2.5]** r 0.8
(west verge of the north path → ≈ (0.08, 0.60); reference 0.16, 0.70) with a purple-flower bed + ferns around
(−1.5…0.5, −1.5…−4.5). Ground mist in the hollow z −8…−25 along the spine.

### 2.7 Frame 34 s — UI_inventory: see §11.

---

## 3. World scale & terrain composition

Plaza: an irregular flagstone apron ≈ **12 m (E–W) × 9 m (N–S)** around Link's idle spot; paths leave it toward the
stairs (SW in footage), the house (N-NNE), the north terrace (NNW) and the log hollow (SE). Path width **2.2–3.0 m**
(stone core ~2 m + soft verge); stair width 2.7 m.

Terraces (footage): stair-foot verge +0.45 m (kid); house threshold +0.5–0.8 m; stair-flank wall +2–2.5 m with fences on
top; stair top +4.2 ± 0.7 m, continuing up to the upper house (+5–6 m est.); log hollow −0.5…−1.0 m (path descends into
mist). Layout pins (W04) are 5.4 / 2.6 / 1.2 / 0 — keep them; the shallow stair + a ramp reconciles the 5.4 m.

Depth layering (the reference always reads in ≥ 4 planes):
1. **Foreground 0–6 m**: flagstones with bevels, Link, verge grass/flowers, ferns, boulder — full contrast, crisp shadows.
2. **Midground 6–20 m**: stairs, kid, signpost, house, lantern limb — 15–35 % haze, shadows soft.
3. **Background 20–45 m**: log arch, giant trunks, terrace hedges — 50–70 % haze, silhouettes with a little bark detail.
4. **Far 45 m+**: tree-trunk silhouettes in `#8d8e85`, no detail; canopy gaps glow `#aca896`.
Horizon is never visible: at eye level the view is closed by trunks/hedges at 25–60 m; canopy occupies the top 15–25 %.

Distances from Link's plaza spot: stair foot 5.8–7 m; kid 2.5–7 m (wanders); house door 11–12 m; signpost 9–10 m;
north terrace steps 18–20 m; giant tree in C 25–30 m; log arch ≈ 30 m; lantern limb 8–14 m (overhead).

---

## 4. Trees

- **Giant Kokiri trees** (the house trunk and 4–6 others visible): trunk radius **1.5–3.5 m**, flared **buttress roots**
  spreading 4–6 m, deeply fissured warm-brown bark (`#6c604a` lit, `#473e33` shade, `#766750` on limbs), 1–3 huge
  near-horizontal **limbs** at 4–8 m (the lantern limb, the house limb, the C-frame giant's spreading limbs), moss caps on
  every upward-facing surface. Crowns are broad, flat-topped domes 14–24 m up; individual leaf clusters (~1 m) are
  visible against the bright gaps.
- **Tall pale trunks** (mid/background): straight, slender (r 0.3–0.6 m), 15–25 m tall, hazed to `#707167`; branching
  starts high (8–10 m). These are where **Verdant Forest's white-bark trees** fit: keep them **beyond 15 m**, so the
  white reads as pale warm grey through haze (`#b9b3a4` at 15 m → `#8d8e85` at 40 m), never bright white. Up close the
  reference has no white bark — near trunks are brown/grey-green with moss. Give them dark scars and a slight lean.
- **Distant layers**: 2–3 rows of silhouettes at 40–80 m, tone `#8d8e85`→`#9a9b90`, each row ~10 % lighter; trunks
  only, crowns merge into the canopy mass.
- **Canopy**: dark olive-brown from below (`#5f4b40`, `#4c5537`), backlit leaf edges `#c9c8af`; leaf silhouettes are
  crisp against gaps — no soft blobs. Canopy base height ≈ 10–12 m over the plaza.
- Species look: an oak/beech hybrid — lobed 10–15 cm leaves, gnarled limbs; the house trunk is stump-like with a mossy
  cut top.

---

## 5. Vegetation

- **Grass**: tufted, blades 0.15–0.35 m (0.5 m in verges), olive **`#60623c` lit → `#3f4521` mid → `#434d1a` shade**;
  ≥ 3 tints (yellow-olive, olive, blue-olive); clustered in patches between stones and thick on embankments; never on
  stone tops. Height CV ≈ 0.3.
- **Ferns**: 0.4–0.8 m, 6–10 fronds, `#69692e`, at stair flanks, boulder bases, tree roots; ~1 clump per 3 m² in verges.
- **Broadleaf weeds / hostas**: 0.3–0.5 m paddle leaves near the house and the D boulder.
- **Purple flowers**: 5–15 cm violet blooms in low clumps (0.3–0.6 m wide) along path verges (A left verge, B right edge,
  D left foreground, top-down frames 49–52 s). Colour in footage `#4f3558`–`#54374c` (desaturated by haze); use a more
  saturated albedo (`#7a4f8c`) so they read purple after fog.
- **Bushes/shrubs**: 0.8–1.5 m rounded leafy shrubs on terrace edges and hedge tops; `#4c5537`.
- **Moss**: on every stone edge, stair nosing, boulder top, root, roof and the log; `#8b8948` bright → `#5a523b` deep.
  Moss is a *material blend*, not geometry blobs.
- **Litter**: sparse — a few large fallen leaves (`#8b7b5a`) on stones, twigs in joints. The reference **avoids noise**:
  large calm areas (stone tops, mist, hazed trunks) alternate with detail bands (joints, edges, verges). Detail is
  concentrated where surfaces meet.

---

## 6. Ground materials

- **Flagstone**: polygonal slabs 0.6–1.6 m, 5–7 sides, 8–12 cm thick with a 3–6 cm bevel and rounded corners; colour
  `#a79774` (lit), `#958663` (mid), `#746d5d`/`#898060` (shade), with subtle warm/cool mottling and a light 1–3 cm
  pitting normal. Tops slightly domed; height jitter ≤ 4 cm; ~3 % of stones cracked in two.
- **Joints**: 3–8 cm, dark soil `#575026`, moss `#5a523b`, grass sprouts every 0.3–0.6 m of joint, small pebbles.
- **Soil/earth**: `#575026`–`#3d3820`, fine roughness, damp look (low spec, slight dark).
- **Transitions**: stone → 10–30 cm moss/soil halo → grass. Worn stone tops are lighter (foot traffic), edges darker/mossier.
- **Stairs**: same stone but longer slabs (0.9–1.4 m each, 2–3 per tread), treads dished 1–2 cm, nosings chipped.
- Wet-look: none (dry, matte). Specular is very low everywhere except the fairy, lanterns and Link's eyes.

---

## 7. Lighting

- **Sun (shadow-casting light)**: from Link's shadow in four headings (1 s SSW → shadow lower-left; 24 s N → shadow
  right; 46 s WNW → shadow lower-right; 56 s SE → shadow left): shadow bearings ≈ 67°, ~105°, 67°, ~35° → sun bearing
  **≈ 245° ± 25° (WSW) in the minimap compass**, i.e. ~45° right of camera A's heading, ~20° right of the stair axis, and
  roughly opposite the house. Shadow length ≈ 1.0–1.6× Link's height → **elevation ≈ 38° ± 8°**.
  Mapped into the layout's compass (stairs at 79°): sun bearing ≈ 80–100° → `azimuthDeg ≈ +95…+115` in
  `config.ts` convention. **The rubric (W30) pins azimuth to [−155, −105]** and elevation to [24, 44]; keep
  **`azimuthDeg: -128`, set `elevationDeg: 38`**, and document the discrepancy. Visual reviewers will see the reference
  shadow falling lower-left vs ours lower-right; nothing in the rubric can be satisfied both ways.
- **Shadows**: crisp at contact (penumbra 5–8 cm at 4 m), softening to ~20 cm at 15 m; PCF soft shadows with a
  4096 map and `radius ≈ 2–3` at these ranges; a second, blurrier cascade for 15–60 m.
- **Colour temperature**: sun warm (`#fff1d6` is fine, or `#ffe9c4`); fill/ambient is warm grey-olive from the canopy
  and haze — **hemisphere sky `#c9c8b4`, ground `#4a4a30`**, not blue. Nothing in the reference is blue.
- **Exposure/contrast**: mean lum 0.35–0.39, 0 % clipped, brightest diffuse surface (gap glare) `#aca896` (l 0.63),
  fairy core `#d7dcd5` (l 0.85). Low-key, low-contrast, filmic roll-off — use ACES/AgX with exposure tuned so lit
  flagstone ≈ l 0.55 and shaded grass ≈ l 0.20. Bloom must be tiny (only pods/fairy).
- **Bounce**: the plaza bounces warm light onto Link's underside and stone risers; the canopy underside is lit from
  below (brownish `#5f4b40`) — an upward-tinted hemisphere or a weak second directional from below-front helps.
- **God-ray geometry**: 3–5 broad beams entering at the frame's upper-left, ~20–25° from vertical, converging toward the
  lower-right, widths 0.05–0.12 of the frame, intensity peaking near the top and dissolving by y ≈ 0.55; they are
  present with the same screen geometry in every heading → implement as a **screen-anchored radial-blur/light-shaft
  pass from a fixed "sun" screen position ≈ (0.20, −0.25)**, occluded by canopy depth, or as anchored geometric beams
  parented to the camera with canopy-mask fading. Beam colour `#8f8b7c` over `#696960` haze — a subtle +0.10 lum lift.

---

## 8. Atmosphere

- **Haze by depth** (measured): 5 m none; 10–16 m 20–35 % blend to `#7a796d`; 25–30 m 55–65 % to `#696960`→`#8d8e85`;
  40–60 m 80–90 % to `#8d8e85`; gaps to canopy `#aca896`. Haze **brightens** with distance (from `#69…` to `#8d…`) because
  far light comes through more gaps — a fog colour that is a single flat value will look wrong; use a depth-graded
  colour (dark warm grey near → light warm grey far) or a two-colour fog.
- Equivalent exponential density ≈ **0.028–0.035 m⁻¹**. Keep the audit value `fogFar ≥ 150` (W32) as the "visibility
  distance", but the *visible* effect must be exponential/height-based: linear 28/190 gives 1 % at 30 m — far too little.
- **Ground mist**: warm grey `#7a796d`, 0.5–2 m thick, in the stair-foot hollow (A: 0.30–0.65 × 0.30–0.60), the north
  hollow before the log arch (D: 0.28–0.65 × 0.40–0.55) and drifting across the path in C. Slight animated drift.
- **Sky**: never blue; canopy gaps are warm off-white `#aca896`–`#c9c8af` (sky mask hits 0 px). Set sky/hemi colours to
  warm pale grey (`#cfd3c8` zenith, `#e2dfd0` horizon).
- **Particles**: (a) falling leaves — 2–6 in frame, 0.2–0.4 m, tumbling slowly, dark olive/brown; (b) fireflies/motes —
  small warm dots, ~10–20 in frame, drifting near lanterns and grass; (c) the fairy's sparkle trail — 12–18 golden dots
  along a curved path, fading over ~1 s; (d) pollen-like bright specks inside the shafts.

---

## 9. Palette

Computed values are in `reference/palette.json`. Key swatches (mean of the region; frame + normalised region there):

| Name | Hex | Where |
| --- | --- | --- |
| grass_sunlit | `#60623c` | f_014 grass patch right of Link (green-filtered) |
| grass_lit_verge | `#65653a` | f_054 stair-foot embankment |
| grass_mid | `#3f4521` | f_024 left verge |
| grass_shaded | `#434d1a` | f_014 lower-left |
| moss_roof_bright | `#8b8948` | f_014 house dome |
| moss_bank_deep | `#5a523b` | f_046 boulder bank |
| moss_boulder_top | `#70683b` | f_056 |
| fern_frond | `#69692e` | f_056 |
| purple_flower | `#54374c` / `#4f3558` | f_052 / f_056 |
| canopy_dark | `#5f4b40` | f_014 top-left |
| canopy_leaf_backlit | `#c9c8af` | f_008 |
| flagstone_lit / mid / shaded | `#a79774` / `#958663` / `#898060` | f_024 / f_001 |
| soil_joint | `#575026` | f_024 |
| stair_tread_lit / riser_shade | `#746d5d` / `#453e32` | f_001 |
| bark_house_lit / shade / limb | `#6c604a` / `#473e33` / `#766750` | f_014 |
| signpost_wood | `#a9834c` | f_014 |
| distant_trunk_haze / log_arch_haze | `#707167` / `#646055` | f_056 |
| haze_mid / haze_far / ground_mist | `#696960` / `#8d8e85` / `#7a796d` | f_046 / f_056 |
| sky_gap_glare / shaft_glow | `#aca896` / `#8f8b7c` | f_008 / f_001 |
| lantern_lime_glow / lantern_orange_glow | `#b3a23e` (`#b9ab49`) / `#ca8c3b` | f_001 / f_014 |
| door_lamp_glow | `#b7895d` | f_014 |
| fairy_core | `#d7dcd5` | f_001 |
| link_tunic / hat / hair / skin / belt / boots | `#50542f` / `#828450` / `#865f2e` / `#87613e` / `#433825` / `#624d33` | f_024 |
| kokiri_tunic / hair | `#1e2012` / `#60402c` | f_014 |
| hud_heart_red / minimap_parchment | `#c24030` / `#b29f64` | f_001 / f_014 |
| ui_panel_dark / frame_carved / slot_gold / text | `#171108` / `#755b33` / `#694c18` / `#e8e1cc` | f_034 |

Per-hero-frame stats (rubric metric: 64×36 downscale, sky masked; sky/purple/over on 256×144):

| Frame | meanHue | meanSat | meanLum | sky | purple | over | Laplacian var (256×144) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs (1 s) | 49.1° | 0.157 | 0.392 | 0 | 0 | 0 | 0.01205 |
| B_house (14 s) | 48.7° | 0.192 | 0.359 | 0 | 0.0007 | 0 | 0.01151 |
| C_lookback (46 s) | 47.8° | 0.170 | 0.353 | 0 | 0 | 0 | 0.00897 |
| D_log (56 s) | 50.4° | 0.157 | 0.394 | 0 | 0.0002 | 0 | 0.00891 |
| E_ground (24 s) | 51.2° | 0.183 | 0.354 | 0 | 0 | 0 | 0.01230 |
| F_canopy (8 s) | 49.6° | 0.163 | 0.368 | 0 | 0 | 0 | 0.01022 |
| UI_inventory (34 s) | 45.5° | 0.366 | 0.131 | 0.001 | 0 | 0 | 0.02123 |

W34 windows therefore: hue **35–63°**, sat **0.06–0.29**, lum **0.23–0.51**. Gameplay frames drift only ±2° hue / ±0.03
sat / ±0.03 lum across the whole clip (see `timeline` in palette.json) — the look is extremely consistent.

**`config.ts` palette corrections** (albedo suggestions ≈ observed lit colour × 1.2–1.4, since materials are shaded):
`grassLight 0x9fb864 → 0x8a8c55`, `grassMid 0x6f9a42 → 0x5c6233`, `grassDeep 0x3f6a2c → 0x3a4420`,
`mossBright 0x86a94c → 0x8b8948`, `mossDeep 0x4e7332 → 0x5a523b`, `soil 0x6b5a3e → 0x5e5530`, `soilDark → 0x3d3820`,
`flagstone 0xa89f88 → 0xa79774`, `flagstoneDark 0x7f7766 → 0x746d5d`, `barkWhite 0xd8d4c6 → 0xb9b3a4`,
`barkGrey 0x8f8b80 → 0x7a7468`, `barkDark 0x4d443a → 0x473e33`, `leafCanopy 0x5c8a3a → 0x4c5537`,
`leafSun 0xa6c95a → 0x8b8948`, `lanternGlow 0xffb13b → keep for orange; add lanternLime 0xd8cc4a`,
`fairyGlow 0xdfffff → 0xe6ecf0`, `fernGreen 0x4f7f3a → 0x69692e`, `flowerPurple 0x8a5bb5 → 0x7a4f8c`.
Fog `0xc5d1cf → 0x95968b` (near) grading to `0xa3a399` far; sky `zenith 0xa9c4d6 → 0xcfd3c8`, `horizon → 0xe2dfd0`,
`hemiSky 0xb9cfd9 → 0xc9c8b4`, `hemiGround 0x5a6a3f → 0x4a4a30`.

---

## 10. Character notes (Phase 2)

**Young Link** (1.25 m; head ≈ 0.30 m → ~4.2 heads tall, big head, short legs). Green tunic `#50542f` (hue 66°, low
sat) with a soft collar and a pale undershirt at the neck; brown leather belt `#433825` with a round buckle and two
diagonal chest straps (sword + shield); the tunic skirt ends mid-thigh with a ragged hem; bare legs; brown boots
`#624d33` with folded tan cuffs, laces and a small buckle. Long green cap `#828450` (lighter than the tunic) folded
back over the left shoulder; hair `#865f2e` golden with a swept fringe; skin `#87613e` (warm, hazed); large blue eyes,
pointed ears ~8 cm long. Deku Shield on the back: rounded wooden shield 0.45 m, orange-red swirl. Kokiri Sword in a
brown scabbard, hilt above the right shoulder. Gait: brisk walk/run with a bob; idle sways; head tracks the fairy.

**Kokiri kids** (~1.15 m): darker, near-black green sleeveless tunic `#1e2012` with a rope belt, dark boots to the
knee, auburn hair `#60402c` in a bob, green headband; they idle-turn and wander 2–5 m. Two visible: one at the stair
foot, one by the house door.

**Navi**: 15 cm white-blue orb (`#d7dcd5` core, cyan halo) with 4 translucent dragonfly wings, bobbing ±0.1 m at
~1 Hz around Link's head height, leading him when he runs; golden sparkle trail of 12–18 dots with ~1 s life.

---

## 11. UI notes (Phase 3)

**HUD** (all gameplay frames): 3 red hearts (`#c24030`, dark outline, ~26 px each) at (0.045–0.10, 0.06–0.09); item
slot top-right at (0.895–0.96, 0.03–0.17): dark rounded square with a diagonal Deku Stick illustration, count "4" at its
lower-right and a small "ZR" tag below (0.92, 0.155), with a tiny "R" button glyph above; **minimap** bottom-right
(0.79–0.97, 0.78–0.95): hand-drawn parchment map of Kokiri Forest (`#b29f64` paper, olive `#8a8a3a` ground blobs, dark
`#3f4a2a` tree circles, brown ink outlines), a red arrow marker for Link and a translucent yellow camera cone.

**Equipment screen (34 s)**: full-screen very dark warm panel `#171108`; top bar y 0.0–0.08 with tabs "Collection ·
Equipment · Items · System" (white sans, ~24 px) centred at x 0.32/0.44/0.56/0.68, the active tab on a lighter
brown plate `#4c3a26`, L/R button glyphs at x 0.24 and 0.76; 3 hearts top-left; green rupee gem + "16/200" top-right
(0.90–0.98). Below the bar an ornate carved-wood scroll frame `#755b33` with gold highlights (y 0.05–0.15, scrolls at
the corners). Left: a **hex grid** of 3 columns × 4 rows of empty dark hexagons (0.04–0.25, 0.33–0.95), arrows "<" ">"
at (0.015, 0.56) and (0.985, 0.56). Centre: a vertical **oval vignette** (0.27–0.68, 0.13–0.95), grey-brown gradient,
containing a full-body 3D render of Link holding the selected item; item name "Kokiri Sword" (white serif, ~34 px) at
y 0.745 with a thin ornamental divider; two-line description (serif, ~20 px) at y 0.82–0.87. Right: 3 × 3 hex slots
(0.70–0.97, 0.20–0.92); filled slots are gold-olive hexagons `#694c18` with item art (sword, Deku Shield, tunic), the
selected one framed white/gold with a glow. Bottom-right hints "Rotate (R-stick) · Set (A) · Back (B)" white at y 0.975.
Fonts: humanist sans for tabs/hints, a light serif for item name/description. Text colour `#e8e1cc`.

---

## 12. "Why it looks expensive" — prioritised, with the Three.js technique

1. **Individually cut flagstones with bevels and soft moss joints** → per-stone extruded polygons (BufferGeometry
   merge, ≥ 24 shapes), vertex-AO baked into joints, moss/soil decal blend via a joint mask.
2. **Contact shadows everywhere** (boots, stones, roots, boulders, house base) → SSAO/GTAO pass + baked AO in vertex
   colours + a small blob-shadow decal under dynamic things.
3. **Layered warm haze that brightens with depth** → custom fog in a shared shader chunk (exp density 0.03, colour
   graded near→far) + height-fog mist volumes (billboards/planes with soft depth fade).
4. **Leaf-level canopy silhouettes against bright gaps** → leaf laminae cards with alpha-tested lobed textures, in
   asymmetric clusters, over a bright warm-grey sky dome; no smooth spheres.
5. **Two-colour glowing pod lanterns with leaf caps, on cords** → emissive pod meshes (lime `#d8cc4a`, orange
   `#f0a040`) + small PointLights (range 4–6 m) on the bark + subtle bloom threshold only above 1.0.
6. **Giant trunks with buttress roots entering the ground** → root splines swept into the terrain with a blended
   moss/soil skirt; the trunk's base widened 1.4×.
7. **Moss as a material response, not a blob** → triplanar moss blend weighted by up-normal + curvature/AO mask on
   stones, roofs, logs and roots.
8. **Stair treads as separate worn slabs with dark risers** → 2–3 slabs per tread, dished tops, nosing chips (noise
   displacement), riser AO.
9. **Grass in tufts with 3 tints and clustering** → instanced blade clusters with per-instance hue/height jitter and
   a density noise; wind by vertex shader with 3 frequency layers.
10. **God rays anchored upper-left, soft and directional** → screen-space radial light-shaft pass from a fixed screen
    anchor, masked by canopy depth; intensity capped (+0.1 lum).
11. **Fairy with a sparkle trail** → emissive sprite + 4 wing cards + a trailing point particle system with lifetime fade.
12. **Falling leaves and drifting motes** → instanced quads with tumble (rotation about two axes) and a slow sine sway;
    motes as additive points near lanterns.
13. **Dense but tidy vegetation edges** → detail only in the 0.3–1 m band where surfaces meet (joints, stair edges,
    tree bases); large surfaces stay calm.
14. **Filmic, low-key tonemapping with zero clipping** → ACES/AgX, exposure ≈ 0.85–0.9, no full-frame bloom, slight
    warm grade; keep overexposed pixels ≤ 0.1 %.
15. **Consistent, believable scale** → Link 1.25 m, doors 1.5 m, stones 0.6–1.6 m, steps 0.2 × 0.42 m, camera 1.8 m —
    every object relates to the character.

---

## 13. Risks / traps and how the rubric measures them

| Trap | Why it bites | Rubric |
| --- | --- | --- |
| Green grass / blue sky | mean hue must be within 14° of ~49° (olive); a hue-100° meadow fails by 50°; blue gaps also shift hue | W34 |
| Too bright / too saturated | ref sat 0.16–0.19, lum 0.35–0.39; default PBR + sun 4.6 will overshoot lum and sat | W34, W35 (over-exposure ≤ 1 %) |
| Linear fog 28/190 | almost no haze at 30 m; the D shot must read 3 planes | W32 (`farLayerCount ≥ 3`), W37 SSIM |
| Purple test | reference flowers are so desaturated they *fail* the rubric's own purple test (0.02 % vs 0.3 %); use saturated `#7a4f8c` blooms and enough area (~110 px at 256×144 in D) | W18 |
| Stairs too steep | 0.30 m risers make the A shot read as a ladder; use 0.24 m + a ramp to the pinned 5.4 m | W02, W04, W01 projection |
| Sun azimuth | rubric pins −155…−105 (behind-left); reference shadows say ahead-right; keep the pinned value, expect a visual-criterion note | W30 |
| Shafts washing the frame | reference beams lift lum by ~0.1 locally only | W31, W35 |
| Sky fraction | reference = 0; if you render blue sky through gaps it's masked from the mean but still hurts SSIM/pHash | W10, W37 |
| Placeholder look | identical slabs, spherical canopies, box stairs are explicitly audited | W02, W03, W11, W25, W29 |
| Floating props | 3 cm contact tolerance | W12, W36 |
| Sharpness | ours must reach ≥ 0.8× the ref Laplacian variance (0.009–0.012 at 256×144): no DOF/bloom blur, crisp leaf alpha, 1.5× pixel ratio | W35 |
| Viewpoint F | layout F looks 34° up; the reference F (8 s) is eye level along the stair axis | W37 for F |
| Determinism | falling leaves / fairy / wind must be seeded from a frozen clock during capture | W41 |

---

## 14. Concrete corrections to apply (summary)

All screen positions quoted here were verified by projecting the proposed coordinates with a pinhole model
(fov = vertical, aspect 1280/716) — see the per-shot notes in §2.

`layout.ts`
- `stairs.main`: keep `base [7.5, 0, −1.5]`, `dir [1, −0.35]`, `steps 18`, `width 2.7`, `tread 0.42`; **`rise 0.3 → 0.24`**
  (top ≈ 4.3 m at ≈ (14.6, −4.0)); heightfield ramps the remaining 1.1 m to the pinned 5.4 m at (18, −4). Add fence
  lines at the stair top and along the NW-flank wall; keep the small **upper house** (`upper`) up-left of the stair top.
- `houses.saria`: `trunkRadius 3.5`, keep `roofHeight 6.5`, `lanterns 3` (2 lime, 1 orange) on vines under the limb,
  door lamp; keep position (pinned terrace).
- `signposts.saria-sign`: `[5.5, 1.0, −9.8]`, facing the plaza.
- `lanternBranch`: **`from [−5.5, 4.0, −6.3] to [3.5, 2.6, −3.0]`**, radius 0.7, moss top, 2 **orange** pods on 1 m
  cords at 30 % / 55 % of its length; `giantTrees.lantern-tree` → ≈ (−7.5, 2.0, −7.5). New `lanternPosts`:
  `[−0.55, 0, 2.55]` (short leaning post, 1 lime + 1 orange at ≈ 1.1 m, left verge in A) and `[4.7, 0.45, 4.8]` (2 lime
  at 2.6 m over the kid's grass).
- `logArch`: `radius 4.0`, `lanterns 3` (orange); position fine (30–34 m).
- `heroBoulders`: `stair-foot → [5.9, 0.1, −3.0] r 0.7`; `shot-d-boulder → [−0.8, 0, −2.5] r 0.8`; purple-flower beds at
  (−1.5…0.5, −1.5…−4.5) (shot D left), along the A left verge (−3…−0.5, 1.5…4) and at the house's right (14…16, −7…−9).
- `npcSpots`: `link-spawn [2.4, 0, 3.8]` (on camera A's axis), `kokiri-a [4.7, 0.45, 4.8]` (wanders to ≈ (8.8, 0.3)),
  `kokiri-b [−2.6, 0, 1.6]`.
- `viewpoints` (fov 46 unless noted):
  **A (0.4, 1.8, 8.6) → (6.3, 0.5, −5.2)**;
  **B (−1.6, 1.55, 5.6) → (4.6, 1.6, −12.0)**;
  **C (3.6, 1.7, −8.5) → (3.0, 0.5, 5)**;
  **D (3.5, 1.85, 5.4) → (6, −2, −34)**;
  **E = B camera** (ground close-up uses the lower half);
  **F (−3.0, 1.7, 2.0) → (8.3, 1.07, −2.0), fov 42**.

`config.ts`
- `sun.elevationDeg 34 → 38`; keep `azimuthDeg −128` (rubric); `intensity` re-tune so lit flagstone ≈ l 0.55.
- Fog → exponential/height haze, density ≈ 0.03, colour `0x95968b` graded to `0xa3a399` far; `mistHeight 2.0`; keep
  `far ≥ 150` for the audit.
- Sky/hemi → warm greys (`0xcfd3c8` / `0xe2dfd0` / `0xc9c8b4` / `0x4a4a30`).
- Palette → §9 values. Exposure ≈ 0.85–0.9 with ACES/AgX.
