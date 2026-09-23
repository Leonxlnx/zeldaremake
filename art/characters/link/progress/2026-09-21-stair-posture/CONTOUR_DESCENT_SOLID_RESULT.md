# Complete descent classification: a70 remains separate

The authorized descent-only follow-up closes the missing-pair limitation in the earlier local region study. For these recorded poses, the largest new local timber-solid entry is **0.197273 mm** and the largest increase of an existing entry is **0.338156 mm**. These are shortest distances to the actual containing timber tube's triangles, not vertical top gaps. Candidate `a70ef714…` remains held and separate from the animation delivery. This standalone summary does not approve the shape or claim zero contact; the large raw evidence and diagnostic scripts remain in the local study archive, outside this publication.

## Identical poses and complete retained pairs

One CPU descent pass completed on 2026-09-22, 15:01:05–15:02:42 UTC: 660 frames, effective character source `439ad6a48b8740fdbe6407ee6a782ffaa61cce86af43d4ee55f4d5b3007ae72b`, frozen world geometry and original controls. Every existing pose/control field matches the saved `cd06f53a…` candidate replay exactly, including root, joints, ankle rotations, pins and guard observations. Every modified-region summary also matches the earlier `e0c2456b…` region replay exactly.

Original `4dcf89c5c10391981289e2583152c26fb4ac93047c6fcb4bb0959e246805d850` POSITION accessor 692 is read from the candidate's preserved BIN prefix; candidate POSITION is accessor 695. Both surfaces use each same live pose. The pass evaluates all 5,703 modified vertices twice per frame: **7,527,960 vertex/terrain samples**. It does not repeat ascent, the 336 unchanged affected-triangle boundary vertices, or the 537/4,701 foot checks.

All **7,077 pairs** with either top gap negative are retained, including all **19 newly negative** and **4,595 worsened-by-more-than-1-µm** top-gap pairs. The broader retention also catches state changes when top gap improves. IDs, both world points/gaps/support surfaces, and flags are stored in each row's `contourRegion.negativePairs`; full 19-bone world matrices, mesh/bind matrices and morph weights are in `bodySkin`. Shared inverse binds and bone order are in `regionSetup.skin`.

An independent static reconstruction using installed Three.js skinning reproduces **all 14,154 retained source/candidate world positions with zero error**. It uses GLTFLoader's weight normalization and the saved mesh matrix without advancing player state. Raw GLB weights remain available separately in the details file.

## Actual timber section results

Native rays classify both members of every pair against the recorded timber triangle geometry. Of the 19 new negative top gaps, **17 enter the local timber solid; two are below its underside**. There are 4,305 pairs whose actual interior distance increases by more than 1 µm.

| Case | Frame / vertex | Source → candidate interior distance |
|---|---|---:|
| First new entry | 186 / 43088 | 0 → 0.032542 mm |
| Largest new entry | 453 / 43760, duplicated by 43761 | 0 → 0.197273 mm |
| Largest existing-entry increase | 546 / 43640 | 20.405584 → 20.743740 mm; +0.338156 mm |
| Deepest candidate entry, already present | 368 / 43073 | 77.092885 → 77.092015 mm |

The 17 new entries are vertex samples, including duplicated split vertices: 16 exposed-calf samples and one cuff sample (283 / 44237), all on the right leg. The first entry is calf vertex 43088: raw weights kneeR `0.9383697509765625`, thighR `0.0616302527487278`; top gap changes from +0.008555 to −0.037816 mm. The largest new entry has kneeR/thighR weights `0.9693881869316101` / `0.030611827969551086`; the largest deepening is fully kneeR-owned. Complete rest/world positions, displacements and weights are retained for 585 distinct vertex IDs.

Source classification counts are 7,014 inside / 63 outside; candidate counts are 7,026 inside / 51 outside. There are **zero boundary or unclassified samples** with a 1 µm boundary tolerance. The only non-timber support cases are the original positive stone gaps for cuff duplicates 50970/50971 at frame 542. Both candidate points are below the timber underside, not inside it; their −49.784718 mm top gap is **not 49.8 mm penetration**. No retained negative support case uses a non-timber surface.

## Limits

This is a finite 660-frame, modified-vertex comparison on the recorded descent route. It does not bound triangle interiors, continuous motion between frames, other paths, ascent solid entry, self-contact, or all body geometry. The prior ascent counts remain in the local `CONTOUR_REGION_PLAYER_RESULT.md` archive report.

The classifier pairs outward top/bottom ray crossings per actual timber tube and computes nearest distance over all 532 triangles of the containing tube; overlapping containing tubes are rejected. All classified points lie in the tube body, at axial fractions 0.457976–0.551786. Tube cap radii and radial seams are not guaranteed globally watertight. These paired local sections provide the reported local solid classification; they are **not a general closed-manifold proof**. Submillimetre new/deeper results therefore close the earlier omitted-pair uncertainty within this explicit scope, while substantial legacy intersection remains.

## Local archive and reproduction requirements

The following are local archive paths relative to this report, not published downloads. The large raw replays, classification dump and full bone matrices are not committed with this summary. Raw source/candidate pairs and all bone matrices remain in the replay; the classification retains every native crossing and nearest-triangle result. The details file contains every flagged pair plus all 17 new entries and raw vertex metadata. Hashes identify the exact evidence used for the measurements above.

| File | SHA-256 |
|---|---|
| `cadence-player-contour-descent-pairs/player.json` — replay and matrices | `48d29349cd796911ded766690f6ef07d128a83f001d50f7636ca46deca2e2eaa` |
| `contour-descent-solid-classification.json` — complete classification | `b74dccf19d50fe627bd6e90e99f7ad284f90258512556afe1a44727e8b0ee2cf` |
| `contour-descent-pair-details.json` — metadata and reconstruction receipt | `84890ec27420ab9444e02b329d255d45b9647a7422c0c2ee7c50e24e93b0afbc` |
| `../2026-09-22-leg-contour/candidate.glb` — held candidate | `a70ef7144fbb075b31103256f71f673c9b3a74b31e8c30f9ac117c0d765bcde8` |

Local saved-pose baseline `cadence-player-leg-contour/player.json` SHA: `cd06f53ade9c0042a1f04a32c37c1f7e4fe9a4f6db450a284f1fc6c9407457c4`. Local prior region replay `cadence-player-contour-region/player.json` SHA: `e0c2456b03323b797357a13e9c205f18ba02171d14b7dc21976955e6351bf6b0`. Timber position/index SHA: `d7ce71daa843b15dce38ff4527345afde5f742a0957709aa1eb9f302fa8706f7` / `452caf0d203b51ee61d10228162eac29ed873bc4651f2b55eabbc4ebecb8a29c`.

The commands below require the local archived raw evidence, held GLB, matching frozen source/geometry, diagnostic scripts and their repository dependencies. They are not runnable from this published summary or a clean checkout alone. With that archive restored at its recorded paths, run from the repository root to recompute saved-point classification and reconstruction without replaying the player. The classifier verifies matching geometry and source receipts before interpreting it.

```powershell
node art/characters/link/progress/2026-09-21-stair-posture/contour-region-native-rays.mjs --all-descent-pairs
node art/characters/link/progress/2026-09-21-stair-posture/contour-region-case-details.mjs --all-descent-pairs
```

Classifier script SHA: `35cf14ccdd4a5835282dcbf46ea2349fda729dfe1691a07c77eee56935ed8c31`; reconstruction script SHA: `c75bc4df1780723c8c94c7a661b11b7eb01f02186e60bf1497c45ce4bdfe36e7`. No further replay, production change or GPU work was performed after these saved-data checks.
