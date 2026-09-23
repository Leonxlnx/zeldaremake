# Contour export and verification

The local native study exports as SHA256 `a70ef7144fbb075b31103256f71f673c9b3a74b31e8c30f9ac117c0d765bcde8`, 54,397,352 bytes. It remains a local candidate; the production model is the accepted 4dcf source. Source `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850` was 51,111,284 bytes; the existing append-only geometry writer adds 3,286,068 bytes. This study introduces no external asset or dependency.

The [exporter](export.py) reuses the tracked September-21 boot adapter and September-20 writer without editing either. It applies [field.py](field.py) to source Basis positions, retaining the native study's authored deformation. Exact source hash, separate output path, raw nearest native correspondence within 3 µm and deformation delta within 1 µm are required. Existing candidates are never overwritten. An existing preservation contract must equal the newly derived source contract.

[verification.json](verification.json) records the independent [checker](check.py) result:

- Only body mesh 2 primitive 0's active POSITION, NORMAL and TANGENT references change, with three appended views/accessors. All 695 original accessor records and 50,984,104 original BIN bytes remain exact. Restoring those three references also restores the source's canonical JSON hash. Rig, all clips, weights, morph deltas, UVs, materials and textures are preserved.
- Exactly 5,703 position rows change. All 76,430 identity position/normal/tangent rows are byte-identical; all height and depth components are exact. All 2,970 toe-weighted vertices and the complete 537-point sole (269 left / 268 right) retain exact position, normal and tangent bytes.
- Source/native and after/native coordinate errors are at most 1.602 µm; deformation-delta error is 0.0426 µm. Matching uses no registration or fitted transform. Deliberate 100 µm source and deformation mistakes are rejected, as are altered protected metadata and original BIN bytes.
- The minimum field determinant is 0.92955; analytic derivatives agree with finite differences within 1.85e-10. Independent inverse-transpose normals and Jacobian tangents agree within 4.75e-8. All 4,083 affected nondegenerate triangles retain orientation in the rest mesh. These are local deformation checks, not a posed self-intersection proof.

[cross-leg-separation.json](cross-leg-separation.json) records CPU GLTFLoader skinning at native run phases 0, .25, .5 and .75. The source-rest mask Y < 0.4 m and |X| < 0.25 m contains 13,492 lower-leg vertices, including every one of the 6,039 vertices in the affected triangles. Left/right membership is fixed from source rest X. At each phase, min(left X) minus max(right X) is positive; the minimum rises from 12.8077 to 13.7930 mm. Each triangle's X range is bounded by its vertices, so this proves cross-leg separation in the measured region at those four poses. It does not test same-leg cuff/calf intersections or intervening phases. The existing arm/torso BVH helpers do not supply the shared-face and UV-seam adjacency exclusions needed for that separate question; no new collision framework was added. Paired native views remain the visual evidence for cuff continuity.

The independent actual-player comparison (local `../2026-09-21-stair-posture/leg-contour-player-comparison.json`) used the same frozen `439ad6a4` runtime and 1,320 frames as the accepted source control. Pose/metric rows and query counts are identical, with no negative foot gaps or reach clamps. Minimum gaps are +1.186768505 mm uphill / +1.264448333 mm downhill. Its 537 sole and 4,701 fully ankle/toe-family-owned points are unchanged by this field: none is among the 5,703 edited contour rows. The replay establishes preserved full-foot terrain contact; it does not establish terrain clearance or self-contact of the remodeled mixed shin/cuff region.

The separate edited-region check found new solid calf contact; see [CONTACT.md](CONTACT.md). The candidate is held. The unchanged-foot result above must not be presented as clearance for the altered calf.

## Portable check

Recover the source and export `regenerated.glb` with the commands below first. From the repository root, with Python's standard library only:

```powershell
python art/characters/link/progress/2026-09-22-leg-contour/check.py art/characters/link/progress/2026-09-22-leg-contour/regenerated.glb a70ef7144fbb075b31103256f71f673c9b3a74b31e8c30f9ac117c0d765bcde8 art/characters/link/progress/2026-09-22-leg-contour/local-review.json
```

Use a new report filename on every invocation. On this Windows host, `py -3.14` selects the installed interpreter. The check needs exactly this folder's `check.py`, `field.py`, `proposal.json`, `source-preservation.json`, and the already tracked `../2026-09-21-boot-tip/check.py`. It reads the supplied candidate plus the original metadata/BIN prefix retained inside it. No ignored source GLB, native record, Git history, Blender or browser is required. It passed in an isolated directory containing only those five small dependency files and access to the exact candidate GLB. Historical raw source-code receipt hashes are not fresh-clone line-ending gates.

Adding `--native` repeats the optional native correspondence checks. This additionally requires `export.py`, `candidate.json`, the published `native-rows.json`, and the already tracked `../2026-09-21-boot-tip/preview.py` and `../2026-09-20-run-arms/boots.py`. The immutable native rows have SHA256 `4e36ec4f98bbc4b070db930d60843a88ee06f69798448f92a0d7b1560d4996ec`; [native-summary.json](native-summary.json) is the compact authoring receipt. Native-only validation is deliberately optional.

## Optional source recovery and export

Commit `5050496a38983bcc44a3db4b6a6b8c5ab7cd8aa2` contains the exact 4dcf source. Recover it without touching production (PowerShell):

```powershell
@'
import hashlib, pathlib, subprocess
b = subprocess.check_output(['git', 'show', '5050496a38983bcc44a3db4b6a6b8c5ab7cd8aa2:public/models/link/link-runtime.glb'])
assert hashlib.sha256(b).hexdigest() == '4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850'
p = pathlib.Path('art/characters/link/progress/2026-09-22-leg-contour/source-4dcf.glb')
with p.open('xb') as f:
    f.write(b)
'@ | python -
python art/characters/link/progress/2026-09-22-leg-contour/export.py art/characters/link/progress/2026-09-22-leg-contour/source-4dcf.glb art/characters/link/progress/2026-09-22-leg-contour/regenerated.glb
```

Export uses the exact native rows published alongside the script. The saved native script assumes the coordinating agent's imported scene; this is not a claim that an unprepared fresh clone can regenerate that Blender scene. The runtime GLB remains directly editable in Blender. Duplicate GLBs, the 37 MB study Blend and detailed triangle-section dump remain local. A regenerated candidate GLB, small preservation contract, checker, field/profile and compact receipts suffice for the portable geometric check; source recovery plus the published native rows supports the export command above.
