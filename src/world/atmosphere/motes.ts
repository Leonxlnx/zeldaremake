/**
 * Drifting motes / fireflies: a Points cloud of soft additive sprites wandering slowly through the
 * detail zone. Positions are evaluated on the GPU as a pure function of `uTime` and per-point seeds
 * (no CPU work, fully deterministic). Each mote tests the sun's shadow map in the vertex shader,
 * so motes floating inside light shafts glow noticeably brighter than motes in shade — exactly
 * what makes the reference's dust sparkle.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Matrix4,
  Points,
  ShaderMaterial,
  type DirectionalLight,
  type Texture,
} from 'three';
import type { WorldContext } from '../system';

export interface Motes {
  points: Points;
  count: number;
  update(t: number, sun: DirectionalLight | null, pixelRatio: number): void;
}

const VERT = /* glsl */ `
attribute vec4 aSeed;   // phase offsets
attribute vec3 aWander; // amplitude x/y/z
attribute float aSize;
uniform float uTime;
uniform float uPixelRatio;
uniform mat4 uShadowMatrix;
uniform float uHasShadow;
uniform sampler2D tShadow;   // the sun's raw depth map (BasicShadowMap), compared by hand
varying float vLit;
varying float vPulse;
void main() {
  float t = uTime;
  vec3 p = position;
  p.x += sin( t * 0.21 + aSeed.x ) * aWander.x + sin( t * 0.53 + aSeed.y * 2.0 ) * aWander.x * 0.3;
  p.y += sin( t * 0.17 + aSeed.y ) * aWander.y + cos( t * 0.61 + aSeed.z ) * aWander.y * 0.25;
  p.z += cos( t * 0.19 + aSeed.z ) * aWander.z + sin( t * 0.47 + aSeed.w * 3.0 ) * aWander.z * 0.3;
  vec4 world = modelMatrix * vec4( p, 1.0 );
  vLit = 1.0;
  if ( uHasShadow > 0.5 ) {
    vec4 sc = uShadowMatrix * world;
    sc.xyz /= sc.w;
    bool inside = sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 && sc.z < 1.0;
    if ( inside ) vLit = step( sc.z - 0.0008, texture2D( tShadow, sc.xy ).r );
  }
  vPulse = 0.55 + 0.45 * sin( t * ( 1.3 + aSeed.w ) + aSeed.x * 4.0 );
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  float dist = max( -mv.z, 0.5 );
  gl_PointSize = clamp( aSize * uPixelRatio * 900.0 / dist, 1.5, 22.0 );
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColorShade;
uniform float uIntensity;
varying float vLit;
varying float vPulse;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length( c );
  float a = 1.0 - smoothstep( 0.05, 0.5, r );
  a *= a;
  vec3 col = mix( uColorShade, uColor, vLit );
  float bright = mix( 0.25, 1.0, vLit ) * ( 0.6 + 0.4 * vPulse ) * uIntensity;
  gl_FragColor = vec4( col * bright * a, a );
}
`;

export function createMotes(ctx: WorldContext, count = 180): Motes {
  const rng = ctx.rng.fork('motes');
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const wander = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // cluster along the paths / stairs / hollow where the shafts fall
    const zone = rng();
    let x: number;
    let z: number;
    if (zone < 0.45) {
      x = rng.range(-8, 14);
      z = rng.range(-10, 9);
    } else if (zone < 0.8) {
      x = rng.range(-8, 10);
      z = rng.range(-36, -10);
    } else {
      x = rng.range(-16, 22);
      z = rng.range(-20, 12);
    }
    const y = ctx.terrain.height(x, z) + rng.range(0.4, 4.5);
    positions.set([x, y, z], i * 3);
    seeds.set([rng() * 6.283, rng() * 6.283, rng() * 6.283, rng() * 6.283], i * 4);
    wander.set([rng.range(0.4, 1.3), rng.range(0.2, 0.7), rng.range(0.4, 1.3)], i * 3);
    sizes[i] = rng.range(0.02, 0.05);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
  geometry.setAttribute('aWander', new Float32BufferAttribute(wander, 3));
  geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uShadowMatrix: { value: new Matrix4() },
    uHasShadow: { value: 0 },
    tShadow: { value: null as Texture | null },
    uColor: { value: new Color(0xfff1c2) },
    uColorShade: { value: new Color(0xbcd7e6) },
    uIntensity: { value: 1.6 },
  };
  const material = new ShaderMaterial({
    name: 'motes',
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
    fog: false,
  });
  const points = new Points(geometry, material);
  points.name = 'motes';
  points.frustumCulled = false;
  points.renderOrder = 10;
  points.userData.depthAudit = false; // additive sprites: not geometry for the depth-layer audit

  return {
    points,
    count,
    update(t, sun, pixelRatio) {
      uniforms.uTime.value = t;
      uniforms.uPixelRatio.value = pixelRatio;
      const depthTex = sun?.shadow.map?.depthTexture ?? null;
      // The shader samples the depth map as a plain sampler2D, which WebGL2 only allows on a depth
      // texture WITHOUT a compare function (BasicShadowMap, see lighting/index.ts). Until the first
      // shadow pass has produced that texture, skip the draw rather than bind an incompatible one.
      if (sun && depthTex && depthTex.compareFunction === null) {
        uniforms.tShadow.value = depthTex;
        uniforms.uShadowMatrix.value.copy(sun.shadow.matrix);
        uniforms.uHasShadow.value = 1;
        points.visible = true;
      } else {
        uniforms.uHasShadow.value = 0;
        points.visible = false;
      }
    },
  };
}
