# Preserve existing joint plants when adding lawn

Deliberate ancestry merge of Fable cee9888d735dfa957007a13af2bc267e6457d452 into
Astra09b4143. Its parent c4b95781a19fe282f3f3bfbc7d61bd9b93854ec3 separates instance
rotation, scale and tint streams by scatter source and semantic variant. The old single
traversal stream made a larger lawn reroll unrelated joint plants, cushions and grit.
Fable explicitly handed over the subsequent tuft shading pass in PR2 comment5647471072.

Twenty-five legacy source/variant pairs replay the recorded round12 stream offsets;
new scatters receive independent forks. The shared builder's optional jitter callback
preserves the prior behavior for callers without it, including boulder plants. Source
labels do not alter placement generation. Appending/removing another source no longer
shifts a source's random instance transforms and colors. This does not promise stability
for arbitrary reordering/removal within the same source and variant.

Independent CPU reconstruction confirms all4275 old spots remain and4225 matrices/colors
are byte-exact against77dd665. The50 changed pairs belong exactly to the deliberately
capped pocket-scatter TUFT_B-to-TUFT_A conversion; eight additional size clamps within
TUFT_A retain their old matrices/colors. All5742 current spots match612 apart from their
new source labels. Legacy appearance preservation is established for the existing seed,
layout and density1, not every possible quality density or changed placement algorithm.

Production sprouts.ts, sprout-jitter.ts and flowers.ts match cee exactly. Hardscape index
retains only Astra's already published flowers.dispose() system hook beyond partner
bytes; Fable's file does not yet call the new guarded disposer. The flower geometry,
normal correction and owned resources are unchanged. Broader hardscape cleanup is still
a documented follow-up. Original W25 take68 evidence is imported through partner ancestry;
the existing formal review history remains exact.

This checkpoint also restores exact9eb trees/corridors.ts after the09b canopy trial failed
its predeclared visual gate. No other tree source or global lighting parameter changes.
The new shared-tuft lighting candidate remains in scratch for separate verification and
publication; keeping it out makes the subsequent actual lighting comparison unambiguous.

Typecheck/build pass (110 modules). The exact production boundary is independently checked.
Actual screenshots are required to confirm restored outside-instance appearance and scene
budgets; this source review is not a rendered turf-quality verdict.

[The pinned reproducer and evidence](fable-sprout-jitter/README.md) also reproduce all25
legacy offsets from86,903 sowing draws. Removing each of13 complete sources, appending to
each of32 populated pairs, adding a new source before old ones, and changing pack order
leave other instances exact. All30 boulder instances are exact without the option. Active
legacy stream replay adds2,457,311 construction-time RNG draws, with no per-frame RNG work.
Each pair has isolated state, but ranges of the same legacy numeric sequence can overlap
when greatly expanded; this is not a statistical independence claim.

## Actualdebe — retained preservation, turf still unfinished

Published source debe21530c9085bf67ec2b25586a2d13ba61889b, tree
b3412315d8feb093bc8803b3345d139b04031cbc, parents09b + cee.
[12 actual world images](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/progress/2026-09-12_174331955-debe215)
and [4 details](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/details/2026-09-12_174544074-debe215).
All16 source/bytes/camera/control/ZIP/history checks pass with zero retry/error/warning.
Root viewed original B/L02; helper reviewed all five distinct world views and four details.
The broad rejected canopy shade is gone. B/L02 still have the dark jagged lawn, so this
checkpoint claims preserved instances, not a turf-shading improvement. Both F JPEGs and
depth hashes are byte-exact to the pre-lawn2c source, providing an actual outside-instance
restoration check; other views correctly retain new lawn differences. S01 is exact9eb.

Geometry inventory/resources/draws/triangles match9eb; programs74/textures70. Peak B/E is
8,716,124 submitted triangles/651calls, maximum calls660 in A. Global lighting/camera
controls and non-hardscape audits remain fixed. This is static evidence, not hardware FPS
or a moving-camera result. The subsequent711 tuft source is the independent lighting trial.
