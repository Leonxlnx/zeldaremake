# Export verification — accepted shorter tips

The native toe edit exports correctly and is now accepted as an incremental art improvement. The reviewed side and three-quarter renders show a modest reduction in protruding boot length without an obvious ankle pinch. The corrected 537-vertex support replay passes, followed by 708,840 successful actual-player sole queries over 1,320 frames, with zero negative gaps, reach clamps or page errors. The actual route clears by at least +1.187 mm uphill / +1.264 mm downhill. This does not finish the remaining extreme stair poses; see [the corrected contact evidence](FAMILY_CONTACT.md).

The initial hold remains valid historical evidence for the incomplete ankle-only support: the same asset then changed root height by −272.740 mm and increased the uphill knee peak to 170.941°. Its 327-point check omitted 210 low toe vertices. That failure and decision remain in [contact-comparison.json](contact-comparison.json); they were superseded only after correcting the support measurement and rerunning both CPU and actual-player checks. Earlier JSON status fields retain their decision at the time.

Accepted runtime SHA256: `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850`. Size: 51,111,284 bytes, including 3,286,068 bytes of appended geometry. Its source was `89df38f255e47afbcbb28a60555fb4a4a20091741d427ef1d7b8ea1ac33f306b` (47,825,216 bytes); the source is historical, not the current runtime.

The exporter uses the existing September-20 writer. Its file is unchanged. A narrowly asserted adapter replaces that writer's old height-only normal/tangent guard with the new field's exact identity check, preserving untouched low vertices as well as the cuff. Body mesh 2's POSITION, NORMAL and TANGENT arrays and their active references change. The complete original BIN prefix and original accessor/view records remain intact. Textures, UVs, weights, morph deltas, rig and animation are unchanged.

Native/source correspondence uses a spatial neighbor lookup, with one-to-one raw matching within **3 µm**. The imported native scene already differs from the original GLB by up to 2.808 µm, so the initial 1 µm source-coordinate requirement cannot describe this round trip. The separate authored **deformation delta** must still match within 1 µm; observed maximum is **0.306 µm**. Raw after-position error is 2.528 µm. No fitted transform or registration is used. `boots-native.json` is byte-identical to the original native record (SHA256 `80a2a811f9a9ebd1b2d8a0a96339e0d1386135a9d81bc349a452c1c6769c4474`). Aliases are temporary validation input; the writer evaluates the authored field on the original GLB positions.

The independent [check.py](check.py) passes; measurements are in [verification.json](verification.json):

- All 692 original accessors and 47,698,784 original BIN bytes are preserved. All lateral and height coordinates are exact.
- 1,664 vertices enter the deformation field; 1,650 float32 position rows change. Fourteen tiny boundary displacements round away. All 80,469 outside-field position/normal/tangent rows are byte-identical.
- Low sole length changes 277.552→266.165 mm left and 279.091→267.712 mm right. Width, minimum height, heel, ankle and cuff remain unchanged. These rest bounds do not prove posed contact.
- Minimum forward Jacobian is 0.831250; finite-difference error is 1.41e−10. Normal/tangent errors are below 4.7e−8. All 1,687 affected nondegenerate triangles keep orientation (minimum face-normal cosine 0.99622).
- Bad source/deformation rows displaced by 100 µm are rejected. Wrong source hashes, candidate overwrites and input overwrites are rejected.

The portable mode verifies the accepted asset without the original GLB, native record, Git history or Blender. It reconstructs the original metadata from the candidate using a 566-byte preservation contract, checks its canonical hash and the original BIN-prefix hash, then runs the same deformation, surface, normal and tangent checks:

```powershell
python art/characters/link/progress/2026-09-21-boot-tip/check.py --candidate-only public/models/link/link-runtime.glb art/characters/link/progress/2026-09-21-boot-tip/portable-review.json
```

This mode explicitly reports that native correspondence was not rerun. The original source/native mode remains unchanged in scope and still rejects all five original negative controls. Altered protected metadata and BIN prefixes are also rejected by the new preservation contract. The checker passed in an isolated directory containing only `check.py`, `source-preservation.json` and access to the candidate GLB.

[PORTABLE_CHECKS.md](PORTABLE_CHECKS.md) lists the exact inputs and commands for optional regeneration and historical/native validation. Regeneration starts from the hash-pinned historical `89df` asset, never from the already shortened current runtime.

No new external assets or dependencies are introduced. The accepted GLB occupies the existing runtime path; its duplicate study GLB, full native Blend and large CPU traces remain local.
