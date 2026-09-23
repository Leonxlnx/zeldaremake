# Connected close-crown lamina study

Status: **held for production adoption**. Geometry/lifecycle checks, a four-view native pair and a matched visible motion route pass their recorded invariants. The matched warm route adds 14 ms median completed-render-await time on this laptop. The large first-use shader stall also occurs in the unchanged baseline when visible point lights change; the candidate still adds its own first-use shader. Base6231cffb predates the coordinator's current world. The earlier held flat-tuft trials remain separate in E:/zeldaremake-astra-crown-clarity.

The held close trial paints110 leaves on each small flat card. Beyond6m its card normal/detail blend is zero, leaving every painted leaf in a tuft with the same normal. Its common shade fill, baked atlas light and absence of self-shadow casting further flatten the result. White-bark geometry instead gives each leaf its own cup, UV, orientation and shade distribution. The near-canopy path also uses physical laminae, its existing lower leaf floor and7–18m surface-detail band. The accepted atlas color encoding is correct; no tint or floor change is proposed here.

This candidate grows four leaders with three lobes each for broad crowns, two by two for slender crowns: the lower authored giant crown topology. Leaders start on the original trunk centerline, then the existing secondary/twig construction and unmodified nearCanopy.lobeSteps grow actual cupped leaves. Broad leaves are22–36cm at the largest placed instance; smaller instances inherit smaller leaves. The canonical near builder chooses slightly smaller leaves for the short slender variants. One material, giantTreeNearCanopy, supplies actual per-leaf geometry/UV lighting; no cluster atlas is sampled for foliage. Its ordinary leafShade remains1, as authored: this does not import the white-bark-specific shade distribution or its shadow casters.

No old atlas occupancy or rejected tuft position constrains the new foliage. The parent reviewed two CPU masks with visibly connected leaves and larger sky gaps. Production vertex/index bytes exactly match all six approved prototype hashes. The existing eight-slot selection,18–26m fade,34m prefetch and always-installed far fallback are unchanged. Every tree without a detail slot retains its original crown.

| Variant | Leaves | Complete close triangles | Packed bytes |
| --- | ---: | ---: | ---: |
| Broad0 | 11,460 | 118,205 | 6,700,332 |
| Broad1 | 11,892 | 123,791 | 6,997,428 |
| Broad2 | 11,988 | 126,023 | 7,103,076 |
| Slender3 | 2,529 | 27,805 | 1,399,278 |
| Slender4 | 2,334 | 26,266 | 1,312,476 |
| Slender5 | 3,924 | 39,832 | 2,029,296 |

Eight largest crowns add1,008,184 triangles, maximum6instanced draws, zero textures and zero shadow passes. All old submissions still count during transitions and at full close weight, where their crown fragments are discarded. Shared raw geometry is35,823,006bytes, canonically packed to25,541,886bytes; instance attributes add3840bytes. Driver copies and transient builder arrays are excluded. Pool rebuilds yield between forks/twiglets; large merge/buffer operations still exceed the6ms pool work target in CPU measurements, and a cold teleport may finish synchronously. These are not frame-time measurements.

The new mutable fade attribute uses DynamicDrawUsage. Only that usage is exempt from releaseAfterUpload; static instanced attributes still release. CPU simulation uploads every static buffer, updates fade, and verifies both behaviors. No broad storage exemption is introduced.

```powershell
node art/environment/astra-distance-real-lamina/check.mjs
npm run typecheck
npm run build
```

The runnable check compares all original geometry/placements/random draws against6231cffb; all six prototype hashes; exact yielded rebuilds; parent joins; physical leaf sizes and twig attachment; curved normals; the actual near material uniforms/maps; packed bytes; eight-slot scarcity and complementary fades; and installation before old coverage removal. Parent joins are below2e-15m, and the largest leaf-base offset is3.26mm (the canonical rosette offset at twig tips). It also reproduces the existing padded-frustum candidate check: A's sole envelope-eligible tree559 is outside the frustum; the remaining five fixed views have no eligible crown. A/F are now confirmed natively; B–E remain CPU predictions on this base.

Baseline dist is an immutable copy of the coordinator's6231cffb build index-Hs0AcnGr.js. baseline-dist-manifest.json verifies all98files against the source copy before serving. The capture helper is copied from the earlier exact-camera native workflow; no desktop input or production capture API change is used. Run it only through the shared capslot after coordinator allocation.

## Native evidence, 2026-09-23 review

Source6231cffb bundle SHA256 e9abdc2c…57acbb versus source1f3b51fd bundle0bf022f2…4c35f. Both renders use Radeon780M/D3D11,1280×720,high defaults,time12.6,identical cameras/lighting,and empty source diffs. `compare-native.mjs` verifies provenance, raw PNG hashes and A/F equality; complete hashes are in `build.json` and `native-comparison.json`.

