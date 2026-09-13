/**
 * Procedural sky dome: a luminous warm-haze gradient (canopy-gap glare overhead → the far-haze grey
 * at the horizon, so it meets the distance fog seamlessly), a soft sun glow (small hot core + wide
 * Mie-like halo), and a few thin cirrus wisps from value-noise fbm on a high altitude plane. No
 * photos. Time-driven drift is a pure function of `t`.
 *
 * The same material (with `uEnvMode = 1`, which drops the hot core and adds a ground colour) is
 * rendered by the lighting system into a PMREM so standard materials receive matching sky/ground
 * bounce and specular.
 */
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector2, Vector3 } from 'three';
import type { WorldConfig } from '../config';
import { HEIGHT_FOG_DEFAULTS } from './heightfog';

export interface SkyDome {
  mesh: Mesh;
  material: ShaderMaterial;
  update(t: number, cameraPosition: Vector3): void;
  /** material clone used for the environment PMREM */
  createEnvMaterial(): ShaderMaterial;
}

/**
 * Sky colours in scene-linear radiance (what the composer's ACES maps to the reference's display
 * values). The reference never shows blue sky: canopy gaps are a warm off-white glare (#aca896) and
 * the horizon is the far haze (#8d8e85), so the dome is a luminous warm haze that meets the
 * distance fog seamlessly. The gap glare displays at ≈ 0.67 luminance on its own: the reference's
 * open haze seen in the upper frame (A's top band, F's gaps, the glow above D's arch) reads
 * 0.65–0.69, and at the earlier 0.292 (display 0.59) every dome pixel visible through the crowns
 * measured 0.07–0.10 under it even with the god rays' sky share on top. Its chroma matches the
 * reference glare (display hue ≈ 52°, HSV saturation ≈ 0.11, B/R ≈ 0.89 — a yellow-grey, not the
 * orange-gold a 1 : 0.93 : 0.71 ratio gave at this brightness) and heightfog's lit-air veil
 * (`hazeLit`) is a step under it, so hazed crowns read as silhouettes against it the way the
 * reference's do. Exported for the audit; the horizon shares heightfog's `hazeFar`. Both hold only
 * toward the open east plateau and overhead: toward the closed north hollow / west stand the dome
 * is heightfog's `hazeClosed` (see `openDir` there) — the reference's B forest band and A left
 * quadrant are a dim closed roof with no bright gaps (p90 0.49–0.54).
 */
export const SKY_GAP_GLARE: [number, number, number] = [0.372, 0.368, 0.285];

/**
 * Forward lobe hook of the dome (gain at mu = 1, tint at mu = 1, both at mu³). Was 0.12 /
 * (1.05, 1.0, 0.9); off since the sunward directions (WNW–N) are where the reference's air is
 * dimmest — see heightfog's `sunLobeGain`.
 */
export const SKY_SUN_LOBE_GAIN = 0.0;
export const SKY_SUN_LOBE_TINT: [number, number, number] = [1.0, 1.0, 1.0];

/**
 * Elevation (sin) where the dome reaches the gap glare. The reference's air is at its full
 * brightness from ≈ 12° up (the top bands of the eye-level shots, 14–23°, are already open haze);
 * a ramp to 0.45 (27°) left them on the horizon grey.
 */
export const SKY_GLARE_RAMP = 0.2;

/**
 * Tint of the environment (IBL) render only. The dome's warm glare is what the camera sees, but as a
 * fill it left the shaded flagstone golden (display B/R 0.63–0.67 against the reference's 0.69–0.70):
 * under a real canopy the sky light reaching the ground is the grey of the gaps, not the glare's
 * gold, so the IBL is cooled a touch (linear B/R 0.71 → 0.76; the hemisphere term sits at 0.87 —
 * a stronger 0.81 / 0.90 pair overshot the lit stone by 0.025 in display B/R). The dome's glare
 * later moved to the yellow-grey (0.372, 0.368, 0.285) with a faster ramp, which alone would make
 * the cosine-weighted upper hemisphere (0.371, 0.367, 0.284) against the (0.289, 0.271, 0.208) the
 * fill was calibrated on; this tint × `environmentIntensity` 0.421 (lighting/index.ts) maps that
 * back onto the calibrated (0.283, 0.271, 0.218) × 0.57 per channel, so the IBL fill is unchanged.
 * Round 6: the closed-roof dome toward the north/west (`hazeClosed`) and the dropped sunward term
 * take the cosine-weighted hemisphere (with the halo, integrated in 2D) from (0.393, 0.383, 0.290)
 * to (0.339, 0.336, 0.264); (1.049, 1.0, 1.0025) × 0.481 keeps the same (0.171, 0.161, 0.127) fill.
 */
