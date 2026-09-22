# Run posture: original head local motion

Intermediate `143160f1c413694865a9b3273dbbf16bc22a89a1fdc62d2b35381c980ae47e69` passes native review and the independent CPU comparison. It is **51,113,876 bytes**, 2,592 bytes above source `1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5`. Root subsequently accepted the [matched native game replay](../2026-09-22-run-posture-game/README.md) and integrated this posture with the right strap as **7f406e40**. The checks below intentionally retain the isolated 143 input. Use the [combined checker](../2026-09-22-right-strap/COMPOSITION.md) for the default runtime asset.

Only **run / chest / rotation** changes. The chest gains 10° forward lean about the current shoulder-to-shoulder lateral axis, about its own origin, preserving the source phase/timing. Native axes are X lateral, Z up, −Y forward; glTF axes are X lateral, Y up, +Z forward. Head/cap, arms and pack follow the chest together; original head, neck and arm local channels remain untouched. The source already contains the accepted 243-row left strap correction. The separate right 100-row proposal is absent. This explicit art choice retains the [pinned CC0 animation lineage](../../../../../reference/animations/quaternius-standard/SOURCE.json).

[local-head-posture-study.json](local-head-posture-study.json) records the native source/protected-motion invariants. Its creation-time PENDING status is historical. Root accepted the matched phase 0.65 threequarter view. The [unchanged 113-phase native contact census](../2026-09-21-motion-integration/local-head-posture-native-contacts.json) reports **1289→1269 total**, **21→21 below-armpit**, and a higher per-frame peak **21→24**. Existing intersections remain; this is not a contact-free claim.

The 48,340-byte [native carrier](local-head-posture-native.glb), SHA256 `24264576c028399026fe26140ffa9f731b322873cf45ae1b9a588d79b0a4991e`, was exported by root with fresh 240Hz arrays using the existing September19 helper. Its [native receipt](local-head-posture-native-receipt.json) proves original scene action/study/source preservation. The [append-only export receipt](local-head-posture-export.json) records the candidate. The carrier and study suffice to reproduce exact delivery bytes without a local Blend or optional held GLB; native scene reconstruction is a separate root-owned workflow.

## CPU evidence

[check.mjs](check.mjs) / [runtime-check.json](runtime-check.json) reuse the tracked run-carriage sampler and production loader/puppet: **113 native samples; 600 flat 60Hz running frames after 120 warm-up frames; 300 real gait-chain transition frames; 61 fixed-target gaze frames**. Transitions use production clip alignment, idle anchors, acceleration/deceleration and blink events; nine frames exercise an interrupted three-clip blend. This is a direct puppet/gait-chain comparison, not the complete input-controller or stair harness.

- All 50,984,104 original BIN bytes, 695 accessors, geometry/weights/morphs/textures, rest rig, other clips and unselected local channels are exact. New 113 chest times/quaternions match the native carrier exactly; loop components close exactly.
- Hips/legs world matrices, root/foot/IK traces, gait schedules, stride and cadence are identical in all modes; no reach clamps occur. Flat marker minimum is −0.00273mm in both assets. The stress-transition schedule has an inherited −7.776mm marker minimum in both; these equal traces do not prove all geometry clears the ground.
- At steady 60Hz run, chest/head peak steps remain 0.1206°/0.3248°. Through the existing 0.18s gait fade, peaks increase from 0.866→2.250° chest and 0.457→1.835° head per frame as the new posture enters/leaves.
- Chest lean becomes 16.99–17.90°. Upper-arm range, elbow flex and wrist depth relative to the chest stay unchanged. World-forward wrist range moves from +1…125mm to −35…102mm left, and −2…121mm to −38…99mm right: common posture carriage, with the accepted arm cycle preserved.
- At fixed world target `(4,1.2,70)`, gaze reduces the base/candidate head-orientation difference from about 10.001° to at most 3.126°. Head +Z target-error mean is 3.914→3.867°, maximum 4.032→4.092°. Without gaze, candidate mean is 23.608°; overlay improves every tested frame. This measures the bone-forward proxy, not pupils, all targets or gaze/garment collision.
- 131 zero-dt checks per asset preserve head/chest components and lower matrices exactly; maximum hand shift is 7.12e−15m.

Runtime raw SHA256 is `7d4b3e4bbe73d92dd3c4d3ccc67e83fecee3d1c366354d51a657004fb9c739b0`; CRLF→LF SHA256 is `1937ca61468f1b135bfe2ecb429e966f509bf08ff6a0e12f549c2224547be96d`. Sources were unchanged during sampling. A later default-asset hash update alone does not change this explicitly loaded pair. The helper guard uses its normalized LF hash for clone portability.

## Reproduce from a clone

From repository root, recover the pinned 1873 Git blob without shell binary redirection; the destination must not exist:

```text
python -c "import pathlib,subprocess,hashlib; p=pathlib.Path('base1873.glb'); assert not p.exists(); b=subprocess.check_output(['git','show','83ebbc63af853abd14ba4e79feb26e3d6b8af4fd:public/models/link/link-runtime.glb']); assert hashlib.sha256(b).hexdigest()=='1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5'; p.write_bytes(b)"
```

The existing exporter overwrites its candidate/report. Preserve those files first or use a fresh output directory containing copies of only `local-head-posture-study.json` and `local-head-posture-native.glb`:

```text
python art/characters/link/progress/2026-09-19-run-contact/export_candidate.py base1873.glb local-head-posture FRESH-OUTPUT-DIRECTORY
node art/characters/link/progress/2026-09-22-body-posture/check.mjs base1873.glb FRESH-OUTPUT-DIRECTORY/local-head-posture-candidate.glb NEW-REPORT.json
```

Both asset hashes and the carrier hash are mandatory; reports refuse overwrite. The check requires project dependencies (`npm ci`), Node and Chrome/Chromium (`CHROME_PATH` if needed). Its tracked dependencies are `gauntlet/scripts/lib/browser.mjs`, `2026-09-21-run-carriage/compare.mjs`, and production character modules. It forces `ZR_NATIVE_GPU=0` and creates no renderer. No additional framework, motion binary download or Blender execution is required for this check.
