# fable-5 — LANE 10 (walkthrough QA and performance): the play-head build against the owner's recording, 2026-09-23 07:52 UTC

Build: the head `e4ca3241` / world `f56c5740` (the play-head republish). Owner's words (06:50): "the trees do not
populate" — the middle distance is grey haze with bare trunks where his own recording `review46/r_020–r_028` shows
small and medium trees with round leafy crowns and dense shrubs at every depth; thicker grass on the left of the paths;
the steps log-risered; the path splitting into the forest; the people back. His marked screenshot: play mode on the north
path looking north from the plaza's north end, Link ≈ (1.5, −14).

## 1. The owner's pose against his recording

Rendered on the head with the character on at the owner's bearing — camera (1.5, 3.2, −10.5) → (1.5, 1.6, −26), fov 50 —
and two more along the same run (`fable-5-lane10/northpath-poses.json`); his frames `r_020–r_028` beside them
(`fable-5-lane10/owner-0650-pose-vs-r024.jpg`, `review46-r020-r028.jpg`).

| upper-middle band (rows 0.12–0.50) | bright mist (l > 0.5, s < 0.22) | bark / earth brown (h 15–50°, l < 0.45) | near-black |
| --- | --- | --- | --- |
| owner's r_021 / r_024 / r_026 | **15 / 23 / 23 %** | 11 / 1.3 / 1.9 % | 30 / 12 / 8 % |
| ours at the owner's pose / r_020-like / r_026-like | **2.0 / 3.3 / 2.0 %** | **16.6 / 9.8 / 10.0 %** | 18 / 25 / 32 % |

What the eye sees, in order of size: **(a)** the reference's middle distance is *trees in warm mist* — trunks with round
leafy crowns at 10–40 m stacked in depth, bright mist between them (15–23 % of the band); ours is a **trench** — the path
runs between two steep cut earth banks (brown, 10–17 % of the band) with column trunks rising from them and no crowns at
10–40 m over the banks; the mist behind is dark grey (2–3 % bright); **(b)** the reference path is packed dirt with a few
slabs and ferns / purple flowers at the verges; ours is continuous stone slabs with dark joints (V16) between two mown
banks; **(c)** the reference bends the path past Saria's mound toward the house and into the woods; ours runs straight
into the far haze. The owner's two red circles are (a): the smooth pale column trunk left of the path and the empty grey
middle distance over it.

## 2. Ranked issue list at player height, with positions

