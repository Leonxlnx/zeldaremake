# P3 fixed joint numerical family and scope

P3 is a bounded ordinary-running trajectory prototype from the frozen accepted frame 59 state. It is not installed in the physical controller or playable source. P1 and P2 source/results are preserved separately.

## Input, clock and body API

`forecast-review/forecast.mjs` exports `createFrozenForecast({horizon:.35})`. Its exact locomotion tick/update code is extracted from the unchanged source into a wrapper that clones plain physical state and private fixed-step clock fields. Input is explicitly held forward/run/no-jump on the known flat fixture. It consumes only saved frames 58–59 as input; the saved future is used separately to verify frame 60. It never calls a live controller, mutates input or uses RNG.

`bodyAt(relativeTime, 'left'|'right')` returns the authoritative predicted root/body endpoint chord, root velocity, rootYdot, yaw rate, and both hip bases/derivatives with shared world H/Hdot removed. Add H to hip Y and Hdot to hip velocity Y. At body knots the two one-sided derivatives are distinct. The forecast is unavailable for unsupported intent/private-clock/upper-transition/yaw domains. It predicts 42 chords over at most 350 ms, conditionally on unchanged known intent and surface.

P3 keeps the existing body chords. World H/Hdot and world sole position/velocity are continuous at curve boundaries. Configuration rates are reconstructed for the applicable one-sided body derivative; intrinsic joint derivative jumps remain possible at those body knots. No globally C1 joint/body claim is made and no physical endpoint or interpolation is silently changed.

## Fixed events and targets

- Left liftoff: 0 ms, from the exact accepted left world sole state.
- Right liftoff: 41.666666667 ms, derived by the support-domain rule below.
- Left touchdown: 118.144550367 ms, at the original unprojected frame 60 target Z 2.0344512628342493 m.
- Second left liftoff: 150 ms, derived by the same support-domain rule.
- Right touchdown: 268.144550367 ms, at the explicitly proposed successor target Z 2.7003986689305437 m.
- Evaluation ends: 288.144550367 ms, after 20 ms outgoing right stance.

The first left duration is the original immutable displacement's rest-cubic planar time 1.5*distance/8 plus one physical tick, a declared timing preference rather than a minimum feasibility theorem. Successor targets advance by half of the existing current authored stride; successor touchdown preferences advance by 150 ms. The left second swing has a fixed target Z 3.366346075026838 m and touchdown at 418.144550367 ms, beyond this admission horizon. No claim is made about reaching that later touchdown. The first left and right swing trajectories and their support transfer are fully inside the evaluated horizon.

These are numerical proposed events. No real contact generation, timestamp, physics grounded state or jump count is committed by the prototype.

## Support departure and shared height

The original height reference is retained: world H starts .4542655985876104 m with Hdot −1.2965370273231347 m/s and follows one cubic to the authored nominal .43543960383273583 m, derivative zero, at 50.3775 ms. It is constant afterwards. It is a planning reference, not a solved-pose clamp.

For each proposed stance, visit its existing body/event pieces once. Construct its exact fixed-anchor support flex at each endpoint from reference H/Hdot and actual one-sided hip motion. Admit the scalar flex cubic's full range/rate and corresponding unchanged length reserve. The first refused piece nominates the last fully admitted existing body boundary as departure. P1's right support curve crosses the rate limit at 46.312499 ms, so this rule releases at 41.666667 ms. The later left support first crosses at 156.543786 ms, so departure is 150 ms. The opposite touchdown times are not shortened. This discrete event family is conservative; it does not establish the latest feasible release over arbitrary curves.

P2 showed that departure admission alone is insufficient: the just-released right foot still fell outside the .453 m reserve as its acceleration ramp caught up with the root. P3 therefore adds a single shared height bridge to each both-swing interval. The bridge is referenceH − A*bump(t), with zero bump and derivative at release/contact, and a unit rest-to-rest cubic peak. The peak time is the lowest sampled paired reach ceiling on a single <=4 ms scan of that interval, a declared preference rather than an optimized temporal minimum.

Each amplitude A lies in the declared planning family [0,.08] m. At fixed forecast/sample times, both feet contribute their exact reference world position/velocity. With dY=d0−A*w, dYdot=v0−A*wDot, L²=horizontal²+dY², and N=horizontalDot+dY*dYdot, the knee rate constraint is

`K² * (a²*b² − ((L²−a²−b²)/2)²) − N² >= 0`.

