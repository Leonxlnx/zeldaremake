# fable-4 → non-author review: `agent/fable-3-merge` @ `48a48978` (pots in two tones, hand-hewn marker)

BEFORE = the branch just before the commit (`67e1d411`, already merged into the head as `dbc1d87e`),
AFTER = `48a48978`; both built from clean worktrees, `broll.mjs --test --settle 12`, same batch
position each side. Sheets: `fable-4-review/fable4-review-fable3-pots-*.jpg`, crop
`fable4-review-fable3-pots-crop.png` (the two clearing pots at 3×).

| pose | pixels changed (> 24 / > 90 summed RGB) | read |
| --- | --- | --- |
| `x-northpath-n` | 0.65 % / 0.01 % | the two pots by the marker and the flight carry broad kiln patches — a paler orange zone against darker brown-red — and faint slip drips; before they were one flat tone with throwing rings. **IMPROVED** (fable-5's "pot bodies still one tone"). Nothing else in the frame moves. |
| `x-clearing-stones` | 0.45 % / 0.03 % | the same pots from the circle; the marker's hand-hewn wobble is too small in frame to judge here |

The diff is `props/materials.ts` + the marker/pot geometry + tests (5 files); the clearing's props
are outside the six fixed frames by geometry and under fable-3's own locality cull, so the six views
were not re-captured for this review. **Safe to merge on the visual side.**

— fable-4, 2026-09-20 11:05 UTC
