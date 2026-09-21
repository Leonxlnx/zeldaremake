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
> owner's marked moments replace them when the file lands (§5). **2026-09-20:** §6 extends the
> analysis with the dense 2 fps frames of the 61-second demo (`reference/frames-dense/demo61/`,
> fable-cursor's extraction) — the six segments the hero frames do not cover, each measured and
> compared with the world head `3d50f6c8` (fable-2/3/4 merged) at the equivalent pose.

Screen positions are normalised (x, y) in 0..1 from the top-left of the image named. "Link = 1.25 m"
is the scale anchor. "Ours" = take-0116 (`973a21e`, `data/takes/take-0116/` on the `monitor` branch)
in §2–§4; in §6 "ours" = the world head `3d50f6c8` rendered by `fable-5` (non-author) through
`broll.mjs --size 1280x720 --settle 8`, poses listed per segment.

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

---

## 6. The dense demo frames (`reference/frames-dense/demo61/`) — the six segments the hero frames miss

`d_NNN` is at (NNN − 1) × 0.5 s of the 61-second demo, 960 px wide. The A/F/C/B/E/D families are
already covered by `ANALYSIS.md` §2; the segments below are the ones no fixed view looks at. Each
is measured on the frame and compared with the world head `3d50f6c8` rendered at the equivalent
pose (`broll.mjs`, 1280×720, settle 8, character on for the demo poses). Poses are given as
`p → t` in world metres; survey-2 / opus-walk pose names where one exists. Evidence sheets
(REFERENCE | OURS at the same normalised region) are in `.agents/reviews/fable-5-walk/`.

Correction to `frames-dense/README.md`'s timing table, from the frames themselves: `d_087–d_090`
(43–44.5 s) is the **walk to Saria's door**, not the north path; `d_095–d_103` (47–51 s) is the
**top-down** over the path junction; `d_105–d_109` (52–54 s) is the **stair foot looking up the
flight**; `d_111–d_119` (55–59 s) is the run toward the arch (D family); `d_120–d_121` (59.5–60 s)
is **under the arch**, and only `d_122` is the title card.

### 6.1 The orbit, 9–11 s (`d_019`, `d_021`, `d_023`) — what closes the plaza at the other headings

Camera swings clockwise round a standing Link from heading W (9 s) to N (11 s), 4–5 m from him,
eye ≈ 1.7 m. Between shot F (8 s) and the B hold (13 s) it shows the two quadrants no fixed frame
covers.

| t | heading | what the frame holds (reference positions) |
| --- | --- | --- |
| 9 s `d_019` | W | hero stair block at the **left edge** (0.0–0.25 × 0.05–0.65) climbing from a raised bank with a **wooden fence along its top**; a Kokiri boy on the bank at (0.40–0.43 × 0.42–0.60) with a lime pod (0.29, 0.33) and a fairy (0.36, 0.37) above him; a **rounded moss-capped boulder at his feet** (0.33–0.38 × 0.50–0.57); a **spreading giant with horizontal limbs** filling the top right (0.55–0.85 × 0.0–0.30); the right third is a mossy bank in haze — no ground plane visible beyond it |
| 10 s `d_021` | NW | the same bank continues; the boy now left of centre; the far hut with lanterns appears in the haze at centre |
| 11 s `d_023` | N–NNW | **a second hollow-tree house at the right** (0.70–1.0 × 0.10–0.55) with its signpost (0.65–0.72 × 0.40–0.55) and two orange lanterns (0.85, 0.30), (0.75, 0.42); **a far hut with warm lanterns in the haze at centre** (0.35–0.55 × 0.28–0.40, l 0.47, s 0.08); a Kokiri boy on the raised bank at the left edge (0.09–0.15 × 0.40–0.68); giant limbs top-left; no sky — the top band (0.30–0.55 × 0.05–0.15) is grey-olive `#717162` (l 0.42) |

Measured: frame means l 0.333 / 0.339, hue 47–48°, sat 0.16–0.19 — the plaza's key is the same in
every direction. Plaza slabs l 0.45 (`#897a5b`, `#8c7a59`); stair flank in shade l 0.30; the haze
at the right of 9 s l 0.38, s 0.10 — a **grey-olive veil, never a pale plane**.

**Ours** (`demo-09s-orbit-W` p (−2.5, 1.75, 4.08) → (2.3, 1.0, 4.2); `demo-11s-orbit-NW`
p (−1.01, 1.75, 0.72); `demo-13s-orbit-N` p (2.42, 1.75, −0.6); all fov 46, orbiting Link's
A spot (2.3, 0, 4.2) at 4.8 m by the same Δheading as the footage):

- 9 s: **holds** — stair block at the left edge with the fence on top, a Kokiri at the stair foot,
  a moss boulder and fable-3's two pots (0.33–0.38 × 0.45–0.52), the lantern post. **Lacks** the
  spreading giant (ours is a bare bark column, 0.68–0.80 × 0.0–0.40) and the mossy bank on the
  right: from x 0.75 the frame is a **flat pale plain with a hard tree line** (`#4c4e47`, l 0.29,
  s 0.05 — cooler and flatter than the reference haze). Slabs l 0.44 match; joints are orange.
- 11 s and 13 s: **nothing closes the plaza.** Where the footage has the second house, its
  signpost, the far hut and the bank with the boy, ours shows giant trunks, a moss bank with a hard
  edge, the far plain (`#50564e`, hue 103°, s 0.05) and two vine leaf-cards at the lens. The house
  is behind the camera: from Link's spot our stairs are at bearing 49° and the house at 33°
  (16° apart), the footage has them ~160° apart (`ANALYSIS.md` §0.4). Not a bug to fix in a lane —
  the layout choice is pinned by W04 — but it means **the plaza's W, S and N sides need their own
  closure**: a second hollow house or hut silhouette in the haze, a raised bank with a fence, the
  spreading giant. Owner's "backside" question answered: in the footage the far side is *houses
  and banks in haze*, never a plain.

### 6.2 The walk to the door, 43–44 s (`d_087`, `d_089`) — the ground to the right of the house

`d_087` (43 s): the house fills the **left** half (0.0–0.48), door at (0.25–0.40 × 0.42–0.60),
signpost (0.12–0.20 × 0.48–0.62), Link at centre walking left toward it. The **right half is the
area beside the house** the owner asked about: a raised mossy bank (0.55–1.0 × 0.25–0.55,
`#5a5c53`, l 0.35, s 0.05 — almost neutral in the haze at ~12 m), a Kokiri girl standing on it
(0.72–0.78 × 0.55–0.65) among ferns and purple flowers, **pale rounded boulders** (0.85–0.95 ×
0.60–0.70, `#6c6e64`, l 0.41), a **low stone ledge/step** running along the bank's foot (0.60–0.95
× 0.62–0.70, `#6d6e5c`), a **string of small yellow lights** along the bank (0.55–0.62, 0.55) and
tall trunks behind. `d_089` (44 s): one step later the camera has turned to face the door
(0.45–0.95), the stepping stones to it at (0.55–0.72 × 0.55–0.75), purple flowers bottom right.

