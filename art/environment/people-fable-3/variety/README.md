# The cast's variety — lane 7 (fable-3), 2026-09-25 04:00 UTC

**Branch** `agent/fable-3-lane7-r2` on the head `7468bb38`; the change `7dba2a7f` (`src/world/character/kokiri.ts`,
the `KID` palette only).

## The defect

A self-review of the people at the owner's play distances, the real follow camera (Link placed beside each kid, the
camera 3.9–7.3 m from her — `people.mjs`, 12 frames, `before-after-six-kids-play-4-6m.jpg` top row): five girls,
five maroon bobs over five near-identical deep greens. The four girl looks the code already had (`KID.hair`,
`KID.tunic`) were four maroons (0x7e2f33 … 0x74282d) and four greens within a few values of each other — read off
the footage's signpost girl and then applied to every girl. At 4–7 m the cast is one girl five times; only the boy
breaks it. No earlier review named it because the fixed frames hold one girl.

## The change

Look 0 — the girl by the signpost, the kid the fixed frames A / C / F hold against the footage — keeps the footage's
maroon and deep green; the boy is untouched. The three looks no fixed frame holds take their own colour under the same
lock and cloth canvases (the canvases shade whatever colour sits under them):

| look | who (play mode) | hair | tunic / band |
| --- | --- | --- | --- |
| 1 | kokiri-b seated on the main flight; the grove girl (shares it) | honey-blonde 0xc89c4c | 0x4d7538 / 0x5e8a44 — a yellower, lighter green |
| 2 | the ledge girl | chestnut 0x74492b | 0x2c5238 / 0x3f7a4a — a deep blue-green |
| 3 | the south-bank girl | near-black brown 0x3a2a1e | 0x546b36 / 0x6a8a44 — a mossy olive |

Irises follow (hazel-green for the blonde, dark for the bank girl). Skins unchanged.

**Cost: none.** Each look already had its own hair / cloth / skin materials and each kid is its own skinned mesh, so
no material, texture or program is added and no draw moves — the twelve play poses count 598 / 602 / 626 / 632 /
553 / 571 / 334 / 348 / 426 / 446 / 642 / 638 before and after, identical. Typecheck, build, 191 / 191 tests.

## Why the fixed frames cannot move

Projecting the kids' fixed-view stands into the six cameras (`layout.ts` viewpoints): kokiri-a is in A (x 0.98), C and
F; the boy in A, B, E, F. Of the changed looks: kokiri-b stands at plaza west (−6.5, −2.1) in the fixed views — outside
all six; the bank girl is outside all six (C puts her at x 1.24); the grove girl is beyond the 60 m cull in every frame;
the ledge girl is inside A / B / D / E's frustums at 75–79 m, past the 25 m detail cut, behind the hollow's trees. The
capture below checks A, B and D (E is B's camera; C and F hold only unchanged kids).

## Evidence

- `before-after-six-kids-play-4-6m.jpg` — the six kids at the play distance, before (top) / after (bottom): the
  wanderer, the seated girl, the boy, the ledge, the bank, the grove.
- `before-after-stairs-seated-play.jpg`, `before-after-south-bank-play.jpg`, `before-after-grove-yard-play.jpg` — the
  full play frames at the stairs, the bank and the yard.
- `people.mjs` — the review script: places Link beside each kid (0.8 m off her axis, facing her way) at 1.2 m and
  3.0 m, lets the follow camera settle 45 frames, draws one frame, and writes `report.json` with the camera's
  distance, draws, triangles and the kid's screen projection (the crops above are cut from it).
- The fixed views A / B / D, head vs branch — the table below.
