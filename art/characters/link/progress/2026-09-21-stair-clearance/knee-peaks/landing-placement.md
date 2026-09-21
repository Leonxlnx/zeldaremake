# Can existing landing placement keep the whole boot off timber crowns?

Yes for a limited subset, but it cannot remove the two worst knee cases within the existing local placement search. A new post-IK displacement is not proposed.

This survey uses the provisional/applied dense curved-support planner with its upper vertical-correction cap removed, source SHA `e17353aa9228d0824b31aca00a583d275baa60609e7ed777d582cf70eecbcacb`, e3ef asset, unchanged world X/Z trace and exact clip phases. It counts the actual acquisition of a finite stance pin after frame120, not every stance frame. Each foot includes all skinned meshes, dominant ankle influence and the production12 mm sole band: **163 L /164 R vertices**, exactly matching `LinkAssetInfo.footprint`. A conservative convex sole interior is also sampled at1 cm. Correct outward log geometry is used.

The static geometry probe evaluates exact upward/front-facing triangles, accelerated by buckets containing triangle references rather than sampled heights. 836 independent native Three.js ray checks agree within2.7e−15 m. No production source is written. The complete results are `landing-placement-full-sole.json`; the initial5 mm-band survey is explicitly superseded.

| Actual pin acquisition | Ascent | Descent |
|---|---:|---:|
| Total |22|22|
| Sole marker over timber |8|12|
| Any actual full-sole vertex over timber |13|16|
| Crown footprint can move fully onto same-tread stone within existing scan span |5|4|
| Same, also requiring ≤20 mm exact surface-height spread |5|3|
| Crown footprint can move fully onto same-tread stone within ±300 mm |13|16|

The local scan is the existing `footConfig` span: `[-back-HEEL_MARGIN-SCAN_PAD, ahead+TOE_MARGIN+SCAN_PAD]`, evaluated using its actual footprint rectangle and yaw. It is approximately−110…+164 mm for this rig. This is a search extent, **not** an explicit universal displacement cap in the current code. Results do not claim these offsets are already emitted by `footConfig`.

Five ascent landings can clear the crown with a same-tread stone seat inside that span: L188 +60 mm, L276 +110 mm, L364 +100 mm, L452 +95 mm, L540 +100 mm (positive is travel direction). Their rigid-foot plane would be69–82 mm lower than the current crown placement; fixed-hip leg reach remains65–76% of chain length. The other crown landings need200–295 mm to become wholly stone-supported. Some of those seats cross stone seams where exact rays reach substantially lower faces, so their full ray height spread is not small.

Three descent landings meet the stricter local criterion: R168 −30 mm, R256 −40 mm, R344 −45 mm. Negative relative to descent is uphill, onto the flat behind the crown. Their sole plane drops57–72 mm; holding the current hip fixed would require106–109% leg reach. The existing predicted root-drop calculation would need29.8–43.2 mm of body descent. A late ankle shift cannot safely make this change. R432 can become stone-only at−15 mm, but spans a deep stone seam and fails the20 mm height-spread criterion. Other descent crown seats need140–275 mm for stone-only support.

The20 mm spread threshold is a conservative diagnostic choice. A boot can bridge a narrow stone seam, so failing that threshold is not proof that a tread is unusable. The separate stone-only counts keep this distinction visible. Both actual sole vertices and the convex interior give the same13/16 count of crown-touching original landings.

The existing rule assumes an upward edge immediately leads to usable tread. It permits the marker `EDGE_HANG=30 mm` behind that edge. A log instead occupies a band roughly160–200 mm deep; its crown remains ahead of that point and its rear shoulder is a gradual slope. The60 mm step threshold does not reliably identify the end of that rounded shoulder. For example ascent L188, L276 and L364 have `e=NaN` / no edge selected despite real crown contact. The newly correct dense support raises the planned foot onto the crown; it does not choose a flat landing.

The two maximum-knee contexts are outside the useful local subset:

- **Ascent331 R:** previous pin298 is on a crown and needs +235 mm to be wholly stone-supported; the next pin342 is already on flat stone. Local flat preference cannot remove that previous crown placement within the existing scan span.
- **Descent375 R:** previous pin344 has a feasible −45 mm stone shift with43.2 mm predicted root drop, but its next pin388 needs−265 mm, beyond the local span. Changing only the nearby previous pin is not a complete landing trajectory fix.

The smallest justified next experiment belongs in `footConfig` for **future, unplaced** landings: where its dense planned support is a rounded proud surface, prefer a reachable same-tread flat seat within its existing search, then pass the resulting shift/support/pitch through the current takeoff/landing blend and `ATTACK` root-drop prediction. Preserve `placed=true` stance anchors. Reuse the dense footprint samples; do not infer flatness from a center ray or a single detected edge. This would be a scoped landing-quality improvement. The data do not justify claiming that it will eliminate the44 mm root corrections or the maximum knees, and no full animation candidate was run in this survey.

Subsequent work is recorded separately in `landing-animation-study.md`: two bounded animated trials were run against an immutable provisional contact control. Both are held/rejected for production. The corrected physical-tread selector improves several landing poses, but adds full-sole intersections and leaves the peak knee folds unchanged. This static report remains evidence of instantaneous feasibility only.
