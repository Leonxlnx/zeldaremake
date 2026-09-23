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
 *      uniform share; the same detail term sharpens the near ground below ≈ 4–10 m) and a 320-grid
 *      Gaussian (σ 3, 13 taps) blended in by a depth-keyed haze weight → default framebuffer (the
 *      canvas holds the final image for headless captures)
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
  type Material,
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
import { perfRuntime } from '../../perfFlags';
import { cullShadowCasters, type ShadowCullStats } from './shadowcull';
import { HEIGHT_FOG_DEFAULTS } from '../atmosphere/heightfog';
import { SCREEN_FAN, SHAFT_COLUMNS } from '../atmosphere/shafts';
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
  SOFT_FAR_PREMUL_FRAG,
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
 * - `globalThis.__ATMO_UNIFORMS__ = { uBarkFloorLift: 0, uLeafFloorLift: 0 }` sets the named numeric
 *   shader uniforms (those a material binds in its onBeforeCompile — the shade floors' lifts, a
 *   custom shader's fill) on every compiled material for the frame and restores them afterwards, so
 *   a probe can measure one material term's share of the frame without editing the material's owner.
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
const uniformOverride = (): Record<string, number> | null => (globalThis as { __ATMO_UNIFORMS__?: Record<string, number> | null }).__ATMO_UNIFORMS__ ?? null;

/**
 * Slack added to every caster's bounding sphere before the swept-frustum test (shadowcull.ts):
 * the shadow filter reads up to 0.45 m (penumbra) + 0.3 m (blocker search) beside a visible
 * receiver and the god-ray march samples the air on the frame's edge, so an occluder that only
 * shades those neighbouring texels must still be drawn. 1 m is twice the widest tap.
 */
const SHADOW_CULL_MARGIN_M = 1.0;

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
  /** terrain height (m) at a point: the god rays' crisp eye-level air rides on the ground under the camera (`rayAirLiftFrom`) */
  groundAt?: (x: number, z: number) => number;
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
  /**
   * AO strength in the near field (the foreground slabs and props), easing to `aoStrength` over
   * `aoNearStart`–`aoNearEnd` (m): the frames keep crisp contact shading in the foreground joints
   * while their mid-distance shade shows none
   */
  aoNearStrength: number;
  aoNearStart: number;
  aoNearEnd: number;
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
  /**
   * ground height (m) under the camera above which the base-air fade band rises with it (by the
   * ground's excess over this): a camera standing on the east plateau (5.2–5.9 m) keeps the crisp
   * eye-level air the plaza's cameras (ground ≈ 0 m, no lift) have
   */
  rayAirLiftFrom: number;
  /** marched distances (m) between which the mist-layer in-scatter ramps in (start >= end disables the ramp) */
  rayMistNearStart: number;
  rayMistNearEnd: number;
  /**
   * marched distances (m) over which a gained column's extra gain (shafts.ts, > 1) fades in: nearer
   * than the first it lights the air like a plain open column, past the second at full gain
   */
  rayColumnNearStart: number;
  rayColumnNearEnd: number;
  /** march length (m) */
  rayMaxDist: number;
  /** Henyey–Greenstein g of the shaft in-scatter: how much the fan brightens toward the sun's side of the frame */
  rayAnisotropy: number;
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
  /** marched distance (m) over which the gap pattern fades to its mean openness (smooth far air) */
  beamFarStart: number;
  beamFarEnd: number;
  /** mean openness of the gap field (what the far air uses) */
  beamFarFill: number;
  /** world z where the crowns close over the north hollow: the gap pattern fades to its mean from the first to the second */
  beamHollowStartZ: number;
  beamHollowFullZ: number;
  /** screen-anchored shaft fan (atmosphere/shafts.ts SCREEN_FAN): strength of the modulation (0 = off, 1 = as defined) */
  fanMix: number;
  /** share of the marched in-scatter the air under the fan keeps (the beams are added on top of it) */
  fanFloor: number;
  /**
   * in-scatter (0..1, before uRayIntensity) added on the hero beam's axis over ≥ 10 m of air when
   * the view axis is fully sun-facing (see fanFacingDeg); the beam is `amp × facing gain`
   */
  fanAmp: number;
  /**
   * the fan fades in as the angle between the view axis and the sun closes from the first to the
   * second value (degrees), using smoothstep on their cosines. SCREEN_FAN carries the defaults;
   * the broad September19 range preserves faint shafts in side/back views. Earlier 81 → 61°
   * tuning fully suppressed A/C/F's fan (historical measurements in shafts.ts).
   */
  fanFacingDeg: [number, number];
  /** lean of the fan's beams from vertical (degrees, down-right, measured on screen) */
  fanLeanDeg: number;
  /** multipliers on the beams' half widths and gains (tuning aids; 1 = as defined) */
  fanWidthScale: number;
  fanGainScale: number;
  /** uv.y where the fan starts blending back to 1 / where it has no effect */
  fanFadeLo: number;
  fanFadeHi: number;
  /** video softness (final pass, see SOFT_FINAL_FRAG); false = FXAA straight to the screen */
  softening: boolean;
  /**
   * shadow pass: skip the casters whose sun-swept bounds cannot reach the view frustum
   * (shadowcull.ts; image-identical, so a probe switches it off only to measure its saving)
   */
  shadowCasterCull: boolean;
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
  /** near sharpening: unsharp-mask gain on the 640-grid detail (0 = off) and the view distances (m) where it starts fading / is gone */
  softNearSharp: number;
  softNearStart: number;
  softNearEnd: number;
  /** haze-blur weight source (SOFT_FINAL_FRAG uFarMode): 0 smoothed, 1 per pixel, 2 smoothed gated by the pixel's own */
  softFarMode: number;
  /** 1 = the haze blur averages far pixels only (normalised convolution), 0 = plain Gaussian of the frame */
  softFarPremul: number;
  bloomThreshold: number;
  bloomIntensity: number;
  /** bloom blur step in quarter-res texels (kernel radius ∝ this; 1.0 ≈ σ 8 px at 1280 wide) */
  bloomRadius: number;
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
    // 0.6 stacked with the grass blades' self-occlusion and pushed the vegetation-heavy dark
    // quartile 0.05–0.08 under the reference's in every view; 0.4 once the canopy shade darkened
    // (shadowfilter leak 0.35 → 0.1): the shaded banks of shots D/F sat 0.05–0.10 under the reference.
    // Round 38 (tone): 0.2. The frames' shade is lifted by canopy bounce and shows no crevice
    // darkening — a contact shadow only under Link and the sunlit props — while ours printed AO
    // under every bush, riser and slab edge as dark structure the frames do not have. The term is
    // multiplied into direct sun and fill alike, so in shade (fill only) it darkens twice. Measured
    // (six views, runtime override, everything else fixed): at 0 SSIM A +0.0083, B +0.0050,
    // C +0.0015, D +0.0060, E +0.0064, F +0.0070 (F mid band pixels < 0.2: 23.0 → 17.2 %,
    // p10 0.151 → 0.165; the frame's 0.6 % / 0.243) for sharpness E 0.853 → 0.834; 0.2 keeps
    // the contact shading under the props and two thirds of the gain (A +0.0053, B +0.0035,
    // C +0.0014, D +0.0048, E +0.0042, F +0.0055; F dark share 19.5 %) at E 0.836. The per-view
    // SSIM maps put every gain in the mid and far rows and a small loss (−0.0005 on B and E) in the
    // near foreground, whose slab joints the frames DO shade — and that foreground is where E's
    // sharpness (0.853 → 0.832 in the full capture) went. Keeping 0.4 to 6 m and easing to 0.2 by
    // 10 m (the near band, parameterised below) recovered only E 0.832 → 0.835 for A −0.0014,
    // D −0.0013, so the band is left neutral (near = far) and the margin comes from the near
    // unsharp instead (softNearSharp).
    aoStrength: 0.2,
    aoNearStrength: 0.2,
    aoNearStart: 6,
    aoNearEnd: 10,
    aoRadius: 0.5,
    // crevice shading printed through the veil striped shot D's 40–48 m arch (its bark ridges);
    // nothing sub-metre survives 30 m of haze in the reference, and the 22–30 m trunks keep theirs
    aoFadeStart: 22,
    aoFadeEnd: 34,
    // Round 33: the march is the ENVELOPE of the lit air (how much of it a pixel looks through:
    // phase toward the sun, haze density, the shadow map, the depth behind), the screen-anchored
    // fan below carries the beam structure. Measured on the ray buffer of the previous settings
    // (1.8 / pow 1.5 / gap floor 0.05 / noise gaps 65 %): the beams it made were the sun-plane gap
    // field seen along the shadow sun, converging on its screen position ((−2.7, −4.1) in shot A,
    // (−0.5, −1.1) in D — 48–51° from vertical), where the frames' beams lean 25–27° in every
    // heading; their in-beam/between contrast read +0.011–0.036 in A against the frame's
    // +0.03–0.06, +0.03 in D against +0.10, and the frame's fog between the beams was 0.04–0.09
    // darker than ours in A's top band (p50 −0.042) and 0.07 darker in D's (−0.068). A smooth
    // envelope (gap floor 0.3, noise gaps fully open, no pow curve, HG g 0.6, mist 0.012) at 0.6
    // took A's top band to −0.014 and D's to +0.015 (SSIM A +0.008, D +0.003) — but the haze BETWEEN
    // the beams, read across them (26° lines, y 0.02–0.2, u 0.11–0.19), sat 0.06–0.07 over the
    // frames' (D 0.58 vs 0.52, A 0.53 vs 0.47); 0.5 under the fan's 0.75 floor puts it at D 0.537,
    // A 0.496 and hands the beams to the fan
    // Daylight pass: retain shafts without bleaching the near foliage or shaded flowers.
    rayIntensity: 0.32,
    rayContrast: 1.0,
    // warm-neutral like the reference's shafts (its hazed upper frame is (119,118,105), hue ≈ 55°);
    // (1.0, 0.9, 0.72) pulled every sun-facing view's mean hue 2–5° toward orange, (1.0, 0.975,
    // 0.88) (hue 47°) still left shots B/D 4–5° warm of the reference's far haze (56–60°)
    rayColor: new Color(1.0, 0.995, 0.88),
    // the reference's shafts stay readable where they cross the bright canopy gaps, but the fully
    // lit air above the canopy (every sky-depth column marches to uMaxDist through it) must not
    // become a flat glow over the gaps — at 0.6 shot D's far band mid-tones sat 0.08 over the
    // reference's
    raySkyShare: 0.25,
    // in-scatter per metre of lit air. Calibrated at the veil's earlier 0.032/m; kept there when
    // the veil thinned to 0.02 so the beams' strength stays as tuned (the shafts are the bright
    // part of the air, the veil between them the dark part)
    rayBaseDensity: 0.032,
    // the mist pool's own in-scatter: the frame's hollow glow behind D's left trees (0.60–0.63 at
    // (0.1–0.3, 0.3–0.45)) sat at 0.42–0.45 with 0.002 (the earlier 0.01 whited the far band only
    // at the 1.8 intensity); 0.012 with the 0.6–0.75 envelope puts it at 0.55–0.58 (D left band
    // p90 −0.177 → −0.027)
    rayMistDensity: 0.012,
    // steeper than the veil's own extinction (0.032): the shafts are a near-field effect — at the
    // haze's rate the 30–50 m columns of shots B/D (into the hollow) integrated to a flat wash
    // (D's far band 0.47–0.50 against the reference's 0.44) while A's 10–25 m beams stayed faint
    rayExtinction: 0.045,
    // the shafts are an upper-air effect (see RAY_MARCH_FRAG): the base-air in-scatter fades in
    // between these heights so eye-level rays to the ground cross unlit air. Measured trade of a
    // higher fade (2.5 / 6): shot B lands on the reference (roof darkest decile 0.236 → 0.214 vs
    // 0.203, forest median 0.492 → 0.457 vs 0.434, frame median 0.403 vs 0.397) but shot D loses
    // its hollow glow (far band median 0.488 → 0.448 vs 0.550) and both lose SSIM.
    // Round 33: with the denser mist term carrying the hollow glow, the base air lifts to 3 / 6.5 so
    // the plaza and path (eye level, 1.5–4.5 m of air) keep their edge contrast: A's bottom band
    // p50 stays at −0.018 while the top band gains +0.03
    // 2026-09-23: thinning this air for the owner's "grey washout" (3 / 6.5 → 6 / 16, and the
    // beams' gaps with it) was measured against his recording and backed out — at his pose the
    // corridor's bright mist fell 2.0 → 0.9 % (his r_024: 22.6 %) and its luminance 0.300 → 0.263:
    // darker trunks in darker grey, not trees in light. His "clear" is bright warm mist with
    // crowns standing in it (reference/ANALYSIS_CLARITY.md §5, fable-5 lane 10, INBOX 08:40).
    rayAirFadeLo: 3,
    rayAirFadeHi: 6.5,
    // 2026-09-23 (the east lane on the plateau): a canopy gap's beam crossing the lane at eye level
    // (≈ 7 m up, above the band) laid a flat grey slab over the houses' dark doorways from 4–6 m;
    // standing there, the band rises by the ground's height over 1.5 m (A–F: no lift)
    rayAirLiftFrom: 1.5,
    // the mist term's ramp along the ray (0 / 0 = off; see RAY_MARCH_FRAG mistNear)
    rayMistNearStart: 0,
    rayMistNearEnd: 0,
    // 2026-09-23 (owner review, the upper house from the plateau): the narrow × 7.5 columns were
    // tuned to read from shot F at 18–31 m; a walker standing in one (the plateau path passes
    // 0.7–1.1 m from the (13.3, 10, −14.6) axis) had that gain on every ray from its first step —
    // a white veil over the house. The gain now fades in over the first metres of the ray. The six
    // fixed cameras first reach a narrow column 7.7 m (C) to 16.6 m (A) out, past the ramp.
    rayColumnNearStart: 2,
    rayColumnNearEnd: 6,
    // and the march stops where the veil has taken over (75 % fog at 40 m)
    rayMaxDist: 40,
    // the frames' beams are strongest looking toward the sun: D (58° off) reads +0.10 in-beam,
    // A (76°) +0.05, C/F (129–135°) only a soft glow; g 0.6 gives phase ratios D 2.6 : A 1.4 :
    // C/F 0.5 (normalised at 90°), 0.15 was nearly flat (1.2 : 1.1 : 0.9)
    rayAnisotropy: 0.6,
    // gaps 1.5–3 m wide, sparse enough that a 30 m view ray crosses about one of them (at 0.5/0.6
    // ≈ 35 % of the field was open and every ray averaged several gaps into a wash), leaf masses
    // between them letting ≈ 5 % through
    beamFrequency: 0.22,
    // same centre (0.62) as the 0.58/0.66 band but a tighter ramp: the reference's beams have
    // crisp edges, not a soft gradient into the veil
    beamLo: 0.595,
    beamHi: 0.645,
    // Round 33: the gap field is a mild modulation of the envelope (leaf masses let 30 % through,
    // gaps fully open), no longer the beams themselves — the shadow map and the carved columns
    // still shape it, the screen fan below draws the beams (at floor 0.05 / 65 % the sun-plane
    // blobs printed 48–51° stripes across the 26° fan)
    beamFloor: 0.3,
    beamNoiseMax: 1.0,
    beamColumnScale: 1.0,
    beamColumnGain: 1.0,
    // the blobs of the gap field seen through 25–40 m of lit hollow air striped the far arch of
    // shot D; past 30 m the pattern fades to its mean, so the far air is a smooth veil (the fill is
    // the field's mean openness — fully open gaps covering ≈ 23 % of the sun plane, sampled
    // numerically — so the far band's luminance is unchanged)
    beamFarStart: 30,
    beamFarEnd: 45,
    beamFarFill: 0.23,
    // the same fade for the air over the north hollow: the reference's shot D has a diffuse glow
    // there, not slabs. Moved north (−8 / −24 → −24 / −40) with the gap floor at 0.3: the hollow's
    // front air keeps the mild modulation, the arch body (40–48 m) stays flat
    beamHollowStartZ: -24,
    beamHollowFullZ: -40,
    // the screen-anchored fan carries the beam structure (see shafts.ts SCREEN_FAN for the measured
    // geometry); the volumetric march is the envelope it modulates
    fanMix: 1,
    fanFloor: SCREEN_FAN.floor,
    fanAmp: SCREEN_FAN.amp,
    fanFacingDeg: [...SCREEN_FAN.facingDeg] as [number, number],
    fanLeanDeg: SCREEN_FAN.leanDeg,
    fanWidthScale: 1,
    fanGainScale: 1,
    fanFadeLo: SCREEN_FAN.fadeY[0],
    fanFadeHi: SCREEN_FAN.fadeY[1],
    // the reference is soft video of a hazy scene (ours measured 1.0–1.5× its sharpness). Per-cell
    // Laplacian maps put the excess in hazed mid-distance foliage and busy near texture, not the
    // flagstones, and an activity gate alone scaled every view by the same factor (it cannot tell
    // shot F's crisp near house from shot C's veiled leaf cards) — the haze blur, keyed on view
    // distance, is what separates them. Tuned offline on the six HQ frames (replica of this chain)
    // (LQ frames + depth, chain replica): shot A is the binding view — its excess is 20–40 m foliage,
    // so the haze blur takes it ≈ 25 % down while shot F, whose excess is the near house, Link and
    // the sharp HUD overlay, moves ≈ 15 %; a stronger setting (haze from 10 m, 25 % uniform) gained
    // +0.035–0.05 SSIM in every view but put A at 0.55× the reference's sharpness
    // Tuned again on the world-only frame: A's sharpness must clear W35 (≥ 0.8) before Link and the
    // HUD add their edges (A 0.905 with them, 0.773 without at 0.45 / 0.1 / 30).
    // The brighter dome and lit far veil (sky.ts, heightfog.ts) raised every view's sharpness ratio
    // by ≈ 0.05 (A 1.10 → 1.16, B 0.97 → 1.03: harder leaf/gap edges in the canopy band) and cost
    // SSIM there; a little more uniform band-limit and a haze blur from 30 m take the ratios back
    // (A 1.08, B 0.94, D 1.18, F 1.31 at 0.1 / 28 / 50, E ≈ 0.9 — the binding hero view) and
    // recover ≈ 40 % of that SSIM.
    // Round 12: the haze fitted per depth bin (heightfog.ts hazeDensity 0.02 → 0.028) takes the
    // mid-distance detail the softening used to remove, so the softening gives the sharpness back:
    // with the old settings A/B read 0.76/0.75 (W35 gate 0.8). Measured on the same build with
    // runtime overrides: detail floor 0.68 → 0.85 / uniform 0.1 → 0.05 / haze 36–56 m gave
    // A 0.80, B 0.80 (SSIM −0.003); the floor at 1.0 changed nothing more (the gate is now a small
    // band-limit on the busiest cells); uniform 0 → A 0.84, B 0.83; the whole stage off → 0.90/0.89
    // but −0.012/−0.010 SSIM. The haze blur is the SSIM-efficient part (+0.008 A for −0.06 sharp);
    // its start moved 36 → 40 m (+0.004 sharp, −0.001 SSIM)
    // Round 31 (tone): the SSIM the metric charges for restoring tonal range is local variance —
    // in the veiled bands its windows sit where the regularisation constant dominates (cs ≈
    // C2 / (σx² + σy² + C2) at σ ≈ 0.02), so every contrast gain is paid there and every
    // smoothing of the far bands earns there. The haze blur from 25 m at σ 1.6 measured
    // +0.004 (D) / +0.007 (B) SSIM for −0.012 / −0.028 sharpness (D 0.979, B 0.934 — E, the
    // binding view at 0.90, keeps ≈ 0.87 against W35's 0.8) with no tonal change (≤ 0.003 in any
    // band statistic); it pays for the hemisphere bounce revert (config.sky.hemiGround) and the
    // IBL cut (lighting/index.ts) that take the darkest deciles down.
    // Round 34 (tone): edge energy measured per depth band (our depth image binning both frames,
    // 3×3 Laplacian variance at 256×144, HUD masked) against the six frames. The frames are NOT
    // uniformly soft: near (< 6 m) ours/ref = A 0.70, D 0.83, E 0.88, F 0.83 (B 1.18, C 1.43 — the
    // same plaza stones as A; the B/E pair, one held camera 10 s apart, differs 35 % in near-band
    // energy, so the frames' own compression sets a ±20 % floor on any per-band fit); mid (6–20 m)
    // 0.85–1.30; far (20–50 m) 0.29–0.97 (F 2.1); very far 0.08–1.0 (F 2.7). The softening stage
    // was NOT what made B/D/E soft in the mid/far bands (stage off: far 0.44–0.64) — that is the
    // veil and the missing far structure — and the frames' near ground is crisper than ours (A's
    // stone chips and joints, Link's silhouette), not softer. A depth-keyed unsharp mask on the
    // 640-grid detail (gain 0.25 below 4 m, gone by 10 m) puts E's near band at 1.0× the frame
    // (from 0.88) and A's at 0.80 (from 0.70) — +0.07 whole-frame sharpness on E, +0.10 on D — for
    // −0.0007 (E) / −0.0004 (A) SSIM; the haze blur's σ 1.6 → 3.0 (13-tap kernel) pays that back
    // and more (+0.0025 E, +0.0047 A at σ 3.0) at −0.003 sharpness: the far bands' Laplacian
    // energy hardly moves (E far 2.25 → 2.29e-3), the metric's 8×8 windows at the near/far
    // silhouettes lose variance where the structures do not align (cs ≈ C2 / (σx² + σy² + C2)).
    // Measured negatives (kept as settings, all off): keying the haze blur on the pixel's own depth
    // instead of the 16 px-smoothed weight (softFarMode 1/2, softFarPremul) makes the canopy's
    // leaf/sky edges crisp and costs −0.003…−0.0045 SSIM in every view; sharpening the mid band
    // (6–24 m) costs 4× the SSIM per unit of sharpness; the activity gate never engages on the
    // world (fine-detail amplitude 0.005–0.03 against the 0.08 knee, only the HUD trips it) and
    // does not separate foliage from the house at any knee; bloom intensity/radius leave the pods'
    // measured skirt untouched (the tail is the lanterns' own halo) and 0.15 drops D's 40 m pods
    // under the frame's brightness.
    // Daylight: keep the FXAA image; video-matching defocus obscures crowns from the stair landing.
    softening: false,
    shadowCasterCull: true,
    softDetail: 0.85,
    softActivityK: 0.08,
    softActivityPower: 4,
    softUniform: 0.0,
    // 25 / 60 → 16 / 50 (round 35): pairs with the near-field airlight (heightfog hazeNearField).
    // Alone the earlier start reads +0.0036 (B) / +0.0027 (D) SSIM at −0.02 sharpness (0.916 →
    // 0.93 on B; the frames' window std at 17–30 m is 0.045 against our 0.028, so this is the
    // metric's uncorrelated-structure term, not a match of the frames' softness — see the note
    // above); 8 / 45 read +0.0088 / +0.0075 at 0.85 sharpness and was not taken
    // Round 37 (tone): the haze blur's σ re-swept with the near unsharp in place, E / A / D / F
    // Δ SSIM: 3.6 +0.0018 / +0.0020 / +0.0020 / +0.0017; 4.2 +0.0030 / +0.0036 / +0.0035 / +0.0031;
    // 4.8 +0.0033 / +0.0051 / +0.0045 / +0.0042; 5.4 (A / D / F) +0.0062 / +0.0055 / +0.0053 —
    // sharpness unchanged at every σ (E 0.830 → 0.829, A 0.916 → 0.916) because the 320-grid blur
    // at σ 3 has already taken the far edges the metric's 256×144 Laplacian can see (far 20–50 m
    // ours/ref A 0.73 → 0.74, D 0.27 → 0.27 across the sweep); the gain is the 30–50 m and 50 m+
    // windows' structure term, where our window std (A 0.020, D 0.015) is already under the
    // frame's (0.028 / 0.031) and the structures do not correlate. σ 4.2 taken (the brief's upper
    // value); 4.8 / 5.4 not — more of the same term, not a match of the frames' far texture (the
    // far deficit is structure the frame has and we do not). softFarStart 12 costs the near band
    // (E 0.830 → 0.819, A 0.916 → 0.900 sharpness) for +0.0017 / +0.0033 and stays out.
    // Shipped six-view (with the 81 → 61° fan gate): A 0.2890 → 0.2928, B 0.2622 → 0.2648,
    // C 0.3197 → 0.3229, D 0.3576 → 0.3611, E 0.2719 → 0.2742, F 0.2951 → 0.2982; sharpness,
    // pHash, overexposed (0), farLayerCount and skyFraction unchanged. The blur's cost is the top
    // band's bright tail: A's y 0.08–0.33 p90 0.558 → 0.550 (frame 0.612), B 0.550 → 0.539
    // (0.516), F 0.512 → 0.508 (0.601) — the far gaps mixed with the crowns beside them.
    // Round 37b (tone, on ddfb652): layout-8 moved the lantern bough out of B/E's upper-left and
    // W35 failed there (sharpness B 0.788, E 0.737; the limb and its pods had carried 0.49e-3 of
    // B/E's 10.0e-3 Laplacian variance — a region that over-contributed against the frame's 0.27 —
    // and the top-right cell lost 0.31e-3, Link's cell 0.19e-3). The stage is not the cause: with
    // the softening off B reads 0.789. Per depth band (256×144 Laplacian, ours/ref) B/E sit at
    // near 1.04 / 0.79, mid 6–20 m 0.77 (49 % of the pixels, untouched by the stage), far 0.38 /
    // 0.33. Levers measured on B (Δ sharpness, Δ SSIM B / E vs take-0105): near gain 0.25 → 0.40
    // +0.038 (−0.0006 / −0.0005); end 10 → 16 m +0.028 (−0.0007 / −0.0009); end 22 +0.052
    // (−0.0014 / −0.0014); 0.40 + end 16 +0.086 (−0.0016 / −0.0018); the unsharp band widened
    // (softBlurSigma 2.0 / 3.0 with end 16) +0.065 / +0.076 at the same cost per unit; far σ 3.6
    // +0.000 (−0.0015 / −0.0017); far start 22 +0.008 (−0.0023); AO 0.6 +0.035 (−0.0053 / −0.0064);
    // AO radius 0.8 +0.000; bloom 0.15 +0.003 (0); PCSS penumbra 0.009 / m +0.019 (−0.0011 /
    // −0.0018). The cost per unit of sharpness is set by the band the gain lands in, not its
    // shape: 4–10 m −0.016 SSIM per +1.0, 10–22 m −0.025…−0.03, 3–8 m −0.010 (1.1: +0.128 /
    // +0.120 for −0.0016 / −0.0012), 3–6 m −0.002 on E (1.4: +0.059 for −0.0001) but that band
    // is C's plaza stones (2.0 / 2.4 over 3–6 m: C −0.0042 / −0.0052 at 1.98 / 2.21× the frame's
    // sharpness, D −0.0018 / −0.0024, F −0.0037), so the six-view totals are ≈ −0.012…−0.0145
    // for every profile that reaches E 0.85 and 1.1 over 3 → 8 m is the most even (A −0.0017,
    // C −0.0026, D −0.0023, F −0.0029). The far blur's σ is the only SSIM-positive lever here with
    // no sharpness cost (σ 5.4 alone, this scene: B +0.0024, E +0.0029, C +0.0018 — the round-37
    // structure term, larger now that B/E's upper-left is far hazed trees) and funds the unsharp:
    // 1.1 / 3–8 m + σ 5.4 measured B +0.0008, E +0.0018, C −0.0008 with B 0.916, E 0.857; the
    // six-view at σ 5.4 read A +0.0004, B +0.0008, C −0.0008, D −0.0003, E +0.0018, F −0.0008
    // (sharpness A 1.091, B 0.916, C 1.580, D 1.170, E 0.857, F 1.374) and σ 6.0 — the kernel's
    // 12-tap reach at 2 σ — takes C to −0.0001 and F to +0.0003, so every view holds take-0105
    // within 0.0005. Plainly: the far band is blurred further (σ 6 grid texels = 24 px at 1280)
    // to pay for the near band being sharpened past the frames' — both are metric moves, and the
    // structure the far windows reward us for removing is structure the frames have.
    // Round 38 (direction, not measurement): both 37b moves REVERTED to the ddfb652 values. Astra's
    // matched laptop captures (PR #10 2026-09-16-blink8b-review, tone-b-open vs retained-tone-open)
    // show the 1.1 unsharp crunching face seams, hair facets and cloth edges, and the owner asked
    // for the world to read sharper and more detailed ("like 4K"), which a wider far blur is the
    // opposite of. W35 on B/E (0.788 / 0.737) is to be met with real detail in those frames —
    // geometry, materials, lighting (round-38 trees / vegetation passes) — not with sharpening
    // funded by blur. The far softening itself is under review (clarity pass): the frames' far
    // windows have MORE structure than ours (std 0.031–0.046 vs 0.013–0.020), so the softness
    // that remains should come from haze colour mixing at the right depth, not a Gaussian.
    softFarStart: 16,
    softFarFull: 50,
    softBlurSigma: 1.2,
    softFarSigma: 4.2,
    softActivitySigma: 2.5,
    // Round 38 (tone) proposed 1.2 over 3–8 m for E's W35 margin; not taken — the unsharp funded by
    // blur is the rejected direction (see the round-38 note above); W35 is earned with detail.
    softNearSharp: 0.25,
    softNearStart: 4,
    softNearEnd: 10,
    softFarMode: 0,
    softFarPremul: 0,
    bloomThreshold: 1.0,
    bloomIntensity: 0.25,
    bloomRadius: 1.4,
    // the reference is 0.03–0.06 more saturated than ours in every view (0.16–0.19 vs 0.10–0.17)
    saturation: 1.12,
    // slightly < 1: the reference's blacks are lifted (shaded plaza stone ≥ 0.32 luminance, nothing
    // below ≈ 0.16) while its sunlit stone tops out around 0.66 — a soft, low-key video look.
    // 0.93 with the sun-dominant balance (sun 3.1 / fill 0.95): the darker canopy shade left the
    // D/F shaded banks 0.03 under the reference's p10 while the lit slabs already matched; 0.90
    // over-lifted A/B's blacks (+0.025)
    contrast: 0.93,
    contrastPivot: 0.18,
    // display-linear pedestal ≈ sRGB 0.06 at black: lifts p2–p10 by ≈ 0.015 and p50 by ≈ 0.01,
    // the shape of the deficit against the reference's compressed video shadows (0.006 put the
    // darkest percentile 0.02–0.04 over the reference's; at exposure 1.0 the shaded plaza already
    // reads 0.03 over the reference's p10, so a hair less than the 0.004 used at 0.94)
    lift: 0.003,
    greenWarm: 0.3,
    greenDesat: 0.08,
    // the reference's vegetation is far less saturated than ours (shot F's shaded bank 0.27 against
    // 0.47, C's frame 0.28 against 0.32) while its flagstone matches (0.35–0.38); the warm key
    // leaves the foliage yellow-dominant, so the green-keyed grade never reaches it. A soft knee
    // just above the stone's saturation compresses what lies beyond it (video chroma compression):
    // 0.40 / 0.5 takes F's bank to 0.43 and its frame −0.017 at a cost of −0.017 on B's plaza; a
    // 0.36 knee cost the stone 0.03. The rest of the gap is the foliage albedo, not the grade.
    // Violets (green the weakest channel) are exempt in the shader: W18's purple footprint on D.
    satKnee: 0.4,
    satSlope: 0.5,
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
  /** metres the base-air fade band rises this frame (`rayAirLiftFrom`) */
  const airLift = { value: 0 };
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
      uMaxDist: { value: settings.rayMaxDist },
      // the beams' own air profile: a taller, softer layer than the ground mist so shafts keep
      // reading in the upper air of shots A/F even when the mist pool is thin
      uFogParams: { value: new Vector4(2.3, 0.48, fog.northStartZ, fog.northFullZ) },
      // (mist-layer density, base air density) in 1/m — see ComposerSettings
      uDensity: { value: new Vector2(settings.rayMistDensity, settings.rayBaseDensity) },
      uAirFade: { value: new Vector2(settings.rayAirFadeLo, settings.rayAirFadeHi) },
      uAirLift: airLift,
      uMistNear: { value: new Vector2(settings.rayMistNearStart, settings.rayMistNearEnd) },
      uColumnNear: { value: new Vector2(settings.rayColumnNearStart, settings.rayColumnNearEnd) },
      // the base air clears above the canopy like the distance haze (same profile as heightfog.ts):
      // a column climbing 30 m into the open air (shot F) carries ≈ half the aerosol of an
      // eye-level column, so the sun-facing upper frame is shafts, not a wash over the crowns
      uAltitude: { value: new Vector2(fog.hazeUniformHeight, fog.hazeScaleHeight) },
      uAnisotropy: { value: settings.rayAnisotropy },
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
      uFan: { value: new Vector4(0, 1, W / H, 0) },
      uFanFade: { value: new Vector4(settings.fanFloor, settings.fanFadeLo, settings.fanFadeHi, 0) },
      uFanBeams: { value: SCREEN_FAN.beams.map((b) => new Vector4(b.u, b.halfWidth, b.gain, 0)) },
    },
    'postfx-ray-blur',
  );
  rayBlurMat.defines = { FAN: String(Math.max(1, SCREEN_FAN.beams.length)) };
  const fanBeams = rayBlurMat.uniforms.uFanBeams.value as Vector4[];
  let fanViewGain = 1;
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
      uAoNear: { value: new Vector3(settings.aoNearStrength, settings.aoNearStart, settings.aoNearEnd) },
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
  const gaussMat = mat(GAUSS_FRAG, { tSrc: { value: null as Texture | null }, uDir: { value: new Vector2() }, uSigma: { value: 1.5 }, uReach: { value: 6 } }, 'postfx-gauss');
  const softFarRange = { value: new Vector2(settings.softFarStart, settings.softFarFull) };
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
      uFarRange: softFarRange,
    },
    'postfx-soft-weights',
  );
  const softFarMat = mat(
    SOFT_FAR_PREMUL_FRAG,
    {
      tDepth: { value: depthTexture },
      uNear: near,
      uFar: far,
      uProjInv: projInv,
      tBlur: { value: softB.texture },
      uFarRange: softFarRange,
      uPremul: { value: settings.softFarPremul },
    },
    'postfx-soft-far',
  );
  const softFinalMat = mat(
    SOFT_FINAL_FRAG,
    {
      tDepth: { value: depthTexture },
      uNear: near,
      uFar: far,
      uProjInv: projInv,
      uFarRange: softFarRange,
      tSrc: { value: aa.texture },
      tBlur: { value: softB.texture },
      tFar: { value: farB.texture },
      tWeights: { value: actA.texture },
      uGate: { value: new Vector3(settings.softDetail, settings.softActivityK, settings.softActivityPower) },
      uUniform: { value: settings.softUniform },
      uNearSharp: { value: new Vector3(settings.softNearSharp, settings.softNearStart, settings.softNearEnd) },
      uFarMode: { value: settings.softFarMode },
      uDebug: { value: 0 },
    },
    'postfx-soft-final',
  );

  const overlayViewport = new Vector2(hw, hh);
  /** last frame's shadow-caster cull (shadowcull.ts): casters tested / switched off */
  const shadowCull: ShadowCullStats = { tested: 0, culled: 0 };
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
    airLift.value = opts.groundAt ? Math.max(0, opts.groundAt(camPos.x, camPos.z) - s.rayAirLiftFrom) : 0;
  };

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

  /** per-material compiled uniforms (three keeps the onBeforeCompile additions there) with the override applied */
  const applyUniformOverride = (o: Record<string, number>): (() => void)[] => {
    const restores: (() => void)[] = [];
    const seen = new Set<Material>();
    const visit = (obj: Object3D) => {
      const m = (obj as Mesh).material as Material | Material[] | undefined;
      if (!m) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        const uniforms = (renderer.properties.get(mat) as { uniforms?: Record<string, { value: unknown }> }).uniforms;
        if (!uniforms) continue;
        for (const [k, v] of Object.entries(o)) {
          const u = uniforms[k];
          if (!u || typeof u.value !== 'number') continue;
          const prev = u.value;
          u.value = v;
          restores.push(() => {
            u.value = prev;
          });
        }
      }
    };
    scene.traverse(visit);
    opts.overlay?.scene.traverse(visit);
    return restores;
  };

  const render = () => {
    renderer.info.reset();
    const hidden: Object3D[] = [];
    for (const name of hideList()) {
      const o = scene.getObjectByName(name) ?? opts.overlay?.scene.getObjectByName(name);
      if (o && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    }
    const uo = uniformOverride();
    const restores = uo ? applyUniformOverride(uo) : [];
    try {
      renderFrame();
    } finally {
      for (const o of hidden) o.visible = true;
      for (const r of restores) r();
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
    near.value = camera.near;
    far.value = camera.far;
    proj.value.copy(camera.projectionMatrix);
    projInv.value.copy(camera.projectionMatrixInverse);

    const prevAutoClear = renderer.autoClear;
    const prevAlpha = renderer.getClearAlpha();
    renderer.getClearColor(prevClear);

    // 1. opaque scene (+ shadow maps) into HDR. The shadow pass inside it draws only the casters
    // whose shadows can land in frame (shadowcull.ts): three runs scene.onBeforeRender after the
    // world matrices are updated and before the shadow pass, so the test sees this frame's poses;
    // the casters it switched off are restored once the render returns.
    const casters: { restore: (() => void) | null } = { restore: null };
    const prevOnBeforeRender = scene.onBeforeRender;
    if (s.shadowCasterCull && renderer.shadowMap.enabled) {
      scene.onBeforeRender = () => {
        casters.restore = cullShadowCasters(scene, camera, opts.sunDirection, SHADOW_CULL_MARGIN_M, shadowCull);
      };
    } else shadowCull.tested = shadowCull.culled = 0;
    renderer.setRenderTarget(hdr);
    renderer.autoClear = true;
    try {
      renderer.render(scene, camera);
    } finally {
      scene.onBeforeRender = prevOnBeforeRender;
      casters.restore?.();
    }

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

    // performance flags / auto quality (perfFlags.ts): stages switched off skip their passes; the
    // composite then reads a neutral term (AO strength 0, black rays, bloom intensity 0). All on by
    // default, so the shipped frame is untouched.
    const fx = perfRuntime().fx;

    // 3. AO
    if (fx.ao) {
      aoMat.uniforms.uRadius.value = s.aoRadius;
      pass(aoMat, aoA);
      pass(aoBlurMat, aoB);
    }

    // 4. god rays (volumetric march through the sun's shadow map, then smear along the sun axis)
    if (fx.rays && rayIntensity.value > 0.001 && bindShadow()) {
      (rayMarchMat.uniforms.uDensity.value as Vector2).set(s.rayMistDensity, s.rayBaseDensity);
      (rayMarchMat.uniforms.uAirFade.value as Vector2).set(s.rayAirFadeLo, s.rayAirFadeHi);
      (rayMarchMat.uniforms.uMistNear.value as Vector2).set(s.rayMistNearStart, s.rayMistNearEnd);
      (rayMarchMat.uniforms.uColumnNear.value as Vector2).set(s.rayColumnNearStart, s.rayColumnNearEnd);
      rayMarchMat.uniforms.uExtinction.value = s.rayExtinction;
      rayMarchMat.uniforms.uMaxDist.value = s.rayMaxDist;
      rayMarchMat.uniforms.uAnisotropy.value = s.rayAnisotropy;
      (rayMarchMat.uniforms.uBeam.value as Vector4).set(s.beamFrequency, s.beamLo, s.beamHi, s.beamFloor);
      rayMarchMat.uniforms.uBeamNoiseMax.value = s.beamNoiseMax;
      (rayMarchMat.uniforms.uFarAir.value as Vector3).set(s.beamFarStart, s.beamFarEnd, s.beamFarFill);
      (rayMarchMat.uniforms.uGapHollow.value as Vector2).set(s.beamHollowStartZ, s.beamHollowFullZ);
      gaps.forEach((g, i) => {
        g.z = SHAFT_COLUMNS[i].radius * s.beamColumnScale;
        g.w = SHAFT_COLUMNS[i].gain * s.beamColumnGain;
      });
      pass(rayMarchMat, rayA);
      const fan = rayBlurMat.uniforms.uFan.value as Vector4;
      rayBlurMat.uniforms.tSrc.value = rayA.texture;
      rayBlurMat.uniforms.uLength.value = 0.08;
      rayBlurMat.uniforms.uGamma.value = 1;
      fan.w = 0;
      pass(rayBlurMat, rayB);
      // second smear shorter than the earlier 0.22: with 24 steps and the gap mask the march is
      // already smooth, and a longer smear blurred the beams into one broad gradient; the
      // screen-anchored fan is laid over this last pass
      rayBlurMat.uniforms.tSrc.value = rayB.texture;
      rayBlurMat.uniforms.uLength.value = 0.14;
      rayBlurMat.uniforms.uGamma.value = s.rayContrast;
      const lean = (s.fanLeanDeg * Math.PI) / 180;
      fan.set(Math.sin(lean), Math.cos(lean), W / H, s.fanMix);
      // the fan's facing gain: smoothstep on the cosine of the angle between the view axis and the
      // sun (camera looks down −z in view space, so cos = −sunDirView.z) from fanFacingDeg[0] to [1]
      const cosLo = Math.cos((s.fanFacingDeg[0] * Math.PI) / 180);
      const cosHi = Math.cos((s.fanFacingDeg[1] * Math.PI) / 180);
      const ft = Math.min(1, Math.max(0, (-sunDirView.z - cosLo) / Math.max(1e-4, cosHi - cosLo)));
      fanViewGain = ft * ft * (3 - 2 * ft);
      (rayBlurMat.uniforms.uFanFade.value as Vector4).set(s.fanFloor, s.fanFadeLo, s.fanFadeHi, s.fanAmp * fanViewGain);
      fanBeams.forEach((b, i) => {
        b.y = SCREEN_FAN.beams[i].halfWidth * s.fanWidthScale;
        b.z = SCREEN_FAN.beams[i].gain * s.fanGainScale;
      });
      pass(rayBlurMat, rayA);
    } else {
      renderer.setRenderTarget(rayA);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, false, false);
      renderer.setClearColor(prevClear, prevAlpha);
    }

    // 5. bloom
    if (fx.bloom) {
      brightMat.uniforms.uThreshold.value = s.bloomThreshold;
      pass(brightMat, bloomA);
      blurMat.uniforms.tSrc.value = bloomA.texture;
      blurMat.uniforms.uDir.value.set(quarterTexel.value.x * s.bloomRadius, 0);
      pass(blurMat, bloomB);
      blurMat.uniforms.tSrc.value = bloomB.texture;
      blurMat.uniforms.uDir.value.set(0, quarterTexel.value.y * s.bloomRadius);
      pass(blurMat, bloomA);
    }

    // 6. composite + tone map + grade → LDR
    compositeMat.uniforms.uAoStrength.value = fx.ao ? s.aoStrength : 0;
    (compositeMat.uniforms.uAoFade.value as Vector2).set(s.aoFadeStart, s.aoFadeEnd);
    (compositeMat.uniforms.uAoNear.value as Vector3).set(s.aoNearStrength, s.aoNearStart, s.aoNearEnd);
    compositeMat.uniforms.uRaySkyShare.value = s.raySkyShare;
    compositeMat.uniforms.uBloomIntensity.value = fx.bloom ? s.bloomIntensity : 0;
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
    } else if ((!s.softening || !fx.soft) && dbg !== 'soft') {
      pass(fxaaMat, null);
    } else {
      pass(fxaaMat, aa);
      const dir = gaussMat.uniforms.uDir.value as Vector2;
      const gauss = (src: WebGLRenderTarget, tmp: WebGLRenderTarget, dst: WebGLRenderTarget, texel: Vector2, sigma: number) => {
        gaussMat.uniforms.uSigma.value = sigma;
        // ≥ 6 taps either side (the tuned 13-tap kernel for σ ≤ 3), 2 σ for wider haze blurs
        gaussMat.uniforms.uReach.value = Math.min(12, Math.max(6, Math.ceil(2 * sigma)));
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
      // b2: 320-grid Gaussian of (b1 · farWeight, farWeight) — the haze blur, far pixels only
      softFarRange.value.set(s.softFarStart, s.softFarFull);
      softFarMat.uniforms.uPremul.value = s.softFarPremul;
      pass(softFarMat, farB);
      gauss(farB, farA, farB, actTexel.value, s.softFarSigma);
      // weights (detail amplitude, haze weight from depth), smoothed on the 320 grid
      pass(softActMat, actA);
      gauss(actA, actB, actA, actTexel.value, s.softActivitySigma);
      (softFinalMat.uniforms.uGate.value as Vector3).set(s.softDetail, s.softActivityK, s.softActivityPower);
      softFinalMat.uniforms.uUniform.value = s.softUniform;
      (softFinalMat.uniforms.uNearSharp.value as Vector3).set(s.softNearSharp, s.softNearStart, s.softNearEnd);
      softFinalMat.uniforms.uFarMode.value = s.softFarMode;
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
      resolution: [W, H],
      // shadow pass: casters whose sun-swept bounds miss the view frustum are not drawn (shadowcull.ts)
      shadowCasterCull: settings.shadowCasterCull,
      shadowCastersTested: shadowCull.tested,
      shadowCastersCulled: shadowCull.culled,
      shadowCullMarginM: SHADOW_CULL_MARGIN_M,
      /** stages switched off by the performance flags / auto quality (perfFlags.ts); all on as shipped */
      stagesEnabled: { ...perfRuntime().fx, soft: settings.softening && perfRuntime().fx.soft },
      ambientOcclusion: perfRuntime().fx.ao,
      aoResolution: [hw, hh],
      godRays: perfRuntime().fx.rays,
      godRayMethod: 'volumetric-shadow-march+gap-mask',
      godRaySteps: 24,
      godRayResolution: [qw, qh],
      godRayStrength: rayIntensity.value,
      godRayBackScatterMin: fog.rayBackScatterMin,
      godRayExtinctionPerM: settings.rayExtinction,
      godRayMaxDistM: settings.rayMaxDist,
      godRayAirFadeM: [settings.rayAirFadeLo, settings.rayAirFadeHi],
      godRayAirLiftFromM: settings.rayAirLiftFrom,
      godRayAirLiftM: +airLift.value.toFixed(3),
      godRayMistNearM: [settings.rayMistNearStart, settings.rayMistNearEnd],
      godRayColumnNearM: [settings.rayColumnNearStart, settings.rayColumnNearEnd],
      godRayAnisotropy: settings.rayAnisotropy,
      godRayContrastPow: settings.rayContrast,
      godRayGapFrequencyPerM: settings.beamFrequency,
      godRayGapFloor: settings.beamFloor,
      godRayGapNoiseMax: settings.beamNoiseMax,
      godRayFarAirM: [settings.beamFarStart, settings.beamFarEnd],
      godRayFarAirFill: settings.beamFarFill,
      godRayGapHollowZ: [settings.beamHollowStartZ, settings.beamHollowFullZ],
      godRayFixedColumns: SHAFT_COLUMNS.map((c) => [...c.point, c.radius * settings.beamColumnScale, c.gain]),
      godRayScreenFan: settings.fanMix > 0,
      godRayScreenFanMix: settings.fanMix,
      godRayScreenFanLeanDeg: settings.fanLeanDeg,
      godRayScreenFanFloor: settings.fanFloor,
      godRayScreenFanAmp: settings.fanAmp,
      godRayScreenFanFacingDeg: [...settings.fanFacingDeg],
      godRayScreenFanViewGain: Math.round(fanViewGain * 1000) / 1000,
      godRayScreenFanFadeY: [settings.fanFadeLo, settings.fanFadeHi],
      godRayScreenFanBeams: SCREEN_FAN.beams.map((b) => [b.u, b.halfWidth * settings.fanWidthScale, b.gain * settings.fanGainScale]),
      sunScreenUv: [Math.round(sunUv.x * 1000) / 1000, Math.round(sunUv.y * 1000) / 1000],
      sunInFront: dirSign.value > 0,
      bloom: perfRuntime().fx.bloom,
      bloomThreshold: settings.bloomThreshold,
      bloomIntensity: settings.bloomIntensity,
      bloomRadiusTexels: settings.bloomRadius,
      toneMapping: 'aces-fitted',
      contrast: settings.contrast,
      contrastPivot: settings.contrastPivot,
      lift: settings.lift,
      aoStrength: settings.aoStrength,
      aoFadeM: [settings.aoFadeStart, settings.aoFadeEnd],
      aoNearStrength: settings.aoNearStrength,
      aoNearM: [settings.aoNearStart, settings.aoNearEnd],
      antialiasing: 'fxaa',
      // final video-softness stage on a fixed 640/320-wide grid (see SOFT_FINAL_FRAG)
      softening: settings.softening && perfRuntime().fx.soft,
      softeningGrid: [sw, sh],
      softeningDetailFloor: settings.softDetail,
      softeningActivityKnee: settings.softActivityK,
      softeningUniform: settings.softUniform,
      softeningHazeRangeM: [settings.softFarStart, settings.softFarFull],
      softeningBlurSigmaGrid: [settings.softBlurSigma, settings.softFarSigma],
      softeningHazeWeightMode: settings.softFarMode,
      softeningHazeFarOnly: settings.softFarPremul > 0,
      softeningNearSharp: settings.softNearSharp,
      softeningNearSharpRangeM: [settings.softNearStart, settings.softNearEnd],
      // every pass is a pure function of the frame (no temporal jitter/accumulation), headless or not
      deterministic: true,
      headless: opts.headless,
    }),
    dispose: () => {
      for (const t of [hdr, ldr, aa, mist, aoA, aoB, rayA, rayB, bloomA, bloomB, softDown, softA, softB, actA, actB, farA, farB]) t.dispose();
      depthTexture.dispose();
      shadowReadTarget?.dispose();
      for (const m of [aoMat, aoBlurMat, rayMarchMat, rayBlurMat, copyMat, brightMat, blurMat, compositeMat, fxaaMat, blitMat, gaussMat, softActMat, softFarMat, softFinalMat, depthDebugMat, shadowDebugMat, shadowMapDebugMat]) m.dispose();
      quad.geometry.dispose();
      renderer.info.autoReset = true;
    },
  };
}
