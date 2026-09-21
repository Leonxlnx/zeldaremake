# Foot-family coverage diagnosis

**The former 327-vertex footprint omitted 210 low toe vertices; production now measures the complete 537-vertex foot family.** This static audit identified the missing region (127 distinct positions) inside the same 12 mm sole band. These are drawn vertices, and no toe animation keeps them clear. The static audit alone did not establish terrain penetration.

The subsequent [paired CPU surface replay](../2026-09-21-complete-foot/cpu-comparison.json) measured actual intersections on unchanged asset89df with the old footprint: **78/470 ascent poses, worst −309.193 mm; 131/470 descent poses, worst −46.443 mm**. The adopted family footprint removes negative vertical clearances in all **940 sampled poses**, with minima **+1.188 mm ascent / +2.092 mm descent**. Flat idle/walk/run root/skeleton trace hashes remain exact. This contact fix does not establish natural stair posture or arbitrary-route collision freedom; the [complete-foot report](../2026-09-21-complete-foot/README.md) records the pose changes and test limits.

Historically, `measureFootprint` selected the dominant **ankle** bone and the lowest 12 mm. The old 327-point replay used that rule. Its separate `ankle weight >.95` / lowest 5 mm selection creates eight extremal markers; it did not define the 327-point set. The corrected source sums weights on the ankle and its descendants, requires a total above0.5, and keeps the existing 12 mm band. For this exact asset, that predicate matches the independent ankle-or-toe dominant-family selection below:269 left +268 right. The GLB and its animations remain unchanged.

All values below are raw glTF rest coordinates, with Y up and Z forward. Both feet have minimum Y=6.968902890 mm and a band ceiling of 18.968902890 mm. The skin's sole marker is effectively at Z=0; reported forward values are mesh coordinates, without rounding them into a claimed world-space contact guarantee.

| Asset / foot | Former ankle points | Previously omitted toe points | Full family points | Former forward max | Family forward max | Former missed reach |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current89df / left | 163 | 106 | 269 | 123.856 mm | 200.737 mm | 76.881 mm |
| Current89df / right | 164 | 104 | 268 | 118.418 mm | 200.757 mm | 82.339 mm |
| Held4dcf / left | 163 | 106 | 269 | 121.839 mm | 189.663 mm | 67.825 mm |
| Held4dcf / right | 164 | 104 | 268 | 117.109 mm | 189.681 mm | 72.572 mm |

The lowest previously omitted points are only **0.460 mm left / 0.400 mm right** above the global sole minimum. On current89df, the region at forward150–180 mm reaches within0.846/0.787 mm of that minimum; forward180–210 mm reaches within1.706/1.547 mm. The farthest individual points are higher (11.890/10.898 mm), so the low and farthest measurements should not be conflated. Left outer width extends another2.563 mm and right outer width0.700 mm beyond the former ankle-only selection. The current asset's complete height bands and forward-height profile are in [coverage-current.json](coverage-current.json).

The selection includes every same-side body vertex within the band. Other primitives are above200 mm. Minimum summed ankle-plus-toe weight among selected vertices is greater than0.9999999. Held4dcf is a historical, optional shorter-toe art comparison and was not adopted. It uses the same537 indices; its forward-coordinate differences are separate from the source-only support fix on89df.

`toeL` and `toeR` are direct children of their respective ankles. In **idle, walk, run and stairs**, every toe translation, rotation and scale track contains two identical STEP keys. This proves the entire clip has constant toe-local TRS, rather than merely finding a few matching sampled poses. Candidate4dcf preserves these tracks exactly. Differences between clips and the bind transform are float residues: rotation at most0.00000151°, position at most0.03484 µm and scale components at most3.58e−7. There is no authored toe roll or lift relative to the ankle that would explain excluding these points.

[foot-family-selection.json](foot-family-selection.json) is the preserved537-index fixture used by the CPU surface replay, including the original/omitted subsets. Body mesh2, primitive0: `Link_skin_eye_study_body.034`. Skeleton indices are13/14 (`ankleL`/`toeL`) and17/18 (`ankleR`/`toeR`). Independent rule: dominant joint belongs to that side's ankle-or-toe family, and rest Y≤family minimum+0.012. Default reproduction below regenerates the same indices without the held GLB.

Default reproduction reads only the tracked current production89df GLB; the ignored held candidate and local replay script are not required:

```powershell
py -3.14 art/characters/link/progress/2026-09-21-sole-coverage/measure.py
```

It writes `coverage-current.json` and `foot-family-selection-current.json`, proving the same537 indices. To repeat the optional held4dcf comparison when that local GLB is available, pass its path explicitly:

```powershell
py -3.14 art/characters/link/progress/2026-09-21-sole-coverage/measure.py --held art/characters/link/progress/2026-09-21-boot-tip/candidate.glb
```

That mode writes `coverage-comparison.json` and `foot-family-selection-comparison.json`. Neither mode rewrites the historical local `coverage.json` comparison or the replay's `foot-family-selection.json` fixture. The held GLB and optional comparison outputs are not required for the default check. Each selected asset must match its exact89df/4dcf hash. The script uses only Python's standard library; no Blender, browser, GPU, production edits or dependencies are needed. The537 vertices still describe a low rest band; they do not by themselves prove triangle-interior, upper-toe, cuff or arbitrary-route collision freedom.
