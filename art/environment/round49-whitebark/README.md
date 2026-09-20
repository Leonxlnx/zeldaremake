# Round 49 — fable-4 goal-mode iterations (white-bark trees)

Branch `agent/fable-4-budget` off the world head `8947388` (round 48 merged; take-0121 sealed on
`cf8083b` and D2-flagged on W38 — camera A over the 9.0 M ceiling). BEFORE = `8947388` built
here, AFTER = the branch; six views `capture.mjs --settle 6`, poses `broll.mjs --test --settle 12`
at the same batch position each side; one Chrome at a time.

## Iteration 5 — the white-barks' W38 give-back (`119a7b4`)

Round 49's perf-3 needs ≥ 250 K back at A with nothing visible. This family submits ≈ 312 K at A
(2 high / 11 medium / 13 low instances); its distance meshes carried two things a walker cannot
see past the 20 m swap:
- **twig wood at the medium LOD** — 5–20 mm twigs are under a pixel beyond 20 m; the medium mesh
  now takes the tube's draws (`consumeTubeDraws`, so the stream and every leaf position stay
  exactly where the high mesh puts them — no LOD desync) and builds no wood for them; the low
  mesh already skipped them (writer.ts, < 12 mm). Medium wood −45 %.
- **leaf retention** — the distance meshes keep one leaf in 6 / 12 (was 5 / 10) at the size that
  holds the covered area (scale² / every ≈ 0.8): 4–10 px laminae at 20–44 m either way.

Fingerprint: high LOD identical on 10/10 variants; medium −24 %, low −10 % (sum of the ten:
119,369 → 91,277 and 35,912 → 32,338 triangles); placements untouched.

| view | SSIM | draws | triangles |
| --- | --- | --- | --- |
| A | 0.2177 → 0.2177 | 561 → 561 | 9.141 → 9.115 M (**−25 K**) |
| B | 0.2015 → 0.2014 | 519 → 519 | 8.344 → 8.310 M (−34 K) |
| C | 0.2335 → 0.2335 | 403 → 403 | 7.622 → 7.512 M (**−110 K**) |
| D | 0.2771 → 0.2771 | 391 → 391 | 8.527 → 8.483 M (−44 K) |
| E | 0.2110 → 0.2111 | 519 → 519 | 8.344 → 8.310 M (−34 K) |
| F | 0.2562 → 0.2562 | 501 → 501 | 8.528 → 8.472 M (−56 K) |

Audit at the capture camera: `whitebark-lod1` 171,765 → 131,309, `whitebark-lod2` 41,623 →
37,675, `lod0` unchanged; LOD submission [2, 11, 13] both sides. W12 163/163, determinism 0,
console 0 errors, typecheck + build green.

| pose | verdict | what changed |
| --- | --- | --- |
| `f4-pair-12-20m` (stems at 12–40 m) | nothing visible | the medium crowns re-select their laminae (3.4 % of the frame, 0.8 % strongly); the mass, tone and marks read the same |
| `w18-spine-r` (stems at 15–25 m) | nothing visible | 1.2 % of the frame |

**Camera A stays over 9.0 M (9.115 M): the head's excess, not this branch's — perf-3's lane.**
If more is wanted from this family, the medium leaves are the rest of it (≈ 100 K at A at one in
6); one in 8 at 2.5× would give ≈ −25 K more but starts to read as cards at 20 m — declined
unless asked.

## Iteration 6 — a real low bough on every young and mature stem (`d914268`, `29b9ed1`)

fable-5's round-49 list #10 (W08 at C, take-0121): "the one white-bark at C is a straight pale
pole with a sprig". Traced: it is the survey tree (variant 7, 22.7 m, just past the 20 m swap),
camera C sees its lowest 6 m with the crown out of frame, and the old pruning-history limb's 1 m
tuft was the sprig. Now every young and mature stem carries a real low bough — a limb thick
enough to read (0.15–0.21 R) leaving the stem at 22–34 % of its height with a 1.7 m lobe in a few
big tufts at 3.5–6 m (2.5–4 m on the young stems); a third of them keep a second small tuft at
30–42 % (the same single params draw, so nothing else in the stream moves). Built after the
crown, so the crown geometry is untouched. Cost ≈ +7 K at A against iteration 5's −25 K.

