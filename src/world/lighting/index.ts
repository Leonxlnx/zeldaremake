/**
 * Lighting system — owner: atmosphere/lighting agent.
 *
 * - Sun: DirectionalLight from `config.sun` (azimuth −128°, elevation 38° → shadows on the plaza
 *   fall toward camera-right/front in shot A, light enters from the upper-left). One 4096²
 *   PCF shadow map whose orthographic window is fitted ahead of the camera (radius 46 m, centre
 *   18 m along the view direction, snapped to the light-space texel grid) so texels serve visible content: ~2.2 cm/texel
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
import { installShadowFilter, SHADOW_FILTER_DEFAULTS } from './shadowfilter';
import { createShadowTargetSnapper } from './shadowframe';
import { WORLD } from '../config';

export { sunDirection } from './sun';

const SHADOW_RADIUS_M = 46;
const SHADOW_AHEAD_M = 18;
const SUN_DISTANCE_M = 140;
const SHADOW_NEAR_M = 40;
const SHADOW_FAR_M = 250;

// Must run before any material compiles: replaces the BASIC shadow lookup with the PCSS filter.
const SHADOW_FILTER = {
  ...SHADOW_FILTER_DEFAULTS,
  depthRangeM: SHADOW_FAR_M - SHADOW_NEAR_M,
  texelM: (2 * SHADOW_RADIUS_M) / WORLD.sun.shadowMapSize,
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
  sun.castShadow = ctx.quality.shadows;
  sun.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
  sun.shadow.camera.near = SHADOW_NEAR_M;
  sun.shadow.camera.far = SHADOW_FAR_M;
  sun.shadow.camera.left = -SHADOW_RADIUS_M;
  sun.shadow.camera.right = SHADOW_RADIUS_M;
  sun.shadow.camera.top = SHADOW_RADIUS_M;
  sun.shadow.camera.bottom = -SHADOW_RADIUS_M;
  sun.shadow.camera.updateProjectionMatrix();
  const shadowTexelM = (2 * SHADOW_RADIUS_M) / s.shadowMapSize;
  const snapShadowTarget = createShadowTargetSnapper(dir, sun.shadow.camera.up, shadowTexelM);
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

  // Cool canopy bounce stays distinct from the golden key. These are the reviewed23ea
  // light controls; keep the authored colour literal so runtime probes and defaults match.
  const hemiIntensity = ctx.config.sky.hemiIntensity;
  const hemiSky = new Color(ctx.config.sky.hemiSky);
  const hemiGroundColor = new Color(ctx.config.sky.hemiGround);
  const hemi = new HemisphereLight(hemiSky, hemiGroundColor, hemiIntensity);
  hemi.name = 'sky-hemisphere';
  group.add(hemi);

  // Build indirect light from the same sky/air model as the visible atmosphere.
  let environment = false;
  const environmentIntensity = 0.34;
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
    shadowWindowRadiusM: SHADOW_RADIUS_M,
    shadowSnapSpace: 'light-camera-texel',
    shadowSnapMetres: shadowTexelM,
    shadowTexelCm: Math.round(((2 * SHADOW_RADIUS_M) / sun.shadow.mapSize.x) * 1000) / 10,
    shadowBias: sun.shadow.bias,
    shadowNormalBias: sun.shadow.normalBias,
    shadowRadiusTexels: sun.shadow.radius,
    shadowPenumbraPerM: SHADOW_FILTER.penumbraPerM,
    shadowPenumbraRangeM: [SHADOW_FILTER.penumbraMinM, SHADOW_FILTER.penumbraMaxM],
    shadowCanopyLeak: SHADOW_FILTER.leak,
    shadowCanopyLeakRangeM: [SHADOW_FILTER.leakStartM, SHADOW_FILTER.leakFullM],
    cascades: 1,
    hemiIntensity: hemi.intensity,
    hemiSkyLinear: hemi.color.toArray().map((v) => Math.round(v * 1000) / 1000),
    environmentMap: environment,
    environmentIntensity: environment ? ctx.scene.environmentIntensity : 0,
    hemiGroundLinear: hemi.groundColor.toArray().map((v) => Math.round(v * 1000) / 1000),
    environmentTint: SKY_ENV_TINT,
  }));

  const camPos = new Vector3();
  const camDir = new Vector3();
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
      // Fit ahead on actual terrain, then preserve the light camera's texel phase. Rounding
      // world X/Z metres instead makes fractional shadow texels jump as the player walks.
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
