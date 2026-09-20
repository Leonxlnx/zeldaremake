# Moss tangent-axis defect

At the fixed stair-walk23 camera, source6a694b66 produces five nonfinite RGB pixels in the native HDR target. Bloom spreads them into the visible dark rectangle. Four CPU rays hit constant-V cap triangles of giant-near-canopy-far-plateau-limb-24; the fifth hits an adjacent side and CPU geometry omits shader wind. Three's derivative tangent frame has a zero bitangent for constant-V UVs. The moss-normal block normalized that axis through inverseTransformDirection before sampling moss.

The paired guard render uses the same immutable build, camera, time, viewport and GPU, replacing only that conditional in onBeforeCompile. It requires both tangent axes to have squared length above1e-8 before procedural moss perturbation. It retains the existing normal, moss color and roughness elsewhere. Raw HDR nonfinite pixel count falls5→0; maximum finite RGB stays0.75830078125. This establishes a source-operation fix, not a final-color clamp.

| Before | Runtime guard |
|---|---|
| ![NaN bloom square](before-beauty.png) | ![Guarded moss frame](guard-beauty.png) |

Reports preserve raw pixel coordinates, values, CPU intersections, camera and scene statistics. Upstream97c83227 reproductions are in ../black-patch-upstream. Source89dc6005 implements the guard. The combined6f850599 source also contains a separately reviewed candidate leaf warmth; production native survey and camera walk pending.

CPU isolated-change proof: node art/environment/astra-distance/moss-normal-domain-check.mjs 6a694b66 89dc6005. It verifies15 degenerate frames skip normalization and384 ordinary cases retain their axes. Baseline/candidate refs are explicit because later legitimate leaf-color changes also alter treeFragment.

Native readback reproducer: node art/environment/astra-quality/black-patch-probe.mjs on an appropriate built source; PROBE_MOSS_GUARD=1 applies the runtime comparison only to a pre-fix build. Always acquire the shared capslot first.
