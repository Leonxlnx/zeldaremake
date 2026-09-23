# fable-5 — non-author review of lane 7 (fable-3), `agent/fable-3-kokiri-girl` @ `4b1759f9`: the people are back and the girl is a Kokiri — 2026-09-23 15:30 UTC

Branch base = the head `be123deb` (its `src` differs by `character/{kokiri,npc,index}.ts` only). Owner's ask (06:50, twice):
"the people also need to be updated too"; fable-cursor's order (12:55): the girl by the signpost first (ref-01, demo
d_023–d_036), then the cast back at the demo's spots, light counts constant. Rendered here on my box, 14:39–15:27 UTC.

## 1. Six fixed views, `be123deb` → `4b1759f9` (`broll --test --settle 8 --character`, the same list / order, both builds)

The takes render with the character group visible, so the returning cast enters the frames where `VIEW_TABLE` stands
the kids (built from the reference frames' own kids). Without `--character` the six views are byte-identical (broll
hides the whole character group, kids included) — so this pair is the one that predicts the take.

| | A | B | C | D | E | F |
| --- | --- | --- | --- | --- | --- | --- |
| Δ SSIM vs reference | **−0.0034** | **−0.0069** | −0.0001 | 0 (byte-identical) | **−0.0050** | −0.0014 |
| pixels moved > 20 levels | 0.77 % | 2.02 % | 0.42 % | 0 | 2.08 % | 0.63 % |
| where | slot 0 at the right edge (x 0.59–0.99, y 0.33–0.90 incl. her shadow / fairy light) | slots 1 + 2, lower left (x 0–0.86, y 0.46–0.99) | slot 0 centre-left (x 0.31–0.47, y 0.43–0.63) | — | as B | slot 0 before the boulder (x 0.11–0.68, y 0.40–0.69) |

Three views cross the −0.003 rule (A, B, E) — an owner-directed change (the cast returns), so a number for fable-cursor
and the take's expected row, not a fail to file. The kids stand where the reference frames have kids, but the SSIM does
not reward it at 256 × 144: a 30–70 px figure with a different silhouette / colour from the frame's costs 0.003–0.007.
Expected take-0135 row on the head + this branch (from §7a/§9 of the lane-10 report): A ≈ 0.194, B ≈ 0.172, C ≈ 0.190,
D ≈ 0.236, E ≈ 0.183, F ≈ 0.219. Sheets: `fable-5-lane7-review/it87-ba-A-kid.jpg`, `it87-ba-B-kids.jpg`,
`it87-ba-F-kid.jpg`.

## 2. Play mode — the cast at the follow camera (`fable-5-lane7-review/people-play.mjs`)

`?test=1`, Link stood 5.5–6 m from each kid facing her, the follow camera settled (≈ 9.8–10.3 m camera → kid), one drawn
frame per kid, on **two builds at identical Link / camera positions**: the branch, and the head `be123deb` with one
diagnostic line (`backgroundCast.visible = true`, never shipped) so the *old* girl stands at the same spots — a true
before / after of the sculpt. Kids' feet in play mode: the walker (8.63, 0.87, 3.97) on her plaza loop, the sitter
(8.33, 0.28, 0.51) on the main flight's tread, the boy at Saria's door (10.55, 0.99, −7.51), the ledge girl
(−0.52, 5.67, −78.4), the bank girl (−18.66, 1.92, 17.15).

- **The girl (walker and sitter — the same rig):** the smooth brown helmet of hair hugging the skull is a **wide maroon
  bob with seven soft lobes under the green band and a sheen**; the skin orange-tan → pale peach; the head a little
  larger (head + hair ≈ 35 % of her standing height in the frame; the demo girl in `d_030` ≈ 32 %). The green tunic with
  its belt reads the same at 10 m (the drape canvas does not resolve there), the arms and legs are still smooth cylinders,
  the boots dark blocks. **Against the demo's girl (`d_024`–`d_033`, `it87-demo-girl.jpg`): the kind now matches** —
  maroon bob, green band, pale skin, green tunic, dark boots. What the demo has that we do not, at this distance: a face
  (readable eyes with whites and brows, a mouth; ours two dark patches on a flat disc), a serrated tunic hem over a
  darker under-layer, and a fairy that is a small glow with wings (ours a white blob the size of her head).
  Sheets `it87-ba-kokiri-a-walker.jpg` (with the demo crop beside), `it87-ba-kokiri-b-sitter.jpg`.
- **The boy at Saria's door:** brown hair, green band, big dark eyes, tan skin — nearly unchanged (the skin a shade
  paler); half behind the door bush from the plaza side. `it87-ba-kokiri-c-door.jpg`.
- **The bank girl:** byte-identical at 10 m (too far for the changes to resolve); the ledge girl at 78 m north the same.
- **Routes:** `playtest --only walk` on the branch — **9 / 9 routes reached, 0 stuck**, the same frames and camera numbers
  as the head (`plaza-loop` crosses the walker's loop; nothing blocks). The 1.26 m camera pop leaving the west house is
  still there — not this branch's.
- Not measured here: the light count / shader compiles on the walk (fable-3's "fairy lights stay in the scene and dim by
  intensity"); the trees' programs were 107 → 107 on the head at 11:14 and a pacing pass with the cast would settle it.

## 3. Verdict (non-author)

A clear visible step in the owner's direction: the people are back at the demo's spots and the girl reads as a Kokiri
at the follow camera. Merge-worthy on kind; the six-view cost (A −0.003, B −0.007, E −0.005) is the price of the
owner's ask and should be said in the merge note. Next for lane 7, in the order the follow camera sees it: the face
(eyes / brows / mouth that read at 8–10 m), the fairy's size and wings, the tunic's serrated hem, the arms.

## 4. Follow-up, 18:42–18:51 UTC — the boy at Saria's door on the lane-7 pass (`agent/fable-3-kokiri-girl` @ `e7a01c7e`, unmerged; before = the head `0d66fa51`)

Same probe (`people-play.mjs`, now with a uniform-frame guard — SwiftShader handed one black frame back on the head's
first pass), Link 5.5 m from the boy, camera 9.8 m. The smooth brown helmet and thin band are a **lobed bob with the
wide green band, paler skin, a slightly larger head and a mouth** — the girl's pass applied to him, his dark-green tunic
unchanged; he still stands half behind the door bush from the plaza side. The other four kids' frames are pixel-identical
(0–0.1 %). Kind matches the girls; the face at 10 m is still two dark patches. Sheet
`fable-5-lane7-review/it91-ba-boy-door.jpg`.
