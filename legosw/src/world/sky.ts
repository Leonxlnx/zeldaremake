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
  WebGLCubeRenderTarget,
  type CubeTexture,
  type WebGLRenderer,
} from 'three';
import { Rng } from '../core/rng';

/**
 * Deep space: a baked nebula cube (soft, low-frequency — cheap to sample every frame) and a live
 * star field of point sprites (crisp at any resolution). Both live on the far layer.
 */

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
      float fbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        // a faint galactic band + two coloured nebula lobes
        float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.85, -0.42))) * 3.2, 2.0));
        float f = fbm(d * 2.6 + seed);
        float g = fbm(d * 6.0 - seed * 1.3);
        float lobeA = smoothstep(0.35, 1.0, dot(d, normalize(vec3(-0.6, 0.45, -0.66)))) ;
        float lobeB = smoothstep(0.5, 1.0, dot(d, normalize(vec3(0.75, 0.2, 0.62))));
        vec3 c = vec3(0.0);
        c += tint * pow(f, 3.0) * band * 0.22;
        c += vec3(0.55, 0.22, 0.65) * pow(f * g, 2.0) * lobeA * 0.6;
        c += vec3(0.2, 0.5, 0.85) * pow(g, 3.0) * lobeB * 0.45;
        c += vec3(0.012, 0.016, 0.03);
        gl_FragColor = vec4(c * strength, 1.0);
      }`,
  });
  scene.add(new Mesh(new SphereGeometry(10, 64, 32), mat));
  const cam = new CubeCamera(1, 100, rt);
  cam.update(renderer, scene);
  mat.dispose();
  return rt.texture;
}

export function makeStars(o: { count?: number; seed?: number; radius?: number } = {}): Group {
  const count = o.count ?? 9000;
  const R = o.radius ?? 900000;
  const rng = new Rng(o.seed ?? 11);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const tmp = new Color();
  for (let i = 0; i < count; i++) {
    const u = rng.next() * 2 - 1;
    const t = rng.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(t) * R;
    pos[i * 3 + 1] = u * R;
    pos[i * 3 + 2] = s * Math.sin(t) * R;
    const b = Math.pow(rng.next(), 5.5);
    const temp = rng.next();
    if (temp < 0.18) tmp.setRGB(1.0, 0.78, 0.55);
    else if (temp < 0.5) tmp.setRGB(1.0, 0.95, 0.88);
    else tmp.setRGB(0.78, 0.86, 1.0);
    const lum = 0.35 + b * 7.0;
    col[i * 3] = tmp.r * lum;
    col[i * 3 + 1] = tmp.g * lum;
    col[i * 3 + 2] = tmp.b * lum;
    size[i] = 1.1 + b * 3.2 + rng.next() * 0.6;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('size', new BufferAttribute(size, 1));
  const m = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { scale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size; attribute vec3 color; uniform float scale; varying vec3 vCol;
      void main(){ vCol = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * scale; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol;
      void main(){ vec2 p = gl_PointCoord - 0.5; float r2 = dot(p,p) * 4.0; float a = exp(-r2 * 4.0); if (a < 0.01) discard; gl_FragColor = vec4(vCol * a, 1.0); }`,
  });
  const pts = new Points(g, m);
  pts.frustumCulled = false;
  pts.userData.material = m;
  const grp = new Group();
  grp.name = 'stars';
  grp.add(pts);
  return grp;
}
