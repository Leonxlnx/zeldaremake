# Chest posture plus right strap

Combined candidate **`7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda`** is 51,113,876 bytes. It combines the accepted chest-only run posture (`143160f1…47e69`) with the separate 100-row right strap correction (`6ea975df…fa60c`). Both inputs start from the accepted left-strap source `1873fc17…853d5`.

`patch_joints.py compose` loads the exact 143 posture file, reuses the original right selector/weight/accessor contract, and changes only its 100 active head joint entries to chest. Reversing those entries recovers **the complete 143-source GLB byte for byte**: its added run chest clip, every protected channel, rest mesh, rig, textures and left-strap correction stay intact. The expected combined hash is mandatory. It writes only inside this evidence folder and refuses an existing destination.

The opposite order was independently executed through the existing September19 animation exporter: start from 6ea, use the same native chest carrier, and change only the copied study's source hash. This creates an **identical complete GLB**, not merely matching channel values. [Composition verification](composition-verification.json) records both orders and their hashes. The original right-only selector, preservation/native receipts and `export` / `check` behavior remain unchanged.

The combined file is now the local default. Its read-only check requires no historical GLB or native process and does not rewrite saved reports:

```sh
python art/characters/link/progress/2026-09-22-right-strap/patch_joints.py check-combined public/models/link/link-runtime.glb
```

This requires the exact 7f hash and independently reverses the selected 100 chest joints to recover the exact 143 posture hash. The earlier [posture delivery](../2026-09-22-body-posture/DELIVERY.md) supplies the animation/runtime evidence for that intermediate. The original standalone `check PATH-TO-6EA.glb` remains strict and intentionally does not accept 7f.

The root's [combined native 113-phase comparison](../2026-09-21-motion-integration/posture-both-straps-native-contacts.json) also passed: **1,269 contacts, peak 24, 21 below the armpit**, with every recorded phase row identical to the posture-only scene. Existing intersections remain; this is preservation of the reviewed posture result, not collision-free clothing.

From repository root, with the separately reproduced 143 posture asset (see the [posture delivery](../2026-09-22-body-posture/DELIVERY.md)):

```sh
python art/characters/link/progress/2026-09-22-right-strap/patch_joints.py compose PATH-TO-143.glb art/characters/link/progress/2026-09-22-right-strap/posture-right-candidate.glb
```

Only the small composition/check functions, this note and its JSON receipt need publishing. The local candidate and opposite-order scratch files are not additional Git assets. The native result above is separate from byte commutation; the read-only CLI checks file preservation, not a new native collision sweep.
