/**
 * Procedural sky dome: zenith→horizon gradient that lands on the fog colour, a soft sun glow
 * (small hot core + wide Mie-like halo), and a few thin cirrus wisps from value-noise fbm on a
 * high altitude plane. No photos. Time-driven drift is a pure function of `t`.
 *
 * The same material (with `uEnvMode = 1`, which drops the hot core and adds a ground colour) is
 * rendered by the lighting system into a PMREM so standard materials receive matching sky/ground
 * bounce and specular.
 */
import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import type { WorldConfig } from '../config';

export interface SkyDome {
  mesh: Mesh;
  material: ShaderMaterial;
  update(t: number, cameraPosition: Vector3): void;
  /** material clone used for the environment PMREM */
  createEnvMaterial(): ShaderMaterial;
}

/**
 * Scene radiance of the sky relative to config's display colours. In the reference the sky is only
 * ever seen as bright haze between the canopy (sRGB ≈ 0.5–0.6, never white), so the gradient is
 * scaled down to land there after ACES; the sun halo/core stay hot for the bloom pass.
 */
export const SKY_RADIANCE = 0.30;

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
uniform float uRadiance;
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
  // gradient: fog colour at/below the horizon, horizon tint, then zenith
  float up = clamp( h, 0.0, 1.0 );
  vec3 sky = mix( uHorizon, uZenith, pow( up, 0.6 ) );
  // haze band at the horizon: the reference's far haze is a warm grey lit by the low sun
  float horizonBand = 1.0 - smoothstep( 0.0, 0.2, up );
  vec3 horizonCol = uHorizon * vec3( 1.03, 1.0, 0.93 );
  sky = mix( sky, horizonCol, horizonBand * 0.9 );
  // below the horizon: horizon colour darkening toward ground bounce (only matters for the env map)
  float down = clamp( -h, 0.0, 1.0 );
  vec3 below = mix( horizonCol * 0.7, uGround, smoothstep( 0.0, 0.35, down ) );
  vec3 col = ( h >= 0.0 ? sky : below ) * uRadiance;

  // sun: wide halo + soft core (core suppressed for the environment map)
  float sd = max( dot( d, uSunDir ), 0.0 );
  float halo = pow( sd, 12.0 ) * 0.06 + pow( sd, 70.0 ) * 0.22;
  float core = pow( sd, 1400.0 ) * 2.4;
  col += uSunColor * ( halo + core * ( 1.0 - uEnvMode ) );

  // cirrus wisps on a plane at altitude; only in the upper hemisphere
  if ( h > 0.02 ) {
    vec2 uv = d.xz / ( h + 0.12 );
    vec2 drift = vec2( uTime * 0.0035, uTime * 0.0012 );
    float n1 = fbm( uv * 0.55 + drift );
    float n2 = fbm( uv * 1.7 - drift * 1.4 + 3.7 );
    float wisp = smoothstep( 0.52, 0.78, n1 * 0.7 + n2 * 0.3 );
    wisp *= smoothstep( 0.02, 0.22, h ) * ( 0.55 + 0.45 * sd );
    vec3 cloud = mix( vec3( 0.86, 0.9, 0.95 ), uSunColor * 0.95, pow( sd, 3.0 ) * 0.6 ) * uRadiance * 1.25;
    col = mix( col, cloud, wisp * 0.42 );
  }

  gl_FragColor = vec4( col, 1.0 );
}
`;

export function createSkyDome(cfg: WorldConfig, sunDir: Vector3): SkyDome {
  const uniforms = {
    uZenith: { value: new Color(cfg.sky.zenith) },
    uHorizon: { value: new Color(cfg.sky.horizon) },
    uGround: { value: new Color(cfg.sky.hemiGround) },
    uSunDir: { value: sunDir.clone() },
    uSunColor: { value: new Color(cfg.sun.color) },
    uTime: { value: 0 },
    uEnvMode: { value: 0 },
    uRadiance: { value: SKY_RADIANCE },
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
