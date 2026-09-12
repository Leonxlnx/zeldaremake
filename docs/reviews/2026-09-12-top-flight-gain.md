# Local upper-flight light gain

The actual ccc7e7f off/on comparison produced only a subtle change. Root inspected A and F at full resolution: the upper-flight air becomes slightly brighter, but there is no strong beam yet. The unchanged images are available in the [ccc7e7f gallery](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/progress/2026-09-12_140803817-ccc7e7f).

The upper-flight ROI mean display-luma difference was +0.2135 codes in A and +0.1520 in F, on a 0–255 scale. The strongest coherent 24×24 block means were +1.7061 and +1.5090; both plaza control boxes were byte-identical. These are measurements of the saved JPEGs, not linear irradiance. The real 1 m radius corridor crosses only a few march samples, followed by distance extinction and smoothing, which helps explain the small signal.

This next isolated comparison uses local opening gain 1 versus 3. The existing fourth component of the opening uniform carries the gain; the mask combines it with the same feathered circular footprint. The radius remains 1 m, the center remains the real terrain-anchored top flight, and every new contribution still requires a valid, lit sun-shadow sample. The gain does not enter the legacy column term that can bypass the lower-air fade. Global sun, fog, density, extinction, six legacy columns, geometry and material finishes remain unchanged.

Production gain 3 is a candidate pending image review. The comparison's baseline overrides only `beamCanopyGain: 1`; candidate uses no runtime overrides. Both columns render the same new source, camera, time and world, based on leaf/PACKS checkpoint 561345b. The previous source's actual gallery is retained separately. C/D and low plaza controls should remain unchanged; A/F upper-flight air must gain a coherent beam without a broad haze patch or leakage through the stairs/trunks.

The existing CPU lifecycle check now exercises gain 1→3→0→1→3, unchanged radius/sun axis, stable eight uniform objects, no shader recompile request, missing maps, sun-off, late publication and the actual scalar shader mask/guard expressions. Zero or invalid gain clears this extra mask. Typecheck/build (107 modules), source anti-cheat and capture-state contracts pass. These checks do not compile GLSL on a GPU or establish visual acceptance; the real CI pair is required.

Fable was informed in PR2 comment 5646502912. He retains the foreground plant and house roof/support passes. No placement, canopy caster, shared plant material or character changes are part of this study.
