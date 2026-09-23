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
(± 0.003). Sheets `fable-5-lane10/it83-ba-six-A.jpg`, `it83-ba-six-D.jpg`. (A render of the
squad merge-base `144453ef`'s six views is in progress to split the batch from the 07:00–09:15 head; numbers in 7b.)

