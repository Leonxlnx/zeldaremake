import { AdditiveBlending, Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

/**
 * Separatist hangar ray shield: an additive blue energy sheet with drifting scanlines, a hot rim
 * where it meets the emitters and a soft noise shimmer. `set(v)` fades it; any level between 0
 * and 1 also makes it stutter like a failing projector, so a ramp 1 → 0 reads as "flicker off".
 * `update(t)` drives the animation (call it every frame with film time).
 */
export interface RayShield {
  mesh: Mesh;
  set(v: number): void;
  update(t: number): void;
}

export function rayShield(w: number, h: number, o: { color?: number; strength?: number; name?: string; scan?: number } = {}): RayShield {
  const uniforms = {
    time: { value: 0 },
    level: { value: 1 },
    strength: { value: o.strength ?? 1 },
    aspect: { value: w / h },
    scan: { value: o.scan ?? 60 },
    color: { value: new Color(o.color ?? 0x2f7dff) },
  };
  const mat = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float time, level, strength, aspect, scan;
      uniform vec3 color;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n = i.x + i.y * 57.0;
        return mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
      }
      void main() {
        if (level <= 0.002) discard;
        vec2 uv = vUv;
        float ex = min(uv.x, 1.0 - uv.x) * aspect;
        float ey = min(uv.y, 1.0 - uv.y);
        float e = min(ex, ey);
        float rim = exp(-e * 40.0) * 1.6 + exp(-e * 7.0) * 0.28;
        float lines = 0.5 + 0.5 * sin(uv.y * scan * 6.2831 - time * 9.0);
        lines = pow(lines, 3.0);
        float sweep = fract(uv.y * 1.5 - time * 0.45);
        float band = smoothstep(0.0, 0.05, sweep) * (1.0 - smoothstep(0.05, 0.35, sweep));
        float sh = noise(vec2(uv.x * 7.0 * aspect + time * 0.7, uv.y * 7.0 - time * 1.9));
        float sh2 = noise(vec2(uv.x * 23.0 * aspect - time * 2.1, uv.y * 19.0 + time * 1.3));
        float body = 0.05 + 0.07 * lines + 0.08 * sh + 0.04 * sh2 + 0.18 * band;
        float f = 1.0;
        if (level < 0.998) {
          float fr = floor(time * 30.0);
          f = hash(fr + 11.0) < (0.25 + 0.75 * level) ? (0.55 + 0.45 * hash(fr + 3.0)) : 0.04;
          body += 0.12 * step(0.6, hash(floor(uv.y * 40.0) + fr));
        }
        float a = (body + rim) * level * f * strength;
        gl_FragColor = vec4(color * a * vec3(0.85, 1.0, 1.25), 1.0);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.name = o.name ?? 'ray-shield';
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return {
    mesh,
    set(v: number) {
      uniforms.level.value = Math.max(0, Math.min(1, v));
      mesh.visible = uniforms.level.value > 0.002;
    },
    update(t: number) {
      uniforms.time.value = t;
    },
  };
}
