# Ordinary lift-off reach diagnosis

Both saved failures have a leg exactly at the 453 mm reach boundary before release. The implemented linear pelvis path exceeds reach after release. Sampling the already-prescribed height Hermite corrects part of that error, but **does not make either complete trajectory feasible**: each retained initial height velocity already points out of the moving reach boundary. A finite change to the Hermite target cannot repair that immediate C1 obstruction.

Scope: read-only arithmetic on walking frame 27 and running frame 30 from the frozen result. No controller replay, source change, additional trajectory sweep, parameter variant, or geometry collision claim. `diagnose.mjs` reproduces `result.json` directly from saved requests and the source equations.

## Exact saved geometry

Dimensions are thigh 230 mm, calf 225 mm, reach reserve 2 mm, hip half-width 68 mm, and ankle-to-sole offset `(0, −65, 25)` mm. Rotated hip offsets and foot quaternions are included. Reconstructed prior hips exactly match saved frames; the largest ankle reconstruction error is 1.25e−16 m.

| State | Walking left | Walking right | Running left | Running right |
|---|---:|---:|---:|---:|
| Prior hip-to-ankle distance, mm | 453.000000000 | 425.485304019 | 394.247039769 | 453.000000000 |
| Rejected distance, mm | 453.107947605 | 423.897481387 | 392.497350165 | 453.091521297 |
| Rejected shared-height ceiling per leg, mm | 447.364612594 | 479.498164744 | 497.205909612 | 433.045013386 |

The walking rejected fraction is 1/7 of the 8.333333 ms tick, or 1.190476 ms. Its height is 447.492563082 mm, exceeding the left ceiling by 127.950488 µm. The running fraction is 1/16, or 0.520833 ms. Its height is 433.157410637 mm, exceeding the right ceiling by 112.397251 µm. All five attempts in each saved failure carry the identical rejected request. Opposing-volume clearance is reported clear at these requests; it does not address leg reach.

At the walking sample the released left sole has risen only 15.812055 µm and advanced 64.998089 µm while the root advances 1.788933 mm. At the running sample the released right sole has risen 32.462258 µm and advanced 72.644972 µm while the root advances 1.939744 mm. The other foot remains planted in each case.

## Linear height versus the prescribed polynomial

`ordinaryAt` starts from `interpolateRequest`, which linearly interpolates pelvis height. It then replaces the feet with their nonlinear planar/vertical/orientation paths. Separately, `heightNext` was computed from a persistent 120 ms height Hermite. Its derivatives therefore do not describe the implemented within-tick height line.

The saved fraction permits exact algebraic recovery of the final root/hips endpoint and the unique height-Hermite target. The recovered final root matches the saved failed physical state within 3.34e−16 m. A full final sole request is **not saved**, so final per-leg distances are not fabricated. Source `finish` checks final IK/clearance before the interior path; reaching these trajectory failures establishes that its proposed endpoint passed those checks.

| Quantity | Walking | Running |
|---|---:|---:|
| Prior H, mm | 448.436351269 | 434.321920550 |
| Recovered final H, mm | 441.829833960 | 415.689761940 |
| Recovered 120 ms target H, mm | 446.744324368 | 439.214897412 |
| Implemented tick height slope, m/s | −0.792782077 | −2.235859033 |
| Retained initial H velocity, m/s | −0.912287604 | −2.591376984 |
| True Hermite H at rejected time, mm | 447.371240173 | 432.984211268 |
| True Hermite H minus shared ceiling, µm | +6.627579149 | −60.802118803 |
| True Hermite released-leg distance, mm | 453.005591214 | 452.950494799 |

Walking still fails at its saved time under the prescribed polynomial. Running would pass that particular time, but it first leaves reach immediately after release, as the exact tangent below shows. This is not a whole-curve pass. The previous implemented height lines also differ from the stored rates: their incoming slopes are −0.520892750 m/s walking and −1.380372986 m/s running. Consistent curve evaluation and derivative carry are both part of the required contract.

