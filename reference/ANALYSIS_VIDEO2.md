# Kokiri Forest reference — video 2 (Nintendo of America, 15:11 gameplay) — analysis

Companion to `reference/ANALYSIS.md` (the 61-second first-look clip). Video 2 is the Nintendo of
America 15-minute Kokiri Forest gameplay video the owner is supplying. Frames live in
`reference/frames-video2/` (≤ 640 px wide, **comparison only, never scenery** — GAUNTLET.md §4.C;
their pHashes are registered in `reference/phash.json` so anti-cheat C1 fails any reuse as a texture).

> **Status: INTERIM (2026-09-19).** The video file has not reached the `fable-5` chat yet (asked
> the owner for a local upload; no YouTube scraping). This version analyses the three gameplay
> screenshots the owner attached to his 2026-09-19 review (`art/environment/owner-review-2026-09-19/`,
> captured from the YouTube player at 0:56, 1:42 and 2:22). They carry player chrome (play/pause
> button, progress bar, title) and are cropped top and bottom, so positions are given in **crop
> coordinates** with a per-frame mapping to the full 16:9 frame (±0.03). Clean `ffmpeg` frames at the
> owner's marked moments replace them when the file lands (§5).

Screen positions are normalised (x, y) in 0..1 from the top-left of the image named. "Link = 1.25 m"
is the scale anchor. "Ours" = take-0116 (`973a21e`, `data/takes/take-0116/` on the `monitor` branch).

---

## 0. Summary — what video 2 adds to the 61-second clip

1. **Two of the three frames are the same shots as the short clip** (0:56 = `D_log`, 1:42 = the
   `B_house` hold), a fraction of a second apart. Video 2 therefore confirms rather than changes
   the composition targets; what it adds is the owner's *reading* of them: (a) the log arch must
   open onto a **deep misty world with tall dark trees rising over it**, (b) the stair on the right
   bank of shot D climbs from a **raised** dark bank, not from path level, (c) the plaza's middle
   ground is **veiled in mist** so the north path is not a readable ribbon, (d) the house bough
   carries **7–8 pods clustered close together**, not 3 in a row.
2. **2:22 is new territory**: the path north runs through a shaded corridor between a tall
   dark rock/root ledge (a Kokiri standing on its flat mossy top) and a near-black root wall with
   ferns at its foot, toward a bright misty exit. Mean luminance 0.18 vs 0.36–0.39 for the plaza
   frames — the darkest composition in either video, with the highest local contrast (walls l 0.04
   against the exit l 0.47). This is the destination `expansion-1` is building (raised right-bank
   stair + ledge, the clearing beyond the arch) and it sets the material brief for `fable-2`'s ledge
   rock: damp near-black stone, moss sheets on top, ferns below, lit rims only.
3. **Palette holds.** Plaza frames: mean hue 31–42° (crop band, chrome-biased), sat 0.14–0.16,
   lum 0.36–0.37 — the same olive/khaki low-key image as `ANALYSIS.md` §0. Nothing is blue; the
   only cool value measured is the mist exit of 2:22 (`#767678`, neutral grey).
4. **Lanterns are small.** Even in the 1:42 frame, where 7–8 pods hang within ~4 m of the door,
   each pod is 0.015–0.02 of the frame width with a soft halo of ~1.5× its size. The two orbs
   under our arch in D are 4–5× the reference pod size (survey-2 A1, still in take-0116).

---

## 1. Frame index (`reference/frames-video2/`)

| file | video t | source (interim) | equals short-clip shot | crop → full-frame y mapping |
| --- | --- | --- | --- | --- |
| `v2-0056-arch-depth-and-right-steps.jpg` | 0:56 | owner screenshot `ref-03` (with red marks), 587×243 | `D_log` (56 s) | y_full ≈ 0.124 + 0.736·y_crop |
| `v2-0142-plaza-house-from-south.jpg` | 1:42 | owner screenshot `ref-01`, 638×292 | `B_house` / `E_ground` hold | y_full ≈ 0.106 + 0.813·y_crop |
| `v2-0222-north-path-raised-ledge.jpg` | 2:22 | owner screenshot `ref-04`, 634×248 | — (new area) | y_full ≈ 0.053 + 0.695·y_crop |

