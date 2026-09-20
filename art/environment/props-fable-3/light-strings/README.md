# Props lane (fable-3) — iteration 5: the demo's light string (frame A)

BEFORE = the world head `0987e060` (world-identical to `cffe97a5`), AFTER = `agent/fable-3-merge`
@ `4b1edb0b` (on top of iteration 4's locality merge). Same commands both sides on this VM:
`capture.mjs --quality high --settle 12`, poses `broll.mjs --size 1280x720 --fps 12 --test --settle 12
--quality high` with `shots.json`. Labels burned in. The reference crops are comparison only.

## What the reference shows (measured, not eyeballed)

Reference frame A has two strings of small yellow-green lights, found by scanning the frame's own
pixels (bright, g ≥ r ≫ b, brighter than their 7 × 7 ring) and confirmed on 4× crops
(`A-reference-vs-ours-crops.jpg`):

- **(b)** a near-horizontal string at **(0.49–0.54, 0.47)**, ~7 dots, on the dark bank left of the
  flight. Unprojected through our A camera it meets the terrain at (6.5–8.2, 1.2, −6.0…−6.6): the
  house terrace's steep south bank (tilt 52–63°, brow at 1.5 m) above the lawn pocket left of the
  flight's foot, 16–17 m from A.
- **(a)** a diagonal string at **(0.28–0.31, 0.62 → 0.57)** on a bank at the plaza's left. Our ray
  meets flat plaza paving at (1.5–2.5, 0, −3.3…−7.4): the reference's plaza has a bank there and
  ours does not (fable-5's V15, the plaza's W/N closure). Not built — it would be pegs on flagstones.

fable-5's "(0.50–0.60, 0.55–0.62) and (0.90–0.95, 0.35–0.40)" were approximate: the first is
between (a) and (b), the second region holds the fairy, a pod lantern and the boy's head — no
string. My first two builds followed those numbers (a string along the pocket's foot, one on the
plateau bank right of the flight) and put the pocket string into camera C's foreground, whose
reference shows that bank bare (C −0.0015 … −0.0029 across three variants). Measuring the frame
moved the string to where A actually has it — and out of C.

## What landed

`kind: 'lightString'` (`terrace-bank-lights`): five nodes along the bank face just under its brow,
a slim stake at each end seated on the ground (the reference's lights hover with no visible
support), a thin cord drooping through the nodes, a glowing pod (r 2.4 cm) every 0.3 m — 9 pods.
Material `glow`: emissive 0xb8e84a × 2.3 (peak ≥ 2.0 linear, fog-exempt like the lantern pods),
no halo geometry — the lantern glow language stays with structures / atmosphere.

## Six fixed views (`six-views-after.jpg`, `A-stairs-before-after.jpg`)

| view | before SSIM | after SSIM | Δ | pHash | draws | triangles (M) | changed px |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_stairs | 0.2195 | 0.2195 | 0 | same | 577 → 553 | 9.08 → 9.09 | 158 (0.017 %) |
| B_house | 0.2042 | 0.2033 | −0.0009 | same | 535 → 514 | 8.31 → 8.32 | 425 (0.046 %) |
| C_lookback | 0.2393 | 0.2393 | 0 | same | 393 → 395 | 7.55 → 7.63 | 0 |
| D_log | 0.2794 | 0.2794 | 0 | same | 402 → 395 | 8.50 → 8.55 | 0 |
| E_ground | 0.2146 | 0.2144 | −0.0002 | same | 535 → 514 | 8.31 → 8.32 | 425 (0.046 %) |
| F_canopy | 0.2601 | 0.2596 | −0.0005 | same | 516 → 494 | 8.50 → 8.51 | 372 (0.040 %) |

(draws / triangles include iteration 4's merge; the string itself is +2 draws, +1.6 k triangles.)
Worst −0.0009 (budget −0.003); C and D pixel-identical; 0 console errors.

**Verdict — IMPROVED, not closed.** The motif now exists where frame A has it and reads at player
height (`px-bank-lights.jpg`: a row of lit pods along the bank above the pocket). In A itself our
pods are 2 px points at 16 m (158 px change, SSIM 0) where the reference's are soft 6–8 px blobs:
that softness is bloom / a halo, the lantern glow's owner (Astra / structures), not a prop's
geometry. If a halo pass wants them, the pods' world positions are in the props audit
(`clusterBounds['stair-foot'].glow` for the extent; the `glow` mesh is `village-glow`). String (a)
waits for a bank at the plaza's left (V15).

## Tests

`node src/world/props/geometry.test.mjs`: one string, 7–12 pods, the stair-foot cluster reports
glow / wood / rope bounds; every pod 0.1–0.6 m over the ground under it; the string spans A
(0.49–0.54, 0.47) like the reference and every node is outside C; the authored line builds on
forbidden ground (no probe). `npm run typecheck && npm run build` green.
