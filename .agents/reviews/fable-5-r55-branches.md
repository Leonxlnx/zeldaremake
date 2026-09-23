# fable-5 — round-55 reviews (`agent/fable-5-r54-review`, continued)

Continues `fable-5-r54-branches.md`. Same method: the branch tip merged over the head's source
(here the merge-base `073f5ff2` *is* the head's source — `dc69f2e1` is docs-only), both built the same
way, rendered in the same session with the same settle (`broll.mjs --test --settle 8`, 1280×720,
quality high), SSIM at the gauntlet's 256×144 against `reference/frames/*.jpg`, pixels counted at
full resolution with a > 6-level luma threshold.

## A. Iteration 53 (03:30–04:28 UTC) — fable-4's `agent/fable-4-shadowlod` @ `7164ff29`: the white-barks' mid LOD stops casting shadows (W38 give-back)

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

## B. Iteration 54 (04:34–04:48 UTC) — fable-2's answer on round-52 #3 (V16's seams) taken up: it is the seam's continuity, not a value; the lip shadow ruled out by a diagnostic

fable-2 (`agent/fable-2-seam-value`, README §54, INBOX 03:40) measured my "#3 — a seam value, one commit"
five ways on `073f5ff2` with my own read (blur-difference > 0.12 at 640 px, my E/C/D boxes): fill albedo
× 1.3 −0.3 points, painted crevice off −0.7, slabs half as proud **worse** (+0.8, E −0.0020), joint
sprouts hidden 0, the §45 flank tint 0 — against a gap of 8.1 → 3.1 %. Their mask sheet shows why: in the
frame the counted pixels are Link's shadow edge and two joints; in ours every slab is outlined along its
full length. **I accept the correction — §F's "one commit" was mine and wrong.** Then I asked the two
questions their five knobs leave open: is the excess the joints' *length* (slab count) or their
*contrast*, and is the continuous outline the shadow map's lip line?

**Skeleton read** (same read, then the > 0.04 mask thinned to lines — Zhang–Suen — so length, width and
depth separate; E with Link's column 0.42–0.58 excluded on both sides):

| box | source | visible line length (px / kpx) | line width (px) | depth along the line (mean · p90) | share of the line that is a hard groove (> 0.12) | share > 0.12 |
| --- | --- | --- | --- | --- | --- | --- |
| E | reference | 55 | 2.2 | 0.081 · 0.125 | 12 % | 1.3 % |
| E | head `073f5ff2` | **88 (1.6×)** | 2.5 | 0.093 · 0.154 | **23 %** | 5.2 % |
| E | head, slabs `castShadow = false` (diagnostic) | 88 | 2.5 | 0.092 · 0.153 | 22 % | 5.0 % |
| C | reference | 41 | 2.5 | 0.091 · 0.149 | 20 % | 1.6 % |
| C | head | **71 (1.7×)** | 2.2 | 0.093 · 0.160 | 23 % | 3.1 % |
| C | diagnostic | 68 | 2.3 | 0.094 · 0.163 | 23 % | 3.1 % |
| D | reference | 52 | 2.6 | 0.085 · 0.133 | 16 % | 1.9 % |
| D | head | **75 (1.4×)** | 2.4 | 0.103 · 0.179 | **31 %** | 5.2 % |
| D | diagnostic | 77 | 2.4 | 0.103 · 0.178 | 31 % | 5.2 % |

Three findings:

1. **The width is not it** (2.2–2.6 px both sides) and **the mean depth barely** (1.0–1.2×). The excess is
   visible **length × the share of it that is a hard groove**: 1.4–1.7× as much seam line per box, and
   1.1–2× as much of it over 0.12. That is fable-2's 1.6× — but it is *visible* length, not slab count:
   if the stone count is the frame's (§R put the paving at the frame's density), the frame's seams are
   visible along ≈ 60 % of their run. Segmenting the not-seam pixels says it bluntly (Link's column walled
   off so it cannot bridge): **the reference E box splits into 5 regions, the largest 4,900 px — three or
   four slabs' worth with no seam closed between them; ours splits into 12, one per slab** (C: the frame's
   paving is a single 38,000 px region against our 14 slabs; D: 5 vs 10). The frame's joint is a line
   that comes and goes; ours is an outline.
2. **It is not the shadow map.** The one lever fable-2 did not try was the proud lips' shadow line (a
   1.7–2.3 cm lip under a 38° sun throws 2–3 cm into a 9.5 cm channel, all along the sunward side). The
   diagnostic — the same head with only the flagstone mesh's `castShadow` off — leaves every joint number
   where it was (E 5.2 → 5.0 %, C and D unchanged; the frame changes 3–5 % elsewhere, where the slabs
   stopped shading Link's feet and the rim). The outline is the paving's own shading: the channel's wall
   (a shade darker, lit less than the top — round 48's +0.6 cm for opus #16) and the fill's albedo in the
   recess, continuous because the recess is continuous.
3. **So the lever is continuity**, and fable-2 is right that it lives in the module: the joint fill
   rising flush to (or lapping) the slab's rolled edge over seeded stretches — round 44's soil lip does
   exactly this for the hollow path — so the wall and the crevice vanish along ≈ 40 % of each joint's run
   and the line comes and goes as the frame's does; the proud height is the wall's contrast where the line
   stays. fable-2's proud × 0.5 got worse *alone* (more fill in view from the low camera); with the fill
   flush there is no fill to see, so the two have to be tried together, not one at a time. Not the width,
   not the shadow map, not the fill's tone — three knobs the brief should not spend.

**Re-ranked:** round-52 #3 stays at #3 by size (E 4× the frame's dark share, the largest paving defect
left) but is **a hardscape-module change for hardscape-32 / the lane with the module, not a value** —
§F corrected in place. fable-2's two harmless partials (crevice 0, fill × 1.3: −1.0 point together, SSIM
≥ 0) are not worth a merge on their own; they would be lost in the rebuild anyway.

Sheets: `fable-5-r55/fable-5-r55-v16-E-lines.jpg`, `fable-5-r55/fable-5-r55-v16-D-lines.jpg` (reference |
head | diagnostic; red = the counted seam line, yellow = where it is a hard groove). **The read is a script:**
`fable-5-r55/seam-lines.py <view> label=image ...` (numpy / pillow / scipy) prints every column of the table
above, so the flush-stretch work can be verified with the same numbers.

## C. Iteration 55 (05:35–06:28 UTC) — the head `073f5ff2` → `82b94525`: fable-2's dressing fade (V20's pair at `x-southbank-toe`, the owner's "stones under-detailed at 5–20 m") with shadowlod riding along

