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
  CanvasTexture,
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

/**
 * Where Navi hovers off the fixed frames (round 50; the demo frames d_011 / d_024 have her above
 * and beside the cap, never over the face — like the girls' fairies, npc.ts): `up` over the head
 * centre, `left` out to Link's left (his left is (cos yaw, 0, −sin yaw) for +Z forward), `ahead`
 * a little past the ear line. Under capture the per-view table (placement.ts `navi`) stands her
 * on the reference screen spot instead, so the six frames do not read this.
 */
export const NAVI_HOVER = { up: 0.4, left: 0.32, ahead: 0.05 } as const;

/** Navi's hover anchor for a head centre at (x, headY, z) facing `yaw` (see NAVI_HOVER) */
export function naviHoverAnchor(x: number, headY: number, z: number, yaw: number, out: Vector3): Vector3 {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return out.set(x + fx * NAVI_HOVER.ahead + fz * NAVI_HOVER.left, headY + NAVI_HOVER.up, z + fz * NAVI_HOVER.ahead - fx * NAVI_HOVER.left);
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

// ---- generic fairy (the Kokiri kids' companions, round 47) ----

export interface FairyOptions {
  /** scene-graph name prefix */
  name: string;
  /** tint of the bloom and the wings (linear RGB; Navi is blue-white, the Kokiri's warm white — round 50) */
  tint: Color;
  /** tint of the ball itself (linear RGB); default = a quarter of `tint` over white. The Kokiri's is a soft green (round 50) */
  coreTint?: Color;
  /** point-light colour */
  lightColor: number;
  /** seed for the hover's phases (util/prng hashString) */
  seed: string;
  /** overall size factor (1 = Navi) */
  scale?: number;
}

export interface Fairy {
  group: Group;
  light: PointLight;
  /** the hover centre (world) — set by the owner every frame */
  anchor: Vector3;
  /** the hover's world offset from `anchor` at time t (closed-form Lissajous, seeded phases) */
  offset(t: number, out: Vector3): Vector3;
  /** pose for time t: `anchor` + offset, wings fluttering, light breathing; `heading` (rad) turns the body */
  update(t: number, heading: number): void;
  /** how many draw submissions the fairy costs (meshes + sprites) */
  draws: number;
}

/** upright wing PAIR for one billboard sprite: two petals in a V from the bottom-centre root, blown-out white cores */
let wingPairTex: CanvasTexture | null = null;
function wingPairTexture(): CanvasTexture {
  if (wingPairTex) return wingPairTex;
  const w = 128;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = (x / (w - 1) - 0.5) * 2;
      const py = 1 - y / (h - 1);
      let a = 0;
      let core = 0;
      for (const side of [-1, 1]) {
        // petal axis leaning `side` at 0.42 rad from the vertical, root at the bottom centre
        const ax = Math.sin(0.42) * side;
        const ay = Math.cos(0.42);
        const along = px * ax + py * ay;
        const across = Math.abs(px * ay - py * ax);
        if (along <= 0 || along > 1) continue;
        const halfWidth = 0.34 * Math.pow(Math.sin(Math.PI * Math.pow(along, 0.8)), 0.85);
        const inside = Math.min(1, Math.max(0, (halfWidth - across) / 0.07));
        const k = Math.min(1, Math.max(0, (halfWidth * 0.5 - across) / 0.14));
        a = Math.max(a, inside * (0.5 + 0.5 * k));
        core = Math.max(core, k);
      }
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(228 + 27 * core);
      img.data[i + 1] = 255;
      img.data[i + 2] = Math.round(232 + 23 * core);
      img.data[i + 3] = Math.round(255 * a);
    }
  }
  g.putImageData(img, 0, 0);
  wingPairTex = new CanvasTexture(c);
  wingPairTex.name = 'character-fairy-wing-pair';
  return wingPairTex;
}

/**
 * A small fairy in the Navi idiom at a third of the draw cost (3 submissions: core ball, bloom
 * sprite, one wing-pair sprite) — no sparkle streaks, no trail. The hover is a Lissajous of
 * three incommensurate frequencies around `anchor` with phases hashed from `seed`, so two
 * fairies never bob in step and a capture at a fixed t is reproducible.
 */
