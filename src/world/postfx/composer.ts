/**
 * Post-processing composer — owner: atmosphere/lighting agent.
 *
 * Minimal render-target chain (no EffectComposer overhead) exposed to main.ts as
 * `scene.userData.composer = { render(dt), setSize(w, h) }`:
 *
 *   1. scene → HDR (RGBA half-float, full res) with a 24-bit depth texture       [1 fullscreen]
 *   2. mist overlay scene → premultiplied RGBA (half res), depth-faded             [½ res]
 *   3. SSAO from depth (10 taps, half res) → depth-aware 3×3 blur                  [2 × ½ res]
 *   4. god rays: volumetric march (¼ res, 24 jittered steps per pixel over 40 m, each tested
 *      against the sun's PCF shadow map and a world-space canopy-gap mask with fixed open columns
 *      (atmosphere/shafts.ts), transmittance-weighted, upper-air only, haze density = height-fog
 *      model) → 2 × 12-tap smear along the screen-space sun direction to hide the jitter
 *                                                                                  [3 × ¼ res]
 *   5. bloom: bright pass (threshold ≥ 1.0) → separable 9-tap Gaussian             [3 × ¼ res]
 *   6. composite: AO·HDR + mist + rays + bloom → ACES → subtle grade → sRGB (LDR)   [1 fullscreen]
 *   7. FXAA → default framebuffer (the canvas holds the final image for headless captures)
 *                                                                                  [1 fullscreen]
 *
 * All passes are deterministic (no temporal jitter). `renderer.info` is reset once per frame and
 * accumulates every pass, so `stats().drawCalls` stays honest.
 */
