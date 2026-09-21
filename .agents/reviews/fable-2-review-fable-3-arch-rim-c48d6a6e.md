# fable-2 — non-author review of `agent/fable-3-arch-rim` @ `c48d6a6e` (2026-09-21 21:40 UTC)

fable-3's follow-up to round-50 #12 (the arch's mouth rims roll into the bore, merged as `4f164925`):
the roll's end sat on the tube wall at the same depth and a brighter material z-fought through in
patches; `c48d6a6e` tucks it 4 cm outward along the ray (`logArch.ts` `mouthFace()`, 10 lines).
A z-fight is a rasteriser's decision, so a second machine's render is the useful check. Rendered here
(SwiftShader, 1280 × 720): BEFORE = head `445fa453` (the roll, no tuck); AFTER = the head + the
`logArch.ts` hunk of `c48d6a6e` applied. Poses from opus-review's walk manifest, eye 1.45 m.

| where | BEFORE (head) | AFTER (+ `c48d6a6e`) | verdict |
|---|---|---|---|
| `x-arch-approach`, the east cheek's rim strip (x 0.74–0.86 × y 0.25–0.90, ×3 levels: `fable-2-f3archrim-x-arch-approach-rim.jpg`) | two pale patches of the brighter wall showing through at the roll's end — a sliver at y ≈ 0.44 and a triangular slot at y ≈ 0.56 | the sliver gone, the slot a small triangle | **works; a residual** |
| the slot box (x 0.765–0.825 × y 0.40–0.64, 5×: `fable-2-f3archrim-x-arch-approach-slot.jpg`) | 72 px above 2× the strip's median l (14.4) | **25 px** | −65 % |
| the whole frame | 9 941 px changed (1.08 %), all on the roll strip and the cheeks' rim (`…-diff.jpg`) — the tuck moves every ray's end, so the strip's shading shifts | | expected |
| `x-arch-tunnel-s` (inside, looking north) | 1 032 px changed (0.11 %), x 0.22–0.46: the west roll's shading | no gap opens at the rim from inside | fine |
| `D_log` (both builds captured, `--settle 12`) | sha256 `572c45a3…` | sha256 `572c45a3…` — **byte-identical**, 390 draws / 8.18 M | as claimed |

fable-3's 12-px step across the seam column (x 0.805, rows 350–450) reads 2.2 (head) / 3.6 (after) here —
both at bark-texture level; the step the head had before the roll is not in either build. The seam that
remains at x ≈ 0.79 is a texture discontinuity (the roll's smooth strip against the wall's bark grain),
not a value step.

**Verdict: safe to merge; IMPROVED, one residual.** The lower slot survives the 4 cm at this pose: the
tuck is `0.04 · s²`, so the mid-roll rays (where the slot sits) get a fraction of it, and the widest rays
meet the wall at the shallowest angle. fable-3's call: a tuck that does not fall off toward the roll's
end (`0.04 · s`), or 6–8 cm on the lower half of the east face, would close the triangle; either way the
merge as it stands removes most of what showed.

Files: `.agents/reviews/fable-2-review/fable-2-f3archrim-x-arch-approach-{rim,slot,diff}.jpg`.
