# The cast's variety — lane 7 (fable-3), 2026-09-25 04:00–05:30 UTC

**Branch** `agent/fable-3-lane7-r2` on the head `7468bb38` (PR #87); the change is the `KID` palette and `girlLook`
in `src/world/character/kokiri.ts`.

## The defect

A self-review of the people at the owner's play distances with the real follow camera (Link placed beside each kid,
the camera 3.9–7.3 m from her — `people.mjs`, 12 frames): five girls, five maroon bobs over five near-identical deep
greens. The four girl looks the code already had (`KID.hair`, `KID.tunic`) were four maroons (0x7e2f33 … 0x74282d)
and four greens within a few values of each other — read off the footage's signpost girl and then applied to every
girl. At 4–7 m the cast is one girl five times; only the boy breaks it. No earlier review named it because each fixed
frame holds one girl.

## The change

The two girls the fixed frames hold against the footage keep the footage's maroon and deep green: **look 0**, the girl
by the signpost (A / C / F), and **look 1**, kokiri-b at the left edge of B / E. The three girls no fixed frame holds
take their own colour under the same lock and cloth canvases (the canvases shade whatever colour sits under them):

| look | who (play mode) | hair | tunic / band |
| --- | --- | --- | --- |
| 2 | the ledge girl | chestnut 0x74492b | 0x2c5238 / 0x3f7a4a — a deep blue-green |
| 3 | the south-bank girl | near-black brown 0x3a2a1e | 0x546b36 / 0x6a8a44 — a mossy olive |
| 4 (new) | the grove girl | honey-blonde 0xc89c4c | 0x4d7538 / 0x5e8a44 — a yellower, lighter green |

Irises follow (dark for the bank girl, hazel-green for the blonde). Skins unchanged (look 4 reuses look 0's value).
The grove girl had worn kokiri-b's look (variant 5 → look 1); she now has her own (variant 5 → look 4).

**Cost:** looks 2 and 3 change colour only — no material, texture or program added. Look 4 is three more small
canvases (hair 512 × 256, cloth 256 × 128, the skin ramp) and their three materials, drawn by meshes that were drawn
already: zero draws. The twelve play poses count identical draws before and after. Typecheck, build, 191 / 191 tests.

## The fixed frames

Two passes. The first (`7dba2a7f`) also recoloured look 1 blonde, on the belief that kokiri-b stands at plaza west in
the fixed views; the A / B / D capture said otherwise — **A and D byte-identical, B 6,296 px changed** (head↔branch
0.9972, vs the reference 0.1767 → 0.1764): kokiri-b stands at B's left edge, 2.5 m from the camera, half cut by the
frame, and B is a footage frame. So look 1 went back to maroon and the grove girl got look 4 (`the second commit`).
A and D cannot move (they were byte-identical with look 1 changed, and looks 2–4's girls are 75 m off or culled); B was
re-captured on the revised build — the row below.

| view | head `7468bb38` vs ref | branch vs ref | Δ | SSIM head↔branch | changed px |
| --- | --- | --- | --- | --- | --- |
| A | 0.1953 | 0.1953 | 0 | 1.0000 | 0 (byte-identical) |
| B | 0.1767 | 0.1767 | 0 | 1.0000 | 0 above threshold (sub-threshold values differ; the first pass had 6,296) |
| D | 0.2511 | 0.2511 | 0 | 1.0000 | 0 (byte-identical) |

Draws 628 / 615 / 549 and 8.97 / 8.29 / 8.74 M on both. C and F hold only kokiri-a and the boy (unchanged); E is B's
camera.

## Evidence

- `before-after-six-kids-play-4-6m.jpg` — the six kids at the play distance, before (top) / after (bottom): the
  wanderer, the seated girl, the boy, the ledge, the bank, the grove.
- `before-after-ledge-play.jpg`, `before-after-south-bank-play.jpg`, `before-after-grove-yard-play.jpg` — the
  full play frames at the ledge, the bank and the yard.
- `B-left-edge-kokiri-b.jpg` — why look 1 stays: kokiri-b at B's left edge, the first pass (blonde) beside the head.
- `people.mjs` — the review script: places Link beside each kid (0.8 m off her axis, facing her way) at 1.2 m and
  3.0 m, lets the follow camera settle 45 frames, draws one frame, and writes `report.json` with the camera's
  distance, draws, triangles and the kid's screen projection (the crops above are cut from it).
