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
