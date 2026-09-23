# Exact joint-only export

`patch_joints.py` patches the original GLB bytes directly; it does not round-trip the mesh through an exporter. Source SHA256 is `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850`; candidate SHA256 is `1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5`. Both files contain **51,111,284 bytes**.

Only 243 active Uint8 entries change from skin joint 3 (`head`) to joint 1 (`chest`), in body mesh 2 / primitive 0 / `JOINTS_0` accessor 19 / buffer view 20. Exact row IDs are in `head-island-summary.json`; the affected BIN offsets span 4,705,440–4,754,308, but only those 243 individual bytes change. Each selected row already has one weight equal to 1 and the others 0. Zero-weight joint slots are preserved.

Reversing those entries recovers the complete original source hash. JSON, weights, all active and unused geometry arrays, sparse data, inverse-bind matrices, textures and every animation input/output therefore remain exact. The checker additionally rejects overlapping changes in every other accessor/sparse/texture buffer view. Every vertex's arm-weight sum is identical, so the existing native contact census face sets are unchanged: body primitive 0 retains 9,733 arm faces and 47,859 opposing faces; other primitives are byte-identical.

The root-run native receipt `native-joint-poses.json` has SHA256 `c37af0b488b6e0bedb6c133ef16b4fe90451e9d0178df6c857664a86c64228e9`. All 243 candidate points agree with the actual native deformation at neutral, default look ±15° and run phase 102/112 within **0.0625 µm**. The existing 113-phase run gate separately passes: total 1316→1289, peak 22→21, below-armpit 21→21. It uses the original 4dcf run; rejected rear-arm/cadence candidates are absent.

From the repository root, the portable check needs only Python's standard library, this folder's compact selector/native receipt, and the already tracked `2026-09-21-boot-tip/check.py` reader:

```text
python art/characters/link/progress/2026-09-22-head-owned-patch/patch_joints.py check PATH_TO_1873_CANDIDATE.glb
```

It verifies the current candidate without requiring an original GLB copy, Blender, a browser, Git history or an old source snapshot. `joint-verification.json` is the result. Two separate in-memory negative controls also reject reverting one selected joint and changing one unrelated POSITION byte; see `byte-verification.json`.

To reproduce the candidate when a hash-verified 4dcf source is available:

```text
python art/characters/link/progress/2026-09-22-head-owned-patch/patch_joints.py export PATH_TO_4DCF_SOURCE.glb art/characters/link/progress/2026-09-22-head-owned-patch/strap-chest-candidate.glb
```

The exporter refuses to overwrite an existing candidate and restricts its output to this evidence folder. Historical source 4dcf is the model at Git commit `5050496a38983bcc44a3db4b6a6b8c5ab7cd8aa2`; recovering it requires that history and is separate from the candidate-only check.

`save_native_joint_receipt.py` was run by the root agent in Blender after native visual acceptance. It uses a separate scene copy for the four-pose receipt, runs the same CPU check, then saves the original/trial scenes only after PASS. The checkpoint is **outside Git** at `E:/zeldaremake-native-checkpoints/2026-09-22-strap-chest.blend` (41,495,321 bytes, SHA256 `a5a830bf17f17baf467b03a0e8fcc8c9a2d6d8cf14e3de24b72789461bb831a1`). No large Blender checkpoint or duplicate source GLB is needed in a commit.

The correction preserves all animation channels and leaves outside-island native body positions exact. It does not claim to resolve the remaining shoulder/clothing contact or stair-posture limitations.
