# Ordinary fern Medium/Low shoulders — recovered source trial

Only ordinary fern Medium and Low leaf shoulders change. Existing x/z positions move toward station0.86 with an envelope-weighted spread up to1.4. High is left exactly unchanged. No vertices, indices, colors, UVs, frond axes, y coordinates, RNG calls, plant roots, density, material or wind settings are added or changed. Normals are recomputed by the existing MeshBuilder finish step. Hero ferns and every other plant family remain unchanged.

## Recovery and validation status

The execution environment disconnected during publication of local commit7cc0793. The intended28-file tree522e6865a0c1eabc0e24e0cb197b1d95b263d415 was not found on GitHub. This is a smaller recovery publication on parentc5d8c834a53f73edef8d3f7a2dcc67b752bce558; it does not claim to be that complete local tree.

The production file was reconstructed from the pinned c5 source and the exact visible local diff. Independently recomputed SHA256 values match both previously recorded sources:

- Baseline plantgeo.ts: c83af546fc05cd063871d171a233b07f67570e01c9d411a5ce78adf8700acc20.
- Recovered plantgeo.ts: d0a4d93989686a40dead764f84deb6503225f974c53f64841d95272df942b82d.

This exact production candidate passed local typecheck/build (112 modules) before the disconnect. No new local build or render is claimed after the disconnect. The existing branch CI must now independently build/capture it. recovery.json retains the exact unique replacement context and source pins.

## Preserved observations, with evidence availability explicit

Earlier source studies are summarized here from the completed session; their full JSON receipts were in the interrupted local publication and are NOT included or newly reproduced here. Recover docs/reviews/ordinary-fern-profile/ from the original workspace if it reconnects; do not overwrite or pretend to recreate those original receipts.

The first unrestricted widening was rejected for closing leaf gaps. A corrected all-LOD proposal still closed51 of560 formerly positive High gaps at the outer85% sampled cross-section, plus seven small gaps at the middle55% section; it remained HOLD. The selected candidate leaves all four High variants original and takes only the already checked Medium/Low profiles. The source comparison found eight Medium/Low variants exact to the corrected proposal, with no new profile tuning. Removing the unreachable High ternary arm below the guard produced the final hash above.

The completed static study found all sampled positive Medium/Low gaps preserved at35/55/85% top-projected cross-sections, with392 Medium and160 Low middle-section gaps above2mm. Leaf area grew about30%/28%, maximum shoulder motion about8/10cm, while local AABBs and y values stayed exact. Selected terrain samples introduced no new penetration, with a minimum observed leaf clearance around3.8cm. This was not wind simulation or an all-angle intersection guarantee.

Existing F instances934/938/969 had median projected pinna widths1.01/1.05/.95 →1.30/1.30/1.22px. These are source projections, not confirmed visible leaf pixels. All996 ordinary and18 hero placements were unchanged. Do not treat these unavailable full receipts as a new independently rerun test.

## Actual acceptance remains open

Compare original A/F bank images against c5. Require clearer paired fronds without crowded spoon-shaped leaves, missing plants or a conspicuously worse distance change. D and near views are controls. Reject a merely different fine carpet. High and Medium retain different profiles and inherited skeleton/RNG differences; no seamless continuous transition is claimed.

Check unrelated full runtime states, actors, resources, geometry counts and submissions strictly. Changed leaf positions/normals can change depth and shading, so record those changes rather than claiming image equality. The existing eleven hedge frames are a regression check, not a fern continuity test. No lighting/density compensation, new rubric threshold, FPS or phase-exit claim.

A separate read-only study declined direct reuse of hedge veins: fern materials are kind plant, the option is bush-only, fern builders lack the leaf/stem mask, and four diagonal vein cycles per pinna are poorly suited to these small leaves. No fern material patch is bundled.
