# Root-base placement prototype review

Asset public/models/trees/root-base-a-prototype.glb: a57c6dd30307b51926e3ef4ce0ef0ffefe02acecdf97114be5715fd524861f41.

Original Blender geometry, continuous bark mapping, patchy original moss shader; Poly Haven bark_brown_02 CC0 source textures. Downloaded original2Kfiles and verified their published MD5checksums; see texture-source.json and LICENSE.txt. Baked2Kcolour/normal/roughness into standard glTF PBR. One mesh/primitive/material,9408triangles,3embeddedimages,11.84MB. Export contract assertions pass. Re-imported GLB in Blender and inspected the roundtrip render against the native bake: material appearance retained. This is not a Three.js performance or in-world acceptance test.

Editable source: root-baked-study.blend. It includes review fixtures, hidden source objects and the procedural/baked materials. Export only root_base_a_baked with ExportUV. Fixture bole, floor, lights and camera are excluded from the GLB. Original local modelling/baking scripts live in art/trees/root-kit in Astra's primary workspace.

See public/models/trees/SOURCE.md for TrunkSeat attachment, terrain fitting and limitations. Request Fable to compare a small and large bole before distributing it. One prototype, additional variants pending. Bark flow, moss realism, root silhouette and texture/runtime cost still need in-game review. Typecheck/build pass; no runtime source code changed.
