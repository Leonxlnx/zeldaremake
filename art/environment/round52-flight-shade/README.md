# Round 52 — fable-4: who shades the flight at A (fable-5's walk item 6, "the flight climbs into shade, not light")

Head `f6793736`, camera A, frozen sim clock. Region = the flight, x 0.30–0.75 × y 0.25–0.62 of the frame.
Per scene group: `castShadow` off for its meshes, one render, the region's mean luminance and the share of
region pixels that changed.

| casters off | region luminance | Δ | pixels changed |
|---|---|---|---|
| none (base) | 0.321 | | |
| `trees/white-bark` | 0.321 | **+0.000** | 0.0 % |
| `trees/columns` | 0.328 | +0.008 | 5.9 % |
| `trees/giants` | 0.355 | **+0.034** | 37.9 % |
| `trees` (all) | 0.369 | +0.048 | 49.1 % |
| `hardscape`, `structures`, `terrain` | 0.321 | ≤ +0.001 | ≤ 1.2 % |
| **all 343 casters** | **0.376** | +0.055 | 58.3 % |

`A-flight-base_no-giant-shadows_no-shadows.jpg`: base | giants' shadows off | every shadow off (the flight crop).

Reading: the white-barks cast nothing on the flight at A; the giants' canopy is the shade that is there
(+0.034). But with every shadow in the scene removed the flight only reaches 0.376, where the frame's top
treads are 0.65 (fable-5: treads 0.27 → 0.26 → 0.29 vs 0.37 → 0.40 → 0.65). The climb into light is not a
canopy gap to open; it is the light on the treads — sun intensity / direction on that slope and the tread
material's albedo (Astra's lighting, hardscape's flight). Opening the giants' canopy would buy at most a
third of the way.