## Initial reach tangent

Let `o_i(t)` be the exact rotated hip offset and let `r_i(t)` be horizontal hip minus ankle displacement. With upper anatomical branch and fixed reach `R`, the exact local shared-height ceiling for leg `i` is

`C_i = ankleY − rootY − o_iY + sqrt(R² − |r_i|²)`.

Its derivative is

`C_i' = ankleY' − rootY' − o_iY' − (r_i · r_i') / sqrt(R² − |r_i|²)`.

Here both soles start planted with zero linear velocity. The new-release smoothstep foot orientation also starts with zero angular velocity, so ankle velocity is zero at `t=0+`. Hip angular velocity is recovered from the exact quaternion slerp; `o_i' = omega × o_i`. Root velocity is the actual new-state segment slope, 1.502703900 m/s walking and 3.724308111 m/s running, rather than the previous physical velocity.

| Boundary leg | Walking left | Running right |
|---|---:|---:|
| Maximum admissible initial H velocity, m/s | −0.948455568 | −2.631102734 |
| Stored H velocity minus that limit, m/s | +0.036167964 | +0.039725750 |
| Initial radial expansion using stored H velocity, m/s | +0.030600688 | +0.032462114 |
| Initial radial expansion using implemented linear H, m/s | +0.131710922 | +0.322975547 |

At both boundaries `H(0)=C(0)` to floating precision and `H'(0)−C'(0)>0`. Therefore the true retained-rate curve obeys

`H(t)−C(t) = (H'(0)−C'(0)) t + O(t²) > 0`

for sufficiently small positive time. Equivalently, hip-to-ankle distance expands by `0.030600688 t + O(t²)` m walking and `0.032462114 t + O(t²)` m running. The zero-velocity foot lift/planar acceleration and any finite Hermite-target adjustment affect second-order terms; they cannot cancel the positive first-order departure. The source's 1 nm comparison guard is numerical tolerance, not a trajectory reserve or a remedy.

## Smallest coherent trajectory contract

Use one actual shared height polynomial and its derivative consistently for staging, path checks, and the accepted state. Couple its admission to the exact moving feet/root/hips path: at bounded path fractions, each instantaneous shared interval produces an affine constraint on the same Hermite endpoint target. Keep both endpoint and existing nonlinear IK/geometry gates; sampled interval intersection alone is not proof between samples.

Admission must also retain a feasible outgoing state at the preceding planted/release boundary. At zero reach margin, require the ceiling tangent inequality before accepting that boundary. Both frozen starts already violate it, so repairing them requires planning the preceding support height/velocity or release timing with enough reach reserve for the ordinary foot acceleration. Changing only this tick's height target or evaluation cannot preserve C1 and fix the initial failure. Do not increase the reach guard, clamp height per sample, reset the stored derivative, teleport the foot, or alter physics. This is a structural support-reserve requirement for the prescribed trajectory, not a claim that ordinary walking/running is physically impossible.

## Pinned inputs

- `transition-gate-result.json`: `accac9aa6d6e5eaa38a0f69b189f8ab3cf610b08f1bfbe3d968e87e8fa3338ff`
- `candidate-hashes.json`: `ebe856c10f7b15a5494603d4018f0e2c5f9601dd4cb18ad4397b1bcf6ff6e126`
- `contact-coordinator.ts`: `f9ae233ff48813377e6d6381d1bc152bf6162a3475991d190215ca79f70cbee2`
- `contact-height.ts`: `3e4f95fcc06268509f718fbc5c485ade0b944b4b08ac084a914328637cfb0d17`
- `contact-pose.ts`: `e9d631e3d3123e462ca6f9cf59eaa0360f58a161a350f3886deea0a1aa070329`
- `contact-swing-height.ts`: `c0e29d03e12ad69d167b8a1838fa93f874b063da267f2f82a2f319918d1a19d9`
- `contact-duration.ts`: `512bd16a68c004300c9d6995d9a425a5f6f71fd8630762d9a8599ccdeebae91b`
