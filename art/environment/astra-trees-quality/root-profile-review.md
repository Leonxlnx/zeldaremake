# Independent root-profile native review

Verdict: a useful geometry improvement for Fable's coordinated handoff. Candidate
`cba53758` was captured in parent `0db15909`, then held/restored from production in
`680adc76` because Fable owns overlapping trees-32 work. This is not integration approval.

Original before/after PNGs were inspected at all three outside-boundary poses, all three
inside-boundary poses, close boles and C/F. A was checked numerically against its inspected
baseline. Before: `2026-09-20T17-14-42-277Z-daylight`, source `0645b7d3`; after:
`2026-09-20T17-21-19-936Z-daylight`, source `0db15909`, under the parent's `art/environment`.
Both manifests are complete, errors empty; all 12 cameras, times and lighting settings match.

Lantern outside 12.15 m now retains a broad bark-textured buttress instead of reverting to
smooth green tubes. NW outside 10.15 m gains root shoulders and split toes that match the
near footprint. Stair-bank outside 12.15 m improves more subtly, with a coherent root ridge
at the foot. These are closer to owner concept05's continuous trunk/root growth. The coarse
collar still meets a smoother, differently shaded lower bole; pale green toe ends and the
near/far material pop remain conspicuous. The upper cut edge is unchanged. No complete
transition fix or reference-level tree quality is claimed.

Exact invariance qualifiers (encoded RGB, no tolerance):

- Close lantern and stair-bank PNGs are byte-identical. Close NW differs in three pixels,
  maximum one channel level, outside the checked bark ROI; that ROI is exact.
- All three inside-boundary root ROIs are pixel-identical: lantern `[520,325,345,300]`,
  NW `[565,400,255,140]`, stair-bank `[550,400,210,140]`, in left/top/width/height pixels.
- The full inside-boundary PNGs are not identical: other visible far roots changed.
  A broader NW box includes changed background beside its trunk, so it must not be called
  an unchanged whole-tree crop. The CPU candidate check independently hashes near geometry.
- A is not byte-identical: 28 pixels change, maximum 15 levels, full RGB MAD .000046/255.
  C/F changes are confined to visible roots and their nearby image response; composition
  remains intact. Full RGB MAD is .1200/.01088 levels. Parent reference SSIM changes are
  C +.0029, F -.0001; these do not replace the original-pixel assessment.

The source adds 4,844 unique triangles and no draws. The native counter reports 9,688
additional submitted triangles and zero extra calls in every pose; A is 8,751,314 triangles,
571 calls. GPU time was not measured by this independent review. The source/CPU check
reuses existing fin profiles, terrain seating and deterministic streams; it does not extend
LOD radius or change materials, layout or the Verdant white-bark trees.

`root-profile-native.json` records exact full-frame differences and the stated root ROIs,
plus independent manifest checks. Parent's `astra-quality/root-profile-comparison.json`
contains the broader tolerance/SSIM comparison. No production files or GPU were touched here.
