# Near column grain and shallow sign cuts

The actual f630/561 images expose two local material weaknesses: A's left emergent trunk is almost uniformly olive despite existing bark detail, and the sign's readable markings still look like ink. This checkpoint tests two small material changes after reconciling Fable's published 1cc8f51 ancestry. It adds no geometry or texture resources.

## Column bark

The emergent trunk at `(-2.7, -7.9)` is instanced, so f630's non-instanced giant improvement did not affect it. Its displaced bole, normals and metre-scaled bark UVs already contain detail. At the sampled A surface the old shaded floor is about 94% flat albedo; a larger normal scale cannot restore contrast cancelled by that floor.

Only near instanced bark now multiplies its floor albedo by a bounded neutral grain response from the existing filtered map sample. The stable linear map median is 0.2581; the sample ratio is clamped to 0.65–1.35 and mixed at 0.60 strength. The resulting factor stays within 0.79–1.21, with full effect through 18 m and a smooth return to the original response by 24 m. Both `USE_INSTANCING` and `USE_MAP` are required. No extra texture lookup, sampler, uniform or draw is introduced; the program key identifies the changed shader.

In 728 static wood rays, the approximate texture footprint remains around mip 4 and retains coarse fissures. The sampled floor-albedo proxy changes from p10/p50/p90 0.06317/0.06429/0.06564 to 0.05261/0.06462/0.07448: median +0.51%. This supports a brightness-preserving grain trial, not a predicted image. The calculation omits actual anisotropic filtering, procedural moss/tone, occlusion, HDR lighting, fog and post. Normal-response cancellation is deliberately left for a separate diagnosis.

F630's non-instanced giant treatment, white trees, leaves, global light and all shared floor presets remain unchanged. A/B/D near columns need actual review; the F giant and columns beyond 24 m are useful controls. Generated shader comparisons confirm the source boundary, but GPU recompilation can still cause small numerical image differences.

## Sign cuts

The f630 strokes keep their exact width, path positions, alpha and dark nominal groove bottom. Their encoded 0.45 mm V-profile uses normal scale 2.5 for an effective 1.125 mm shading depth across the existing 7.2–8.5 mm cuts. No displacement, parallax or new micro-shadow geometry is implied.

The glyph-only shade floor falls from lift 5.5 to 1.4 so its normal response can survive. Exposed side faces retain more wood albedo, up to sRGB 126/94/60 at the rim, around the retained 48/31/18 bottom. This tint is symmetric with depth; only actual light chooses a brighter face. Board wood, binding, shared materials, geometry, texture count and disposal remain unchanged.

A conditional Lambert/hemi/floor calculation using the real sign tangent basis finds full-key facet luminances 0.00831/0.01764, versus 0.01169/0.01184 before. At zero key both faces remain about 0.00831; no bright side is invented. At 25% key the directional difference is only 0.00040. Actual shadow visibility, IBL, point lights, AO, fog, alpha blending and post are excluded, so the real S01/S02 result can be modest. Legibility must remain intact.

## Merge and checks

The ancestry merge imports Fable's log, 66-entry append-only ledger, concept notes and adopted W25 evidence intact. Two equivalent conflicts take his normal-encoding explanation and semantic-id arrangement; all other source files merge to the current Astra implementation. This is an own-branch merge, not a PR2/main merge. PR2 comment 5646560839 records coordination; Fable keeps his active roof and foreground work.

Typecheck/build (107 modules), source anti-cheat (37 checks; historical claim warnings retained), and prepared material/geometry contracts pass. All sign geometry/RNG, 64 decal contacts, four peg seats, alpha and encoded normal-map bytes remain exact; owned resources still dispose once. Actual image acceptance is pending. The 64028c gain comparison remains pinned to its own source and controls; this later checkpoint does not rewrite that evidence.
