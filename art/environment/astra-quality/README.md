# Environment quality iteration — Astra, 20 September 2026

The owner reprioritized environment quality: detailed stones, bark distinct from green moss, layered tree crowns and useful detail at distance. Character work is deferred. Ten original comparison targets are in `reference/owner-concepts/` (not scene assets).

## Baseline evidence

`before/` contains nineteen untouched native-renderer PNGs and the complete capture manifest. Source base: `ca562e76`; coordination HEAD: `50ed2466`; no source diff at capture start. High quality, 1280×720, simulation time12.6, fixed cameras, no visibility/material overrides. A_stairs reports8,595,330 triangles and566 calls. This daylight survey is not an official gauntlet take or a frame-rate result.

Two earlier capture attempts failed at the helper's180-second timeout. The helper now uses the existing READY_TIMEOUT_MS for the ready waits and CDP timeout. The completed baseline had zero page errors. Failed attempt manifests remain locally preserved.

## Candidate changes being verified

- Astra stones (`91c15407`): align near AO with the enlarged texture tile; rotate detail-normal slopes correctly; shade existing authored cleaves as shallow recesses; quieter worn plate centers.
- Astra trees (`a3aec477`): preserve bark/moss albedo in shade and reduce the green canopy tint on wood; six presets, no extra shader operations.
- Astra distance (`1ed75aaa`): retain complete seeded crown lobes/undersides at the120m detail switch and align far stems with near bends. Near geometry and all729 placements remain unchanged. Far trees add4–12 triangles each, at most7,124 total; transparent overdraw still needs measurement.

Combined source typecheck and twelve focused material/tree checks pass. Individual builds passed. Native candidate images and performance comparison are pending; no visual gain or performance-gate pass is claimed yet.

The baseline also exposes large dark circular crowns beside the stairs. A bounded follow-up investigates replacing those closed cores using the existing pooled twig/leaf geometry. Fable confirmed the scope; it retains white-bark geometry, expansion, props and rocks.