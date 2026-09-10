/**
 * Navi: a 15 cm white-blue orb (`#d7dcd5` core, cyan additive halo) with four translucent
 * dragonfly wings, bobbing ±0.1 m at ≈ 1 Hz beside Link's head, trailing 16 golden sparkles
 * (~1 s life). Her position is a closed-form function of `t` around an anchor the character
 * system moves (per-view reference spot under capture, orbiting the player's head in play mode),
 * so the trail is simply the same path sampled at earlier times.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { glowTexture, wingTexture } from './palette';

export const TRAIL_COUNT = 16;
const TRAIL_DT = 0.06;

const TRAIL_VERT = /* glsl */ `
attribute float aFade;
uniform float uPixelRatio;
uniform float uTime;
varying float vFade;
varying float vTwinkle;
void main() {
  vFade = aFade;
  vTwinkle = 0.55 + 0.45 * sin( uTime * 21.0 + aFade * 37.0 );
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  float dist = max( -mv.z, 0.3 );
  gl_PointSize = clamp( ( 0.02 + 0.045 * aFade ) * uPixelRatio * 900.0 / dist, 1.0, 22.0 );
}
`;
const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
varying float vTwinkle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length( c );
  float star = pow( max( 0.0, 1.0 - abs( c.x ) * 5.0 ), 3.0 ) + pow( max( 0.0, 1.0 - abs( c.y ) * 5.0 ), 3.0 );
  float a = ( 1.0 - smoothstep( 0.04, 0.42, r ) ) * 0.7 + star * 0.5 * ( 1.0 - smoothstep( 0.15, 0.5, r ) );
  a *= vFade * vFade * vTwinkle;
  gl_FragColor = vec4( uColor * a * 2.0, a );
}
`;

export interface Navi {
  group: Group;
  light: PointLight;
  /** anchor the bob is centred on (world) — set by the character system */
  anchor: Vector3;
  /** world velocity of the anchor (m/s); shapes the trail in play mode (zero under capture) */
  velocity: Vector3;
  /** world position at time t (closed form around `anchor`) */
  position(t: number, out: Vector3): Vector3;
  update(t: number, pixelRatio: number): void;
}

export function createNavi(): Navi {
  const anchor = new Vector3(0, 1.4, 0);
  const velocity = new Vector3();
  const root = new Group();
  root.name = 'navi';
  const body = new Group();
  body.name = 'navi-body';
  root.add(body);

  const core = new Mesh(new SphereGeometry(0.048, 18, 12), new MeshBasicMaterial({ color: new Color(0.86, 0.9, 0.9).multiplyScalar(2.6), fog: false, toneMapped: false }));
  core.name = 'navi-core';
  body.add(core);

  const halo = new Sprite(new SpriteMaterial({ map: glowTexture(), color: new Color(0.62, 0.9, 1.0).multiplyScalar(1.4), blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.name = 'navi-halo';
  halo.scale.setScalar(0.34);
  halo.userData.depthAudit = false;
  body.add(halo);

  const wingMat = new MeshBasicMaterial({ map: wingTexture(), color: new Color(0.85, 0.96, 1.0).multiplyScalar(0.55), transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false });
  const wingGeo = new PlaneGeometry(0.13, 0.06, 1, 1);
  wingGeo.translate(0.065, 0, 0);
  const wings: Mesh[] = [];
  const wingDefs: { x: number; y: number; z: number; mirror: boolean; tilt: number }[] = [
    { x: -0.02, y: 0.03, z: -0.01, mirror: true, tilt: 0.35 },
    { x: 0.02, y: 0.03, z: -0.01, mirror: false, tilt: 0.35 },
    { x: -0.02, y: -0.005, z: -0.02, mirror: true, tilt: -0.3 },
    { x: 0.02, y: -0.005, z: -0.02, mirror: false, tilt: -0.3 },
  ];
  for (const d of wingDefs) {
    const w = new Mesh(wingGeo, wingMat);
    w.name = 'navi-wing';
    w.position.set(d.x, d.y, d.z);
    if (d.mirror) w.scale.x = -1;
    w.userData.tilt = d.tilt;
    w.userData.depthAudit = false;
    body.add(w);
    wings.push(w);
  }

  const light = new PointLight(0xbfe4ff, 1.6, 3.5, 2);
  light.name = 'navi-light';
  light.castShadow = false;
  body.add(light);

  const trailPos = new Float32Array(TRAIL_COUNT * 3);
  const trailFade = new Float32Array(TRAIL_COUNT);
  for (let i = 0; i < TRAIL_COUNT; i++) trailFade[i] = 1 - i / TRAIL_COUNT;
  const trailGeo = new BufferGeometry();
  const trailAttr = new Float32BufferAttribute(trailPos, 3);
  trailAttr.setUsage(DynamicDrawUsage);
  trailGeo.setAttribute('position', trailAttr);
  trailGeo.setAttribute('aFade', new Float32BufferAttribute(trailFade, 1));
  const trailMat = new ShaderMaterial({
    name: 'navi-trail',
    uniforms: { uColor: { value: new Color(1.0, 0.84, 0.45) }, uPixelRatio: { value: 1 }, uTime: { value: 0 } },
    vertexShader: TRAIL_VERT,
    fragmentShader: TRAIL_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const trail = new Points(trailGeo, trailMat);
  trail.name = 'navi-trail';
  trail.frustumCulled = false;
  trail.userData.depthAudit = false;
  root.add(trail);

  const position = (t: number, out: Vector3) => {
    out.set(
      anchor.x + 0.06 * Math.sin(t * Math.PI * 2 * 0.37) + 0.03 * Math.sin(t * 2.9),
      anchor.y + 0.1 * Math.sin(t * Math.PI * 2 * 1.0) + 0.03 * Math.sin(t * 0.9),
      anchor.z + 0.06 * Math.cos(t * Math.PI * 2 * 0.29) + 0.03 * Math.cos(t * 2.3),
    );
    return out;
  };

  const p = new Vector3();
  const prev = new Vector3();
  const tmp = new Vector3();
  return {
    group: root,
    light,
    anchor,
    velocity,
    position,
    update(t, pixelRatio) {
      position(t, p);
      body.position.copy(p);
      // face along the local drift (falls back to +Z when hovering)
      position(t - 0.08, prev);
      tmp.subVectors(p, prev).addScaledVector(velocity, 0.08);
      if (tmp.lengthSq() > 1e-6) body.rotation.y = Math.atan2(tmp.x, tmp.z);
      // wing flutter ≈ 12 Hz, upper and lower pairs out of phase
      const flap = Math.sin(t * Math.PI * 2 * 12);
      for (let i = 0; i < wings.length; i++) {
        const w = wings[i];
        const pair = i < 2 ? 1 : -1;
        const ang = 0.3 + 0.5 * (0.5 + 0.5 * flap * pair);
        w.rotation.y = (w.scale.x < 0 ? 1 : -1) * ang;
        w.rotation.z = (w.userData.tilt as number) * (w.scale.x < 0 ? -1 : 1);
      }
      light.intensity = 1.5 + 0.3 * Math.sin(t * 4.7);
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const age = (i + 1) * TRAIL_DT;
        position(t - age, tmp);
        tmp.addScaledVector(velocity, -age);
        tmp.y -= age * 0.05;
        trailPos[i * 3] = tmp.x;
        trailPos[i * 3 + 1] = tmp.y;
        trailPos[i * 3 + 2] = tmp.z;
      }
      trailAttr.needsUpdate = true;
      trailMat.uniforms.uTime.value = t;
      trailMat.uniforms.uPixelRatio.value = pixelRatio;
    },
  };
}