export const SKY_ENV_TINT: [number, number, number] = [1.049, 1.0, 1.0025];

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uEnvMode;
uniform float uGlareRamp;
// canopy openness by direction, shared with heightfog.ts: horizontal unit direction of the open
// east plateau, smoothstep edges on the horizontal dot product, and the closed-roof haze colour the
// dome takes toward the north hollow / west stand
uniform vec2 uOpenDir;
uniform vec2 uOpenEdges;
uniform vec3 uClosed;
// forward lobe hook (gain at mu = 1, tint at mu = 1; off by default like heightfog's sunLobeGain)
uniform float uSunLobeGain;
uniform vec3 uSunLobeTint;
// back-scatter lobe shared with the distance haze (heightfog.ts): (min multiplier, -cos of the
// angle where it saturates) and the tint at full dimming
uniform vec2 uBackScatter;
uniform vec3 uBackTint;
// environment-map only: tint of the IBL fill (the visible dome keeps its own colour)
uniform vec3 uEnvTint;
varying vec3 vDir;

float hash21( vec2 p ) {
  p = fract( p * vec2( 123.34, 456.21 ) );
  p += dot( p, p + 45.32 );
  return fract( p.x * p.y );
}
float vnoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = hash21( i );
  float b = hash21( i + vec2( 1.0, 0.0 ) );
  float c = hash21( i + vec2( 0.0, 1.0 ) );
  float d = hash21( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float fbm( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 4; i ++ ) {
    s += a * vnoise( p );
    p = p * 2.03 + vec2( 17.3, 9.1 );
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 d = normalize( vDir );
  float h = d.y;
  float mu = dot( d, uSunDir );
  float sd = max( mu, 0.0 );
  // luminous warm haze: the far-haze grey at the horizon (seamless with the distance fog on
  // geometry) brightening to the canopy-gap glare overhead, and dimmer opposite the sun (the same
  // back-scatter lobe the distance haze on geometry uses, so the far world and the dome behind it
  // stay seamless; the environment map keeps the side-scatter value so the IBL calibration is
  // untouched). Nothing here is blue (the reference has 0 % sky-blue pixels).
  float up = clamp( h, 0.0, 1.0 );
  // canopy openness of this direction (heightfog.ts kfOpenness): the gap glare and the far-haze
  // horizon toward the open east plateau and overhead; toward the closed north hollow / west stand
  // the dome is the same dim closed-roof veil the geometry there is hazed with, so the far rows and
  // the gaps between them converge on one tone (the reference's B forest band and A left quadrant)
  float len = length( d.xz );
  float e = len > 1e-4 ? dot( d.xz / len, uOpenDir ) : 1.0;
  float open = max( smoothstep( uOpenEdges.x, uOpenEdges.y, e ), smoothstep( 0.42, 0.7, h ) );
  vec3 zenith = mix( uClosed, uZenith, open );
  vec3 horizon = mix( uClosed, uHorizon, open );
  vec3 sky = mix( horizon, zenith, smoothstep( 0.0, uGlareRamp, up ) );
  float s3 = pow( sd, 3.0 );
  sky *= ( 1.0 + uSunLobeGain * s3 ) * mix( vec3( 1.0 ), uSunLobeTint, s3 );
  float back = smoothstep( 0.0, uBackScatter.y, -mu ) * ( 1.0 - uEnvMode );
  sky *= mix( vec3( 1.0 ), uBackTint * uBackScatter.x, back );
  // below the horizon: haze darkening toward ground bounce (only matters for the env map)
  float down = clamp( -h, 0.0, 1.0 );
  vec3 below = mix( uHorizon * 0.8, uGround, smoothstep( 0.0, 0.35, down ) );
  vec3 col = h >= 0.0 ? sky : below;

  // sun: wide halo + a soft glare instead of a hard disc — the reference never shows the sun
  // itself, only a bright gap glare where it sits (core suppressed for the environment map). The
  // halo is kept modest: shot F looks within 10–30° of the sun and its gaps must peak near the
  // reference's ≈ 0.66 luminance, not wash the crowns around them
  float halo = pow( sd, 14.0 ) * 0.04 + pow( sd, 80.0 ) * 0.2;
  float core = pow( sd, 400.0 ) * 0.7;
  col += uSunColor * ( halo + core * ( 1.0 - uEnvMode ) );

  // cirrus wisps on a plane at altitude; only in the upper hemisphere
  if ( h > 0.02 ) {
    vec2 uv = d.xz / ( h + 0.12 );
    vec2 drift = vec2( uTime * 0.0035, uTime * 0.0012 );
    float n1 = fbm( uv * 0.55 + drift );
    float n2 = fbm( uv * 1.7 - drift * 1.4 + 3.7 );
    float wisp = smoothstep( 0.52, 0.78, n1 * 0.7 + n2 * 0.3 );
    wisp *= smoothstep( 0.02, 0.22, h ) * ( 0.55 + 0.45 * sd );
    vec3 cloud = uZenith * mix( vec3( 1.12, 1.13, 1.16 ), vec3( 1.2, 1.14, 1.0 ), pow( sd, 3.0 ) * 0.6 );
    col = mix( col, cloud, wisp * 0.4 );
  }

  col *= mix( vec3( 1.0 ), uEnvTint, uEnvMode );
  gl_FragColor = vec4( col, 1.0 );
}
`;

export function createSkyDome(cfg: WorldConfig, sunDir: Vector3): SkyDome {
  const uniforms = {
    // measured reference values (see reference/ANALYSIS.md §8) rather than config's display
    // colours, which are still cool-grey; the horizon is exactly the far-haze colour
    uZenith: { value: new Color(...SKY_GAP_GLARE) },
    uHorizon: { value: new Color(...HEIGHT_FOG_DEFAULTS.hazeFar) },
    uGround: { value: new Color(cfg.sky.hemiGround).multiplyScalar(0.5) },
    uSunDir: { value: sunDir.clone() },
    uSunColor: { value: new Color(cfg.sun.color) },
    uTime: { value: 0 },
    uEnvMode: { value: 0 },
    uGlareRamp: { value: SKY_GLARE_RAMP },
    uOpenDir: { value: new Vector2(...HEIGHT_FOG_DEFAULTS.openDir) },
    uOpenEdges: { value: new Vector2(HEIGHT_FOG_DEFAULTS.openLo, HEIGHT_FOG_DEFAULTS.openHi) },
    uClosed: { value: new Color(...HEIGHT_FOG_DEFAULTS.hazeClosed) },
    uSunLobeGain: { value: SKY_SUN_LOBE_GAIN },
    uSunLobeTint: { value: new Color(...SKY_SUN_LOBE_TINT) },
    uBackScatter: { value: new Vector2(HEIGHT_FOG_DEFAULTS.backScatterMin, -Math.cos((HEIGHT_FOG_DEFAULTS.backScatterFullDeg * Math.PI) / 180)) },
    uBackTint: { value: new Color(...HEIGHT_FOG_DEFAULTS.backScatterTint) },
    uEnvTint: { value: new Color(...SKY_ENV_TINT) },
  };
  const material = new ShaderMaterial({
    name: 'kokiri-sky',
    side: BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
  });
  const mesh = new Mesh(new SphereGeometry(780, 48, 24), material);
  mesh.name = 'sky';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  return {
    mesh,
    material,
    update(t, cameraPosition) {
      uniforms.uTime.value = t;
      mesh.position.copy(cameraPosition);
    },
    createEnvMaterial() {
      const m = material.clone();
      m.uniforms.uEnvMode.value = 1;
      m.uniforms.uTime.value = 0;
      return m;
    },
  };
}
