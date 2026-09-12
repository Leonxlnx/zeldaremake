# Add inhabited depth behind the clearing

Deliberate ancestry merge of Fable871d27b08218f5f10d509e443483f9ad83d0110c into
Astra711758d8bda00458c0ae7339eb9ec55654a1e23b. The separate tuft lighting capture is already
running before this source is published. Character remains paused for local Blender.

Three distant huts add warm windows, doors and pods at different heights around existing
trunks. This follows owner boards01/08, which root revisited. Bark, wood and moss geometry
reuse the hero-house materials and consolidation buckets; the new glow uses one material and
mesh without point lights. The original distantHouse.ts and materials.ts bytes are retained.
The structures index merge preserves Astra's post material,1.2 lights, audits and disposal.
No world layout, camera, global light/fog, tuft shader or existing hero-house source changes.

[The independent pinned source review](fable-distant-houses/README.md) builds the real tree
placements and principal boles. All three hosts exist; their terrain seats/platform heights
align, and trunks pass through their platforms and caps. The measured addition is5217 scene
triangles,3720 casting,one consolidated mesh and zero point lights. Existing audit fields
change only mesh/triangle totals and pre-merge count; hero houses remain2, distant houses3.
Actual submitted counts and visual usefulness still require the combined capture.

The shared glow peak is2.2 linear, with lime-tinted vertices peaking1.584. Existing fog rules
apply normally; no global fog exception is changed. The distantGlow material owns no texture
and is included in existing structure teardown. Existing borrowed maps remain shared.

## Known follow-ups retained

The hollow-column's actual bole protrudes2.695cm through its upper tapered/wobbled wall;
the lower wall contains it and the other two huts have measured clearance. A local radius
change1.55→1.59 is only an untested suggestion, not silently included. Some pod hangers have
small unsupported offsets from post tops;84 collapsed cap-pole triangles are minor avoidable
overhead. The source header's peak2.6 is stale. These were sent to Fable in PR2 comment5647627605.

New door/window centre rays clear their respective hosts/hulls in A/B/D/F, but that excludes
other world objects and leaf alpha. No full-scene visibility claim follows. The north-east
middle-post pod is naturally hidden by its host in B. Host seats are duplicated constants;
future moved/skipped trees need a shared accepted-host contract before changing those seats.

The accepted main Saria bough/window obstruction and generated cap-moss map cleanup remain
absent from this ancestry. Fable was asked about the active follow-up; this merge does not
pretend those defects were fixed. His subsequent d7f5e98 hardscape teardown is being reviewed
separately while this exact structure source is captured.

The commit reports lower footage SSIM in upper bands while adding lit village depth for the
owner boards; those are Fable's measurements, not an independent rerun or a formal pass.
The locked rubric, historical reviews/ledger and all gallery evidence remain unchanged.
Actual A/B/D/F must establish whether the new huts read through the current atmosphere without
obscuring the central house, stairs or log opening. No appearance acceptance is claimed yet.

Typecheck/build (111 modules), exact three-file production boundary and preserved tuft
source hash pass. The complete index diff contains only the partner's new import, build call
and distant audit fields, retaining all prior Astra post work. Combined actual capture pending.
