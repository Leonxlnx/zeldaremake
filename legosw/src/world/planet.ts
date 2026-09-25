import { AdditiveBlending, Color, FrontSide, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/**
 * Coruscant: a planet-wide city seen from low orbit. Procedural in world space (no seams, detail at
 * every altitude): district tones and avenue grids on the day side, amber street-light networks on
 * the night side, a warm terminator, a hazed limb and a thin blue atmosphere shell.
 */
export interface PlanetHandle {
  group: Group;
  surface: ShaderMaterial;
  atmo: ShaderMaterial;
  setSun(dir: Vector3): void;
}

const NOISE = /* glsl */ `
float h3(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }
`;

export function makeCoruscant(o: { radius: number; center: Vector3; sunDir: Vector3 }): PlanetHandle {
  const R = o.radius;
  const group = new Group();
  group.name = 'coruscant';
  group.position.copy(o.center);
  const surface = new ShaderMaterial({
    uniforms: {
      sunDir: { value: o.sunDir.clone().normalize() },
      center: { value: o.center.clone() },
      R: { value: R },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir; uniform vec3 center; uniform float R;
      varying vec3 vWorld; varying vec3 vN;
      ${NOISE}
      float gridLine(vec3 q, float S, float w){
        vec3 g = abs(fract(q / S) - 0.5) * S;
        float m = min(min(g.x, g.y), g.z);
        float fw = fwidth(m) * 1.2 + 1e-3;
        float fade = 1.0 - smoothstep(0.25, 0.9, fwidth(q.x) / S * 6.0);
        return (1.0 - smoothstep(w, w + fw, m)) * fade;
      }
      void main(){
        vec3 n = normalize(vN);
        vec3 q = vWorld - center;
        vec3 v = normalize(cameraPosition - vWorld);
        float ndl = dot(n, sunDir);
        float px = length(fwidth(q));
        // districts
        float d1 = vn(q / 21000.0);
        float d2 = vn(q / 6100.0 + 3.1);
        float d3 = vn(q / 1700.0 + 7.7);
        float d4 = vn(q / 480.0 + 1.3) * (1.0 - smoothstep(60.0, 200.0, px));
        float dist = d1 * 0.45 + d2 * 0.3 + d3 * 0.17 + d4 * 0.08;
        vec3 albedo = mix(vec3(0.20, 0.21, 0.23), vec3(0.42, 0.40, 0.37), smoothstep(0.25, 0.75, dist));
        albedo = mix(albedo, vec3(0.30, 0.34, 0.40), smoothstep(0.55, 0.9, d2) * 0.5);
        float avenues = gridLine(q + vec3(d1 * 900.0), 2600.0, 70.0) * 0.8 + gridLine(q * 1.013 + 400.0, 720.0, 14.0) * 0.45;
        albedo *= 1.0 - avenues * 0.45;
        // towers catch light: sparkle grain
        float grain = vn(q / 140.0) * (1.0 - smoothstep(20.0, 70.0, px));
        albedo *= 0.9 + grain * 0.2;
        // lighting
        float day = smoothstep(-0.06, 0.25, ndl);
        vec3 sun = vec3(1.0, 0.93, 0.82) * 1.6;
        vec3 col = albedo * (sun * max(ndl, 0.0) + vec3(0.05, 0.07, 0.11));
        // terminator glow
        col += vec3(0.55, 0.22, 0.06) * exp(-pow(ndl * 9.0, 2.0)) * 0.25 * albedo * 2.0;
        // night lights
        float cluster = smoothstep(0.35, 0.8, d2 * 0.6 + d3 * 0.4);
        float lights = avenues * (0.5 + cluster) + smoothstep(0.62, 0.9, d3) * 0.35 + step(0.985, h3(floor(q / 90.0))) * (1.0 - smoothstep(30.0, 90.0, px)) * 1.5;
        float night = 1.0 - smoothstep(-0.12, 0.08, ndl);
        col += vec3(1.0, 0.62, 0.28) * lights * night * 1.6;
        col += vec3(1.0, 0.7, 0.4) * lights * (1.0 - night) * 0.06;
        // aerial haze toward the limb
        float mu = clamp(dot(n, v), 0.0, 1.0);
        float haze = pow(1.0 - mu, 2.6);
        vec3 hazeCol = mix(vec3(0.03, 0.05, 0.1), vec3(0.45, 0.62, 0.95), smoothstep(-0.2, 0.4, ndl));
        col = mix(col, hazeCol, haze * 0.85);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const surf = new Mesh(new SphereGeometry(R, 384, 192), surface);
  surf.frustumCulled = false;
  group.add(surf);

  const atmo = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
    uniforms: { sunDir: { value: o.sunDir.clone().normalize() }, color: { value: new Color(0.35, 0.58, 1.0) } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir; uniform vec3 color; varying vec3 vWorld; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vWorld);
        float mu = clamp(dot(n, v), 0.0, 1.0);
        float rim = pow(1.0 - mu, 5.0);
        float lit = smoothstep(-0.35, 0.3, dot(n, sunDir));
        vec3 c = color * rim * (0.15 + 1.6 * lit);
        c += vec3(1.0, 0.45, 0.2) * rim * exp(-pow(dot(n, sunDir) * 5.0, 2.0)) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const shell = new Mesh(new SphereGeometry(R * 1.018, 256, 128), atmo);
  shell.frustumCulled = false;
  group.add(shell);

  return {
    group,
    surface,
    atmo,
    setSun(dir: Vector3) {
      surface.uniforms.sunDir.value.copy(dir).normalize();
      atmo.uniforms.sunDir.value.copy(dir).normalize();
    },
  };
}