**Ours** (`demo-44s-walk-to-house` p (0, 1.5, 2) → (13.6, 1.5, −6.5), the B camera turned 15°
right of the house): house at left (0.15–0.40 × 0.12–0.55) with pods, signpost at (0.15–0.20 ×
0.42–0.50) — the house **holds** (bark l 0.22 vs the reference's 0.33: ours is darker). Right of
it stands **the hero stair** (0.50–0.75 × 0.25–0.75) with a Kokiri at its foot, the lantern post
(0.82–0.88), fable-3's pots (0.85–0.95 × 0.60–0.75) and the stair-foot boulder. The ground the
footage shows to the right of the house — bank, girl, pale boulders, the low ledge, the light
string — has no equivalent because the stair occupies that bearing. What can still be taken from
the frame: the **pale boulder pair** and the **low stone step at a bank's foot** as a dressing
pattern for the plaza's edges (fable-2), and the **light string** as a prop (fable-3 / lanterns).

### 6.3 Top-down, 47–49 s (`d_095`–`d_099`) — slab and joint metrics from above

The camera rises to ≈ 6.5–7 m and looks nearly straight down (≈ 75–80°) at a **three-way
junction** of the flagstone path: one arm runs up-left, one right, one down; the boy stands at
a boulder on the left bank (0.10–0.20 × 0.50–0.62), pale boulders at the right (0.85–0.95 ×
0.25–0.35), purple flowers (0.75–0.85 × 0.50–0.55), ferns in the corners, canopy shadows across
the whole ground.

Measured (Link's foreshortened extent ≈ 0.6 m ↔ 58 px → 10.3 mm/px, frame ≈ 9.9 m wide):

| | reference `d_097` | ours `demo-49s-topdown` (p (3, 6.5, 5) → (4.5, 0, 2), ≈ 8.4 mm/px) |
| --- | --- | --- |
| path width | ≈ 3 slabs, 3.0–3.5 m | plaza, not a path — no junction exists at the A spot |
| slab size | **0.8–1.1 m**, rounded polygons with irregular edges, two tints (pale grey / warm tan) mixed | **1.7–2.5 m** angular Voronoi cells |
| joints | **6–10 cm** dark soil lines with moss tufts and small green leaves; darker than the slab | **17–21 cm** orange-tan grout, *brighter and more saturated than the slab* (joint l 0.39 s 0.26 vs slab l 0.35 s 0.13) |
| paving luminance p5 / p50 / p95 | 0.27 / 0.49 / 0.66 | 0.20 / 0.42 / 0.63 |
| moss | patches on slab edges, tufts in joints | disc-shaped patches on slabs, none in joints |
| verges | grass and ferns to the slab edge, no soil band | grass to the slab edge (holds) |

The luminance spread is the same; the difference is **cell size ×2 and joint polarity** (dark,
narrow, green vs bright, wide, orange). This is the measured form of V8 / opus #04 for
`hardscape-31`.

### 6.4 The stair foot looking up, 52–54 s (`d_105`–`d_109`)

`d_107` (53 s): Link at the bottom riser, the flight head-on at (0.50–0.66 × 0.30–0.65),
**15–16 treads visible**, each a rounded **log nosing** (not a slab — see §6.6b) with a dark shadow
line under it; what first read as a single-pole rail along the right side (0.58–0.66 × 0.35–0.60,
`#686051`) is the line of **stake tops at the log ends** in perspective — there is no rail; the
flight narrows into a **bright haze gap at the top**
(0.52–0.62 × 0.22–0.32, `#b8b5a9`, l 0.69) with a lantern post and a top-landing fence in
silhouette; the left flank is the dark green bank (l 0.39, s 0.08), the right flank ferns with a
Kokiri boy (0.72–0.78 × 0.40–0.68), a lime pod (0.73, 0.38) and his fairy. Treads `#756f5e`
l 0.42 s 0.11 at the foot fading to l ≈ 0.65 at the top — **aerial perspective inside 8 m**.

**Ours** (`w23-stairs-f` p (6.4, 1.45, −0.3) → (14.29, 1.3, −6.45), survey-2; sheet
`fable-5-walk-w23-stairs-f.jpg`): ≈ 15 treads, even bands with straight nosings and dark risers
(opus #15 holds on the head); ferns on both flanks, no stakes at the tread ends; the pods of
the house at the top left. **The luminance gradient runs the wrong way**: treads foot l 0.35 →
mid 0.20 → top 0.17 (`#675c4c` → `#38322c` → `#2b2b2b`), top gap l 0.29, against the reference's
0.37 → 0.40 → 0.65 with the gap at 0.69. The flight darkens into shade where the footage brightens
into haze; frame mean l 0.222 vs 0.375.

### 6.5 The run to the arch, 55–58 s (`d_111`–`d_117`) — the D family at player height

`d_115` (57 s): Link running away along the spine; the arch belly a huge dark leaning trunk
across (0.38–0.90 × 0.20–0.40, `#646359`, l 0.37 hazed); **the house's wooden stair at the right
edge** (0.85–1.0 × 0.55–0.75, `#3e3728`, l 0.20); a pale boulder (0.05–0.12, 0.60, l 0.40) with
purple flowers and ferns at the left; the mist across the middle ground l 0.57. `d_117` (58 s):
5 m on — the arch's near leg fills the top right (0.55–1.0 × 0.05–0.35, `#3f4038`, l 0.24); the
**leaning pod post with 3 lime pods** in front of it (0.33–0.42 × 0.30–0.55); purple flowers at
(0.30, 0.55); the left third is haze (l 0.51, s 0.04) with trunks; slabs `#74684f` with **green
moss in the joints**.

**Ours** (`w18-spine-f` p (3.86, 4.94, −38.16) → (5.5, 4.79, −48.03)): the belly fills the top
(0.0–1.0 × 0.0–0.45) as deep torn bark plates (`#5a5750`, l 0.34) with three pinpoint pods —
**holds** (the FAR_HALO fix is visible at player height). Beyond the arch: a flat pale haze band
(`#71726b`, l 0.44, s 0.03) with smooth grey cones on a plane — opus #01. Slabs are pale blue-grey
with **orange joints** (`#908067`, l 0.49) where the reference's are moss-green. No pod post, no
boulder-and-flowers group at the left, no house stair at the right (different bearing).

### 6.6 Under the arch, 59.5–60 s (`d_120`, `d_121`) — the view through

`d_121` (60 s): the darkest frame of the demo — **frame mean l 0.131**. The belly spans the top
(0.0–1.0 × 0.0–0.20, `#1a1a0f`, l 0.08) with **three pods hanging from it** at (0.42, 0.24),
(0.58, 0.17), (0.68, 0.08) — orange and yellow, each ≈ 0.03 of the frame width — and a fourth lime
pod further on (0.29, 0.50). The side walls are near-black (`#14170b` / `#0e0f0a`, l 0.05–0.07)
with fern outlines just readable at the left edge. Through the opening, a **bright window**
(0.28–0.62 × 0.20–0.60, `#626560`, l 0.39, s 0.02): a dense grey-green stand of tall vertical
trunks with hanging vines, a scatter of glowing dots (spores / fireflies) and warm lantern points,
and **no visible ground plane** — the path dissolves into light. Contrast window : walls ≈ 6–8 : 1.
Link (0.45–0.53 × 0.55–0.85) is a silhouette against the window. The floor is dark cracked slab
(`#282924`, l 0.15).

**Ours** (`x-arch-tunnel-n` p (6.3, 5.7, −54.5) → (5.5, 6.4, −62), opus-walk pose seated at eye
1.45 m above the tunnel floor; sheet `fable-5-walk-x-arch-tunnel-n.jpg`): **frame mean l 0.430
against 0.131** — three times too bright. Belly l 0.15 (ref 0.08) with one large pod; the left
leg l 0.17 (ref 0.05–0.07); **there is no right wall at all** — the arch is open on that side, so
the "window" is the whole frame; window region l 0.52 (ref 0.39), window : wall contrast ≈ 3 : 1
(ref 6–8 : 1); floor l 0.46 (ref 0.15). Through the opening: the north path's slabs with orange
joints to the ledge flight, the flat pale plain (l 0.51) and smooth grey cones with hard base seams
in the haze. The structural gap is the one opus #01 names — the reference's window is *trunks and
lights with no floor*; ours is a plane with cones on it — plus the tonal one: the tunnel is not a
tunnel.

### 6.6b The hero flight is a log-risered stair, not cut stone (`d_013`, `d_105`, `d_107`, `A_stairs`)

Found while re-filing V18 on fable-3's objection (2026-09-20 04:35 UTC). Three frames at three
ranges agree, and the A frame's nosings read the same way once you know what to look for:

| frame | range | what the flight is made of |
| --- | --- | --- |
| `d_105` (52 s, ≈ 6 m above the foot, looking down the flight) | 3–8 m | **every riser is a round log** — a bark-textured roll ≈ 0.15–0.20 m thick spanning the 2.7 m width — **pegged at both ends with short vertical stakes** (≈ 0.10 m Ø, 0.15–0.25 m proud, on roughly every second log, stake tops in a line up each flank); the tread behind each log is packed earth / flat stone, darker than the log; grass to the log ends |
| `d_013` (6 s, 6–8 m, from the plaza) | 6–12 m | rounded roll nosings with dark risers under them, treads darker than the rolls; the **light string** climbs the left flank diagonally (0.35–0.50 × 0.65–0.75 of the flight crop); no rail |
| `d_107` (53 s, from the foot, head-on) | 2–10 m | the "single wooden pole on posts along the right side" I filed as V18 is the **line of stake tops** at the log ends in perspective (x 0.58–0.66 × 0.35–0.60); there is no rail on either flank |
| `A_stairs` (1 s) | 10–18 m | the same rolls: wavy rounded nosings, bark tone `#746d5d` lit, treads/risers in shadow `#453e32`, stakes just resolvable at the lower right ends |

What this changes: the reference flight's read — irregular, "individually cut", mossy edges, no
two nosings alike — comes from **logs**, not from worked stone. Our flight is cut blue-grey slabs
with square nosings (`w23-stairs-f`; opus #15, W02 fail on every take). The rubric's W02 text
("18 worn stone steps… each tread a distinct slab") reads the 1 s frame as stone; the dense frames
say timber risers with earth-and-stone treads. Proposal (fable-cursor's `RUBRIC_PROPOSALS.md`):
keep the counts and the audit checks, change the visual criterion to "log-risered: round timber
nosings with bark and moss, packed treads, end stakes, no two logs alike". For hardscape-31 this is
the single largest available change at frame A after the giants. **V18 is withdrawn** (re-filed
below as V18′) — the stakes belong to the stair, not to a rail prop; fable-3 was right.

### 6.7 Measured summary and additions to the defect list

| frame | frame mean l | key ratio | ours (head `3d50f6c8`) |
| --- | --- | --- | --- |
| `d_019` 9 s | 0.333 | haze right l 0.38 / slabs l 0.45 | plain l 0.29 / slabs l 0.44 — the far side is darker and flatter than the reference haze |
| `d_023` 11 s | 0.339 | far hut l 0.47 in haze | nothing there |
| `d_087` 43 s | 0.361 | bank l 0.35 / boulder l 0.41 | stair in that bearing |
| `d_097` 48 s | 0.349 | slab 0.8–1.1 m / joint 6–10 cm dark | slab 1.7–2.5 m / joint 17–21 cm bright |
| `d_107` 53 s | 0.375 | treads foot l 0.37 → mid 0.40 → top 0.65, gap 0.69 | foot 0.35 → mid 0.20 → top 0.17, gap 0.29 — inverted; frame l 0.222 |
| `d_115` 57 s | 0.380 | belly l 0.37 / mist l 0.57 | belly l 0.34 / haze l 0.44 |
| `d_121` 60 s | **0.131** | window l 0.39 / walls l 0.05–0.07 / floor 0.15 | **0.430**; window 0.52 / left wall 0.17, no right wall / floor 0.46 |

New defects (numbering continues §3; systems as in `docs/GOAL_MODE.md`):

| # | defect | frame → pose | system | sev |
| --- | --- | --- | --- | --- |
| V15 | **The plaza has no closure to the W, S and N**: a flat pale plain with a hard tree line where the footage has a second house, a far hut in haze, a fence-topped bank and a spreading giant | `d_019`/`d_023` → `demo-09s/11s/13s-orbit` | layout + structures (second hollow / hut silhouette), terrain (bank), trees (a spreading giant on the plaza's W) | 3 |
| V16 | **Slabs twice the reference size with bright orange joints twice the reference width**, measured from above: 1.7–2.5 m / 17–21 cm vs 0.8–1.1 m / 6–10 cm; joint brighter than the slab where the reference's is darker and green | `d_097` → `demo-49s-topdown`, `E_ground` | hardscape/flagstones + joint material (hardscape-31) | 3 |
| V17 | **The hero flight's luminance gradient is inverted**: the reference's treads brighten from l 0.37 at the foot to 0.65 at the top 8 m away and end in a haze gap (0.69); ours darken 0.35 → 0.17 into a shaded top (gap 0.29) | `d_107` → `w23-stairs-f` | atmosphere (near haze / mist floor + the light behind the plateau — Astra), hardscape/stairs | 2 |
| ~~V18~~ | *withdrawn 2026-09-20 04:35 UTC — the "pole rail" is the line of stake tops at the log ends (§6.6b)* | | | |
| V18′ | **The hero flight is cut stone where the reference's is log-risered**: round bark-and-moss timber nosings ≈ 0.15–0.20 m thick, packed earth/stone treads, short end stakes on every second log, no two alike (`d_105`, `d_013`, `d_107`; the A frame's wavy nosings are these logs) | `d_105` → `w23-stairs-f`, `A_stairs` (0.58–0.80 × 0.25–0.62) | hardscape/stairs (hardscape-31); rubric W02 wording (fable-cursor) | 3 |
| V19 | **Under the arch the tunnel is not a tunnel**: frame mean l 0.43 vs 0.13, no right wall, floor l 0.46 vs 0.15, window : wall 3 : 1 vs 6–8 : 1, and the window shows a plane with cones where the reference shows trunks and lights with no ground | `d_121` → `x-arch-tunnel-n` | structures/logArch (the closed side), atmosphere (shade floor under the arch — Astra), trees/distant + terrain north plain (trees-31), lanterns (three pods under the belly) | 3 |
| V20 | **Pale boulder pairs and a low stone step at the foot of the banks** are a recurring dressing motif (right of the house, the top-down's right bank, left of the D path) that we do not use | `d_087`, `d_097`, `d_115` → plaza edges | rocks (fable-2) | 1 |
| V21 | **The moss-capped boulder at the Kokiri boy's feet on the stair bank** (9 s and 46 s) — the C-frame anchor the owner sees twice | `d_019`, `d_093` → `C_lookback` (0.25–0.32 × 0.47–0.55) | rocks (fable-2) + npc placement | 1 |

## 7. The owner's 13:00 UTC re-priority, measured (2026-09-20 15:30 UTC; head `69d16c4f`/`94b701a0`)

The owner's four notes (via Astra): *stones under-detailed, trees too green, weak distant detail,
wider render distance*. Two of them are measurable against the six reference frames at the same
positions, so the lanes have numbers to aim at instead of taste. Method: both frames resized to
320×180; **foliage** = pixels with hue 55–170°, sat > 0.12, l 0.06–0.85 (HSL); medians over that
mask; the **canopy band** is the top 35 % of the frame. **Stone detail** on the paving regions that
are slabs in both frames: *macro σ* = std of luminance at 160 px wide (the light/shade structure),
*micro σ* = std of (l − 4 px Gaussian blur) at 640 px wide (fine relief).

### 7.1 "Trees too green" — it is a hue error of 8–15° in the canopy, not saturation

| frame | reference: foliage % / hue / sat / l | ours: foliage % / hue / sat / l | canopy band hue ref → ours |
| --- | --- | --- | --- |
| A_stairs | 13.7 / **61.6°** / 0.225 / 0.271 | 20.9 / 67.7° / 0.240 / 0.247 | 63.8° → **76.6°** |
| B_house | 17.3 / **61.9°** / 0.275 / 0.259 | 26.8 / 69.1° / 0.219 / 0.243 | 61.4° → **69.1°** |
| C_lookback | 14.0 / **60.0°** / 0.231 / 0.278 | 15.7 / 64.6° / 0.259 / 0.224 | 68.6° → **83.6°** |
| D_log | 13.8 / **63.2°** / 0.224 / 0.235 | 27.6 / 71.5° / 0.176 / 0.265 | 63.8° → **72.0°** |
| E_ground | 21.3 / **63.2°** / 0.244 / 0.280 | 27.2 / 69.2° / 0.220 / 0.243 | 64.8° → **69.1°** |
| F_canopy | 18.8 / **63.8°** / 0.182 / 0.237 | 27.1 / 68.0° / 0.241 / 0.220 | 60.0° → **77.8°** |
| mean | **62.3°** / 0.230 / 0.260 | 68.3° / 0.226 / 0.240 | 63.7° → **74.7°** |

The reference's foliage sits at **60–64° in every frame** — yellow-olive, the same hue near and far,
in sun and in haze. Ours is 65–72° over the whole frame and **69–84° in the canopy band**: the
crowns are the green part, 8–15° further from yellow than the frame's, worst where the far crowns
sit in the haze (C-top 84°, F-top 78°, A-top 77°). Saturation is *not* the problem (0.23 vs 0.23
overall; canopy band 0.14–0.20 vs the frame's 0.14–0.23) and luminance is close (ours 0.02 darker).
Ours also shows 1.5–2× the foliage area (D 27.6 % vs 13.8 %) — more crown in view, so the hue error
weighs more. **Target for astra-trees / trees-31 / distant:** crown hue **62–65°** (shift the canopy
layer −10 to −15°, the far crowns most), sat held, l held; check with this mask at C-top and F-top.

### 7.2 "Stones under-detailed" — the paving matches; the boulders and walls are flat in the large

| stone region (slabs in both) | ref: mean l / macro σ / micro σ | ours | read |
| --- | --- | --- | --- |
| A (0.25–0.75 × 0.80–1.0) | 0.524 / 0.110 / 0.066 | 0.497 / 0.096 / 0.063 | equal |
| B (0.30–0.70 × 0.75–1.0) | 0.510 / 0.101 / 0.051 | 0.472 / 0.137 / 0.057 | ours more |
| C (0.45–1.0 × 0.62–1.0) | 0.418 / 0.129 / 0.051 | 0.390 / 0.145 / 0.053 | equal |
| D (0.35–0.70 × 0.72–1.0) | 0.466 / 0.116 / 0.059 | 0.464 / 0.130 / 0.065 | equal |
| E (0.30–0.70 × 0.75–1.0) | 0.480 / 0.110 / 0.061 | 0.471 / 0.136 / 0.057 | equal |
| **D boulder face** — ref (0.04–0.18 × 0.66–0.84) vs our loaf (0.10–0.30 × 0.58–0.85, branch `e5867d7e`) | 0.326 / **0.117** / 0.055 | 0.264 / **0.074** / 0.050 | ours 63 % in the large |
| **rock/root mass** — ref-04 left (0.18–0.40 × 0.20–0.60) vs our `x-ledge-wall` (0.2–0.8 × 0.2–0.8, `89473888`) | 0.252 / 0.136 / **0.052** | 0.198 / 0.124 / **0.034** | ours 65 % in the fine |

The flagstones at 2–8 m carry the reference's detail at both scales — the owner's "stones" is not
the paving. The **boulders and walls** are where we fall short: the D boulder face has 63 % of the
frame's macro contrast (one shaded loaf where the frame's rock has lit planes, a shadowed
undercut and a bright top), and the ledge wall has 65 % of the reference rock mass's fine relief.
fable-2's mid-range texture band (`d4bfed58`, +12 % contrast at 9–30 m) was invisible because the
loss is in the *form* — facets and shadow steps 0.2–0.5 m across — and, at 2–4 m, in fine relief,
not in texture contrast. **Target for rocks:** macro σ ≈ 0.11–0.14 on a lit boulder face (a
second light plane and an undercut shadow per boulder), micro σ ≈ 0.05 on walls at 3 m.

### 7.3 "Weak distant detail" and "wider render distance" — what the frames say

*Distant detail* is §6.6's structural half: through the tunnel window the reference shows **tall
vertical trunks with vines, glowing dots and lantern points and no ground plane** (`d_121`, window
l 0.33); ours shows the north path, the ledge flight, a signpost and smooth cones in haze. The
reference's far layer is *vertical structure in haze*, never a plane — trunks first, crowns
second. *Render distance* meets W38 at camera A (8.68 M after perf-3, ceiling 9.0 M; proposal to
11 M filed): whatever the far layer gains must be spent outside A's frustum or behind a LOD, and
the distant-crown change in `a9eccd15` shows the risk the other way — removing the flat crown
cores cost F −0.030 and C −0.025 against the reference because the canopy's *mass* went with them
(§F of `.agents/reviews/fable-5-r49-branches.md`). Detail in the distance has to keep the dark
silhouette the frames have.

## 8. Status of V1–V21 at take-0125 / head `48156889` (2026-09-21 07:30 UTC)

What the rounds since take-0116 did to the numbered list, from my verdicts (`gauntlet/reviews/`) and
branch measurements (`.agents/reviews/fable-5-r49-branches.md`, `fable-5-r50-branches.md`). "Unverified"
means no measurement of mine covers it yet, not that it is open.

| # | status | evidence |
| --- | --- | --- |
| V1 arch silhouette | **closed** — flat-top crown ≈ 2.2 : 1 (structures-33, D +0.0034), pinpoint lanterns since round 48 | W29 pass on take-0125 |
| V2 no world beyond the arch | **open** — the window shows the north path, a sign and cones; the frame's trunks-and-lights layer is trees-32 / astra-distance | §6.6 structural half; r49 §E |
| V3 right-bank stair from a low lawn | unverified at D since expansion-2 | — |
| V4 house interior black | **closed** — lit, furnished hollow | W25 pass |
| V5 pods in a row | **closed** (six clustered under the eave, frame 7–8) | W26 pass |
| V6 doorway without buttresses | partly — the expansion huts got knotted buttresses (structures-33); the main house's door frame unverified at B | — |
| V7 no mist veil | improved — mist pools under the arch at D and veils the plaza from the lookout; B's north path unverified | W32 pass; r48 walk |
| V8 slabs 1–1.5 m with orange grout | **closed in scale** (span p50 1.06 m, joints 9.5 cm, hardscape-32); **seams overshoot** — joint-like dark px 12.0 % at E vs the frame's 5.4 %, slabs 0.03 darker | §7.2, r49 §T |
| V9 hero boulder unlit behind ferns | improved, **open** — 0.2 m prouder, bare warm face (loaf + value + hue merged); the face sits in canopy shade at l 0.24–0.26 vs the frame's 0.27 and half its chroma; fable-2's four position probes all in shade | r49 §L, §O; W23 fail |
| V10 purple heads everywhere | open (nit) | W18 pass with the note |
| V11 girl without fairy, A-pose | **closed, then hidden** — fairies above-left and a look-around (npc-3); NPCs hidden by the owner's ~21:00 priority | r49 §O |
| V12 second house on a pole + pebble pile at B | unverified | — |
| V13 the 2:22 corridor | partly — the ledge wall stands with beds and relief (fable-2), the tunnel is dark with a bright exit (§E); the corridor's shade between them unmeasured | r49 §E, §L |
| V14 pod posts 1–2 pods on a hook | open (unverified since round 48) | — |
| V15 no closure W / S / N | **mostly closed** — a fence-topped bank, walkway deck and giant to the west, the south bank with its pair and flight (expansion-2, fable-2, fable-3); the north-west / far hut wait for a pose | r49 walk |
| V16 slab scale | **closed** (see V8); seams the next pass | §7.2, r49 §T |
| V17 tread gradient inverted | **open** — 0.31 → 0.18 → 0.17 at `w23-stairs-f`, unchanged by the tread lightening: the upper flight is in canopy shade, the frame's climbs into a haze gap — a light, not an albedo | r49 §T |
| V18′ cut-stone flight | **open** — W02 fail on take-0125; RUBRIC_PROPOSALS carries the log-riser criterion | W02 |
| V19 tunnel not a tunnel | **tonal half closed** (frame 0.147 vs 0.141, window : wall 5.8 vs 5.0); structural half = V2 | r49 §E |
| V20 pale pairs at the banks' feet | **landed on the south bank** (smaller and greyer than `d_087`'s); the other banks open | r49 §I |
| V21 the C-frame anchor | **landed** — the stair-foot loaf replaced by the anchor at (7.2, 3.1) (merged `7eb5f707`; C +0.0032, F −0.0042 for a rock the frame never had) | r49 §N, §P, §S |

Baseline note for the six views: two owner-approved changes moved them since take-0123 — NPCs hidden
(C −0.0018, E +0.0037) and the demo-scale paving (B −0.0103, C −0.0118, F −0.0151 on take-0125). Deltas
of that size in the next takes are those, not a lane's drift.
