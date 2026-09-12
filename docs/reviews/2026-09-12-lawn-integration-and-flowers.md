# Dense lawn integration and corrected white flowers

Deliberate ancestry merge of Fable 87d3f310639834815c590b78380dc30dc188d3d3 (rendered lawn
source 612872691c51949655102bf9e60361ec33039fb2) into Astra grass source 2c4a8c0. Partner
log/take68 ledger and joints.ts are byte-exact. House sources remain unchanged from our prior
exact roof integration. Partner branch, PR and main remain untouched.

The lawn supplies low overlapping tufts and clover, four moss pads, a softer slab rim, fourteen
white flower heads and darker earth visible between the blades. Source cost is +74,996
hardscape triangles and one draw with zero new shadow-caster triangles. This is a construction
count; actual submitted world budgets and visual acceptance remain pending.

[The independent pinned review](fable-lawn-pocket/README.md) records exact paving/stair/fill
geometry and stable existing positions, but changed rotation/scale/tint for 3,365/3,899 outside
instances caused by shared packing RNG consumption. Fable accepted and owns the preservation
fix in PR2 comment 5647299363. The current merge preserves that source pending his correction;
it neither hides the scope drift nor globally reseeds the old scatter.

## Narrow original correction

Root announced flower ownership in PR2 5647299378 and clarified the single index hook in
5647304378. Heads squash Y by .72, so their lighting normals now follow the inverse transpose.
Stems use their actual leaned/rotated quad normal. Original sphere-based pigment variation
remains exact. The already nonindexed temporary sphere is released after use.

The flower factory returns an idempotent disposer owning only the merged geometry and its
material. The system delegates to it through flowers.dispose(). No existing material, borrowed
texture, light, wind, shadow setting, random draw, position, color, index or triangle changes.
This is an explicit two-file exception to exact partner source adoption. Older hardscape
resource cleanup is outside this narrow correction.

The pinned CPU overlay checks 54 unchanged geometry buffers, eight existing instance buffers,
full audits, material/shadow settings and following RNG values. Fourteen heads remain 1,148
triangles. Corrected normal length error is at most 3.13e-8, head angular error .00000242
degrees and stem error .003906 degrees against Float32 geometry. Repeated system/factory
disposal releases owned flower geometry/material once; all old/borrowed resources are untouched.
The temporary sphere is released once and its redundant toNonIndexed warning disappears.

Typecheck/build (109 modules) and exact integration boundaries pass. Actual captures remain
required; mathematically correct normals do not by themselves establish visible improvement
in heads only 4-9 pixels across.

Frozen corrected flowers.ts SHA256:
5945e0b6055afd41927001ea17c9d4228e8b4971609f5b32c5abdc7978bf7f93.
Frozen corrected hardscape/index.ts SHA256:
9972f2d842e2af306b8d5eb1dcbfdd92950a67b01cb21c3004c4dacdd01bb155.

A fresh independent [W25 take68 cross-review](fable-take-0068/W25.md) preserves the cap/bough
gains while recording remaining roof/eave/doorway proportion mismatches. Original comparison
bytes and provenance are preserved. The formal fail record retains prior history and does not
edit historical scores, ledger or rubric, nor judge Astra's different lighting.

Source anti-cheat: 11 passes, 28 historical claim warnings, zero failures;
68-entry ledger chain and locked rubric remain intact.

## Actual9eb outcome — coverage gain, unfinished shading

Source9eb9debc31c3b8dec579d75e9315ec6322c217bd / tree
6bd9595d5e0e1d5cf1a2ba2adbf26992471aa184 rendered successfully in run34706953750.
[12 world images](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/progress/2026-09-12_171347161-9eb9deb),
[4 details](https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/details/2026-09-12_171634744-9eb9deb).
Root reviewed B/L02 originals; helper reviewed all five distinct world views and four details.
The pocket is denser and small pale heads are visible, but near-black jagged tufts form a heavy
band over olive/yellow earth. This remains a significant shading/shape weakness. The separate
vegetation grass correction does not affect hardscape sprouts. Outside jitter changes are
also visible and are addressed by Fable's subsequent c4b9578 source, not silently ignored.

All16 source/image/camera/control checks and original ZIP/history receipts pass; no retry,
console warning or error. All non-hardscape audits and lighting/atmosphere/character/layout
controls match2c. Scene cost is exactly +74,996 triangles, +1 mesh/material/unique geometry,
+1,468 instances; textures70/programs74 unchanged. Actual submissions add73,848 for packed
sprouts, plus1,148/one call where flowers are visible (A/B/C/D/E/L02). Maximum B/E is
8,716,124 submitted triangles/651calls; A has maximum660calls. These are multi-pass counts,
not hardware FPS. Source reconstruction matches199 Git inputs; original built dist bytes
were not downloaded for an independent rehash. No separate visible flower-normal verdict.
