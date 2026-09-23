# Current flat-run arm and leg review

The measured upper arms already swing substantially behind the torso. **This review finds no residual arm-modifier or outward-knee defect that justifies a corrective production edit.** More rearward carriage remains an art-direction choice requiring a matched native preview; wrist position alone cannot establish it. Preserve the accepted repair of the four run rotation curves.

Inputs: production `link-runtime.glb` SHA256 `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850`; `glbLink.ts` SHA256 `aa8130e51472d69d25de7ea4dc33a5d60f4e4ae8e57355d8970c82c170982649`. These are frozen inputs for this review, not a claim about later source changes. [Measured results](current-run.json).

Angles below use the shoulder-to-elbow vector relative to the downward **hips-to-neck** sagittal axis. Negative is rearward; positive is forward. Native samples cover 113 phases, including both loop endpoints. Play uses 600 measured frames at 60 Hz and 4.6 m/s after 120 warm-up frames.

| Measurement | Native clip L / R | Actual flat-run play L / R |
| --- | --- | --- |
| Upper-arm range relative to torso | −23.54…+11.19° / −24.23…+11.21° | −25.50…+13.11° / −26.05…+13.06° |
| Upper-arm mean relative to torso | −8.17° / −9.79° | −8.03° / −9.94° |
| Upper arm behind torso axis | 67.3% / 69.9% | 65.8% / 69.3% |
| Elbow depth relative to parallel torso line through shoulder | −60.3…+28.5 / −61.9…+28.5 mm | −65.0…+33.4 / −66.5…+33.3 mm |
| Elbow flexion, 0° = straight | 72.2…87.1° / 71.7…87.4° | 71.9…88.0° / 71.3…88.3° |
| Wrist depth ahead of ipsilateral shoulder | +8.2…120.7 / +5.0…117.8 mm | +1.1…124.5 / −1.9…121.4 mm |
| Wrist depth ahead of torso line at wrist height | +25.6…131.5 / +23.5…127.6 mm | +18.7…134.8 / +16.6…130.8 mm |

The forward wrists coexist with rearward upper arms because the elbows are bent. The forearms point 49.4–111.3° forward from the downward torso axis in play. Using the more local **chest-to-neck** axis instead still gives −23.37…+15.36° left and −23.79…+15.20° right upper-arm travel. Thus the result is not an artifact of choosing the hips as the torso reference. These are joint-center measurements, not the rendered skin surface or hand silhouette. The existing repaired native side render at phase 0.25 was inspected and supports this distinction.

The actual runtime modifier, `ARM_SCALE.run = 1.15` and `ARM_TAU.run = 0.02`, scales rotations around each clip's mean quaternion and smooths them with the step's elapsed time. Same-clock mixer readback shows that it adds about 2° to both forward and rearward upper-arm extrema. A read-only, in-memory gain-1 counterfactual with the same filter reduces peak forward wrist depth by only 5.4/5.6 mm while moving the rear-phase wrists roughly 9–10 mm farther forward and reducing upper-arm backswing by 2.24/2.05°. **Do not adopt that counterfactual to satisfy a request for more rearward upper-arm motion.** Its evidence is retained rather than presented as a proposed fix.

The current legs repeat the earlier [flat-run shape diagnosis](../2026-09-21-run-shape/README.md): each ankle is approximately 3 mm outside its hip, knee lateral deviation from its hip–ankle line is at most 0.435 mm, and outward-knee swivel and hip clamp are exactly zero in this flat scenario. Hips-to-neck lean is 4.93–5.57°. A further whole-leg inward move is unsupported. The boot-tip delivery changes static geometry; its acceptance does not imply a new skeletal narrowing is needed. The held torso experiments changed shoulder yaw but preserved leg paths and therefore do not establish a repair for leg splay.

The existing `2026-09-21-run-carriage/compare.mjs` joint snapshot was reused verbatim in a CPU browser run, with no renderer. Its SHA256 is recorded in the JSON. A passive hook captured the four pre-overlay mixer quaternions; private filter state was left intact. Upper-arm torso angle is the snapshot's sagittal arm pitch plus its torso lean. Elbow depth is `elbow.z - shoulder.z - (elbow.y - shoulder.y) * torsoSlope`. The follow-up torso-angle sampling reproduces the previous native and same-clock play extrema/means within 1e-10. Protected body/head/leg matrices and root traces are exact across the mixer/current/unit-gain comparison, zero-dt wrist drift is below 2.3e-16 m, and input hashes stayed unchanged. Source, asset and Blender data were not edited; no dependency was introduced.

The small [portable check](check.mjs) packages that same sampler. Run `node art/characters/link/progress/2026-09-22-run-review/check.mjs` from the repository root after `npm ci`, with Chrome/Chromium discoverable by the shared browser helper (or `CHROME_PATH`). It uses only the current production asset and tracked helper, verifies the pinned asset hash, freezes the current runtime source and reproduces the recorded native/current/same-clock mixer metrics within 1e-9. The helper gate uses `reuseHelperNormalizedLfSha256`, normalizing CRLF to LF; `reuseHelperSha256` retains the historical raw-byte receipt unchanged. All 19 recursively resolved local import dependencies, the reused snapshot helper, current asset, Vite configuration and package lock are tracked. The prior comparison script is read only for its snapshot function; its historical model fixtures are never loaded.

The check tests zero-dt stability and exact protected matrices, prints a compact result and writes no files. A later runtime edit is permitted only if those flat-run measurements still match; its distinct source hash is printed explicitly. The historical gain-1 counterfactual stays in the report and is not rerun. No ignored model copy or 600-frame dump is required.

This bounded review does not assess turning, gait transitions, stair posture, full skin collisions or an aesthetically optimal run. It does not invalidate the user's visual preference; it identifies why changing the existing runtime gain or narrowing the legs would not address that preference reliably.
