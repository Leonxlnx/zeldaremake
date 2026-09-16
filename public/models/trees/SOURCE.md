# Original root-base placement prototype

Status: integration test asset, not an approved world replacement or completed kit.

File: root-base-a-prototype.glb
SHA256: a57c6dd30307b51926e3ef4ce0ef0ffefe02acecdf97114be5715fd524861f41
11,841,308 bytes; one mesh/primitive/material; 9,408 triangles; three embedded 2048px PBR images. No animation or skin. Standard glTF Y-up, nominal local bole radius1m, open collar at y2.365m. Root tips extend beyond the nominal bole; the ground ring is slightly below zero.

Geometry and moss shader are original Astra work. Bark is Poly Haven bark_brown_02, CC0: https://polyhaven.com/a/bark_brown_02 . Original2Kdownload URLs/checksums and licence are in the review source folder. Baked colour, tangent normal and roughness derive from that bark and original procedural moss; no reference-image pixels are used.

Fit to TrunkSeat: transform local height h to the desired scale, centre each ring using axisAt(h), and fit the unit-radius collar to radiusAt(h). Preserve the radial root protrusion beyond radius1; do not clamp all vertices to the bole. Terrain-seat the lower surface using the project's heightfield. Recompute normals/tangents after any vertex warp. Hide/remove the old overlapping root skirt for matched comparisons. Root scale must be reviewed on both1.1m and1.7–2.2m boles. No adapter is included yet.

Known limitations: one prototype, not the requested3–4 variants; no terrain-fit or game-performance acceptance; some bark-flow and moss realism remain weaker than the reference. Mesh and texture cost require review in the real scene. Keep Fable's procedural fallback. Native packed editable source and before/after/GLB roundtrip renders accompany the review; the upper-bole/floor/lights are review fixtures excluded from the GLB.
