# Right shoulder strap — 100 joint entries

Ordinary head turns pulled a small brown right shoulder strap away from its chest boundary. Native inspection identifies a separate **100 rigid-head rows / 34 distinct points** island, bounded by 37 rigid chest points and two shoulderR points. Assigning that island to the chest restores a connected strip in the matched +15° gaze images. The accepted left 243-row correction is preserved.

The source is `1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5`, committed at `83ebbc63af853abd14ba4e79feb26e3d6b8af4fd`. The exported candidate is **`6ea975df1d3b70be38fc5154ad11f905ff5846b9e154e9178d369447653fa60c`**, 51,111,284 bytes. Exactly 100 active `JOINTS_0` Uint8 values change from head index 3 to chest index 1. Weights, rest geometry, normals, tangents, UVs, textures, nodes, rig and every animation byte remain exact. Reversing only those 100 bytes recovers the complete source hash, including the left fix. The native shape and original contact gate are accepted; production adoption is managed by the root agent.

At +15° gaze, the 66 chest boundary edges' maximum rest-length error improves **35.021 mm → 0.000059 mm**. The three shoulderR edges improve **18.091 mm → 1.338 mm**. Neutral shoulder error increases slightly, **0.961 mm → 1.338 mm**; this seam is not claimed to be perfect. All outside-island native positions are unchanged. The original 113-phase contact gate has identical totals: **1,289 contacts, peak 21, 21 below the armpit**, before and after. Contact face memberships also remain exact. [Native summary](native-summary.json) records the numerical results and raw evidence hashes.

The separate +10° posture study's new green head/hat contacts belong to another component. This strap repair does not resolve or accept that held study.

The exported GLB matches all **100 selected points at four native poses** within **0.058 µm**: neutral, normal ±15° gaze and run phase 102/112. [Verification](joint-verification.json) pins the complete saved native receipt. The source/candidate Blender scenes were saved outside Git; [checkpoint receipt](native-checkpoint.json) records their path, size and hash.

## Portable byte and saved-native check

The default runtime asset is now the combined **7f** file. Its read-only positive check is:

```sh
python art/characters/link/progress/2026-09-22-right-strap/patch_joints.py check-combined public/models/link/link-runtime.glb
```

[COMPOSITION.md](COMPOSITION.md) records that combination, the exact 100-entry reverse-hash proof, and the native contact result. The independent posture evidence remains in the [143 intermediate delivery](../2026-09-22-body-posture/DELIVERY.md). This command does not rewrite either study's reports.

`patch_joints.py` is a small wrapper around the published left correction's checker. It changes only the selected-row count, source/target hashes and evidence directory in memory. The published checker is unmodified; its complete reverse-hash, aliasing, arm-census and four-pose native checks still run. The [selector](head-island-summary.json) is self-contained. No historical GLB, Blender process or large forensic audit is required to check a candidate against the saved native receipt.

To check the standalone **6ea right-only intermediate**, use its actual file path, from the repository root:

```sh
python art/characters/link/progress/2026-09-22-right-strap/patch_joints.py check PATH-TO-6EA.glb
```

The local 6ea file is this folder's `strap-chest-candidate.glb`. `check` requires `native-joint-poses.json`; it does not silently skip native correspondence or accept the different combined asset. `export SOURCE_1873.glb OUTPUT.glb` reconstructs the intermediate from the pinned source, writes only inside this evidence folder, and refuses to overwrite a file. The source can be recovered explicitly from commit `83ebbc63`; no historical lookup happens during either positive check.

[Byte verification](byte-verification.json) also records negative controls: omitting one right correction, changing one accepted left entry, or altering a protected position byte must each fail. The right island does not overlap the left selector.

## Local native authoring evidence

The native copy is `Link | September22 right strap chest preview`, based on `Link | September22 corrected strap full-body control`. `prepare.py` / `native.py` and the full component audit are local forensic helpers. Their read-only selection and preview stages preceded the GLB export; they are not a fresh-clone Blender setup recipe.

The root-run `save_native_joint_receipt.py` reuses the existing four-pose receipt helper with explicit right-scene parameters. It checks neutral, both ordinary gaze poses, and run phase 102/112, then saves the relevant source/candidate scenes outside Git only after exact preservation and native correspondence pass. The published compact receipt allows the CPU check to be repeated without committing a duplicate GLB or `.blend` file.