export function createFairy(opts: FairyOptions): Fairy {
  const s = opts.scale ?? 0.8;
  const anchor = new Vector3(0, 1.2, 0);
  const root = new Group();
  root.name = opts.name;
  const body = new Group();
  body.name = `${opts.name}-body`;
  root.add(body);
  const tint = opts.tint;

  // the ball: blown out at its centre either way; a `coreTint` keeps its fringe (and the shading
  // toward the wings) in that colour — the demo girls' fairies read warm white with a green heart
  // sizes (lane 7, 2026-09-23, demo d_026 / d_090: the girl's fairy is a glowing ball with wings
  // about as wide as her head, a head-and-a-half above it): at the kids' 0.75 the ball is 7.5 cm,
  // the halo 0.3 m, the wing pair 0.17 m — round 47's dot (5 cm / 0.2 m / 0.1 m) vanished at 5 m
  const coreColor = opts.coreTint ? opts.coreTint.clone().multiplyScalar(1.9) : new Color(1, 1, 1).lerp(tint, 0.25).multiplyScalar(2.2);
  const core = new Mesh(new SphereGeometry(0.05 * s, 14, 10), new MeshBasicMaterial({ color: coreColor, fog: false, toneMapped: false }));
  core.name = `${opts.name}-core`;
  body.add(core);

  const halo = new Sprite(new SpriteMaterial({ map: glowTexture(), color: tint.clone(), blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  halo.name = `${opts.name}-halo`;
  const haloS = 0.4 * s;
  halo.scale.setScalar(haloS);
  halo.userData.depthAudit = false;
  body.add(halo);

  const wings = new Sprite(new SpriteMaterial({ map: wingPairTexture(), color: new Color(1, 1, 1).lerp(tint, 0.3).multiplyScalar(1.3), depthWrite: false, fog: false, transparent: true, toneMapped: false }));
  wings.name = `${opts.name}-wings`;
  wings.center.set(0.5, 0.08);
  wings.position.set(0, 0.012 * s, 0);
  const wingW = 0.22 * s;
  const wingH = 0.22 * s;
  wings.scale.set(wingW, wingH, 1);
  wings.userData.depthAudit = false;
  body.add(wings);

  const light = new PointLight(opts.lightColor, 1.1, 2.6, 2);
  light.name = `${opts.name}-light`;
  light.castShadow = false;
  body.add(light);

  // seeded phases (deterministic; util/prng hashString)
  let h = 2166136261;
  for (let i = 0; i < opts.seed.length; i++) h = Math.imul(h ^ opts.seed.charCodeAt(i), 16777619);
  const ph = (k: number) => ((((h >>> 0) * (k + 1) * 0.618033) % 1) + 1) % 1 * Math.PI * 2;
  const p1 = ph(1);
  const p2 = ph(2);
  const p3 = ph(3);
  const offset = (t: number, out: Vector3) => {
    out.set(
      0.05 * Math.sin(t * Math.PI * 2 * 0.31 + p1) + 0.02 * Math.sin(t * 2.7 + p3),
      0.055 * Math.sin(t * Math.PI * 2 * 0.95 + p2) + 0.02 * Math.sin(t * 0.8 + p1),
      0.05 * Math.cos(t * Math.PI * 2 * 0.27 + p1) + 0.02 * Math.cos(t * 2.1 + p2),
    );
    return out;
  };
  const off = new Vector3();
  return {
    group: root,
    light,
    anchor,
    offset,
    draws: 3,
    update(t, heading) {
      offset(t, off);
      body.position.copy(anchor).add(off);
      body.rotation.y = heading;
      // ≈ 11 Hz flutter: the pair fans open and closed and foreshortens as it beats
      const flap = Math.sin(t * Math.PI * 2 * 11 + p2);
      wings.scale.set(wingW * (0.72 + 0.28 * Math.abs(flap)), wingH * (0.96 + 0.04 * flap), 1);
      light.intensity = 1.0 + 0.2 * Math.sin(t * 4.3 + p3);
      halo.scale.setScalar(haloS * (1 + 0.08 * Math.sin(t * 6.1 + p1)));
    },
  };
}