The mapping is derived from the HUD item slot (top-right), whose vertical extent in the full frame
is known from the short clip (y 0.03–0.17). x is unchanged (the crops keep the full width).

---

## 2. Per-frame analysis

### 2.1 `v2-0056` — the log arch with depth beyond it, and the right-bank stair (owner's ref-03)

Same camera as `D_log` (heading SE, camera 4.5 m behind Link, eye 1.8 m, pitch ≈ 4° down); the
falling leaves are at different points of their fall, so this is the same take ±0.5 s.

| Element | Screen (crop x, y) | Notes / measurement |
| --- | --- | --- |
| **Log arch** | body x 0.30–0.55, y 0.15–0.42; opening centre (0.44, 0.35) | A **horizontal fallen trunk**: flat, level top with moss and fern tufts, straight underside, clearly wider than tall (aspect ≈ 2.2 : 1 on screen). Body tone `#5c4c45` (h 18°, l 0.32) — warm, 55–60 % hazed. Lanterns on it are **pinpoints** (< 0.008 of frame width). |
| **Depth beyond the arch** (owner mark a) | glow x 0.40–0.50, y 0.33–0.40 | Through and past the opening the air brightens to `#68615a` (l 0.38) and a second plane of trunks reads *behind* the arch. The owner's arrow at x 0.15–0.22 marks **tall dark trunks rising above the arch line** from y 0.45 to the top of frame (`#5f5e58`, l 0.36, 45–50 % hazed) — the arch is small against trees three to four times its height. |
| **Raised right-bank stair** (owner mark b) | treads x 0.80–0.98, y 0.55–0.80 | 5 treads climbing to the right, receding in perspective; the lowest tread starts **above** the path — the bank face below it is dark (`#4d4d4a`, l 0.30) and ≈ 0.9–1.2 m high at that distance (Link = 1.25 m). Tread stone `#413a2c` (l 0.22) in shade, grass lip `#473b2c` on the bank top at y ≈ 0.50. "It should be raised." |
| Mist pool | x 0.30–0.75, y 0.42–0.55 | `#6a645f` (l 0.40), fills the hollow between Link and the arch; the path dissolves into it at y ≈ 0.55. |
| Path | x 0.25–0.80 at y 0.60 narrowing to (0.50, 0.55) | Flagstones `#625a3c` (l 0.31) — darker than the plaza's (shade + mist). |
| Boulder + ferns + flowers (left) | boulder x 0.03–0.12, y 0.78–0.90; fiddlehead ferns 0.02–0.12, 0.60–0.80; purple clump 0.10–0.18, 0.65–0.75 | Boulder is **lit and layered** (`#5b5338`, l 0.29, moss cap); 138 purple pixels at 587 px wide, `#683f59`–`#5c3452` (h 313–325°, s 0.25, l 0.28–0.34): one compact clump, not a scatter. |
| Link / Navi | Link x 0.42–0.50, y 0.60–1.0 (cut); Navi (0.38, 0.55) with a sparkle trail | Running away. |
| Falling leaves | (0.46, 0.05), (0.36, 0.10), (0.56, 0.20) | 3 large (0.2–0.4 m) leaves in the upper half. |
| Canopy | y 0.0–0.15 over x 0.30–0.55; top-right limb x 0.80–1.0, y 0.0–0.30 | Dark; sky fraction 0. |

**What ours (take-0116 `D_log`) has:** the arch silhouette at the right place (0.38–0.62 × 0.27–0.42),
ground mist in the hollow, a stair flight at the right edge (0.82–1.0 × 0.50–0.72), ferns and
purple heads on the left bank, Link and Navi on the frame's marks, falling leaves.

