/**
 * Lighting system — owner: atmosphere/lighting agent.
 *
 * - Sun: DirectionalLight from `config.sun` (azimuth −128°, elevation 38° → shadows on the plaza
 *   fall toward camera-right/front in shot A, light enters from the upper-left). One 4096²
 *   PCF shadow map whose orthographic window is fitted ahead of the camera (radius 46 m, centre
 *   18 m along the view direction, snapped to 1 m) so texels serve visible content: ~2.2 cm/texel
 *   with a 4-texel Vogel-disk penumbra → soft, crisp contact shadows.
 * - Hemisphere sky/ground bounce.
 * - Environment PMREM rendered from the procedural sky (see ../atmosphere/sky.ts) for matching
 *   ambient colour and subtle specular on every standard material.
 *
 * `ctx.sun` stays a DirectionalLight (other systems read direction/colour/target from it).
 */
import { DirectionalLight, HemisphereLight, Group, Vector3, Object3D, Color, PCFShadowMap } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { sunDirection } from './sun';
import { createSkyDome } from '../atmosphere/sky';
import { buildSkyEnvironment } from './environment';

export { sunDirection } from './sun';

const SHADOW_RADIUS_M = 46;
const SHADOW_AHEAD_M = 18;
const SHADOW_SNAP_M = 1;
const SUN_DISTANCE_M = 140;

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'lighting';
  const s = ctx.config.sun;
  const dir = sunDirection(s.azimuthDeg, s.elevationDeg);

  // PCF (Vogel disk + hardware compare) gives the softest well-behaved penumbra in r18x.
  ctx.renderer.shadowMap.type = PCFShadowMap;

  // The reference's lit surfaces measure golden (hue ≈ 40–50°, lit flagstone R/B ≈ 1.5); the config
  // colour is nudged a touch warmer so the lit ground lands there without re-tinting the albedos.
  const sunColor = new Color(s.color).multiply(new Color(1.0, 0.985, 0.94));
  const sun = new DirectionalLight(sunColor, s.intensity);
  sun.name = 'sun';
  sun.position.copy(dir).multiplyScalar(SUN_DISTANCE_M);
  sun.castShadow = ctx.quality.shadows;
  sun.shadow.mapSize.set(s.shadowMapSize, s.shadowMapSize);
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 250;
  sun.shadow.camera.left = -SHADOW_RADIUS_M;
  sun.shadow.camera.right = SHADOW_RADIUS_M;
  sun.shadow.camera.top = SHADOW_RADIUS_M;
  sun.shadow.camera.bottom = -SHADOW_RADIUS_M;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.028;
  sun.shadow.radius = 4;
  const target = new Object3D();
  target.name = 'sun-target';
  group.add(target);
  sun.target = target;
  group.add(sun);
  ctx.sun = sun;

  // The reference is soft: shaded flagstone still reads ≈ 0.33–0.40 luminance next to sunlit stone
  // at 0.62–0.66, so the fill is generous but near-neutral — warm grey-olive canopy light, never
  // cyan and clearly less golden than the key, so shade reads cooler than sun. (Isolated A/B at
  // quality high: dropping the fill by 20 % darkened the crown-shaded plaza of shot A by 0.05
  // luminance while the reference plaza is sunlit — see config.sky.hemiIntensity.)
  const hemiIntensity = ctx.config.sky.hemiIntensity;
  const hemiSky = new Color(ctx.config.sky.hemiSky).lerp(new Color(1.0, 0.97, 0.9), 0.35);
  const hemi = new HemisphereLight(hemiSky, ctx.config.sky.hemiGround, hemiIntensity);
  hemi.name = 'sky-hemisphere';
  group.add(hemi);

  // Sky environment (IBL) — built from the same procedural sky the atmosphere draws (a warm haze at
  // the reference's hazy key, radiance ≈ 0.24–0.32, see sky.ts).
  let environment = false;
  const environmentIntensity = 0.65;
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
    shadowType: 'pcf-vogel',
    shadowWindowRadiusM: SHADOW_RADIUS_M,
    shadowTexelCm: Math.round(((2 * SHADOW_RADIUS_M) / sun.shadow.mapSize.x) * 1000) / 10,
    shadowBias: sun.shadow.bias,
    shadowNormalBias: sun.shadow.normalBias,
    shadowRadiusTexels: sun.shadow.radius,
    cascades: 1,
    hemiIntensity: hemi.intensity,
    environmentMap: environment,
    environmentIntensity: environment ? environmentIntensity : 0,
  }));

  const camPos = new Vector3();
  const camDir = new Vector3();
  return {
    name: 'lighting',
    group,
    update(_dt, _t, c) {
      // shadow window fitted ahead of the camera, snapped to metre steps to avoid shimmering
      c.camera.getWorldPosition(camPos);
      c.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, -1);
      camDir.normalize();
      const cx = Math.round((camPos.x + camDir.x * SHADOW_AHEAD_M) / SHADOW_SNAP_M) * SHADOW_SNAP_M;
      const cz = Math.round((camPos.z + camDir.z * SHADOW_AHEAD_M) / SHADOW_SNAP_M) * SHADOW_SNAP_M;
      target.position.set(cx, c.terrain.height(cx, cz), cz);
      sun.position.copy(target.position).addScaledVector(dir, SUN_DISTANCE_M);
    },
  };
}
