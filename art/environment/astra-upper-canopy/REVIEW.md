# Upper giant canopy camera admission

Source candidate **16544efc**, based on the accepted parent **6231cffb**. Original canonical study: bcf3880d on 7a7a3502. No push or production adoption. **HOLD for W38 headroom:** native A is 9,006,541 triangles, 6,541 above the unchanged 9,000,000 ceiling.

The visual result is a modest improvement. A keeps its composition. F gains finer leaves and twig detail around the right-hand branch, including some exposed branch tips. The upper midground gains smaller sprays and clearer forks. The large foreground leaves in the upper diagnostic and the broad flat masses in F remain; this does not reach the layered, irregular crowns in owner concepts 05/07. The upper diagnostic contains intervening foliage and is not an isolated giant or an owner screenshot match. No obvious new hole or lighting regression was found in these three original-pixel comparisons.

## Scope and behavior

- Only giant.ts, nearCanopy.ts, index.ts near-canopy registration/selection/audit, and the existing lodPool.test.mjs changed.
- Giant registration no longer rejects local centres above 25 m. Hero viewpoints no longer permanently reject or shorten canopy admission. The same physical camera rule applies to every mode.
- Selection measures 3D distance to each authored crown envelope. Existing 26/30 m large-tier and 22/26 m small-tier hysteresis, 64 lobe slots, 12 limb limit, and pool byte caps remain.
- Ordinary giant lobes retain branch records and conservative bounds until the existing pool requests a chunked build. Their far foliage stays visible while queued. Persistent foliage and initial limb-dressing measurements retain the existing eager behavior.
- Explicit camera re-poses retain synchronous completion for deterministic captures. Walking/free-camera updates remain chunked. No new pool, rendering system, noise, material, texture, layout or distant geometry was added.
- Root's white-bark mid shadows and 120 m north-stand switch are preserved. No Fable roof/white-bark/canopy source changed.

The actual authored giant centres reach 24.914 m local and 27.342 m world. Thus the removed 25 m local-height gate does not currently admit additional authored lobes; it protects higher future authored crowns. Current changes come from the hero cuts and physical-envelope distance. All 138 built geometry records outside near-canopy are byte-identical in the authored CPU comparison, including far-tree buffers.

## Native evidence

Original PNGs and full manifests are in `before/` and `after/`; `native-pairs.png` is a labelled half-size viewing sheet. Raw depth `.f32` files remain local and ignored; their dimensions, format and hashes are retained in the manifests. Full local evidence commit994a044e is preserved separately; this compact sibling does not inherit it. AMD Radeon 780M/D3D11, 1280×720, high quality, fixed time 12.6, 12+2 zero-dt frames, no tuning overrides. All camera, lighting, dimensions and time checks passed; errors arrays are empty.

| View | Before triangles / calls | After triangles / calls | Delta |
|---|---:|---:|---:|
| A_stairs | 8,889,627 /459 | 9,006,541 /471 | +116,914 /+12 |
| F_canopy | 8,180,156 /416 | 8,431,517 /444 | +251,361 /+28 |
| upper-envelope-southwest | 6,522,457 /337 | 6,669,883 /353 | +147,426 /+16 |

The upper pose is p = [-45.96, 29, 2.87], t = [-17.96, 26.78, 2.87], FOV 46. Its first visit required 24 missing canopy builds. After the A/F round-trip, its warm PNG, camera and submitted counts are exactly identical. The stricter complete-pool-eviction test passes independently on the actual CPU selection closure with six zero-dt update frames.

The gauntlet comparator reports changed-pixel fractions at tolerance 8 of 0.00094 (A), 0.00411 (F), 0.03323 (upper). Reference-video SSIM changes are +0.0001 (A), −0.0016 (F); they are disclosed composition measurements, not an art-quality score.

A/F baseline originals are the parent's exact 6231 capture; the original manifest and PNG hashes are retained. The extra upper baseline uses the same frozen bundle, index-Hs0AcnGr.js (SHA256 e9abdc2c1c7c84b495d81a7bc834b9b87ce365c92baf9c73a94f40c03257acbb). Candidate bundle: index-BfmOWOHI.js. `builds.json` hashes every frozen served file. Common render assets match exactly; baseline-only files are unused Link trial GLBs/Three diagnostic modules, and the changed Link SOURCE.md is documentation. The frozen builds remain local and ignored.

## CPU and cost limits

`cpu-report.json` records the existing full-tree worker observations. All 316 deferred giant lobes fit their conservative bounds and byte estimates. The worst authored selection—largest 64 lobes, largest 12 limbs, and persistent foliage—is 43,019,796 bytes (41.03 MiB), below the 64 MiB small pool. Native maximum resident/pinned bytes remained within the 256 MiB large pool. Logical folded-triangle counts do not mean far geometry stopped being submitted; shadows still need it.

Explicit cold re-poses measured about 1.6–1.8 seconds in the CPU replay; this is a deliberate capture/camera-jump cost. Native ordinary pool chunks stayed below 6.9 ms in this short study, with no chunk above the existing 12 ms long-step threshold. This is not a walking frame-time benchmark. No performance improvement is claimed.

Validation: 16 pool/builder regressions, typecheck, build, diff checks, native comparison guards and anti-cheat pass. Anti-cheat's static checks report no gauntlet/out/last take in this isolated tree; no official take or Phase 1 exit claim is made. Parent handles integrated evidence and the final required take.

Reproduction: `node --test src/world/trees/lodPool.test.mjs`; `npm run typecheck`; `npm run build`. The evidence's inspect-authored.mjs reuses the existing bank geometry worker with observation hooks (path/hash in the report). summarize-cpu.mjs consumes its exact before/after JSONs under gauntlet/tmp/astra-upper-canopy. compare-native.mjs validates the committed originals/manifests and rebuilds the viewing sheet. GPU capture.mjs uses frozen hashed builds through the shared capslot wrapper; sessions 77836 and 5806 exited and the slot was explicitly released.
