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
 *      against the sun's depth map and a world-space canopy-gap mask with fixed open columns
 *      (atmosphere/shafts.ts), transmittance-weighted, upper-air only, haze density = height-fog
 *      model) → 2 × 12-tap smear along the screen-space sun direction to hide the jitter
 *                                                                                  [3 × ¼ res]
 *   5. bloom: bright pass (threshold ≥ 1.0) → separable 9-tap Gaussian             [3 × ¼ res]
 *   6. composite: AO·HDR + mist + rays + bloom → ACES → subtle grade → sRGB (LDR)   [1 fullscreen]
 *   7. FXAA → LDR                                                                 [1 fullscreen]
 *   8. video softness: 640-grid Gaussian (detail compression gated by a wide activity blur, plus a
 *      uniform share) and a 320-grid Gaussian blended in by a depth-keyed haze weight → default
 *      framebuffer (the canvas holds the final image for headless captures)
 *                                                                        [3 × 640-grid, 6 × 320-grid, 1 fullscreen]
 *
 * All passes are deterministic (no temporal jitter). `renderer.info` is reset once per frame and
 * accumulates every pass, so `stats().drawCalls` stays honest.
 */
import {
  Color,
  DepthFormat,
  DepthTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  type Object3D,
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
import { CANOPY_BEAM_CAPACITY, createCanopyOpeningMask, SHAFT_COLUMNS } from '../atmosphere/shafts';
import type { SharedCanopyOpening } from '../system';
import {
  AO_BLUR_FRAG,
  AO_FRAG,
  BLIT_FRAG,
  BLUR_FRAG,
  BRIGHT_FRAG,
  COMPOSITE_FRAG,
  COPY_FRAG,
  DEPTH_DEBUG_FRAG,
  FULLSCREEN_VERT,
  GAUSS_FRAG,
  RAY_BLUR_FRAG,
  RAY_MARCH_FRAG,
  SHADOWMAP_DEBUG_FRAG,
  SOFT_ACTIVITY_FRAG,
  SOFT_FINAL_FRAG,
} from './shaders';

/**
 * Tuning aids (unset in production):
 * - `globalThis.__ATMO_DEBUG__ = 'rays' | 'ao' | 'mist' | 'bloom'` blits that buffer instead of the
 *   final image; 'soft' shows the softening weights, 'depth' the view distance (/64 m); 'bypass'
 *   skips the whole chain (for cost comparisons).
 * - `globalThis.__ATMO_SETTINGS__ = { rayIntensity: 0, softening: false, ... }` overrides numeric /
 *   boolean `ComposerSettings` fields for the frame, so a probe can isolate one pass's contribution
 *   without a rebuild.
 * - `globalThis.__ATMO_HIDE__ = ['link']` hides the named scene objects for the frame (every pass,
 *   shadow map included) so a probe can measure what one object contributes — e.g. locate a cast
 *   shadow by differencing the frame against the same frame with the caster hidden.
 * - `globalThis.__ATMO_SHADOWMAP_FOCUS__ = { point: [x, y, z], halfSpanM, depthSpanM }` zooms the
 *   'shadowmap' debug view on the depth map around a world point (mid-grey = that point's depth).
 */
const debugView = (): string => (globalThis as { __ATMO_DEBUG__?: string }).__ATMO_DEBUG__ ?? '';
interface ShadowMapFocus {
  point: [number, number, number];
  halfSpanM?: number;
  depthSpanM?: number;
  /** also read the window's raw depth values back into globalThis.__ATMO_SHADOWMAP_READ__ */
  read?: boolean;
}
const shadowMapFocus = (): ShadowMapFocus | null => (globalThis as { __ATMO_SHADOWMAP_FOCUS__?: ShadowMapFocus | null }).__ATMO_SHADOWMAP_FOCUS__ ?? null;
type SettingsOverride = Partial<Record<keyof ComposerSettings, number | boolean>>;
const settingsOverride = (): SettingsOverride | null => (globalThis as { __ATMO_SETTINGS__?: SettingsOverride | null }).__ATMO_SETTINGS__ ?? null;
const hideList = (): string[] => (globalThis as { __ATMO_HIDE__?: string[] | null }).__ATMO_HIDE__ ?? [];

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
  /** resolved lazily because the trees system is constructed after atmosphere */
  canopyOpenings?: () => readonly SharedCanopyOpening[];
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
  /** view distance (m) where the AO term starts fading / is gone (a surface term the haze veils) */
  aoFadeStart: number;
  aoFadeEnd: number;
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
  /** world heights (m) between which the base-air in-scatter fades in (the lit air is the upper air) */
  rayAirFadeLo: number;
  rayAirFadeHi: number;
  /** march length (m) */
  rayMaxDist: number;
  /** canopy-gap mask: frequency (1/m), smoothstep thresholds, floor outside the gaps */
  beamFrequency: number;
  beamLo: number;
  beamHi: number;
  beamFloor: number;
  /** openness (0..1) of the noise gaps; the fixed columns are always fully open, so < 1 makes them the bold shafts */
  beamNoiseMax: number;
  /** radius multiplier of the fixed shaft columns (atmosphere/shafts.ts); 0 disables them */
  beamColumnScale: number;
  /** multiplier on the columns' own in-scatter gains (tuning aid; 1 = as defined in shafts.ts) */
  beamColumnGain: number;
  /** open the published upper-flight corridor's mask, still gated by the real sun shadow map */
  beamCanopyOpenings: boolean;
  /** marched distance (m) over which the gap pattern fades to its mean openness (smooth far air) */
  beamFarStart: number;
  beamFarEnd: number;
  /** mean openness of the gap field (what the far air uses) */
  beamFarFill: number;
  /** world z where the crowns close over the north hollow: the gap pattern fades to its mean from the first to the second */
  beamHollowStartZ: number;
  beamHollowFullZ: number;
  /** video softness (final pass, see SOFT_FINAL_FRAG); false = FXAA straight to the screen */
  softening: boolean;
  /**
   * activity gate: share of fine detail a busy region keeps; activity knee (luma amplitude of the
   * fine detail, wide-averaged) above which a region is "busy" and drops to that share; steepness
   */
  softDetail: number;
  softActivityK: number;
  softActivityPower: number;
  /** share of the 640-grid blur every pixel takes (uniform video band-limit) */
  softUniform: number;
  /** haze blur: view distance (m) where it starts / is full; sky counts as far */
  softFarStart: number;
  softFarFull: number;
  /** Gaussian sigmas in texels: image blur (640 grid), haze blur (320 grid), weight smoothing (320 grid) */
  softBlurSigma: number;
  softFarSigma: number;
  softActivitySigma: number;
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
  /** chroma compressor: HSV saturation above `satKnee` keeps `satSlope` of its excess (1 = off) */
  satKnee: number;
  satSlope: number;
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
  const aa = rt(W, H, false);
  // video softness works on a fixed 640×360 grid (aspect-corrected), so its radii are a share of the
  // frame whatever the device resolution
  const softGrid = () => {
    const sh = Math.max(1, Math.min(H, 360));
    const sw = Math.max(1, Math.min(W, Math.round((sh * W) / H)));
    return [sw, sh, Math.max(1, sw >> 1), Math.max(1, sh >> 1)] as const;
  };
  let [sw, sh, aw, ah] = softGrid();
  const softDown = rt(sw, sh, false);
  const softA = rt(sw, sh, false);
  const softB = rt(sw, sh, false);
  const actA = rt(aw, ah, true);
  const actB = rt(aw, ah, true);
  const farA = rt(aw, ah, false);
  const farB = rt(aw, ah, false);
  const softTexel = { value: new Vector2(1 / sw, 1 / sh) };
  const actTexel = { value: new Vector2(1 / aw, 1 / ah) };

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
    // Reviewed f115 contacts: retain crevices and readable near-leaf detail.
    aoStrength: 0.45,
    aoRadius: 0.5,
    // crevice shading printed through the veil striped shot D's 40–48 m arch (its bark ridges);
    // nothing sub-metre survives 30 m of haze in the reference, and the 22–30 m trunks keep theirs
    aoFadeStart: 22,
    aoFadeEnd: 34,
    // updateSun scales this by actual key /3.1. At the reviewed3.6 key this keeps
    // the previous1.8 rendered shaft gain; turning the key off also removes its shafts.
    rayIntensity: 1.55,
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
    // in-scatter per metre of lit air. Calibrated at the veil's earlier 0.032/m; kept there when
    // the veil thinned to 0.02 so the beams' strength stays as tuned (the shafts are the bright
    // part of the air, the veil between them the dark part)
    rayBaseDensity: 0.032,
    // the mist pool adds little: at 0.01 the long hollow columns of shot D marched 3× the
    // in-scatter of shot A's and the far band whited out (0.57 against the reference's 0.44); it is
    // also the only in-scatter left in front of the plaza, where every hundredth costs edge contrast
    rayMistDensity: 0.002,
    // steeper than the veil's own extinction (0.032): the shafts are a near-field effect — at the
    // haze's rate the 30–50 m columns of shots B/D (into the hollow) integrated to a flat wash
    // (D's far band 0.47–0.50 against the reference's 0.44) while A's 10–25 m beams stayed faint
    rayExtinction: 0.045,
    // the shafts are an upper-air effect (see RAY_MARCH_FRAG): the base-air in-scatter fades in
    // between these heights so eye-level rays to the ground cross unlit air. Measured trade of a
    // higher fade (2.5 / 6): shot B lands on the reference (roof darkest decile 0.236 → 0.214 vs
    // 0.203, forest median 0.492 → 0.457 vs 0.434, frame median 0.403 vs 0.397) but shot D loses
    // its hollow glow (far band median 0.488 → 0.448 vs 0.550) and both lose SSIM — kept at the
    // calibrated heights, exposed here for the tuning hook
    rayAirFadeLo: 1.5,
    rayAirFadeHi: 4.5,
    // and the march stops where the veil has taken over (75 % fog at 40 m)
    rayMaxDist: 40,
    // gaps 1.5–3 m wide, sparse enough that a 30 m view ray crosses about one of them (at 0.5/0.6
    // ≈ 35 % of the field was open and every ray averaged several gaps into a wash), leaf masses
    // between them letting ≈ 5 % through
    beamFrequency: 0.22,
    // same centre (0.62) as the 0.58/0.66 band but a tighter ramp: the reference's beams have
    // crisp edges, not a soft gradient into the veil
    beamLo: 0.595,
    beamHi: 0.645,
    beamFloor: 0.05,
    // the noise gaps open to 65 %, the carved columns to 100 %: shot A's three columns are the
    // reference's few bold beams, the noise gaps a softer wash between them (at 100 % every blob
    // read as bold as a column and shot D's mid band was a field of equal stripes)
    beamNoiseMax: 0.65,
    beamColumnScale: 1.0,
    beamColumnGain: 1.0,
    beamCanopyOpenings: true,
    // the blobs of the gap field seen through 25–40 m of lit hollow air striped the far arch of
    // shot D; past 25 m the pattern fades to its mean, so the far air is a smooth veil (the fill
    // is the field's mean openness — 65 % gaps covering ≈ 23 % of the sun plane, sampled
    // numerically — so the far band's luminance is unchanged)
    beamFarStart: 25,
    beamFarEnd: 38,
    beamFarFill: 0.15,
    // the same fade for the air over the north hollow (mist ramp −4 → −24): the reference's shot D
    // has a diffuse glow there, not slabs, and the 5–25 m gaps in front of the arch were striping
    // its body (±0.017 on a +0.08 ray term). Shot A's beams are the plaza columns (exempt) plus the
    // gap wash south of −8, so they keep their shape
    beamHollowStartZ: -8,
    beamHollowFullZ: -24,
    // The owner concepts call for readable materials. Keep the optional historic video
    // filter for comparison hooks, but use the sharp FXAA image in the normal game.
    softening: false,
    softDetail: 0.85,
    softActivityK: 0.08,
    softActivityPower: 4,
    softUniform: 0.0,
    softFarStart: 40,
    softFarFull: 60,
    softBlurSigma: 1.2,
    softFarSigma: 1.0,
    softActivitySigma: 2.5,
    bloomThreshold: 1.0,
    bloomIntensity: 0.18,
    // the reference is 0.03–0.06 more saturated than ours in every view (0.16–0.19 vs 0.10–0.17)
    saturation: 1.12,
    // Adopted from actual f115 review: retain form while easing the near-shadow toe.
    // Keep a true black point; the fill restores detail without a global pedestal.
    contrast: 1.04,
    contrastPivot: 0.18,
    lift: 0,
    greenWarm: 0.08,
    greenDesat: 0.02,
    satKnee: 0.4,
    satSlope: 0.75,
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
  // the fixed shaft columns as (x, y, radius, gain) in that plane
  const gaps = SHAFT_COLUMNS.map(({ point, radius, gain }) => {
    const p = new Vector3(point[0], point[1], point[2]);
    return new Vector4(p.dot(sunRight), p.dot(sunUp), radius, gain);
  });
  const canopyOpeningMask = createCanopyOpeningMask(sunRight, sunUp);
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
      uBeamNoiseMax: { value: settings.beamNoiseMax },
      uFarAir: { value: new Vector3(settings.beamFarStart, settings.beamFarEnd, settings.beamFarFill) },
      uGapHollow: { value: new Vector2(settings.beamHollowStartZ, settings.beamHollowFullZ) },
      uGaps: { value: gaps },
      uCanopyGaps: { value: canopyOpeningMask.gaps },
      uCanopyGapCount: canopyOpeningMask.count,
      uMaxDist: { value: settings.rayMaxDist },
      // the beams' own air profile: a taller, softer layer than the ground mist so shafts keep
      // reading in the upper air of shots A/F even when the mist pool is thin
      uFogParams: { value: new Vector4(2.3, 0.48, fog.northStartZ, fog.northFullZ) },
      // (mist-layer density, base air density) in 1/m — see ComposerSettings
      uDensity: { value: new Vector2(settings.rayMistDensity, settings.rayBaseDensity) },
      uAirFade: { value: new Vector2(settings.rayAirFadeLo, settings.rayAirFadeHi) },
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
  rayMarchMat.defines = { GAPS: String(Math.max(1, gaps.length)), CANOPY_GAPS: String(CANOPY_BEAM_CAPACITY) };
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
      uAoFade: { value: new Vector2(settings.aoFadeStart, settings.aoFadeEnd) },
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
      uSatKnee: { value: new Vector2(settings.satKnee, settings.satSlope) },
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
  const blitMat = mat(BLIT_FRAG, { tSrc: { value: null as Texture | null } }, 'postfx-blit');
  const shadowDebugMat = new MeshLambertMaterial({ color: 0xffffff, name: 'postfx-shadow-debug' });
  const shadowMapDebugMat = mat(
    SHADOWMAP_DEBUG_FRAG,
    { tSrc: { value: null as Texture | null }, uRect: { value: new Vector4(0, 0, 1, 1) }, uDepthCenter: { value: 0.495 }, uDepthScale: { value: 4 }, uRaw: { value: 0 } },
    'postfx-shadowmap-debug',
  );
  /** diagnostic readback of the raw depth values in the focus window (see __ATMO_SHADOWMAP_FOCUS__.read) */
  let shadowReadTarget: WebGLRenderTarget | null = null;
  const depthDebugMat = mat(DEPTH_DEBUG_FRAG, { tDepth: { value: depthTexture }, uNear: near, uFar: far, uProjInv: projInv }, 'postfx-depth-debug');
  const gaussMat = mat(GAUSS_FRAG, { tSrc: { value: null as Texture | null }, uDir: { value: new Vector2() }, uSigma: { value: 1.5 } }, 'postfx-gauss');
  const softActMat = mat(
    SOFT_ACTIVITY_FRAG,
    {
      tDepth: { value: depthTexture },
      uNear: near,
      uFar: far,
      uProjInv: projInv,
      tDown: { value: softDown.texture },
      tBlur: { value: softB.texture },
      uTexel: softTexel,
      uFarRange: { value: new Vector2(settings.softFarStart, settings.softFarFull) },
    },
    'postfx-soft-weights',
  );
  const softFinalMat = mat(
    SOFT_FINAL_FRAG,
    {
      tSrc: { value: aa.texture },
      tBlur: { value: softB.texture },
      tFar: { value: farB.texture },
      tWeights: { value: actA.texture },
      uGate: { value: new Vector3(settings.softDetail, settings.softActivityK, settings.softActivityPower) },
      uUniform: { value: settings.softUniform },
      uDebug: { value: 0 },
    },
    'postfx-soft-final',
  );

  const overlayViewport = new Vector2(hw, hh);
  const camPos = new Vector3();
  const camDir = new Vector3();
  const sunWorld = new Vector3();
  const prevClear = new Color();
  // Existing ray gains were authored with the directional key at intensity 3.1.
  // Preserve that look at the calibration point, but let the actual key control
  // its scattered light too: an extinguished sun must not leave glowing shafts.
  const rayCalibrationSunIntensity = 3.1;
  let renderedSunIntensity = 0;

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
    renderedSunIntensity = Math.max(0, opts.sun()?.intensity ?? 0);
    rayIntensity.value = s.rayIntensity * renderedSunIntensity / rayCalibrationSunIntensity;
  };

  // Audit the controls used by the most recently rendered frame, including
  // diagnostic overrides. Reporting defaults made captured comparisons ambiguous.
  let lastFrameSettings: ComposerSettings = { ...settings };
  let hasRenderedSettings = false;

  /** the frame's settings: the live object, or a copy with the numeric tuning overrides applied */
  const frameSettings = (): ComposerSettings => {
    const o = settingsOverride();
    if (!o) return settings;
    const s = { ...settings };
    for (const k of Object.keys(o) as (keyof ComposerSettings)[]) {
      const v = o[k];
      if (typeof v === 'number' && typeof settings[k] === 'number') (s as unknown as Record<string, number>)[k] = v;
      else if (typeof v === 'boolean' && typeof settings[k] === 'boolean') (s as unknown as Record<string, boolean>)[k] = v;
    }
    return s;
  };

  /** the sun's raw depth map (BasicShadowMap: no compare function, so it binds as a plain sampler2D) */
  const bindShadow = (): boolean => {
    const sun = opts.sun();
    const depth = sun?.shadow.map?.depthTexture ?? null;
    if (!sun || !depth || depth.compareFunction !== null) return false;
    rayMarchMat.uniforms.tShadow.value = depth;
    rayMarchMat.uniforms.uShadowMatrix.value.copy(sun.shadow.matrix);
    rayMarchMat.uniforms.uViewInv.value.copy(camera.matrixWorld);
    return true;
  };

  const render = () => {
    renderer.info.reset();
    const hidden: Object3D[] = [];
    for (const name of hideList()) {
      const o = scene.getObjectByName(name);
      if (o && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    }
    try {
      renderFrame();
    } finally {
      for (const o of hidden) o.visible = true;
    }
  };

  const renderFrame = () => {
    if (debugView() === 'bypass') {
      // cost reference: plain forward render straight to the canvas, no post chain
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    if (debugView() === 'shadowmap') {
      // lighting diagnostic: the sun's depth map itself (near = white), stretched over the frame
      const sun = opts.sun();
      const depth = sun?.shadow.map?.depthTexture ?? null;
      renderer.setRenderTarget(null);
      if (sun && depth && depth.compareFunction === null) {
        const focus = shadowMapFocus();
        const rect = shadowMapDebugMat.uniforms.uRect.value as Vector4;
        if (focus) {
          // window the map around the focus point: shadow.matrix maps world → [0,1] uv + depth
          const p = new Vector4(focus.point[0], focus.point[1], focus.point[2], 1).applyMatrix4(sun.shadow.matrix);
          const cam = sun.shadow.camera;
          const spanUv = (focus.halfSpanM ?? 3) / (cam.right - cam.left);
          const u = p.x / p.w;
          const v = p.y / p.w;
          rect.set(u - spanUv, v - spanUv, u + spanUv, v + spanUv);
          shadowMapDebugMat.uniforms.uDepthCenter.value = p.z / p.w;
          shadowMapDebugMat.uniforms.uDepthScale.value = (cam.far - cam.near) / (focus.depthSpanM ?? 3);
          if (focus.read) {
            // raw depth readback of the window into a small float target → globalThis.__ATMO_SHADOWMAP_READ__
            const n = 32;
            shadowReadTarget ??= new WebGLRenderTarget(n, n, { type: FloatType, depthBuffer: false });
            shadowMapDebugMat.uniforms.tSrc.value = depth;
            shadowMapDebugMat.uniforms.uRaw.value = 1;
            pass(shadowMapDebugMat, shadowReadTarget);
            shadowMapDebugMat.uniforms.uRaw.value = 0;
            const buf = new Float32Array(n * n * 4);
            renderer.readRenderTargetPixels(shadowReadTarget, 0, 0, n, n, buf);
            const values: number[] = [];
            for (let i = 0; i < n * n; i++) values.push(buf[i * 4]);
            (globalThis as { __ATMO_SHADOWMAP_READ__?: unknown }).__ATMO_SHADOWMAP_READ__ = {
              n,
              uv: [u, v],
              focusDepth: p.z / p.w,
              near: cam.near,
              far: cam.far,
              values,
            };
          }
        } else {
          rect.set(0, 0, 1, 1);
          shadowMapDebugMat.uniforms.uDepthCenter.value = 0.495;
          shadowMapDebugMat.uniforms.uDepthScale.value = 4;
        }
        shadowMapDebugMat.uniforms.tSrc.value = depth;
        pass(shadowMapDebugMat, null);
      } else {
        renderer.clear();
      }
      return;
    }
    if (debugView() === 'shadow') {
      // lighting diagnostic: every surface as white Lambert, so the frame shows N·L × shadow + fill
      // with no albedo, haze or post in the way
      const prevOverride = scene.overrideMaterial;
      const prevFog = scene.fog;
      scene.overrideMaterial = shadowDebugMat;
      scene.fog = null;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      scene.overrideMaterial = prevOverride;
      scene.fog = prevFog;
      return;
    }
    const s = frameSettings();
    lastFrameSettings = { ...s };
    hasRenderedSettings = true;
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
    const marchActive = rayIntensity.value > 0.001 && bindShadow();
    canopyOpeningMask.update(opts.canopyOpenings?.() ?? [], s.beamCanopyOpenings && marchActive);
    if (marchActive) {
      (rayMarchMat.uniforms.uDensity.value as Vector2).set(s.rayMistDensity, s.rayBaseDensity);
      (rayMarchMat.uniforms.uAirFade.value as Vector2).set(s.rayAirFadeLo, s.rayAirFadeHi);
      rayMarchMat.uniforms.uExtinction.value = s.rayExtinction;
      rayMarchMat.uniforms.uMaxDist.value = s.rayMaxDist;
      (rayMarchMat.uniforms.uBeam.value as Vector4).set(s.beamFrequency, s.beamLo, s.beamHi, s.beamFloor);
      rayMarchMat.uniforms.uBeamNoiseMax.value = s.beamNoiseMax;
      (rayMarchMat.uniforms.uFarAir.value as Vector3).set(s.beamFarStart, s.beamFarEnd, s.beamFarFill);
      (rayMarchMat.uniforms.uGapHollow.value as Vector2).set(s.beamHollowStartZ, s.beamHollowFullZ);
      gaps.forEach((g, i) => {
        g.z = SHAFT_COLUMNS[i].radius * s.beamColumnScale;
        g.w = SHAFT_COLUMNS[i].gain * s.beamColumnGain;
      });
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
    (compositeMat.uniforms.uAoFade.value as Vector2).set(s.aoFadeStart, s.aoFadeEnd);
    compositeMat.uniforms.uRaySkyShare.value = s.raySkyShare;
    compositeMat.uniforms.uBloomIntensity.value = s.bloomIntensity;
    compositeMat.uniforms.uSaturation.value = s.saturation;
    compositeMat.uniforms.uContrast.value = s.contrast;
    compositeMat.uniforms.uContrastPivot.value = s.contrastPivot;
    compositeMat.uniforms.uLift.value = s.lift;
    compositeMat.uniforms.uGreenWarm.value = s.greenWarm;
    compositeMat.uniforms.uGreenDesat.value = s.greenDesat;
    (compositeMat.uniforms.uSatKnee.value as Vector2).set(s.satKnee, s.satSlope);
    pass(compositeMat, ldr);

    // 7. FXAA → LDR, 8. video softness → screen
    const dbg = debugView();
    const dbgSrc = dbg === 'rays' ? rayA : dbg === 'ao' ? aoB : dbg === 'mist' ? mist : dbg === 'bloom' ? bloomA : null;
    if (dbgSrc) {
      copyMat.uniforms.tSrc.value = dbgSrc.texture;
      pass(copyMat, null);
    } else if (dbg === 'depth') {
      pass(depthDebugMat, null);
    } else if (!s.softening && dbg !== 'soft') {
      pass(fxaaMat, null);
    } else {
      pass(fxaaMat, aa);
      const dir = gaussMat.uniforms.uDir.value as Vector2;
      const gauss = (src: WebGLRenderTarget, tmp: WebGLRenderTarget, dst: WebGLRenderTarget, texel: Vector2, sigma: number) => {
        gaussMat.uniforms.uSigma.value = sigma;
        gaussMat.uniforms.tSrc.value = src.texture;
        dir.set(texel.x, 0);
        pass(gaussMat, tmp);
        gaussMat.uniforms.tSrc.value = tmp.texture;
        dir.set(0, texel.y);
        pass(gaussMat, dst);
      };
      // b1: 640-grid Gaussian of the frame
      blitMat.uniforms.tSrc.value = aa.texture;
      pass(blitMat, softDown);
      gauss(softDown, softA, softB, softTexel.value, s.softBlurSigma);
      // b2: 320-grid Gaussian of b1 (the haze blur)
      blitMat.uniforms.tSrc.value = softB.texture;
      pass(blitMat, farB);
      gauss(farB, farA, farB, actTexel.value, s.softFarSigma);
      // weights (detail amplitude, haze weight from depth), smoothed on the 320 grid
      (softActMat.uniforms.uFarRange.value as Vector2).set(s.softFarStart, s.softFarFull);
      pass(softActMat, actA);
      gauss(actA, actB, actA, actTexel.value, s.softActivitySigma);
      (softFinalMat.uniforms.uGate.value as Vector3).set(s.softDetail, s.softActivityK, s.softActivityPower);
      softFinalMat.uniforms.uUniform.value = s.softUniform;
      softFinalMat.uniforms.uDebug.value = dbg === 'soft' ? 1 : 0;
      pass(softFinalMat, null);
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
    aa.setSize(W, H);
    [sw, sh, aw, ah] = softGrid();
    softDown.setSize(sw, sh);
    softA.setSize(sw, sh);
    softB.setSize(sw, sh);
    actA.setSize(aw, ah);
    actB.setSize(aw, ah);
    farA.setSize(aw, ah);
    farB.setSize(aw, ah);
    softTexel.value.set(1 / sw, 1 / sh);
    actTexel.value.set(1 / aw, 1 / ah);
  };

  return {
    render,
    setSize,
    depthTexture,
    settings,
    audit: () => ({
      passes: [
        'scene-hdr',
        'mist-half',
        'ssao-half',
        'ssao-blur-half',
        'godray-march-quarter',
        'godray-smear-x2-quarter',
        'bloom-bright-quarter',
        'bloom-blur-x2-quarter',
        'composite-aces-grade',
        'fxaa',
        'soften-down-640',
        'soften-blur-x2-640',
        'soften-haze-blur-x3-320',
        'soften-weights-x3-320',
        'soften-final',
      ],
      hdr: true,
      effectiveSettingsRendered: hasRenderedSettings,
      effectiveSettings: Object.fromEntries(Object.entries(lastFrameSettings)
        .filter(([, value]) => typeof value === 'number' || typeof value === 'boolean')),
      resolution: [W, H],
      ambientOcclusion: true,
      aoResolution: [hw, hh],
      godRays: true,
      godRayMethod: 'volumetric-shadow-march+gap-mask',
      godRaySteps: 24,
      godRayResolution: [qw, qh],
      godRayStrength: rayIntensity.value,
      godRaySunIntensity: renderedSunIntensity,
      godRaySunScale: renderedSunIntensity / rayCalibrationSunIntensity,
      godRayBackScatterMin: fog.rayBackScatterMin,
      godRayExtinctionPerM: lastFrameSettings.rayExtinction,
      godRayMaxDistM: lastFrameSettings.rayMaxDist,
      godRayGapFrequencyPerM: lastFrameSettings.beamFrequency,
      godRayGapFloor: lastFrameSettings.beamFloor,
      godRayGapNoiseMax: lastFrameSettings.beamNoiseMax,
      godRayFarAirM: [lastFrameSettings.beamFarStart, lastFrameSettings.beamFarEnd],
      godRayFarAirFill: lastFrameSettings.beamFarFill,
      godRayGapHollowZ: [lastFrameSettings.beamHollowStartZ, lastFrameSettings.beamHollowFullZ],
      godRayFixedColumns: SHAFT_COLUMNS.map((c) => [...c.point, c.radius * lastFrameSettings.beamColumnScale, c.gain]),
      godRayCanopyOpeningsEnabled: lastFrameSettings.beamCanopyOpenings,
      godRayCanopyOpeningMask: canopyOpeningMask.audit(),
      sunScreenUv: [Math.round(sunUv.x * 1000) / 1000, Math.round(sunUv.y * 1000) / 1000],
      sunInFront: dirSign.value > 0,
      bloom: true,
      bloomThreshold: lastFrameSettings.bloomThreshold,
      toneMapping: 'aces-fitted',
      contrast: lastFrameSettings.contrast,
      contrastPivot: lastFrameSettings.contrastPivot,
      lift: lastFrameSettings.lift,
      aoStrength: lastFrameSettings.aoStrength,
      aoFadeM: [lastFrameSettings.aoFadeStart, lastFrameSettings.aoFadeEnd],
      antialiasing: 'fxaa',
      // final video-softness stage on a fixed 640/320-wide grid (see SOFT_FINAL_FRAG)
      softening: lastFrameSettings.softening,
      softeningGrid: [sw, sh],
      softeningDetailFloor: lastFrameSettings.softDetail,
      softeningActivityKnee: lastFrameSettings.softActivityK,
      softeningUniform: lastFrameSettings.softUniform,
      softeningHazeRangeM: [lastFrameSettings.softFarStart, lastFrameSettings.softFarFull],
      softeningBlurSigmaGrid: [lastFrameSettings.softBlurSigma, lastFrameSettings.softFarSigma],
      // every pass is a pure function of the frame (no temporal jitter/accumulation), headless or not
      deterministic: true,
      headless: opts.headless,
    }),
    dispose: () => {
      for (const t of [hdr, ldr, aa, mist, aoA, aoB, rayA, rayB, bloomA, bloomB, softDown, softA, softB, actA, actB, farA, farB]) t.dispose();
      depthTexture.dispose();
      shadowReadTarget?.dispose();
      for (const m of [aoMat, aoBlurMat, rayMarchMat, rayBlurMat, copyMat, brightMat, blurMat, compositeMat, fxaaMat, blitMat, gaussMat, softActMat, softFinalMat, depthDebugMat, shadowDebugMat, shadowMapDebugMat]) m.dispose();
      quad.geometry.dispose();
      renderer.info.autoReset = true;
    },
  };
}
