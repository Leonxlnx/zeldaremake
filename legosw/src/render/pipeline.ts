import {
  AdditiveBlending,
  DepthTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  NoBlending,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  WebGLRenderer,
  type Blending,
  type Scene,
  type Texture,
} from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Film renderer: optional far layer (sky, planet, distant fleet on layer 1, its own depth range)
 * then the near layer into an MSAA HDR target; optional shutter accumulation for real motion blur;
 * a compact physically-motivated bloom; and one final pass for depth of field, chromatic
 * aberration, ACES tone mapping, grade, vignette and grain.
 */

export interface Lens {
  /** focus distance (world units) */
  focus: number;
  /** blur radius in px at infinity (0 = no depth of field) */
  aperture: number;
  exposure: number;
  bloom: number;
  bloomThreshold: number;
  vignette: number;
  grain: number;
  ca: number;
  saturation: number;
  contrast: number;
  /** warm/cool grade: +1 warm highlights / teal shadows */
  split: number;
  lift: [number, number, number];
  gain: [number, number, number];
  /** anamorphic streak strength: very hot sources (engine cores, bolts, fire) throw soft horizontal blue flares */
  streak: number;
  /** HDR level a pixel must exceed to streak */
  streakThreshold: number;
}

export const DEFAULT_LENS: Lens = {
  focus: 40,
  aperture: 0,
  exposure: 1.0,
  bloom: 0.9,
  bloomThreshold: 1.0,
  vignette: 0.35,
  grain: 0.035,
  ca: 0.9,
  saturation: 1.08,
  contrast: 1.06,
  split: 0.25,
  lift: [0, 0, 0],
  gain: [1, 1, 1],
  streak: 0.5,
  streakThreshold: 3.0,
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN13 = /* glsl */ `
vec3 down13(sampler2D t, vec2 uv, vec2 px) {
  vec3 A = texture2D(t, uv + px * vec2(-2.0, -2.0)).rgb;
  vec3 B = texture2D(t, uv + px * vec2( 0.0, -2.0)).rgb;
  vec3 C = texture2D(t, uv + px * vec2( 2.0, -2.0)).rgb;
  vec3 D = texture2D(t, uv + px * vec2(-1.0, -1.0)).rgb;
  vec3 E = texture2D(t, uv + px * vec2( 1.0, -1.0)).rgb;
  vec3 F = texture2D(t, uv + px * vec2(-2.0,  0.0)).rgb;
  vec3 G = texture2D(t, uv).rgb;
  vec3 H = texture2D(t, uv + px * vec2( 2.0,  0.0)).rgb;
  vec3 I = texture2D(t, uv + px * vec2(-1.0,  1.0)).rgb;
  vec3 J = texture2D(t, uv + px * vec2( 1.0,  1.0)).rgb;
  vec3 K = texture2D(t, uv + px * vec2(-2.0,  2.0)).rgb;
  vec3 L = texture2D(t, uv + px * vec2( 0.0,  2.0)).rgb;
  vec3 M = texture2D(t, uv + px * vec2( 2.0,  2.0)).rgb;
  vec3 o = (D + E + I + J) * 0.125;
  o += (A + B + G + F) * 0.03125;
  o += (B + C + H + G) * 0.03125;
  o += (F + G + L + K) * 0.03125;
  o += (G + H + M + L) * 0.03125;
  return o;
}`;

function mkPass(frag: string, uniforms: Record<string, { value: unknown }>, blending: Blending = NoBlending): ShaderMaterial {
  return new ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, blending, transparent: blending !== NoBlending });
}

export class Pipeline {
  readonly renderer: WebGLRenderer;
  width = 1;
  height = 1;
  private sceneRT!: WebGLRenderTarget;
  private accumRT!: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private streakRT: WebGLRenderTarget[] = [];
  private streakPre: ShaderMaterial;
  private streakBlur: ShaderMaterial;
  private quad = new FullScreenQuad();
  private prefilter: ShaderMaterial;
  private down: ShaderMaterial;
  private up: ShaderMaterial;
  private accum: ShaderMaterial;
  private final: ShaderMaterial;
  private farCam = new PerspectiveCamera();
  samples: number;
  lastRenderMs = 0;