**What it lacks (measured):**
- The arch reads as a **rounded dark mound** (height ≈ width on screen) with a fuzzy top; the
  reference is a flat-topped horizontal log, aspect ≈ 2.2 : 1. Its two lanterns are **bloom orbs
  ≈ 0.04 of the frame width** (5× the reference pinpoints).
- **Beyond the arch is a flat pale wall** (`#a3a39a`-class at 50 m). No second plane of trunks
  through the opening, no tall dark trunks rising over the arch line at x 0.15–0.25 — that band in
  ours is a smooth green giant trunk (0.0–0.10) and hazed cylinders.
- The right stair starts **at path level** from a low lawn; the reference's lowest tread sits on a
  dark bank ≈ 1 m high.
- The hero boulder is **unlit and behind ferns** — a dark face at (0.15–0.30, 0.62–0.78) with no
  visible layering or moss cap; the reference's boulder is a lit hero element.
- Purple heads are sprinkled over the whole bank (0.12–0.35 × 0.48–0.65) and again on the right
  verge; the reference has one compact clump.

### 2.2 `v2-0142` — the plaza from the house side (owner's ref-01)

The `B_house` hold (heading N, camera 1.55–1.75 m, ≈ 5 m in front of Link), 1½ minutes later than
the short clip's 14 s frame: the Kokiri girl is fully in frame at the left with her fairy above her.

| Element | Screen (crop x, y) | Notes / measurement |
| --- | --- | --- |
| **Saria's house** | trunk x 0.60–1.0; moss cap x 0.64–0.95, y 0.10–0.27; door x 0.75–0.83, y 0.36–0.55 | Cap `#6e673f` (h 51°, l 0.34) with tufts and an irregular fringe hanging over the bark. **Bark buttress columns** flank the door (x 0.70–0.75 and 0.83–0.90, `#403c37`, l 0.24) — the door is framed by knotted wood, not cut into a smooth wall. **Interior is lit**: `#54504e` (l 0.32) grey-warm, a lamp on the back wall, floor visible — not a black void. A second nook with an orange pod at x 0.93–0.99, y 0.35–0.50. |
| **Pods on the bough** | 7–8 within x 0.60–0.80, y 0.31–0.39 | Highlights at (0.60, 0.39), (0.64, 0.36), (0.665, 0.34), (0.70, 0.31), (0.72, 0.32), (0.75, 0.34), (0.75, 0.37), (0.78, 0.34). Lime `#d6bd5a`/`#cdb24d` (h 47–48°, s 0.56–0.60, l 0.55–0.60) and orange `#d8b173`/`#c5955d` (h 32–37°). Each pod 0.015–0.02 of frame width; **clustered**, hanging at different lengths, all within ~4 m of the door. |
| **Signpost** | plank x 0.555–0.60, y 0.395–0.43; post to (0.585, 0.50) | `#928f80` in this light (l 0.54) — pale carved plank, two rows of glyphs. |
| **Kokiri girl + fairy** | girl x 0.0–0.08, y 0.30–0.75; fairy (0.11, 0.29) | Girl faces right (toward the plaza), tunic `#2d2816`. Fairy is a soft white-warm glow `#c0bcb2` (l 0.73) ≈ 0.02 of frame width, hovering ~0.3 m above her head. |
| **Mist veil** | x 0.10–0.60, y 0.28–0.45 | `#7e7b72` (l 0.47) — the brightest band of the frame after the pods; it **hides the north path**: only the small terrace steps at (0.15–0.30, 0.40–0.48) and hazed trunks `#726e67` show through. |
| Link / Navi | Link x 0.46–0.54, y 0.45–0.92; Navi (0.565, 0.47) | Facing camera, idle. |
| **Flagstones** | y 0.55–1.0 | Rounded stones 0.06–0.10 of frame width (≈ 0.5–0.9 m at 4–6 m), lit `#95815d` (l 0.48), shade `#777253` (l 0.40), with **grass growing between them** in patches (0.28–0.40 × 0.60–0.68, 0.60–0.72 × 0.64–0.72, `#79704c`). The verge at the left is shaded soil + tufts `#544e39` (l 0.28). |
| Canopy / far trunks | canopy y 0.0–0.12 `#3d3b35`; trunks x 0.18–0.32, y 0.12–0.40 | Far trunks are pale warm grey, no white. |

