# Baseline provenance and independent A/F review

CPU/file audit and raw-image review by `native_baseline_audit`, 2026-09-23 17:44 UTC. No source changes, image generation or additional GPU boot.

## Reused baseline identity

The six PNGs at `E:/zeldaremake-astra-motion-sept21/art/environment/astra-canopy-packed-integration/native/` record **105a61d545674132e6400366b96a84d37046c08b**, not the later evidence checkpoint **4ad2fb5085cdf23dc2fe627588c418f8cc4a87da**. Reuse for the latter is justified by exact render-input equality:

- `src` Git tree at both commits: `1b82a6fbcb817f94cdd8f50b8c53223a48723eac`.
- `public` Git tree at both commits: `f02460242ab71407f1e09639fd6894530b44a7b1`.
- The full intervening diff contains only agent logs, artifact evidence and `.gitattributes`; no build/runtime inputs changed. Explicit checks also find no changes in `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json` or `gauntlet/scripts/lib/browser.mjs`.
- Baseline manifest file SHA-256: `65521ebff79b2ba82dd5d162e35cba45f15ece6ed25c900d60e1f4f0befdc6e3`.
- Baseline `source.diff` is empty; SHA-256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` matches the manifest.
- Baseline bundle `index-BeSuDGjf.js` exists in the motion worktree's `dist/assets`; its SHA-256 `19266c65488e136130ecc15f15a8a16b00a49069689162cb2559582db55e3afa` matches the manifest.

All six baseline PNG file hashes were recomputed and match their manifest entries:

| View | SHA-256 |
| --- | --- |
| A_stairs | `9c90c313115a6d7b8cdf6ea20924a4b44f0dd83a421cde655906a7ee72e3f188` |
| B_house | `498829447b3b71d8ad15cd3fbec87e07d93cab06cca6f37ea1ef4df352bbd6cc` |
| C_lookback | `07b93440432aa5ee5376af690d7e4436fae59d3e4d31596862c4e1baa9d8e71a` |
| D_log | `e19c0886e714e855f1d0224b65b58a2cb7c54a3c75940085cd73f6b3be897dea` |
| E_ground | `498829447b3b71d8ad15cd3fbec87e07d93cab06cca6f37ea1ef4df352bbd6cc` |
| F_canopy | `d96cc5db890b371d95e18966b834e512a996144616d1bce815f1e8bc2cfda389` |

## Matching capture inputs

`art/environment/astra-distance-crown-clarity/native-capture.mjs` hashes to `1c12ca8459d9d1a8d5a5bb28536356443a550000272d89d8b3eab17cc9a1b6ca` in both worktrees and both manifests. Its capture path uses 1280 x 720, pixel ratio 1, `capture=1&dev=0&hud=0&quality=high`, time 12.6, 12 initial zero-delta render steps and 2 additional zero-delta steps per default variant. Neither settings file supplies scene, lighting, fog, postfx or material overrides. The launcher requests ANGLE D3D11; these manifests do not record a renderer/device string, so this audit does not independently identify the physical GPU.

`src/world/layout.ts`, all `src/camera` files and `src/capture/api.ts` are unchanged between recorded baseline105 and candidate4b2. The six candidate manifest camera objects (position, direction, FOV) and lighting objects exactly equal the baseline objects. All six report time12.6, 1280 x720, pixelRatio1. Authored camera inputs are:

| View | Position | Target | FOV |
| --- | --- | --- | ---: |
| A_stairs | `[0.4,1.8,8.6]` | `[6.7,0.89,-5.8]` | 46 |
| B_house / E_ground | `[0,1.5,2]` | `[5,1.7,-12]` | 46 |
| C_lookback | `[2.33,1.45,-7.67]` | `[4.03,0.65,5.23]` | 46 |
| D_log | `[0.2,1.45,-3]` | `[4.5,2.75,-42]` | 48 |
| F_canopy | `[-1.96,1.8,4]` | `[9.7,0.98,1.31]` | 46 |

Candidate source is `4b2fe8e6d7604d45e1f47f3be0c51c2859732a08`; its `source.diff` is empty. Candidate bundle `index-DwReWLkW.js` hashes to `c76ed18510d9a07180fec9abccaadc9f4a585ea3b096dfec441e04e7b8fa0346`, matching its completed manifest. Recomputed candidate A-F hashes all match; `errors` is empty. Candidate manifest file SHA-256: `f598815c8ab9f4512bc551a45cd5f8971537a06301703b04eaeb639aec790edf`.

The seventh pose `s2-join-close` is reused exactly from `b510b152:art/environment/owner-2026-09-23/pass3/stair-close-poses.json`: position `[8.194,1.44,-0.417]`, target `[8.973,1.3,-1.532]`, FOV45. The Git object was inspected directly; no new pose was invented. It was initially candidate-only; the parent subsequently captured this single pose from the verified existing root bundle. The matched result is reviewed below.

## Independent review of raw A/F PNGs

Both baseline and candidate originals were opened directly at their saved resolution; no collage, generated image or edited scenery was used for this review.

- **A_stairs:** The main flight changes from conspicuous pale silver bars to brown, irregular timber lips and earth treads. The repeated bright stripe pattern is substantially reduced, and adjacent logs show more variation. The cost is a darker, lower-contrast flight, especially near the landing; individual step edges remain legible. The house entrance, path junction, stair footprint and surrounding tree/canopy framing show no obvious displacement or new obstruction in this view. This is a material/geometry improvement in natural timber appearance, not a claim of improved reference-image score.
- **F_canopy:** The closer oblique view confirms rounded, varied brown edges instead of near-identical pale bands. The new dirt/timber color joins the adjacent bank more naturally. The upper steps blend together more than before, while the lower risers remain distinct. No obvious new gap, detached log or foreground occlusion is visible at the raw full-frame scale. Existing broad flat-looking canopy masses remain; this import does not resolve them.
- **Budget:** A changes from 479 draws / 8,867,001 triangles to 484 / 8,757,903; F from 449 / 8,312,047 to 451 / 8,177,841. Both remain under 700 draws / 9M triangles. These are fixed-view submission counts, not playback FPS, collision/boot-contact validation or Phase1 exit evidence.

Visual recommendation for this bounded review: retain the candidate for native owner review, with the darker upper flight disclosed. A/F show no obvious blocking visual regression; the remaining four fixed views are reviewed separately by the parent reviewer. The close pose is assessed below.

## Historical close-pose search

A bounded read-only search found no reusable source-equivalent `s2-join-close` baseline. The named pose and exact position were searched across pose/settings/manifest/receipt JSON files under `art/environment` in every registered worktree. Only this review's candidate settings/manifest and newly prepared baseline-close settings matched. The pose name and image history were also checked in all local Git refs.

The partner pose JSON and `pass3/stairs-join-close.jpg` first enter history at `449ab9c932cac108c1b26fff8f5e51bcc318be84` (2026-09-23 08:04:46 UTC). That commit's stairs/log source differs from baseline105 by 115 additions / 29 removals across `stairs.ts` and `logNosings.ts`; it follows `d4f1feec`'s varied-log geometry and `4ebae57c`'s darker slab lip / spiral-grain changes. The partner README explicitly describes its close image as evidence of the already-changed dark lip. It therefore cannot substitute for root105/4ad at the same pose. This provenance finding justifies the parent's single missing baseline-pose capture; it does not by itself attribute the candidate's dark angular joints to a regression.

## Independent matched close-pose finding

The parent's completed root capture is `baseline-close/s2-join-close.png`, SHA-256 `4db7fdcf2f1f3ed18df22be531f9358247ea1c24c3f3c498ede59d0820e03714` (recomputed, matching its manifest). It records source `4ad2fb5085cdf23dc2fe627588c418f8cc4a87da`, the verified `index-BeSuDGjf.js` bundle hash above, the identical capture-helper hash, an empty source diff, `complete: true` and `errors: []`. Its camera and lighting objects exactly match the candidate close pose; both report time12.6, 1280 x720 and pixelRatio1.

Directly opening both raw originals confirms that **the large dark angular notches already exist in the accepted root**. In particular, the near-rectangular dark notch around image `(675,245)` under the middle upper timber, and the larger triangular recess around `(660,423)` below the next timber, appear at the same joints in both images. Long dark separations under the upper timbers are also already present. The changed log profile slightly changes some upper boundaries, so this is not a claim of pixel-identical joint silhouettes. The raw pair does not show these conspicuous dark recesses being introduced by this import, and a color screenshot alone cannot distinguish every open mesh gap from a deeply shaded face.

The candidate replaces repeated pale bark bands with varied longitudinal brown grain and changes the nearest flat tread from green-gray stone to pale earth. The inherited angular joints remain a visible close-range limitation; they are not evidence for rejecting this candidate as a new gap regression. Close-pose counts also predate the import's hero-envelope concern: root 437 draws / 9,841,463 triangles, candidate 442 / 9,723,855 (117,608 fewer triangles, 5 more draws). This diagnostic was above 9M in both builds; no new triangle-budget regression is established by it.
