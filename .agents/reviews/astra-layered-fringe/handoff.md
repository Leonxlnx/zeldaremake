# Astra layered fringe — integration handoff

Baseline 9a317b873eae4a036e0ad179027201fdfdb217c1. Candidate is isolated; no production source or agent log was edited, committed, or pushed by this subtask. Root authorized the 12-lock proposal and then the coherent root-section release after the first real fold.

## Apply narrowly

- Replace `src/world/character/fringe-geometry.ts` with the candidate file (SHA256 `7bfb8e8f806a6de51162436a5e7e87908625a5b378a5e1ac14db733a2b9d9b6c`).
- In `buildHair`, append `createLinkFringeLocks(r, 'interleaves')` immediately AFTER `createLinkUnderEarHair(r)`; existing `createLinkFringeLocks(r)` now produces the eight new sweeps. Preserve the root's new visible-jaw call and any unrelated Link edits. Candidate full Link SHA `48fb091094b98b0b98635ec83db8b65fdea7317b24a17bec0b68a1ad01f42afc` describes the older base plus this append, not the composed jaw source.
- `fringe.patch` contains exactly those two edits, SHA256 `3f2710ee81bc81b18f028384c2c6d4bc6eef02fbe34ba70d8977f6166571ed64`.

Three shallow leading sweeps, five support locks, and four fine interleaves use the approved unequal paths, half widths, depth and fullness maxima. Closed lens sections retain actual volume. Centerline frames come from the final path derivative. The two temple locks retain their old final four rings/fan, with an unchanged adjacent ring preserving their computed end normals.

The initial exact root-ring geometry constraint was our implementation choice. Direct sweeps now retain all eight root centre positions but refit their root sections to the actual unchanged skull carrier. The scalp, nape, connected foundation, sideburns, under-ear locks, cap and palette are unchanged. Fine charts are appended at22–25, so all protected chart IDs and texture origins remain fixed.

## Checks that passed

Final isolated overlay typecheck has zero diagnostics. Final geometry review confirms:

- Hair charts22→26; vertices8912→10264 (+1352); triangles17736→20424 (+2688). Same single hair mesh/material/draw.
- All72 other meshes and286 geometry arrays exact, with mesh transforms and shadow flags unchanged.
- All protected hair chart position/normal/UV/index arrays exact:0–5 and14–21. Eight root centres exact;98 temple end position/normal vertices exact.
- Each of the12 changed locks is a closed consistently wound indexed manifold with positive signed volume and no zero-area triangle. Complete nonadjacent triangle checks found no self-crossing (9391 AABB-overlapping nonadjacent pairs evaluated, no nonzero-area faces omitted).
- All12 roots have a real nonzero-length triangle intersection with the unchanged foundation. Shortest retained witness segment .2729085mm; root0 additionally has a1.10267mm segment despite its selected interior sample lying outside the foundation. A buried point alone is not the evidence for that root.
- Nine actual blink scales1,.85,.7,.5838095,.5,.35,.2,.12,.08, full changed-fringe versus actual head/eye meshes: skull minimum .2166219mm; eyelid12.0614573mm; brow6.3623845mm; eye-white21.2775080mm; lashes19.6141714mm. Ears are included in the skull mesh. Both sides are checked at every blink state.
- Seated full cap clearances: crown15.775098mm; brim12.203341mm; brim stitches16.962157mm; tail137.719864mm; tail stitches239.600387mm.

Physical contact, attachment and self-crossing reports were produced on snapshot02 (the final shape before normal finishing). Final `normal-finish-review.mjs` proves every hair position, UV and index byte identical to that exact snapshot, so the shape/contact evidence carries over without rerunning unchanged geometry. It confirms only39 normals changed; their minimum incident-face dot is .0535344518. All changed/unprotected corners are outward. The two unchanged old temple fan tips retain four previously existing slightly negative corner dots (worst−.025286); these are identified, not presented as newly fixed.

The normal finisher uses the finite spherical angular centre of actual incident face normals only where area-weighted smoothing points through a face. It rejects a nonpositive maximum margin. This follows the successful shape/self-crossing checks; it is not used to conceal the earlier root fold. No shader or material was changed.

## Preserved failures and limits

- `snapshot01`: preserving the original first root rings and blending rapidly into the shallow new paths caused real self-crossing: lock4 faces107/153, lock5 faces72/24. New incident normal minimum−.999318. Baseline bounded ring3–8 checks had no crossing. The source, normal diagnostics and witnesses remain intact.
- `snapshot02/normal-unit-weight-failure.json`: simple unit-face averaging still gave−.081406 at lock0 terminal side vertex324. The subsequent finite maximum-margin normal centre has positive margins for every repaired vertex.
- `snapshot03-normal-buffer-alias`: the first implementation accidentally reused one temporary face-normal object. Final normal-buffer verification caught1947 changed normals and an opposing corner before integration. Cloning each stored face normal fixed the implementation; final replay gives39 changes and positive repaired corners. No gate was weakened.
- Three planned layer pairs are actually separated:2/5=7.183109mm,5/9=9.066406mm,0/6=1.955093mm. Seven other planned pairs intersect. Every lock independently attaches to the foundation. These separated pairs are visual limitations for capture review, not hidden or asserted as overlaps.
- No rendered acceptance, all-pose/swept clearance proof, changed-jaw composition result, or claim of reference-level completion. Hair cap geometry only received seated checks; the fringe moves rigidly with the head.

## Replay and next step

`loader.mjs` uses the frozen9a317b baseline source under `baseline/src/`, with only the two candidate files overlaid. To reconstruct that baseline after scratch loss, extract `git archive 9a317b873eae4a036e0ad179027201fdfdb217c1 src` into this candidate's `baseline/` directory. Keep the snapshot02 source files for the normal-only equivalence replay.

From repository root run:

```
node gauntlet/tmp/layered-fringe-candidate/typecheck.mjs
node gauntlet/tmp/layered-fringe-candidate/geometry-review.mjs
node gauntlet/tmp/layered-fringe-candidate/normal-finish-review.mjs
```

The named contact, cap-contact, attachment and self-crossing review scripts can replay their respective gates; no optional repetition is needed before integration. Root should run the newer visible-jaw skull versus final fringe check when composing, then required build/static-batch gates and actual06/12/17/18 capture. Judge shallow silhouette, brow coverage, and separated pairs in those actual images.
