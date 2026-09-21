# Composed torso motion: CPU comparison

The torso carrier changes the current character's shoulder-line yaw from zero to approximately **-5.76…+5.68 degrees**, while hip/leg matrices, root placement, foot contacts, IK, stride and cadence remain exactly equal in this comparison. Its compensated head orientation matches at baked samples, but has a small **0.00277-degree maximum interpolation residual** between them. That residual is disclosed separately from the passing structural checks.

| Input | SHA256 |
| --- | --- |
| Baseline: current arms/calves plus accepted upright stairs | `e3ef74a02336b5f6952ed340e8191369284dacc92da9b5782dd9f3cb7dceb552` |
| Candidate: the above plus only run chest/head rotations | `ad0518e6bdbffbc93620c57595b09143a4458bf311e22ec13c55a78ec29e53c9` |
| Production `glbLink.ts` used for both | `4f11b133e6e89833dec095bbcdbed03e547c5ac24247cd2bd88b3656a52131a6` |

`compare.mjs` serves the two existing composed GLBs through a private local middleware. It writes only this report directory and does not copy assets to `public/`, mutate Blender, or create a renderer. The runtime digest is checked again after measurement to detect concurrent source changes.

## Scope and measurements

The exported-native check samples the GLB's run animation directly with Three.js's animation mixer at 113 evenly spaced phases including both endpoints. This is CPU inspection of native-authored **exported animation**, not a Blender render. Each production mode then warms for 120 frames and measures 600 frames at 60 Hz: fixed-capture positioning at 3.9 m/s and playable locomotion at 4.6 m/s. All use the actual loader, arm filter and IK; neither enables head-look or jumping.

| Play mode, 60 Hz | Baseline | Torso candidate |
| --- | ---: | ---: |
| Shoulder-line yaw | 0 degrees | -5.76282…+5.67850 degrees |
| Mean whole-torso lean, hips to neck | 5.25024 degrees | 5.23545 degrees |
| Mean chest-segment lean, chest to neck | 7.44547 degrees | 7.42460 degrees |
| L upper-arm sagittal pitch | -41.05…+19.50 degrees | -42.06…+21.04 degrees |
| R upper-arm sagittal pitch | -41.41…+19.54 degrees | -42.43…+21.02 degrees |
| Mean elbow flexion, L / R | 81.23543 / 80.82711 degrees | 81.23543 / 80.82711 degrees |
| Mean hand forward of shoulder, L / R | 64.345 / 57.399 mm | 64.682 / 57.822 mm |
| Mean hand outward of shoulder, L / R | 84.426 / 93.023 mm | 81.539 / 90.036 mm |
| Run stride | 1.82 m | identical |
| Native cycle | 0.466666669 s | identical |
| Full-speed cycle / cadence | 0.395652 s / 303.297 steps/minute | identical |
| Shared flight, both footprint minima above 1 mm | 56.833% | identical |
| Root vertical range | 0.97513 mm | identical |
| Minimum audited footprint gap | -0.00273 mm | identical |
| Reach-clamped frames | 0 | 0 |

The small sagittal-lean changes are the projection of the same pitched torso after axial rotation. No additional forward lean is authored. Angles describe bone-marker geometry, not a clinical skeletal model. Foot gaps are the runtime footprint audit, not full deformed-shoe collision.

Absolute hand displacement due to the torso turn peaks at **29.707 mm left / 29.679 mm right**; means are 17.647 / 18.019 mm. The head joint moves by at most 3.340 mm as it follows the torso. These motions make fresh pouch/sleeve contact review necessary even though elbow curves remain unchanged.

The arm/opposite-thigh sagittal correlation changes from 0.4956 / 0.5179 to 0.5484 / 0.5661 in play mode. This is a descriptive measurement, not an optimization target or proof of naturalness: counterbalancing concerns angular momentum and the arm/leg waveforms differ. No arm phase, amplitude or runtime filter setting changes in this candidate.

## Preservation and the head residual

The independent file check verifies that exactly `run: chest.rotation` and `run: head.rotation` select new samplers. Other clips, rest nodes and non-animation data match, and the baseline binary prefix is preserved. In all three sampling modes, every world-matrix element for `hips`, both thighs, knees, ankles and toes is exactly equal. Their serialized trace hashes match; both production modes also have identical complete root/foot/IK trace hashes. No lower-body improvement is claimed for this torso-only delta.

