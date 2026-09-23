# Integrated forest and character checkpoint

Source `6231cffbfec78d405cb3e83064bf3f68c7daca8d` combines the accepted clearer crown atlas/distance haze and Link `7f406e40` with Fable's reviewed storage, rock material, prop, grass, northern roof and audio changes. The source-only import is `ee00f2ff`; its [scope and checks](https://github.com/Leonxlnx/zeldaremake/blob/1c80f4bf/art/environment/astra-canonical-sync/README.md) identify all 13 changed files.

Medium white-bark shadows and the existing 120 m distant-tree switch remain enabled. Fable's canonical branch currently makes different choices there. The B3 rock regression is retained. Experimental upper-crown admission and detailed distant crowns are not in this checkpoint.

## Native verification

Typecheck and build pass. The original capture helper ran the two fixed cameras at high quality, 1280 x 720, pixel ratio 1 and simulation time 12.6, without scene or material overrides. Both completed with no page/renderer errors. These are unedited native GPU images, not an FPS benchmark or full new gauntlet result.

| View | Triangles | Draw calls |
| --- | ---: | ---: |
| A_stairs | 8,889,627 | 459 |
| F_canopy | 8,180,156 | 416 |

A has 110,373 triangles left under the existing 9 M fixed-view limit. Further crown detail must fit this budget through measured implementation changes; the rubric is unchanged.

![A_stairs](native/A_stairs.png)

![F_canopy](native/F_canopy.png)

[Settings](settings.json) and [native manifest](native/manifest.json) pin cameras, hashes and render statistics. `native/source.diff` is empty. The build is `index-Hs0AcnGr.js`, SHA256 `e9abdc2c1c7c84b495d81a7bc834b9b87ce365c92baf9c73a94f40c03257acbb`. The served character SHA256 is `7f406e40e65430ed3c11bd045e2e9482dae8cee8122e9869ed62a2c3cfecbbda`.

Reproduce from this source revision after `npm run build`:

```text
node art/environment/owner-fable-canopy/tools/capslot.mjs astra-integration -- node art/environment/astra-distance-crown-clarity/native-capture.mjs art/environment/astra-latest-integration/settings.json
```

The helper's generic `evidenceKind` describes its reconstructed-view capability; these two images use the repository's named fixed viewpoints. CPU ray probes were not enabled because the reviewed storage change releases uploaded tree buffers. Nothing disables that memory optimization for these captures.

The accepted character's editable Blender checkpoint is saved outside Git; its [receipt](../../characters/link/progress/2026-09-22-right-strap/combined-native-checkpoint.json) pins the local file and all four clips. [Five motion comparisons](../../characters/link/progress/2026-09-22-run-posture-game/README.md) document the posture improvement and remaining limitations. Fable imported the character as `3e34a3cd`, [confirmed here](https://github.com/Leonxlnx/zeldaremake/pull/2#issuecomment-5781584250).