`82b94525` merged fable-2's chain: the dressing stones (the backside's pale pair, the clearing's west-bank
set) take their own near-capable material with `DRESSING_NEAR_FADE_M` 7–13 m (`0d86abbb`), and fable-4's
shadowlod (`c938a862`, §A) came with it. Three builds: before = the head's source `073f5ff2`; after = the
head `82b94525`; and, to attribute, a *dressing-only* build (`073f5ff2` + `0d86abbb`'s `rocks/index.ts`).
Twelve poses on before/after, the six walk poses on dressing-only.

**Six views: exactly §A's numbers** — A/B/E/F 0, C −0.0009, D −0.0002 — so the dressing fade adds nothing
at the fixed views (fable-2: "off every fixed view by construction"; confirmed to the pixel).

**The walk poses** (regions = components of |Δ| > 6 levels; fine σ = 2 px high-pass residual std, the same
read fable-2 used):

| pose | region | fine σ before → head | dressing-only | read |
| --- | --- | --- | --- | --- |
| `x-southbank-toe` (pair at 6.8 m) | the pale pair (0.51–0.75 × 0.57–0.80) | **0.0194 → 0.0247 (+27 %)**, l 0.214 → 0.224 | **+28 %** | the fade's — knapped plates and lichen flecks on the flank where the far skin was a mottled loaf; the moss cap unchanged |
| | the left stones (0.32–0.42 × 0.63–0.70; 0.16–0.23 × 0.67–0.74) | +24 % / +12 % | +21 % / +13 % | the fade's |
| | the right white-bark's trunk band (0.78–0.85 × 0.45–0.54) | +19 %, l 0.306 → 0.333 | 0 % | shadowlod's (§A: the crown's shade band gone) |
| `x-southbank-toe-4m` | the pair | +1 % | +1 % | inside both fades — unchanged, as designed; one background stone +13 % |
| `x-southbank-toe-11m` | the pair (0.36–0.64 × 0.54–0.83) | +18 % | **+5 %** | at 11 m the fade is two-thirds out — the fade alone gives +5 %; the rest is shadowlod's dapple leaving the stones |
| `x-clearing-n` | the west-bank pair at the frame's right edge (0.85–1.00 × 0.40–0.51) | +8 % | +7 % | 0.43 % of the frame; the clearing's set sits at the edge of this pose |
| `x-clearing-stones`, `x-clearing-back` | — | 0.04 % of the frame | — | the clearing's dressing is not in these frames' 7–13 m |

fable-2's own +18 % at `x-southbank-toe` is a looser box; in the pair's own box it is +27 %, and the
dressing-only build attributes it. **Verdict: V20's pair IMPROVED at its pose** — the stone a walker sees at
6–8 m is a knapped stone now — **with the six views untouched.** Modest in size (the pair is 4 % of the
frame) and honest about its range: the owner said 5–20 m and the band is 7–13 m; at 13–20 m the far skin
still shows (the 11 m pose already gets a third of the gain). If the owner's range is meant literally, the
outer edge of `DRESSING_NEAR_FADE_M` is the knob, and it costs nothing in draws (the same mesh, one
material) — only fragment work on stones in the band.

**A tooling note, so nobody repeats it:** the dressing-only build was rendered with a *shorter* shot list
(the six walk poses only) and came back 8–12 % different from the before frame-wide — the wind phase
shifts with the shot order (my r49 finding); its stone boxes are comparable (stones do not sway), the
frame-wide counts are not. Render attribution builds with the *same* shot list, always.

Sheet: `fable-5-r55/fable-5-r55-f2-dressing-toe-pair.jpg` (the pair, before | after at 6.8 m).

## D. Iteration 56 (06:30–06:35 UTC) — take-0133 pre-read: what the six views should score if the fifth-start capture is healthy

take-0133 has died four times (protocol timeouts, then a page that never returned its first render); the
fifth start (tick 222, 06:18) runs **a new browser per viewpoint**. That changes the browser's warm state
between views, and warm state has moved frames before (r54 §D's first head render: diffuse differences
everywhere, re-rendered). So a prediction is worth having *before* the seal, from the pieces already
measured with one pipeline in pairs. take-0131's build is `039d67d` — its source is identical to
`c11f0ff4` (no `src` diff), so the chain to the current source `82b94525` is:

| step | what | A | B | C | D | E | F | where measured |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `c11f0ff4` → `445fa453` | timber tint, arch rim, character import, blockers, hearth | +0.0087 | −0.0002 | +0.0002 | 0 | −0.0003 | +0.0040 | r54 §A |
| `445fa453` → `0963c09d` | the arch roll's 4 cm tuck, tests | 0 | 0 | 0 | 0 | 0 | 0 | assumed: a 4 cm tuck at the arch mouth is below the six views' resolution (r54 §B: the tunnel pose pixel-identical) |
| `0963c09d` → `110453d4` | Astra's warmth + PR #29's bank-core recession, pebble tiles, deck lane | −0.0027 | 0 | −0.0040 | 0 | 0 | −0.0104 | r54 §D |
| `110453d4` → `da314d7c` | lodthin, heel guard | 0 | 0 | −0.0004 | 0 | 0 | −0.0001 | r54 §E |
| `da314d7c` → `073f5ff2` | B3 census fields only | 0 | 0 | 0 | 0 | 0 | 0 | by construction (`userData` / stats) |
| `073f5ff2` → `82b94525` | shadowlod, dressing fade | 0 | 0 | −0.0009 | −0.0002 | 0 | 0 | r55 §A, §C |
| **sum** | | **+0.0060** | −0.0002 | **−0.0051** | −0.0002 | −0.0003 | **−0.0065** | |
| take-0131 sealed | | 0.2153 | 0.1989 | 0.2237 | 0.2766 | 0.2194 | 0.2381 | monitor |
| **take-0133 expected** | | **0.2213** | 0.1987 | **0.2186** | 0.2764 | 0.2191 | **0.2316** | |

Two caveats on the transfer: my pairs are `broll --test --settle 8` without the character, the capture
is settle 90 with Link at E — the deltas are canopy, white-bark and flight changes and should carry,
but **E carries Astra's character import (#26 colour / proportions) that none of my pairs saw**, so E may
move by Link's pixels; and the C/F losses are PR #29's (r54 §D), booked here as the head's, not as the
capture's. **Reading rule for the seal:** A/B/C/D/F within ±0.002 of the expected row → the fifth-start
pipeline is healthy and the verdict pass proceeds on the frames; any view off by more than that (or a
diffuse whole-frame difference against take-0131 at B or E, which no source step touches) → suspect the
browser-per-view warm state before any lane's source, and say so before verdicts are re-filed. On the
verdicts themselves: nothing in the chain turns a W-item — W02's pass is reinforced by the tint (r54 §A);
W10 at F was already a fail; PR #29's F −0.0104 is the six-view budget's problem, not a rubric flip.

## E. Iteration 57 (07:33–08:20 UTC) — the tab's 3.6 GB reproduced on a second, idle box and split: 1.0 GB of typed arrays in the JS heap, 1.7 GB in the GPU process, all of it there at `ready`, none of it the pools

fable-cursor's tick 223 root-caused the capture deaths as OOM kills (renderer 1.94 GB + SwiftShader GPU
process 1.70 GB on a 16 GB box with 3.2 GB free) and asked fable-6 for a per-view read. An independent
read from a box with nothing else on it is the control, so: the head's source `82b94525`, the capture's own
launch path (`gauntlet/scripts/lib/browser.mjs`: SwiftShader, 1280×720, quality high), one page, the
capture's per-view loop (setViewpoint, setTime 12.5, render in chunks of 5), and after each view
`performance.memory`, `__ZR__.stats()` and the Chrome processes' RSS from `ps`. Scripts and raw logs in
`fable-5-r55/memread.mjs`, `memread-gc.mjs`, `memread.log`.

| moment (large pools, the capture's tier) | JS heap used | renderer RSS | GPU-process RSS | Chrome total | geometries | textures |
| --- | --- | --- | --- | --- | --- | --- |
| **`ready` (no view yet)** | **1,522 MB** | **2,110 MB** | **1,682 MB** | **4,272 MB** | 301 | 91 |
| A (8 frames) | 1,524 | 2,120 | 1,706 | 4,323 | 302 | 91 |
| B | 1,526 | 2,119 | 1,727 | 4,343 | 318 | 91 |
| C | 1,527 | 2,119 | 1,750 | 4,367 | 366 | 91 |
| D | 1,529 | 2,122 | 1,768 | 4,388 | 383 | 91 |
| E | 1,529 | 2,122 | 1,771 | 4,390 | 383 | 91 |
| F | 1,530 | 2,122 | 1,775 | 4,394 | 387 | 91 |
| A again | 1,530 | 2,121 | 1,777 | 4,395 | 387 | 91 |

Four findings:

1. **Reproduced, and it is the world, not the box.** An idle 15 GB machine with nothing else running
   gets the same renderer (2.1 GB) and GPU process (1.7 GB) fable-cursor saw under load — 4.3 GB of
   Chrome. The capture's stalls are what a 16 GB box with a 4 GB daemon does with that.
2. **It is all there at `ready`.** Before any viewpoint the tab is at 4.27 GB; the six views add 95 MB
   to the GPU process (the pool slots: geometries 301 → 387) and 8 MB to the JS heap; the second pass
   over A adds nothing — residency, not a leak. The near-LOD pools are not the story: **`pool=small`
   gives the identical `ready` row (1,522 / 2,112 / 1,685 MB)** and the same per-view growth; the pools
   fill on demand and hold little at the fixed views. Trimming the pool caps will not move this number.
3. **The JS heap is 1.0 GB of typed arrays.** `Runtime.getHeapUsage` at `ready`: **backing stores
   (ArrayBuffers) 1,021 MB**, ordinary V8 objects 501 MB, Blink 2 MB; a forced GC
   (`HeapProfiler.collectGarbage`) frees **nothing** — it is live. Those are the CPU-side copies three.js
   keeps of every `BufferAttribute` after upload (the merged vegetation, terrain, hardscape, rocks,
   canopy…), so the geometry lives twice: 1.0 GB in the JS heap and again as buffers in the GPU process.
   three.js's own answer for static geometry is `BufferAttribute.onUpload(cb)` — the callback drops
   `this.array` once the buffer is on the GPU (the `webgl_buffergeometry` example does exactly this) —
   worth up to 1.0 GB in the renderer, system by system, for every attribute nothing reads back after
   upload (raycasts and the walker's collision must be checked per system first: anything that reads
   `geometry.attributes.position` at runtime keeps its array).
4. **The GPU process is mostly textures and the same geometry.** The dist carries 68 image assets, 43 of
   them 2,048² — as RGBA8 with mips that is ≈ 900 MB if all are resident (`renderer.info` says 91
   textures at `ready`, the rest render targets and the shadow map); the other ~0.8 GB is the uploaded
   geometry and SwiftShader's own overhead. 2k → 1k on materials never seen inside a few metres (the
   ground sets, bark seen at 5 m+) is a 4× cut per texture; KTX2/Basis a further 4–6×. On a player's real
   GPU these live in VRAM, not RAM — so for the "8 GB laptop" the renderer's 2.1 GB is the number that
   matters, and its largest single piece is finding 3.

Not measured: a heap snapshot by system (1.5 GB is too large to snapshot on SwiftShader in this session);
`renderer.info` gives counts, not bytes. What the lanes can act on without it: finding 3 is a per-system
grep for attributes read after upload; finding 4 is an asset list.

## F. Iteration 58 (08:29–08:47 UTC) — fable-2's pebble-bytes cut measured (six views identical); the two memory reads reconciled; Link's textures decoded

**`agent/fable-2-pebble-bytes` @ `20b72fdf`** (the 20 merged pebble tiles drop `uv` / `aWet`, normals Int8, colour
and `aMoss` Uint8 normalised: 52 → 19 B a vertex, tiles 30.5 → 11.2 MB, both copies). Built on the head's source
`82b94525`, the six views rendered with the same shot list as §C's head frames (same wind phase):

| view | SSIM vs reference | pixels moved at all | > 6 levels | > 20 levels | max |
| --- | --- | --- | --- | --- | --- |
| A | 0.2013 = | 0.07 % | 0.006 % | 0 | 19.5 |
| B | 0.1833 = | 0.16 % | 0.015 % | 0.001 % | 30.5 |
| C | 0.2096 = | 0.28 % | 0.033 % | 0.001 % | 29.9 |
| D | 0.2617 = | 0.21 % | 0.017 % | 0 | 24.2 |
| E (pebbles at 1–2 m) | 0.2050 = | 0.16 % | 0.012 % | 0 | 30.5 |
| F | 0.2139 = | 0.08 % | 0.005 % | 0 | 16.0 |

SSIM identical to four decimals everywhere; the moved pixels are the Int8 normal's shading steps, 2.0–2.7 levels on
average, a handful of pixels over 20. fable-2's own E numbers (0.23 %, 2.3 levels, none over 40) reproduced. **A
memory cut with no visible cost — mergeable.**

**The two reads agree, and say where the rest is.** fable-2's map (`fable-2-memory-map-4f22e7ec.md`): 773 MB of
`BufferGeometry` arrays (trees 440, rocks 86, vegetation 74, hardscape 65, structures 64, terrain 28) and ≈ 618 MB
of textures by first-referencing system. My §E: 1,021 MB of ArrayBuffer backing stores in the heap, all live. The
773 sit inside the 1,021; the other ≈ 250 MB are typed arrays outside `BufferGeometry` — index buffers if the map
skipped them, the procedural atlases' source data, heightfields, placement tables — unattributed, and second-order.
So the renderer's 2.1 GB is: 0.77 GB geometry arrays + 0.25 GB other typed arrays + 0.50 GB objects + ≈ 0.6 GB Blink
(decoded images and the rest). Two independent methods, one picture.

**Link's textures, decoded from the GLB** (`models/link/link-runtime.glb`, 48.7 MB): `hardware-body-color`
**4,096²**, `nose-zero-margin-normal` **4,096²**, `hardware-body-metallic-roughness` 2,048², `corneal-eye-color`
2,048², `face-orbital-color` 1,024² — ≈ **218 MB resident** as RGBA8 with mips, fable-2's 222 confirmed. Every one of
the environment's 68 disk images is ≤ 2,048², so a "2 K mip cap" saves exactly Link's two 4 K maps (−128 MB) and
nothing else; Link stands ≤ 300 px tall in any hero frame, so 1,024² for the body maps and 256² for an eye is the
honest size (**−190 MB**, Astra's export, no shader change). The ground and bark sets at 2 K are the other half of
the texture bytes; 1 K where a set is never seen inside ~3 m is 4× each.

**How the trims compound**, for whoever briefs it: `onUpload` (§E finding 3) removes the CPU copy of everything
static — up to 0.77 GB in the renderer at no GPU cost; fable-2's packing shrinks *both* copies (trees' 440 MB is the
prize: ×2 on the GPU side); the texture sizes are the GPU process's. Three different levers, three different lanes,
none of them the pool caps.

## G. Iteration 59 (09:36–10:18 UTC) — the head `e188ac2f` (fable-4's `onUpload` for the trees + pebble-bytes) measured: pixel-identical, −568 MB of Chrome on the capture path; and `?warmup=1` would make the capture box's tab 0.7 GB *larger*

fable-4 shipped §E's finding 3 for the trees (`79699a4f`: every tree geometry registers
`BufferAttribute.onUpload` on attributes and index, bounds computed first, pooled parts on every rebuild) and
fable-cursor merged it with pebble-bytes (`e188ac2f`, tick 225). Same box, same method as §E, same shot list
as §C for the frames.

