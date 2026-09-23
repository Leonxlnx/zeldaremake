# Run-arm continuity repair

The delivered Link asset is **89df38f2**, 47,825,216 bytes. It replaces only the run rotations of `shoulderL`, `elbowL`, `shoulderR` and `elbowR`. The accepted legs, stair animation, hips, torso, head, hand channels, rig, mesh, baked textures and eyebrows are preserved. This repairs the exaggerated intermediate arm poses without adding another artistic offset.

The cause was **32 residual fractional keys in each old arm FCurve**. The September-13 native CC0 study contained 89 keys per quaternion component: 57 intended integer-frame keys plus 32 older keys between them. Its 120-fps GLB sampled only the intended grid and was smooth. September-19's denser 240-fps sampling exposed the residual keys. The corrupted shoulders then passed through 382 and ea939 into 3056. This was not a current Three.js loader problem or a retiming-cache problem.

The root agent verified the native cause in Blender: deleting only those fractional keys from a diagnostic action copy reduced the shoulder step to 1.34°/1.43°; retiming followed by `f.update()` did not change the corrupted samples. [Compact native evidence](native-action-summary.json) records the source Blend hashes, key counts and sample hashes. The full local diagnosis is retained separately.

`rebuild_native.py` starts from the smooth exported 2459 source and recreates the previously accepted corrections in their original order: shoulder inward 0.10 rad, shoulder backward 0.10 rad and outward 0.08 rad, then elbow opening 0.14 rad. It snapshots the complete source cycle before writing fresh curves into a full copy of the current delivery scene. Only the four reviewed rotation channels are appended to the delivery. On the original 57-pose grid, the reconstruction differs from 3056 by at most **0.000083°**; the intervening corrupted poses account for the meaningful change.

| Measured at 240 Hz | Before 3056 | Rebuilt 89df |
| --- | ---: | ---: |
| Largest left shoulder step | 29.572° | 1.343° |
| Largest right shoulder step | 31.676° | 1.426° |
| Shoulder steps above 5°, each side | 64 | 0 |
| Largest left/right elbow step | 2.425° / 2.361° | 1.397° / 1.355° |
| Maximum forward hand reach, left/right | 153.8 / 149.0 mm | 120.7 / 117.8 mm |

The raw exported shoulder endpoints are component-identical. The elbows retain at most 8.94e-8 component difference, or 0.0000146° orientation difference, from float32 export. An initial assertion requiring bit-identical elbow endpoints failed; the actual residue is recorded and accepted under the explicit 0.0001° loop tolerance. The native study's float32 `acos` angle can overstate very small endpoint differences; the independent double-precision exported check is authoritative for these figures.

The real production loader and puppet were checked without a renderer: 113 native samples, 600 capture samples and 600 play samples at 60 Hz after 120 warm-up frames. Hips, chest, head and lower-body matrices are exactly equal. Root/foot/IK trace hashes, stride, cadence and flight fraction are equal. Zero-dt reposing passes, with no reach clamps. At the actual 4.6 m/s play speed, the largest shoulder frame step falls from 16.21°/17.42° to 6.39°/6.90°. Hand acceleration relative to the shoulder falls from 274/268 to 37.55/38.66 m/s². These are finite-difference diagnostics for this rig, not human biomechanics targets. [Runtime comparison](rebuilt-comparison.json)

The independent root-owned Blender contact audit also passes across 113 samples: total arm/body triangle overlaps **1452→1316**, peak **99→22**, and overlaps reaching below Z=0.69 m **235→21**. These counts include sleeve/armpit contacts and are not penetration depths or a claim of collision freedom. [Contact report](../2026-09-21-motion-integration/rebuilt-native-contacts.json)

## Portable verification

From the repository root, after installing its normal dependencies:

```sh
node art/characters/link/progress/2026-09-21-run-carriage/check-rebuild.mjs
```

This reads the **current production GLB** and the small `rebuilt-source-preservation.json` contract. No ignored GLB, native Blend, browser or historical model copy is needed. It checks the exact delivered hash, key count/timing, normalized finite quaternions, loop closure, a clip-specific continuity bound, original binary/accessor spans, rig/mesh/material/image metadata and all unselected animations. [Passing report](portable-checks.json)

The optional negative control reads two pinned model blobs directly from local Git history and leaves them in memory:

```sh
node art/characters/link/progress/2026-09-21-run-carriage/check-rebuild.mjs --historical
```

It accepts the clean 2459 shoulders and rejects the corrupted 382 shoulders. Git history must include `0dfd3601^` and `d679e7ee`. [Negative-control report](portable-historical-checks.json)

To recover the clean source for a deliberate native rebuild in PowerShell, this command refuses to overwrite an existing file:

```powershell
node -e 'const fs=require("node:fs"),cp=require("node:child_process");fs.writeFileSync("art/characters/link/progress/2026-09-21-run-carriage/source-pre382.glb",cp.execFileSync("git",["show","0dfd3601^:public/models/link/link-runtime.glb"],{maxBuffer:100000000}),{flag:"wx"})'
```

Expected source SHA256: `2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4`. The native script additionally requires the exact previous delivery 3056 and its imported baseline scene; it refuses to overwrite evidence. The committed 48,336-byte `rebuilt-run-native.glb` is the portable native animation carrier. Full source/candidate GLBs and the 37 MB Blend stay local. `compare.mjs` and the comprehensive historical audit use those local archives; the default check above does not.

## Research and provenance

Arm swing contributes to control of body rotation, and experimentally restricting it increases trunk/pelvis rotation; that supports preserving authored coordination while removing discontinuities. It does not prescribe the existing 0.10/0.08/0.14-radian art adjustments. [Pontzer et al., 2009](https://experts.arizona.edu/en/publications/control-and-function-of-arm-swing-in-human-walking-and-running/), [Arellano & Kram, 2014](https://journals.biologists.com/jeb/article/217/14/2456/12120/The-metabolic-cost-of-human-running-is-swinging)

Bent elbows change the distribution of shoulder and elbow torque; the research does not establish a universal exact elbow angle for this stylized rig. [Yegian et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31289110/)

Blender provides explicit keyframe clearing/removal. Updating or deduplicating a curve does not remove distinct keys at unwanted fractional times; the reconstruction therefore uses fresh selected curves and fresh carrier key arrays. [Blender animation API release notes](https://developer.blender.org/docs/release_notes/3.3/animation_rigging/), [curve update/deduplication notes](https://developer.blender.org/docs/release_notes/3.6/animation_rigging/)

The motion source remains the author's [Quaternius Universal Animation Library, CC0](https://quaternius.com/packs/universalanimationlibrary.html), `Jog_Fwd_Loop`, with the existing phase match. The repository includes the original [source receipt](../../../../../reference/animations/quaternius-standard/SOURCE.json) and [CC0 license](../../../../../reference/animations/quaternius-standard/LICENSE). Raw motion binaries are not vendored; the receipt pins the mirror commit and checksums, and [the provenance note](../2026-09-21-motion-provenance/README.md) gives their exact upstream paths. The raw source was independently smooth under the same normalized-cycle check. These records document the motion input; they do not replace the native authoring baselines above or relicense the separate character model or entire project.

The earlier `preview.mjs` forward-stroke offset experiment is **superseded and not delivered**. Its failed overly tight numerical assertions and local report remain diagnostic history. The repair uses the original authored motion and accepted corrections instead. Hand geometry, broad visual quality and any future torso study remain separate work.
