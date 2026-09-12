# Portable frozen sleeve 0.20 proof

This package reconstructs the existing proposed sleeve experiment without a full `materials.ts`
snapshot or another ignored scratch directory. It preserves the original report as
`README.frozen.md`, and preserves `pin.json`, `freeze.json`, `evidence.json` and
`sleeve-angular.patch` byte for byte. Original historical paths in the frozen report identify
its preparation context; the portable checker does not read them.

Only published commit **`901b65b9ec45a1355cf3169d245e93892d98b7da`** and its reachable tree/blob
objects are required. Its tree is `f64208c218dfe51c1ade44f0342e40a158385ee8`. Earlier proposal,
adaptation and unpublished integration commits mentioned in the original pin are historical
observations, not reproduction dependencies. The checker also requires the repository's
installed locked dependencies (including Three r186 and TypeScript), Node >=20, `git` and `cpp`.

## Exact reconstruction

`source.mjs` reads published 901b objects into memory. Two unique-context edits from `edits.json`
add the one import and the one call in `materials.ts`. The helper is reconstructed directly
from the existing patch's 34 added lines. Both reconstructed files must match the frozen hashes:

| Item | SHA-256 |
| --- | --- |
| Published baseline `materials.ts` | `a1ff83add8f3c3ef13a8fe1f9da7ce432b23ae6dbd69ffb7ac24473dcc2d7da1` |
| Candidate `materials.ts` | `e024a03cbb46900c5403d4dea7cbda8f67cde4e48fe84aa40a18aa7abfe4c13e` |
| Exact original 34-line helper | `f4c4ccd7501391c9de4bddb9837a1a10070cec098d8dc6e9c264effc3deab7f7` |
| Preserved patch | `37a1076ff9427977ea5b1add329b1473199c809f79166c76743914fc335b7955` |
| Preserved focused evidence | `5002ddc662f7d1178722b9fc5d8bfb537ea7f13b158bb2e948981a03d3e20621` |

The strength remains exactly **0.20** and the cache suffix remains
`|sleeve-hemi-angular-020-v1`. Removing the import and call reconstructs the baseline material
bytes exactly. The shared floor, map identities, tint, normal scale and other material inputs
remain as described in the frozen report. Root owns any application to LIVE and the actual trial.

## Existing focused check, adapted once

From the repository root, with this intact directory placed where Node can resolve the installed
project dependencies:

```sh
node <package-directory>/check.mjs
```

Review files resolve relative to the module. The source resolver exposes `candidateSource(file)`
and `helperSource()` for in-memory reconstruction; it writes no source file. The existing check
keeps its original cases: one extracted real bark constructor and sleeve clone, floor/helper
hook ordering and receiver/cache chaining, unchanged inputs/uniforms/vertex source, the exact
0.20 expression, the no-hemisphere guard and missing/duplicate-anchor rejection. It uses the
same source-only Three program construction, `cpp` preprocessing and one virtual `noEmit`
typecheck. For portability that same typecheck now reads the published source tree and pinned
`tsconfig.json` plus the two in-memory candidate modules, rather than depending on current LIVE
TypeScript files. It does not invoke the material factory or world construction.

The single adaptation run reproduced the original `evidence.json` values exactly, including
fragment and installed-Three program hashes. The checker compares against and preserves the
receipt; it never overwrites it. `adaptation.json`, `adaptation-check.log` and `SHA256SUMS`
record the packaging verification. No new cases, measurements, world/RNG/GPU tests, build or
render were added. The original frozen directory was not modified.

## Actual appearance remains pending

The original hold was an art decision. This package preserves that boundary. Historical Astra
CPU floor-proxy medians were **A 0.9832, B 0.9493**; B was about **5.1% darker**, so the trial
is not brightness-neutral. Historical mathematical multiplier bounds were 0.88783–1.11217.
These are historical Astra-context values, not a Fable 901b lighting target, a recalculation
for the current scene, or displayed-pixel predictions. They exclude real shadows, specular/PMREM,
AO, fog and postprocessing. No proxy values were remeasured during packaging.

The next actual paired A/B originals must establish whether fissures and curved bark respond
usefully while the underside remains acceptable. Houses, recesses, trunks, foliage and pods
remain comparison controls. Source correctness does not establish current draw/program counts,
GPU compile/link success or visual quality; actual validation is still pending. Reject an
imperceptible or worse result. Keep the frozen 0.20 trial isolated: no stronger effect, colour
fill or compensating global-light adjustment is part of this proposal.
