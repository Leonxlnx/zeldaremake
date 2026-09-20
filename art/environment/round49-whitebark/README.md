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
