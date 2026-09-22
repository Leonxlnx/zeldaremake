# Bank canopy surface foliage — REJECTED local study

Source candidate `063772a4bfc848733e060ded98614d04a626e3d4`, based on canonical
`520537e6d72a26bddbfb151ca33b54f613576038`. Only `trees/giant.ts` and
`trees/nearCanopy.ts` change. The original dark backing is restored for bank lobes
24/25/26, and their existing near-canopy writer places attached fine-leaf patches
around actual core/rim sites. Original rim cards, all other far foliage and the
authored records/caps remain unchanged. Author and independent native review reject
this candidate. Do not import it. The current 0.60 bank remains in use while the
visible leaf coverage is measured from the existing geometry and F camera.

The previous 0.60 recession improved the leaf contours but opened large bright
gaps where the reference requires dark canopy. This was independently confirmed
in the isolated raw pair, matching Fable5's r54 section D. The suggested 0.78
backing was rejected before editing or rendering: representative F/C rays require
scales 0.99897/0.98592, above the 0.79007 current leaf-perimeter bound. A 9x9 patch
loses all 75/81 F and 72/81 C original core hits at 0.78, including capture-time wind.
The replacement therefore restores coverage and moves the fine foliage outward.

## CPU / source validation

Independent `cpu-proof.json` and the original author's `author-surface-proof.json`
agree on source 063772a4. The original 1,479 core vertices are restored; 560 other
geometry records, 423 other near parts and 31 current white-bark records remain
exact. All placements, original wood records, material routes, shadow flags and
LOD bindings are unchanged. The new wood/leaves fit within the original total
lobe geometry bounds, including already-authored rim cards, through all wind
phases. `streams-and-floor.json` records 1,034 unchanged RNG streams and 14,052,615
identical draws; only the selected near-part forks differ.

The unchanged authored caps are 2,800/2,100/2,200. Accepted whole leaves are
2,800/2,051/2,200: 49 whole leaves exceed the limits and are discarded. Total near
geometry is 66,020 triangles, including 9,612 wood triangles, and 4,995,768 buffer
bytes: +580 triangles/+29,688 bytes over the previous bank meshes. No new mesh,
material, texture or renderer is introduced. Source typecheck/build pass in the
independent review checkout.

Every new group 26 vertex stays above 4.75 m through wind (author minimum 4.820817 m).
The original opaque core's minimum is 4.75000023 m. Existing unchanged card corners
reach 4.663728 m: earlier floor checks covered core/far laminae/near parts and missed
these card corners. This pre-existing exception remains explicitly separate.
Alpha-card geometric extents can include transparent pixels, so containment alone
does not establish the final visible silhouette.

## Frozen builds / native pair

Both builds use the same public inputs (`71f5ab095073d488366c6e84de23a07a22d009065e03fb7289530b5f74bd8b7f`).
Before: 520537e6, bundle `index-yHBGtOiG.js`. After: 063772a4, bundle `index-CFWbRmVU.js`.
`native-pair/*-build.json` records exact hashes. Existing capture tooling is reused
with the shared capslot, native hardware, 1280x720, high quality and time 12.6.
F_canopy and C_lookback use the saved cameras in identical order.

The matched pair passes provenance and runtime checks in `native-report.json`:
Chrome 153.0.8010.52, ANGLE / AMD Radeon 780M / Direct3D11, no page or shader errors.
F is 406 calls and 7,994,522 → 7,995,102 triangles; C is 345 calls and
6,929,212 → 6,929,792 triangles. Both add 580 triangles and zero calls, geometries,
textures or programs. The capslot was released after the pair completed.

The bright gaps close, but large smooth opaque oval faces return. In raw F,
the top face at x570–795/y0–130 and right face at x900–1100/y90–280 remain mostly
bare. Raw C repeats this at x0–300/y70–290. The small leaf islands cannot carry
these broad faces. This is worse foliage quality, despite fixing the coverage
regression. The author and root independently agree on rejection.

The original 0.60 version has the better broken foliage outline but leaves bright
gaps where the reference needs a dark, leaf-edged canopy. Neither result resolves
both requirements. All 7,051 roots outside the core, and 7,041 centroids outside,
proved placement only: leaves can still overlap in projection or sit on its hidden
side. Read-only projected-area and depth coverage measurements are the next step;
no new density or core-scale trial is authorized by this evidence.

Raw pairs: [F before](native-pair/before/F_canopy.png),
[F rejected after](native-pair/after/F_canopy.png),
[C before](native-pair/before/C_lookback.png),
[C rejected after](native-pair/after/C_lookback.png).

This evidence branch retains canonical 520537e6 production source. The exact
rejected two-file diff is preserved as `REJECTED-063772a4.patch` for inspection and
reproduction in an isolated checkout at that baseline. It is not a delivery patch.
`node art/environment/astra-bank-backing/compare-native.mjs` checks the included
frozen manifests against the source proof and reproduces the submission report.
The larger local builds and complete geometry dumps are not duplicated here.
