# Middle-forest surface readability trial

The actual A/D forest and receding path lose material separation behind the clear foreground.
Owner boards 01/05/08 retain more distinct middle layers. This trial changes one existing
parameter in `src/world/atmosphere/heightfog.ts`: `farShadeStart: 22` to `32` metres.
The 44 m endpoint, .3 minimum and every other light, fog, post, material and geometry input stay.

This delays an existing additional surface-darkening factor before atmospheric airlight is
mixed in. The original compensation deliberately kept distant surfaces from becoming pale
ghosts in the footage comparison; its code is coherent. This is an art-direction hypothesis,
not a diagnosed physical-lighting defect. No missing detail can be recovered if the underlying
material or geometry never contained it.

The source coefficient changes only at Euclidean camera distances strictly between 22 and
44 m. Near surfaces and the distant endpoint retain their original coefficients. This is not
a promise of byte-identical foreground pixels after neighbourhood postprocessing. No new
texture, shader operation, geometry or draw is introduced.

## Existing evidence and limits

Read-only diagnosis used the exact actual source `8714d2af9556105fe867f9e36a1a44c4a99629f0`.
All 18 relevant atmosphere/lighting/post/config files still matched that source at 0d4 and
9ef. Its original A/D/F sparse depth is historical evidence: the later house can alter
occlusion, and no old depth array is presented as a new integrated capture.

| Historical actual region | Probes at 22–44 m / total | Ordinary surface coefficient, median old → trial |
| --- | ---: | ---: |
| A left middle forest | 116 / 240 | .2276 → .3452 |
| D path before arch | 84 / 96 | .5637 → .6411 |
| D left middle trunks | 122 / 180 | .4161 → .6278 |
| F right middle trunks | 57 / 93 | .6388 → .7112 |

These coefficients include the existing fog weighting and are measured before postprocessing.
They are not predicted displayed-pixel gains. Captures lack original pre-fog HDR/material IDs;
the existing bright-emissive exemption can reduce the difference. Broad image rectangles and
80×45 depth are not full-resolution semantic masks. Most of the actual far arch lies beyond
44 m, but the whole arch rectangle is not claimed invariant.

The main risk is a paler middle band competing with the foreground. Maximum fade slope rises
from .04773/m to .0875/m, so stationary views alone cannot settle its appearance during camera
travel. The leaf trial's short 1.608 m sweep cannot cover this: its main targets stay around
25–27 m, below the new ramp. A separate longer path must inspect stable visible surfaces through
the affected range. Explicit camera samples still do not establish continuous interactive timing.

## Source and decision

Frozen source SHA256: `23d22b9e36eca1c149286a5e3f10320a538a28abafca72b6b2ba07cc5db607cc`.
Candidate SHA256: `c856c68c57ba215a3564e8fba40ca8b77edab12bdeb5befded3cc915fe382506`.
Patch SHA256: `0ee6c33cfa2008c269bbd5d64b43bfb2f5d821d200d9352f03e0e3ab4e040220`.
Root applied the one-line trial separately after publishing 9ef; typecheck/build 111 passes.
It is now restored to exact 22 m source for the first matched long-path control capture.
The 32 m patch remains frozen and will be a separate commit after that control starts.
Fable was notified in PR2 comment 5648375134. No sleeve or house-source correction is bundled.

Actual acceptance is pending. Keep only if matched A/D images show worthwhile middle-layer
readability without pale ghosts, weaker forest silhouettes or a conspicuous moving band.
Check F background competition and the house views as well. Revert the scalar if the original
compensation gives the more coherent scene; do not compensate a weak result with exposure,
fill, fog colour or extra geometry. This is not a W32/phase-exit approval.

The proposed control path has eleven 1.6 m steps north from [0.2, 1.45, 10] to [0.2, 1.45, -6],
fixed D target [4.5, 2.75, -42] and FOV 48. Historical actual path/trunk anchors cross from
45–46 m to 29–30 m, covering the complete new ramp. Source terrain clearance passes; actual
full-scene visibility is still required. Matching 22/32 source runs must use exactly the same
poses and geometry. These are coarse distance samples, not a real-time walk or frame-rate test.

The first source checkpoint adds tooling only, retaining byte-exact9ef production. The closed
`--middepth` mode uses its own output directory/artifact/schema and zero return-pose pairs.
Source shade audit, PNG/source/dist/state integrity and normal capture guards remain intact.
Hedge and middepth triggers are independent; corrected hedge data also starts its rerender.
Frozen seven-file patch SHA256: `b1b310550ab47e73c8d53b461f88cea12c0ffb4b4f28432fdfe0936e72e9f348`.
Portable22/32 plans, malformed-contract rejection, mixed-mode immutable archive/idempotence and
actual workflow-detector checks pass in the scratch proof. No synthetic image is game evidence.