This quartic is equivalent to the knee-rate bound while the separate positive triangle/leg-length domain is satisfied. Reach, positive upper branch, shared height and local pelvis-rate inequalities are included separately. Intersect the numerical amplitude intervals over both feet and all declared sample times, including both derivatives at body knots. Root isolation uses derivative recursion with at most 48 bisections per crossing; Bernstein whole-interval tests avoid unnecessary isolation. Select the midpoint of the feasible interval nearest zero and re-evaluate every original polynomial at that amplitude. Degenerate/isolated feasible points without a positive-width numerical interval are not accepted. This is floating-point polynomial admission at fixed times, not a rigorous temporal interval proof.

The resulting amplitudes are .020070871908762663 m and .023993093980430372 m. Their sampled feasible intervals were [.0015988762014770364,.03854286761604829] and [.0007283678140890966,.04725782014677165] m. The selected bridge preserves the actual release/contact H/Hdot and leaves supported portions unchanged.

## Stored configuration construction

Free world reference feet retain the existing 15% planar acceleration/deceleration ramp, the exact incoming world velocity, and zero world contact velocity. One 45 mm vertical waypoint at 45% of each swing uses two cubic segments; orientation/rates stay at the original zero pitch/yaw. No apex search occurs.

Partition once at physical body knots, proposed events, ramp boundaries, vertical apexes, height-settle time and bridge peaks. There are 48 pieces. Each boundary reconstructs exact direction/flex and their rates from reference world foot states, shared height and actual body derivative, without distance projection. Use the existing normalized direction Hermite and scalar flex Hermite, preserving the direction primitive's hemisphere certificate. When a support foot exists, its stored flex curve and immutable ankle derive shared H/Hdot through the positive square-root branch; its actual direction/rate follows the fixed anchor. When both feet swing, the shared height bridge drives both configurations. Evaluate the same stored coefficients throughout, including sub-tick events.

At contact the configuration derivative reconstruction enforces world sole velocity zero, including root/hip/yaw motion and the rotated ankle-to-sole offset. It does not merely zero local joint tangents. The numerical result's maximum endpoint world velocity error is 1.102e−15 m/s.

## Hard budget and observed accounting

The evaluated family permits at most 64 stored pieces, 768 paired samples, 256 endpoint leg inversions, and 1536 support-sample leg inversions. Support-domain scans are bounded by the 42 forecast chords and proposed event caps. Each of two amplitude projections permits at most 96 fixed-time states and 250,000 polynomial evaluations; there are no alternative whole trajectories or full-stage/BVH searches. Each isolated root crossing gets at most 48 bisections. Body/forecast work, rejected support-domain pieces, root isolation and rejected prior families are reported separately.

P3 used 11 support-domain pieces/22 endpoint inversions; 104 bridge sample states/1248 constraints/1521 polynomial evaluations/240 root bisections; 48 final pieces/192 endpoint leg inversions/416 support-sample leg inversions/1280 configuration calls/447 scalar critical evaluations/640 paired samples. The original result's `knotConfigurations=608` combined both inversion categories; the verified result uses precise labels. `projectionIterations=0` means no repeated trajectory fitting; it does not omit the separately reported root bisections.

## Guarantee and remaining limits

Every stored scalar flex cubic is checked over the entire piece using its analytic extrema in floating point, including explicit flex range [0,pi], knee rate and anatomical length bounds. Pitch/yaw and angular rates are identically zero. Derived world speed, height/rate, radicand, configuration normalization and sole-floor checks use endpoints and a <=0.5 ms grid. The 640 records include 593 distinct times and duplicated one-sided boundaries. The reference-amplitude domain alone does not certify the rebuilt configuration curve; the latter is independently checked by this final gate.

A separate single reconstruction of all 640 samples applied existing pair IK, the ordinary straight-heading knee-pole rule and actual geometry synchronization to unchanged Link meshes. All 4,135,680 referenced indexed vertices of the six named boot/calf detail meshes on both feet stayed above the flat floor. This is finite flat-floor coverage, not pairwise BVH clearance, continuous triangle motion, general terrain, jump/recovery/restart integration or rendered visual quality.

No performance acceptance is claimed. The first run measured support-domain 2.68 ms, bridge projection 14.84 ms, and full stored-path construction/checks 22.46 ms, plus 64.57 ms cold forecast initialization. Verification measured 2.45/24.20/37.29 ms plus 82.62 ms cold forecast. These are one-off diagnostic runs with transpilation/allocation overhead; event cost is not yet practical or characterized for the game loop.