| View | Before → after draw calls | Added triangles | Result |
| --- | ---: | ---: | --- |
| A stairs |459 →459|0|PNG byte-identical;8,889,627 total triangles|
| F canopy |416 →416|0|PNG byte-identical;8,180,156 total triangles|
| Reconstructed distant up |132 →136|882,741|Connected branches/leaves replace selected planes; substantially more sky|
| w19 spine up |176 →178|973,570|Individual leaf silhouettes improve; unselected upper-left planes remain|

The change improves the selected crowns' shape and per-leaf shading. It does not remove all flat distant crowns or preserve the old canopy density. The two upward views have eight active slots; the fixed views have none. No texture or shadow-pass additions. Runtime shared geometry accounting is25,542,078bytes, including192bytes of mutable fade attributes; the earlier table excludes those192bytes.

The remaining pale upper-left crossed crown is chiefly **distant ID48, slender variant5**, base(−10.1980,4.28517,−45.22866). Its close-envelope distance is13.2779m, but its rank is10 behind eight occupied slots. It has weight0 in both the static w19 and warmed endpoint; it is unselected, not retiring. Four rays through its visible pixels first hit ID48 with base-atlas alpha≥0.997. NeighbourID49 is static rank9/unselected but warm rank8/weight1 because of the2m incumbent preference. This is slot scarcity, not the26m cutoff. [CPU diagnostic](pale-crown-diagnostic.json) pins source/bundle/image hashes and all ranks/hits; wind/mips/GPU occlusion are outside that diagnostic. No density or slot-cap change was made.

[Coverage diagnostic](crown-coverage.json), reproduced with `node art/environment/astra-distance-real-lamina/crown-coverage.mjs`, compares all eight selected crowns with IDs 48/49 using the original fallback cards. At the exact w19 camera, a 48×27 grid has 410 nearest alpha-qualified samples. Static selected crowns account for 289 (70.49%); warmed selections account for 370 (90.24%). ID 48 has 78 independent/38 nearest samples, while selected IDs 2/10 have none on this coarse grid. ID 48's clipped card bounding rectangle covers 31.09% of the frame, an upper bound rather than opaque coverage. These results identify candidates for a future generic coverage-priority study; they do not show that most slots are wasted.

| ID | Static / warm selected | Independent alpha rank | Independent samples | Nearest samples |
| --- | --- | ---: | ---: | ---: |
|4|Yes / Yes|1|149|98|
|6|Yes / Yes|2|113|110|
|49|No / Yes|3|112|81|
|5|Yes / Yes|4|103|53|
|48|No / No|5|78|38|
|8|Yes / Yes|7|53|18|
|3|Yes / Yes|8|48|7|
|7|Yes / Yes|11|7|3|
|2|Yes / No|14|0|0|
|10|Yes / Yes|16|0|0|

Ranks cover all placements, with ID breaking ties. No selected crown has zero projected solid-card area, so none is established as offscreen. Grid zeros can miss thin coverage. Nearest alpha ≥ 0.3 is a depth-order proxy for transparent old cards, not proof of complete occlusion; replacement laminae, wood, other world geometry, wind and mip selection are excluded. This measures counterfactual fallback coverage, not actual close-slot utilization. Selection, geometry and budgets are unchanged. The reproducer verifies the captured source commit and an empty runtime-source diff, allowing evidence-only commits.

## Initial ordinary-update probe (not visual acceptance)

`transition.mjs` uses the actual observed camera and `__ZR__.render(1,1/30)` between endpoints. It does not call `setPose` each frame. The route approaches from(4.68,z−8) to z−56, turns360°, retreats and holds:540frames/18simulation seconds,13distinct crown IDs,332frames with fractional fades,max8slots/max973,570close triangles. Every frame checks the fade rate, retiring-slot lifetime, triangle/slot ceilings and actual uploaded fade arrays/installed geometry. No page/WebGL errors. The distant near bucket varies283–302instances as the unchanged120m boundary moves across other trees.

[Overview](native-transition/overview.jpg) · [Compact numbers](native-transition/summary.json) · [Full trace](native-transition/transition.json). Its original movie remains local; use the matched visible route below for review.

The middle turn is inside the log arch and mostly timber-occluded. This validates slot state, not the visual quality of that turn. The video samples every second simulated frame at15fps; it removes wall-clock stalls and is not a real-time performance demonstration. Raw JPEG frames remain local/ignored; the trace records all270hashes and the helper regenerates them.

After motion, A returns byte-identically; F differs in one channel by1/255 at one pixel(224,63), with unchanged draw/triangle counts and zero close slots. This is not strict F byte equality. `summarize-transition.mjs` verifies and measures these returns.

All432canopy and23base pool items remained resident: **zero builds, evictions or synchronous rebuilds**. The first close visit costs30.2ms for the pose and4,950.6ms through the completed render (+3programs). The approach contains five>1s stalls, including80,757.6ms at frame64 alongside39new shader programs; trees.update is1.1ms there. The full trace records these rather than attributing them to the crown candidate. Tree-update median/p95/max is1.1/2.5/10.1ms. Render-await timing includes rAF/GPU readback/first-use compilation/host scheduling; it is not FPS and has no matched baseline route. Coordinator Blender CPU work ran concurrently; no other capture held the GPU slot.