| pose | verdict | what changed |
| --- | --- | --- |
| C's stem (`fable4-r49-bough-C-stem-crop.png`, head vs branch) | IMPROVED slightly, not closed | a limb and a small tuft appear on the stem; this tree's bough azimuth points mostly away from camera C and the lantern bough hides 2.5–3.5 m — at frame scale it is still mostly a pole; the "sprig" left of it is another stem 41 m off |
| `f4-trunk-8m` | PASS | a full leafy bough over the walker's eye line at 4–6 m — a tree, not a pole with a distant crown; 12 % of the frame changed, 4.5 % strongly |
| `f4-pair-12-20m` | PASS | low boughs on the 12 m and 20 m stems; 8 % / 3.7 % |
| `x-arch-tunnel-n`, `w18-spine-r` | small | the young stems' boughs at 2.5–4 m are thin in frame at 10–25 m (1–1.5 %) |

**Whole branch (`119a7b4` + `d914268` + `29b9ed1`) vs the head `8947388`, settle 6:**

| view | SSIM | draws | triangles |
| --- | --- | --- | --- |
| A | 0.2177 → 0.2177 | 561 | 9.141 → 9.123 M (**−18 K**) |
| B | 0.2015 → 0.2013 | 519 | 8.344 → 8.309 M (−35 K) |
| C | 0.2335 → 0.2339 | 403 | 7.622 → 7.520 M (−102 K) |
| D | 0.2771 → 0.2770 | 391 | 8.527 → 8.483 M (−45 K) |
| E | 0.2110 → 0.2112 | 519 | 8.344 → 8.309 M (−35 K) |
| F | 0.2562 → 0.2562 | 501 | 8.528 → 8.479 M (−49 K) |

W12 163/163, determinism 0, console 0 errors, typecheck + build green. Camera A stays over 9.0 M
(9.123 M) — the head's excess.

## On take-0122's C (the seal note's attribution) — measured

Tick 189 attributes take-0122's C 0.2372 → 0.2326 (−0.0046) to "fable-4's white-bark trunks". Three
captures on the sealed code (`acec321` = `de4c71b8`), settle 6, one Chrome at a time:

| build | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| sealed head | 0.2177 | 0.2015 | 0.2336 | 0.2771 | 0.2110 | 0.2562 |
| sealed head with my two merged commits reverted (`whitebark.ts`, `bark-texture.ts` at `0987e06`) | 0.2177 | 0.2015 | **0.2334** | **0.2769** | 0.2110 | 0.2562 |
| this branch (`7bf30a5`) | 0.2177 | 0.2013 | 0.2339 | 0.2770 | 0.2112 | 0.2562 |

Removing the white-bark crowns and marks makes C and D *worse* by 0.0002 each: my merged work is
+0.0002 at C, not −0.0046, and touches 0.32 % of C's pixels. The seal's C drop comes from
elsewhere between `cf8083b` and `acec321` (fable-2 measured their per-cell pebbles at C −0.0019;
the light strings and the settle-90 state are the other candidates). Draws and triangles are
identical between the first two rows — the merged commits are colour and texture only.

**This branch on the sealed head:** draws identical (562/518/405/392/518/503); triangles
A 8.679 → 8.672 M (−7 K), B/E 7.856 → 7.832 (−24 K), C 7.107 → 7.016 (−91 K), D 8.097 → 8.063
(−34 K), F 8.037 → 7.999 (−38 K); W12 163/163, determinism 0, console 0.

## Iteration 7 — the vertex marks retire (`5fe5848`, branch `agent/fable-4-r49b`)

