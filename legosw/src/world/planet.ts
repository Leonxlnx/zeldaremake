import { AdditiveBlending, Color, FrontSide, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

/**
 * Coruscant from low orbit: a planet-wide city. The surface shader works in the local tangent
 * plane under the fleet (the visible cap is small), with district-rotated street grids at three
 * scales, block rooftops and towers, amber street-light networks on the night side, a warm
 * terminator, high cloud wisps, altitude-aware aerial haze and a thin glowing atmosphere shell.
 * Every scale fades out by its pixel footprint, so nothing aliases at the horizon.
 */
export interface PlanetHandle {
  group: Group;
  surface: ShaderMaterial;
  atmo: ShaderMaterial;
  setSun(dir: Vector3): void;
}

const CITY = /* glsl */ `
float h2(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vn(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3; a *= 0.5; } return s; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// distance to the nearest grid line of spacing S (in the same units as x)
float gridD(vec2 x, float S){ vec2 g = abs(fract(x / S) - 0.5) * S; return min(g.x, g.y); }
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
      ${CITY}
      void main(){
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vWorld);
        float ndl = dot(n, sunDir);
        // tangent-plane coordinates (the fleet sits over the planet's north pole)
        vec2 p = (vWorld - center).xz;
        float px = max(length(fwidth(p)), 1e-3);
        // districts: large tone patches, each with its own street-grid orientation
        vec2 dc = floor(p / 5200.0);
        float dh = h2(dc);
        vec2 pr = rot(dh * 3.14159) * p;
        float big = fbm(p / 14000.0);
        float mid = fbm(p / 3100.0 + 9.1);
        // three street scales with pixel-footprint fades
        float f1 = 1.0 - smoothstep(0.08, 0.35, px / 900.0);
        float f2 = 1.0 - smoothstep(0.08, 0.35, px / 220.0);
        float f3 = 1.0 - smoothstep(0.08, 0.35, px / 60.0);
        float S1 = 650.0 + 700.0 * fract(dh * 7.13);
        float S2 = 170.0 + 110.0 * fract(dh * 3.71);
        float s1 = (1.0 - smoothstep(7.0, 7.0 + px * 1.5, gridD(pr + dh * 400.0, S1))) * f1;
        float s2 = (1.0 - smoothstep(2.4, 2.4 + px * 1.5, gridD(pr + 37.0, S2))) * f2;
        float s3 = (1.0 - smoothstep(0.8, 0.8 + px * 1.5, gridD(pr + 11.0, 60.0))) * f3;
        float streets = max(s1 * 0.18, max(s2 * 0.45, s3 * 0.4));
        // rooftops: per-block albedo, towers, plazas
        float roof1 = h2(floor(pr / 220.0) + 3.0);
        float roof2 = h2(floor(pr / 60.0) + 7.0);
        float roof = mix(0.5, roof1, f2 * 0.42);
        roof = mix(roof, roof * 0.7 + roof2 * 0.3, f3 * 0.8);
        roof = mix(roof, vn(pr / 90.0 + 5.0), 0.35 * f3);
        vec3 tone = dh < 0.3 ? vec3(0.95, 1.0, 1.1) : dh < 0.55 ? vec3(1.12, 1.02, 0.88) : dh < 0.8 ? vec3(0.85, 0.85, 0.88) : vec3(1.15, 0.92, 0.78);
        vec3 alb = mix(vec3(0.13, 0.14, 0.16), vec3(0.3, 0.29, 0.27), roof) * tone;
        alb = mix(alb, alb * vec3(0.78, 0.86, 1.05), smoothstep(0.4, 0.75, big));
        alb = mix(alb, alb * vec3(1.12, 0.98, 0.84), smoothstep(0.5, 0.85, mid) * 0.8);
        float dark = smoothstep(0.52, 0.7, fbm(p / 5200.0 + 2.0));
        alb *= (0.6 + 0.7 * big) * (1.0 - dark * 0.45);
        alb *= 1.0 - streets * 0.45;
        // lighting
        vec3 sun = vec3(1.0, 0.84, 0.66) * 1.9;
        vec3 col = alb * (sun * max(ndl, 0.0) + vec3(0.035, 0.05, 0.09));
        // sun glints off tower glass on the day side
        float glint = step(0.985, h2(floor(pr / 45.0) + 9.3)) * f3 * smoothstep(0.02, 0.2, ndl);
        col += vec3(1.0, 0.9, 0.75) * glint * 0.6;
        col += vec3(0.5, 0.2, 0.06) * exp(-pow(ndl * 10.0, 2.0)) * 0.35 * (alb + 0.1);
        // night: street-light networks + scattered lit towers
        float night = 1.0 - smoothstep(-0.12, 0.06, ndl);
        float cluster = smoothstep(0.35, 0.75, mid * 0.6 + big * 0.5);
        float spark = step(0.93, h2(floor(pr / 60.0) + 1.7)) * f3 + step(0.9, h2(floor(pr / 220.0) + 5.1)) * f2 * 0.6;
        float lights = (s1 * 1.4 + s2 * 0.9 + s3 * 0.45) * (0.35 + cluster) + spark * (0.4 + cluster);
        lights += (1.0 - f2) * (0.08 + cluster * 0.35) + (1.0 - f1) * 0.12 * cluster;
        col += vec3(1.0, 0.6, 0.26) * lights * night * 1.25;
        // clouds (day side bright, night side dark, they hide the lights)
        float cl = smoothstep(0.64, 0.84, fbm(p / 8000.0 + vec2(3.3, 1.1)) * 0.8 + fbm(p / 2100.0) * 0.3);
        vec3 cloudLit = vec3(1.0, 0.95, 0.9) * (max(ndl, 0.0) * 1.5 + 0.02);
        col = mix(col, cloudLit, cl * 0.55);
        // aerial haze: optical depth grows as the view grazes the surface
        float mu = max(dot(n, v), 0.02);
        float haze = 1.0 - exp(-0.05 / mu);
        vec3 hazeCol = mix(vec3(0.015, 0.022, 0.05), vec3(0.26, 0.4, 0.72), smoothstep(-0.15, 0.35, ndl));
        hazeCol += vec3(0.6, 0.25, 0.08) * exp(-pow(ndl * 6.0, 2.0)) * 0.6;
        col = mix(col, hazeCol, haze);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const surf = new Mesh(new SphereGeometry(R, 512, 256), surface);
  surf.frustumCulled = false;
  group.add(surf);

  const atmo = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
    uniforms: { sunDir: { value: o.sunDir.clone().normalize() }, color: { value: new Color(0.3, 0.55, 1.0) } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir; uniform vec3 color; varying vec3 vWorld; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vWorld);
        float mu = clamp(dot(n, v), 0.0, 1.0);
        float rim = pow(1.0 - mu, 14.0);
        float ndl = dot(n, sunDir);
        float lit = smoothstep(-0.3, 0.25, ndl);
        vec3 c = color * rim * (0.05 + 0.9 * lit);
        c += vec3(1.0, 0.42, 0.15) * rim * exp(-pow(ndl * 5.0, 2.0)) * 0.5;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const shell = new Mesh(new SphereGeometry(R * 1.012, 384, 192), atmo);
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
