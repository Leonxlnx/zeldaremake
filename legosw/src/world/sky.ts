import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CubeCamera,
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  Vector4,
  WebGLCubeRenderTarget,
  type CubeTexture,
  type WebGLRenderer,
} from 'three';
import { Rng } from '../core/rng';
import { DEFAULT_LENS } from '../render/pipeline';

/**
 * Deep space: a baked nebula cube (soft, low-frequency — cheap to sample every frame) and a live
 * star field of point sprites (crisp at any resolution). Both live on the far layer.
 *
 * The sky has one galactic band, a great circle that crosses the upper right of the crawl and the
 * upper left of the +z battle shots, with its warm core just above the Invisible Hand. The cube's
 * alpha holds the band's dust transmission so the stars can go dark in the same lanes.
 */

const BAND_POLE = new Vector3(0.7, 0.55, -0.45).normalize();
const BAND_CORE = (() => {
  const c = new Vector3(0.445, 0.154, 0.883);
  return c.addScaledVector(BAND_POLE, -c.dot(BAND_POLE)).normalize();
})();
const BAND_THICK = 0.15;
/** reference frame height (px) the star sizes and energies are authored for */
const REF_H = 804;
/** the final pass's lateral chromatic aberration per unit of `Lens.ca` (uv of shift per uv from the centre) */
const LENS_CA_UV = 0.0045;

const vec3 = (v: Vector3) => `vec3(${v.x.toFixed(5)}, ${v.y.toFixed(5)}, ${v.z.toFixed(5)})`;

let baked: CubeTexture | null = null;

