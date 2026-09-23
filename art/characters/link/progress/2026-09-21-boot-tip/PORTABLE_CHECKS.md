# Portable verification and optional regeneration

The smallest positive check needs only **`check.py`, `source-preservation.json` and the current runtime GLB**, with Python 3. No source GLB copy, native JSON, `preview.py`, Git history, Blender or third-party Python packages are required:

```powershell
python art/characters/link/progress/2026-09-21-boot-tip/check.py --candidate-only public/models/link/link-runtime.glb art/characters/link/progress/2026-09-21-boot-tip/portable-review.json
```

The candidate must have SHA256 `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850`. The 566-byte contract binds the original `89df` metadata and 47,698,784-byte BIN prefix still embedded in that GLB. The same checker then independently evaluates the shortening field, float32 positions, normal/tangent transformation, untouched rows and affected triangle orientation. Geometry is explicitly changed in three body attributes; protected rig, clip, weight, texture and original accessor data are verified as preserved. The output explicitly says native correspondence was not rerun in this mode.

The existing arm and foot-coverage checks also support the two exact reviewed assets. The arm check restores only the three declared boot accessor references before testing the original mesh-metadata hash; it does not skip that hash or describe the new geometry as unchanged. The coverage check reports the actual current asset hash and retains the full 537-vertex and constant-toe-animation assertions:

```powershell
node art/characters/link/progress/2026-09-21-run-carriage/check-rebuild.mjs
python art/characters/link/progress/2026-09-21-sole-coverage/measure.py
```

For an explicit historical arm negative control, add `--historical`; that option requires its named Git objects. The coverage comparison `--held` still requires the original `89df` control through `--current`; it rejects comparing the shortened current asset to itself as that historical pair. Unknown asset hashes are rejected by both checks.

Optional **art regeneration** has additional inputs:

- `preview.py` and the existing `../2026-09-20-run-arms/boots.py` writer.
- The original `boots-native.json` beside the output GLB; its SHA256 is `80a2a811f9a9ebd1b2d8a0a96339e0d1386135a9d81bc349a452c1c6769c4474`.
- The original `89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b` GLB, recovered explicitly from available Git history or supplied locally.

The export path is CPU-only Python and does not require the original Blend file or Blender. The preserved native record checks correspondence to the reviewed authoring result. Using a full Git checkout, recover the exact source without shell binary redirection; this command checks its hash and refuses to overwrite an existing file:

```powershell
python -c "import subprocess,pathlib,hashlib; p=pathlib.Path('art/characters/link/progress/2026-09-21-boot-tip/source-89df.glb'); b=subprocess.check_output(['git','show','ec79e4ed:public/models/link/link-runtime.glb']); assert hashlib.sha256(b).hexdigest()=='89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b'; p.open('xb').write(b)"
python art/characters/link/progress/2026-09-21-boot-tip/preview.py art/characters/link/progress/2026-09-21-boot-tip/source-89df.glb art/characters/link/progress/2026-09-21-boot-tip/regenerated.glb
python art/characters/link/progress/2026-09-21-boot-tip/check.py art/characters/link/progress/2026-09-21-boot-tip/source-89df.glb art/characters/link/progress/2026-09-21-boot-tip/regenerated.glb art/characters/link/progress/2026-09-21-boot-tip/regenerated-check.json
```

The three-path check reruns native correspondence and all original negative controls. Output GLB/report names for regeneration must be unused. The accepted current GLB must not be supplied as the regeneration source, since that would apply the shape edit twice; its hash is rejected.

The compact preservation/deformation report is [portable-check.json](portable-check.json). The native authoring proof remains [verification.json](verification.json). Neither replaces the separately recorded actual-player contact capture in [README.md](README.md). Large duplicate GLBs, Blend files and historical replay traces are unnecessary for the default positive check.
