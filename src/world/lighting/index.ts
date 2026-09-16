/**
 * Lighting system — owner: atmosphere/lighting agent.
 *
 * - Sun: DirectionalLight from `config.sun` (azimuth −128°, elevation 38° → shadows on the plaza
 *   fall toward camera-right/front in shot A, light enters from the upper-left). One 4096²
 *   PCF shadow map whose orthographic window is fitted ahead of the camera (radius 46 m, centre
 *   18 m along the view direction, aligned to the light-camera texel grid) so texels serve visible content: ~2.2 cm/texel
 *   with a 4-texel Vogel-disk penumbra → soft, crisp contact shadows.
 * - Hemisphere sky/ground bounce.
 * - Environment PMREM rendered from the procedural sky (see ../atmosphere/sky.ts) for matching
 *   ambient colour and subtle specular on every standard material.
 *
 * `ctx.sun` stays a DirectionalLight (other systems read direction/colour/target from it).
 */
import { DirectionalLight, HemisphereLight, Group, Vector3, Object3D, Color, BasicShadowMap } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { sunDirection } from './sun';
import { createSkyDome, SKY_ENV_TINT } from '../atmosphere/sky';
import { buildSkyEnvironment } from './environment';
import { encodeShadowRadius, installShadowFilter, searchTapsFor, SHADOW_FILTER_DEFAULTS } from './shadowfilter';
import { WORLD } from '../config';
import { perfFlags, perfRuntime } from '../../perfFlags';
import { createShadowTargetSnapper } from './shadowframe';

export { sunDirection } from './sun';

const SHADOW_RADIUS_M = 46;
const SHADOW_AHEAD_M = 18;
const SUN_DISTANCE_M = 140;
const SHADOW_NEAR_M = 40;
const SHADOW_FAR_M = 250;

// Performance flags (perfFlags.ts): `?shadow=<size>[,<taps>]` bakes another map size / tap count
// into the filter; `?quality=auto` (with the governor running) takes the dynamic variant whose
// texel and taps follow the light at run time. Without either the filter is the shipped one.
const PERF = perfFlags();
const SHADOW_MAP_SIZE = PERF.shadowMapSize > 0 ? PERF.shadowMapSize : WORLD.sun.shadowMapSize;
const SHADOW_DYNAMIC = PERF.governor;

// Must run before any material compiles: replaces the BASIC shadow lookup with the PCSS filter.
const SHADOW_FILTER = {
  ...SHADOW_FILTER_DEFAULTS,
  depthRangeM: SHADOW_FAR_M - SHADOW_NEAR_M,
  texelM: (2 * SHADOW_RADIUS_M) / SHADOW_MAP_SIZE,
  ...(PERF.shadowTaps !== 12 ? { filterTaps: PERF.shadowTaps, searchTaps: searchTapsFor(PERF.shadowTaps) } : {}),
  ...(SHADOW_DYNAMIC ? { dynamic: true, mapSize: SHADOW_MAP_SIZE } : {}),
};
const shadowFilterInstalled = installShadowFilter(SHADOW_FILTER);

/**
 * Tuning aid (unset in production): `globalThis.__ATMO_LIGHT__ = { sunIntensity, hemiIntensity,
 * environmentIntensity, shadowRadius }` overrides the light parameters for the frame, so a probe
 * (gauntlet/tmp) can isolate the key from the fill — or switch the sun off — without a rebuild.
 */