  constructor(canvasParent: HTMLElement, o: { width: number; height: number; samples?: number }) {
    this.samples = o.samples ?? 4;
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, alpha: false, stencil: false, reversedDepthBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.info.autoReset = false;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.autoClear = false;
    canvasParent.appendChild(this.renderer.domElement);

    this.prefilter = mkPass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 px; uniform float threshold; varying vec2 vUv;
      ${DOWN13}
      void main() {
        vec3 s = min(down13(tSrc, vUv, px), vec3(80.0));
        float br = max(s.r, max(s.g, s.b));
        float knee = threshold * 0.6 + 1e-4;
        float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
        rq = rq * rq / (4.0 * knee);
        float w = max(rq, br - threshold) / max(br, 1e-4);
        gl_FragColor = vec4(s * w, 1.0);
      }`,
      { tSrc: { value: null }, px: { value: new Vector2() }, threshold: { value: 1 } },
    );
    this.down = mkPass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 px; varying vec2 vUv;
      ${DOWN13}
      void main() { gl_FragColor = vec4(down13(tSrc, vUv, px), 1.0); }`,
      { tSrc: { value: null }, px: { value: new Vector2() } },
    );
    this.up = mkPass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 px; uniform float weight; varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tSrc, vUv + px * vec2(-1.0, -1.0)).rgb;
        s += texture2D(tSrc, vUv + px * vec2(0.0, -1.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv + px * vec2(1.0, -1.0)).rgb;
        s += texture2D(tSrc, vUv + px * vec2(-1.0, 0.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv).rgb * 4.0;
        s += texture2D(tSrc, vUv + px * vec2(1.0, 0.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv + px * vec2(-1.0, 1.0)).rgb;
        s += texture2D(tSrc, vUv + px * vec2(0.0, 1.0)).rgb * 2.0;
        s += texture2D(tSrc, vUv + px * vec2(1.0, 1.0)).rgb;
        gl_FragColor = vec4(s * (weight / 16.0), 1.0);
      }`,
      { tSrc: { value: null }, px: { value: new Vector2() }, weight: { value: 1 } },
      AdditiveBlending,
    );
    this.streakPre = mkPass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 px; uniform float threshold; varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tSrc, vUv + px * vec2(-0.5, -1.5)).rgb + texture2D(tSrc, vUv + px * vec2(0.5, -0.5)).rgb
               + texture2D(tSrc, vUv + px * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + px * vec2(0.5, 1.5)).rgb;
        s = min(s * 0.25, vec3(60.0));
        float br = max(s.r, max(s.g, s.b));
        gl_FragColor = vec4(s * max(br - threshold, 0.0) / max(br, 1e-4), 1.0);
      }`,
      { tSrc: { value: null }, px: { value: new Vector2() }, threshold: { value: 3 } },
    );
    this.streakBlur = mkPass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 step; varying vec2 vUv;
      void main() {
        vec3 s = texture2D(tSrc, vUv).rgb;
        float wsum = 1.0, w = 1.0;
        for (int k = 1; k <= 7; k++) {
          w *= 0.78;
          s += (texture2D(tSrc, vUv + step * float(k)).rgb + texture2D(tSrc, vUv - step * float(k)).rgb) * w;
          wsum += 2.0 * w;
        }
        gl_FragColor = vec4(s / wsum, 1.0);
      }`,
      { tSrc: { value: null }, step: { value: new Vector2() } },
    );
    this.accum = mkPass(
      /* glsl */ `
      uniform sampler2D tSrc; uniform float weight; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * weight, 1.0); }`,
      { tSrc: { value: null }, weight: { value: 1 } },
      AdditiveBlending,
    );
    this.final = mkPass(FINAL_FRAG, {
      tScene: { value: null },
      tDepth: { value: null },
      tBloom: { value: null },
      tStreak: { value: null },
      streak: { value: 0 },
      res: { value: new Vector2() },
      projInv: { value: new Matrix4() },
      reversed: { value: 1 },
      focus: { value: 40 },
      aperture: { value: 0 },
      exposure: { value: 1 },
      bloom: { value: 0.8 },
      vignette: { value: 0.3 },
      grain: { value: 0.03 },
      ca: { value: 1 },
      saturation: { value: 1 },
      contrast: { value: 1 },
      split: { value: 0 },
      lift: { value: [0, 0, 0] },
      gain: { value: [1, 1, 1] },
      time: { value: 0 },
    });
    this.setSize(o.width, o.height);
  }

  setSize(w: number, h: number): void {
    w = Math.max(16, Math.floor(w));
    h = Math.max(16, Math.floor(h));
    if (w === this.width && h === this.height && this.sceneRT) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.sceneRT?.dispose();
    this.accumRT?.dispose();
    for (const m of this.mips) m.dispose();
    for (const m of this.streakRT) m.dispose();
    const depthTexture = new DepthTexture(w, h, FloatType);
    this.sceneRT = new WebGLRenderTarget(w, h, { type: HalfFloatType, format: RGBAFormat, samples: this.samples, depthTexture, depthBuffer: true, minFilter: LinearFilter, magFilter: LinearFilter });
    this.accumRT = new WebGLRenderTarget(w, h, { type: HalfFloatType, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
    this.mips = [];
    // streaks only need horizontal resolution
    this.streakRT = [0, 1].map(() => new WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 3), { type: HalfFloatType, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }));
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    for (let i = 0; i < 6; i++) {
      this.mips.push(new WebGLRenderTarget(mw, mh, { type: HalfFloatType, format: RGBAFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter }));
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
    }
  }

  /** Block until the GPU has finished the frame (1-pixel readback); for honest timings. */
  sync(): void {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }

  /** Render the scene (far layer 1 with its own depth range, then near layer 0) into sceneRT. */
  private renderScene(scene: Scene, camera: PerspectiveCamera, far: { near: number; far: number } | null): void {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    const bg = scene.background;
    if (far) {
      const fc = this.farCam;
      fc.fov = camera.fov;
      fc.aspect = camera.aspect;
      fc.near = far.near;
      fc.far = far.far;
      fc.filmGauge = camera.filmGauge;
      fc.filmOffset = camera.filmOffset;
      fc.updateProjectionMatrix();
      camera.updateMatrixWorld();
      fc.matrixWorld.copy(camera.matrixWorld);
      fc.matrixWorldInverse.copy(camera.matrixWorldInverse);
      fc.matrixAutoUpdate = false;
      fc.matrixWorldAutoUpdate = false;
      fc.layers.set(1);
      r.shadowMap.needsUpdate = false;
      r.render(scene, fc);
      r.clearDepth();
      scene.background = null;
    }
    camera.layers.set(0);
    r.shadowMap.needsUpdate = true;
    r.render(scene, camera);
    scene.background = bg;
  }

  /**
   * Render one output frame. With `subframes > 1`, `setSub(k, n)` must pose the world for sub-sample
   * k of n (shutter-open order); the average is the motion-blurred frame.
   */
  render(scene: Scene, camera: PerspectiveCamera, lens: Lens, o: { far?: { near: number; far: number } | null; subframes?: number; setSub?: (k: number, n: number) => void; time?: number } = {}): void {
    const t0 = performance.now();
    const r = this.renderer;
    r.info.reset();
    const n = Math.max(1, o.subframes ?? 1);
    let color: Texture;
    if (n === 1) {
      this.renderScene(scene, camera, o.far ?? null);
      color = this.sceneRT.texture;
    } else {
      r.setRenderTarget(this.accumRT);
      r.setClearColor(0x000000, 1);
      r.clear(true, false, false);
      // render the centre sub-sample last so its depth drives the depth of field
      const order: number[] = [];
      const mid = Math.floor(n / 2);
      for (let k = 0; k < n; k++) if (k !== mid) order.push(k);
      order.push(mid);
      for (const k of order) {
        o.setSub?.(k, n);
        this.renderScene(scene, camera, o.far ?? null);
        this.accum.uniforms.tSrc.value = this.sceneRT.texture;
        this.accum.uniforms.weight.value = 1 / n;
        this.quad.material = this.accum;
        r.setRenderTarget(this.accumRT);
        this.quad.render(r);
      }
      color = this.accumRT.texture;
    }
    // bloom
    const mips = this.mips;
    this.prefilter.uniforms.tSrc.value = color;
    this.prefilter.uniforms.px.value.set(1 / this.width, 1 / this.height);
    this.prefilter.uniforms.threshold.value = lens.bloomThreshold;
    this.quad.material = this.prefilter;
    r.setRenderTarget(mips[0]);
    this.quad.render(r);
    // anamorphic streaks from the thresholded half-res image, before the upsample chain accumulates into mips[0]
    const [sa, sb] = this.streakRT;
    if (lens.streak > 0) {
      this.streakPre.uniforms.tSrc.value = mips[0].texture;
      this.streakPre.uniforms.px.value.set(1 / mips[0].width, 1 / mips[0].height);
      this.streakPre.uniforms.threshold.value = lens.streakThreshold;
      this.quad.material = this.streakPre;
      r.setRenderTarget(sa);
      this.quad.render(r);
      let src = sa, dst = sb;
      for (const k of [1, 4, 16]) {
        this.streakBlur.uniforms.tSrc.value = src.texture;
        this.streakBlur.uniforms.step.value.set(k / sa.width, 0);
        this.quad.material = this.streakBlur;
        r.setRenderTarget(dst);
        this.quad.render(r);
        [src, dst] = [dst, src];
      }
      this.final.uniforms.tStreak.value = src.texture;
    }
    for (let i = 1; i < mips.length; i++) {
      this.down.uniforms.tSrc.value = mips[i - 1].texture;
      this.down.uniforms.px.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
      this.quad.material = this.down;
      r.setRenderTarget(mips[i]);
      this.quad.render(r);
    }
    for (let i = mips.length - 1; i > 0; i--) {
      this.up.uniforms.tSrc.value = mips[i].texture;
      this.up.uniforms.px.value.set(1 / mips[i].width, 1 / mips[i].height);
      this.up.uniforms.weight.value = 1.0;
      this.quad.material = this.up;
      r.setRenderTarget(mips[i - 1]);
      this.quad.render(r);
    }
    // final
    const u = this.final.uniforms;
    u.tScene.value = color;
    u.tDepth.value = this.sceneRT.depthTexture;
    u.tBloom.value = mips[0].texture;
    u.res.value.set(this.width, this.height);
    u.projInv.value.copy(camera.projectionMatrixInverse);
    u.reversed.value = r.capabilities.reversedDepthBuffer ? 1 : 0;
    u.focus.value = lens.focus;
    u.aperture.value = lens.aperture * (this.height / 804);
    u.exposure.value = lens.exposure;
    u.bloom.value = lens.bloom;
    u.streak.value = lens.streak;
    if (lens.streak <= 0) u.tStreak.value = mips[mips.length - 1].texture;
    u.vignette.value = lens.vignette;
    u.grain.value = lens.grain;
    u.ca.value = lens.ca;
    u.saturation.value = lens.saturation;
    u.contrast.value = lens.contrast;
    u.split.value = lens.split;
    u.lift.value = lens.lift;
    u.gain.value = lens.gain;
    u.time.value = o.time ?? 0;
    this.quad.material = this.final;
    r.setRenderTarget(null);
    this.quad.render(r);
    this.lastRenderMs = performance.now() - t0;
  }
}

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tStreak;
uniform float streak;
uniform vec2 res;
uniform mat4 projInv;
uniform float reversed;
uniform float focus, aperture, exposure, bloom, vignette, grain, ca, saturation, contrast, split, time;
uniform vec3 lift, gain;
varying vec2 vUv;

float linDepth(float d) {
  // reversed-Z with a [0,1] clip range: 0 = cleared / infinitely far
  if (reversed > 0.5 ? d <= 1e-7 : d >= 0.999999) return 1e9;
  float ndcZ = reversed > 0.5 ? d : d * 2.0 - 1.0;
  vec4 p = projInv * vec4(0.0, 0.0, ndcZ, 1.0);
  return -p.z / p.w;
}
float coc(vec2 uv) {
  float z = linDepth(texture2D(tDepth, uv).x);
  return clamp(aperture * abs(1.0 - focus / z), 0.0, aperture * 1.6 + 0.001);
}
vec3 rrtOdt(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = IN * color;
  color = rrtOdt(color);
  color = OUT * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }

void main() {
  vec2 uv = vUv;
  vec2 px = 1.0 / res;
  vec3 col;
  vec2 d = uv - 0.5;
  if (aperture > 0.05) {
    float c0 = coc(uv);
    vec3 acc = texture2D(tScene, uv).rgb;
    float wsum = 1.0;
    const float GA = 2.39996323;
    for (int i = 1; i < 28; i++) {
      float fi = float(i);
      float r = sqrt(fi / 28.0) * max(c0, 0.001);
      float a = fi * GA;
      vec2 o = vec2(cos(a), sin(a)) * r * px;
      float cs = coc(uv + o);
      float w = smoothstep(r - 1.0, r + 0.5, cs);
      acc += texture2D(tScene, uv + o).rgb * w;
      wsum += w;
    }
    col = acc / wsum;
  } else {
    vec2 off = d * ca * 0.0045;
    col.r = texture2D(tScene, uv - off).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv + off).b;
  }
  col += texture2D(tBloom, uv).rgb * bloom * 0.09;
  col += texture2D(tStreak, uv).rgb * vec3(0.32, 0.55, 1.0) * streak;
  col = aces(col);
  // grade
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, saturation);
  col = (col - 0.5) * contrast + 0.5;
  vec3 warm = vec3(1.05, 1.0, 0.93), cool = vec3(0.93, 1.0, 1.06);
  col *= mix(vec3(1.0), mix(cool, warm, smoothstep(0.12, 0.7, l)), split);
  col = col * gain + lift * (1.0 - col);
  col = clamp(col, 0.0, 1.0);
  // vignette
  float v = length(d * vec2(res.x / res.y, 1.0) * 0.85);
  col *= mix(1.0, smoothstep(1.05, 0.25, v), vignette);
  vec3 s = toSRGB(col);
  float g = hash(uv * res + fract(time * 13.37) * 311.7) - 0.5;
  s += g * grain * (1.0 - 0.6 * dot(s, vec3(0.333)));
  gl_FragColor = vec4(s, 1.0);
}
`;
