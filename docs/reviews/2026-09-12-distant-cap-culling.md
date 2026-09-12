# Keep distant caps from submitting invisible hero roofs

Combined source1e97463 adds only1008 cap triangles, but their shared roof bucket expands
from a7.497m to20.295m bounding sphere. At C/L02 this admits the old129596-triangle roof into
the color pass despite byte-identical JPEG/depth. Real Three frustum calculations reproduce
all ten measured source deltas exactly; this is an established cause, not just a hypothesis.

The correction changes only the consolidation block in structures/index.ts. Move distant
capMoss meshes into an identity group, run the unchanged static consolidator on each group,
then reattach and sum audit counters. All original part data/materials/transforms stay exact;
the main roof's merged buffers recover711 exactly. No builder/layout/light or shared material
changes. Fable's take69 history74918cd is integrated deliberately; active structures17 remains
his work. PR2 comments5647801272/5647841319 document the narrow index overlap and adoption plan. Fable explicitly approved this split
in5647847074 and will adopt its SHA after structures17, which adds only audit lines here.

[The pinned reproduction](distant-cap-bounds/README.md) preserves original source/camera
provenance and resource behavior. Expected versus1e: C/L02−130604 submitted triangles with
zero net calls; F−1008/+1call; A/B/D/E and signs+2calls/same triangles; L01+1call/same triangles.
Unique triangles/materials/textures remain unchanged, mesh/geometry+1, raw geometry buffers
−6048bytes because the small cap index becomes Uint16. Object overhead and GPU timings are
unmeasured. Max draw count would be663, B/E triangles8725061 unchanged.

All final56 unique geometry disposals occur once, including the new bucket;36material events
and25inspected texture event counts preserve old behavior. Existing cap-moss texture leaks
remain pending Fable's accepted fix; no new whole-system idempotency claim is made.

The actual acceptance gate is unchanged JPEG/depth and matching predicted submitted budgets
against the prior crate718 source, with retained scene audits/resources. Do not infer a new
visible improvement or FPS gain from fewer submitted triangles. Capture remains pending.

Actual-source typecheck/build112, exact frozen index SHA256 and self-contained pinned
reproduction pass. Crate/tuft hashes remain unchanged; partner749 log/ledger bytes are exact.