fable-5's §I notes on the marks: the tile's bands sit on top of the round-48 soft vertex zones (some
stems showed a soft zone above a crisp band) and three bands plus two chevrons on 6 m read busy
against ref-04's one or two. The round-48 vertex-colour broad bands and chevrons are gone; the
tile's crisp bands and chevrons carry the large marks alone; the 6–14 cm bands and the sooty foot
stay. Vertex colours only — geometry identical on 10/10 variants. BEFORE = the head `0990b2c`.

| pose | verdict | what changed |
| --- | --- | --- |
| `f4-trunk-2m` | PASS | the crisp band alone; the paper below it pale with its lenticel rows where a soft zone darkened the whole upper stem (3.8 % of the frame, 1.3 % strongly) |
| `f4-trunk-8m` | small | 0.5 % — the soft zones were faint at 8 m already |
| `sn-whitebark-base` | unchanged | the foot and the 6–14 cm bands are round 47's and stay |

Six views (`0990b2c` → `5fe5848`, settle 6): A 0.2176 =, B 0.2015 =, C 0.2369 → 0.2368, D 0.2769 =,
E 0.2136 =, F 0.2564 =; draws 562/518/403/392/518/503 and triangles identical; W12 163/163,
determinism 0, console 0.

## Iteration 8 — the stems lean (`ea86f8c`) — a look change, reported with its cost

fable-5's W08 note at C after the boughs: "what W08 still lacks at C: lean and taper (the stem is
straight)". Traced: the survey tree (variant 7) had the smallest lean of the matures (2.8°) and leaned
along world −z — toward camera C — where a lean is foreshortened to nothing. Change: lean 5–10°
(was 2–8°, the same draw so each variant keeps its place in the range; variant 7 → 5.6°), the lean
azimuth's draw turned by `LEAN_TURN` (1.246 rad) so variant 7 at the survey tree's yaw leans along
world +x, across camera C; the crown scaffolds turn with it (same shapes, rotated); the low
boughs' offset is reduced by the same angle so every bough stays where iteration 6 measured it.
BEFORE = the branch at `5fe5848` (so the lean is measured alone). Sheets `fable4-r49-lean-*.jpg`,
crop `fable4-r49-lean-C-stem-crop.png`.

| pose | verdict | what changed |
| --- | --- | --- |
| C's stem (crop) | PASS for "lean" | the survey stem leans ≈ 5° into the frame from the ground to the HUD — a leaning birch, not a vertical pole |
| `f4-trunk-8m`, `f4-pair-12-20m` | PASS | the grove's stems lean each their own way (22 % / 19 % of the frames changed) |
| `x-arch-tunnel-n`, `w18-spine-r` | small | the young stems' lean at 10–25 m (5.7 % / 3.2 %) |

Six views (`5fe5848` → `ea86f8c`, settle 6): A 0.2176 =, **B 0.2015 → 0.2017, C 0.2368 → 0.2347
(−0.0021), D 0.2769 → 0.2765 (−0.0004)**, E 0.2136 → 0.2135, F 0.2564 → 0.2563; draws 392 → 391
at D, the rest identical; triangles A −3 K, D −52 K (a leaning stem left D's window bucket), F +3 K;
W12 163/163, determinism 0, console 0. Inside the −0.003 rule at every view, but C −0.0021 is the
largest cost any white-bark change has carried: the frame's SSIM against the reference falls as the
pale stem at its right edge leans into it. **The retire commit (`5fe5848`) stands on its own;
the lean is separable — fable-cursor's call whether W08's "lean" at C is worth C −0.0021.**

Whole branch vs the head `0990b2c`: A 0.2176 =, B +0.0002, C −0.0022, D −0.0004, E −0.0001,
F −0.0001.

### The lean's direction does not decide its cost (experiment, not shipped)

Tried: the same lean turned the other way, so the survey stem leans *out* of camera C's frame
(world −x) instead of into it — fewer pale-stem pixels where the reference is dark. Measured on the
tick-193 head (`0b66906`, same settle, one Chrome): no lean C 0.2374 → lean-out C 0.2355
(**−0.0019**, D −0.0003) against lean-in's −0.0021 on the previous head. The cost is the lean
itself — the stem's pixels moving against the reference's structure at C's right edge — not its
direction. Kept the into-frame lean (`ea86f8c`: the stem shows its lean along its whole visible
length; leaning out, its top leaves under the HUD). Crop `fable4-r49-lean-C-none-in-out.png`
(no lean | in | out). Whole branch on the tick-193 head: A 0.2178 =, B +0.0001, C −0.0019, D −0.0003,
E −0.0001, F =; draws 396 → 394 at D; W12 163/163; determinism 0; console 0.

## The far hut's knoll: the buried white-bark leaves (`agent/fable-4-knoll`, after expansion-2)

expansion-2's backside (`bd2595d8`) raises a live-only knoll under the far hut (`farHutRise` 1.4 m,
radius 8) while the trees stream builds against the LEGACY view. Their audit read "the nearest tree
base is 11 m off" — from `samplePositions.bases`, a strided sample of the tree bases (1 in 3–4), which
missed a scatter white-bark: **variant 7 (mature, H 12.9 m × 1.105, crown radius 4.7 m) at
(−39.72, 31.12), 4.8 m from the hut's column.** On the rendered ground it stood 0.70 m buried (live −
legacy at its seat), and from Link's spot (0, 1.5, 2) the lamp's sight line to (−41, 8.4, 35.7) passed
2.7 m from its axis at 7.9 m height — inside the crown. The hut expansion-2 layered behind the bank
and the Kokiri was behind a birch.