**What ours (take-0116 `B_house`/`E_ground`) has:** the house at the right with a low moss cap, a
wide dark arch with 3 pods under the eave, the signpost, Link and Navi on their marks, the girl at
the left edge, the north path receding, far trunks in haze, a purple clump at the right edge.

**What it lacks (measured):**
- **3 pods in an even row** under the eave (+2 on a second house) where the reference has 7–8
  clustered on the bough at varied cord lengths.
- **Interior black** (l < 0.08 across the opening) with two candle points; the reference's room is
  l 0.32 with a visible back wall and floor. The doorway is cut into a smooth orange-brown wall; the
  reference frames it with two knotted bark columns.
- **No mist veil**: our north path is a crisp flagstone ribbon with a lawn to the far end. The
  reference's middle ground is 60 % hidden; the eye stops at the signpost and the house.
- **Flagstones** are 1–1.5 m pale blue-grey slabs with continuous orange soil grout; the reference's
  are 0.5–0.9 m rounded stones with grass patches between them and a soft moss halo.
- A **second tree-house on a pole** at (0.05–0.15, 0.08–0.20) and a **pebble pile** at the house
  base (0.60–0.80, 0.62–0.78) that the reference does not have.
- The girl has **no fairy** and stands in a stiff A-pose; the reference's fairy is the second
  brightest thing in the frame's left half.

### 2.3 `v2-0222` — the path north under the raised ledge (owner's ref-04)

A new area: after the plaza the path enters a shaded corridor. Link runs away from the camera
(camera ≈ 4.5 m behind, eye ≈ 1.8 m). Band luminance 0.177 — half the plaza frames.

| Element | Screen (crop x, y) | Notes / measurement |
| --- | --- | --- |
| **Left ledge** (tall rock/root mass) | x 0.17–0.42, y 0.10–0.62; flat top y 0.12–0.17 | Near-black damp stone in shade `#24272a` (l 0.15), a moss/grass sheet on the flat top `#39332e`, root ridges down the face; a **Kokiri stands on the top** at (0.285, 0.10–0.17) — the ledge is a destination ≈ 3–3.5 m above the path. Dark ferns at its foot (0.20–0.42, 0.55–0.70). |
| **Leaning trunk with pods** (left) | trunk (0.13, 0.65) → (0.19, 0.42); pods (0.147, 0.516), (0.19, 0.524), (0.185, 0.556), (0.158, 0.565) | 3–4 lime pods `#dbad1f`–`#ccb891` (h 40–45°, s 0.4–0.75) on a bark post leaning ~20° toward the path; the only warm light in the frame. |
| **Right wall** | x 0.60–1.0, y 0.0–0.80 | A tall root/rock wall, **near black** (`#0a0a07`, l 0.04) with ferns at its foot (0.78–0.95, 0.60–0.75, `#0d1304` with lit rims) — the darkest surface in either video, and it still reads as a wall because its silhouette edge against the mist is crisp. |
| **The exit** | x 0.40–0.60, y 0.15–0.62 | Bright neutral mist `#767678` (l 0.47) — a tall opening the path runs into; a lit pale plane far beyond, trunks silhouetting through it. This is the "deep world" the owner describes. |
| Path | x 0.45–0.60 at y 0.72–0.82 `#303836` | Dark flagstones under litter; fine leaf litter everywhere on the verges (`#484a45`, grey-olive). |
| Link / Navi | Link x 0.44–0.52, y 0.62–1.0 (legs cut); Navi (0.56, 0.60) | Running away toward the exit. |
| Falling leaves | (0.45, 0.30), (0.88, 0.27) | Two, large, in the upper half. |
| Canopy | y 0.0–0.10 `#262724` | Closed. Sky fraction 0. |

