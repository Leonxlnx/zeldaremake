# September 20 stair support diagnosis

This is CPU evidence against the actual final `ea93932d…` character and generated `stairs-main` geometry. No renderer or Blender was used, and this audit did not edit production code. The runtime baseline is pinned to Git `0e41b57c` inside the diagnostic, so later source edits cannot silently change the comparison.

## The 60 mm jolt is a support-coordinate bug

The recorded descent peak occurs at frame **477**, during steady stair walking at 1.1 m/s, with one active clip, no jump, no reach clamp, and no extra root drop. The analytic placement stays at 1.35 m. It is not a start or gait transition.

| Frame | Right foot support input X/Z | Actual support sample X/Z | Support | Root Y |
| --- | --- | --- | --- | --- |
| 476, pin engages after planning | 8.888115 / −1.436383 | 8.913070 / −1.455848 | 1.283067 m | 1.275627 m |
| 477, existing pin reused | 8.913850 / −1.456457 | 8.937820 / −1.475153 | 1.357422 m | 1.335997 m |

The pin contains an already shifted world position. `footConfig` shifts it backwards another 30.4 mm, then evaluates the vertical support there. Later, the horizontal pin correction puts the foot back at its actual pin. The support and rendered foot therefore refer to different points. Center-line support jumps from 1.275645 to 1.35 m; both frames add the same 7.422 mm pitch lift. All four proud-corner branches are disabled on both frames: that branch does not cause this particular jump.

Simply disabling the second shift removes the jolt but holds the foot at the original low support, causing about 37 mm of actual shoe penetration through the stance. The center-line SINK calculation misses the lateral heel corner resting on the upper tread. Including all four corners when a separate rendered surface exists corrects the planned landing support before the pin engages.

## Minimal candidate for native review

1. Add an optional `placed = false` argument to `footConfig`.
2. Before calculating descending pitch, set `shift = 0` for `placed` inputs.
3. Pass `true` only when reading an existing stance pin.
4. With a separate rendered surface (`base` non-null), evaluate all four PLANT corners; remove the `ground <= base + 1e-6` skip. Preserve the base-null path.

Leave the held take-off (`heldOff`) call unchanged in this bounded fix. That path actually applies `cfgOff.shift` to the released ankle; it does not have the pinned path's conflicting horizontal override. Applying the same option there changes later swing contacts: descent frame 160 worsens from −1.98 to −5.42 mm, and frame 336 from −13.31 to −17.17 mm. The narrower pinned-only candidate achieves the same jolt improvement without these changes. The broader experimental variant is retained as a rejected scope expansion, not claimed as a contact failure beyond the project's 20 mm threshold.

| Measured result | Baseline | Pinned-only + full PLANT corners |
| --- | --- | --- |
| Descent frame 477 root step | +60.37 mm | −5.95 mm |
| Maximum steady descent root step | 60.37 mm | 19.79 mm |
| Maximum steady ascent root step | 25.20 mm | unchanged |
| Actual shoe minimum at descent 476 | −26.06 mm | +19.93 mm |
| Actual shoe minimum at descent 477 | +28.30 mm | +24.78 mm |
| Maximum planted drift | <7 µm | <7 µm |
| Flat idle/walk/run skeleton traces | baseline | exact hashes match |
| Maximum stair knee flexion | up 162.35° / down 155.03° | unchanged |

These are steady-state CPU replays of frames 120–589, after warming from frame 80. Placement coordinates and facing come from the recorded player trace; clip phase is recovered within the audit's rounded shift interval by matching the pelvis. Unmodified replay root heights at the diagnostic peak neighborhoods agree with the recorded game within **1.27 nanometers**. The actual shoe comparison uses the capture script's same eight extreme sole markers, raycast every frame against the generated stair triangles. It does not prove all mesh vertices collision-free or cover the omitted startup/ending transition frames.

## Remaining stair problems

Per-frame checks find existing transient intersections that the original every-ten-frames capture missed: descent frame **274: −28.17 mm**, **449: −67.32 mm**, plus the now corrected frame 476. The first two are unchanged by this candidate. They involve a swinging left foot and the existing hip correction; the moving foot's clearance must be checked at its final rotated position before calling those fixed.

The peak knee folds are also steady stair motion, not transitions:

- **Up 155, right knee 162.35°:** the lower left foot remains planted at 1.35 m while the right clearance envelope raises the sole to 1.621 m. The hip-to-ankle distance is only 80.1 mm despite 180.7 mm thigh and 230.6 mm shin lengths. A 48° hip correction rotates this folded triangle but preserves the knee angle. By frame 156, clearance slack is exhausted and the outward knee swivel activates (~36°), producing the abrupt lateral posture change.
- **Down 374, right knee 155.03°:** the root is already supported by the lower left tread (2.16 m), while the trailing right foot remains over the upper nosing (sole 2.440 m). Hip-to-ankle reach falls to 101.4 mm. The knee flex follows from this reach, not from a newly edited animation.

For scale, the same bone lengths require 210 mm hip-to-ankle reach to bend the knee 120°. A pure pelvis raise can supply only about 64–67 mm before the other planted leg becomes fully straight at these frames. This illustrates why a global knee-angle clamp would stretch the leg or violate stair contact. The next posture work should coordinate the swing trajectory and pelvis support timing, with final footprint clearance, instead of clamping a visually bad angle.

## Reproduce

Run from `E:/zeldaremake-astra-link-run`. The browser loads an empty page and production CPU modules; it never creates a WebGL renderer. By default, source instrumentation and the candidate patch exist only in Vite memory. The parent subsequently applied the same narrow patch to the working source, and `--working-source` verified its numeric metrics match the tested candidate exactly.

```powershell
# Writes baseline evidence and intentionally fails the known 60 mm regression.
node art/characters/link/progress/2026-09-20-natural-run-audit/stair-support-diagnostic.mjs --exact --assert-support

# Writes candidate evidence and checks support coordinates, jolt, contact and flat traces.
node art/characters/link/progress/2026-09-20-natural-run-audit/stair-support-diagnostic.mjs --exact --placed-anchors --all-corners --only-pins --assert-support

# Verify the parent's actual working source after applying the production patch.
node art/characters/link/progress/2026-09-20-natural-run-audit/stair-support-diagnostic.mjs --exact --working-source --assert-support
```

The focused regression requires the final pinned sole to occupy its support sample within 10 µm, the known jolt to stay below 20 mm, touchdown/pin-reuse shoe markers to clear the mesh, no new contacts beyond the existing 20 mm threshold, unchanged flat hashes, and no worse stair knee maxima. It deliberately reports the unchanged swing intersections rather than claiming to solve them.

Raw local outputs: `stair-exact-replay.json`, `stair-pins-footprint-replay.json`, and the two exploratory variants. `stair-support-summary.json` is the compact retained comparison, including every contact minimum change exceeding 0.1 µm.