interface LightOverride {
  sunIntensity?: number;
  hemiIntensity?: number;
  environmentIntensity?: number;
  shadowRadius?: number;
  /** hemisphere colours as hex (sRGB) */
  hemiSky?: number;
  hemiGround?: number;
}
const lightOverride = (): LightOverride | null => (globalThis as { __ATMO_LIGHT__?: LightOverride | null }).__ATMO_LIGHT__ ?? null;

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'lighting';
  const s = ctx.config.sun;
  const dir = sunDirection(s.azimuthDeg, s.elevationDeg);

  // BASIC keeps the sun's depth map readable (raw depth, no compare sampler); the lookup itself is
  // the PCSS filter in shadowfilter.ts, which needs the occluder depth for its distance-dependent
  // penumbra and canopy transmission (the compare-mode PCF sampler cannot give it).
  ctx.renderer.shadowMap.type = BasicShadowMap;

  // The reference's lit surfaces measure golden (hue ≈ 40–50°, lit flagstone R/B ≈ 1.5); the config
  // colour is nudged a touch warmer so the lit ground lands there without re-tinting the albedos.
  const sunColor = new Color(s.color).multiply(new Color(1.0, 0.985, 0.94));
  const sun = new DirectionalLight(sunColor, s.intensity);
  sun.name = 'sun';
  sun.position.copy(dir).multiplyScalar(SUN_DISTANCE_M);
  // `?shadow=0` switches the sun's shadow map off (the receivers' materials then compile without it)
  sun.castShadow = ctx.quality.shadows && PERF.shadowMapSize > 0;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.camera.near = SHADOW_NEAR_M;
  sun.shadow.camera.far = SHADOW_FAR_M;
  sun.shadow.camera.left = -SHADOW_RADIUS_M;
  sun.shadow.camera.right = SHADOW_RADIUS_M;
  sun.shadow.camera.top = SHADOW_RADIUS_M;
  sun.shadow.camera.bottom = -SHADOW_RADIUS_M;
  sun.shadow.camera.updateProjectionMatrix();
  let shadowTexelM = (2 * SHADOW_RADIUS_M) / sun.shadow.mapSize.x;
  let snapShadowTarget = createShadowTargetSnapper(dir, sun.shadow.camera.up, shadowTexelM);
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.028;
  // the filter's minimum blur in texels (contact shadows): the PCSS penumbra grows from here with
  // the occluder distance (shadowfilter.ts), so Link's shadow at 4 m stays crisp while the canopy's
  // dapple softens to the reference's 20–40 cm blotches
  const shadowRadius = 1.5;
  sun.shadow.radius = shadowRadius;
  const target = new Object3D();
  target.name = 'sun-target';
  group.add(target);
  sun.target = target;
  group.add(sun);
  ctx.sun = sun;

  // The reference is soft: shaded flagstone still reads ≈ 0.33–0.40 luminance next to sunlit stone
  // at 0.62–0.66, so the fill is generous but near-neutral — warm grey-olive canopy light, never
  // cyan and clearly less golden than the key, so shade reads cooler than sun. Hemisphere + IBL
  // together give a horizontal surface ≈ 1.25 of irradiance against the sun's ≈ 1.85 (3 · sin 38°),
  // the reference's lit/shade ratio (see config.sky.hemiIntensity for the measurements behind it).
  const hemiIntensity = ctx.config.sky.hemiIntensity;
  // The sky term leans a touch less golden (linear B/R ≈ 0.87, was 0.84 with a (1.0, 0.97, 0.9)
  // target): the reference's shaded flagstone keeps B/R ≈ 0.69–0.70 in display against ours at
  // 0.63–0.67 — its shade is lit by a greyer sky than its golden key. Still no blue: a (0.96, 0.98,
  // 1.0) target (B/R 0.90) with the IBL at 0.81 overshot the lit stone by 0.025 and the shaded
  // stairs of shot A by 0.03.
  // Let the configured daylight colour reach shaded surfaces without the old warm-grey mix.
  const hemiSky = new Color(ctx.config.sky.hemiSky);
  const hemiGroundColor = new Color(ctx.config.sky.hemiGround);
  const hemi = new HemisphereLight(hemiSky, hemiGroundColor, hemiIntensity);
  hemi.name = 'sky-hemisphere';
  group.add(hemi);

  // Sky environment (IBL) — built from the same procedural sky the atmosphere draws (a warm haze at
  // the reference's hazy key, radiance ≈ 0.25–0.37, see sky.ts).
  let environment = false;
  // 0.57 with the hemisphere at 0.95 (both × 0.95 against 0.6 / 1.0): see config.sun.intensity.
  // The dome's gap glare then rose 0.292 → 0.372 with a shorter ramp (the visible far air), which
  // lifts the cosine-weighted upper hemisphere ×1.35 in green: 0.57 × 0.271 / 0.367 keeps the IBL
  // fill on the ground unchanged (the shade is calibrated by the hemisphere + IBL sum); the
  // per-channel remainder is in SKY_ENV_TINT. 0.481 once the dome went to the closed-roof veil
  // toward the north/west (hemisphere mean ×0.876 in green, see SKY_ENV_TINT) — same fill again.
  // Round 31 (tone): 0.36. The IBL is the one fill whose removal darkens the ground band without
  // touching the canopy (at 0: D / B bottom-band p10 −0.043 / −0.045, p50 −0.040 / −0.046, top
  // band ≤ 0.007) and the only lever that measured SSIM-neutral or better while doing it (D +0.005,
  // B −0.001 at 0). ×0.75 takes the whole-frame darkest decile down 0.008 (D) / 0.007 (B) with the
  // medians −0.007 / −0.008 (the frames' p10 sits 0.04 under ours, the medians already match) and
  // SSIM +0.002 / +0.001 measured on top of the round's other changes.
  // Owner video: preserve readable cool shade beneath distinct direct-sun patches.
  const environmentIntensity = 0.22;
  try {
    const envSky = createSkyDome(ctx.config, dir);
    const envTex = buildSkyEnvironment(ctx.renderer, envSky.createEnvMaterial());
    envSky.material.dispose();
    envSky.mesh.geometry.dispose();
    ctx.scene.environment = envTex;
    ctx.scene.environmentIntensity = environmentIntensity;
    environment = true;
  } catch (e) {
    console.warn('[lighting] sky environment unavailable', e);
  }

  ctx.audit('lighting', () => ({
    sunAzimuthDeg: s.azimuthDeg,
    sunElevationDeg: s.elevationDeg,
    sunIntensity: sun.intensity,
    sunColor: `#${sunColor.getHexString()}`,
    shadows: sun.castShadow,
    shadowMapSize: sun.shadow.mapSize.x,
    shadowType: shadowFilterInstalled ? 'pcss-vogel+canopy-transmission' : 'basic',
    shadowFilterTaps: SHADOW_DYNAMIC ? perfRuntime().shadowTaps : SHADOW_FILTER.filterTaps ?? 12,
    shadowSearchTaps: SHADOW_DYNAMIC ? searchTapsFor(perfRuntime().shadowTaps) : SHADOW_FILTER.searchTaps ?? 8,
    shadowFilterDynamic: SHADOW_DYNAMIC,
    shadowWindowRadiusM: SHADOW_RADIUS_M,
    shadowSnapSpace: 'light-camera-texel',
    shadowSnapMetres: shadowTexelM,
    shadowTexelCm: Math.round(((2 * SHADOW_RADIUS_M) / sun.shadow.mapSize.x) * 1000) / 10,
    shadowBias: sun.shadow.bias,
    shadowNormalBias: sun.shadow.normalBias,
    shadowRadiusTexels: SHADOW_DYNAMIC ? sun.shadow.radius % 1000 : sun.shadow.radius,
    shadowPenumbraPerM: SHADOW_FILTER.penumbraPerM,
    shadowPenumbraRangeM: [SHADOW_FILTER.penumbraMinM, SHADOW_FILTER.penumbraMaxM],
    shadowCanopyLeak: SHADOW_FILTER.leak,
    shadowCanopyLeakRangeM: [SHADOW_FILTER.leakStartM, SHADOW_FILTER.leakFullM],
    cascades: 1,
    hemiIntensity: hemi.intensity,
    hemiSkyLinear: hemi.color.toArray().map((v) => Math.round(v * 1000) / 1000),
    hemiGroundLinear: hemi.groundColor.toArray().map((v) => Math.round(v * 1000) / 1000),
    environmentMap: environment,
    environmentIntensity: environment ? ctx.scene.environmentIntensity : 0,
    environmentTint: SKY_ENV_TINT,
  }));

  const camPos = new Vector3();
  const camDir = new Vector3();
  /**
   * Auto quality (dynamic filter variant only): follow the governor's map size and tap count. A
   * new size drops the allocated map so three reallocates it at the next shadow pass (the filter
   * reads the size from its `shadowMapSize` uniform); the taps ride in shadow.radius's thousands.
   */
  let perfSeen = -1;
  const applyPerf = () => {
    const perf = perfRuntime();
    if (perf.version === perfSeen) return;
    perfSeen = perf.version;
    const size = perf.shadowMapSize > 0 ? perf.shadowMapSize : SHADOW_MAP_SIZE;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      shadowTexelM = (2 * SHADOW_RADIUS_M) / size;
      snapShadowTarget = createShadowTargetSnapper(dir, sun.shadow.camera.up, shadowTexelM);
      const map = sun.shadow.map;
      if (map) {
        map.depthTexture?.dispose();
        map.dispose();
        sun.shadow.map = null;
      }
    }
  };
  return {
    name: 'lighting',
    group,
    update(_dt, _t, c) {
      const o = lightOverride();
      sun.intensity = o?.sunIntensity ?? s.intensity;
      hemi.intensity = o?.hemiIntensity ?? hemiIntensity;
      if (o?.hemiSky !== undefined) hemi.color.set(o.hemiSky);
      else hemi.color.copy(hemiSky);
      if (o?.hemiGround !== undefined) hemi.groundColor.set(o.hemiGround);
      else hemi.groundColor.copy(hemiGroundColor);
      if (environment) c.scene.environmentIntensity = o?.environmentIntensity ?? environmentIntensity;
      sun.shadow.radius = o?.shadowRadius ?? shadowRadius;
      if (SHADOW_DYNAMIC) {
        applyPerf();
        sun.shadow.radius = encodeShadowRadius(sun.shadow.radius, perfRuntime().shadowTaps);
      }
      // Fit ahead on terrain, then keep the light camera on its own texel lattice.
      // World-metre rounding shifts fractional shadow texels as the player walks.
      c.camera.getWorldPosition(camPos);
      c.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, -1);
      camDir.normalize();
      const cx = camPos.x + camDir.x * SHADOW_AHEAD_M;
      const cz = camPos.z + camDir.z * SHADOW_AHEAD_M;
      target.position.set(cx, c.terrain.height(cx, cz), cz);
      snapShadowTarget(target.position, target.position);
      sun.position.copy(target.position).addScaledVector(dir, SUN_DISTANCE_M);
    },
  };
}