import {
  Color,
  DepthFormat,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  UnsignedIntType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type DirectionalLight,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { HEIGHT_FOG_DEFAULTS } from '../atmosphere/heightfog';
import { SHAFT_COLUMNS } from '../atmosphere/shafts';
import { AO_BLUR_FRAG, AO_FRAG, BLUR_FRAG, BRIGHT_FRAG, COMPOSITE_FRAG, COPY_FRAG, FULLSCREEN_VERT, RAY_BLUR_FRAG, RAY_MARCH_FRAG } from './shaders';

/**
 * Tuning aids (unset in production):
 * - `globalThis.__ATMO_DEBUG__ = 'rays' | 'ao' | 'mist' | 'bloom'` blits that buffer instead of the
 *   final image; 'bypass' skips the whole chain (for cost comparisons).
 * - `globalThis.__ATMO_SETTINGS__ = { rayIntensity: 0, ... }` overrides numeric `ComposerSettings`
 *   fields for the frame, so a probe can isolate one pass's contribution without a rebuild.
 */
const debugView = (): string => (globalThis as { __ATMO_DEBUG__?: string }).__ATMO_DEBUG__ ?? '';
const settingsOverride = (): Partial<Record<keyof ComposerSettings, number>> | null =>
  (globalThis as { __ATMO_SETTINGS__?: Partial<Record<keyof ComposerSettings, number>> | null }).__ATMO_SETTINGS__ ?? null;

export interface ComposerOverlay {
  /** transparent scene rendered at half resolution after the opaque pass (ground mist) */
  scene: Scene;
  /** called before the overlay renders with the scene depth texture + overlay viewport size */
  prepare(depth: Texture, viewportSize: Vector2): void;
}

export interface ComposerOptions {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  /** unit vector toward the sun (world) */
  sunDirection: Vector3;
  /** the shadow-casting sun; its PCF shadow map is marched for volumetric god rays */
  sun: () => DirectionalLight | null;
  exposure: number;
  headless: boolean;
  overlay?: ComposerOverlay;
}

export interface Composer {
  render(dt: number): void;
  setSize(w: number, h: number): void;
  /** scene depth texture (24-bit) for systems that need soft depth intersection */
  readonly depthTexture: DepthTexture;
  settings: ComposerSettings;
  audit(): Record<string, unknown>;
  dispose(): void;
}

export interface ComposerSettings {
  aoStrength: number;
  aoRadius: number;
  rayIntensity: number;
  /** contrast curve (pow) applied to the smeared ray buffer so beams read as slabs */
  rayContrast: number;
  rayColor: Color;
  /** share of the beams laid over open-sky pixels (the dome already carries its own haze glow) */
  raySkyShare: number;
  /** base air density (1/m) of the sunlit under-canopy air the shafts live in */
  rayBaseDensity: number;
  /** extra density (1/m) of the ground-mist layer (height-fog profile, weighted to the north hollow) */
  rayMistDensity: number;
  /** haze extinction (1/m) attenuating each step's in-scatter on its way to the camera */
  rayExtinction: number;
  /** march length (m) */
  rayMaxDist: number;
  /** canopy-gap mask: frequency (1/m), smoothstep thresholds, floor outside the gaps */
  beamFrequency: number;
  beamLo: number;
  beamHi: number;
  beamFloor: number;
  /** radius multiplier of the fixed shaft columns (atmosphere/shafts.ts); 0 disables them */
  beamColumnScale: number;
  bloomThreshold: number;
  bloomIntensity: number;
  saturation: number;
  /** luminance power curve about `contrastPivot` (linear); > 1 deepens the toe more than it lifts highlights */
  contrast: number;
  contrastPivot: number;
  /** black pedestal (display-linear) added after the curve: the reference's video blacks sit at ≈ 0.12–0.16 */
  lift: number;
  /** selective grade of green-dominant pixels: hue pull toward gold, saturation softening */
  greenWarm: number;
  greenDesat: number;
  shadowTint: Color;
  highlightTint: Color;
}

function rt(w: number, h: number, hdr: boolean, linear = true): WebGLRenderTarget {
  return new WebGLRenderTarget(w, h, {
    type: hdr ? HalfFloatType : UnsignedByteType,
    format: RGBAFormat,
    minFilter: linear ? LinearFilter : NearestFilter,
    magFilter: linear ? LinearFilter : NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
}

export function createComposer(opts: ComposerOptions): Composer {
  const { renderer, scene, camera } = opts;
  const size = new Vector2();
  renderer.getDrawingBufferSize(size);
  let W = Math.max(2, size.x);
  let H = Math.max(2, size.y);
  const half = () => [Math.max(1, Math.floor(W / 2)), Math.max(1, Math.floor(H / 2))] as const;
  const quarter = () => [Math.max(1, Math.floor(W / 4)), Math.max(1, Math.floor(H / 4))] as const;

  // --- targets -------------------------------------------------------------------------------
  const depthTexture = new DepthTexture(W, H, UnsignedIntType);
  depthTexture.format = DepthFormat;
  depthTexture.minFilter = NearestFilter;
  depthTexture.magFilter = NearestFilter;
  depthTexture.name = 'scene-depth';
  const hdr = new WebGLRenderTarget(W, H, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    depthTexture,
    generateMipmaps: false,
  });
  hdr.texture.name = 'scene-hdr';
  let [hw, hh] = half();
  let [qw, qh] = quarter();
  const mist = rt(hw, hh, true);
  const aoA = rt(hw, hh, false);
  const aoB = rt(hw, hh, false);
  // half float: the in-scatter of a shadowed column is a few hundredths — 8 bits would band it
  const rayA = rt(qw, qh, true);
  const rayB = rt(qw, qh, true);
  const bloomA = rt(qw, qh, true);
  const bloomB = rt(qw, qh, true);
  const ldr = rt(W, H, false);

  // --- fullscreen quad -------------------------------------------------------------------------
  const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new Mesh(new PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const pass = (material: ShaderMaterial, target: WebGLRenderTarget | null) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quad, quadCam);
  };
  const mat = (frag: string, uniforms: Record<string, { value: unknown }>, name: string) =>
    new ShaderMaterial({ name, vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

  const settings: ComposerSettings = {
    // 0.6 stacked with the grass blades' self-occlusion and pushed the vegetation-heavy dark
    // quartile 0.05–0.08 under the reference's in every view
    aoStrength: 0.5,
    aoRadius: 0.5,
    // "radiance of a fully lit column": with the sparse gap mask only ≈ 15 % of the under-canopy
    // air is lit, so the beams need this to read as +0.10–0.15 display luminance over the haze
    // between them (the reference's shaft core #8f8b7c over #696960). The pow curve on the smeared
    // buffer keeps the faint multi-gap wash down so the beams read as slabs against the veil
    rayIntensity: 1.8,
    rayContrast: 1.5,
    // warm-neutral like the reference's shafts (its hazed upper frame is (119,118,105), hue ≈ 55°);
    // (1.0, 0.9, 0.72) pulled every sun-facing view's mean hue 2–5° toward orange, (1.0, 0.975,
    // 0.88) (hue 47°) still left shots B/D 4–5° warm of the reference's far haze (56–60°)
    rayColor: new Color(1.0, 0.995, 0.88),
    // the reference's shafts stay readable where they cross the bright canopy gaps, but the fully
    // lit air above the canopy (every sky-depth column marches to uMaxDist through it) must not
    // become a flat glow over the gaps — at 0.6 shot D's far band mid-tones sat 0.08 over the
    // reference's
    raySkyShare: 0.45,
    // scattering = extinction (a non-absorbing aerosol): the same 1/m as the distance haze
    rayBaseDensity: HEIGHT_FOG_DEFAULTS.hazeDensity,
    // the mist pool adds little: at 0.01 the long hollow columns of shot D marched 3× the
    // in-scatter of shot A's and the far band whited out (0.57 against the reference's 0.44); it is
    // also the only in-scatter left in front of the plaza, where every hundredth costs edge contrast
    rayMistDensity: 0.002,
    // steeper than the veil's own extinction (0.032): the shafts are a near-field effect — at the
    // haze's rate the 30–50 m columns of shots B/D (into the hollow) integrated to a flat wash
    // (D's far band 0.47–0.50 against the reference's 0.44) while A's 10–25 m beams stayed faint
    rayExtinction: 0.045,
    // and the march stops where the veil has taken over (75 % fog at 40 m)
    rayMaxDist: 40,
    // gaps 1.5–3 m wide, sparse enough that a 30 m view ray crosses about one of them (at 0.5/0.6
    // ≈ 35 % of the field was open and every ray averaged several gaps into a wash), leaf masses
    // between them letting ≈ 5 % through
    beamFrequency: 0.22,
    beamLo: 0.58,
    beamHi: 0.66,
    beamFloor: 0.05,
    beamColumnScale: 1.0,
    bloomThreshold: 1.0,
    bloomIntensity: 0.25,
    // the reference is 0.03–0.06 more saturated than ours in every view (0.16–0.19 vs 0.10–0.17)
    saturation: 1.12,
    // slightly < 1: the reference's blacks are lifted (shaded plaza stone ≥ 0.32 luminance, nothing
    // below ≈ 0.16) while its sunlit stone tops out around 0.66 — a soft, low-key video look
    contrast: 0.97,
    contrastPivot: 0.18,
    // display-linear pedestal ≈ sRGB 0.06 at black: lifts p2–p10 by ≈ 0.015 and p50 by ≈ 0.01,
    // the shape of the deficit against the reference's compressed video shadows (0.006 put the
    // darkest percentile 0.02–0.04 over the reference's; at exposure 1.0 the shaded plaza already
    // reads 0.03 over the reference's p10, so a hair less than the 0.004 used at 0.94)
    lift: 0.003,
    greenWarm: 0.3,
    greenDesat: 0.08,
    shadowTint: new Color(0.975, 0.985, 1.02),
    highlightTint: new Color(1.05, 1.0, 0.92),
  };

  const near = { value: camera.near };
  const far = { value: camera.far };
  const projInv = { value: new Matrix4() };
  const proj = { value: new Matrix4() };
  const halfTexel = { value: new Vector2(1 / hw, 1 / hh) };
  const quarterTexel = { value: new Vector2(1 / qw, 1 / qh) };

  const aoMat = mat(
    AO_FRAG,
    {
      tDepth: { value: depthTexture },
      uNear: near,
      uFar: far,
      uProj: proj,
      uProjInv: projInv,
      uTexel: halfTexel,
      uRadius: { value: settings.aoRadius },
      uBias: { value: 0.015 },
      uPower: { value: 1.6 },
    },
    'postfx-ao',
  );
  const aoBlurMat = mat(AO_BLUR_FRAG, { tDepth: { value: depthTexture }, uNear: near, uFar: far, tAO: { value: aoA.texture }, uTexel: halfTexel }, 'postfx-ao-blur');
  const sunDirView = new Vector3();
  const sunUv = new Vector2(0.5, 0.5);
  const dirSign = { value: 1 };
  const fog = HEIGHT_FOG_DEFAULTS;
  // world basis of the plane perpendicular to the sun: the canopy-gap mask lives in it, so a gap is
  // a column of lit air along the sun direction wherever the camera stands
  const sunRight = new Vector3(0, 1, 0).cross(opts.sunDirection).normalize();
  const sunUp = new Vector3().crossVectors(opts.sunDirection, sunRight).normalize();
  // the fixed shaft columns as (x, y, radius) in that plane
  const gaps = SHAFT_COLUMNS.map(({ point, radius }) => {
    const p = new Vector3(point[0], point[1], point[2]);
    return new Vector3(p.dot(sunRight), p.dot(sunUp), radius);
  });
  const rayMarchMat = mat(
    RAY_MARCH_FRAG,
    {
      tDepth: { value: depthTexture },
      uNear: near,
      uFar: far,
      uProjInv: projInv,
      uViewInv: { value: new Matrix4() },
      uShadowMatrix: { value: new Matrix4() },
      tShadow: { value: null as Texture | null },
      uSunDirView: { value: sunDirView },
      uSunRight: { value: sunRight },
      uSunUp: { value: sunUp },
      uExtinction: { value: settings.rayExtinction },
      uBeam: { value: new Vector4(settings.beamFrequency, settings.beamLo, settings.beamHi, settings.beamFloor) },
      uGaps: { value: gaps },
      uMaxDist: { value: settings.rayMaxDist },
      // the beams' own air profile: a taller, softer layer than the ground mist so shafts keep
      // reading in the upper air of shots A/F even when the mist pool is thin
      uFogParams: { value: new Vector4(2.3, 0.48, fog.northStartZ, fog.northFullZ) },
      // (mist-layer density, base air density) in 1/m — see ComposerSettings
      uDensity: { value: new Vector2(settings.rayMistDensity, settings.rayBaseDensity) },
      // the base air clears above the canopy like the distance haze (same profile as heightfog.ts):
      // a column climbing 30 m into the open air (shot F) carries ≈ half the aerosol of an
      // eye-level column, so the sun-facing upper frame is shafts, not a wash over the crowns
      uAltitude: { value: new Vector2(fog.hazeUniformHeight, fog.hazeScaleHeight) },
      // mild forward scattering: the sun-facing shot F gets ≈ 1.4× the side-lit strength of A/B
      // (0.3 gave 2.1×, a wash over the crowns rather than shafts through them)
      uAnisotropy: { value: 0.15 },
      // the haze's back-scatter lobe (heightfog.ts): looking away from the sun (shot C) the lit air
      // in-scatters far less — the reference shows no airlight wash from behind the camera
      uBackScatter: { value: new Vector2(fog.rayBackScatterMin, -Math.cos((fog.backScatterFullDeg * Math.PI) / 180)) },
    },
    'postfx-ray-march',
  );
  rayMarchMat.defines = { GAPS: String(Math.max(1, gaps.length)) };
  const rayBlurMat = mat(
    RAY_BLUR_FRAG,
    {
      tSrc: { value: null as Texture | null },
      uSunUv: { value: sunUv },
      uDirSign: dirSign,
      uLength: { value: 0.06 },
      uGamma: { value: 1 },
      // taps whose marched length differs by ≈ 17 m (1/3 of uMaxDist) weigh e⁻¹: a near trunk keeps
      // mostly its own short column instead of inheriting the sky columns beside it (13 m vs 50 m
      // → 0.11), while the limb and mid canopy of shot A (10–25 m) still merge into broad slabs
      uDepthK: { value: 3 },
      uTexel: quarterTexel,
    },
    'postfx-ray-blur',
  );
  const copyMat = mat(COPY_FRAG, { tSrc: { value: null as Texture | null }, uScale: { value: 1 } }, 'postfx-copy');
  const brightMat = mat(BRIGHT_FRAG, { tSrc: { value: hdr.texture }, uThreshold: { value: settings.bloomThreshold }, uKnee: { value: 0.35 } }, 'postfx-bright');
  const blurMat = mat(BLUR_FRAG, { tSrc: { value: null as Texture | null }, uDir: { value: new Vector2() } }, 'postfx-blur');
  const rayIntensity = { value: 0 };
  const compositeMat = mat(
    COMPOSITE_FRAG,
    {
      tDepth: { value: depthTexture },
      uNear: near,
      uFar: far,
      tHDR: { value: hdr.texture },
      tAO: { value: aoB.texture },
      tMist: { value: mist.texture },
      tRays: { value: rayA.texture },
      tBloom: { value: bloomA.texture },
      uAoStrength: { value: settings.aoStrength },
      uHasMist: { value: opts.overlay ? 1 : 0 },
      uRayColor: { value: settings.rayColor },
      uRayIntensity: rayIntensity,
      uRaySkyShare: { value: settings.raySkyShare },
      uBloomIntensity: { value: settings.bloomIntensity },
      uExposure: { value: opts.exposure },
      uSaturation: { value: settings.saturation },
      uContrast: { value: settings.contrast },
      uContrastPivot: { value: settings.contrastPivot },
      uLift: { value: settings.lift },
      uGreenWarm: { value: settings.greenWarm },
      uGreenDesat: { value: settings.greenDesat },
      uShadowTint: { value: settings.shadowTint },
      uHighlightTint: { value: settings.highlightTint },
    },
    'postfx-composite',
  );
  const fxaaMat = new ShaderMaterial({
    name: 'postfx-fxaa',
    uniforms: { tDiffuse: { value: ldr.texture }, resolution: { value: new Vector2(1 / W, 1 / H) } },
    vertexShader: FXAAShader.vertexShader,
    fragmentShader: FXAAShader.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  // FXAAShader's vertex shader uses the model-view/projection path; the quad + ortho camera cover NDC.

  const overlayViewport = new Vector2(hw, hh);
  const camPos = new Vector3();
  const camDir = new Vector3();
  const sunWorld = new Vector3();
  const prevClear = new Color();

  renderer.info.autoReset = false;

  /**
   * Screen-space convergence point for the smear blur. Beams converge on the sun when it is in
   * front of the camera and diverge from the anti-solar point when it is behind; projecting the
   * far point on the correct side of the camera keeps the perspective projection well-defined.
   */
  const updateSun = (s: ComposerSettings) => {
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    sunDirView.copy(opts.sunDirection).transformDirection(camera.matrixWorldInverse);
    const facing = -sunDirView.z; // cos(angle between view axis and sun)
    dirSign.value = facing >= 0 ? 1 : -1;
    sunWorld.copy(camPos).addScaledVector(opts.sunDirection, 500 * dirSign.value).project(camera);
    sunUv.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
    // keep the convergence point within reach so off-screen suns still yield directional beams
    const dx = sunUv.x - 0.5;
    const dy = sunUv.y - 0.5;
    const len = Math.hypot(dx, dy);
    const maxR = 4.0;
    if (len > maxR) sunUv.set(0.5 + (dx / len) * maxR, 0.5 + (dy / len) * maxR);
    rayIntensity.value = s.rayIntensity;
  };

  /** the frame's settings: the live object, or a copy with the numeric tuning overrides applied */
  const frameSettings = (): ComposerSettings => {
    const o = settingsOverride();
    if (!o) return settings;
    const s = { ...settings };
    for (const k of Object.keys(o) as (keyof ComposerSettings)[]) {
      const v = o[k];
      if (typeof v === 'number' && typeof settings[k] === 'number') (s as unknown as Record<string, number>)[k] = v;
    }
    return s;
  };

  /** the sun's PCF depth map is only bindable as sampler2DShadow once it exists with a compare fn */
  const bindShadow = (): boolean => {
    const sun = opts.sun();
    const depth = sun?.shadow.map?.depthTexture ?? null;
    if (!sun || !depth || depth.compareFunction === null) return false;
    rayMarchMat.uniforms.tShadow.value = depth;
    rayMarchMat.uniforms.uShadowMatrix.value.copy(sun.shadow.matrix);
    rayMarchMat.uniforms.uViewInv.value.copy(camera.matrixWorld);
    return true;
  };

  const render = () => {
    renderer.info.reset();
    if (debugView() === 'bypass') {
      // cost reference: plain forward render straight to the canvas, no post chain
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    const s = frameSettings();
    near.value = camera.near;
    far.value = camera.far;
    proj.value.copy(camera.projectionMatrix);
    projInv.value.copy(camera.projectionMatrixInverse);

    const prevAutoClear = renderer.autoClear;
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(prevClear);

    // 1. opaque scene (+ shadow maps) into HDR
    renderer.setRenderTarget(hdr);
    renderer.autoClear = true;
    renderer.render(scene, camera);

    updateSun(s);

    // 2. half-res transparent overlay (mist), premultiplied
    if (opts.overlay) {
      opts.overlay.prepare(depthTexture, overlayViewport);
      renderer.setRenderTarget(mist);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.autoClear = false;
      renderer.render(opts.overlay.scene, camera);
      renderer.setClearColor(prevClear, prevAlpha);
    }

    renderer.autoClear = false;

    // 3. AO
    aoMat.uniforms.uRadius.value = s.aoRadius;
    pass(aoMat, aoA);
    pass(aoBlurMat, aoB);

    // 4. god rays (volumetric march through the sun's shadow map, then smear along the sun axis)
    if (rayIntensity.value > 0.001 && bindShadow()) {
      (rayMarchMat.uniforms.uDensity.value as Vector2).set(s.rayMistDensity, s.rayBaseDensity);
      rayMarchMat.uniforms.uExtinction.value = s.rayExtinction;
      rayMarchMat.uniforms.uMaxDist.value = s.rayMaxDist;
      (rayMarchMat.uniforms.uBeam.value as Vector4).set(s.beamFrequency, s.beamLo, s.beamHi, s.beamFloor);
      gaps.forEach((g, i) => (g.z = SHAFT_COLUMNS[i].radius * s.beamColumnScale));
      pass(rayMarchMat, rayA);
      rayBlurMat.uniforms.tSrc.value = rayA.texture;
      rayBlurMat.uniforms.uLength.value = 0.08;
      rayBlurMat.uniforms.uGamma.value = 1;
      pass(rayBlurMat, rayB);
      // second smear shorter than the earlier 0.22: with 24 steps and the gap mask the march is
      // already smooth, and a longer smear blurred the beams into one broad gradient
      rayBlurMat.uniforms.tSrc.value = rayB.texture;
      rayBlurMat.uniforms.uLength.value = 0.14;
      rayBlurMat.uniforms.uGamma.value = s.rayContrast;
      pass(rayBlurMat, rayA);
    } else {
      renderer.setRenderTarget(rayA);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.setClearColor(prevClear, prevAlpha);
    }

    // 5. bloom
    brightMat.uniforms.uThreshold.value = s.bloomThreshold;
    pass(brightMat, bloomA);
    blurMat.uniforms.tSrc.value = bloomA.texture;
    blurMat.uniforms.uDir.value.set(quarterTexel.value.x * 1.4, 0);
    pass(blurMat, bloomB);
    blurMat.uniforms.tSrc.value = bloomB.texture;
    blurMat.uniforms.uDir.value.set(0, quarterTexel.value.y * 1.4);
    pass(blurMat, bloomA);

    // 6. composite + tone map + grade → LDR
    compositeMat.uniforms.uAoStrength.value = s.aoStrength;
    compositeMat.uniforms.uRaySkyShare.value = s.raySkyShare;
    compositeMat.uniforms.uBloomIntensity.value = s.bloomIntensity;
    compositeMat.uniforms.uSaturation.value = s.saturation;
    compositeMat.uniforms.uContrast.value = s.contrast;
    compositeMat.uniforms.uContrastPivot.value = s.contrastPivot;
    compositeMat.uniforms.uLift.value = s.lift;
    compositeMat.uniforms.uGreenWarm.value = s.greenWarm;
    compositeMat.uniforms.uGreenDesat.value = s.greenDesat;
    pass(compositeMat, ldr);

    // 7. FXAA → screen
    const dbg = debugView();
    const dbgSrc = dbg === 'rays' ? rayA : dbg === 'ao' ? aoB : dbg === 'mist' ? mist : dbg === 'bloom' ? bloomA : null;
    if (dbgSrc) {
      copyMat.uniforms.tSrc.value = dbgSrc.texture;
      pass(copyMat, null);
    } else {
      pass(fxaaMat, null);
    }

    renderer.autoClear = prevAutoClear;
  };

  const setSize = () => {
    renderer.getDrawingBufferSize(size);
    W = Math.max(2, size.x);
    H = Math.max(2, size.y);
    [hw, hh] = half();
    [qw, qh] = quarter();
    hdr.setSize(W, H);
    ldr.setSize(W, H);
    mist.setSize(hw, hh);
    aoA.setSize(hw, hh);
    aoB.setSize(hw, hh);
    rayA.setSize(qw, qh);
    rayB.setSize(qw, qh);
    bloomA.setSize(qw, qh);
    bloomB.setSize(qw, qh);
    halfTexel.value.set(1 / hw, 1 / hh);
    quarterTexel.value.set(1 / qw, 1 / qh);
    overlayViewport.set(hw, hh);
    (fxaaMat.uniforms.resolution.value as Vector2).set(1 / W, 1 / H);
  };

  return {
    render,
    setSize,
    depthTexture,
    settings,
    audit: () => ({
      passes: ['scene-hdr', 'mist-half', 'ssao-half', 'ssao-blur-half', 'godray-march-quarter', 'godray-smear-x2-quarter', 'bloom-bright-quarter', 'bloom-blur-x2-quarter', 'composite-aces-grade', 'fxaa'],
      hdr: true,
      resolution: [W, H],
      ambientOcclusion: true,
      aoResolution: [hw, hh],
      godRays: true,
      godRayMethod: 'volumetric-shadow-march+gap-mask',
      godRaySteps: 24,
      godRayResolution: [qw, qh],
      godRayStrength: rayIntensity.value,
      godRayBackScatterMin: fog.rayBackScatterMin,
      godRayExtinctionPerM: settings.rayExtinction,
      godRayMaxDistM: settings.rayMaxDist,
      godRayGapFrequencyPerM: settings.beamFrequency,
      godRayGapFloor: settings.beamFloor,
      godRayFixedColumns: SHAFT_COLUMNS.map((c) => [...c.point, c.radius * settings.beamColumnScale]),
      sunScreenUv: [Math.round(sunUv.x * 1000) / 1000, Math.round(sunUv.y * 1000) / 1000],
      sunInFront: dirSign.value > 0,
      bloom: true,
      bloomThreshold: settings.bloomThreshold,
      toneMapping: 'aces-fitted',
      contrast: settings.contrast,
      contrastPivot: settings.contrastPivot,
      lift: settings.lift,
      aoStrength: settings.aoStrength,
      antialiasing: 'fxaa',
      // every pass is a pure function of the frame (no temporal jitter/accumulation), headless or not
      deterministic: true,
      headless: opts.headless,
    }),
    dispose: () => {
      for (const t of [hdr, ldr, mist, aoA, aoB, rayA, rayB, bloomA, bloomB]) t.dispose();
      depthTexture.dispose();
      for (const m of [aoMat, aoBlurMat, rayMarchMat, rayBlurMat, copyMat, brightMat, blurMat, compositeMat, fxaaMat]) m.dispose();
      quad.geometry.dispose();
      renderer.info.autoReset = true;
    },
  };
}
