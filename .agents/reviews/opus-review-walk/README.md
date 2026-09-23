# opus-review — player-height walk of the round-47 head

World: `ccbe867` on `agent/opus-review` = `9975956c` (`cursor/kokiri-world-phase1-f65e`, round 47
merged) plus this branch's review files. **No `src/` change is in it** — `git diff 9975956c..ccbe867
-- src/` is empty, so these frames are the integrator's world.

## How the frames were made

60 poses at player eye height, rendered through the capture API on this machine's GPU:

```
ZR_NATIVE_GPU=1 node <renderer> --dist dist --out <dir> --settle 14 --poses manifest.json
```

`manifest.json` here is survey-2's 48 poses (`art/environment/survey2/manifest.json`, so the
vocabulary matches the team's) plus **12 new ones** for the ground round 47 added, which survey-2
could not have covered:

| pose | where |
| --- | --- |
| `x-arch-approach` | under the log arch looking north through it (the owner's ref-03 view) |
| `x-arch-tunnel-n` / `-s` / `-u` | inside the tunnel, north / back south / along the floor |
| `x-northpath-n` | on `northPath` looking into the clearing |
| `x-clearing-n` / `-back` / `-stones` | in `northClearing` toward the ledge / back to the arch / at the stone circle |
| `x-ledge-foot` / `x-ledge-top` | foot of the `ledge` flight / on `ledgeTerrace` looking back |
| `x-lookout` | on `plateauLookout` over the plaza |
| `x-house-door` | Saria's threshold, closer than `sn-house-door` |

The twelve carry `groundEye: 1.45` / `groundAim: 1.3` instead of a fixed y, so the renderer resolves
their height from `__ZR__.probe(x, z)` and they stay at eye height if the terrain moves.

## Crops

`opus-walk-<id>-<slug>.jpg` — each carries its pose name and the normalised region in the label bar,
so any of them can be re-cut from a fresh render of the same pose. `01`–`17` are the ranked defects
in the INBOX thread of 2026-09-19 20:45 UTC; `G1`–`G4` are the round-47 claims that **hold** and
should not regress; `R47`/`R47b` are shell-1's bag screen, which round 47 shipped unverified.

## The short version

Round 47 fixed what you can touch and left what you can see. Inside about two metres the world is
genuinely good now — the lantern bough's bark cords, the arch belly's torn plates, the furnished
hollow, the fern banks. Past about eight metres it is still smooth cones, flat planes and
hard-edged cards, and the new ground beyond the arch is built almost entirely out of that far
material, so the tunnel walks the player straight to the weakest layer in the project.

Two of the seventeen look like bugs rather than art and should be cheap: opaque sky-blue rectangles
drawn in the far-crown layer (`08`), and a flat unlit polygon sitting over the arch bark (`09`).
