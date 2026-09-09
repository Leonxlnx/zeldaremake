/**
 * Post-processing composer — owner: atmosphere/lighting agent.
 *
 * Minimal render-target chain (no EffectComposer overhead) exposed to main.ts as
 * `scene.userData.composer = { render(dt), setSize(w, h) }`:
 *
 *   1. scene → HDR (RGBA half-float, full res) with a 24-bit depth texture       [1 fullscreen]
 *   2. mist overlay scene → premultiplied RGBA (half res), depth-faded             [½ res]
 *   3. SSAO from depth (10 taps, half res) → depth-aware 3×3 blur                  [2 × ½ res]
 *   4. god rays: volumetric march (¼ res, 16 jittered steps per pixel, each tested against the
 *      sun's PCF shadow map, haze density = height-fog model) → 2 × 12-tap smear along the
 *      screen-space sun direction to hide the jitter                               [3 × ¼ res]
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
import { AO_BLUR_FRAG, AO_FRAG, BLUR_FRAG, BRIGHT_FRAG, COMPOSITE_FRAG, COPY_FRAG, FULLSCREEN_VERT, RAY_BLUR_FRAG, RAY_MARCH_FRAG } from './shaders';

/**
 * Tuning aid: `globalThis.__ATMO_DEBUG__ = 'rays' | 'ao' | 'mist' | 'bloom'` blits that buffer instead
 * of the final image; 'bypass' skips the whole chain (for cost comparisons). Unset in production.
 */
const debugView = (): string => (globalThis as { __ATMO_DEBUG__?: string }).__ATMO_DEBUG__ ?? '';

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
  bloomThreshold: number;
  bloomIntensity: number;
  saturation: number;
  /** luminance power curve about `contrastPivot` (linear); > 1 deepens the toe more than it lifts highlights */
  contrast: number;
  contrastPivot: number;
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
  const rayA = rt(qw, qh, false);
  const rayB = rt(qw, qh, false);
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
    aoStrength: 0.6,
    aoRadius: 0.5,
    rayIntensity: 0.7,
    rayContrast: 1.3,
    rayColor: new Color(1.0, 0.9, 0.72),
    bloomThreshold: 1.0,
    bloomIntensity: 0.25,
    saturation: 0.98,
    // slightly < 1: the reference's blacks are lifted (shaded plaza stone ≥ 0.32 luminance, nothing
    // below ≈ 0.16) while its sunlit stone tops out around 0.66 — a soft, low-key video look
    contrast: 0.97,
    contrastPivot: 0.18,
    greenWarm: 0.3,
    greenDesat: 0.15,
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
      uMaxDist: { value: 50 },
      // the beams' own air profile: a taller, softer layer than the ground mist so shafts keep
      // reading in the upper air of shots A/F even when the mist pool is thin
      uFogParams: { value: new Vector4(2.3, 0.48, fog.northStartZ, fog.northFullZ) },
      // height-fog weight, base air density (1/m): a fully lit 50 m column at ground level → ~0.57,
      // a 20 m column (typical distance to the mid-ground in shots A/B) → ~0.3
      uDensity: { value: new Vector2(0.012, 0.005) },
      uAnisotropy: { value: 0.3 },
    },
    'postfx-ray-march',
  );
  const rayBlurMat = mat(
    RAY_BLUR_FRAG,
    { tSrc: { value: null as Texture | null }, uSunUv: { value: sunUv }, uDirSign: dirSign, uLength: { value: 0.06 }, uGamma: { value: 1 }, uTexel: quarterTexel },
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
      uBloomIntensity: { value: settings.bloomIntensity },
      uExposure: { value: opts.exposure },
      uSaturation: { value: settings.saturation },
      uContrast: { value: settings.contrast },
      uContrastPivot: { value: settings.contrastPivot },
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
  const updateSun = () => {
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
    rayIntensity.value = settings.rayIntensity;
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

    updateSun();

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
    aoMat.uniforms.uRadius.value = settings.aoRadius;
    pass(aoMat, aoA);
    pass(aoBlurMat, aoB);

    // 4. god rays (volumetric march through the sun's shadow map, then smear along the sun axis)
    if (rayIntensity.value > 0.001 && bindShadow()) {
      pass(rayMarchMat, rayA);
      rayBlurMat.uniforms.tSrc.value = rayA.texture;
      rayBlurMat.uniforms.uLength.value = 0.08;
      rayBlurMat.uniforms.uGamma.value = 1;
      pass(rayBlurMat, rayB);
      rayBlurMat.uniforms.tSrc.value = rayB.texture;
      rayBlurMat.uniforms.uLength.value = 0.22;
      rayBlurMat.uniforms.uGamma.value = settings.rayContrast;
      pass(rayBlurMat, rayA);
    } else {
      renderer.setRenderTarget(rayA);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.setClearColor(prevClear, prevAlpha);
    }

    // 5. bloom
    brightMat.uniforms.uThreshold.value = settings.bloomThreshold;
    pass(brightMat, bloomA);
    blurMat.uniforms.tSrc.value = bloomA.texture;
    blurMat.uniforms.uDir.value.set(quarterTexel.value.x * 1.4, 0);
    pass(blurMat, bloomB);
    blurMat.uniforms.tSrc.value = bloomB.texture;
    blurMat.uniforms.uDir.value.set(0, quarterTexel.value.y * 1.4);
    pass(blurMat, bloomA);

    // 6. composite + tone map + grade → LDR
    compositeMat.uniforms.uAoStrength.value = settings.aoStrength;
    compositeMat.uniforms.uBloomIntensity.value = settings.bloomIntensity;
    compositeMat.uniforms.uSaturation.value = settings.saturation;
    compositeMat.uniforms.uContrast.value = settings.contrast;
    compositeMat.uniforms.uContrastPivot.value = settings.contrastPivot;
    compositeMat.uniforms.uGreenWarm.value = settings.greenWarm;
    compositeMat.uniforms.uGreenDesat.value = settings.greenDesat;
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
      godRayMethod: 'volumetric-shadow-march',
      godRaySteps: 16,
      godRayResolution: [qw, qh],
      godRayStrength: rayIntensity.value,
      sunScreenUv: [Math.round(sunUv.x * 1000) / 1000, Math.round(sunUv.y * 1000) / 1000],
      sunInFront: dirSign.value > 0,
      bloom: true,
      bloomThreshold: settings.bloomThreshold,
      toneMapping: 'aces-fitted',
      contrast: settings.contrast,
      contrastPivot: settings.contrastPivot,
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
