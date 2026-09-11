# Authored ordinary knee-rate comparison

The authored knee curve provides a cadence-dependent speed reference. Its literal reference-capture clock is slower than live distance-driven cadence, so a fixed 13.15 rad/s reference-run cap would reject motion merely for using the existing live stride. Conversely, the observed startup rates exceed even a weighted, cadence-adjusted reference envelope.

Read-only scope: exact derivatives of frozen `animation.ts`, inspection of `locomotion.ts`, `play-pose.ts`, and reference-mode dispatch in `index.ts`, plus only the three already-saved running peak pairs. No source edits or replay. Exact input hashes and numeric results are in `result.json`.

For left knee, `f=.03+K*g(phi)`, where `g=max(0,cos(phi))*(1−sin(phi))/2`; right is phase-shifted by pi. On the active half-cycle, `g'=sin²(phi)−sin(phi)/2−1/2`, whose range is `[−9/16,1]`. Thus the exact maximum absolute one-sided knee rate at a fixed cadence is `K*2*pi*cycleHz`. The largest value of `g` is `3*sqrt(3)/8=0.649519053`. The clipped-cosine entry is not C1: its derivative jumps from zero to the positive maximum. This formula supplies a speed scale, not permission to preserve its velocity discontinuity.

| Gait | K | Literal reference Hz | Reference max, rad/s | Existing live speed/stride Hz | Retimed max, rad/s |
|---|---:|---:|---:|---:|---:|
| Walk | 1.10 | 0.90 | 6.220353454 | 1.6/0.9 = 1.777777778 | 12.287117934 |
| Run | 1.55 | 1.35 | 13.147565255 | 3.9/1.35 = 2.888888889 | 28.134707542 |

Reference knee flex ranges are `.03..0.744470958` rad walking and `.03..1.036754532` rad running. `HERO_PHASE` and viewpoint gait options change the sampled phase, not the maximum over a cycle. Reference mode calls `applyPose` then translates the rig with `plantFeet`; play mode uses the contact/IK route. Grounded play has no explicit authored knee blend: its lower limbs are solved from contacts. A weighted reference equation is therefore a declared design benchmark derived from the original coefficients, not an already-existing exact play formula.

For that benchmark, use `r=runWeight`, `w=moveWeight`, `K=1.1+.45*r`, `A=K*w`, and actual live `phi'=2*pi*speed/(.9+.45*r)` on flat ground. All weights remain in `[0,1]`; the source advances phase by actual traveled distance, blends `r` toward `clamp((speed−1.6)/2.3,0,1)` with exponential rate 10/s, and blends `w` toward `clamp(speed/.45,0,1)` with rate 14/s. The run weight can lag speed, so substituting `speed=1.6+2.3*r` during startup is incorrect.

For a continuously timed weighted curve, `A'=.45*w*r'+K*w'`. The triangle bound

`|f'| <= |b'| + A*|phi'| + (3*sqrt(3)/8)*|A'|`

covers the complete changing-amplitude reference. If only the swing amplitude is scaled and baseline stays `.03`, `b'=0`. If the entire idle `.05` and moving `.03` baseline are blended, `b=.05−.02*w` and add `.02*|w'|`. A derivative convention must be explicit: the source supplies discrete exponential updates, not exported analytic per-segment weight derivatives. A continuous exponential segment with held tick targets matches those endpoints exactly and supplies these derivatives. Merely dividing endpoint weight differences by dt yields averages, not within-tick maxima.

The three independently reconstructed left-knee rates below are **accepted-pose secants** from saved hip/knee world quaternions. A continuous interpolating trajectory has an instantaneous absolute peak at least as large as its secant. For comparison, the final column bounds the whole tick using the continuous exponential weight convention, maximum amplitude, minimum stride, maximum absolute component derivatives, and the extra idle-baseline term; it is conservative, not a finely tuned phase-specific cap.

| Running frame | Accepted flex change, rad | Absolute secant, rad/s | Conservative weighted reference envelope, rad/s |
|---|---:|---:|---:|
| 14 | .261012817 → .479937891 | 26.271008920 | 22.294333534 |
| 15 | .479937891 → .780995343 | 36.126894224 | 23.036217765 |
| 16 | .780995343 → 1.081791174 | 36.095499738 | 23.703208354 |

Use this declared dynamic authored envelope as an admission/diagnostic metric for ordinary movement, with actual `abs(flexVelocity)` and a separate position/velocity continuity check at every accepted/contact boundary. Do not clamp the knee afterward. Plan shared height, contacts, and release timing so the actual trajectory fits. A speed envelope alone does not constrain acceleration or guarantee visual smoothness, and the original clipped-cosine curve is not a C1 standard. Keep the separately declared jump-transition contract separate; these ordinary gait derivatives do not justify changing its bound.

For the proposed single-height-target solver, the generic exact fixed-sample rate inequality is quartic. If `dy=A+B*q` and `dy'=C+D*q`, then `d·d'=horizontalDot+dy*dy'` is quadratic in target `q`, and

`4*(d·d')² <= L² * [4*a²*b² − (d²−a²−b²)²]`.

The right-hand side is also quartic. Special zero-rate cases can reduce degree, but there is no general affine interval simplification. Bounded derivative-root isolation and sign partition are appropriate, with explicit uncertainty at unresolved numerical roots and direct validation of any chosen target.
