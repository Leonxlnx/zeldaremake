# Original membrane surface for the two post pods

Separate study after `6686b0b`. The post PointLight reduction at `ab7796e` has been reviewed
in actual world and L01/L02 images: quieter rope/wood, retained amber glow. Its 1.2 intensity
stays unchanged here. The earlier hedge surface source remains independently pinned.

Original owner boards 05/06 show uneven branching veins through a warm seed membrane. Actual
post-pod closeups still have a broad smooth orange body. This new original 256-square atlas
uses unequal curved primary veins, forks and broad membrane variation to modulate emission.
It does not add embossed geometry or a normal map. Green sepals retain their current material
coordinates and therefore do not gain texture from this body-only atlas.

## Scope and ownership

One new leaf module, structures/postPodMaterial.ts, creates one orange material clone and one
owned atlas shared by the two posts. Minimal structures/index.ts import, post-only routing and
disposal lines were announced to Fable in PR2 comment 5647059948. Existing house/branch/log
lamps, shared material/map bytes, all meshes, rig/swing, RNG and placement remain exact.

The clone preserves all other original maps and material parameters. Its explicit disposer
releases only that clone and atlas, exactly once even when called twice. The temporary atlas
generation arrays are not retained. Cost: one material, texture and color program; 262,144
base texture bytes or 349,524 including the complete RGBA8 mip chain. No added draw, geometry,
vertices, triangles, light or shadow pass. This is payload accounting, not measured GPU memory.

## Filtering and emission

The old warm vertical envelope and encoded row mean multiplier .9 are retained. Uneven
absorption varies the membrane while avoiding an increase in mean emission. Periodic U paths,
linear/mipmap filtering and bounded broad variation keep distant bodies visually coherent.

CPU projection of the actual post bodies gives L01 184×199 pixels and L02 76×83. With perspective
UV interpolation and approximate linear-light/trilinear mip filtering, mean emission is
99.895% / 100.955% of the original. Median nominal primary core width is about 3.32 / 1.25 pixels.
Primary branches may read in both details; fine forks will soften in L02 and disappear at
distant gameplay scale. These calculations omit GPU anisotropy, world occlusion, lighting,
tone mapping, AA and bloom; they are not predicted screenshots or visual acceptance.

Base rows at V >= .85 are black. Coarse mipmaps can still average glowing rows into that band,
so the owned color program multiplies emission by `1 - smoothstep(.80, .85, vEmissiveMapUv.y)`.
Every body triangle ends at V <= .80 and passes; every other triangle uses constant V=.95 and
has zero emission at every mip. No triangle spans both bands. This keeps distant bodies lit
without allowing their opaque bindings to emit from a coarse mip.

## Verification and actual gate

The frozen proposal is pinned to published ab7796e, whose relevant structures remain exact at
6686b0b. Replay preserves both posts' complete position/index/normal/color/UV bytes, transforms,
shadow flags, following RNG values, rigs, swing and point-light settings. Only the two existing
pod mesh material identities differ. Installed Three r186 prefix/include expansion confirms
the emissive UV gate; removing it reproduces the original fragment instructions, and ordinary
depth/distance programs remain exact. This is a CPU shader check, not a GPU compile verdict.

The permanent ownership test covers deterministic atlas data, borrowed-resource isolation,
unchanged base program/uniforms, cache separation and exactly-once disposal. The ownership test, typecheck/build (108 modules) and exact integration-boundary check pass.
Actual CI remains the visual gate. Compare matching views with the prior source to judge organic surface
variation, visible primary veins, retained warmth and no glowing green leaves or bindings.
The existing within-source world pairs still compare upper-flight gain 1 and 3, not atlas off/on.

Frozen factory SHA-256: ec27f7b601a56d29cc3714bb4c5f17cf5dfc8f1cc8a57c325a20d8560cc3ca3d.
Original atlas SHA-256: 15ee4f759ce9b8ed5b908a68f300aa6871eb6dd1c23ca67b5d1bef5af89ddfdf.

## Actual a350849 result

CI 34704806867 and all 12+4 publication contracts pass at source
a350849993d05141e8d640775b2b3c6d919facd6, tree 805192155fc72988cf06af40fc2846be5a4dd17c.
Root and two independent reviewers inspected original L01/L02 and matching historical controls.
Faint irregular branches improve the nearby L01 membrane; at L02/gameplay distance the pod
remains mostly smooth amber. Keep this small closeup improvement, without claiming finished
reference-level detail. Existing pale rims remain; no new glowing bindings or loose leaf bases.

Exactly one material, texture and program are added (123 / 69 / 73 total respectively).
Geometry, placements, depth, cameras, lights [1.2,1.2], submitted triangles and calls remain
exact against 668. All images have zero retries/errors/warnings. Historical B/E, D and both
sign JPEGs are byte-identical. Archive 886fbfe4e01ef49c17fca18ebafc885a9d66b0a6 retains every
prior dated file; source ZIP contains all 364 tracked files byte-exact.

Actual images: progress/2026-09-12_162536040-a350849 and
details/2026-09-12_162723902-a350849 on captures/astra-environment.
Same-source world pairs still test canopy gain 1 / 3; historical matching variants isolate
the membrane. These static JPEGs do not establish motion stability or hardware frame rate.