**Frames: byte-identical.** Six views of `e188ac2f` against the pebble-bytes frames (the only source
difference is `onUpload`): max |Δ| **0.0** at A–F. Against `82b94525` the SSIM is identical to four decimals
(pebble-bytes' 2-level steps do not register at 256×144). The bounds are right — nothing culls differently.

**Memory, the capture path (no warm-up):**

| | `82b94525` (§E) | `e188ac2f` | Δ |
| --- | --- | --- | --- |
| `ready`: JS heap / renderer / GPU process | 1,522 / 2,110 / 1,682 MB | **1,381 / 1,835 / 1,601** | −141 / **−275** / −81 |
| after A → F: JS / renderer / GPU | 1,530 / 2,122 / 1,775 | 1,389 / 1,866 / 1,691 | −141 / **−256** / −84 |
| Chrome total after six views | 4,394 MB | **3,826 MB** | **−568 MB** |

More than fable-4's in-page −125 MB at A: the loading screen's own frames upload and release what they draw
before `ready`, the freed backing stores hand pages back, and pebble-bytes takes its 19 MB from both sides.
A second pass over A adds 1 MB — still residency, not a leak.

**`?warmup=1` — fable-4 offered it for the take path ("the OOM margin you need"). Measured, it is the opposite
on a SwiftShader box:**

| `e188ac2f` at `ready` | no warm-up | `warmup=1` | Δ |
| --- | --- | --- | --- |
| JS heap | 1,381 MB | 1,066 MB | −315 |
| renderer RSS | 1,835 MB | **1,663 MB** | −172 |
| GPU process RSS | 1,601 MB | **2,241 MB** | **+640** |
| Chrome total | 3,677 MB | **4,398 MB** | **+721** |
| geometries uploaded | 301 | 947 | |

The warm-up draws every mesh once, so every buffer is uploaded — and on SwiftShader "the GPU" is a process
in the same RAM. The renderer loses 172 MB and the GPU process gains 640: the tab is 0.7 GB heavier, and
the largest process is now the GPU process at 2.24 GB — bigger than the 1.94 GB renderer the OOM killer
took last night. **For the capture box the answer is no: keep the take path without the warm-up.** For a
player with a real GPU the same uploads go to VRAM and the renderer's −0.6 GB against the old head is the
win fable-4 described; the two paths want different settings and the take is not the game.

**Where this leaves the map** (capture path, after six views): renderer 1.87 GB = JS heap 1.39 GB
(≈ 0.88 GB typed arrays still live — the non-tree geometry fable-4 offers to hoist the helper to, the
pooled parts drawn later, and the ≈ 0.25 GB outside `BufferGeometry` — plus 0.50 GB objects) + ≈ 0.48 GB
Blink; GPU process 1.69 GB (textures ≈ 0.6–0.9 GB with Link's 4 K pair at 170 MB of it, §F; the uploaded
geometry the rest). One correction to fable-4's 13:30 note: the heap does not hold "≈ 1.4 GB of JS objects"
— `Runtime.getHeapUsage` puts the objects at 0.50 GB and the typed arrays at 1.02 GB (§E); the snapshot
worth taking is of the typed arrays that survive, by owner, not of the objects.

## H. Iteration 60 (10:27–11:08 UTC) — tick 226's late-compile hypothesis tested on an idle box: A's 90 frames are flat to ± 2 %, no program and no geometry appears after frame 5

fable-cursor (tick 226): the sixth take-0133 stalled at B 51–55 with 7.2 GB free and swap unused — "not
memory alone"; working hypothesis a late shader compile / program variant when the pools pin a new part
type, 10–15 min into a view. If that were in the frame sequence it would reproduce anywhere. So: the tick-226
source `3d4effbe`, the capture's launch path, one view, 90 frames in the capture's chunks of 5, and after every
chunk the chunk's seconds, `__ZR__.stats()` (`programs`, `geometries`, draws, triangles), the JS heap and the
Chrome processes' RSS (`fable-5-r55/stallwatch.mjs`, raw rows in `stallwatch.log`).

**A_stairs, 90 frames:** 18 chunks, every one **72.9–75.2 s (14.6–15.0 s/frame)** — the first chunk 44.9 s
(9 s/frame; the frame after the switch is cheaper, not dearer, here). **`programs` 101 from chunk 1 to chunk
18; `geometries` 302 throughout; draws 444; 8.68 M triangles; JS heap 1,345–1,346 MB; renderer RSS
1,931–1,938 MB.** Frames 51–55, 61–65 and 71–75 — where the capture box stalled for 967–2,445 s — took 74.2,
73.8 and 74.3 s. No new program, no new part, no heap movement: nothing in A's sequence compiles or builds late
at a fixed camera (the pools pre-fetch by camera distance; a still camera pins nothing new). The one drift is
the **GPU process, +41 MB over 90 frames** (1,686 → 1,727; ≈ 0.5 MB a frame — SwiftShader's own), small here,
≈ +0.3 GB over a whole take's 540 settle frames plus determinism and motion on a box already at the margin.

**Reading:** the late-compile hypothesis does not survive an idle box — the stall is the box, not the frames:
memory pressure and swap (tick 224 still stands for the night's kills), the GPU process dying and restarting
(the slow-chunk log's own observation), or a monitor competing for the four cores (tick 226's last line). Two
things a capture box could do about the last two: pin the take to run alone, and watch the GPU process's pid
across a view — if it changes mid-view, the stall is a SwiftShader restart, and the frame after it re-uploads
every buffer (the +640 MB of §G's warm-up row is what a fresh GPU process must be re-fed).

**B_house, 90 frames (the sixth take's stall view, 51–55 at 2,445 s on the capture box):** 18 chunks, the
first 49.7 s, then **75.3–78.3 s (15.1–15.7 s/frame)**; frames 51–55 took **76.1 s**. `programs` 101 and
`geometries` 318 from chunk 1 to 18, draws 425, 7.80 M triangles, heap 1,347–1,348 MB, renderer 1,936–1,944 MB;
the GPU process 1,705 → 1,743 (+38 MB, the same ≈ 0.4 MB a frame). The same picture as A: B's sequence has no
late work in it either.

## I. Iteration 61 (11:34–12:02 UTC) — the two memory steps after `e188ac2f` checked at the six views: rock-bytes / rock-upload / propmem, then fable-4's vertexbytes — both frame-neutral

Two source steps landed on the head without a non-author frame check: `3d4effbe` (fable-2's rock-bytes — the hero
near kits and dressing meshes packed with a scaled Int16 `aMoss` and a shader read — plus rock-upload and fable-3's
propmem, both `onUpload`) and `aef8bb47` (fable-4's vertexbytes: tree normals Int8, colours Uint8, `aWind` Uint16,
range-checked). Rendered both on this box with the same shot list as §C/§G, against my `e188ac2f` frames:

| view | step 1 `e188ac2f` → `3d4effbe`: px > 8 levels · max | step 2 `3d4effbe` → `aef8bb47`: px > 8 · > 40 · max | SSIM vs reference, both steps |
| --- | --- | --- | --- |
| A | 0.008 % · 30.9 | 0.000 % · 0 · 21.4 | 0.2013 → 0.2013 (0) |
| B | 0.022 % · 19.0 | 0.003 % · 0 · 22.2 | +0.0001 |
| C | 0.018 % · 22.4 | 0.013 % · 0 · 28.9 | 0 |
| D | **0.174 % · 26.7** | 0.001 % · 0 · 17.5 | −0.0001 |
| E | 0.022 % · 18.0 | 0.004 % · 0 · 21.9 | 0 |
| F | 0.028 % · 32.2 | 0.004 % · **5 px** · 47.3 | +0.0001 |

Step 1's only visible footprint is at D: 90 % of the > 8 pixels sit in x 0.04–0.17 × y 0.75–0.91 — the shot-D hero
boulder, where the Int16 `aMoss` and the packed near kit shade a few levels differently (no pixel over 40). Step 2
is the Int8 normals' shading steps at ≤ 0.013 % of pixels, and five lamina-edge pixels at F's top (0.44, 0.02) and
(0.81, 0.10) flipping over 40 — fable-4's own count was seven. **Both steps frame-neutral for the gauntlet**; §D's
expected row for take-0133 stands to the fourth decimal. With these, the head has taken every memory lever named in
§E/§F except the textures (Link's two 4 K maps, §F) and the non-tree `onUpload` for vegetation / structures / terrain
(terrain raycasts and must keep its arrays).

## J. Iteration 62 (12:25–12:47 UTC) — the D boulder is flat because it stands in the canopy's shadow, and the proof is one switch: shadow map off, the loaf alone reaches the frame's macro σ (0.117 vs 0.124) — fable-2's "the light, not the geometry" confirmed and sharpened; the planes add nothing even in sun

fable-2 (`agent/fable-2-form-2`, README §63, INBOX 12:20): the §19 planes rebased to the boulder's new spot give
macro σ 0.023 → 0.026 against the frame's 0.097 at D −0.0013, a hard bake the same — "still the light, not the
geometry", not landed. A claim about light has a direct test: the same builds with the shadow map off
(`renderer.shadowMap.enabled = false`, a diagnostic build, nothing else changed). Four builds at D and at the old
`sn-boulder-shotd` pose; the frame's D rock box 0.04–0.18 × 0.66–0.84, macro σ at 160 px wide:

| D rock box | mean l | macro σ | micro σ | p10 / p90 | p99 |
| --- | --- | --- | --- | --- | --- |
| **reference D** | 0.326 | **0.124** | 0.037 | **0.18 / 0.49** | 0.59 |
| head `aef8bb47` (the loaf) | 0.306 | 0.050 | 0.020 | 0.24 / 0.37 | 0.42 |
| planes (form-2) | 0.313 | 0.049 | 0.020 | 0.25 / 0.38 | 0.42 |
| **head, shadow map off** | 0.333 | **0.117** | 0.041 | 0.22 / **0.51** | 0.68 |
| **planes, shadow map off** | 0.351 | **0.117** | 0.045 | 0.23 / 0.54 | 0.67 |

(fable-2's box gave 0.023 / 0.026 for the same builds — a box or scale difference; the ratios agree.) Two findings:

1. **It is the canopy's shadow, entirely.** With the shadow map off the loaf's box has the frame's light: macro σ
   0.117 against 0.124, p90 0.51 against 0.49, mean 0.333 against 0.326 — a sunlit crown over a shaded flank, the
   frame's rock. With it on, the whole boulder sits in the giant's canopy shade and no geometry can show a plane:
   the light on that spot is diffuse, so every face renders the same value. **The D boulder is round-50 #1 and
   round-52 #12 solved by a sun corridor onto it, not by rockgen** — the corridor machinery exists (the plaza's
   `sunCorridors` / `plazaCorridors` in `trees/index.ts` keep crowns out of the sun's path to the flagstones); the
   boulder wants one, or a gap in the lobe that shades it. Owner: canopy / the giant's lobes (owner-fable's
   ranked-list #6 lane), with the sun's bearing checked so the crown, not the flank, takes it.
2. **The planes add nothing the metric or the eye at D can find, even in sun:** 0.117 vs 0.117, p90 0.54 vs 0.51
   (the crest plane catches a little more), micro σ 0.045 vs 0.041. fable-2's call to hold them is right; the loaf
   already has the frame's form under the frame's light. (The `sn-boulder-shotd` pose no longer frames this
   boulder after W23's move — 0.04 % of pixels differ between loaf and planes there; the shadow-off rows at that pose
   show the same lighting effect on whatever it does frame: macro σ 0.082 → 0.110, p90 0.37 → 0.47.)

Sheet `fable-5-r55/fable-5-r55-d-boulder-light-quad.jpg` (loaf | planes; both with the shadow map off; the
frame at right).

## K. Iteration 63 (13:33–14:03 UTC) — V16, the fill's half specified in numbers after fable-2's flush stretches moved nothing; the owner's grass item (blades to 26 m) measured on the head

### K.1 V16: the recess was half the mechanism; the seam's tone is the other half, and here is its number

fable-2 built the flush stretches as re-scoped (`agent/fable-2-v16-flush`, README §64: ≈ 40 % of each outline's rim
down to the fill on a 1.7 cycles/m noise) and read them with `seam-lines.py`: **E line 86.1 → 86.1 px/kpx, hard-groove
share 27.0 → 27.0 %, regions 14 → 14** — the stretches exist (4–15 K pixels move per view) and the read does not move.
So the recess is not what the eye counts either: with the rim flush, the fill strip is still darker than the slab
along its whole length. §B's conclusion (continuity is the lever) stands; §B's mechanism (the recess) was half of it.

The number the module needs, from the same read (seam pixels on the counted line vs the slab pixels beside them,
medians at 640 px):

| | reference E | head E | reference D | head D |
| --- | --- | --- | --- | --- |
| seam luminance (median on the line) | 0.360 | **0.262** | 0.323 | **0.262** |
| slab luminance beside it | 0.514 | 0.549 | 0.513 | 0.545 |
| **seam below slab** | **−0.15** | **−0.29** | **−0.19** | **−0.28** |
| share of the line inside 0.06 of its surround | 31 % | 25 % | 29 % | 24 % |

Where the frame's seam shows it sits 0.15–0.19 below the slab; ours sits 0.28–0.29 below — **twice the depth on 1.6×
the length**. fable-2's fill × 1.3 (r55 §B) lifted 0.262 to ≈ 0.34, still −0.21 — a third of the way, which is what
they measured (8.1 → 7.8 %). So the fill half of V16, in `joints.ts`, is two numbers: **the seam soil at ≈ 0.40 (−0.15
below the slab) where the line shows, and at the slab's own value (≈ 0.50–0.55: dry dirt or turf) over ≈ 40 % of each
run**, keyed on the same noise as the flush rim, with the rim flush there so no wall reappears. The read that accepts
it: E line ≤ 60 px/kpx, hard-groove share ≤ 15 %, regions ≤ 6 — the reference's row within noise.

### K.2 The owner's grass item on the head (`f9c58007`, fable-cursor by hand): blades to 26 m

`grass.ts` mid blade LOD 16 → 26 m ("patches in the grass where it's not full" — at player height the far half of
every lawn was the carpet's clump cards alone). An owner item and a declared look change, so the six-view budget is
the check, not a bar. Before `aef8bb47` (§I's frames), after `f9c58007`, same shot list:

| view | Δ SSIM vs reference | pixels > 6 levels | where |
| --- | --- | --- | --- |
| A | −0.0002 | 0.18 % | the lawn band 16–26 m out, x 0.17–0.96 × y 0.17–0.50 |
| B | −0.0002 | 0.29 % | the lawn to the house, x 0.18–0.52 × y 0.35–0.60 |
| C | −0.0005 | 0.15 % | |
| D | 0 | 0.13 % | |
| E | **+0.0004** | 0.28 % | the same lawn as B |
| F | **−0.0022** | 0.51 % | x 0.37–0.87 × y 0.20–0.48, brighter by 12 levels — lit blades over the carpet beyond the flight |

Inside −0.003 everywhere; F takes most of it (−0.0022, on top of PR #29's −0.0104 already booked there — F is
the view that keeps paying). In stills the change is faint: 0.1–0.5 % of pixels at the fixed views, and at three
player-height poses I placed blind toward lawns 20–24 m out, 0.03–0.53 % — a blade at 20 m is two pixels at 1280 ×
720, so the owner's "patches" are a walking, parallax read that a still barely holds. The +41 tiles / ≈ 60–100 K
triangles at A are the take's to measure (fable-cursor: at take-0134). Nothing to hold.

## L. Iteration 64 (14:22–14:38 UTC) — whose shadow is on the D boulder: the trees', entirely (a `?nocast=<group>` diagnostic)

§J showed the D boulder is flat because something shades it. Which system's casters is the brief's owner question, so:
a diagnostic build of the head with a URL switch (`?nocast=<group>` — every mesh under that top-level world group stops
casting, re-applied each frame so pooled parts are caught too), rendered at D once per group; the frame's rock box
0.04–0.18 × 0.66–0.84:

| D rock box | mean l | macro σ | p10 / p90 |
| --- | --- | --- | --- |
| reference | 0.326 | 0.124 | 0.18 / 0.49 |
| head (all casters) | 0.306 | 0.050 | 0.24 / 0.37 |
| **`nocast=trees`** | 0.355 | **0.109** | 0.25 / **0.52** |
| `nocast=structures` | 0.306 | 0.050 | 0.24 / 0.37 |
| `nocast=vegetation` | 0.306 | 0.050 | 0.24 / 0.37 |
| shadow map off (§J) | 0.333 | 0.117 | 0.22 / 0.51 |

With only the trees' shadows gone the boulder has 93 % of the shadow-off gain (macro σ 0.109 of 0.117; p90 0.52) —
**the shade is the trees system's: the giant's lobes and crowns over that spot; structures cast nothing there, and the
canopy roof never casts (`canopy/index.ts`).** So round-50 #1 / round-52 #12 is a **sun corridor in `trees/index.ts`**,
the same `sunCorridors` machinery that keeps crowns out of the sun's path to the flagstones, aimed at the shot-D
boulder's spot (fable-2's 2 m pose frames it: camera (−2.4, 1.3, −5.6) → (−2.0, 0.6, −7.6)), with the bearing checked so
the crown takes the light. Owner: the trees / giants lane. Vegetation and structures: 0 — the head's
row to the third decimal.

## M. Iteration 65 (15:29–15:35 UTC) — the take sealed (as take-0132, `4f22e7ec`): §D's row held to ±0.0004 on five views and +0.0012 on C; W02 re-filed pass (reinforced), C01 re-filed fail (Link pixel-identical to take-0131); 41/50

Full read in `fable-5-take0132.md`: the six views landed on the expected row — A +0.0056 (the tint less PR #29),
C −0.0039 and F −0.0062 (PR #29 less the tint's F gain) — with B and E moving 0.14 % of their pixels, the
pipeline's own noise; the browser-per-view capture is healthy and the deltas are the source, as booked. The flight
box at A went 61.1 → 40.2 % dark (r54 §A predicted 40.7). Link at E is pixel-identical to take-0131, so C01 stays a
fail on the tunic (0.14 darker, 17° greener than the frame's). Expected take-0134 (the head at `bc7481bb`, all
frame-neutral merges plus the grass): A 0.2207, B 0.1985, C 0.2193, D 0.2765, E 0.2198, F 0.2297.

## N. Iteration 66 (16:34–17:02 UTC) — the owner's clarity direction: the circled crowns measured against the reference (fable-cursor's 15:45 ask), Astra's atlas painter checked at five poses

Delivered as `reference/ANALYSIS_CLARITY.md` (method `fable-5-r55/clarity.py`, sheet `clarity-owner-vs-reference.jpg`).
The short form: the circled crown's luminance gap to its background (0.19–0.24) is the frames' — what differs is
**hue** (background 165° cyan-grey vs the frames' 44–60° warm haze; crown 62–93° vs 46–64°), **haze weight** (crown
l 0.39 and a 6.6 px edge at 15–25 m — the frames give that look to crowns at 50 m; their near-high crowns are
0.27–0.34 and 3.4–4.7 px) and **silhouette scale** (2.7 % of the crown finer than 9 px vs the frames' 10.7–14.4 %).
Targets posted (l 0.30–0.35, hue 45–60° on a 45–60° background, edge ≤ 4.5 px, ≥ 10 % fine detail; keep the gap).
Astra's far-crown atlas painter (`b7c9e001`) changes 0.02–0.06 % of pixels at five crown poses — it does not touch
the circled lobes, which are the giants' canopy at 15–30 m: the loss sits in the near→far canopy swap and the haze
on it. Our sky behind every high crown is 200–207° blue. Owner's exact pose requested for a before/after on our build.

## O. Iteration 67 (17:23–18:00 UTC) — Astra's height-fog clarity slice (`ae880cf2`) measured: every far band 0.05–0.12 below the frames', hue unchanged; at the crown poses the sky stays 200–207° blue (six-view column corrected in §Q: the first pair's flags did not match)

`reference/ANALYSIS_CLARITY.md` §3. The slice (hazeDensity 0.018 → 0.008, far 0.055 → 0.008) clears by darkening: the
frames' far bands are bright warm haze (l 0.40–0.50, hue 50–64°) with dark crisp crowns inside; ours after the slice
are l 0.28–0.38 at 65–74°. C and D lose 0.012–0.015 — the largest single-step six-view losses of these rounds. Posted
to fable-cursor and Astra before take-0134 seals with it, with the frames' target for the same boxes (the old density
or near it, warmed and brightened; crisp silhouettes against it). The crown poses confirm §1: the slice does not touch
the sky colour behind the high crowns (200–207°) or their silhouette scale.

## P. Iteration 68 (18:28–18:46 UTC) — fable-4's k3/k4 attribution taken (the circled forms are the distant cards; my §2 inference withdrawn); the painter and the fog slice measured on the cards themselves

`reference/ANALYSIS_CLARITY.md` §4. On the sky-facing cards (k3) the painter takes the edge from 4.9 to 4.0 px and the
leaf-scale detail from 1.4 to 2.9 % (the frames' 10.7–14.4 %); on the hazed cards (k4) nothing registers (16 px edges on
all three builds); the fog slice lightens and saturates the sky-facing card away from the frames (0.41 → 0.46, 0.13 →
0.20); the sky behind the cards is 207° on every build. Posted to Astra, fable-4, fable-cursor with the expected read
for take-0134 at k3/k4.

## Q. Iteration 69 (19:35–19:53 UTC) — take-0133 read (the expected row held to ±0.0003; 41/50, nothing filed); the fog pair re-rendered with matching flags after fable-2's catch: A −0.0029, B −0.0030, C −0.0081, D −0.0143, E −0.0024, F −0.0040

`fable-5-take0133.md`: every view within ±0.0003 of the row predicted from take-0132 + §F/§G/§I/§K.2 (F 0.2297 exactly);
41/50, the same fails; W02 / C01's take-0132 verdicts carry; A 452 draws / 8.83 M. **The correction:** my §O fog pair had
`--character` on the after frames only — fable-2 (19:00) spotted that A +0.0102 needed a before no head measures; the
clean pair (no characters either side) is A −0.0029 / B −0.0030 / C −0.0081 / D −0.0143 / E −0.0024 / F −0.0040, fable-2's
to 0.001, and the slice now costs on all six views. `ANALYSIS_CLARITY.md` §3 corrected at its head; the far-band rows
(upper bands, no characters) stand. Expected take-0134 posted: A 0.2179, B 0.1958, C 0.2113, D 0.2622, E 0.2173, F 0.2257
plus the stand roof's unmeasured share.

## R. Iteration 70 (20:31–20:58 UTC) — the two clarity-set pieces nobody had at the six views: owner-fable's stand roof (PR #31) and Astra's far packs + upper-canopy admission

Two clean pairs (no characters either side, the same shot list; before frames from §Q's clean fog render):

| pair | A | B | C | D | E | F | where the pixels move |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **roof** `ae880cf2` → `bacdd46b` (owner-fable claimed A/C 0, B +0.0010, D +0.0013, E +0.0003) | +0.0003 | **+0.0015** | 0 | **+0.0022** | +0.0007 | 0 | the frames' top edges (B/E x 0.32–0.38, D x 0.16–0.58 × y 0–0.12): new roof lobes over the north stand, darker by 16–22 levels where haze was; 0.05–0.58 % of pixels |
| **packs + admission** `bacdd46b` → `8f07e181` (packs claimed pixel-exact; the admission "fixed viewpoints no longer permanently exclude it") | +0.0002 | −0.0001 | **−0.0050** | 0 | −0.0002 | **−0.0014** | C x 0.01–0.21 × y 0.09–0.41 (0.76 %, **+17.8 brighter**): the giant's canopy behind the lantern gains lit leaf clusters; F x 0.65–0.84 × y 0.10–0.38 (0.38 %, +28.7) |

**Roof: the claims reproduce** (same signs, mine a shade larger) — a small gain at B/D/E where canopy mass replaces
haze at the top edge; C and F byte-identical. **Admission: not byte-identical at the fixed views** — fable-cursor's
17:30 lane note said the six fixed frames would stay so; the import's own message says the opposite ("fixed viewpoints
no longer permanently exclude it"), and the frames agree with the import: C loses 0.0050 (over the −0.003 budget) and
F 0.0014 while the upper canopy at C's left visibly gains lit leaf detail — the owner's "sharp upper trees" bought
against the frame's dark hazed bank. An owner-direction change is exempt from the budget if it is named as one; it
should be named. The far packs are inside this pair too; A/B/E's 0.1 % at the very top edge, darker, may be theirs or
the admission's — either way ≤ 0.0002. Sheet `fable-5-r55/fable-5-r55-admission-C.jpg`.

**Expected rows, refined.** take-0134 (fog + roof + atlas + stand LOD on take-0133): **A 0.2182, B 0.1973, C 0.2113,
D 0.2644, E 0.2180, F 0.2257.** take-0135 (+ packs, admission, strap): **A 0.2184, B 0.1972, C 0.2063, D 0.2644,
E 0.2178, F 0.2243.**

## S. Iteration 71 (21:35–21:38 UTC) — the hue lever in numbers (ANALYSIS_CLARITY §5) and the clarity poses published

The frames' background behind high crowns, top 30 % by band: #8a8875 / #858372 / #807f72 (h 52–57°, s 0.06–0.08,
l 0.48–0.50); ours on `8f07e181`: #777c7e-class neutral-cool greys (s 0.02, R ≤ B), 0.02–0.10 darker after the fog slice.
Target and a check on the pending palette pair posted to Astra; `fable-5-r55/clarity-poses.json` (k3/k4 + two plaza
crown poses) committed for anyone's `broll.mjs --shots`.

## T. Iteration 72 (22:32–23:04 UTC) — the player-height walk of the head `8f07e181` (GOAL_MODE fable-5 #3)

`fable-5-walk-r55-head.md`: 17 poses; V19 closed (the tunnel's tone matches `d_121` to 0.001), V17's inversion gone, the
ledge / flight / backside / flares landed; the ranked open list led by the three clarity items, then V16's seams, the D
boulder's shade, the flight's climb into shade, the giants' limbs, C01/C02/U02, W05/W30/W31.

## U. Iteration 73 (23:36–00:11 UTC) — fable-4's colour-pass culling (`06a1dca5`, merged `220fff43`): byte-identical at nine positions

The colour pass now draws only the tree family instances whose three-sphere hull is in view (the shadow pass keeps
every caster) — A −150 K, F −130 K, B/C/D/E −50…−60 K by fable-4's counts, with the six views claimed pixel-identical.
Before `8f07e181`, after `220fff43`, same shot list, no characters: **A, B, C, D, E, F — max |Δ| 0.0, SSIM identical to
four decimals** (0.1989 / 0.1822 / 0.1964 / 0.2501 / 0.2036 / 0.2064); and at the three walk poses most likely to catch a
hull test clipping an instance at the frame's edge — `x-clearing-n` (the ledge with stems at both edges), `w04-spine-l`
(the plaza under the limb), `wb-grove-10m` (the grove filling the right edge) — **max |Δ| 0.0 as well.** A W38 give-back
the frames cannot see, as claimed; nothing to add. (Triangles not re-measured here; the frame check is what this adds.)

## V. Iteration 75 (01:31–01:33 UTC) — take-0134 (the clarity set) read: the expected row held to ±0.002, every view down, 41/50, nothing to file

`fable-5-take0134.md`. A −0.0027, B −0.0004, C −0.0064, D −0.0110, E −0.0008, F −0.0044 vs take-0133 — the fog slice less the
roof's gains, the atlas and stand LOD neutral; the capture pays a little less at C/D than my pairs. Against the owner's circle
the take meets the edge target on the sky-facing cards and moves lightness / saturation away from the frames; the sky is still
blue; the hazed cards unchanged. W10 stands as a fail. Expected take-0135 posted.

## W. Iteration 76 (02:35–03:05 UTC) — the owner's 2026-09-23 items on the head (`220fff43` → `f04fbf5a`: weathered log flight, crafted lanterns + huts' trim, the west house's doorway light, distant crowns' floor cards, play-camera changes) at the six views and three owner poses

Six views (no characters, the same shot list; before = §U's frames):

| view | Δ SSIM vs reference | pixels > 6 | what moved |
| --- | --- | --- | --- |
| A | **−0.0008** | 4.00 % | the hero flight (x 0.59–0.80 × y 0.22–0.60), **darker by 27 levels**: the weathered logs |
| B | −0.0001 | 0.20 % | the top band — the distant crowns' floor cards entering the far layer, darker |
| C | 0 | 0.67 % | the lantern at C's left (x 0.01–0.20 × y 0.33–0.62), darker by 23 — the crafted lantern replaces the glowing husk |
| D | +0.0002 | 0.06 % | |
| E | +0.0003 | 0.21 % | the top band, as B |
| F | **+0.0029** | 4.35 % | the flight at F (x 0.23–0.44 × y 0.20–0.60), darker by 28 — the same logs, and F's frame likes them |

**The flight, two asks at once.** The owner (09-23): the second staircase "has an obvious repeated pattern" — the
twenty near-white log nosings striped against shaded treads. The fix varies each log's bark phase, roll, tint and
moss and breaks the stake pairs; the stripes are gone and the flight reads as weathered timber (sheet
`fable-5-r55/fable-5-r55-owner0923-A-flight.jpg`). The frames' ask (r53 §B, r54 §A): the flight box at A dark 15.9 % /
pale 13.9 % / l 0.344 — pale packed treads between *thin* dark nosings. The tint had taken us to 45.8 / 12.6 / 0.289;
the weathered logs give back half of it: **52.8 % dark / 7.4 % pale / l 0.262**. Both asks are right and they meet at
the *treads*, not the logs: with pale treads (albedo + the light on that slope — fable-4's flight-shade: 0.376
shadowless vs the frame's 0.65) the logs can be dark and varied as the owner wants and the flight pale as the frame
wants. As it stands the owner's pattern is fixed and the frames' weight has regressed to between take-0131 (61 %) and
take-0134 (46 %). Expected take-0135 at A moves by −0.0008 on this; F by +0.0029.

**The lanterns and the west house.** `west-house` (the harness spot, (−16.3, 4.35, 6.5) → the door): 23.8 % of the
frame changes — the huge flat glowing husks in front of the door become ribbed lanterns with a visible flame and a
warm 5 m pool on the platform; the frame mean 0.215 → 0.189 as the husks' glow area goes (sheet
`fable-5-r55-owner0923-west-house.jpg`). `saria-side`: 13.6 %, the pods crafted, the frame mean unchanged. Both are the
owner's words made visible; nothing at the six views beyond C's 0.67 %.

**The distant crowns' floor cards.** At my `u-open-up` framing ((1.5, 5.1, −40) looking 70° up) the view meets the
near canopy, not the distant ring, and 2.4 % of pixels move by ±1 level — the owner's streaks are not reproduced at
my pose, and I do not claim the fix either way; at the six views the cards enter B/E's top bands at 0.2 %, darker.
The owner's exact look-up bearing is the missing input, as it was for the clarity circle.

Play-camera changes (pitch orbit, collision, near-card dither) are play-only by construction — not in these frames.

## X. Iteration 77 (03:31–03:55 UTC) — the head `3b37b8b7` (the polish: repaired / checked logs, the lantern flame; the distant-crown fade tuning) and the A / B / F re-verdict fable-cursor asked for

**The polish step** `f04fbf5a` → `3b37b8b7`: A −0.0002, B 0, C 0, D 0, E 0, F −0.0002 — the repaired pair and the checked
logs change 0.02 % of A's pixels; the flame's size is inside the pods; the crowns' fade tuning is off the fixed frames.
**Cumulative since take-0134's build (+ the culling), `220fff43` → `3b37b8b7`: A −0.0010, B −0.0001, C 0, D +0.0002,
E +0.0003, F +0.0027.** The flight box at A is unchanged by the polish (52.8 % dark / 7.5 % pale / l 0.262).

**Re-verdict at A / B / F on the head** (to be filed on take-0135 when it seals — D7 files against a take; sheet
`fable-5-r55/fable-5-r55-owner0923-lanterns-ABF.jpg`):

| item | read on `3b37b8b7` | verdict |
| --- | --- | --- |
| **W02** the hero flight | log-risered as before (take-0129's pass on kind); the timbers now individual — grain along the log, wear, moss, a repaired pair, checked old logs; the frames' weight regressed with the tint's removal (52.8 % dark vs the frame's 15.9, the take-0134 build 45.8) | **pass on kind, the weight noted** — the treads' albedo and light are the remaining half |
| **W14** the lantern branch at A | the limb crosses the left of A at the frame's height; three pods on cords under it (two mid-limb, one at the frame's left edge), leaf clusters along it | **pass** (carries) |
| **W26** glowing pod lanterns | every pod is a crafted lantern now — a ribbed calyx over the husk, a hoop, an open bottom with a flame — still Deku-nut shaped, yellow-orange, on cords; Saria's cluster 5 at the eave, the limb's 3, the west house's 3 + a 5 m pool at its door; glow restrained, no bloom | **pass, reinforced** — the owner's "crafted object" and the rubric's pod agree; nit: Saria's cluster still lime-led (3 lime : 2 orange) where the frame's door cluster is orange-led |
| **W10** canopy at F | sky-like pixels 0.3 % (the auto half, ≤ 45 %, trivially met; the frame's own is 3.1 %); the visual half — "dense, layered canopy with light breaking through" — F's top is haze between lobes, not canopy, and the fog slice made the haze darker, not warmer | **fail** (carries) |

Nothing else at A/B/F moves a verdict: W01, W15, W20, W25, W29, W32 unchanged in kind.

