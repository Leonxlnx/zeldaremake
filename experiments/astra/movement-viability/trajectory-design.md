# Ordinary support trajectory viability

One scratch correction from frozen paired-support-events. Assets, rig, physics, camera and world stay byte-identical. The previous full result and source remain frozen. Root authorized this trajectory-level correction after the exact walk27/run30 reach-boundary proof.

## State and curve contract

The shared pelvis uses one Hermite trajectory from the previously accepted height and derivative. Its future endpoint is a planning parameter; it is not a per-sample height correction. Both the planner and final actual-IK substeps evaluate that same curve. All existing foot curves preserve their incoming planar/scalar velocities, exact within-tick contact and full remainder hold.

At bounded samples of the existing two foot curves, derive each hip-to-ankle vertical interval from actual rotated sole offsets, hip orientations and physical root movement. The allowed common Hermite target is the intersection of those affine height constraints. Add a one-physics-tick closing-time estimate using each exact boundary tangent: H+dt*Hdot must remain below ceiling+dt*ceilingDot, with the analogous lower boundary. When distance reserve is zero this enforces the actual derivative viability condition. This is an estimate over newly changing input, not a proof for arbitrary future controls.

Compute boundary rates from actual physical root velocity, hip translation/angular motion and foot position/angular motion. At departure the stored sole velocity and the orientation curve's derivative are zero. No height or velocity is overwritten after the curve is chosen.

Ordinary knee-rate assessment will use the intended authored animation as evidence before selecting an envelope. Any accepted envelope must constrain shared trajectory feasibility, not clamp individual knees. Fixed existing jump, foot and pelvis limits remain intact. If compatible curve/phase timing cannot be found, preserve the first refusal and diagnose it rather than suppressing a guard.

## Validation scope

First reproduce the frozen early ordinary boundary times with complete graph/coordinator/geometry rollback. Then complete the original standing/walking/running basic prefixes, including takeoff and contact recovery. No432-frame turn/reversal expansion until these pass. True calf-rigid detail vertices require a separate ground-envelope gate before movement acceptance; the existing lace216/217 witness must remain a regression. No boot-asset patch or arbitrary ankle-angle clamp.

## Chosen ordinary knee benchmark

The reference function has maximum phase derivative K, with K1.1 for walk and1.55 for run. At live speed/stride this is12.287118rad/s walking and28.134708rad/s running, before blend changes. The implementation bounds the full current tick using maximum amplitude A=(1.1+.45*r)*w, maximum live phase frequency, and the derivative of both amplitude and the idle/move baseline: A*omega +(3*sqrt(3)/8)*abs(Adot) +.02*abs(wdot). This is a reference-derived benchmark for live IK, not an existing exact live IK formula or a promise that the reference curve itself is C1.

The residual authored idle hips X translation induces some knee motion with fixed feet, including when w=0. Its contribution is bounded from actual X velocity by reach*abs(vx)/(a*b*min(sin(minFlex),sin(maxFlex))). This avoids a made-up idle-rate floor. The existing10.75rad/s jump transition limit remains the cap in its existing transition window.

For one sampled pair geometry, dy and dyDot are affine in the shared target. The squared knee-rate inequality is a quartic in that target. A pure helper keeps unions of feasible target intervals, isolating simple roots in a bounded domain and returning explicit uncertainty for unresolved roots. It also independently checks the selected target against direct geometry/rates and the exact consumed scalar height/speed extrema. No independently clamped knee or pelvis output is created.

## Analytic transform contract

Body and foot orientation samples use the quaternion exponential associated with their stored angular displacement. This makes position samples and analytic velocity calculations describe the same curve, including zero orientation velocity at a smooth lift/arrival. Pure checks on60 saved pose-pair samples found maximum relative geometry velocity finite-difference error2.313e−10. Compared with Three's interpolation branch, intermediate body quaternion components differ by at most4.777e−10, with retained endpoints. The original mixed interpolation/derivative comparison is preserved in body-curve-initial-comparison.json; this is numerical path consistency, not a renderer claim.