## Matched visible route

[Before/after motion](matched-motion.mp4) · [Endpoint and turn](matched-contact.jpg) · [Full comparison](matched-comparison.json). Baseline is left, candidate right. The video plays 8.5 simulation seconds at 30 fps; elapsed capture stalls are recorded in the traces, not reproduced in playback.

Both frozen bundles use the same hashed helper and actual camera poses at every step. Start is x4.68,z−17.5 at terrain+1.8m; the camera reaches the exact visible w19 position(4.68,5.34,−44.1), turns360°, retreats and holds. There are90approach/60turn/90retreat/15hold steps at1/30s (~8.87m/s translation). The last metre eases down0.351m to the authored w19 eye height. Tree2's envelope crosses34m atz−17.8318,26m at−27.5194 and18m at−37.0477; it is not guaranteed a slot when eight closer trees are present. Each page runs first-use then the same warm route without a page/pool reset.

| Warm metric | Baseline | Candidate |
| --- | ---: | ---: |
| Tree update median / p95 |0.5 /0.8ms|0.6 /1.1ms|
| Completed render-await median / p95 |50.3 /64.4ms|64.8 /77.9ms|
| Completed render-await maximum |73.1ms|90.8ms|
| New shader programs |0|0|
| Pool builds / evictions / synchronous builds |0 /0 /0|0 /0 /0|

The per-frame paired median increase is14.0ms; p95 increase22.5ms. Median submissions add3draws/895,197triangles. These are one sequential paired run with rAF/readback and host scheduling, not an FPS guarantee or isolated GPU benchmark. Candidate tree geometry remains resident at191,336,253bytes versus165,794,175bytes in the baseline (both below the existing256MiB pool cap).

Each candidate pass exercises11crown IDs,121partial-fade frames and9membership-change frames, with6–8slots. Actual installed geometry/fade arrays and bounded fade rates pass throughout. The turn now shows canopy: selected flat silhouettes become individual leaves, with larger sky gaps; an unselected plane remains. No runtime errors. No native cold rebuild was exercised because all pool items stayed resident.

The same first-use light transition appears at frame26 in both builds: visible point lights15→17, baseline+33programs/70.681s completed wait, candidate+34programs/87.058s. Their tree updates are below1ms. This supports the coordinator's diagnosis of the old light-parenting bug; its newer4b2fe8e6 source fixes that path. It does **not** make the crown free to compile: candidate frame0 adds one extra program and waits5.027s versus0.280s in the baseline. Both warm passes keep their program counts constant (146baseline/148candidate). No local light or shader fix was introduced. These captures use the headless profile, where the existing startup shader warmup is off unless `warmup=1`; normal interactive startup enables it. The measured first-use program waits therefore do not establish an equivalent gameplay hitch.

`compare-matched.mjs` verifies sources/bundles/helper/module hashes, exact camera/time/resolution/sequence, errors and image hashes, then reports the first/warm passes independently. Raw numeric traces were losslessly minified for storage after capture. Trace digests are generated at comparison time; these are local review records, not independent CI attestation. Raw warm JPEGs remain local and are regenerated by `capture-pair.mjs matched-`.

## Decision and remaining acceptance

Source review found no concrete attachment, selection, culling, packing, shader, wind, shadow or disposal defect. The CPU bound now proves any positive target weight is within62.02304m of its tree base, inside both120m high and72m low distant thresholds. Retiring slots clear within0.25seconds plus one frame at30/60/120/144Hz; explicit camera resets clear them immediately. Arbitrary camera jumps without the normal reset hook can carry retiring detail farther temporarily. All legacy placements/geometry and RNG draws stay exact.

Before production adoption:

1. Review all six views and combined budgets after source-only integration onto the coordinator's current head, preserving its medium shadows,120m switch, upper-canopy work and existing light-parenting fix. Judge the sparser silhouette and measured warm cost together. Source1f3b51fd is unchanged and not adopted here.
2. Run the short warm route on that combined source to confirm its light-count fix and the accepted cost. The matched old-base route above closes the previously occluded visual-turn gap.
3. Validate a real cold pool rebuild/eviction on a device's normal smaller tier, or retain the explicit limitation. This large-tier capture never rebuilt geometry; deterministic CPU rebuilds do not measure that native hitch.

Reproduce the static pair through `capture-pair.mjs` with the baseline snapshot present. Reproduce the matched motion with `capture-pair.mjs matched-` under the shared capslot with `CAPSLOT_STALE_MIN=Infinity`, then run `compare-matched.mjs`. The initial held probe uses `native-capture.mjs transition-settings.json`; its captured helper snapshot preserves its receipt. CPU check/typecheck/build pass; anti-cheat is green (97checks, inherited warnings and no new gauntlet capture). No take or phase-exit claim is made by this evidence-only delivery.
