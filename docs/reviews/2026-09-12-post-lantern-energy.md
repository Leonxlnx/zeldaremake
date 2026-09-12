# Two post lanterns: local light-energy study

Parent: `84ecde9ccafb9057e466544340335d07b31f72c9`. This is separate from that source's
upper-air color change and the earlier hedge sky transmission.

## Evidence and bounded change

Actual d41 L01/L02 show separate green sepals but ivory bindings/rims competing with the amber
body. The original owner boards 05/06 show quieter brown lashings and a varied seed-pod skin.
The current non-body UV is (0.5, 0.95), inside the black emissive band. Those surfaces do not glow
from the map. A 3.2-intensity unshadowed point inside the pod can illuminate opaque ties/rims
through its enclosing shell, including untinted dielectric specular highlights.

Trial: only the two post PointLights change from 3.2 to 1.2. Point-only linear energy therefore
falls 62.5%; tone mapping and other illumination mean display brightness will not scale that way.
Color, position, distance 5, decay 2, shadow behavior, emission/material/maps, geometry, animation,
RNG and all other lanterns remain unchanged. Nearby warm spill naturally becomes weaker.
There are no added GPU resources, draws, triangles or shadow passes.

One audit field, `structures.postLightIntensities`, reads the real two light objects. The narrow
shared index overlap was announced to Fable in PR2 comment 5646971818; house/roof/hardscape
source remains his work. This pass does not introduce shadows for point lights.

## Verification and actual acceptance gate

The source boundary is one executable constant and the real-object audit, plus comments/docs.
Typecheck/build pass (107 modules); the exact executable boundary check passes. No new implementation-mirroring test is needed.
Actual captures must check L01/L02 bindings/rims, retained amber body, green leaf separation and
nearby post/ground spill, plus unchanged world geometry/depth and render cost.

The within-source 12-image comparison still varies the pre-existing top-flight gain 1 versus 3.
Compare matching variants across historical 84ec and this source to isolate this light change.
All four detail cameras remain fixed full-scene production views. No visual acceptance is claimed
before actual captures arrive.

Reducing light energy will not create missing membrane veins or texture the green sepals.
A separately owned original emissive atlas may be considered after this result; it would address
body variation only and would require explicit material/texture disposal, not a shared-map edit.
