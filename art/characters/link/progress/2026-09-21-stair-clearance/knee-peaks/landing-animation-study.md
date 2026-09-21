# Bounded future landing and pelvis study

**Neither proposal is approved for production.** Selecting a nearby same-tread seat through `footConfig` improves some landing poses and the existing root prediction follows it, but the exact full-sole check reveals new intersections. Peak knee folds remain unchanged in the corrected proposal. No production source was written, no stride changed, and neither rejected swing pulse was used.

The frozen control is `landing-control-source.ts`, normalized SHA `7dd583ca957f3b95faa3aa9d117f998f564611c37898a0935e15921e7fb33085`: the applied dense planner/root-cap change plus the **provisional** oriented swing-foot support from `curved_support`, without its subsequently developed dense hip-rotation predicate. All three runs use e3ef, exactly preserved X/Z and clip phases, actual outward log geometry, all327 production sole vertices over940 steady frames, eight additional native-ray markers/frame, and14 zero-dt repeats. Exact triangle queries use `exact-mesh-height.mjs`, independently verified against836 native rays to2.7e−15 m.

| Result | Paired control | Initial local preference | Correct physical level |
|---|---:|---:|---:|
| Peak knee up/down |174.67° /166.82°|177.19° /177.19°|174.67° /166.82°|
| Root step maximum up/down |31.11 /23.89 mm|29.82 /57.53 mm|31.32 /24.19 mm|
| Full-sole worst up/down |−1.948 /+2.065 mm|−0.201 /−26.809 mm|−0.201 /−26.809 mm|
| Meaningful reach-clamped frames |0|3|0|
| Maximum support samples up/down |3961 /4158|20501 /20403|21731 /21676|
| Changed actual pins up/down |0 /0|6 /5|5 /4|

Flat idle/walk/run skeleton hashes, exact phase and stance timing match the control in both proposals. Each proposal's14 repeated zero-dt poses leave its own root, soles and pins exactly unchanged. Existing stance pin coordinates are never reassigned. The corrected proposal retains the control's9.135 mm maximum ascent planted drift; descent increases from1.25 μm to1.85 μm. Its root Y can differ by63.2 mm from the control because the selected tread seat is lower than a crown. There is no evidence here of a solved maximum-knee problem.

## What the two trials establish

The first selector scanned future, unplaced `cfgLand`/first-stance footprints within the existing `footConfig` span. It required a nearby flatter footprint on what it assumed was the same analytic tread; it then fed the selected shift/support into the existing swing/root/ATTACK calculations. The footprint criterion was ≤20 mm height spread. Existing placed pins and take-off queries were excluded.

That first same-tread assumption is invalid under a protruding nosing. For ascent landing232, the rendered support reaches2.506 m (tread2.43 m plus crown) while the analytic height under the entire original footprint is2.16 m. The selector wrongly chooses lower2.16 m stone, moving the intended support down a full step. Descent212 has the same problem (rendered3.844 m over analytic3.51 m). This produces a334 mm maximum body-height difference, a57.5 mm root step, new reach clamps, and new contact failures. **The initial proposal is rejected.** The evidence does not establish a separate lead-table bug.

The second selector identifies the intended local analytic level nearest the rendered support, considering the levels already reachable at the existing scan extremes. It rejects a flat seat on another physical level. This removes both wrong-step choices and all reach clamps. The source transform is `patchLandingPreference(source,{renderedLevel:true})`; the actual output SHA is `6e06908043d5fea9f930133203e336173f24300d0a7feac874bc5ecd69493680`.

Five ascent landings move approximately60,70,60,90,100 mm; their landing knees improve from≈128° to103°,99°,103°,92°,88°. Four descent pins move approximately−30,−40,−40,−20 mm relative to travel. At those actual pins the already-existing root support prediction lowers the body by50,51,56,27 mm. The landing knees become39°,42°,42°,35°, compared with≈25° before. No additional body-lift or ankle pulse is added. The predicted-root path itself supplies the necessary descent; this trial does not increase the existing maximum ATTACK drop.

The true geometry survey finds crown-touching pins fall13→10 uphill and16→13 downhill. Three of the nine moved pins still touch a little timber. A height-support grid's flatness test is therefore not proof that a whole boot rests on flat stone. Deep stone seams also explain why some true ray spreads exceed20 mm even where the boot bridges them.

The corrected candidate still introduces ascent364−0.201 mm and descent426−26.809 mm full-sole gaps. The latter is invisible to the old eight-marker minimum, which stays positive in the corrected candidate. The control's isolated ascent184−1.948 mm gap was shared with `curved_support`; that agent is separately extending the existing hip-rotation guard to the dense oriented sole plane. These placement results are **not** a pass against that later contact fix. Its source must be composed and tested as a new exact pair before changing the scope of this conclusion.

## Recommendation

The narrow viable mechanism to pursue is future seat selection inside `footConfig`, with the selected physical tread preserved and the existing root prediction evaluated before pin acquisition. The static two-leg reach study in `landing-root-feasibility.json` supports that mechanism; the corrected animated trial confirms local landing-pose improvements without a new root framework. However, this implementation is held because contact, whole-boot seat classification and cost remain unsatisfactory. It increases worst-frame surface calls by roughly5×, and its maximum knees are unchanged.

Do not adopt this selector or revive the rejected post-IK swing pulses. Preserve the currently reviewed production path until a new paired trial against the final dense contact guard passes true327-vertex contact, actual pin support and native motion review. The extreme stair poses still require a physically continuous foot path/body reach solution beyond the local seats available here.

Reproduction uses `stair-swing-diagnostic.mjs` with `--working-source --source-file=.../knee-peaks/landing-control-source.ts --with-logs --full-sole --landing-survey --knee-peaks --zero-dt-check`, the exact e3ef/phase/motion-input files in this lane, and a distinct output directory. Add `--landing-preference` for the first candidate; add `--rendered-landing-level` for the corrected one. Run `compare-landings.mjs --candidate=<directory>` for the report. The geometry-only survey supports `--input=<directory> --output=<unique-name.json>` so earlier negative evidence is preserved.
