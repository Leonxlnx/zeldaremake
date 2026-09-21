# Knee reach and timber winding diagnosis

This is a CPU-only study of e3ef74a0 on the exact preserved X/Z trace and clip phases. `analyze.mjs` first verifies all 940 pose/contact metrics (excluding instrumentation counters/timing) equal the reviewed support+guard fixture. The diagnostic only adds callbacks. `analysis.json` retains internal root supports, envelope components, pre/post-hip targets and all seven oriented footprint points. No production source is written by these scripts.

The initial footprint rays exposed an independent winding bug: 20,160 tube-side triangles opposed their authored outward normals. All 1,120 caps were correct. With default FrontSide material, rays could read the stone 81–99 mm below the true crown. Root reversed the side indices. `log-winding-check.mjs --before` fails, the current version passes. The outward-log rerun explicitly supersedes the earlier timber clearance pass: 139 ascent frames penetrate (worst129 −36.001 mm),119 descent (worst522 −16.019 mm). Those negatives are kept, not clipped from the evidence.

The knee mechanism is the short hip-to-ankle target before the hip correction, not a knee-angle limit. At ascent331 the chain is only53.36 mm long; at descent375 it is68.42 mm. The thigh and shin sum to411.29 mm. A main riser is270 mm,65.65% of that chain, with a timber crown roughly60 mm proud. The old source comment describing a0.50 m leg is not the measured rig length.

| Quantity | Ascent331 | Descent375 |
|---|---:|---:|
| Knee flexion |174.67°|166.82°|
| Swing phase |.54926432945|.44323767641|
| Uphill ankle offset from hip before hip turn |32.51 mm|50.53 mm|
| Root support |2.970 m (tread11)|2.160 m (tread8)|
| Eased takeoff/landing support |3.168115 m|2.356917 m|
| SINK / CLEAR / LIP envelope |3.185537 /3.302877 /3.305984 m|2.243877 /2.465608 /2.485868 m|
| Requested support, highest component |3.305984 m LIP|2.485868 m LIP|
| True outer footprint clearance before hip turn |11.96 mm|34.60 mm|
| Authored pelvis lift already present |39.62 mm|37.53 mm|
| Maximum extra root rise with current fixed stance foot |59.85 mm|27.04 mm|
| Root rise needed for135° with current fixed swing target |118.51 mm|109.95 mm|

Both feet's `gRoot` are held to the lower foot by the existing min-of-double-support rule. Finishing `ROOT_RISE_END` earlier cannot overcome that minimum. The native upright candidate adds `0.04*sin(tau*phase)^2` to hips and re-solves both legs to preserve authored ankle paths; it is already near its maximum here. A larger global lift would overextend the stance leg. At maximal stance extension plus exhausting current sampler clearance, the two swing knees still need approximately149° flexion. Those are geometric bounds, not safe animated settings.

The upper tread really lies under part of the foot: ascent331's toe corner hits crown3.307537 m, consistent with sampler3.307830 m. The apparent80 mm grid excess in FrontSide-only evidence was the winding bug. LIP only exceeds CLEAR by3.11 mm uphill and20.26 mm downhill. Reducing LIP alone cannot remove the folds. The hip limit preserves chain length; at ascent331 it turns the ankle upward57.56 mm while retaining the174.67° knee, so a thigh-angle picture can conceal the short reach.

The current .8066667 m cycle stride gives .403333 m half-steps on .54 m treads. Four half-steps span1.613333 m, almost exactly three treads1.62 m. Ascent extremes recur331→419→507,88 frames/two cycles, with only6.67 mm drift relative to that three-tread pattern. Phase brackets preserve the root trace but intentionally alter only clipShift by±.1 s:

| Phase offset | Peak knees up/down | Negative frames up/down | Worst clearance up/down |
|---|---:|---:|---:|
|0|174.67° /166.82°|139 /119|−36.00 /−16.02 mm|
|−.1 s|172.41° /170.74°|72 /132|−33.74 /−26.32 mm|
|+.1 s|162.21° /161.91°|97 /48|−37.96 /−20.57 mm|

A phase change moves the alignment problem; the tested brackets do not solve it. A global1.08 m stride would require a different native stance path and would affect other stair flights, so it is not proposed.

`reach-feasibility.mjs` is a static counterfactual, not an animation pass. Moving the swing ankle120 mm uphill at these two points, then adding only5.17/16.18 mm needed to retain10 mm footprint clearance with the existing half-cell guard, produces137.24°/132.07° knees without further root lift. This displacement is within remaining takeoff/landing travel at both poses. It motivates an isolated animated test: use existing swing phase, fade the uphill redistribution to zero before heel strike, retain the stance anchors, and re-check the final oriented footprint. The test must also pass contacts, reach, foot speed, root continuity and zero-dt behavior; no knee-angle clamp is proposed.

Two bounded animated candidates were tested and **both are rejected for production**. `swing-placement-proposal.mjs` is a Vite-memory transform only. Its shared experimental control adds the final seven-point oriented floor before reach solving; this still misses curved support between the sampled points. The posture experiment adds at most 120 mm uphill travel, bounded by existing takeoff/landing travel and zero before heel strike. It changes no animation phase or world trace.

| Variant | Peak knees up/down | Negative frames up/down | Worst gap up/down | Peak sole speed up/down |
|---|---:|---:|---:|---:|
| Outward-timber baseline |174.67° /166.82°|139 /119|−36.00 /−16.02 mm|12.31 /8.86 m/s|
| Oriented seven-point floor only |174.67° /166.82°|116 /46|−9.66 /−2.03 mm|14.08 /8.86 m/s|
| Floor plus midpoint pulse |162.72° /165.56°|116 /46|−9.66 /−2.03 mm|14.08 /11.70 m/s|
| Floor plus smoother sin² bump |162.75° /155.57°|116 /47|−9.66 /−3.51 mm|14.29 /10.24 m/s|

The midpoint pulse uses smoothstep opening .25→.4 and closing .65→.85. It preserves every root position, stance-foot position, first-plant endpoint, stance timing, phase and flat lower-body hash against the floor-only control. All 14 repeated dt=0 poses have exactly unchanged root, soles, pins and phase. It introduces no worse negative frame than that incomplete control, but descent 162→163 loses 175 mm of support height in one frame as the offset fades and the rear crown clears. The changed target makes the descent speed worse. The floor itself also raises the pre-existing ascent 517→518 snap from 205 mm to 234 mm. Passing static contact or endpoint checks is insufficient for animation acceptance.

The second bump uses `sin²(π*phase/.85)` until .85, then zero, giving zero derivatives at both ends. It retains stance/endpoints/root to floating-point precision and passes the same 14 zero-dt checks. Its descent knee peak improves to155.57°, but descent522 changes from +2.30 mm to −3.51 mm clearance against the floor-only control, and both peak speeds remain worse. `compare-proposals.mjs --candidate=floor-and-sine-bias` intentionally fails that contact assertion after preserving its full report.

`proposal-comparison.json` and `floor-and-sine-bias-comparison.json` retain every metric and source hash. There are no meaningful reach clamps in any of these runs; tiny positive `reachExcessM` values ≤2.8e−16 m are floating-point residuals, and the comparison threshold is1e−6 m. The next required change is the shared curved-footprint support planning, followed by a new continuous swing-placement test using those corrected supports. Do not adopt either pulse merely because it makes two selected poses look better.
