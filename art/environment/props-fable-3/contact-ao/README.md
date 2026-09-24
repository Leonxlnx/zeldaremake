# Contact AO under the props (owner rubric #23) — fable-3, 2026-09-24

`abc8a490` + `1549688c` on `agent/fable-3-south-props`. Every ground-seated prop — pot, crate, barrel, bucket, marker
post — gets a soft dark decal at its foot: an 18-triangle fan on the sampled ground, `AO_LIFT` (1.2 cm) above it with a
polygon offset, radius `AO_REACH` (1.45) × the footprint radius (a marker's is its post's, not its boards'; a ladder's
two feet get none). One unlit transparent mesh per locality (`<locality>-ao`, `MeshBasicMaterial`, dark warm colour,
opacity 0.62 × a radial alpha map: full under the foot, fading over the outer 40 %), no shadow cast or received,
`depthWrite` off. Cost: +1 draw per visible locality (A 638 → 639, B 627 → 628, F 598 → 599), 29 × 18 triangles.

The first profile ((1 − r)^1.6, reach 1.3) spent its darkness under the prop where nothing sees it — 454 px at the bridge
head; the shipped one puts it in the ring past the footprint's edge (704 px there, 2.5 k at the stair pots).

- `before-after-stair-pots.jpg` — the stair-foot pots from the stairs' side at 2 m: the dirt round the large pot's foot
  darkens into a contact shadow.
- `before-after-bridge-crate.jpg` — the toll crate at the bridge head at 5 m: the grass at its front edge takes the shade.

Where ferns or a pad cover the feet (Saria's door pots) nothing shows — as it should.

Tests (`geometry.test.mjs`): one `-ao` mesh per locality, unlit and shadowless, every vertex exactly `AO_LIFT` above its
own ground (the south's on the live view), one decal per seated prop (29), the system ≤ 21 meshes.

Six views: the three that hold props, before (`c35559ab`) → after, both rendered at high. Between two *builds* the
captures' animation clock lands a frame apart (the standing girl's idle phase and the grass sway move — within one build
A equals its determinism frame to 0 px), so the changed-px counts overstate the decals; the gated measure is the SSIM
against the reference.

| view | SSIM vs the reference, before → after | Δ | SSIM before↔after (clock a frame apart) | draws / tris after |
| --- | --- | --- | --- | --- |
| A | 0.2011 → 0.2014 | +0.0003 | 0.9879 | 639 / 8.87 M |
| B (= E's frame) | 0.1861 → 0.1862 | +0.0000 | 0.9964 | 628 / 8.29 M |
| F | 0.2100 → 0.2105 | +0.0005 | 0.9872 | 599 / 8.01 M |

C and D hold no village prop; C's own south props are 12–30 m off, their decals a few pixels.