**What ours has:** nothing at this location yet — the arch footprint is blocked and the north
spine past 25 m is a flat pale plain (survey-2 #06, `w19-spine-l`/`w21-spine-f`; confirmed on
`973a21e` at `w18-spine-f` and `sn-arch-outside`: through the arch a flat pale plain with smooth
column cones and a flat haze horizon — see `gauntlet/reviews/evidence/fable-5/take-0116-W29-D-log-arch.jpg`).
The only wall-like terrain is the house-lawn earth face (`w08-spine-r`), which reads as soft clay.
`expansion-1` (fable-cursor) is opening the arch, the clearing beyond and the raised right-bank
stair + ledge; `fable-2` owns the ledge's rock material.

**Brief this frame gives those lanes:**
- The ledge is **3–3.5 m** high with a flat walkable top wide enough for a Kokiri to stand on, its
  face a damp near-black stone with root ridges, moss sheets only on the top, ferns only at the foot.
- The corridor is **shaded to l ≈ 0.15–0.25** with one warm accent (the pod post) and a bright
  exit — contrast, not fill. No lit lawn, no pale grass carpet.
- **Litter, not grass**, covers the verges; ferns and dark shrubs at both edges, lit only on rims.

---

## 3. Numbered defect list (video 2 frames vs take-0116) with owning system

Severity 3 = the frame's read changes; 2 = clearly visible at 1280 px; 1 = visible at 2×.

| # | defect | frame → ours | system | sev |
| --- | --- | --- | --- | --- |
| V1 | Arch silhouette is a rounded mound (≈ 1 : 1) with two bloom orbs 5× pod size; reference is a flat-topped horizontal log (≈ 2.2 : 1) with pinpoint lanterns | `v2-0056` → `D_log` (0.38–0.62 × 0.27–0.42) | structures/logArch (shape), lighting/postfx (bloom clamp — Astra) | 3 |
| V2 | No world beyond the arch: a flat pale wall where the reference shows a brighter second plane of trunks through the opening and tall dark trunks rising 3–4 arch-heights above it at x 0.15–0.25 | `v2-0056` → `D_log` | atmosphere (Astra: far light / haze grading), trees/distant (distant-1), layout (expansion-1: the clearing beyond) | 3 |
| V3 | Right-bank stair starts at path level from a low lawn; reference climbs from a dark raised bank ≈ 1 m high with a grass lip | `v2-0056` → `D_log` (0.82–1.0 × 0.50–0.72) | layout/terrain/hardscape (expansion-1) | 2 |
| V4 | House interior is black (l < 0.08) with candle points; reference room is l 0.32 with a lit back wall and floor | `v2-0142` → `B_house` door (0.66–0.78 × 0.42–0.60) | structures/house (structures-30 nook lane) | 2 |
| V5 | 3 pods in an even row under the eave vs 7–8 clustered on the bough at varied cord lengths | `v2-0142` → `B_house` (0.60–0.80 × 0.31–0.39) | structures/house + lanterns (`layout.ts` lantern count needs fable-cursor) | 2 |
| V6 | Doorway cut into a smooth wall; reference frames it with two knotted bark buttress columns | `v2-0142` → `B_house` | structures/house | 2 |
| V7 | No mist veil over the middle ground: the north path is a crisp ribbon to the far end where the reference hides 60 % of it | `v2-0142` → `B_house` (0.10–0.60 × 0.28–0.45) | atmosphere (ground mist — Astra) | 2 |
| V8 | Flagstones 1–1.5 m pale blue-grey slabs with continuous orange grout vs 0.5–0.9 m rounded stones with grass patches between | `v2-0142` → `E_ground` (0.25–0.75 × 0.62–1.0) | hardscape/flagstones | 3 |
| V9 | Hero boulder unlit behind ferns, no layering/moss cap readable; reference boulder is a lit, layered hero rock with moss | `v2-0056` → `D_log` (0.05–0.40 × 0.55–0.82) | rocks (fable-2) + vegetation (fern exclusion around the boulder) | 2 |
| V10 | Purple heads sprinkled across the whole bank and the right verge vs one compact clump beside the boulder | `v2-0056` → `D_log` | vegetation/flowers | 1 |
| V11 | Kokiri girl has no fairy and stands in an A-pose; reference: fairy glow 0.3 m over her head, girl faces the plaza | `v2-0142` → `B_house` (0.0–0.12 × 0.28–0.75) | character/npc (npc-1) | 2 |
| V12 | Second tree-house on a pole and a pebble pile at the house base — not in the reference frame | `v2-0142` → `B_house` (0.05–0.15 × 0.08–0.20), (0.60–0.80 × 0.62–0.78) | layout (upper house visibility from B), hardscape/rocks (pebble field) | 1 |
| V13 | The 2:22 corridor does not exist: no 3–3.5 m ledge with a flat mossy top, no near-black root wall with ferns at its foot, no shaded corridor (l 0.15–0.25) with a bright exit | `v2-0222` → north spine (`w13`–`w21` poses) | layout/terrain (expansion-1), rocks (fable-2: ledge material), atmosphere (Astra: shade floor + exit light), vegetation (fern/litter verges) | 3 |
| V14 | Pod posts: the reference's leaning bark post carries 3–4 lime pods at 1.3–1.6 m; ours carry 1–2 on a curled iron-like hook (`A_stairs` 0.80–0.88 × 0.28–0.40) | `v2-0222`, `v2-0142` → `A_stairs`, `F_canopy` | structures/lanternPost | 1 |