export function bakeNebula(renderer: WebGLRenderer, o: { size?: number; seed?: number; tint?: [number, number, number]; strength?: number } = {}): CubeTexture {
  const rt = new WebGLCubeRenderTarget(o.size ?? 512, { type: HalfFloatType, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter });
  const scene = new Scene();
  const mat = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: { seed: { value: o.seed ?? 3 }, tint: { value: new Color(...(o.tint ?? [0.35, 0.45, 0.9])) }, strength: { value: o.strength ?? 1 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float seed; uniform vec3 tint; uniform float strength; varying vec3 vDir;
      float h(vec3 p){ p = fract(p * 0.3183099 + 0.1 + seed * 0.013); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i+vec3(0,0,0)),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y), f.z); }
      float fbm(vec3 p, int oct){ float s = 0.0, a = 0.5, t = 0.0; for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * n(p); t += a; p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s / t; }
      void main(){
        vec3 d = normalize(vDir);
        vec3 P = ${vec3(BAND_POLE)}, C = ${vec3(BAND_CORE)};
        vec3 c = vec3(0.006, 0.0085, 0.017);
        float T = 1.0;
        float lat0 = abs(dot(d, P));
        if (lat0 < 0.8) {
          // the band wanders: latitude wobble and a shear along its length
          vec3 q = d * 1.6 + seed;
          vec2 wv = vec2(fbm(q, 4), fbm(q + vec3(5.2, 1.3, 2.8), 4)) - 0.5;
          vec3 dw = normalize(d + (P * wv.x + cross(P, d) * wv.y) * 0.6);
          float coreF = pow(max(dot(d, C), 0.0), 5.0);
          float thick = ${BAND_THICK.toFixed(3)} * (1.0 + 0.6 * pow(max(dot(d, C), 0.0), 3.0));
          float lat = dot(dw, P);
          float band = exp(-pow(lat / thick, 2.0));
          float halo = exp(-pow(lat / (thick * 2.4), 2.0));
          float fade = smoothstep(0.8, 0.55, lat0);
          // star clouds, fine grain, a dusky rift down the middle and soft dust filaments
          float clouds = smoothstep(0.3, 0.75, fbm(dw * 4.5 - seed, 5));
          float fine = fbm(dw * 12.0 + vec3(wv, wv.x) * 2.0, 4);
          float rift = smoothstep(0.5, 0.66, fbm(dw * 3.2 + vec3(7.0, 1.0, 3.0), 5)) * exp(-pow(lat / (thick * 0.6), 2.0));
          float fil = exp(-pow((fbm(dw * 7.0 + vec3(2.0, 9.0, 4.0), 4) - 0.5) / 0.055, 2.0)) * band;
          T = 1.0 - clamp(0.45 * rift + 0.25 * fil, 0.0, 0.6) * fade;
          float glow = (band * (0.35 + 0.65 * clouds) * (0.8 + 0.2 * fine) + 0.08 * halo) * (0.75 + 0.75 * coreF);
          // pale blue star clouds, a cool violet-white at the core (dim warm or neutral glow reads as brown or fog)
          vec3 sc = mix(tint / dot(tint, vec3(0.2126, 0.7152, 0.0722)) * 0.6 + 0.4, vec3(0.98, 0.94, 1.12), smoothstep(0.15, 0.9, coreF));
          c += sc * glow * 0.065 * T * fade;
          // sparse emission nebulae hugging the band: hydrogen pinks and oxygen teals
          float em = smoothstep(0.58, 0.8, fbm(dw * 2.6 + vec3(17.0, 3.0, 9.0), 4)) * halo;
          vec3 ec = mix(vec3(0.95, 0.22, 0.48), vec3(0.16, 0.62, 0.7), smoothstep(0.4, 0.6, fbm(dw * 1.3 + vec3(5.0, 5.0, 1.0), 3)));
          c += ec * em * (0.5 + fine) * 0.07 * mix(1.0, T, 0.6) * fade;
        }
        gl_FragColor = vec4(c * strength, T);
      }`,
  });
  scene.add(new Mesh(new SphereGeometry(10, 64, 32), mat));
  const cam = new CubeCamera(1, 100, rt);
  cam.update(renderer, scene);
  mat.dispose();
  baked = rt.texture;
  return rt.texture;
}

/** linear star colours by temperature (cumulative share, r, g, b), each at unit luminance */
const STAR_COLS = (
  [
    [0.1, 0.62, 0.74, 1.0],
    [0.42, 0.84, 0.9, 1.0],
    [0.72, 1.0, 0.96, 0.9],
    [0.9, 1.0, 0.84, 0.64],
    [1.0, 1.0, 0.68, 0.46],
  ] as const
).map(([p, r, g, b]) => {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { p, c: [r / l, g / l, b / l] as [number, number, number] };
});

function starCol(u: number): [number, number, number] {
  for (const s of STAR_COLS) if (u < s.p) return s.c;
  return STAR_COLS[STAR_COLS.length - 1].c;
}

/**
 * `count` all-sky stars with a steep brightness distribution, plus ~2.4x as many faint stars in the
 * galactic band (they take their brightness from the baked glow, so they resolve its clouds and
 * vanish in its dust) and a few dozen open clusters. Every star is an energy-conserving gaussian,
 * at least 0.6 px wide, authored at an 804 px frame height: smaller frames get the same star field
 * as a proper downscale would show it, and a star keeps its brightness as it slides across pixels.
 */
export function makeStars(o: { count?: number; seed?: number; radius?: number } = {}): Group {
  const count = o.count ?? 9000;
  const R = o.radius ?? 900000;
  const rng = new Rng(o.seed ?? 11);
  const P = BAND_POLE, C = BAND_CORE, B = new Vector3().crossVectors(P, C);
  const pos: number[] = [], col: number[] = [], sig: number[] = [], bandA: number[] = [];
  const push = (d: Vector3, e: number, s: number, c: [number, number, number], band: number) => {
    pos.push(d.x * R, d.y * R, d.z * R);
    col.push(c[0] * e, c[1] * e, c[2] * e);
    sig.push(s);
    bandA.push(band);
  };
  const d = new Vector3();
  const uniform = () => {
    const u = rng.next() * 2 - 1, t = rng.next() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return d.set(s * Math.cos(t), u, s * Math.sin(t));
  };
  // a direction in the band: gaussian latitude, longitude weighted towards the core
  const inBand = (sd: number) => {
    let phi = 0;
    for (let k = 0; k < 16; k++) {
      phi = rng.next() * Math.PI * 2;
      if (rng.next() * 2.15 < 0.55 + 1.6 * Math.pow(Math.max(Math.cos(phi), 0), 5)) break;
    }
    const lat = rng.gauss(0, sd);
    return d.copy(C).multiplyScalar(Math.cos(phi)).addScaledVector(B, Math.sin(phi)).addScaledVector(P, lat).normalize();
  };

  for (let i = 0; i < count; i++) {
    const b = Math.pow(rng.next(), 5);
    push(uniform(), 0.2 + 12 * b, 0.6 + 0.9 * Math.sqrt(b), starCol(rng.next()), 0);
  }
  const nBand = Math.round(count * 2.4);
  for (let i = 0; i < nBand; i++) {
    push(inBand(0.2), 0.05 + 0.9 * Math.pow(rng.next(), 2.5), 0.6, starCol(rng.next()), 1);
  }
  const t1 = new Vector3(), t2 = new Vector3(), c0 = new Vector3();
  for (let k = 0; k < 40; k++) {
    c0.copy(rng.chance(0.75) ? inBand(0.12) : uniform());
    t1.set(0, 1, 0).cross(c0).normalize();
    t2.crossVectors(c0, t1);
    const r = 0.003 + 0.012 * rng.next() * rng.next();
    const young = rng.chance(0.6);
    const m = 10 + Math.floor(rng.next() * 40);
    for (let j = 0; j < m; j++) {
      d.copy(c0).addScaledVector(t1, rng.gauss(0, r)).addScaledVector(t2, rng.gauss(0, r)).normalize();
      const b = Math.pow(rng.next(), 3);
      push(d, 0.25 + 2.2 * b, 0.6 + 0.3 * Math.sqrt(b), starCol(young ? rng.next() * 0.5 : 0.5 + rng.next() * 0.5), 0);
    }
  }

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute('size', new BufferAttribute(new Float32Array(sig), 1));
  g.setAttribute('band', new BufferAttribute(new Float32Array(bandA), 1));
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    defines: { NEB: baked ? 1 : 0 },
    uniforms: { scale: { value: 1 }, uRes: { value: new Vector2(REF_H * 2.39, REF_H) }, uCA: { value: 0 }, tNeb: { value: baked } },
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 color; attribute float band;
      uniform float scale; uniform vec2 uRes; uniform float uCA;
      #if NEB
      uniform samplerCube tNeb;
      #endif
      varying vec3 vCol; varying float vSig; varying float vSize; varying vec2 vOff;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
        float uH = uRes.y;
        float k = uH / ${REF_H.toFixed(1)};
        float s = max(0.6, size * k * scale);
        vec3 e = color * k * k;
        #if NEB
        // the dust that darkens the band's lanes hides the stars behind it; band stars also ride its glow
        vec4 sky = textureLod(tNeb, normalize(wp.xyz - cameraPosition), 0.0);
        float glow = max(dot(sky.rgb, vec3(0.3, 0.55, 0.15)) - 0.0085, 0.0);
        e *= mix(sqrt(sky.a), sky.a * min(glow * 28.0, 1.5), band);
        #endif
        // the lens's lateral colour shift at this point (px, y up): red and blue are drawn this far the other
        // way so each star lands as one point instead of a red-green-blue triplet
        vOff = clamp(gl_Position.xy / max(gl_Position.w, 1e-6) * 0.5 * uCA * uRes, -12.0, 12.0);
        vSig = s;
        vSize = ceil(s * 6.0 + 1.0 + 2.0 * max(abs(vOff.x), abs(vOff.y)));
        gl_PointSize = vSize;
        vCol = e / (6.2831853 * s * s);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vSig; varying float vSize; varying vec2 vOff;
      void main(){
        vec2 p = (gl_PointCoord - 0.5) * vSize;
        p.y = -p.y;
        float k = -0.5 / (vSig * vSig);
        vec2 pr = p + vOff, pb = p - vOff;
        vec3 a = exp(vec3(dot(pr, pr), dot(p, p), dot(pb, pb)) * k);
        if (max(a.r, max(a.g, a.b)) < 0.003) discard;
        gl_FragColor = vec4(vCol * a, 1.0);
      }`,
  });
  const pts = new Points(g, m);
  pts.frustumCulled = false;
  pts.userData.material = m;
  const vp = new Vector4();
  pts.onBeforeRender = (renderer) => {
    renderer.getCurrentViewport(vp);
    m.uniforms.uRes.value.set(vp.z, vp.w);
    // the final pass samples red at uv - d * ca * LENS_CA_UV and blue at uv + d * ca * LENS_CA_UV (d = uv - 0.5)
    m.uniforms.uCA.value = DEFAULT_LENS.ca * LENS_CA_UV;
  };
  const grp = new Group();
  grp.name = 'stars';
  grp.add(pts);
  return grp;
}
