# Raised heel omitted from the final hip-turn guard

The six `110c168f` descent failures share a geometric omission: the back of the upper heel extends behind the lowest 12 mm sole outline. All 33 negative vertex samples are in this region. The sole rectangle stays clear while the final hip correction moves the raised heel into the adjacent timber shoulder.

The shared production source now contains this guard-only correction; assets and animations are unchanged, and the cadence candidate remains rejected. [guard-check.json](guard-check.json) is the compact static evidence. The retained local `heel-guard.patch` and `diagnosis.json` preserve the isolated proposal and detailed six-case reconstruction; neither is needed to run the portable regression.

The independent [default-asset comparison](player-comparison.json) passes all 1,320 actual-player frames: every originally stored pose and contact field matches the saved baseline exactly, with zero negative full-foot samples or reach clamps. Minimum full-foot gaps remain +1.186769 mm uphill and +1.264448 mm downhill. It checks537 low-sole and4,701 fully foot-owned vertices per frame, including endpoint terrain. This establishes preservation on that fixed route, including51 fully blended walk frames. It does not improve the existing folded stair posture or accept the held cadence animation. The separate [600-frame flat-run check](../2026-09-22-run-review/README.md) also passes on the integrated source, with exact protected matrices and unchanged measured arm/leg motion.

The actual-player proof freezes the earlier hardscape source in memory to match the saved baseline; only this guard changes. Raw frame reports remain local, with hashes retained in the comparison. The new diagnostic field is excluded when comparing original frame fields. Candidate surface-call means are3,799/3,643 per frame up/down; the final guard accounts for399/349, with maxima5,670/5,724. The baseline lacked equivalent counters, so this is not a measured cost ratio or FPS result. Root confirms that current source equals the tested candidate after LF normalization; typecheck/build pass (`index-TfzRiT4I.js`).

## Exact selection and shape

Keep the current ankle-family sole measurement and its four bounds unchanged. In that same load-time mesh scan, also collect vertices whose summed weight on **this ankle itself** is at least `1 - 1e-6`. After measuring the existing low sole, retain only those rigid points whose rest-forward coordinate is behind its heel: `p.z - markerWorld.z < -fp.heel`. Convert them to ankle-local space with their actual three-dimensional coordinates.

The current asset yields **29 left and 38 right points**. Every selected point is actually 100% ankle-owned; no animated toe-family assumption is needed. The rule scans all skinned primitives and uses neither failure indices nor a new height threshold. The low sole counts remain 269/268. The patch keeps all six original `fpLocal` values exactly, including the first three points that define the oriented plane.

Worst vertex R48696 is at rest `[-0.070949659, 0.074309535, -0.077806361]` m and ankle-local `[0.006050353, -0.043825229, 0.073530922]` m. It lies **8.266 mm behind the rest sole heel and 67.341 mm above the boot bottom**. At frame393 its world-XZ projection lies16.582 mm beyond the oriented sole plane, while the real vertex is68.813 mm above that plane. Raising a fictitious flat sole at this position would require84.973 mm; the actual vertex penetration is16.161 mm. Flattening this contour would therefore be the wrong proxy.

## Small shared correction

Add a separate `hipContactLocal` array containing the unchanged six sole-plane points, the measured rigid heel points, and finally the existing sole marker. Only the final hip-turn guard reads it. The marker stays last, preserving `clearsHipFootprint`'s plane-origin indexing. The two plane basis vectors still come from unchanged `fpLocal[0..2]`.

Grow the existing shared scratch array once at asset load to fit the largest contact list. This asset needs36/45 contacts, so the buffer grows from28 to180 doubles: **224→1,440 bytes**, with no per-frame allocation. The guard still preserves initial clearance using its existing nine-tap surface query and existing bisection; it now rejects a turn that pushes the raised heel through timber.

`footConfig`, stance placement, sole bounds, dense pre-IK support, hold, the target before this correction, foot orientation, root logic, clip data and reported sole contacts are unchanged. The patch does not force a new vertical lift. It also does not repair an upper-shoe collision already present before the guard.

## Static negative control and cost

