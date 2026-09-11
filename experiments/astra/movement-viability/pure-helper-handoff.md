# Shared ordinary height helper handoff

Only `source/src/world/character/ordinary-support-height.ts` was created for this implementation. Coordinator, authored pose, assets, physics, and frozen prior candidates were not edited. Parent owns the caller and movement gates. No movement replay was performed here.

`fitOrdinarySupportHeight(input)` fits one endpoint target for the retained `(height, velocity)` state and zero target velocity over the supplied horizon. Every supplied moving leg sample gives exact affine height/reach/speed and tangent-reserve constraints, plus a degree-at-most-four knee-rate inequality. The bounded target domain is partitioned into a union of admissible intervals. The nearest target to the preference is selected from that numerical sampled domain; the consumed height polynomial is then checked for exact scalar height and velocity extrema by the existing height helper. A failure of that last certificate returns `uncertain`, since other sampled-feasible targets may still work.

The implementation retains the original state exactly at time zero. `sample(time)` returns its common height/velocity curve within `[0,dt]`, or null outside that domain. Callers must provide samples at both zero and dt. `clear` includes the target, interval union, sampler, and diagnostics; `infeasible` or `uncertain` includes the reason and diagnostic location. This certifies supplied samples and consumed scalar extrema only. The one-tick tangent reserve is a linear estimate, and nonlinear motion/geometry checks remain required.

Important edge cases:

- Zero target coefficients at time zero are fixed pass/fail conditions; they are never divided by zero.
- Upper anatomical branch is explicit. Reach distances must stay strictly inside the physical straight/folded singularities. Zero upper radicand or ambiguous lower-branch tangent returns uncertainty.
- Knee-rate constraints preserve separated feasible intervals. Zero requested rate solves the unsquared quadratic equality `d·dDot=0`, retaining singleton solutions.
- Generic root isolation scales the bounded variable and recursively partitions at derivative roots. Near-multiple roots return uncertainty. Positive-rate boundary roots are directly checked and retained even if no adjacent open interval is feasible.
- Direct geometry/rate evaluation checks the selected target against the unexpanded equations. Machine roundoff guards are used; authored or physical rate limits are not increased.
- Numerical roots may leave a separately certified singleton a few ulps from an admitted interval. That union remains explicit; no gap is filled just to simplify the output. The independent boundary-root fixture recovers its sole mathematical solution within `4.17e−17` target-height units.

Validation: all 15 pure fixtures pass, and the complete candidate TypeScript check passes. Fixtures cover stationary height, an exact standing zero-rate singleton, two separated rate bands, two isolated zero-rate roots, the independent reviewer's positive-rate boundary singleton, preserved incoming-rate rejection, physical singularity rejection, all three lower-tangent equality directions, exact horizon endpoint, a scalar speed peak between supplied samples, and the frozen walking-27/running-30 release-tangent failures. Every input remains byte-equivalent after the call. An independent dimensional-time cubic and direct geometric derivative agree with a central finite difference within the error recorded in `result.json`.

The independent read-only reviewer identified the boundary singleton omission before freeze. It was fixed and its counterexample added to the gate. No unresolved source correctness finding remained in that bounded review. No visual or whole-movement acceptance follows from these pure tests.

Frozen SHA-256:

- `ordinary-support-height.ts`: `c1c5105f357ff7141c545ca4aada56465c1442edba420fb00918a1d395139b5b`
- `pure.mjs`: `11b58312151e15d17eac2df3fcfe37583a22ec28eef97f2a98fd601cb5ed6fb2`
- `result.json`: `2257e8c5e0cec7ec585e7ee72c308ca311a858ad9e66c3ed73e27a52155c7c25`