---

## 4. Palette samples (mean of the region; crop coordinates)

| name | hex | h / s / l | frame, region |
| --- | --- | --- | --- |
| arch body (hazed) | `#5c4c45` | 18° / 0.14 / 0.32 | 0056 (0.36–0.48, 0.20–0.30) |
| glow beyond the arch | `#68615a` | 28° / 0.07 / 0.38 | 0056 (0.40–0.50, 0.33–0.40) |
| far trunks over the arch | `#5f5e58` | 51° / 0.04 / 0.36 | 0056 (0.05–0.15, 0.15–0.35) |
| mist pool | `#6a645f` | 26° / 0.05 / 0.40 | 0056 (0.55–0.75, 0.45–0.55) |
| right-bank face (shade) | `#4d4d4a` | 58° / 0.02 / 0.30 | 0056 (0.62–0.75, 0.30–0.45) |
| right stair tread (shade) | `#413a2c` | 39° / 0.20 / 0.22 | 0056 (0.85–0.95, 0.60–0.66) |
| path flagstone (D, shade) | `#625a3c` | 48° / 0.24 / 0.31 | 0056 (0.55–0.75, 0.75–0.85) |
| D boulder | `#5b5338` | 47° / 0.24 / 0.29 | 0056 (0.03–0.12, 0.80–0.88) |
| purple flower pixels | `#683f59`–`#5c3452` | 313–325° / 0.25 / 0.28–0.34 | 0056, 138 px |
| house moss cap | `#6e673f` | 51° / 0.27 / 0.34 | 0142 (0.70–0.86, 0.14–0.22) |
| house bark (lit) | `#726647` | 43° / 0.23 / 0.36 | 0142 (0.62–0.68, 0.30–0.44) |
| door bark column | `#403c37` | 33° / 0.08 / 0.24 | 0142 (0.90–0.96, 0.36–0.50) |
| door interior | `#54504e` | 26° / 0.04 / 0.32 | 0142 (0.77–0.83, 0.42–0.52) |
| signpost plank | `#928f80` | 49° / 0.08 / 0.54 | 0142 (0.555–0.60, 0.395–0.43) |
| mist veil (B) | `#7e7b72` | 43° / 0.05 / 0.47 | 0142 (0.30–0.50, 0.30–0.42) |
| flagstone lit / shade (B) | `#95815d` / `#777253` | 39° / 0.23 / 0.48 · 51° / 0.18 / 0.40 | 0142 |
| grass between stones | `#79704c` | 48° / 0.23 / 0.39 | 0142 (0.62–0.72, 0.66–0.72) |
| verge shade (left) | `#544e39` | 46° / 0.19 / 0.28 | 0142 (0.10–0.25, 0.60–0.68) |
| pod lime / orange | `#d6bd5a` / `#d8b173` | 48° / 0.60 / 0.60 · 37° / 0.56 / 0.65 | 0142 highlights |
| fairy glow | `#c0bcb2` | 43° / 0.10 / 0.73 | 0142 (0.11, 0.29) |
| girl's tunic | `#2d2816` | 47° / 0.33 / 0.13 | 0142 (0.01–0.05, 0.55–0.65) |
| ledge rock (shade) | `#24272a` | 207° / 0.08 / 0.15 | 0222 (0.22–0.34, 0.25–0.45) |
| ledge-top moss | `#39332e` | 26° / 0.11 / 0.20 | 0222 (0.20–0.30, 0.16–0.20) |
| right root wall | `#0a0a07` | 45° / 0.19 / 0.04 | 0222 (0.72–0.85, 0.20–0.40) |
| corridor exit mist | `#767678` | 230° / 0.01 / 0.47 | 0222 (0.44–0.56, 0.42–0.52) |
| pod post lime | `#dbad1f` / `#ccb891` | 45° / 0.75 / 0.49 · 40° / 0.37 / 0.68 | 0222 highlights |
| leaf litter ground | `#484a45` | 91° / 0.03 / 0.28 | 0222 (0.22–0.35, 0.72–0.80) |
| leaning bark post | `#595546` | 50° / 0.12 / 0.31 | 0222 (0.13–0.17, 0.42–0.62) |