The helper extracts the actual `measureFootprint`, support functions and hip-guard initialization from raw production and the isolated candidate. It runs the six observed failed ankle endpoints against the same outward stair/timber geometry hashes.

| Cases | Raw production | Guard proposal |
| --- | --- | --- |
| Six clear initial endpoints | Accepts all6 | Accepts all6 |
| Six observed penetrating endpoints | **Incorrectly accepts all6** | **Rejects all6** |
| Sole bounds and six plane points | Baseline | Exactly equal |

The initializer uses exact pre-guard targets/quaternions recorded by the separate OSS pelvis trial. Its phase, position, yaw and pins are bit-identical to the original candidate at these frames; the pre-raise hip differs by at most floating-point residue (<1e-12 m). The original candidate did not record its own pre-guard target, so this is an explicitly defined static predicate fixture, not an observation of its unavailable internal stage. The trial initializer's real heel points have254.683–289.937 mm clearance. Reconstructed original worst points agree with their saved skinned positions within1.116 µm. All33 recorded negatives are recovered; the111 vertices with tiny non-foot influences are excluded from rigid reconstruction, and none of the33 recovered failures belongs to that excluded set.

Each fully accepted guard query and each initialization adds **261 surface calls for L /342 for R**. The measured calls are495→756 L and468→810 R. All six bad endpoints reject after63 calls. A conservative bound for initialization, one attempted turn and eight complete bisection queries is2,610/3,420 added calls per corrected leg. These are operation counts, not an end-to-end frame benchmark. The existing grid alone leaves0.543 mm of the worst static contour penetration unresolved, while its nine-tap envelope is conservative. Retaining that existing uncertainty policy may restrict some otherwise clear turns; it is not a precision mesh collider.

The positive six-case check passes; `--before` deliberately exits1 because the frozen pre-patch source permits all six collisions. `git apply --check` passed before integration. A full TypeScript project check with only the candidate file substituted in compiler memory passed with zero diagnostics, recorded in the retained local `typecheck.json` and compact evidence.

The static source receipts are **LF-normalized UTF-8** hashes: production `c16bbcc64f9622c5cb62b26d09806c6d954ab3ac08d2a421d6f6d04ba2be53d2`, isolated proposal `9eacc0538670e1fa75e13d08e0c0793ba5a7e38c1869b1621e428edfcca4e052`. The historical player report separately records the **raw file-byte** source hash `aa8130e51472d69d25de7ea4dc33a5d60f4e4ae8e57355d8970c82c170982649`. These receipts are labeled separately in `guard-check.json`; do not compare a raw-byte hash directly with a normalized hash.

## Portable regression

The existing [complete-foot/check.mjs](../2026-09-21-complete-foot/check.mjs) now includes one synthetic raised heel. It measures the real three-dimensional contour, excludes toe-owned and mixed-weight heel points, and executes the source's actual guard initializer, buffer growth and `clearsHipFootprint`. A final endpoint with18 mm of raised-heel penetration is admitted by the old sole-only contact set and rejected by the contour. The initially clear pose, flat ground and a lower step that passes under the real raised heel remain valid. The original sole bounds and low-vertex count remain exact.

This check needs only tracked source plus the project's existing TypeScript/Three.js dependencies. It now passes against the integrated raw source. Run from the repository root:

```powershell
node art/characters/link/progress/2026-09-21-complete-foot/check.mjs
```

It also passes the isolated source proposal and fails the untouched pre-patch source. A separate local negative control retains the new measurement but restores the old guard initializer; it fails at the endpoint-rejection assertion. There is no automatic source patching or historical asset dependency in this regression.

The six real-pose study uses retained local player reports and is therefore not a fresh-clone reproduction. Its frozen numerical results are in `guard-check.json`. With those exact inputs and pre-patch source present, run `python art/characters/link/progress/2026-09-22-foot-contour/prepare.py`, then `node art/characters/link/progress/2026-09-22-foot-contour/diagnose.mjs`. Add `--before` for the expected negative-control failure. These static artifacts do not establish full-player or motion-quality acceptance. They cover the measured heel vertices at saved poses; this is neither a swept collision test nor a continuous shoe-triangle guarantee.
