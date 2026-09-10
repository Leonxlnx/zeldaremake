/**
 * Navi: a blown-out white ball in a soft blue-white bloom with a twinkling 4-point sparkle and two
 * pairs of small pale-blue wings standing up behind it, bobbing ±0.1 m at ≈ 1 Hz beside Link's
 * head, trailing 16 faint golden sparkles (~1 s life). Her position is a closed-form function of `t` around an anchor the character
 * system moves (per-view reference spot under capture, orbiting the player's head in play mode),
 * so the trail is simply the same path sampled at earlier times.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { fairyWingTexture, glowTexture, streakTexture } from './palette';

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
  gl_PointSize = clamp( ( 0.015 + 0.03 * aFade ) * uPixelRatio * 900.0 / dist, 1.0, 16.0 );
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
  gl_FragColor = vec4( uColor * a * 1.1, a * 0.6 );
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

  // bright white ball (blown out like the reference), soft blue-white bloom around it
  const core = new Mesh(new SphereGeometry(0.042, 18, 12), new MeshBasicMaterial({ color: new Color(1, 1, 1).multiplyScalar(2.4), fog: false, toneMapped: false }));
  core.name = 'navi-core';
  body.add(core);

  // very soft bloom, ≈ 0.12 m visible at 4 m (the sprite is wider than the visible glow)
  const halo = new Sprite(new SpriteMaterial({ map: glowTexture(), color: new Color(0.82, 0.92, 1.0).multiplyScalar(0.7), blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.name = 'navi-halo';
  halo.scale.setScalar(0.3);
  halo.userData.depthAudit = false;
  body.add(halo);

  // 4-point sparkle: two crossed streaks that twinkle in length
  const streakTex = streakTexture();
  const streaks: Sprite[] = [];
  for (const rot of [0, Math.PI / 2]) {
    const s = new Sprite(new SpriteMaterial({ map: streakTex, color: new Color(0.9, 0.96, 1.0).multiplyScalar(1.1), rotation: rot, blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    s.name = 'navi-sparkle';
    s.scale.set(0.3, 0.04, 1);
    s.userData.depthAudit = false;
    body.add(s);
    streaks.push(s);
  }

  // Wings: the reference fairy reads as two upright white "ears" over the ball plus a small lower
  // pair, from every camera. Billboard sprites pivoting at the ball's centre (sprite centre at
  // the leaf root) give exactly that silhouette from all six views; the root half is hidden
  // inside the ball by the depth test.
  const wingTex = fairyWingTexture();
  const wings: { sprite: Sprite; base: number; w: number; h: number }[] = [];
  const wingDefs: { rot: number; w: number; h: number; y: number }[] = [
    { rot: 0.3, w: 0.062, h: 0.15, y: 0.012 },
    { rot: -0.3, w: 0.062, h: 0.15, y: 0.012 },
    { rot: Math.PI - 0.62, w: 0.04, h: 0.085, y: -0.004 },
    { rot: -(Math.PI - 0.62), w: 0.04, h: 0.085, y: -0.004 },
  ];
  for (const d of wingDefs) {
    const s = new Sprite(new SpriteMaterial({ map: wingTex, color: new Color(1.0, 1.0, 1.0).multiplyScalar(1.35), rotation: d.rot, depthWrite: false, fog: false, transparent: true, toneMapped: false }));
    s.name = 'navi-wing';
    s.center.set(0.5, 0.06);
    s.position.set(0, d.y, 0);
    s.scale.set(d.w, d.h, 1);
    s.userData.depthAudit = false;
    body.add(s);
    wings.push({ sprite: s, base: d.rot, w: d.w, h: d.h });
  }

  const light = new PointLight(0xdff0ff, 1.6, 3.5, 2);
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
      // wing flutter ≈ 12 Hz: the ears fan in/out about their root and foreshorten as they beat
      // (upper and lower pairs out of phase)
      const flap = Math.sin(t * Math.PI * 2 * 12);
      for (let i = 0; i < wings.length; i++) {
        const w = wings[i];
        const pair = i < 2 ? 1 : -1;
        const side = i % 2 === 0 ? 1 : -1;
        w.sprite.material.rotation = w.base + side * 0.12 * flap * pair;
        w.sprite.scale.set(w.w * (0.8 + 0.2 * Math.abs(flap)), w.h, 1);
      }
      // sparkle twinkle: the two streaks breathe out of phase
      const tw = 0.5 + 0.5 * Math.sin(t * 7.3);
      streaks[0].scale.set(0.2 + 0.12 * tw, 0.04, 1);
      streaks[1].scale.set(0.32 - 0.12 * tw, 0.04, 1);
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
