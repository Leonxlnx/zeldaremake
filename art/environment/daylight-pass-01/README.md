# Clearer daylight — first pass, September 16

Owner request: a more visible sky and more realistic light/shadows during the 11:35–13:35 UTC environment session. Fable reserved atmosphere, lighting, postfx and the relevant configuration values. Base: `f3314dc2`, after round 38 / take 107. Character, trees, terrain and vegetation geometry are unchanged.

The upper sky now has a blue gradient and a more gradual transition from the horizon. Reduced near/far haze extinction exposes more of the forest's depth; the shared sky/fog colours remain consistent. A warmer key over cooler, weaker sky fill makes the distinction between lit and shaded stone clearer. Exposure, sun direction, shadow maps and the softening chain are unchanged. The first pass adds no geometry, textures or render passes.

The `baseline/` and `after/` folders contain seven native-renderer screenshots, camera/settings manifests and reference comparisons. The seventh view looks upward through the same canopy opening. Time is fixed at 12.6 seconds; screenshots wait for the loading overlay to finish fading. The earlier 11:39 diagnostic had an overlay in its first frame and is excluded here.

| View | Fable take 107 SSIM | Same-machine baseline SSIM | Daylight SSIM | Sharpness baseline → daylight | Overexposed fraction |
|---|---:|---:|---:|---:|---:|
| A | .3083 | .2917 | .2729 | .768 → .892 | 0 |
| B | .2885 | .2773 | .2592 | .654 → .732 | 0 |
| C | .3318 | .3205 | .2958 | .992 → 1.123 | 0 |
| D | .3686 | .3444 | .3287 | .819 → .918 | 0 |
| E | .3010 | .2863 | .2717 | .612 → .685 | 0 |
| F | .3152 | .3050 | .2932 | .956 → 1.072 | 0 |

These are the existing comparison metrics. The same-machine baseline is the controlled comparison; the cloud take has different capture conditions. The clearer, bluer direction loses resemblance to the grey-yellow video reference. This is an explicit visual-direction tradeoff, not a gauntlet completion claim. B/E sharpness remain below the rubric threshold.

The built defaults reproduce the tuning study's six-view metrics. Build/typecheck pass; all seven native captures complete without page errors. A first native GPU-synchronised performance sample at 1280×720, 4096 shadows and 12 taps measured a 41.3 ms median over 20 frames. This is one fixed view on a shared laptop, not a gameplay FPS guarantee or a performance improvement claim. The shadow-quality comparison is still in progress.

`gauntlet/scripts/daylight-review.mjs` captures the current default or an existing tuning-hook JSON. `ZR_NATIVE_GPU=1` now opts the standard capture/performance tools into D3D11 on Windows; CI still uses SwiftShader by default. The lighting audit now reads the actual live hemisphere colours and environment intensity, including when tuning overrides are active.

Next: validate shadow quality/cost, refine the sky's cloud definition and canopy glare, and continue matched captures through the remaining session. Fable retains near tree/grass detail and the lantern-crown geometry correction. No global blur or sharpen adjustment was used to raise sharpness.

## Full native take follow-up

`take-0109/` contains the standard capture at 12.5 seconds, six settling frames and the normal HUD. Its image conditions differ from the clean 12.6-second comparisons above. It completes with zero console errors, determinism difference 0, 84 anti-cheat checks green, and a local score of 24/50 (Phase 1: 20/42). Standard-take sharpness is .874 in B and .818 in E, passing W35 under those capture conditions. This is local evidence, not CI attestation or final visual acceptance.

The preceding take0108 was invalid: its first screenshot still contained the loading overlay's CSS fade, while its later repeat did not. The shared `openWorld` helper now waits for actual loading opacity zero. `invalid-take-0108/` preserves that failure; no threshold was relaxed and no frame was retouched. The successful repeat keeps the same world shader/build.

The separate native 2048/8 shadow sample completed at a 34.7 ms median versus 41.3 ms for 4096/12. Defaults remain 4096/12 pending visual quality review. Both raw timing reports are included.