Frame bands (y 0.12–0.78 of the crop, 64×36 box downscale, no sky mask needed — sky fraction 0):
`0056` hue 30.8° sat 0.138 lum 0.374 · `0142` hue 42.0° sat 0.162 lum 0.364 · `0222` hue 67.7° sat
0.191 lum **0.177**. The YouTube chrome biases the plaza frames' hue ~5–10° warm (red progress bar,
white text); treat 45–50° as the true value, consistent with `ANALYSIS.md`.

---

## 5. Frames to extract when the video file arrives (owner's marked moments)

`ffmpeg -ss <t> -i video2.mp4 -frames:v 1 -vf "scale=640:-2" -q:v 3 reference/frames-video2/v2-<mmss>-<slug>.jpg`,
then `node` the hashes into `reference/phash.json` (same shape as `ref-extract.mjs`). Targets:

1. **The plaza from the house side ("the backside")** — camera north of Saria's house looking
   south over the plaza; what closes the far side (the stair bank? the giants?).
2. **The right side of the hero steps** — the flank the owner circled in 0:56 from closer, and the
   view from the top landing back down.
3. **The raised right-bank stair and ledge** — 2:22 from more angles: the climb, the top, the
   Kokiri on it, how the ledge meets the arch.
4. **The view through the log arch** — walking under it (the 58–60 s underside) and out the other
   side: what the second clearing is.
5. **The Kokiri girl with her fairy** — walk loop, sitting on the steps, the fairy's hover.
6. **The forest-temple area** (owner's words) — any frames of a stone structure or a second stair.
7. Also: 8→13 s orbit equivalents, any top-down moments (layout), any close bark/stone/grass.

Each gets a §2 table (elements, crop positions, palette) and adds to §3.
