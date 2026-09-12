# Actual LOD observation protocol

The existing CI workflow now captures a bounded bank-hedge sweep when its committed
`plantgeo.ts` differs from the first parent. Unrelated pushes keep the normal 12+4 workload.
An optional manual input can request the same sweep. There is no schedule or new game API.

The source-derived camera travels 1.608 m west/east and returns, producing eleven original
full-scene PNGs at t=12.5 s, 1280×720/high quality, HUD off, two zero-dt settle frames and no
light/post overrides. Both actual authored bank roots cross the 26 m high/mid threshold, with
10 cm brackets. A constant elevated eye clears sampled terrain; the scene stays fully visible.

This uses ordinary `setPose`, whose existing camera-move callback forces vegetation rebucketing.
It observes actual geometry changes at explicit poses, not normal interactive 0.6 m update-gate
timing. Expected per-instance LOD labels come from the source selector; the API only exposes
aggregate runtime audits. Eleven discrete stills are not continuous gameplay or an FPS test.

Trees or foreground objects may block either target. Source terrain clearance is not full-world
visibility proof. Review original PNGs, target projections and sparse depth first; a hidden
transition is inconclusive. Compare both directions. Five repeated poses record image/depth/audit
equality honestly without silently changing a failed result into a seamless-motion claim.

Every attempted PNG remains unmodified, including any bounded same-state blank-buffer retries.
The runner records source/tree/input and built-dist hashes before/after, cameras, time, actual
light/composer settings, audits/stats, depth, errors and restored controls in `sweep.json`.
Failed or partial attempts remain CI artifacts. A dedicated validator checks complete source,
dist, plan, camera, state, dimensions and original bytes before a successful bundle can publish.

The publisher appends `motion/<UTC>-<source7>/` to `captures/astra-environment`, preserving
all previous progress/detail/motion folders. Identical replay is idempotent; differing bytes in
an existing dated folder are rejected. Normal comparison publication preserves the motion index
link. The actual published archive SHA and folder must be verified before supplying a link.

The six-file tooling patch was reviewed and applied exactly:
`4104ff1088550e93a6d493d57c0bc834cbf3f5cf7aa2717898d7742f8b23f791`.
The capture runner SHA256 is `05eb70008fec4775ac9fbddb740c6697f84d403713ac411270c88ad8de71073e`.
Narrow local synthetic tests reject wrong source/dist/time/camera/controls/completeness,
accepted state, depth and PNG hashes/dimensions. Temporary archive tests verify history,
idempotence, conflicting-folder rejection and motion-link survival. The actual Bash detector
passes changed geometry, unrelated commit and manual-request cases. These are tooling tests;
no synthetic test image is game evidence. The first real CI sweep remains pending.

The leaf trial keeps every global light/fog setting fixed. This short path is also unsuitable
for approving a later 32–44 m fog-fade change: its main targets stay roughly 25–27 m away.
