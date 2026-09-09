# Codex source review: checkpoint 4820e52

Reviewed 2026-09-09. Scope: atmosphere, postfx, tree materials/LOD integration and their rendering lifecycle. These directories match `4820e52a6ded36452eb89d5117a829d1d8676b32` at the inspected local HEAD `1ab6e33`. Fable retains ownership; no source files changed. This is not a visual verdict, GPU compile test, performance measurement, or gauntlet pass. Existing capture fixes and assigned terrain findings are excluded.

## 1. Replace reversed smoothstep edges in shared atmosphere shaders

`src/world/atmosphere/heightfog.ts:65-66,135` uses `smoothstep(-4,-24,z)` through its north-hollow constants. `src/world/postfx/shaders.ts:153` repeats the same order through uniforms populated in `composer.ts`. `motes.ts:69` and `fairy.ts:88` also use reversed numeric edges for alpha falloff.

GLSL defines this edge order as undefined ([Khronos reference](https://registry.khronos.org/OpenGL-Refpages/gl4/html/smoothstep.xhtml)). This affects the shared fog installed on every standard material and the ray-density weighting; current SwiftShader output cannot establish portability to other GPUs. No claim is made that the current capture already shows corruption.

Use `1.0 - smoothstep(KF_NORTH_FULL, KF_NORTH_START, z)` for the intended northward ramp, and analogous increasing-edge expressions for particle falloff. Expected north weights: z=-24 → 1, z=-14 → 0.5, z=-4 → 0. These are equivalent to the intended reversed cubic ramp without undefined input.

## 2. Height-fog integral overflows during elevated free-camera exploration

`src/world/atmosphere/heightfog.ts:111-116` separately computes an exponentially tiny camera density and exponentially large downward-ray integral before multiplying them. At camera y=220 and endpoint y=0, default falloff=0.55, density=0.03, weight=1, float32 evaluation produces density=0, integral=Infinity, product=NaN; the mathematically finite optical depth is approximately 0.0945411. The camera permits unrestricted upward travel (`src/camera/freecam.ts:109-122`), so this is reachable through normal exploration. It is not a claimed defect in the six ground-level hero captures.

CPU reproduction (arithmetic-range proof, not GPU emulation):

```js
const f = Math.fround;
const k = f(0.55), cy = 220, dist = 220, ry = -1;
const density = f(f(0.03) * f(Math.exp(f(-f(f(cy - 1) * k)))));
const integral = f(f(1 - f(Math.exp(f(-f(f(dist * ry) * k))))) / f(ry * k));
console.log(density, integral, f(density * integral)); // 0 Infinity NaN
console.log(0.03 / 0.55 * (Math.exp(0.55) - Math.exp(-219 * 0.55)));
// 0.09454107370185791
```

Evaluate the integral through the difference of endpoint densities, with a horizontal-ray limit, instead of multiplying individually unbounded factors. If density is meant to saturate below the mist base (as ray marching does), use a piecewise bounded integral. Verify downward-looking elevated poses and ordinary hero poses afterward. NaN handling in the subsequent `min` calls is GPU dependent and cannot be relied on to restore the intended finite result.

## Other scope checks

The installed Three.js r186 PCF implementation creates a comparison depth texture, so `sampler2DShadow` binding is consistent with that renderer version; do not replace it with legacy RGBA unpacking. Composer ping-pong passes do not read their current render target. Tree LOD rebucketing updates instance counts and bounding spheres; `mergeParts` disposes its input geometry objects. There are incomplete teardown paths (tree materials/instance buffers and atmosphere scene objects), but boot currently creates the world once and does not expose world rebuild, so these are not elevated to a demonstrated high-impact live leak. No new tree-specific rendering defect was established by this source review.

## Follow-up: previously assigned terrain defects at 4820e52

Updated the owned `codex-terrain-review.mjs` for the async terrain factory, full quality/layout context, and stubbed texture I/O. The real terrain material factory and mesh builders run; only texture bytes and GPU capability queries are replaced. This cannot validate shading. Run `node .agents/reviews/codex-terrain-review.mjs` for high, or add `--low`.

| Diagnostic | High | Low |
| --- | ---: | ---: |
| Chunks / vertices / triangles | 56 / 318,528 / 622,088 | 56 / 169,536 / 327,176 |
| Cache query-order difference at original coordinate pair | 0.064563 m | 0.064563 m |
| Sampler minus mesh at original contact (14.82,-3.88) | 0.010814 m | 0.016220 m |
| Worst absolute sampler/mesh gap among 780 stair/plaza probes | 0.155935 m at (9.66,-4.81) | 0.194986 m at (7.83,-7.25) |
| Largest seam spread across 296 sampled current ring boundaries | 0.00000134 m | 0.00000134 m |

The new stitched ring geometry resolves the previously reported open seam at the sampled boundaries; the old x=60 coordinate is no longer a chunk boundary. Cache order dependence and the sampler/rendered-surface mismatch remain, already assigned to Fable's terrain agent. At (144,9.2), the two adjacent rendered surfaces agree but the sampler sits 0.583462 m above them; a closed seam is not proof of correct asset contact. These are bounded probe results, not global maxima. Ground checks use the terrain system's own build/cache order, not a full-world cache history, which can still change results while the cache defect remains. No terrain source modified and no new ownership claim.
