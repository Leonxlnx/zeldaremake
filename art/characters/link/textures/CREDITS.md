# Character material sources

`original-iris-teal-v1.png` is an original iris albedo generated with the built-in
image_gen tool on 2026-09-14 for the Blender character material. Its exact prompt,
SHA256 and source path are recorded in `original-iris-teal-v1.json`. It has not yet
been adopted in the delivered runtime. This texture is separate from the CC0 scans below.

Geometry and skin tint are original. The ten owner reference images are visual comparison
material only; none is used as a texture. These maps are CC0 according to
[Poly Haven's asset license](https://polyhaven.com/license), checked 2026-09-13.

- `leather-color.jpg`, `leather-roughness.jpg`, `leather-height.png`: 1K maps from
  [Fabric Leather 01](https://polyhaven.com/a/fabric_leather_01). Diffuse, Rough and
  Displacement downloads verified against the API's MD5 records before use.
- `cloth-roughness.jpg`, `cloth-normal.jpg`: 1K maps from
  [Fabric Pattern 05](https://polyhaven.com/a/fabric_pattern_05), Rob Tuytel.
  Download hashes verified. The roughness and tangent-space normal scans are applied
  on cloth UVs; the green dye variation is procedural. The plaid
  colour maps are not used: the green base colour is authored locally.
- Shield wood reuses `public/textures/weathered_planks/color.jpg` and `roughness.jpg`.
  Its original source/credit is in `public/textures/CREDITS.md`.

All used images are packed into `link-study.blend`. Procedural/triplanar shading needs
baking before a glTF export can reproduce the Blender render.

`../runtime/textures/` contains the original model's baked PBR atlases, derived from
these credited CC0 maps and locally authored shaders. No reference image is baked.
