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

Control source `e2ee5f076774ab36d1e751b1f1753781795a417d` is published with exact9ef
production; environment run34717456744 is running. The separate frozen32 m scalar is now
applied for the candidate checkpoint. All camera/data/geometry bytes stay exact control;
only the source shade audit should differ. No result or retention is claimed before images.

## Completed22 m control

Source e2ee5f0 completed all38 original captures in successful environment run34717456744.
All16 normal JPEG/depth bytes and normalized actor/audit/resource/camera/control records match9ef
exactly. Its corrected hedge11 and middepth11 dedicated PNG/source/plan/state contracts also
pass. There are zero retries, errors or warnings across the entire control. Final original
archive: `479f16b12d3f05cdd8b7dacdf8312a5661b2a8b3`; middle-path folder:
`motion/2026-09-12_205849465-e2ee5f0`.

Root inspected original M01/M05/M09/M11; the capture reviewer inspected all11. The path and
middle trunks are framed usefully, with the ordinary branch/character/occluders retained. This
is not an all33-probe visibility claim. Upper-trunk M01 is branch-blocked; M02 has a coarse-depth
branch-edge ambiguity; M03–M11 support the estimated target within about.32 m. Low-trunk M01/M02
and M06/M07 hit background in the coarse sampler, so exact surface identity is unproven there;
M03–M05/M08–M11 agree within about.29 m. The open path's sparse-depth offsets vary with its
shallow angle, from1.61 m initially to nearly zero around M09. No blocked or ambiguous probe
counts as successful tracking. Discrete1.6 m steps still do not measure continuous playback.

The unchanged22 m approach submits450–675 calls and8,241,471–8,766,247 triangles. The separately
pinned32 candidate is `e8ccfe6779a8b89bb8fbb1362b58c247598a4b57`, now actually rendering in
environment run34717576609. Its geometry and poses remain exact control. New bank-grass work
is local and unpublished; it cannot affect either remote light comparison. Actual32 retention
remains pending.

## Actual 32 m decision: retain

Source `e8ccfe6779a8b89bb8fbb1362b58c247598a4b57` completed all 27 original captures in
successful environment run 34717576609. The 16 fixed views and 11 middle-path PNGs match the
22 m control in every original depth array, camera, actor, resource and submitted-cost record.
Complete normalized audits differ only in the explicitly intended farShadeStartM 22 → 32.
All source/PNG/plan/state/history/ZIP contracts pass, with zero retries/errors/warnings.
The 207-input source hash is `883c19b908501531012bc8241c00a780f59b9e9e7068a651225fe391782f4758`.

Root compared actual A/D/F pairs, viewed B/C, compared M05/M09 pairs and inspected M01/M11.
The independent capture reviewer personally compared all eleven path pairs, A/C/D/F and the
four details. The later onset gives a modest but useful improvement in middle paving and
trunk separation. Neither review finds an obvious pale middle band, washed-out trunk strip
or new step in the sampled approach. The dark distant arch and established warm near lights
remain; F's change is restrained. Retain 32 m. This is a bounded visual gain, not a wholesale
lighting solution or a reference-quality/phase-exit claim.

All 33 probe camera projections and sparse depth samples match the control exactly. The known
M01 obstruction and other edge/background ambiguities remain excluded from confirmed surface
measurements. The path's display-luma delta rises smoothly from 0 to 11.42 and then 6.49 on an
8-bit scale; the confirmed upper-trunk series reaches 4.86 and then 3.00. These are local
display-pixel measurements, not HDR values or material-masked contrast. Eleven fixed steps
do not establish continuous playback or frame rate. No additional render is required for
this decision.

Original archive `9dcc1cffde8b0256699598e46aab9f630658b799` contains the unchanged historical
folders and the new `motion/2026-09-12_212006394-e8ccfe6` originals. Normal world/detail folders
are `progress/2026-09-12_210826998-e8ccfe6` and `details/2026-09-12_211121078-e8ccfe6`.
The separately prepared grass trial begins after this retained light checkpoint, preserving
the exact 32 m shader source and avoiding an ambiguous combined light/geometry comparison.
