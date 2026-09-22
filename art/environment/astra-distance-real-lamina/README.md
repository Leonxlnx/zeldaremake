# Connected close-crown lamina study

Status: CPU checks pass; one native comparison pending. This is not yet an accepted replacement. Base6231cffb contains the coordinator's current world, accepted atlas/fog, shared geometry packing and CPU-array release. The earlier held flat-tuft trials remain separate in E:/zeldaremake-astra-crown-clarity.

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

The runnable check compares all original geometry/placements/random draws against6231cffb; all six prototype hashes; exact yielded rebuilds; parent joins; physical leaf sizes and twig attachment; curved normals; the actual near material uniforms/maps; packed bytes; eight-slot scarcity and complementary fades; and installation before old coverage removal. Parent joins are below2e-15m, and the largest leaf-base offset is3.26mm (the canonical rosette offset at twig tips). It also reproduces the existing padded-frustum candidate check: A's sole envelope-eligible tree559 is outside the frustum; the remaining five fixed views have no eligible crown. Predicted fixed-view addition is zero; native confirmation is pending.

Baseline dist is an immutable copy of the coordinator's6231cffb build index-Hs0AcnGr.js. baseline-dist-manifest.json verifies all98files against the source copy before serving. The capture helper is copied from the earlier exact-camera native workflow; no desktop input or production capture API change is used. Run it only through the shared capslot after coordinator allocation.
