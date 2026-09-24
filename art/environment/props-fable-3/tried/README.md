# Tried and reverted — lane 9

## Rust on the iron via the weathering pass (2026-09-24 17:20, `6d7e02d0` reverted)

Rubric #20 "nothing looks brand-new": the barrel and bucket hoops and the crates' nail heads were painted clean grey.
A rust lerp in `weather()` (mottled, heavier in the damp and along each hoop's lower edge) changed 4 px at the plateau
barrel at 2.5 m; a second pass with a tint landing on ≈ 0x9f4f2b at full weight and the weight to 0.9 changed 10 px.
`rust-on-iron-no-read.jpg` is the second. The reason: the iron material is dark (0x6e6357, metalness 0.3) and the hoops
stand in the plateau's shade, so the surface renders near-black and a vertex-colour *multiplier* has nothing to lift —
rust that reads must be lighter than the metal, which means the iron material itself (a paler, less metallic base, or an
emissive-free rust map), a look change across every hoop in the village. Not done on my own; offered to fable-cursor.