Fix: `heightfield.expansionCull` — the filter expansion-2 wrote for the legacy-built streams and
that nothing consumed yet — applied to the white-bark placements in `trees/index.ts` (one line, after
lod-1's column swap, before my authored clearing spots). A filter re-rolls nothing: 82 → 81
white-barks, every other seat identical (replica: only that one placement is inside the expansion's
box on moved ground; the three grove trees at the bank's toe/skirts and the clearing four sit on
unchanged ground, |live − legacy| = 0.000 m).

| pose | what changed |
| --- | --- |
| `f4-sw-pan-hut` (Link's spot → the lamp, fov 46) | 0.48 % of the frame: the knoll tree's crown at the centre goes, the hut's dark silhouette and walkway show through the haze behind the grove — crop `fable4-r49-knoll-sw-pan-hut-crop.png` |
| `f4-knoll-20m` ((−24, 1.7, 20) → the hut) | 10 % of the frame: the 14 m birch that stood on the knoll through the hut's level is gone; the hut stands clear on its column — `fable4-r49-knoll-20m.png` |

Six views (same head `97c83227`, settle 6, one Chrome): SSIM identical to four decimals at A–F
(A 0.2177, B 0.2016, C 0.2359, D 0.2757, E 0.2141, F 0.2565); A and F pixel-identical, B/C/D/E
2–3 pixels at ≤ 5 levels (capture flicker); draws 566/522/407/395/522/507 and triangles (A 8.61 M)
identical; determinism 0. The knoll is behind every fixed camera (bearing −47° from C, 18° outside
its west edge) and the tree's shadow tip ((−25, 42), bearing −28.7°) turned out not to touch C's
ground either.

### Young white-barks on the backside's banks — the constraint (not placed)

The item I offered expansion-2 (young stems on the new bank) runs into the same wall expansion-2
hit with the bank's own corner: the sun (azimuth −128°, elevation 38°) throws 1.28 m of shadow per
metre of height toward bearing 52° (+x, +z), and camera C's west frustum edge on the ground is
x = 2.33 − 0.5663 (z + 7.67). A 6–8 m stem anywhere on the bank's top (1.95 m) lands its crown's
shadow **3.4–8.7 m inside C's frame**; the three existing grove white-barks at the toe already do
(4–8 m, baseline since the seal). Shadow-safe seats start at x ≲ −26 (z ≈ 20) to −32 (z ≈ 18) —
behind the bank on the SW plain, in the far hut's sight-line zone and the SW pan's mid-ground. So
this is a composition call for expansion-2 / fable-cursor, not a lane task; nothing placed.
