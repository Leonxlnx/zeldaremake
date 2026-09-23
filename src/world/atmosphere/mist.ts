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
  /** tall, very thin mid-distance layers (see the curtain placements below) */
  curtains: number;
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
uniform vec2 uBackScatter;
uniform vec3 uBackTint;
uniform float uUpright;
uniform float uDensity;
// distances (m) over which a layer fades in near the camera and out in the far field
uniform vec2 uNearFade;
uniform vec2 uFarFade;
// smoothstep edges on the quad's height fraction where it thins toward its top
uniform vec2 uVertFade;
// smoothstep edges on the fbm that cut the layer into wisps; a wide, low gate is a broad soft band
uniform vec2 uNoiseGate;
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
  float vert = uUpright > 0.5 ? ( 1.0 - smoothstep( uVertFade.x, uVertFade.y, vHeightFrac ) ) : 1.0;
  vec2 drift = uWind * uTime * 0.035 + vSeed * 7.31;
  vec2 nuv = vWorld.xz * 0.11 + drift;
  if ( uUpright > 0.5 ) nuv = vec2( vUv.x * 2.2 + vSeed * 3.0 + uTime * 0.02, vUv.y * 1.1 + uTime * 0.012 ) + uWind * uTime * 0.02;
  float n = fbm( nuv );
  n = smoothstep( uNoiseGate.x, uNoiseGate.y, n + 0.06 * sin( uTime * 0.11 + vSeed * 6.0 ) );
  float alpha = edge * vert * n * uDensity;

  // soft depth intersection against the scene
  if ( uHasDepth > 0.5 ) {
    vec2 suv = gl_FragCoord.xy / uViewportSize;
    float sceneZ = viewZFromDepth( texture2D( tDepth, suv ).x );
    float behind = sceneZ - vViewZ; // negative when the scene surface is behind this fragment
    alpha *= clamp( -behind / 2.5, 0.0, 1.0 );
  }
  // fade in from the camera so quads never pop through the lens (the tall curtains start much
  // further out — they are the mid-distance layers, never the air the walker stands in)
  float dist = -vViewZ;
  alpha *= smoothstep( uNearFade.x, uNearFade.y, dist );
  // thin out with distance so far mist stays airy
  alpha *= 1.0 - smoothstep( uFarFade.x, uFarFade.y, dist );

  vec3 rayDir = normalize( vWorld - cameraPosition );
  float mu = dot( rayDir, uSunDir );
  float sunAmt = pow( max( mu, 0.0 ), 5.0 );
  // the reference's warm ground-mist grey (heightfog.ts mistColor), brighter toward the sun and
  // dimmer opposite it (the distance haze's back-scatter lobe, so mist and haze stay one medium)
  vec3 col = uColor * ( 0.95 + 0.1 * vTint ) * ( 1.0 + 0.4 * sunAmt ) * mix( vec3( 0.99, 1.0, 1.01 ), vec3( 1.06, 1.0, 0.92 ), sunAmt );
  col *= mix( vec3( 1.0 ), uBackTint * uBackScatter.x, smoothstep( 0.0, uBackScatter.y, -mu ) );
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

  // Mid-distance curtains (2026-09-23, lane 1 — "mist soft and layered like review46"). The pools
  // above are ankle-to-waist (mistHeight 2.2 m); in the owner's recording the mist between the
  // trunks at 15–45 m is a tall, very thin luminous layer that the crowns and boles cross — it is
  // what separates one depth from the next and lets the trees read as layers instead of one mass.
  // A third of the pools' density, fading in only past 13 m so the air the walker stands in is
  // untouched, and carried out to 80 m. Placed on the headings the walk uses: up the north path,
  // into the west stand and across the plaza's south margin (the fork pose looks along it).
  // Appended after the pools so their deterministic placements are unchanged.
  const curtains: Placement[] = [];
  const placeCurtain = (x: number, z: number, w: number, h: number) => {
    curtains.push({ center: new Vector3(x, T.height(x, z) - 0.4, z), w, h, seed: rng(), tint: rng() });
  };
  for (let i = 0; i < 14; i++) {
    const u = i / 13;
    const z = -16 - u * 40 + rng.range(-4, 4);
    placeCurtain(1 + (u - 0.2) * 6 + rng.range(-10 - u * 8, 10 + u * 8), z, rng.range(16, 26), rng.range(3.5, 7.5));
  }
  for (let i = 0; i < 8; i++) {
    const u = i / 7;
    const x = -10 - u * 24 + rng.range(-4, 4);
    placeCurtain(x, -6 - u * 14 + rng.range(-8, 8), rng.range(14, 24), rng.range(3.0, 6.5));
  }
  for (let i = 0; i < 6; i++) {
    const u = i / 5;
    placeCurtain(-16 + u * 34 + rng.range(-5, 5), 10 + u * 6 + rng.range(-4, 10), rng.range(14, 22), rng.range(3.0, 6.0));
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
    uBackScatter: { value: new Vector2(HEIGHT_FOG_DEFAULTS.backScatterMin, -Math.cos((HEIGHT_FOG_DEFAULTS.backScatterFullDeg * Math.PI) / 180)) },
    uBackTint: { value: new Color(...HEIGHT_FOG_DEFAULTS.backScatterTint) },
  };

  const build = (
    items: Placement[],
    upright: boolean,
    density: number,
    nearFade: [number, number] = [1.5, 7],
    farFade: [number, number] = [40, 95],
    vertFade: [number, number] = [0.15, 1.0],
    noiseGate: [number, number] = [0.36, 0.86],
    name?: string,
  ) => {
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
    const label = name ?? (upright ? 'mist-billboards' : 'mist-sheets');
    const mat = new ShaderMaterial({
      name: label,
      uniforms: {
        ...shared,
        uUpright: { value: upright ? 1 : 0 },
        uDensity: { value: density },
        uNearFade: { value: new Vector2(...nearFade) },
        uFarFade: { value: new Vector2(...farFade) },
        uVertFade: { value: new Vector2(...vertFade) },
        uNoiseGate: { value: new Vector2(...noiseGate) },
      },
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
    mesh.name = label;
    mesh.frustumCulled = false;
    // transparent volume: must never write depth in the capture API's depth-histogram pass. The
    // mist lives in its own overlay scene (not ctx.scene), and the flag makes the intent explicit.
    mesh.userData.depthAudit = false;
    return { mesh, mat, geo };
  };

  // low pools, not a grey wall: the reference's log arch stays a dark silhouette through the haze
  const up = build(uprights, true, 0.22);
  const sh = build(sheets, false, 0.3);
  // A curtain thins toward its top rather than vanishing above its first fifth (0.5 / 1.35 against
  // the pools' 0.15 / 1.0), so the layer reads up through the trunks the way his recording's does,
  // and its noise gate is wide and low (0.28 / 0.78 against 0.36 / 0.86) so it is a broad soft band
  // instead of the pools' wisps — the 3-octave fbm averages ≈ 0.44, which the pools' gate cuts to
  // ≈ 0.06 (measured: at the pools' gate the whole tier moved the owner's north pose by 1 level).
  const cu = build(curtains, true, 0.55, [13, 24], [62, 92], [0.5, 1.35], [0.28, 0.78], 'mist-curtains');
  // sheets first (they lie under the billboards), then the pools, then the tall layers behind them
  sh.mesh.renderOrder = 0;
  up.mesh.renderOrder = 1;
  cu.mesh.renderOrder = 2;
  scene.add(sh.mesh, up.mesh, cu.mesh);

  return {
    scene,
    billboards: uprights.length,
    sheets: sheets.length,
    curtains: curtains.length,
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
      cu.geo.dispose();
      cu.mat.dispose();
    },
  };
}
