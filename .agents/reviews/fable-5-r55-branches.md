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

## take-0133 — sixth start 08:33 with 10 GB free, stalled again at A 71–75 (tick 225, swap added). Re-verdict follows when a take seals, against §D's expected row (the head has moved twice since: pebble-bytes' 2-level steps and `onUpload` are frame-neutral, so §D's row still holds).
