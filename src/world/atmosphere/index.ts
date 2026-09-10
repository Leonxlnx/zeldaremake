/**
 * Atmosphere system — owner: atmosphere/lighting agent.
 *
 * Sky dome (gradient + sun glow + cirrus wisps), height-aware distance haze for every material
 * (see heightfog.ts — installed at module load so all shaders compile with it), ground mist volume
 * in the north hollow, falling leaves, drifting motes/fireflies, the fairy, and the post-processing
 * composer (src/world/postfx) which draws SSAO, god rays, restrained bloom, ACES + grade and FXAA.
 *
 * `scene.fog` stays a plain THREE.Fog (fogNear/fogFar from config) so other systems can rely on it;
 * the fog *shading* is upgraded globally by the ShaderChunk override.
 */
import { Color, Fog, Group, Vector3, type PerspectiveCamera } from 'three';
import type { WorldContext, WorldSystem } from '../system';
import { WORLD } from '../config';
import { installHeightFog, HEIGHT_FOG_DEFAULTS, displayHex } from './heightfog';
import { sunDirection } from '../lighting/sun';
import { createSkyDome, SKY_GAP_GLARE } from './sky';
import { createMistVolume } from './mist';
import { createFallingLeaves } from './leaves';
import { createMotes } from './motes';
import { createFairy } from './fairy';
import { createComposer, type Composer } from '../postfx/composer';

// Must run before any material compiles: patches THREE.ShaderChunk fog includes.
installHeightFog(WORLD);

export function create(ctx: WorldContext): WorldSystem {
  const group = new Group();
  group.name = 'atmosphere';
  const cfg = ctx.config;
  const sunDir = sunDirection(cfg.sun.azimuthDeg, cfg.sun.elevationDeg);

  ctx.scene.fog = new Fog(cfg.fog.color, cfg.fog.near, cfg.fog.far);
  ctx.scene.background = new Color(cfg.fog.color);

  const sky = createSkyDome(cfg, sunDir);
  group.add(sky.mesh);

  const mist = createMistVolume(ctx, sunDir);
  const leaves = createFallingLeaves(ctx, 96);
  group.add(leaves.mesh);
  const motes = createMotes(ctx, 180);
  group.add(motes.points);
  const fairy = createFairy(ctx);
  group.add(fairy.group);

  // Post-processing: consumed by main.ts through scene.userData.composer.
  let composer: Composer | null = null;
  try {
    composer = createComposer({
      renderer: ctx.renderer,
      scene: ctx.scene,
      camera: ctx.camera as PerspectiveCamera,
      sunDirection: sunDir,
      sun: () => ctx.sun,
      exposure: cfg.renderer.exposure,
      headless: ctx.headless,
      overlay: {
        scene: mist.scene,
        prepare: (depth, viewport) => mist.update(lastT, ctx.camera as PerspectiveCamera, depth, viewport),
      },
    });
    ctx.scene.userData.composer = { render: (dt: number) => composer!.render(dt), setSize: (w: number, h: number) => composer!.setSize(w, h) };
  } catch (e) {
    console.warn('[atmosphere] post-fx composer unavailable, falling back to direct rendering', e);
  }

  let lastT = 0;
  const camPos = new Vector3();

  ctx.audit('atmosphere', () => ({
    fogNear: (ctx.scene.fog as Fog).near,
    fogFar: (ctx.scene.fog as Fog).far,
    fogColor: `#${new Color(cfg.fog.color).getHexString()}`,
    heightFog: true,
    heightFogBaseM: HEIGHT_FOG_DEFAULTS.baseHeight,
    heightFogFalloff: HEIGHT_FOG_DEFAULTS.falloff,
    distanceFogMax: HEIGHT_FOG_DEFAULTS.maxFog,
    // visible haze model (reference/ANALYSIS.md §8): exponential extinction after a crisp foreground,
    // depth-graded warm-grey colour (display values after ACES)
    hazeDensityPerM: HEIGHT_FOG_DEFAULTS.hazeDensity,
    hazeStartM: HEIGHT_FOG_DEFAULTS.hazeStart,
    hazeAt30m: Math.round((1 - Math.exp(-HEIGHT_FOG_DEFAULTS.hazeDensity * (30 - HEIGHT_FOG_DEFAULTS.hazeStart))) * 100) / 100,
    // aerosol thins with altitude so upward rays (shot F) do not wash the near canopy pale
    hazeUniformHeightM: HEIGHT_FOG_DEFAULTS.hazeUniformHeight,
    hazeScaleHeightM: HEIGHT_FOG_DEFAULTS.hazeScaleHeight,
    hazeUpwardCut: HEIGHT_FOG_DEFAULTS.hazeUpwardCut,
    hazeNearDisplay: displayHex(HEIGHT_FOG_DEFAULTS.hazeNear),
    hazeFarDisplay: displayHex(HEIGHT_FOG_DEFAULTS.hazeFar),
    // Mie-like airlight lobe: side-scatter is the calibrated colour, the veil dims when the sun is
    // behind the camera (shot C); the display value is the far haze seen straight away from the sun
    hazeBackScatterMin: HEIGHT_FOG_DEFAULTS.backScatterMin,
    hazeBackScatterFullDeg: HEIGHT_FOG_DEFAULTS.backScatterFullDeg,
    hazeFarBackDisplay: displayHex(
      HEIGHT_FOG_DEFAULTS.hazeFar.map((c, i) => c * HEIGHT_FOG_DEFAULTS.backScatterMin * HEIGHT_FOG_DEFAULTS.backScatterTint[i]) as [number, number, number],
    ),
    groundMistDisplay: displayHex(HEIGHT_FOG_DEFAULTS.mistColor),
    skyGapDisplay: displayHex(SKY_GAP_GLARE),
    sky: 'procedural-warm-haze+sun+cirrus',
    groundMist: true,
    groundMistBillboards: mist.billboards,
    groundMistSheets: mist.sheets,
    godRays: composer !== null,
    fallingLeaves: leaves.count,
    fireflies: motes.count,
    fairy: true,
    fairyLight: fairy.light.intensity > 0,
    ambientOcclusion: composer !== null,
    bloom: composer !== null,
    antialiasing: composer ? 'fxaa' : 'msaa',
    postfx: composer ? composer.audit() : null,
  }));

  return {
    name: 'atmosphere',
    group,
    update(_dt, t, c) {
      lastT = t;
      c.camera.getWorldPosition(camPos);
      sky.update(t, camPos);
      leaves.update(t);
      motes.update(t, c.sun, c.renderer.getPixelRatio());
      fairy.update(t);
    },
    dispose() {
      composer?.dispose();
      mist.dispose();
    },
  };
}
