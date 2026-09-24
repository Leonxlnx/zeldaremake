# The 50-point rubric for every new structure or area (owner, 2026-09-24 06:07)

The owner: "make sure it's like 50 rubrics for each item". Every house, bridge, platform, prop cluster or new
area that ships is scored on these 50 checks, **0–4 each (200 max), with evidence for every score** — a
screenshot path, a measurement or a test. An item ships at **≥ 170 / 200 with no check below 2**; the checks
marked ★ must be ≥ 3. Scores and evidence go in the item's README (`art/environment/<branch>/README.md`), one
row per check. Judge at player height from 2–30 m, in play mode, like the owner walks it.

0 = missing or broken · 1 = placeholder · 2 = acceptable · 3 = good · 4 = matches the reference demo

## A. Silhouette and scale
1. ★ Reads as what it is from 20 m in one glance (house, bridge, lookout…).
2. Proportions fit Kokiri scale: doors ~1.3–1.6 m, Link (1.25 m) beside it looks right.
3. The outline is irregular and hand-built — no perfect boxes, cylinders or straight ridges.
4. It varies from its siblings with purpose (size, roof, height, dressing) — never a copy.
5. It holds up from above and below (the camera looks 60° up and 35° down).

## B. Construction
6. ★ Every part is visibly held by something: posts, pegs, lashing, brackets, rope.
7. Joints meet — no gaps, floating planks, interpenetration or z-fighting.
8. Load paths make sense: decks on beams on posts on footings.
9. Trim and edges are finished: sills, lintels, rails, eave boards.
10. Small construction detail at 2–5 m: plank seams, knots, nail heads, rope wraps.

## C. Materials
11. ★ Wood reads as wood (grain along the length, end grain on cuts), bark as bark, stone as stone.
12. Texel density matches the neighbours (no blurry or over-sharp surfaces next to each other).
13. Colour and value sit in the village's palette (warm browns, moss greens) — nothing chalk-white or neon.
14. Roughness and sheen are believable: dry wood matte, moss soft, wet stone slightly glossy.
15. No texture stretching, seams or visible tiling repeats at 3–10 m.

## D. Age and use
16. ★ Weathering follows exposure: moss on the shaded / north side, sun-bleach on tops, grime at the foot.
17. Wear follows use: worn thresholds, polished rails, trodden paths to the door.
18. Signs of life: pots, baskets, tools, washing, firewood, flowers in boxes — placed, not scattered.
19. Damage is plausible and sparse: a missing plank, a split post, a patched roof.
20. Nothing looks brand-new unless it is meant to be.

## E. Grounding
21. ★ It sits in the terrain: footings sink in, the ground is trampled or flattened around it.
22. No floating corners and no parts buried through the ground.
23. Contact shadow / AO where it meets the ground.
24. Vegetation grows around it naturally: grass at the foot, no grass through floors.
25. Paths lead to its door from the existing walk network.

## F. Openings
26. Doors and windows are recessed with frames, not painted on.
27. Interiors glimpsed through openings are dark or lit with depth — never a flat void or a white card.
28. Openings face where people come from.
29. Round Kokiri doors / windows where the reference has them.
30. Curtains, shutters or hanging leaves soften the openings.

## G. Roofs and tops
31. ★ Roof edges are soft and organic (moss, leaves, overhang) — no hard polygon rims.
32. Eaves overhang and cast shade on the walls.
33. Thickness shows at every edge (no zero-thickness shells).
34. Tops carry growth: moss caps, small plants, fallen leaves.
35. The roof line ties to the tree or rock it grows from.

## H. Light
36. ★ Lanterns / pods glow warm and steady; each has a believable hanger or bracket.
37. Light pools on the ground are restrained and soft.
38. No clipped whites: nothing flat white or blown out at any distance (glows included).
39. The item reads in both the lit shafts and in shade.
40. No new real-time light that toggles with distance (it recompiles every shader).

## I. Walkability and camera
41. ★ Link walks every intended surface without sticking; a walk route in playtest.mjs proves it.
42. Walls, rails and edges block him; probes off every edge are blocked.
43. Steps and ramps have walkable rise (≤ 0.55 m step guard) and feel even underfoot.
44. The follow camera never ends up inside it and never pops more than 0.3 m around it.
45. Footsteps play the right surface (wood on decks, stone on stone).

## J. Cost and coherence
46. ★ Every hero view stays ≤ 9.0 M triangles and ≤ 700 draws; the item's own view too.
47. Hidden when far or off-screen (expansion locality) — costs nothing out of view.
48. Deterministic: the same build draws the same frame (no Math.random in world code).
49. It belongs to this forest: art direction, era and scale match the existing houses.
50. The owner would stop and look at it — a detail worth walking up to.