At the 113 exported-native samples, the largest normalized-head-quaternion difference is **0.00000540 degrees**. At 60 Hz it is **0.00184681 degrees in capture mode and 0.00276652 degrees in play mode**. Separately interpolated chest and compensating head rotations are not an exact inverse at intermediate times. At a 120 mm head radius, the largest residual changes an aim point by about **5.79 micrometres**. The head orientation is therefore closely preserved, not mathematically identical throughout the continuous loop.

The initial strict runtime assertion used the same 0.0001-degree tolerance as the baked samples and failed on this interpolation residual. The final report keeps `headOrientationWithinNativeToleranceBetweenBakedSamples: false`; structural checks pass independently. It does not relabel the strict check as a pass. The native head tolerance still has a runnable assertion.

At the sampled playback endpoints, head orientation closes exactly and hand position closes within 0.10 micrometre for both inputs. The mixer uses its default `LoopRepeat`, so an exact-duration sample can wrap to phase zero; those fields describe playback closure and do not independently prove equality of the authored first/last key values. The balanced-candidate follow-up checks those raw values separately. The same-time play-mode replay has zero head rotation and hand translation no greater than 2.24e-16 m; the zero-dt filter remains stable. This does not inspect angular velocity continuity at the exported seam.

## Research rationale and source

The prior transfer removed source chest rotation and left the destination shoulder line rigid. Restoring a restrained portion of its existing, phase-aligned motion is supported as a motion-design direction by research on coupled arm/trunk movement. **The 0.15 gain and resulting roughly 11.4-degree excursion are artistic choices, not paper-derived physiological targets.**

- Pontzer et al. measured adult walking/running and found relationships consistent with arms damping torso/head rotation and trunk/shoulders transmitting lower-body movement. Their reported contralateral arm/leg organization supports inspecting the whole chain. [Pontzer et al., 2009, author institution record](https://experts.arizona.edu/en/publications/control-and-function-of-arm-swing-in-human-walking-and-running/), [author-hosted paper](https://scholar.harvard.edu/files/dlieberman/files/2009d.pdf).
- Arellano and Kram found restricted arm swing increased torso/pelvis rotation, supporting coordinated swing rather than independently frozen body segments. Those human energetic measurements do not define a stylized character's ideal amplitude. [Arellano and Kram, 2014](https://journals.biologists.com/jeb/article/217/14/2456/12120/The-metabolic-cost-of-human-running-is-swinging).
- Yegian et al. measured a shoulder/elbow torque tradeoff with bent arms, while running oxygen consumption did not differ between their straight/bent conditions. This is not evidence for freezing every runner's elbow at exactly 90 degrees; the candidate retains the existing authored elbow curve. [Yegian et al., 2019](https://pubmed.ncbi.nlm.nih.gov/31289110/).

The motion is the existing free Standard `Jog_Fwd_Loop` from [Quaternius Universal Animation Library, published as CC0 by its author](https://quaternius.com/packs/universalanimationlibrary.html). The prior research independently recomputed its glTF, binary and license hashes against the pinned mirror provenance; no new paid motion, service or dependency is used here. That CC0 statement describes the motion input, not the separately generated/authored character's license.

Blender's [Motion Paths](https://docs.blender.org/manual/en/latest/animation/motion_paths.html) can inspect hand/head arcs, and [cyclic F-Curve handling](https://docs.blender.org/manual/id/4.5/editors/graph_editor/fcurves/modifiers.html) helps review joins. CPU checks here do not replace root's matched native renders, arm/body contact evaluation or actual-game playback.

## Reproduce

```powershell
$env:ZR_NATIVE_GPU = '0'
node art/characters/link/progress/2026-09-21-motion-research/compare.mjs
```

The default inputs are the two composed candidates in the adjacent `2026-09-21-motion-integration` directory. See `composed-comparison.json` for all measurements, exact digests and separate structural/head results. The earlier source-only diagnosis remains in `E:/zeldaremake-astra-link-run/art/characters/link/progress/2026-09-21-motion-research/`; its different runtime digest must not be mixed with this paired comparison. No commits, production writes, GPU rendering or Blender mutations were performed by this research lane.
