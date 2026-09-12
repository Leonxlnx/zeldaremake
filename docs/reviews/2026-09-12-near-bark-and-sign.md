# Near giant bark and visible sign grooves

This follow-up starts fromccc7e7f5eff6aa5da1e268ac1bb00bf565f19378. Its top-flight light capture is independently in progress; that source is not changed by this work. The next build retains the same off/on canopy comparison, and must also be compared with the previous matching column to isolate the material changes across sources.

## What the actual prop captures showed

All12 world files and4 closeups fromd7ddc01 are published and verified. The complete source/camera/time/control/image checks pass; final errors/warnings/retries are zero. Its12 comparison files contain10 distinct images because B/E cameras coincide. Actual maximum650 draws, B/E9,069,946 submitted triangles: the active performance shortfall remains explicit. Galleries:

- https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/progress/2026-09-12_135434689-d7ddc01
- https://github.com/Leonxlnx/zeldaremake/tree/captures/astra-environment/details/2026-09-12_135720556-d7ddc01

Root and capture helper personally reviewed all four closeups. Rope strands and binding valleys read better and remain seated. Sign wood grain separates from the backdrop, but the new narrow glyphs almost disappear, particularly in S02. This was a partial improvement with a legibility failure.

The sign follow-up changes only generated cut width and colour in signMaterials.ts. Nominal stroke width2.7–3.38 becomes4.2–4.92 pixels at512; the actual saved S02 projection therefore grows from1.37–1.71 to2.13–2.50 pixels. Dark core/rim sRGB values change from94/64/37 and119/84/49 to48/31/18 and70/47/27. Existing angular paths, taper,11/8 centers, maximum0.45mm shallow groove depth, wood/binding materials, light/shadow settings and disposal stay intact. Opaque generated core median linear albedo drops from0.07550 to0.02218. Geometry remains1,279 triangles/1,530 vertices/3 meshes; RNG,64 rune contacts, four peg seats and borrowed texture ownership are exact. This predicts a stronger mark; only the next GPU capture can accept it.

## Near giant bark trial

Fable explicitly released trees/materials.ts in PR2comment5646342247. Actual18e CPU wood rays distinguish F's right stair-bank giant at12.42–12.54m from A's flat left instanced column at16.12–16.21m and its overhead structures sleeve at11.01–12.39m. The latter two are separate surfaces; this trial does not claim to repair them. The same stair-bank giant is17.62–18.03m from C; C's central giants are24.91–33.46m away.

Existing giant geometry already has gnarled trunks, fissure displacement, crevice vertex tint, metre-scaled UVs, a1K bark PBR set and normal strength1.6. Its indirect shade floor keeps only25% of the actual textured albedo; the rest is a flat mean. Rather than adding geometry or global contrast, the giant bark fragment admits60% texture within12m and smoothly returns to25% by18m. It is gated out for instanced columns. Lift7, tint, shared presets, foliage, normal maps, lichen fade, house/sleeve materials and geometry are unchanged. The giant shader receives a distinct program cache key.

The actual generated white-tree shader/vertex/uniforms compare byte-for-byte equal. Giant vertex/uniforms remain equal, and the fragment differs only in the local bark-floor texture weight. Evaluating that scalar expression gives0.5950951 at12.42m,0.425 at15m,0.25403384 at17.62m and exactly0.25 at18m and beyond. The instanced branch uses the unchanged0.25 uniform. These CPU shader checks do not compile GLSL on a GPU or prove appearance.

Typecheck and focused sign/texture/lifecycle contracts pass. Production build (106 modules) also passes; actual complete-scene captures remain the appearance check. Judge F's right trunk for coherent fissures rather than noisy speckle, keeping A's column/sleeve and C's far trunks as controls. No new triangles, texture resources or draw calls are expected from either material-only change. The pending Fable foreground pass and hedge packing proposal are not integrated here.
