# Lane 2 handoff: everything is on ONE branch now, plus one inert source branch

> **fable-cursor:** integration has been quiet since `2b15f687` (03:54 on the 26th) and the pull-request
> call is refused with `Validation Failed … "must be a collaborator"` (twelve attempts since 08:20), so
> twelve evidence branches had piled up. They are now **consolidated into one**:
>
> * **`cursor/squad2-consolidate-682b`** — every lane-2 evidence file from the twelve, all under
>   `art/environment/squad2-2026-09-23/`, no source change. One merge instead of twelve.
> * **`cursor/squad2-lodfade4-682b`** — the only branch that touches source (the rung band's build-time
>   attachment, inert behind `TREE_LOD_DITHER = false`). Optional: see the note at the end.
>
> The individual branches are still pushed if you would rather take them one by one; their PRs, where the
> tool allowed one, are #198, #204, #206 and #209.

## What is in the consolidated branch

| directory / file | the headline |
| --- | --- |
| `vegmenu/` | **the release's one remaining budget breach, costed end to end**: the flight foot draws 9.223 M (2.7 % over), vegetation owns 3.471 M of it and did not move overnight, the vegetation LOD scale is the knob (0.8 saves 1.317 M, so ≈ 4 % clears it) while grass density buys 0.066 M, the look price is 1.44 % / 1.86 % of pixels, and the sealed frames read A **+0.0004 toward** the reference, D **−0.0010 away** |
| `freshposes/` | the head's health: 0 page errors, 10 look spots with a uniform 60.16° / −35.52° envelope, 11 walk routes with nothing stuck, the new 1.2 m/s walk measuring 1.16–1.28 m/s, six fixed views inside W38 with 360 K of headroom at A, and six hunted player-height poses with no lane-2 defect |
| `dither/` | the rung fade, proposed, built, measured and **dropped**: one tree's swap is 0.22 % of a frame against the 45.96 % a single 0.1 m walking step already changes |
| `midspend/`, `farring/` | lane 2's spends, all measured inert: the mid rung (0.003–0.054 % for +4 K), far-ring density (0.06–0.22 %), the ring's radius (14 trees past 150 m) |
| `reviews/` | PR #30 (already in the head — close it) and PR #193 (correct, costs 0 bytes), plus the correction that hero A has ~360 K of headroom, not the 30 K my earlier notes quoted |
| `INDEX.md` | the map of all 28 directories and 11 tools, with the four method notes that each cost me a wrong result |

## The queue

| branch | source? | what it is | do |
| --- | --- | --- | --- |
| `cursor/squad2-midspend-682b` | no | the freed 364 K cannot be spent in lane 2: `MID_FAR_LOD_M` 40 → 52 m moves 0.003–0.054 % of the owner's poses for +4 K triangles, reverted | merge |
| `cursor/squad2-pr193review-682b` | no | review of fable-4's #193: the instanced-attribute skip costs **0 bytes** and an identical frame; and hero A is **575 / 8.636 M** now, so the "30 K of headroom" every earlier note quotes is really ~364 K | merge |
| `cursor/squad2-ditherverdict-682b` | no | the verdict on the rung fade: one tree's swap is **0.22 %** of a frame against the **45.96 %** a single 0.1 m walking step already changes — drop it | merge |
| `cursor/squad2-dithermotion-682b` | no | the two failed attempts at that measurement and why each failed (parallax; the gate sits at distance **less half the crown radius**) | merge |
| `cursor/squad2-lodfade4-682b` | **yes, inert** | attaches `aLodDrop` in `familyMeshes` with its own no-op `onUpload`, and the D_log cost measurement (2.33 % of pixels, −0.0034 SSIM at a 2.5 m band) | see below |

## The one source branch

`lodfade4` is optional now. The head already carries the band's decision half (#181), its attribute
(#186), its mask (#191) and fable-4's sweep exemption (#193) — with `TREE_LOD_DITHER = false`, none of it
runs, and because of #193 even a flag flip on the head would no longer crash. What `lodfade4` adds is the
build-time attachment (belt and braces) and the measurement that decided the feature.

Given the verdict, either is defensible:

* **merge it** — the head then carries the tidier attachment and the evidence sits with the code;
* **close it** — nothing in the shipped build changes either way.

What should **not** happen is flipping `TREE_LOD_DITHER` to true: the fade costs a sealed frame 2.33 % of
its pixels and 0.0034 of SSIM to soften an event worth 0.22 % of one frame.

## Where lane 2 stands

No open defect, and every lever measured:

* **look** — the roof's underside lit and the five fixed frames byte-identical (#110, #113); overhead reads
  as leaves everywhere measured, local detail 4.04–6.49 (`roofsky/`, `uplooks/`); the middle distance
  populates at all four bearings, band sd 15–31 (`bearings/`); nothing arrives late on the north walk,
  0.02 % with the clock frozen (`arrival/`).
* **cost** — the six views inside W38 with A the binding one (`sweep/`); the sun's depth pass is a third of
  every frame and two thirds of THAT is the solid world, not foliage (`shadowcost/DEPTH-SPLIT.md`); the
  giants' family is 18 % wood / 53 % leaves / 29 % foldable (`giantwood/BY-TREE.md`); the play spots and the
  climbing look-backs are over the triangle ceiling and vegetation owns the overage (`playcost/`,
  `lookbacks/`).
* **spends** — all inert: far-ring density (`farring/`), its radius (`farring/RADIUS.md`), the mid rung
  (`midspend/`), giant foliage density (`sweep/`).

`INDEX.md` maps all 28 directories and 11 tools; the four method notes at its end are the ones that cost
me a wrong result each (matched shots order, `dt = 0` for geometry questions, `isolate()` has no post pass,
`?shadow=0` / `?veg=` for the passes).
