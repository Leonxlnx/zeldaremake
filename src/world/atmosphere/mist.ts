/**
 * Ground mist volume for the north hollow (under and beyond the log arch, around the boulder
 * terrace). Two instanced layers rendered by the post-fx composer into a half-resolution
 * premultiplied-alpha target and composited over the HDR frame:
 *
 *  - upright cylindrical billboards (wide, low, camera-facing about the Y axis) carrying 3-octave
 *    value-noise fbm that drifts slowly with the shared wind direction;
 *  - flat horizontal sheets hugging the terrain for the "pooling" look when seen from above.
 *
 * Every quad is depth-faded against the scene depth texture (soft particles) and distance-faded
 * near the camera, so mist wraps around trunks/boulders instead of cutting them. Placement is
 * deterministic (`ctx.rng.fork('mist')`), motion is a pure function of `t`.
 */
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  AddEquation,
  type Texture,
  type PerspectiveCamera,
} from 'three';
import type { WorldContext } from '../system';
import { HEIGHT_FOG_DEFAULTS } from './heightfog';

export interface MistVolume {
  scene: Scene;
  billboards: number;
  sheets: number;
  /** `viewportSize` is the pixel size of the target the mist is rendered into */
  update(t: number, camera: PerspectiveCamera, depth: Texture | null, viewportSize: Vector2): void;
  dispose(): void;
}

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute vec3 aParams; // width, height, seed
attribute float aTint;
uniform float uUpright;
varying vec2 vUv;
varying float vSeed;
varying float vViewZ;
varying vec3 vWorld;
varying float vTint;
varying float vHeightFrac;
void main() {
  vUv = uv;
  vSeed = aParams.z;
  vTint = aTint;
  vec3 pos;
  if ( uUpright > 0.5 ) {
    vec3 toCam = cameraPosition - aCenter;
    toCam.y = 0.0;
    toCam = normalize( toCam + vec3( 1e-4, 0.0, 0.0 ) );
    vec3 right = normalize( cross( vec3( 0.0, 1.0, 0.0 ), toCam ) );
    // anchor the quad at its base so it sits on the ground
    pos = aCenter + right * position.x * aParams.x + vec3( 0.0, ( position.y + 0.5 ) * aParams.y, 0.0 );
    vHeightFrac = position.y + 0.5;
  } else {
    pos = aCenter + vec3( position.x * aParams.x, 0.0, -position.y * aParams.y );
    vHeightFrac = 0.0;
  }
  vWorld = pos;
  vec4 mv = viewMatrix * vec4( pos, 1.0 );
  vViewZ = mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uViewportSize;
uniform float uHasDepth;
uniform float uNear;
uniform float uFar;
uniform float uTime;
uniform vec2 uWind;
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform float uUpright;
uniform float uDensity;
varying vec2 vUv;
varying float vSeed;
varying float vViewZ;
varying vec3 vWorld;
varying float vTint;
varying float vHeightFrac;

float hash21( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float vnoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash21( i ), hash21( i + vec2( 1.0, 0.0 ) ), u.x ), mix( hash21( i + vec2( 0.0, 1.0 ) ), hash21( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
float fbm( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 3; i ++ ) {
    s += a * vnoise( p );
    p = p * 2.1 + vec2( 11.7, 5.3 );
    a *= 0.5;
  }
  return s;
}
float viewZFromDepth( float d ) {
  return ( uNear * uFar ) / ( ( uFar - uNear ) * d - uFar );
}

void main() {
  vec2 p = vUv - 0.5;
  // soft elliptical falloff; upright quads also fade toward their top
  float edge = 1.0 - smoothstep( 0.25, 0.5, length( p * vec2( 1.0, 1.15 ) ) );
  float vert = uUpright > 0.5 ? ( 1.0 - smoothstep( 0.15, 1.0, vHeightFrac ) ) : 1.0;
  vec2 drift = uWind * uTime * 0.035 + vSeed * 7.31;
  vec2 nuv = vWorld.xz * 0.11 + drift;
  if ( uUpright > 0.5 ) nuv = vec2( vUv.x * 2.2 + vSeed * 3.0 + uTime * 0.02, vUv.y * 1.1 + uTime * 0.012 ) + uWind * uTime * 0.02;
  float n = fbm( nuv );
  n = smoothstep( 0.36, 0.86, n + 0.06 * sin( uTime * 0.11 + vSeed * 6.0 ) );
  float alpha = edge * vert * n * uDensity;

  // soft depth intersection against the scene
  if ( uHasDepth > 0.5 ) {
    vec2 suv = gl_FragCoord.xy / uViewportSize;
    float sceneZ = viewZFromDepth( texture2D( tDepth, suv ).x );
    float behind = sceneZ - vViewZ; // negative when the scene surface is behind this fragment
    alpha *= clamp( -behind / 2.5, 0.0, 1.0 );
  }
  // fade in from the camera so quads never pop through the lens
  float dist = -vViewZ;
  alpha *= smoothstep( 1.5, 7.0, dist );
  // thin out with distance so far mist stays airy
  alpha *= 1.0 - smoothstep( 40.0, 95.0, dist );

  vec3 rayDir = normalize( vWorld - cameraPosition );
  float sunAmt = pow( max( dot( rayDir, uSunDir ), 0.0 ), 5.0 );
  // the reference's warm ground-mist grey (heightfog.ts mistColor), brighter toward the sun
  vec3 col = uColor * ( 0.95 + 0.1 * vTint ) * ( 1.0 + 0.4 * sunAmt ) * mix( vec3( 0.99, 1.0, 1.01 ), vec3( 1.06, 1.0, 0.92 ), sunAmt );
  gl_FragColor = vec4( col * alpha, alpha );
}
`;

interface Placement {
  center: Vector3;
  w: number;
  h: number;
  seed: number;
  tint: number;
}

export function createMistVolume(ctx: WorldContext, sunDir: Vector3): MistVolume {
  const rng = ctx.rng.fork('mist');
  const T = ctx.terrain;
  const cfg = ctx.config;

  // Hollow footprint: along the north path spine from the terrace (z ≈ −14) to beyond the log (z ≈ −52),
  // widening northward; plus a light sprinkle around the plaza edges.
  const uprights: Placement[] = [];
  const sheets: Placement[] = [];
  const placeUpright = (x: number, z: number, w: number, h: number) => {
    const y = T.height(x, z) - 0.15;
    uprights.push({ center: new Vector3(x, y, z), w, h, seed: rng(), tint: rng() });
  };
  const placeSheet = (x: number, z: number, w: number, d: number, lift: number) => {
    const y = T.height(x, z) + lift;
    sheets.push({ center: new Vector3(x, y, z), w, h: d, seed: rng(), tint: rng() });
  };

  for (let i = 0; i < 26; i++) {
    const u = i / 25;
    const z = -14 - u * 40 + rng.range(-3, 3);
    const spread = 6 + u * 12;
    const x = 1 + (u - 0.2) * 5 + rng.range(-spread, spread);
    placeUpright(x, z, rng.range(7, 13), rng.range(1.3, cfg.fog.mistHeight * 0.8));
  }
  // a few softer wisps at the plaza margins and the stair foot
  for (let i = 0; i < 6; i++) {
    const x = rng.range(-14, 16);
    const z = rng.range(-8, 8);
    placeUpright(x, z, rng.range(6, 10), rng.range(0.9, 1.6));
  }
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const z = -16 - u * 34 + rng.range(-3, 3);
    const x = 1 + (u - 0.2) * 5 + rng.range(-7, 7);
    placeSheet(x, z, rng.range(12, 20), rng.range(9, 15), rng.range(0.25, 0.9));
  }

  const scene = new Scene();
  scene.name = 'mist-volume';
  const viewportSize = new Vector2(1, 1);
  const shared = {
    tDepth: { value: null as Texture | null },
    uViewportSize: { value: viewportSize },
    uHasDepth: { value: 0 },
    uNear: { value: 0.1 },
    uFar: { value: 900 },
    uTime: { value: 0 },
    uWind: { value: ctx.wind.direction.clone() },
    // reference ground mist ≈ #7a796d (scene-linear value that ACES maps there, see heightfog.ts)
    uColor: { value: new Color(...HEIGHT_FOG_DEFAULTS.mistColor) },
    uSunDir: { value: sunDir.clone() },
  };

  const build = (items: Placement[], upright: boolean, density: number) => {
    const base = new PlaneGeometry(1, 1, 1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index;
    geo.attributes.position = base.attributes.position;
    geo.attributes.uv = base.attributes.uv;
    const n = items.length;
    const centers = new Float32Array(n * 3);
    const params = new Float32Array(n * 3);
    const tints = new Float32Array(n);
    items.forEach((p, i) => {
      centers.set([p.center.x, p.center.y, p.center.z], i * 3);
      params.set([p.w, p.h, p.seed], i * 3);
      tints[i] = p.tint;
    });
    geo.setAttribute('aCenter', new InstancedBufferAttribute(centers, 3));
    geo.setAttribute('aParams', new InstancedBufferAttribute(params, 3));
    geo.setAttribute('aTint', new InstancedBufferAttribute(tints, 1));
    geo.instanceCount = n;
    const mat = new ShaderMaterial({
      name: upright ? 'mist-billboards' : 'mist-sheets',
      uniforms: { ...shared, uUpright: { value: upright ? 1 : 0 }, uDensity: { value: density } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    });
    const mesh = new Mesh(geo, mat);
    mesh.name = upright ? 'mist-billboards' : 'mist-sheets';
    mesh.frustumCulled = false;
    // transparent volume: must never write depth in the capture API's depth-histogram pass. The
    // mist lives in its own overlay scene (not ctx.scene), and the flag makes the intent explicit.
    mesh.userData.depthAudit = false;
    return { mesh, mat, geo };
  };

  // low pools, not a grey wall: the reference's log arch stays a dark silhouette through the haze
  const up = build(uprights, true, 0.22);
  const sh = build(sheets, false, 0.3);
  // sheets first (they lie under the billboards), then billboards
  sh.mesh.renderOrder = 0;
  up.mesh.renderOrder = 1;
  scene.add(sh.mesh, up.mesh);

  return {
    scene,
    billboards: uprights.length,
    sheets: sheets.length,
    update(t, camera, depth, size) {
      shared.uTime.value = t;
      shared.tDepth.value = depth;
      shared.uHasDepth.value = depth ? 1 : 0;
      shared.uNear.value = camera.near;
      shared.uFar.value = camera.far;
      viewportSize.copy(size);
      shared.uWind.value.copy(ctx.wind.direction);
    },
    dispose() {
      up.geo.dispose();
      up.mat.dispose();
      sh.geo.dispose();
      sh.mat.dispose();
    },
  };
}
