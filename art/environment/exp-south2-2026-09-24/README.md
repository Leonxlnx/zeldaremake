# exp-south2: the log's exit, and dwellings on the way out (2026-09-24)

The owner, 2026-09-24 06:07 UTC: *"why is it white?"* (the end of the hollow log on the far bank)
and *"add more stuff and the structures from the screenshot ... more structures along the path
further down"*.

Branch `agent/fable-cursor-exp-south2`. Every image is 960×540 at `quality=high`, simulation time
12.5 s, character hidden, with the same camera before and after.

## 1. The end of the hollow log (`01-log-exit.jpg`)

**Before** (the build before `bc757dfa`): the walk into the log ended at a flat cream disc, an
emissive glow card behind haze veils. Inside the disc's own area the luminance was uniform
(p99 = p99.9 = peak ≈ 231.8 of 255): a flat colour, not a scene, with up to 0.2 % of the area at a
clipped channel.

**After** (`bc757dfa`): the disc and its veils are gone. The tube runs on to a snapped far end
(splintered rim, end grain) that opens into a cleft cut through the bank behind it: sunlit ground
with ferns, saplings, a fallen branch and a thicket of young white-bark trees closing the view.
The walk still stops at the dead end, now behind a curtain of roots grown down through the rotten
roof. No light source was added; the hollow's daylight bounce is re-tinted and falls off from the
far end.

Luminance (0–255, Rec. 709 weights) inside the old disc's area:

| View | Crop (x0,y0–x1,y1) | p99 | Peak | Max channel | Area with a channel ≥ 250 |
| --- | --- | --- | --- | --- | --- |
| L1, far path, 12 m out | 370,150–580,335 | 230.8 → 183.8 | 231.8 → 208.2 | 251 → 234 | 0.09 % → 0 |
| L3, 4 m inside | 290,60–675,400 | 231.8 → 189.7 | 231.9 → 214.0 | 254 → 239 | 0.19 % → 0 |
| L4, 6 m inside | 90,0–880,520 | 231.8 → 195.4 | 232.6 → 220.9 | 254 → 243 | 0.21 % → 0 |
| L7, at the dead end | 150,0–810,470 | 231.8 → 166.3 | 232.6 → 211.1 | 240 → 233 | 0 → 0 |

The brightest pixels left in the exit are sunlit leaves and ground in the glade (e.g. RGB
(233, 216, 138) in L3). The whole-frame peaks in the views from the far path are the two pod
lanterns at the log's mouth (≈ (252, 212, 143)), the same before and after. The last row of the
sheet looks back at the exit from the glade; before, that camera stood inside the hill, because
nothing existed beyond the disc.

Walk `south-bridge-to-log` 21/21 and the 41 south probes pass on `bc757dfa`.
