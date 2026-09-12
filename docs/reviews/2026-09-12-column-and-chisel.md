# Near column grain and shallow sign cuts

The actual f630/561 images expose two local material weaknesses: A's left emergent trunk is almost uniformly olive despite existing bark detail, and the sign's readable markings still look like ink. This checkpoint tests two small material changes after reconciling Fable's published 1cc8f51 ancestry. It adds no geometry or texture resources.

## Actual d755 review — column activation failed

The immutable d755 world images at `progress/2026-09-12_150032336-d7552ee` do **not** show
column improvement: fixed A/B column regions and F/D trunk controls are pixel-identical to 640.
Installed Three 0.186.0 defines `USE_INSTANCING` only in the vertex prefix. The fragment `#if`
therefore removed the new grain path, and the older fragment `#ifndef` also applied the near
floor treatment to instanced columns. The intended scope and old CPU proxy below did not account
for this. They are historical design evidence, not evidence of the deployed shader behavior.

PR2 comment 5646701325 reports the defect. The follow-up explicitly distinguishes instanced
objects using the real installed program parameters and verifies both fragment gates. Its
actual image result will be recorded separately. No historical capture metadata is rewritten.

## Corrected tree program distinction

The follow-up takes the real per-object `shader.instancing` parameter passed to onBeforeCompile
and emits `TREE_BARK_INSTANCED` as 0/1 only for the giant bark fragment. Both bark gates use it.
The installed renderer already includes instancing in its program cache key; the material's
custom key also becomes `trees-giant-bark-instancing-v4`. No varying, uniform, map, geometry or
per-frame mutation is added. The original grain strength and distance fade are retained.

A scratch check runs installed WebGLPrograms.getParameters and cache-key generation on real
Mesh/InstancedMesh objects sharing the hooked material, then the installed WebGLProgram into a
no-op GL source sink and cpp preprocessing. It reproduces both old failures and verifies the
corrected mapped/unmapped branches, independent cache keys and stable column→giant→column order.
The ordinary-giant preprocessed fragment remains exact; white/depth expanded programs, vertex
shaders and uniforms remain exact. This is a real generated-source check, **not GPU compilation**.

Correcting the earlier 728-ray floor calculation matters: actual-old median is .059433,
corrected base .064292 and base plus grain .064622. Thus the full correction raises the A floor
proxy median **8.73%**, not the isolated-grain +0.51% below. For columns within 12 m, the same
dark albedos used only as a hypothetical envelope give a **49–57%** neutral floor lift when the
mistaken .60 texture weight returns to .25. B/D therefore need explicit actual brightness review;
no automatic retuning masks the old defect. These are CPU albedo proxies, not image predictions.

Patch SHA256: `743a71e9c42f562a33642cd69ddf9f46321e21025b25dfcc833bb2c18f41300e`.
Corrected material SHA256: `d36d899af7d0c70555731676990b80b71cbb0763dec7663255739daa3d790a0e`.

## Actual d41 correction review

The corrected branch now activates visibly in the actual A/B/F columns. Fixed historical
image rectangles versus d755 show display luminance +3.70% for A, +31.48% for B's near-left
trunk and +22.14% for D's mixed bark/lichen rectangle; these are image measurements, not the
CPU floor proxies above. B is noticeably lifted but still dark wood, and D retains readable
grained bark. The ordinary giant at F's far-right control rectangle is pixel-identical.
Root and the independent capture reviewer inspected all five distinct world views. Retain
this corrected response; actual images support improved grain without obvious pale washout.

## Column bark — intended trial, superseded activation assumption

The emergent trunk at `(-2.7, -7.9)` is instanced; the trial incorrectly assumed f630's fragment gate excluded it. Its displaced bole, normals and metre-scaled bark UVs already contain detail. At the sampled A surface the old shaded floor is about 94% flat albedo; a larger normal scale cannot restore contrast cancelled by that floor.

Only near instanced bark now multiplies its floor albedo by a bounded neutral grain response from the existing filtered map sample. The stable linear map median is 0.2581; the sample ratio is clamped to 0.65–1.35 and mixed at 0.60 strength. The resulting factor stays within 0.79–1.21, with full effect through 18 m and a smooth return to the original response by 24 m. Both `USE_INSTANCING` and `USE_MAP` are required. No extra texture lookup, sampler, uniform or draw is introduced; the program key identifies the changed shader.

In 728 static wood rays, the approximate texture footprint remains around mip 4 and retains coarse fissures. The sampled floor-albedo proxy changes from p10/p50/p90 0.06317/0.06429/0.06564 to 0.05261/0.06462/0.07448: median +0.51%. This supports a brightness-preserving grain trial, not a predicted image. The calculation omits actual anisotropic filtering, procedural moss/tone, occlusion, HDR lighting, fog and post. Normal-response cancellation is deliberately left for a separate diagnosis.

F630's non-instanced giant treatment, white trees, leaves, global light and all shared floor presets remain unchanged. A/B/D near columns need actual review; the F giant and columns beyond 24 m are useful controls. Generated shader comparisons confirm the source boundary, but GPU recompilation can still cause small numerical image differences.

## Sign cuts

The f630 strokes keep their exact width, path positions, alpha and dark nominal groove bottom. Their encoded 0.45 mm V-profile uses normal scale 2.5 for an effective 1.125 mm shading depth across the existing 7.2–8.5 mm cuts. No displacement, parallax or new micro-shadow geometry is implied.

The glyph-only shade floor falls from lift 5.5 to 1.4 so its normal response can survive. Exposed side faces retain more wood albedo, up to sRGB 126/94/60 at the rim, around the retained 48/31/18 bottom. This tint is symmetric with depth; only actual light chooses a brighter face. Board wood, binding, shared materials, geometry, texture count and disposal remain unchanged.

A conditional Lambert/hemi/floor calculation using the real sign tangent basis finds full-key facet luminances 0.00831/0.01764, versus 0.01169/0.01184 before. At zero key both faces remain about 0.00831; no bright side is invented. At 25% key the directional difference is only 0.00040. Actual shadow visibility, IBL, point lights, AO, fog, alpha blending and post are excluded, so the real S01/S02 result can be modest. Legibility must remain intact.

## Merge and checks

The ancestry merge imports Fable's log, 66-entry append-only ledger, concept notes and adopted W25 evidence intact. Two equivalent conflicts take his normal-encoding explanation and semantic-id arrangement; all other source files merge to the current Astra implementation. This is an own-branch merge, not a PR2/main merge. PR2 comment 5646560839 records coordination; Fable keeps his active roof and foreground work.

Typecheck/build (107 modules), source anti-cheat (37 checks; historical claim warnings retained), and prepared material/geometry contracts pass. All sign geometry/RNG, 64 decal contacts, four peg seats, alpha and encoded normal-map bytes remain exact; owned resources still dispose once. Actual d755 S01/S02 retain readability, but the chisel improvement is small and the cuts still look mostly ink-like. L01/L02 are byte-identical to 640. All 16 source/image/control contracts pass with zero retries and final errors/warnings; geometry/depth and renderer budgets remain exact. Root reviewed A/F and S01/S02. The 64028c gain comparison remains pinned to its own source and controls; this later checkpoint does not rewrite that evidence.
