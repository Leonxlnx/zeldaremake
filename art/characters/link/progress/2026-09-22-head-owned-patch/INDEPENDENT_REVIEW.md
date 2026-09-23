# Independent joint-patch review

**PASS for the proposed joint-only export. No export or preservation blocker found.** This review supports root's intended promotion of candidate `1873fc17…`; it does not promote the candidate or accept the separate torso/posture studies.

The 51,111,284-byte candidate differs from accepted source `4dcf89c5…` in **exactly 243 bytes**. Every difference is the active Uint8 `JOINTS_0` entry of a selected rigid vertex, changing skin joint 3 (`head`) to 1 (`chest`) in accessor 19 / buffer view 20. All weights remain exactly 1 on those active slots. Reversing those entries restores the complete original SHA-256.

An independent direct byte comparison confirms all other bytes are identical: GLB JSON, node hierarchy, bind matrices, original and active geometry attributes, indices, morph data, UVs, textures/materials and every animation input/output. No new geometry, clip or texture source enters this export. Independently rebuilding the original exact-position-welded head/head edge traversal reproduces the same **66 distinct positions / 243 split vertices**, without a positional box or color-based selector.

## Contact and foot preservation

The original native census uses arm-group weight thresholds `> 0.5` and `< 0.2`. Every vertex's arm-weight sum remains exact, so the actual face masks remain exact: **9,733 arm faces / 47,859 opposing faces** in the body primitive. Other primitives are byte-identical. Head-to-chest reassignment does not remove these strap faces from the opposing set or change acceptance thresholds.

All ankle-hierarchy weight sums are also exact. The original sole selections remain **269 left / 268 right**, and fully foot-owned selections remain **2,387 left / 2,314 right**. No selected strap vertex belongs to these sets. With geometry, hierarchy and clips preserved, this joint change cannot alter their skinned positions; no terrain replay was needed or performed.

## Validation and limits

The existing checker was run against the immutable candidate and native receipt. All 243 vertices at neutral, both ordinary look poses and run phase 102/112 match native positions within **0.0625 µm**. In-memory negative controls reject an omitted joint change and an unrelated POSITION-byte mutation. The saved 113-sample native census reports **1,316 → 1,289** contact pairs, peak **22 → 21**, below-armpit **21 → 21**; no census was rerun by this reviewer.

The copied-scene receipt shows the chest boundary's ordinary-look extension falling from 36.663 mm to below 0.000081 mm, with every outside-island vertex unchanged. Existing shoulder-boundary deformation remains: at the inspected run phase its maximum rest-length deviation is 27.769 mm, slightly reduced from 28.699 mm. This is a scoped correction of head-driven strap stretching, not proof of collision-free clothing or ideal weighting in every pose. Native visual acceptance remains with root.

Historical full-asset checks pin source `4dcf89c5…`. They must retain their original guards; applying them to this candidate requires explicit validation/reversal of this 243-byte contract, rather than silently excluding JOINTS or BIN bytes.

## Reviewed evidence

| Input | SHA-256 |
|---|---|
| Source asset | `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850` |
| `strap-chest-candidate.glb` | `1873fc17861455ac7b4e9cf624301039872e9d23dd7923bac3a2dc23851853d5` |
| `patch_joints.py` | `e6b23029cdfc578a0a41a772b8a93b2fd73ee5f046743809c788d8709e5df64a` |
| `native-joint-poses.json` | `c37af0b488b6e0bedb6c133ef16b4fe90451e9d0178df6c857664a86c64228e9` |
| Local `../2026-09-21-motion-integration/strap-chest-native-contacts.json` | `ed6e1a389fb8431b707d50347e2f0c5dbc486f1f7202399fdf3f03215ca03c5c` |

No production, asset, source, Blender, GPU or replay changes were made by this review. The only new file is this report.
