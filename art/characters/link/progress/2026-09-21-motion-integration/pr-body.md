Link's run previously had abrupt shoulder jumps, an upright torso and straps that followed head turns. This integration repairs the stale arm keys, adds a modest forward run posture, shortens the boot tips and attaches both shoulder straps to the chest. Current asset `7f406e40` changes only the run chest rotation and 100 right-strap joint indices from the previously delivered `1873fc17`; protected clips, leg motion, geometry and textures stay exact.

Ground support measures the complete ankle/toe footprint, checks raised heels against rendered timber and calculates hip clearance from the retained world foot target. Props also block the player on decks. Extreme stair knee folding, hand shape and residual clothing intersections remain unfinished.

The world incorporates Fable's reviewed storage, rock material, prop, grass26m, northern roof and audio work, sharper crown leaf silhouettes and lighter distance haze. Medium white-bark shadows and 120m distant-tree switching are retained. Five atlas and four haze comparisons preserve render counts. The current integrated native A/F captures have no renderer errors and remain below9M triangles. Nearby crown geometry and upper-canopy admission fixes remain separate work in progress.

Validation: typecheck/build and raw-source regressions pass. The new posture passes 600 flat frames, 300 transition frames, gaze and zero-dt checks. Two matched native GPU walk/run/idle replays preserve all 300 root/hip/foot/IK records, with no page errors or reach clamps. The original 113-phase native contact total improves 1289 to1269; the peak rises21 to24 and below-armpit count21 is unchanged. The combined-asset checker preserves both independent proofs. Full gauntlet CI passed at `83ebbc63`; the new asset has its own subsequent CI.

- [Five game comparisons and videos](https://github.com/Leonxlnx/zeldaremake/blob/agent/astra-motion-sept21/art/characters/link/progress/2026-09-22-run-posture-game/README.md)
- [Posture validation](https://github.com/Leonxlnx/zeldaremake/blob/agent/astra-motion-sept21/art/characters/link/progress/2026-09-22-body-posture/DELIVERY.md)
- [Default-asset verification](https://github.com/Leonxlnx/zeldaremake/blob/agent/astra-motion-sept21/art/characters/link/progress/2026-09-22-right-strap/COMPOSITION.md)
- [Five crown comparisons](https://github.com/Leonxlnx/zeldaremake/blob/9926541b/art/environment/astra-distance-crown-clarity/README.md)
- [Latest integrated forest views](https://github.com/Leonxlnx/zeldaremake/blob/agent/astra-motion-sept21/art/environment/astra-latest-integration/README.md)

The pinned Quaternius CC0 source receipt and license document the animation input. These incremental changes do not claim final visual quality, complete fan-game rights or an FPS improvement.
