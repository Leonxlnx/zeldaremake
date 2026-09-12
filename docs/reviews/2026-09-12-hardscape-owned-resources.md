# Adopt Fable's corrected hardscape teardown

Merge0bd5235094211fd189d825b38393861d5def0abc onto1e97463582c6479e3624fa9c963b0aff2685fc85.
The rendering change from0bd is already present in Astra711, byte-identical. The only new
production diff is hardscape/index.ts, joints.ts and material.ts, exactly Fable's published
source. The merge conflict replaces Astra's old single flower hook with the complete owner
cleanup; that hook remains inside the guarded system disposer.

The first partner teardown d7f5e98 double-released helper geometry and omitted the owned AO
clone. Root reported actual disposal-event counts. Fable2f4415b corrected both: skip helper-
owned meshes during traversal and use a self-removing material listener for the AO clone.
The generated joint gap texture and its material/geometry are helper-owned and guarded;
shared source maps remain TextureLibrary-owned. No geometry, palette, light or shader change
is introduced by this cleanup.

[The pinned reproduction](fable-hardscape-disposal/README.md) proves both orderings, repeated
calls and unchanged rendering inputs on actual published source. Astra's alternate scratch
patch was not applied. This is maintenance needed for rebuilds and later local iteration,
not a claimed visible improvement. Typecheck/build and exact source/hash boundaries are the
integration gate; actual archive continuity is checked separately on the published source.

## Actual660 result

Source660dcac756f9095fa6b3b9c08ccd646d2bf5f499; successful environment34710805539.
[12 world originals](https://github.com/Leonxlnx/zeldaremake/tree/a00abe5e482fe23e2a4c712a296ef6c5d351b991/progress/2026-09-12_182839773-660dcac)
and [four details](https://github.com/Leonxlnx/zeldaremake/tree/a9b5e6c5a0da1554e3ba3fee43a763ee58cbd2ec/details/2026-09-12_183130537-660dcac).
All16 accepted JPEG/depth bytes, geometry, resources, audits, controls and submitted budgets
are exactly1e. Source identity, archive history, eight previews and ZIP bytes pass. There is
no new visual result to rejudge; prior1e findings remain. One permitted unchanged-state
blank-buffer retry occurred at E candidate; other15zero, with no final errors/warnings.
This corrects an early helper report that incorrectly counted zero world retries. Original
reports/images are retained unchanged. The cleanup introduces no visible regression.
