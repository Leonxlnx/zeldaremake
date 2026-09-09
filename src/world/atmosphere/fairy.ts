/**
 * The fairy ("Navi"): a white-blue glowing orb (Ø 0.12 m) with two translucent fluttering wings,
 * an additive glow sprite, a soft PointLight and a short sparkle trail. It hovers ~1.5 m above the
 * ground a couple of metres ahead (north) of `layout.npcSpots['link-spawn']` — where Link looks in
 * the reference — on a deterministic orbit + bob that is a closed-form function of `t`, so the
 * trail can be evaluated by sampling the same path at earlier times.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
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
import type { WorldContext } from '../system';

export interface Fairy {
  group: Group;
  light: PointLight;
  position(t: number, out: Vector3): Vector3;
  update(t: number): void;
}

const TRAIL_COUNT = 28;
const TRAIL_DT = 0.045;

const WING_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;
const WING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  // teardrop wing: wide near the body (u≈0), tapering to a rounded tip (u≈1)
  float u = vUv.x;
  float v = vUv.y - 0.5;
  float halfWidth = 0.5 * sqrt( max( 1.0 - u, 0.0 ) ) * ( 0.55 + 0.45 * ( 1.0 - u ) ) ;
  halfWidth *= 1.0 - smoothstep( 0.0, 0.08, 0.04 - u ); // soften the root
  float inside = 1.0 - smoothstep( halfWidth - 0.08, halfWidth, abs( v ) );
  float vein = 0.5 + 0.5 * sin( ( abs( v ) * 26.0 - u * 9.0 ) );
  float a = inside * ( 0.42 + 0.22 * vein ) * ( 1.0 - 0.55 * u );
  gl_FragColor = vec4( uColor * a, a );
}
`;

const TRAIL_VERT = /* glsl */ `
attribute float aFade; // 1 = newest, 0 = oldest
uniform float uPixelRatio;
uniform float uTime;
varying float vFade;
varying float vTwinkle;
void main() {
  vFade = aFade;
  vTwinkle = 0.6 + 0.4 * sin( uTime * 23.0 + aFade * 40.0 );
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mv;
  float dist = max( -mv.z, 0.3 );
  gl_PointSize = clamp( ( 0.012 + 0.03 * aFade ) * uPixelRatio * 900.0 / dist, 1.0, 26.0 );
}
`;
const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
varying float vTwinkle;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length( c );
  // 4-point sparkle
  float star = pow( max( 0.0, 1.0 - abs( c.x ) * 6.0 ), 3.0 ) + pow( max( 0.0, 1.0 - abs( c.y ) * 6.0 ), 3.0 );
  float a = smoothstep( 0.5, 0.05, r ) * 0.6 + star * 0.5 * smoothstep( 0.5, 0.2, r );
  a *= vFade * vFade * vTwinkle;
  gl_FragColor = vec4( uColor * a * 2.2, a );
}
`;

function glowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(225,245,255,0.75)');
  grad.addColorStop(0.45, 'rgba(180,220,255,0.22)');
  grad.addColorStop(1, 'rgba(160,210,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.name = 'fairy-glow';
  return tex;
}

export function createFairy(ctx: WorldContext): Fairy {
  const spawn = ctx.layout.npcSpots.find((s) => s.id === 'link-spawn')?.position ?? [0, 0, 0.5];
  const cx = spawn[0] + 0.6;
  const cz = spawn[2] - 4.4;
  const groundY = ctx.terrain.height(cx, cz);
  const centre = new Vector3(cx, groundY + 1.5, cz);
  const glow = new Color(ctx.config.palette.fairyGlow);

  const group = new Group();
  group.name = 'fairy';

  const core = new Mesh(
    new SphereGeometry(0.06, 20, 14),
    new MeshBasicMaterial({ color: new Color(0.88, 0.97, 1.0).multiplyScalar(3.6), fog: false, toneMapped: false }),
  );
  core.name = 'fairy-core';
  group.add(core);

  const halo = new Sprite(
    new SpriteMaterial({ map: glowTexture(), color: glow.clone().multiplyScalar(1.3), blending: AdditiveBlending, depthWrite: false, fog: false, transparent: true }),
  );
  halo.name = 'fairy-halo';
  halo.scale.setScalar(0.34);
  group.add(halo);

  const wingMat = new ShaderMaterial({
    name: 'fairy-wing',
    uniforms: { uColor: { value: new Color(0.8, 0.94, 1.0).multiplyScalar(1.6) }, uTime: { value: 0 } },
    vertexShader: WING_VERT,
    fragmentShader: WING_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    fog: false,
  });
  const wingGeo = new PlaneGeometry(0.2, 0.15, 1, 1);
  wingGeo.translate(0.1, 0, 0); // root at the origin, spans +x
  const wingL = new Mesh(wingGeo, wingMat);
  const wingR = new Mesh(wingGeo, wingMat);
  wingL.name = 'fairy-wing-l';
  wingR.name = 'fairy-wing-r';
  wingL.position.set(-0.03, 0.02, 0);
  wingR.position.set(0.03, 0.02, 0);
  wingL.scale.x = -1;
  group.add(wingL, wingR);

  const light = new PointLight(0xbfe6ff, 2.4, 7, 2);
  light.name = 'fairy-light';
  light.castShadow = false;
  group.add(light);

  // trail
  const trailPos = new Float32Array(TRAIL_COUNT * 3);
  const trailFade = new Float32Array(TRAIL_COUNT);
  for (let i = 0; i < TRAIL_COUNT; i++) trailFade[i] = 1 - i / TRAIL_COUNT;
  const trailGeo = new BufferGeometry();
  const trailAttr = new Float32BufferAttribute(trailPos, 3);
  trailAttr.setUsage(DynamicDrawUsage);
  trailGeo.setAttribute('position', trailAttr);
  trailGeo.setAttribute('aFade', new Float32BufferAttribute(trailFade, 1));
  const trailMat = new ShaderMaterial({
    name: 'fairy-trail',
    uniforms: { uColor: { value: glow.clone() }, uPixelRatio: { value: 1 }, uTime: { value: 0 } },
    vertexShader: TRAIL_VERT,
    fragmentShader: TRAIL_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  const trail = new Points(trailGeo, trailMat);
  trail.name = 'fairy-trail';
  trail.frustumCulled = false;
  // trail positions are world-space; keep it outside the moving group
  const root = new Group();
  root.name = 'fairy';
  root.add(group, trail);

  const position = (t: number, out: Vector3) => {
    const a = t * 0.55;
    const r = 0.45 + 0.12 * Math.sin(t * 0.31);
    out.set(
      centre.x + Math.cos(a) * r + 0.08 * Math.sin(t * 2.3),
      centre.y + 0.13 * Math.sin(t * 1.7 * Math.PI) + 0.18 * Math.sin(t * 0.23),
      centre.z + Math.sin(a) * r * 0.75 + 0.06 * Math.cos(t * 1.9),
    );
    return out;
  };

  const p = new Vector3();
  const prev = new Vector3();
  const tmp = new Vector3();
  return {
    group: root,
    light,
    position,
    update(t) {
      position(t, p);
      group.position.copy(p);
      // face the direction of travel
      position(t - 0.05, prev);
      tmp.subVectors(p, prev);
      if (tmp.lengthSq() > 1e-8) group.rotation.y = Math.atan2(tmp.x, tmp.z);
      // wing flutter ~13 Hz, asymmetric
      const flap = Math.sin(t * Math.PI * 2 * 13);
      const ang = 0.35 + 0.55 * (0.5 + 0.5 * flap);
      wingL.rotation.y = ang;
      wingR.rotation.y = -ang;
      wingMat.uniforms.uTime.value = t;
      light.intensity = 2.2 + 0.4 * Math.sin(t * 5.1);
      for (let i = 0; i < TRAIL_COUNT; i++) {
        position(t - (i + 1) * TRAIL_DT, tmp);
        // sparkles fall slightly behind and below the path
        tmp.y -= i * 0.004;
        trailPos[i * 3] = tmp.x;
        trailPos[i * 3 + 1] = tmp.y;
        trailPos[i * 3 + 2] = tmp.z;
      }
      trailAttr.needsUpdate = true;
      trailMat.uniforms.uTime.value = t;
      trailMat.uniforms.uPixelRatio.value = ctx.renderer.getPixelRatio();
    },
  };
}
