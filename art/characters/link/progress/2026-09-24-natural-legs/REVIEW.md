# Independent leg visual review

Reviewed candidate **8d7efa783d4bbc97d053c0a627a28c3c163351d7828124e1bf10c8232f06cedd** using the actual Three.js character puppet and terrain IK on the studio floor. The [packaged capture receipt](studio-trace.json) records 2.2 m/s and 1.20 m stride overrides: a 0.545 s cycle, **220 steps/min**, 60 Hz simulation and 30 fps captured frames. It reports no capture errors.

I inspected `smooth-jog-studio/cycle.png`, full-resolution side frames 20/24/28, and three-quarter frames 116/120/124/128. I also inspected the fitted variant's cycle and side frames 20/24/28, plus the previous AA `2026-09-24-run-jitter/run-cycle-game.png` and native side image. The previous world capture has a different camera and lighting, so that comparison is qualitative. **This is sequential-frame inspection, not a claim of watching continuous video playback.**

The smooth variant is a material improvement over the old low, nearly horizontal foot return. The rear boot folds upward, passes beneath the body and opens toward the next contact. The smooth version keeps the head/torso visibly steadier than the fitted variant through the sampled phases. Knees bend in the expected direction; there is no obvious reversed bend or rigid sideways scissor.

The three-quarter frames show the boots passing on separate tracks. The close overlap in the side view appears to be projection; I do not see an obvious crossing or mesh intersection in the reviewed views. This is not a whole-cycle mesh-collision proof.

**Recommendation: advance this candidate as the leg-animation repair.** Remaining visible limitations are the bulky boot silhouette and a relatively flat/stiff planted-foot-to-toe-off transition. A clearer ankle/sole roll could improve weight transfer later. The result reads as a stylized short-character jog, not photoreal human locomotion. These studio images alone do not establish terrain, transition or slope acceptance; the separate runtime checks cover those concerns.

No asset, runtime, Blender or GPU changes were made by this reviewer.
