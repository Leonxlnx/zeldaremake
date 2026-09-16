# Authored run arm timing

Candidate `2459112603a935a038dd06a67de85d5c5e28c72188f50ebd4d6e304af236bfa4` replaces only the six shoulder, elbow and hand channels of the run clip. It retains the reviewed `611c4425` leg motion, torso, run timing, other clips, geometry, skin weights, textures and blink data. The exported asset's original binary payload is preserved; new animation accessors are appended.

The source is Quaternius Universal Animation Library **Standard**, `Jog_Fwd_Loop`, published under CC0: https://quaternius.com/packs/universalanimationlibrary.html. `quaternius-source.json` records the pinned free-standard glTF mirror and file hashes; `QUATERNIUS-LICENSE.txt` contains its license. This credit covers the motion source, not the character asset's separate provenance in `public/models/link/SOURCE.md`.

The source cycle is phase-aligned to the reviewed left thigh (offset 5/64, correlation 0.9293). Chest motion is removed before transferring the arm directions. Upper-arm lateral direction is scaled to 60% and normalized, preserving the authored elbow motion while reducing shoulder spread. The native action uses 120 fps, frames 0–56. `cc0-arm-action.blend` contains the editable action. Full native source remains in the primary workspace at `art/characters/link/experiments/2026-09-13/source-runtime/cc0-arm-narrow-study.blend`.

Validation:

- 57 native samples close the hand-position loop within 1 micrometre. Arm/body triangle-contact counts decrease from 899 to 378 across the cycle; peak count decreases from 96 to 23. Thirty-four phases worsen despite the smaller total and peak. These are weight-partitioned intersection counts, not penetration depth or proof of perfect contact.
- Native peak hand step decreases from approximately 18.5 to 10.0 mm. Cyclic second difference improves for the left hand; the right changes from 4.369 to 4.405 mm, a small regression.
- 300 actual gameplay frames complete without page errors or reach clamps. Every recorded non-arm field matches the retained build exactly, including torso points, gait, root placement and feet. Walking hand measurements also match.
- In steady running at 60 Hz, hip-relative peak hand steps decrease from 35.75/35.77 to 17.71/18.15 mm, left/right. Maximum second differences decrease from 8.78/8.79 to 7.71/8.32 mm. This measures motion, not subjective naturalness.
- During stopping, left-hand peak step improves from 37.92 to 17.05 mm; right-hand peak step worsens from 33.86 to 34.50 mm. Both stopping second differences improve. Right-hand run-entry second difference also worsens slightly, from 7.84 to 8.32 mm.
- Matched native and gameplay stills were inspected. The gameplay video contains the walk/run/idle transition. No new stair sweep was run for this arms-only change; stair animation and runtime IK are unchanged.

Re-run the saved gameplay comparison with:

```sh
python compare_arm_motion.py baseline-gameplay-manifest.json gameplay-manifest.json
```

Full-body sprint/jog retargets were rejected for foot placement and posture. A 60% blend of all arm joints was also rejected because total arm/body intersections increased to 1,095. Only the narrower-shoulder authored-arm version is retained. Hair, face detail, cloth deformation and final animation quality remain unfinished.
