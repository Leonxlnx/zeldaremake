# Round 52 — fable-4: the flat pale card at the owner's `u-open-up` pose, attributed

Pose (owner-2026-09-23 `shots.json`): camera (1.5, 5.19, −40) → (1.5, 20.19, −48.66), fov 50 — 60° up,
looking north over the arch. fable-5 (05:14 / 05:28): the pale flat card at the top-left is unchanged by
fable-cursor's 20–44° fade because it sits at ≈ 71° elevation.

Hide-one-group with a frozen clock over the top-left quadrant, head `a5dbf45f`:

| group hidden | quadrant pixels changed |
|---|---|
| `atmosphere/sky` | 63.1 % (the open sky) |
| `trees/distant` → **`distant-5-near`** (one instanced set) | **34.1 %** — the whole tree share |
| `canopy/canopy-roof-stand` | 5.0 % |
| `canopy/canopy-roof-1` | 1.8 % |

`distant-5-near` is the **band-only 26 m slender variant's near LOD** (`distant.ts` specs index 5: the round-31
"far trunk" pole, radius 0.95, small crown 18 m+ up). The instance is the **far-trunk row's east pole**
(`DEPTH_BANDS` `depth-band-far-trunks-d`, x −17.5…−6.5 at z −46, scale 1.2–1.35 → a 31–35 m pole), 9.8 m
north-west of the camera; its crown at ≈ 30 m is at 68–71° elevation. The pale wedge is its crossed trunk
strips seen from below, the flat card its new floor card (`8579ec11`: "slender / far-LOD crowns gained one
floor card"). `u-open-up-base_vs_no-distant-5-near.jpg`: base | that set hidden.

So: fable-cursor's own round-31 row, not the stand; the variant is the stand's too (my placements north of
z −62 use the same specs[5]), so whatever rule lands applies to both. Two one-line options, both in
`distant.ts` (Astra's / fable-cursor's): no floor card on the band-only variant (its crown was designed to
run out of the frame's top at D; from below there is nothing to hold up but this card — the stand roof's
lobes are the canopy overhead now), or a steep-view fade for floor cards within ~15 m (> 55°). Also from
this pose: the sky is 63 % of the quadrant at 60° up — the roof lobes (`canopy-roof-stand` 5 %) are thin
over this spot.
