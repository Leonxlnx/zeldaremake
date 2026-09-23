# opus-review — independent visual review of take-0116 (`973a21e`, author fable-cursor)

Filed 2026-09-19 through
`node gauntlet/scripts/gauntlet.mjs --review <item> --verdict pass|fail --evidence <path> --agent opus-review --take take-0116`.
Records: `gauntlet/reviews/<item>.json` (each keeps every earlier verdict in `history`).
Evidence: `gauntlet/reviews/evidence/opus-review/take-0116-*.jpg` — REFERENCE (left,
`reference/frames/<view>.jpg`) | OURS (right, the take's own frame) at the **same normalised
region**, both resampled to the same pixel size, with the region burned into each panel.

## Provenance

- **Frames judged:** the six 1280×720 captures the ledger hashes for take-0116, as published on
  the `monitor` branch under `data/takes/take-0116/`.
- **Cross-check:** a clean headless render of `973a21e` in a detached worktree
  (`?capture=1`, quality high, settle 12, SwiftShader — the renderer the monitor's takes use)
  matches those six frames at **SSIM 0.982–0.990, pHash Hamming 0–2, 1.6–3.5 % of pixels
  differing at tolerance 8**. The residual is the monitor's JPEG plus the settle-count
  difference (12 against the take's 90). The verdicts stand on the actual build.

  | viewpoint | SSIM | pHash | pixel diff |
  | --- | --- | --- | --- |
  | A_stairs | 0.9844 | 2 | 3.11 % |
  | B_house | 0.9898 | 0 | 1.58 % |
  | C_lookback | 0.9841 | 0 | 3.47 % |
  | D_log | 0.9820 | 2 | 2.58 % |
  | E_ground | 0.9898 | 0 | 1.58 % |
  | F_canopy | 0.9832 | 0 | 3.27 % |

- **Three items needed frames the take does not carry.** W22 needs a motion pair and U02/U03 need
  the equipment screen; neither is in a take's six captures. Both were rendered from the same
  commit in the same worktree (non-author): `A_stairs` at t = 12.5 s and t = 13.0 s, and
  `?screen=equipment`. Each of those three notes says so.
- **Rule applied.** A criterion is judged as written in `gauntlet/RUBRIC.md`, at the viewpoint it
  names, on the side-by-side at 1280 px. An auto gate never rescues a visual fail. Where the
  criterion is met but a visible difference remains, the verdict is **pass** and the difference is
  recorded as a nit in the note. Every measurement quoted is a mean over a named normalised region
  of both images, so any claim can be re-derived from the two files.

## Verdicts — 27 items, 8 pass, 19 fail

| item | verdict | one line |
| --- | --- | --- |
| W01 | **pass** | stairs, ledge, branch and plaza all in the reference's regions; the frames read as the same shot. Nits: Saria's lit dome fills the centre where the reference has misty recession; the upper left is blue-grey sky (`#7f8589`) against warm canopy haze (`#7d7b69`) |
| W02 | fail | parallel machined bands: one straight-edged slab per tread, square nosings, no moss on any nosing, no growth in any joint; tread `#333230` l 0.031 against the reference's warm `#544e42` l 0.078 |
| W03 | fail | a few very large angular tiles (0.25–0.30 of frame width) with bare joints; the joint band measures l 0.356 against the reference's l 0.169 — a pale dry strip with no greenery in it |
| W05 | fail | one smooth grass mound with a smooth dome boulder and a dome bush; no terracing, no erosion channels, no strata in the bank or the ledge lip |
| W06 | fail | grass → uniform pale soil band → stone, two hard mask edges, no moss halo and no roughness across the band |
| W08 | fail | the near white-bark is a straight untapered pole; the whole background layer is flat grey-blue cards, σ 23.6 against the reference's 11.4 (hard card edges against a soft branched silhouette) |
| W09 | fail | the trunk beside the door is a smooth wall, σ 14.2 against the reference's 30.4; no buttress flare enters the terrain anywhere; D's left giant is a flat green cylinder `#545a44` against a pale hazed `#7a7a70` |
| W10 | fail | F's top half is open pale grey with flat dark lobes in it, no layering and no light through: `#646967` l 0.139 σ 45.9 against `#85857a` l 0.231 σ 18.9 |
| W11 | fail | mid-ground crowns are single-tone rounded lobes on bare trunks; a patch of blue sky shows at the top left; only the house's moss cap reads as leaves |
| W14 | fail | position and three pods are right; the limb is a thin flattened tube with a hard underside, no bark and no moss, `#424333` l 0.054 against `#635f50` l 0.114 |
| W15 | fail | the stair foot (x 0.55–0.70, y 0.55–0.68) is a flat green mat with no blades, σ 13.2 against the reference's 20.6; grass meets stone on a clean mask edge with no tufts crossing |
| W18 | **pass** | purple in D's left foreground where the reference has it (purpleFraction 0.0049). Nits: two broad bands of oversized saturated stars where the reference has one compact clump |
| W20 | fail | moss stops on a clean arc at the eave; no stair nosing and no flagstone joint carries any; the D boulder shows no cap at frame distance |
| W22 | **pass** | own motion pair: grass 7.4–7.9, branch leaves 9.1, hedge 4.4, roof 3.2, near canopy 1.3, far trunks 2.0 (mean |Δ| /255) — four separated amplitudes, grass moving tuft by tuft. Nit: the near canopy is nearly static |
| W23 | fail | no boulder reads at the left of D at all: an unlit mass behind fern fronds, indistinguishable from the moss around it |
| W25 | fail | proportions and the dome match; the opening measures l 0.028 against l 0.065 and holds untextured primitives, not a lit room; the trunk has no bark columns framing the door |
| W26 | **pass** | warm ribbed pods with husk and calyx and real warm falloff on the eave and wall; cores 1.4–1.6 % of frame width, overexposed 0. Nits: husks large for the door, hung in an even row |
| W29 | fail | a rounded lumpy mound roughly 1:1 in thin air where the reference has a flat-topped ≈2:1 trunk 60 % hazed; three featureless glow discs; a flat wall through the opening |
| W30 | fail | shadow to the lower right, reference lower left — mirrored, and short and hard where the reference is long and soft. Restates the standing `RUBRIC_PROPOSALS.md` conflict (owner's call) |
| W31 | fail | no shaft reads at A or F; the upper left is an even cool field `#7f8589` with no directional structure, where the reference has three or four beams |
| W32 | **pass** | four planes read at D and farLayerCount is 3. Nits: the far plane is a flat wall with no trunks through it; the near air is clearer than the reference's |
| W36 | **pass** | nothing floats; contact shadows under Link, side faces and joint darkening on the slabs, probes 100 %. Nit: the pebble heap is identical ellipsoids lying on the slope with no bedding |
| C01 | fail | silhouette is close; colours are not (cool cream skin, over-saturated tunic, no undershirt), plus a tight hood with a heavy fringe and a chest harness the reference does not have |
| C02 | fail | flat vector icons in the slots where the reference has rendered items; in world the shield hangs low and reads as a satchel with a ~40 % swirl against ~70 %; no scabbard or hilt in any frame |
| U01 | **pass** | hearts, item slot and minimap at the reference's positions and close to its sizes. Nits: the minimap is ~18 % wider and saturated olive where the reference is parchment with brown ink |
| U02 | fail | layout is close and the text matches, but the centre oval holds the source's own placeholder silhouette where the reference has a 3-D character render — the focal element of the frame |
| U03 | **pass** | same visual family: dark warm wood, gold scrollwork, warm cream serif, crisp text. Nits: the reference's carved frame is a full-width band, ours a corner flourish; grid cell shapes inconsistent |

**Not previously verdicted by anyone: U02 and U03.** W26's record on file was astra's on
take-0032; this is a fresh verdict on take-0116.

## Score with these verdicts

`score.mjs --in <copy of take-0116> --reviews gauntlet/reviews` → **29/50, Phase 1 24/42, zero
items pending** — the first take on which every `visual` and `both` item carries a non-author
verdict. W42 reads `fail` in that local re-score only because the monitor's copy of the take
carries no `console.log` for the check to read; the take itself recorded zero console errors, so
the true figures are **30/50 and Phase 1 25/42**.

## Where I agree, and what is new

Every one of the 24 items `fable-5` filed on this take came out the same way here, reached from
my own crops and measurements before reading theirs in detail. That is worth something: two
independent reviewers, different evidence, same verdicts. The additions are W26 (fresh, was
astra's on take-0032), U02 and U03 (never verdicted), the provenance cross-check, and the
measurement behind each claim.

## The pattern

Seventeen of the nineteen fails are one finding seen from different angles: **the auto gates count
the right things and the surface does not survive distance.** 20 steps, 555 stones, 10 white-bark
variants, 12 giants, laminae, three moss flags and a godRays flag are all present and true, and at
the viewpoint each criterion names the same surface is one tone with a clean edge — treads, slabs,
poles, cylinders, discs, tubes. Two measurements say it compactly: the trunk beside the door
carries **half** the reference's local variation (σ 14.2 against 30.4) and the background trunk
band carries **twice** it (σ 23.6 against 11.4), because ours is either too smooth or made of
hard-edged cards, and almost never the soft branched structure in between.

The other two fails are the light. **W30** is the rubric's own mirrored-sun conflict and needs the
owner's decision on the proposal already on file. **W31** is the one that costs the most: the
reference's A and F are built around three or four beams from the upper left, the `godRays` flag
is true, and no beam is visible in either frame.

## A structural note for the integrator

`layout.ts` gives `E_ground` the same position, target and fov as `B_house`
(`[0, 1.5, 2] → [5, 1.7, -12]`, fov 46), so the two captures in take-0116 are **byte-identical**
(sha256 `faf70fa2…` for both). Six viewpoint ids, five distinct cameras. W42's auto check counts
entries so it cannot see this, and the consequence is that E's SSIM, pHash and palette metrics are
a second vote on B rather than an independent sample — worth a `RUBRIC_PROPOSALS.md` entry
alongside W30's.