| # | issue | where (position / bearing) | owning lane | measured |
| --- | --- | --- | --- | --- |
| 1 | **No crowns at 10–40 m over the north path**: the banks' tops carry no small / medium trees; the column trunks rise bare into grey; the reference stacks round leafy crowns at every depth | (1.5, −14) looking north; also (0.8, −4.5) and (1.8, −17.5) | 2 (trees in the distance) + 3 (column trunks) | bright mist 2 % vs 15–23 %; brown banks 10–17 % vs 1–2 % |
| 2 | **The mist is dark grey, the reference's bright and warm** — the "grey washout": the light behind everything is cool (#777c7e-class) where the frames' is warm khaki (#858372) | every pose looking out or up | 1 (atmosphere) | `reference/ANALYSIS_CLARITY.md` §3, §5 |
| 3 | **The path corridor is a cut trench**: steep bare earth banks either side of the spine north of the plaza, mown lawn on top; the reference's path sits in a shallow shrubby swale (ferns, purple flowers, low shrubs) with the ground rising gently into the trees | the spine (1.5, −4) → (1.5, −30) | 4 (vegetation: the verges) + 6 (paths) + 2 (trees on the banks) | the owner's "thicker grass on the left" is the left bank of this corridor |
| 4 | **The path is stone slabs with continuous dark joints**; the reference's north run is packed dirt with occasional slabs | the spine north of the plaza | 6 (paths / hardscape) | V16: seam −0.29 below the slab vs −0.15; the joint read r55 §K.1 |
| 5 | **The flight's treads are in shade, the logs dark**: the frame's flight is pale packed treads climbing into light; ours 52.8 % dark vs 15.9 (weathered logs on shaded treads) | A, `s2-owner` (4.4, 1.98, 0.27) → (9.53, 2, −3.77) | 6 (steps) + 1 (the light on the slope) | r55 §W; fable-4's flight-shade 0.376 shadowless vs 0.65 |
| 6 | **The path does not fork into the woods**; the reference's run bends past Saria's mound and splits (house / woods) | north of Saria's mound, (6, −12) … (2, −30) | 6 (paths) with fable-cursor (layout) | r_024–r_028 |
| 7 | **No people**: the demo's kids on the path and the bank, the girl by the signpost | the plaza, the north path | 7 (people) | hidden by `backgroundCast.visible = false` |
| 8 | **The D boulder in the giants' shadow**; V16's seams; the giants' limbs at frame scale | D; the plaza; B | 3 / 6 | r55 §J/§L, §K.1 |

## 3. Walkability and performance on the head (`playtest.mjs --only walk,climb,perf,pacing`, 960 × 540, quality high, SwiftShader)

- **Walk routes:** `plaza-to-upper-house` (6/6 waypoints), `plaza-to-south-bank-top` (4/4), `saria-front-arc` (3/3),
  `west-deck` (3/3) — **all reached, no stuck points.**
- **Climbs:** the south-bank flight up and down clean (top reached, bottom reached, no stalls). The main flight up: no
  stalls, max rise 0.27 m/frame, but **not at the top after 255 frames (y 4.32 of 5.40)** — the route's frame budget, not
  a block, on the trace; the descent's camera comes within **0.38 m of the ground** (`minCameraAboveGroundM 0.383`, the
  ascent's 1.77) — worth a look by the camera owner: on the way down the flight the follow camera nearly touches the treads.
- **Frame cost at four play spots** (draws / triangles; SwiftShader wall time is CPU rasterisation, not a GPU):
  plaza **521 / 7.43 M**, `stairs2-base` **522 / 9.53 M**, `saria-side` 519 / 8.59 M, `west-house` 442 / 5.03 M. **A walker
  standing at the foot of the main flight renders 9.53 M triangles — over the 9.0 M W38 cap that camera A is held to**
  (A itself is 8.7 M). The play view is the owner's view now; the cap should be read at the play spots, and the flight's
  foot is the first place to cut (the blades to 26 m and the near giant's canopy are the likely mass).
- JS step 18–32 ms per frame at these spots (render 13–30 ms of it) — fine on a real GPU box; the wall times here (19–33 s a
  frame) are SwiftShader's.
- **Pacing** (plaza → second staircase → upper house, 21 simulated s, 630 frames; JS step per frame, a drawn frame every
  12): **JS step p50 4.2 ms, p95 8.7, p99 11.2, max 46.6 (frame 0)**; 39 frames over the harness's hitch rule (> 8 ms),
  none above 12 ms after frame 0 — the worst at (10.7, 1.9, −1.9) on the flight, 11.9 ms; **no shader compiles during the
  walk (programs 104 → 104)**; heap 1,325 → 1,227 MB (the `onUpload` releases as the walk uploads). Drawn frames 12.5–19.9 s
  wall here (SwiftShader), 10–22 ms of it the renderer's own issue time. **Smooth by the JS side; on a GPU box the walk
  should be hitch-free** — the load is the only wait (see the play-head boot: fable-cursor's pass-3 evidence puts ready at
  81 s from githack).

## 4. What this lane asks of the others (the owner's 24 h)

1. Lane 2 with lane 3: trees *on the banks* of the north corridor at 10–40 m — round-crowned small and medium trees, not
   only the far ring — and bark on the column trunks. This is the owner's circle 1 and 2 in one.
2. Lane 1: the mist bright and warm (`ANALYSIS_CLARITY.md` §5's #858372 at the top of frame, the far bands back to
   l 0.40–0.50), so the trees that lane 2 adds stand *in* light rather than against grey.
3. Lane 4 / 6: the corridor's banks as shrubby swales with ferns and flowers at the verges; the north run as dirt with
   occasional slabs; the fork past Saria's mound.
4. Everyone: read the triangle cap at the play spots, not only at A — `stairs2-base` is at 9.53 M today.

Verification poses for all of the above: `fable-5-lane10/northpath-poses.json` (`broll.mjs --shots … --character`), and
the owner's own `art/environment/owner-2026-09-23/shots.json`.

## 5. Re-read at the owner's pose after the 07:50–08:29 head (`f56c5740` → `9a1be295`: "clearer air between the shafts" ×2, the left bank's full turf)

| upper-middle band (0.12–0.50) | bright mist | brown bank | near-black | mean l |
| --- | --- | --- | --- | --- |
| owner's r_024 | **22.6 %** | 1.3 % | 12.4 % | — |
| ours `f56c5740` (07:00) | 2.0 % | 16.6 % | 17.6 % | 0.300 |
| ours `9a1be295` (08:29) | **0.9 %** | 17.3 % | **24.6 %** | **0.263** |
| the r_020-like / r_026-like poses | 3.4 → 0.9 % / 2.0 → 0.7 % | | 24.9 → 30.4 / 31.5 → 38.4 % | 0.302 → 0.263 / 0.275 → 0.239 |

**"Clearer air" darkened the corridor at the owner's pose.** The base air was raised (6 / 16 m) to show trees instead
of haze; at his bearing the far trunks became darker silhouettes in a darker grey — the band lost 0.04 of luminance and
its bright mist fell by half — while nothing new populates it (no crowns arrived; that is lane 2's). The recording's
"clear" is the opposite reading: **bright warm mist with trees standing in it** (22.6 % of the band bright, near-black
12 %). This is the fog slice's failure mode again (`ANALYSIS_CLARITY.md` §3): thinning the veil removes the light with it.
What the frames ask for at this pose is the mist *brighter and warmer* (§5's #858372) and the trees *in* it, not thinner
darker air. **The left bank's turf** (`d19439cc`, D's hollow z −16…−26 at 88 % height, coverage fill on): at the owner's
pose the left bank region (x < 0.33, y 0.45–0.90) is unchanged — mean l 0.195 → 0.193, blade texture 0.0292 → 0.0288 —
the change is not in this framing (the bank he sees is the shaded slope beside the path, in view but not lit; the
hollow's blades are behind the rise). Sheet `fable-5-lane10/owner-0650-pose-f56c5740-vs-9a1be295.jpg`.

## 6. The squad branches at the owner's pose, one at a time (`squad1` `bca84c5a` haze, `squad2` `064a004b` mid canopy, `squad3` `06dd10c1` near bark — each against their merge-base `144453ef`)

Same three poses (`northpath-poses.json`), same flags (`--character`, settle 8), rendered here 09:33–10:00 UTC. The band
metrics from here on are `fable-5-lane10/bands.py` (HLS; mist l > 0.5 ∧ s < 0.22; brown h 15–50° ∧ l < 0.45 ∧ s > 0.10;
near-black l < 0.20; leafy h 60–170° ∧ s > 0.15) — the same reads as §1/§5 within 1.5 points (base row 1.1 / 17.4 / 26.0 /
0.263 against §5's 0.9 / 17.3 / 24.6 / 0.263). The far-centre box is x 0.30–0.70 × y 0.15–0.40 — the grey the owner circled.

| owner's pose (1.5, 3.2, −10.5) → north | pixels moved > 6 / > 40 levels | bright mist | brown | near-black | leafy | mean l | far-centre box (hex · hue · sat · l · B/R) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| owner's r_024 | — | **23.1 %** | 1.2 % | 11.6 % | 3.4 % | 0.394 | #7f7c73 · 44° · 0.05 · **0.474** · 0.91 |
| base `144453ef` | — | 1.1 % | 17.4 % | 26.0 % | 13.1 % | 0.263 | #4e514c · 89° · 0.03 · 0.308 · 0.97 |
| squad1 haze | 39.6 / 0.0 % | 0.7 % | 28.8 % | 30.7 % | 16.3 % | 0.260 | **#57554a · 50° · 0.08 · 0.316 · 0.86** |
| squad2 mid canopy | 16.6 / **5.1 %** | 1.0 % | 22.5 % | **35.3 %** | **16.7 %** | 0.248 | #515449 · 74° · 0.07 · 0.308 · 0.90 |
| squad3 near bark | 6.2 / 0.0 % | 1.1 % | 17.9 % | 29.2 % | 13.4 % | 0.259 | #4e504b · 88° · 0.03 · 0.304 · 0.97 |

The other two poses read the same way (r_020-like: squad1 44 % of pixels, box 93° → 51°, l 0.310 → 0.341; squad2 14 %,
near-black 26 → 33 %; squad3 1.7 %. r_026-like: squad1 32 %, 64° → 47°, l 0.287 → 0.272; squad2 13 %, leafy 26 → 32 %;
squad3 3.1 %).

- **squad1 fixed the hue and not the light.** The far field turns from cool grey-green (89°, B/R 0.97) to the recording's
  warm khaki (50° against r_024's 44°, B/R 0.86 against 0.91) over 40 % of the frame — but its luminance stays at
  0.316 where the recording's far box is 0.474, so the warm grey reads as *dark khaki* (the "brown" bucket takes it:
  17 → 29 %) and the bright-mist share falls (1.1 → 0.7 %). §5's lever was "#858372 **at the brightness kept**": the
  hue half landed; the far bands still need +0.15 of l (see `ANALYSIS_CLARITY.md` §3 for how the 08-08 fog slice took it).
- **squad2 populates the band and darkens it.** Round crowns and young trees stand in the 14–58 m band where the base had
  bare trunks (5 % of pixels moved > 40 levels — new geometry, not tint; leafy 13 → 17 %). Against the base's dark air they
  are silhouettes: near-black 26 → 35 %, mean l 0.263 → 0.248. This is the owner's "trees populate", and it is exactly why
  lane 1's light has to arrive with it — the recording's crowns are lit shapes in bright mist, not dark shapes in grey.
- **squad3 is local**: bark cords, moss and knees on the near columns (6 % of the frame at the owner's pose, 0.0 % > 40
  levels); the band composition is unchanged within 3 points. Two readings of the owner's circle 1 are now on record:
  fable-cursor's depth pick (09:15) names the far-trunk row `distant-5-near` at 37–48 m (`75622db9` darkens it); `squad3`
  @ `68c24262` names the column at (−3.5, −24.7), 15 m, with the thin pale poles beside it as the distant family at
  39–55 m — a metre past `DISTANT_BARK_M` = 38 m, where the near-bark treatment switches off. Both agree the pale poles
  in the circle are the distant family beyond 38 m; whoever owns that constant should read the circle before closing it.

Sheets: `fable-5-lane10/it83-ba-sq1.jpg`, `it83-ba-sq2.jpg`, `it83-ba-sq3.jpg` (base | branch, the owner's pose, crop
x 0–0.50 × y 0–0.70).

## 7. The merged head `6664f739` (squad 1 + 2 + 4 live, play-head `a44b4a19`) at the owner's pose — populated, warm, and darker than his recording

Rendered 10:08–10:23 UTC, same poses / flags as §6; sheets `fable-5-lane10/it83-ba-head-owner.jpg` (base | head, full
frame) and `it83-head-vs-r024.jpg` (head | the owner's r_024). Two befores: the squad merge-base `144453ef` (§6's; it
carries the thinned air of 08:29 that `7244aab6` later backed out, so its band is the dark one of §5), and `f56c5740`
(07:00, §1's frames — the same 3 / 6.5 m base air the head has now, so the fairer before for the squad batch itself).

| pose | pixels moved > 6 / > 40 | bright mist | brown | near-black | leafy | mean l | far-centre box |
| --- | --- | --- | --- | --- | --- | --- | --- |
| owner's pose — r_024 | | **23.1 %** | 1.2 % | **11.6 %** | 3.4 % | **0.394** | #7f7c73 · 44° · s 0.05 · **l 0.474** · B/R 0.91 |
| owner's pose — `f56c5740` | | 2.3 % | 16.7 % | 21.7 % | 10.9 % | 0.300 | #5d5e59 · 80° · 0.03 · 0.360 · 0.96 |
| owner's pose — `144453ef` | | 1.1 % | 17.4 % | 26.0 % | 13.1 % | 0.263 | #4e514c · 89° · 0.03 · 0.308 · 0.97 |
| owner's pose — head | 83.5 / 19.4 % (vs `f56c5740`) | 1.4 % | 30.4 % | **48.9 %** | 22.2 % | **0.230** | #5b5947 · 55° · s 0.12 · **l 0.318** · B/R 0.79 |
| r_020-like — r_021 | | 15.5 % | 11.3 % | 39.1 % | 1.7 % | 0.298 | #6c675f · 36° · 0.07 · 0.398 · 0.87 |
| r_020-like — `f56c5740` | | 3.7 % | 10.0 % | 21.5 % | 9.9 % | 0.302 | #5d5f5a · 83° · 0.03 · 0.362 · 0.96 |
| r_020-like — head | 69.3 / 12.0 % | 1.9 % | 22.3 % | 30.8 % | 20.2 % | 0.261 | #605e4f · 53° · 0.10 · 0.343 · 0.82 |
| r_026-like — r_026 | | 23.2 % | 1.9 % | 6.2 % | 1.6 % | 0.410 | #7f7c72 · 45° · 0.06 · 0.474 · 0.90 |
| r_026-like — `f56c5740` | | 2.2 % | 11.0 % | 33.3 % | 25.0 % | 0.275 | #5d5d55 · 61° · 0.04 · 0.350 · 0.92 |
| r_026-like — head | 73.7 / 14.9 % | 0.7 % | 20.5 % | 49.6 % | 36.3 % | 0.221 | #585645 · 53° · 0.12 · 0.307 · 0.78 |

**What landed** (the sheet): round leafy crowns stand behind the path at several depths where the base had bare trunks
in grey — the owner's "trees populate" is answered in kind; violets mass along both verges; the far air is the recording's
warm hue (55° / B/R 0.79 against 44° / 0.91; the base's 89° / 0.97 cool grey is gone). Nothing in the band is haze any
more: the middle distance is *trees*.

**What is still wrong, and it is one thing: the light.** Against the same-air before (`f56c5740`) the band is now
**darker by 0.07** — mean l 0.300 → 0.230, near-black 21.7 → **48.9 %** at the owner's pose (the two other poses
0.302 → 0.261 and 0.275 → 0.221) — where the recording's band is 12 % near-black at l 0.394, and its bright mist is
23 % of the band against our 1.4 % (2.3 % before). The far-centre box — the grey the owner circled — went from
l 0.360 to **0.318** (the same-air before; 0.308 on the thin-air base): the warm veil arrived *darker* than the cool
grey it replaced, and the recording's is 0.474 — the gap widened from 0.11 to 0.16. The crowns that populate the
14–58 m band arrive in their **local colour**: in the far-centre box the head's green-hued pixels are 43 % of the box
with mean saturation **0.15** and lightness **0.29**; in r_024 the same box's green-hued pixels (26 %) have saturation
**0.05** and lightness **0.42** — the recording's distant crowns are 80 % of the way to the mist's colour (#7f7c73),
pale warm silhouettes with light between them; ours are saturated green shapes against a dark warm grey. The far box is
also more saturated than the frames (s 0.12 against 0.05): the warm tint is strong for the brightness it sits at.

Where the light sits — mean HLS lightness on an 8 × 6 grid of the owner's pose (`f56c5740` → head, r_024 for the target):

```
f56c5740 (07:00)                                  head 6664f739                                     r_024 (the owner)
0.38 0.42 0.40 0.35 0.32 0.32 0.26 0.24           0.15 0.21 0.33 0.28 0.30 0.23 0.17 0.18           0.43 0.40 0.55 0.53 0.47 0.39 0.29 0.32
0.37 0.37 0.39 0.37 0.32 0.30 0.21 0.21           0.18 0.17 0.29 0.30 0.34 0.26 0.18 0.18           0.27 0.47 0.45 0.49 0.51 0.42 0.33 0.36
0.25 0.25 0.30 0.40 0.39 0.23 0.19 0.18           0.19 0.15 0.25 0.33 0.34 0.19 0.17 0.17           0.12 0.22 0.32 0.49 0.56 0.50 0.39 0.32
0.18 0.18 0.20 0.34 0.29 0.22 0.19 0.17           0.19 0.19 0.18 0.29 0.25 0.20 0.18 0.16           0.07 0.12 0.19 0.40 0.63 0.54 0.34 0.29
0.17 0.17 0.19 0.29 0.30 0.21 0.21 0.17           0.15 0.21 0.21 0.26 0.25 0.19 0.18 0.15           0.07 0.13 0.15 0.23 0.38 0.32 0.20 0.12
0.18 0.15 0.23 0.40 0.41 0.32 0.22 0.23           0.18 0.19 0.19 0.27 0.24 0.21 0.18 0.21           0.10 0.12 0.19 0.28 0.25 0.16 0.10 0.11
```

The recording's light is in the **middle rows** (the vanishing point 0.40–0.63, mist between lit crowns) and along the
**top** (canopy gaps 0.40–0.55). The head's brightest cell is 0.34. The top band (rows 0–0.12) fell 0.335 → **0.232**
(the recording 0.418): the new mid-canopy crowns **closed the gaps over the path** at this pose; the vanishing-point box
(x 0.42–0.58, y 0.40–0.50) fell 0.401 → **0.337** (the recording 0.562). Lane 1's own note in `heightfog.ts` aimed the
far veil at display 0.645 and his vanishing point at 0.545 — measured on the haze branch alone; with the crowns in front
of the veil the pixel a walker sees is the crown, and the crown is dark.

So the ranked list at the owner's pose after the squad's first batch:

| # | issue | measured | owning lane |
| --- | --- | --- | --- |
| 1 | **The far air is warm but darker than the grey it replaced**: far-centre l 0.360 → 0.318 vs the recording's 0.474; bright-mist share 2.3 → 1.4 vs 23 % | §7 table | 1 |
| 2 | **The mid-canopy crowns keep their local colour at 14–58 m and close the gaps overhead**: green s 0.15 / l 0.29 in the far box vs the recording's 0.05 / 0.42 — atmospheric perspective on the crowns (toward the far air's colour, by depth) is missing or too weak; the top band 0.335 → 0.232 (his 0.418) — the recording keeps bright gaps over the path between the crowns | §7 grid | 2 with 1 |
| 3 | The path: continuous stone slabs with dark joints; the recording's north run is packed dirt with a few slabs | §2 #4 | 6 (open) |
| 4 | The right bank is still a cut earth wall (brown 30 % of the band, the recording 1 %); the verges are dressed now, the bank face is not | §2 #3 | 4 / 6 |
| 5 | The path does not fork past Saria's mound | §2 #6 | 6 (open) |
| 6 | No people | §2 #7 | 7 (open) |

The cheapest experiment for (1)+(2) is one number each: the far air's brightness (the fog / veil colour's l toward
0.47 at the far bands, the hue kept) and the crowns' fog weight in the 14–58 m band — both measured at this pose with
`bands.py` before and after, the six views inside −0.003. This lane will read whatever lands within the hour it lands.

### 7a. The six fixed views on the head (`f56c5740` → `6664f739`, `broll --test --settle 8`, no character, same list) — the squad batch costs 0.008–0.033 on every view

| | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| SSIM vs reference, `f56c5740` | 0.1979 | 0.1820 | 0.1964 | 0.2504 | 0.2041 | 0.2091 |
| SSIM vs reference, head `6664f739` | 0.1786 | 0.1636 | 0.1752 | 0.2185 | 0.1711 | 0.2009 |
| **Δ** | **−0.0193** | **−0.0184** | **−0.0212** | **−0.0319** | **−0.0330** | **−0.0082** |
| pixels moved > 6 levels | 36 % | 41 % | 39 % | 51 % | 40 % | 24 % |
| mean luma: reference / before / head | 0.422 / 0.346 / 0.339 | 0.393 / 0.333 / 0.325 | 0.383 / 0.316 / 0.317 | 0.421 / 0.340 / **0.320** | 0.388 / 0.334 / 0.325 | 0.398 / 0.318 / 0.308 |

This is ten times the −0.003 rule on five of the six views — an owner-directed look change (the 06:50 brief), so it is
fable-cursor's call, not a fail to file; but the take will show it, and the direction against the frames is the same one
as at the owner's pose: **every view is darker** (mean luma −0.007 to −0.020; the frames are 0.07–0.10 brighter than
ours already) and the upper halves fill with saturated crowns where the frames have pale lit canopy and bright gaps.
Expected take-0135 row on this head, chained from take-0134's seal (0.2181 / 0.1984 / 0.2130 / 0.2655 / 0.2189 / 0.2253)
through fable-2's `47773f13` → `f56c5740` deltas: A ≈ 0.198, B ≈ 0.180, C ≈ 0.192, D ≈ 0.234, E ≈ 0.186, F ≈ 0.219
(± 0.003). Sheets `fable-5-lane10/it83-ba-six-A.jpg`, `it83-ba-six-D.jpg`.

### 7b. Split at the squad merge-base `144453ef` (its six views rendered 10:41–11:09, same harness)

| | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| `f56c5740` → `144453ef` (the 07:00–08:54 head: the thinned air, the far-trunk bark, the grass, the basket, the near skin) | −0.0036 | −0.0086 | −0.0006 | −0.0117 | −0.0015 | −0.0002 |
| `144453ef` → `6664f739` (the squad batch + `7244aab6`'s air restore + `75622db9`) | −0.0157 | −0.0098 | −0.0206 | −0.0202 | −0.0315 | −0.0080 |

The first row is the thinned air (`b7be503e` / `9a1be295`) that `7244aab6` backed out — fable-cursor's own hero reads
of it were the same sign (top thirds A −6.2, B −8.5, D −8.9 levels). Since the head carries the restore, the two rows
sum to 7a's numbers and **the squad batch is the whole of 7a**: roughly A −0.019, B −0.018, C −0.021, D −0.032,
E −0.033, F −0.008 against the frames, with the 07:00 air on both sides.

## 8. Walk QA and frame cost on the head `6664f739` (`playtest.mjs --only walk,climb,perf,pacing`, 10:25–11:06 UTC; the harness now runs nine routes with camera motion and the boots' contact)

- **Routes: 9 / 9 reached, no stuck points** — the four of §3 plus `plaza-loop`, `south-approach`,
  `house-west-to-saria-door`, `west-house-to-plaza`, `north-clearing-ledge` (82 m, 15 waypoints, the arch and the ledge).
  The verge shrubs and the mid canopy block nothing on the routes. Climbs identical to §3 (the main flight's frame
  budget still ends at y 4.32 of 5.40; the descent camera 0.383 m over the treads).
- **Camera pops** (one-frame jumps of the follow camera, from the harness's spike list): **`west-house-to-plaza`: 1.26 m
  in one frame** (1,128 m/s²) with Link at (−16.8, 2.9, 6.6), the camera pulling from (−18.5, 4.6, 7.1) to (−17.4, 4.4,
  6.8) against a *solid* shell — the west house's wall behind the walker as he turns for the plaza — and **0.67 m** two
  metres on at (−15.4, 2.6, 6.8), also solid → solid. `8ab27c48` eased the *slim* pushes (they read 0.19–0.42 m here:
  the lantern limb at (0.8, −2.0), the house bough at (16.4, 5.4, −7.6), the south-bank post at (−13.7, 13.5)); the
  solid shells still pull in at once by design — at the west house that is a 1.3 m pop a player sees every time he
  leaves it. **`north-clearing-ledge`: 0.37 m** at (5.75, 4.48, −60.4) as the camera's *lowered* state (0.3) releases
  into a solid hit — the ledge's edge, worth one look by the camera's owner. Everything else ≤ 0.3 m.
- **Camera height**: `west-house-to-plaza` brings the camera to **0.365 m** over the ground, `plaza-loop` to 0.414 m,
  `plaza-to-south-bank-top` 0.603 m (the flight's descent 0.383 m in §3) — with the look-up pitch range the camera skims
  the ground on descents; a floor of ≈ 0.6 m would keep it out of the grass.
- **The boots** (`footprintLowestM`: the boot's lowest point over the rendered surface, ≈ 0 standing, > 1 cm a whole
  boot floating): **`saria-front-arc` p50 2.9 cm, p95 8.0 cm, max 10.8 cm** — Link floats over Saria's forecourt for
  most of the arc; **`west-deck` p50 2.1 cm, max 4.1 cm** over the deck timber; `plaza-to-upper-house` max 13.5 cm float
  and **−31 cm** at the other end (a boot corner 31 cm inside the surface — on the flight, the collision height against
  the rendered treads); the plaza, the south approach and the north path are clean (p50 0, p95 ≤ 1.2 cm). Lane 8 (Link)
  with the collision owner: the two surfaces (Saria's forecourt, the west deck) sit under the walk height.
- **Frame cost at the four play spots**, `e4ca3241` (07:34) → `6664f739`: plaza **521 → 574 draws / 7.43 → 8.00 M**
  triangles, `stairs2-base` **522 → 571 / 9.53 → 9.67 M** (the cap is 9.0 M at A; the flight's foot was over it before
  the squad and is 0.67 M over now), `saria-side` 519 → 571 / 8.59 → 8.88 M, `west-house` 442 → 479 / 5.03 → 5.10 M.
  Draws +37 … +53 (the mid canopy's near LOD to 40 m, the verge shrubs, the understory), all under 700; triangles
  +0.06 … +0.57 M. Programs 104 → 107, still **no shader compiles on the walk**.
- **Heap**: 1,341 MB at the walk's start, **1,349 at its end** (07:34: 1,325 → 1,227). The `onUpload` release that took
  98 MB off during the 07:34 walk no longer shows — the batch's new geometry (`understory.ts`, `distant.ts`'s mid
  canopy, the verge plants) either keeps its arrays or is uploaded before the walk; +122 MB retained at the walk's end
  against the last read. The capture box's memory rule (r55 §E–§G) is the reason to look.
- **Pacing** (`--only perf,pacing` re-run **alone** 11:11–11:29 — the 10:37 pass ran beside a second Chrome and is
  discarded; the 07:34 run itself had a render beside it, so the comparison below flatters the head if anything):
  plaza → second staircase → upper house, 630 frames — **JS step p50 4.2 → 6.2 ms, p95 8.7 → 13.5, p99 11.2 → 22.6**,
  hitches 39 → 56; frames over 12 ms after frame 0: **0 → 20**, the worst 42.5 ms at frame 85, Link at (5.1, 0, 1.3)
  on the plaza. By segment: **the plaza (frames 1–200) p50 4.1 → 10.4 ms, p95 8.6 → 18.9**; the flight 3.7 → 4.3; the
  upper 5.0 → 5.6. Drawn frames' render issue p50 10.0 → 11.8 ms. No shader compiles (107 → 107). **Heap 1,208 →
  1,307 MB across the walk** (+99 MB; 07:34: −98). The world update at the four spots (the step less its render):
  plaza **4.8 → 7.3 ms**, `stairs2-base` **5.0 → 13.6**, `saria-side` 5.6 → 9.4, `west-house` 2.2 → 7.6 — the batch
  added 2.5–8.6 ms of per-frame JS at player height by these two runs (the 07:34 spot numbers were taken beside a render,
  so the true growth is smaller than that — see the split below); on a 60 Hz box `stairs2-base`'s 13.6 ms is most of the
  frame before a draw is issued.
- **Which system** (`__ZR__.perf().systems`, ms per step averaged over 60 steps at each spot after a 30-frame settle,
  one Chrome, `fable-5-lane10/sysperf.mjs`; head | `f56c5740`): **trees 4.9 | 6.1** at the plaza, **5.9 | 2.3** at
  `stairs2-base`, 6.0 | 5.9 at `saria-side`, 3.3 | 3.7 at `west-house`; character 0.5–2.0 | 0.6–2.4; every other system
  (vegetation, atmosphere, rocks, structures, lighting, hardscape, wind) **< 0.1 ms** on both builds. The trees' time is
  the near-LOD pools' geometry builds inside `NEAR_LOD_BUILD_BUDGET_MS` = 6 plus the re-bucket / cull — it reads as "up
  to 6 ms for as long as builds are pending", on both builds. What the batch changed is *how long* they are pending:
  the mid canopy's near LOD to 40 m and the understory put more parts inside the pre-fetch radius per metre walked. The
  heap over the 60 measured steps says the same — head **+67 MB** at `stairs2-base` and **+69 MB** at `saria-side`
  (`f56c5740` +28 / −10), the plaza +16 (+38) — and so does the walk (§8 pacing): the plaza segment's p50 4.1 → 10.4 ms
  is the pools building through the first 200 frames, and the +99 MB across the walk is their output. The 42.5 ms frame
  at (5.1, 0, 1.3) is the kind of frame that produces. Lane 2 / fable-cursor: the mid canopy's near LOD radius (40 m)
  against the pool budget is the lever; the trees' `perf()` report (`nearCanopyPool`, builds / evictions / bytes within
  the swap radii) names what is being built.
- **Load**: world ready in 74.1 s alone here (07:00's `f56c5740`: 73.4 s; SwiftShader CPU time, not a GPU box); the
  bundle 2.04 → 2.06 MB, textures and models unchanged (114.9 MB dist).

## 9. Re-read on `0149f255` (11:20 — lanes 1–5's next pushes: lane 1's third mist tier and lit far wall, lane 2's steep crown fade by distance, lane 4's closed forest floor; play link `d49ecc9d`)

Same poses / flags, before = `6664f739` (§7). Sheet `fable-5-lane10/it84-ba-owner.jpg`.

| owner's pose | pixels > 6 / > 40 | bright mist | near-black | mean l | far-centre box (l · s) | vanishing box l | top band l |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r_024 | | 23.1 % | 11.6 % | 0.394 | 0.474 · 0.05 | 0.562 | 0.418 |
| `6664f739` | | 1.4 % | 48.9 % | 0.230 | 0.318 · 0.12 | 0.337 | 0.232 |
| `0149f255` | 8.6 / 0.5 % | 2.8 % | 48.8 % | 0.237 | **0.342** · 0.10 | **0.362** | **0.230** |

A step in the right direction and a small one: the far-centre box +0.024 (of the +0.156 to the recording), the
vanishing point +0.025 (of +0.225), the saturation 0.12 → 0.10 (his 0.05); the two other poses the same (+0.022 /
+0.044 in the far box, mist 1.9 → 3.3 % / 0.7 → 2.3 %). **The near-black share did not move (48.9 → 48.8 %) and the top
band did not move (0.232 → 0.230)** — the crowns still roof the path at his pose, and their colour at depth is the same
(green-hued pixels of the far-centre box: s 0.15 → 0.15, l 0.29 → 0.30; his 0.05 / 0.42): lane 2's steep fade by
distance does not reach the crowns this pose sees at 14–40 m, or is too shallow there. The asks of §7 stand at
these sizes: +0.13 in the far air's l, the crowns toward the veil's colour, the sky over the path open.

**Six views `6664f739` → `0149f255`** (same harness as 7a): A −0.0009, B −0.0007, C −0.0015, D +0.0019, E +0.0016,
F +0.0004 — inside ±0.002, 0.3–6.6 % of pixels moved, mean luma +0.002 … +0.004 (the lit far wall, the treads' earth).
Expected take-0135 row on this head: A ≈ 0.197, B ≈ 0.179, C ≈ 0.190, D ≈ 0.236, E ≈ 0.188, F ≈ 0.220 (± 0.003).

## 10. The owner's own four 09-23 poses on `0149f255` (`art/environment/owner-2026-09-23/shots.json`; before = `a5dbf45f`, the last read of these poses, r55 §Y — `s2-owner` / `b-upper-2` / `h-west-front` were byte-identical from there to `f56c5740`; `u-open-up` carries `c526a5b8`'s card fix inside the delta)

Rendered 12:31–12:43 UTC, no character, same list / order / flags as §Y. Sheets `fable-5-lane10/it85-ba-{s2,u-open-up,b-upper-2,h-west-front}.jpg`;
numbers `fable-5-lane10/owner-poses-cmp.py`, the tree seats `fable-5-lane10/midseats.mjs` (the trees' audit `midCanopy.seats`).

| pose | pixels > 6 / > 40 | mean luma | bright (> 0.6) | dark (< 0.25) | leafy |
| --- | --- | --- | --- | --- | --- |
| `s2-owner` (the flight, looking up it) | 34 / 10 % | 0.257 → 0.251 | 1.1 → 1.3 % | 55 → 60 % | 31 → 34 % |
| `u-open-up` (the north hollow, straight up) | **99.9 / 81 %** | **0.550 → 0.303** | **50.5 → 13.6 %** | **0.5 → 53.5 %** | 1.0 → 31.7 % |
| `b-upper-2` (the upper house's ladder) | **99.6 / 74 %** | **0.454 → 0.269** | 6.1 → 1.0 % | **0.5 → 54.6 %** | 3.0 → 19.6 % |
| `h-west-front` (the west hut from the path, looking up-left) | **92 / 46 %** | **0.364 → 0.258** | 12.4 → 4.8 % | **30 → 59 %** | 9.5 → 35.6 % |

**1. Mid-canopy crowns at arm's length (`u-open-up`, `h-west-front`) — the new top item at the owner's poses.** The
mid layer was placed as a 14–58 m *radial* band from the clearing's centre (`midCanopy.band` 13.7–57.9 m, 277 trees),
but the owner does not stand at the centre: along the north path the band's trees stand beside and over the walk line.
The trees' audit puts an 11.6 m mid tree at (−3.9, −42.7), **6.0 m** from the `u-open-up` camera (crown radius 3.6 m,
crown centre 6.6 m up — the camera at 5.19 m is inside the crown's height band, 2.4 m from its edge), two more at 7.4 /
7.7 m; at `h-west-front` a 14.6 m mid tree stands at (−3.3, −19.6), **3.0 m** from the camera with a 4.2 m crown whose
base is 4.4 m up — the camera (4.2 m) is under it, inside its radius. At that range the crown is what it is built of:
the far layer's atlas on **crossed cards, lobe pairs and floor cards — flat, hard-edged olive quads a metre wide**
(sheets). The look-up that the owner asked for on 09-23 (pass 1) now shows a wall of them where it showed sky and the
giants' canopy: sky share 50.5 → 13.6 %, the frame 0.55 → 0.30. `h-west-front` loses the hut behind them (the owner's
09-23 hut item), and the same tree is the crown that roofs the path in his 06:50 frame (§7's top band: it stands 3.3 m
west of the spine at z −19.6, 5 m from the path's centre at z −18). Lane 2: (a) a clearance corridor for the mid seats
along the walk lines — the spine (x ≈ 1.5, z −4 … −45) and the owner's poses — of ≈ 8–10 m, the way the verges and the
sectors keep theirs; (b) the crowns need a *near* treatment or a fade under ≈ 10 m (the far atlas at 3 m is a card).
Both are measurable here at these two poses.

**2. `b-upper-2` went dark.** The bright veil in front of the upper house (0.454, 6 % over 0.6) is gone; the hut reads
sharp — the bark, the lantern, the ladder — in deep shade (0.269, 55 % of the frame under 0.25). Lane 1's closed-roof
grade / `hazeShadeVeil` is the likely lever (the hut sits under the giants' roof); the owner asked for the huts'
*character* (04:09) and for bright warm air (06:50) — this pose has the first and lost the second. Lane 1 with the
next brightness pass: read this pose too.

**3. The flight (`s2-owner`) after lane 6's earth treads (`a0223c98`).** Earth between the logs shows on the near
treads (the sheet's lower third) — the demo's kind — but at the owner's angle the flight box (x 0.50–0.95 × y 0.20–0.95)
reads **60.9 → 60.8 % dark, 3.9 → 6.1 % pale, luma 0.236 → 0.242**; the demo's flights read **13–31 % dark / 7–8 %
pale / 0.31–0.33** (`demo61/d_104` x 0.79–0.865 × y 0.03–0.28, `d_094` x 0–0.11 × y 0.24–0.58). At camera A the
flight box is unchanged too (54.2 / 7.7 / 0.260 against 54.5 / 7.7 / 0.260 on `6664f739`). The weight is the log faces
and the shaded tread fronts, which fill a low view; the demo's logs are thin and its treads lit. Lane 6 (fable-2) with
lane 1: the treads' brightness on that slope is the remaining half (r55 §W), the earth is the right material for it.

Six views on this head: §9 (inside ±0.002 of `6664f739`).

### The ranked list at player height, as of `0149f255` (12:51 UTC)

| # | issue | where | lane | measured |
| --- | --- | --- | --- | --- |
| 1 | **Mid-canopy crowns at 3–7 m from the walk line read as flat card piles**; they roof the path and hide the west hut | `u-open-up` (tree at (−3.9, −42.7), 6 m), `h-west-front` (tree at (−3.3, −19.6), 3 m), the 06:50 pose's top band | 2 | §10.1 |
| 2 | **The far air is warm but not light** — far-centre l 0.342 vs the recording's 0.474; bright mist 2.8 vs 23 % | the north path, every pose looking out | 1 | §7, §9 |
| 3 | **The mid crowns keep their local colour at 14–40 m** (s 0.15 / l 0.30 vs 0.05 / 0.42) | the 06:50 pose's far-centre box | 2 with 1 | §7, §9 |
| 4 | **`b-upper-2` went from bright veil to deep shade** (0.454 → 0.269; 55 % of the frame under 0.25) | the upper house's ladder | 1 | §10.2 |
| 5 | **The flight's weight** — 61 % dark / l 0.24 at the owner's angle vs the demo's 13–31 % / 0.31–0.33; the earth treads show, the light does not | `s2-owner`, camera A | 6 with 1 | §10.3 |
| 6 | **A 1.26 m one-frame camera pop leaving the west house**; the camera at 0.37–0.41 m over the ground on descents | Link (−16.8, 2.9, 6.6); `west-house-to-plaza`, `plaza-loop` | camera (fable-cursor) | §8 |
| 7 | **Link's boots float 3–11 cm over Saria's forecourt, 2–4 cm over the west deck**; a boot corner 31 cm inside the flight | `saria-front-arc`, `west-deck`, the main flight | 8 / collision | §8 |
| 8 | **The plaza walk's JS step 4.1 → 10.4 ms p50** — the trees' near-LOD pool builds pending longer; heap +99 MB over the walk | the first 200 frames from the plaza | 2 / fable-cursor | §8 |
| 9 | `stairs2-base` 9.67 M triangles (the 9.0 M cap read at A) | the flight's foot | all | §8 |
| 10 | The path: stone slabs with dark joints where the recording's north run is packed dirt | the spine north of the plaza | 6 | §2 #4 |
| 11 | The right bank a cut earth wall (brown 30 % of the band vs 1 %) | the spine's east side | 4 / 6 | §7 |
| 12 | No fork past Saria's mound; no people | north of Saria's; the plaza | 6; 7 | §2 |

## 11. W38 at camera A — who carries the +0.62 M since `f56c5740` (head `be123deb`, 13:23–13:42 UTC)

fable-2 (11:35) flagged A at 9.15 M / 599 draws against the 9.0 M cap and guessed lane 2's layer. Measured on my box:
`fable-5-lane10/submission.mjs` poses the six fixed views and reads the trees' per-family submission tally
(`audit().systems.trees.submission.byFamily`, three's culling replayed) beside the renderer's total;
`fable-5-lane10/bysystem.mjs` reads the scene's static triangles per top-level system (`audit().scene.bySystem`) and
the vegetation audit. Three builds: `f56c5740` (07:00), `144453ef` (the squad merge-base, carries `d19439cc`'s
D-hollow turf), `be123deb` (the head).

| view | renderer triangles | the trees system (submitted) | of which the mid canopy | everything else |
| --- | --- | --- | --- | --- |
| A | 8.54 → 9.15 M (**+0.62**) | 3.04 → 3.08 M (+0.05) | 0.03 M | 5.50 → 6.07 M (**+0.57**) |
| B | 7.70 → 8.30 M (**+0.60**) | 2.57 → 2.62 M (+0.04) | 0.03 M | 5.12 → 5.68 M (**+0.56**) |
| C | 6.47 → 6.77 M (**+0.31**) | 2.34 → 2.39 M (+0.05) | 0.04 M | 4.13 → 4.39 M (**+0.25**) |
| D | 7.74 → 8.53 M (**+0.78**) | 2.65 → 2.70 M (+0.04) | 0.03 M | 5.09 → 5.83 M (**+0.74**) |
| E | 7.70 → 8.30 M (**+0.60**) | 2.57 → 2.62 M (+0.04) | 0.03 M | 5.12 → 5.68 M (**+0.56**) |
| F | 7.79 → 7.99 M (**+0.20**) | 2.59 → 2.64 M (+0.05) | 0.04 M | 5.20 → 5.35 M (**+0.15**) |

**At A the trees system grew 0.05 M (the mid canopy submits 0.03 M — `mid-near` +17 K, `mid-far` +13 K, +10 calls; the
columns +15 K) and everything else grew 0.57 M.** The static split names it: **vegetation 2.45 → 3.02 M (+0.57 M;
instances 504,659 → 635,865)**, trees 3.67 → 3.75 M (+0.08 M; +131 instances). Inside vegetation, between `144453ef`
and the head: grass instances 512,554 → 619,457 (turf +95 K, meadow +11 K, sedge +10.6 K blades), ferns 2,366 → 2,834,
flowers 274 → 774, bushes 125 → 167, weeds +678, clover +538 — lane 4's verges and the "corridor's forest floor closed".
`d19439cc` (the D-hollow turf, fable-cursor) is +9 K at A (8.536 → 8.545 M; +23.7 K grass instances) — not the cause.
Draws at A 545 → 597: +10 the trees', the rest vegetation.

So **the 9.0 M cap at A is broken by lane 4's blades, not lane 2's crowns** — and the same split holds at B / D / E
(+0.56 / +0.74 / +0.56 M outside the trees against +0.04). The first cut is the turf's density or reach where A does not
resolve it (at A the corridor's floor is 20–40 m out); the crowns are 0.03 M and can stay. The play spots (§8) carry
the same growth (`stairs2-base` 9.53 → 9.67 M is lane 4's too, by this split).

## 12. The perf branches against the caps, measured together (15:33–15:55 UTC, `fable-5-lane10/submission.mjs`, capture mode = the take's condition, character group visible)

The cast's return (`f6efd6e2`) put camera A over **both** caps: 597 → **723 draws**, 9.15 → **9.20 M**. Three branches answer
W38 / the draw cap; each is measured here against *its own* base (the branches were cut from different heads), then
projected together onto the head `56b54e15`. JSONs in `fable-5-lane10/perf88/`.

| build | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| `be123deb` (the head before the cast) | 597 / 9.15 M | 589 / 8.30 M | 472 / 6.77 M | 557 / 8.53 M | 589 / 8.30 M | 547 / 7.99 M |
| head `56b54e15` (cast back) | **723 / 9.20 M** | 692 / 8.33 M | 573 / 6.82 M | 562 / 8.53 M | 692 / 8.33 M | 650 / 8.03 M |
| fable-2 `930ad3d9` flagstones stop casting (vs `be123deb`) | −1 / **−188 K** | −1 / −188 K | −1 / −188 K | −1 / −188 K | −1 / −188 K | −1 / −188 K |
| fable-4 `852245f7` white-bark shadow proxy (vs the head) | +1 / **−134 K** | 0 / −90 K | +1 / −39 K | 0 / −90 K | 0 / −90 K | +1 / −166 K |
| fable-3 `b1ebee6b` kids' shadows only in reach (vs `4b1759f9`) | **−25** / −12 K | −2 / −1 K | **−48** / −23 K | −5 / −7 K | −2 / −1 K | −2 / −1 K |
| **projected head + all three** | **698 / 8.87 M** | 689 / 8.05 M | 525 / 6.57 M | 556 / 8.25 M | 689 / 8.05 M | 648 / 7.67 M |

- fable-2's and fable-4's numbers reproduce here to the K (−188 K on every view; A −134 / F −166 / B, D, E −90 / C −39 K);
  the frames are their measurement (A +0.0001 with 0.12 % of pixels ≤ 40 levels; five views pixel-identical, C −0.0005) —
  shadow-only changes, so I take them without re-rendering.
- **The cast costs draws, not triangles: +126 at A, +101–103 at B / C / E / F** for one or two kids in view (+34–45 K
  triangles). fable-3's `b1ebee6b` takes back the *off-view* kids' shadow passes (A −25, C −48) and lands A at **698 —
  under the 700 cap by two**, with B / E at 689. The rest is the visible kids' own meshes: a kid in view is ≈ 50 colour
  draws plus her shadow pass (hair lobes, locks, fringe, band, tunic, belt, limbs, boots, face, eyes, the fairy). With
  all three branches merged the head sits at 698 / 689 / 689 draws at A / B / E — no headroom for the next prop or plant.
  **Lane 7's next perf item is the kid as one or two merged meshes (per material): 50 → ≈ 5 draws each.**
- Triangles: the three together bring A to **8.87 M, under W38's 9.0 M with 130 K of room**; the lane-4 blades (§11) are
  still the mass (+0.57 M at A), and the next plant lands A back over the cap.
