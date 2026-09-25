import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NormalBlending,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three';
import { Builder } from '../core/builder';
import { box, cylinder, lathe, profile } from '../core/geom';
import { plasticRoughnessTexture, swatch, type ColorKey } from '../core/palette';
import { Rng } from '../core/rng';

/**
 * Time-pure effects: every effect is an event scheduled at film-build time and evaluated from the
 * film clock, so any frame renders identically in isolation. Lasers are HDR capsules (they bloom),
 * explosions are procedural fireball billboards + smoke + a burst of real LEGO pieces + sparks.
 */

export type LaserColor = 'red' | 'blue' | 'green';
export interface LaserEvent {
  t0: number;
  from: Vector3;
  dir: Vector3;
  speed: number;
  life: number;
  length: number;
  width: number;
  color: LaserColor;
  /** optional frame the bolt lives in (e.g. a moving Venator); world if absent */
}

const LASER_COL: Record<LaserColor, [number, number]> = {
  red: [0xff2a18, 0xffb0a0],
  blue: [0x2a7bff, 0xbfe4ff],
  green: [0x2cff4a, 0xc8ffd0],
};

class LaserSystem {
  group = new Group();
  events: LaserEvent[] = [];
  private meshes = new Map<LaserColor, { core: InstancedMesh; glow: InstancedMesh }>();
  private max = 900;
  constructor() {
    this.group.name = 'lasers';
    const geo = new BufferGeometry();
    const capsule = lathe(profile([[0, 0.5], [0.35, 0.42], [0.5, 0.25], [0.5, -0.25], [0.35, -0.42], [0, -0.5]], 60), 8);
    geo.setAttribute('position', new BufferAttribute(capsule.pos, 3));
    geo.setAttribute('normal', new BufferAttribute(capsule.nrm, 3));
    for (const c of ['red', 'blue', 'green'] as LaserColor[]) {
      const [glowHex, coreHex] = LASER_COL[c];
      const coreMat = new MeshBasicMaterial({ color: new Color(coreHex).multiplyScalar(9), transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
      const glowMat = new MeshBasicMaterial({ color: new Color(glowHex).multiplyScalar(3.2), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
      const core = new InstancedMesh(geo, coreMat, this.max);
      const glow = new InstancedMesh(geo, glowMat, this.max);
      for (const m of [core, glow]) {
        m.frustumCulled = false;
        m.count = 0;
        m.instanceMatrix.setUsage(DynamicDrawUsage);
        m.renderOrder = 5;
        this.group.add(m);
      }
      this.meshes.set(c, { core, glow });
    }
  }
  update(t: number): void {
    const counts: Record<LaserColor, number> = { red: 0, blue: 0, green: 0 };
    const m = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3();
    const p = new Vector3();
    const Z = new Vector3(0, 1, 0);
    for (const e of this.events) {
      const age = t - e.t0;
      if (age < 0 || age > e.life) continue;
      const set = this.meshes.get(e.color)!;
      const i = counts[e.color];
      if (i >= this.max) continue;
      counts[e.color]++;
      const fade = Math.min(1, age / 0.03) * Math.min(1, (e.life - age) / 0.05);
      p.copy(e.dir).multiplyScalar(e.speed * age).add(e.from);
      q.setFromUnitVectors(Z, e.dir);
      s.set(e.width * fade, e.length, e.width * fade);
      m.compose(p, q, s);
      set.core.setMatrixAt(i, m);
      s.set(e.width * 2.6 * fade, e.length * 1.15, e.width * 2.6 * fade);
      m.compose(p, q, s);
      set.glow.setMatrixAt(i, m);
    }
    for (const [c, set] of this.meshes) {
      set.core.count = counts[c];
      set.glow.count = counts[c];
      set.core.instanceMatrix.needsUpdate = true;
      set.glow.instanceMatrix.needsUpdate = true;
    }
  }
}

/* ----------------------------------------------------------------- fireballs + smoke */

interface Puff {
  center: Vector3;
  t0: number;
  dur: number;
  size: number;
  seed: number;
  heat: number;
  vel: Vector3;
}

const PUFF_VERT = /* glsl */ `
attribute vec3 aCenter; attribute vec3 aVel; attribute vec4 aParams; // t0, dur, size, seed
attribute float aHeat;
uniform float uTime;
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vHeat;
void main(){
  float age = (uTime - aParams.x) / aParams.y;
  vAge = age; vSeed = aParams.w; vHeat = aHeat; vUv = position.xy * 2.0;
  if (age < 0.0 || age > 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float grow = 0.35 + 0.95 * (1.0 - pow(1.0 - age, 3.0));
  vec3 c = aCenter + aVel * (uTime - aParams.x);
  vec4 mv = viewMatrix * vec4(c, 1.0);
  float ang = aParams.w * 6.2831 + age * 0.6;
  vec2 xy = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * position.xy;
  mv.xy += xy * aParams.z * grow;
  gl_Position = projectionMatrix * mv;
}`;

const PUFF_NOISE = /* glsl */ `
float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 x){ vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
float fbm2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * n2(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
`;

const FIRE_FRAG = /* glsl */ `
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vHeat;
${PUFF_NOISE}
void main(){
  float r = length(vUv);
  float n = fbm2(vUv * 2.2 + vSeed * 17.0 + vAge * 1.8);
  float shape = smoothstep(1.0, 0.35, r + (n - 0.5) * 0.75);
  if (shape <= 0.001) discard;
  float temp = clamp((1.0 - vAge * 1.25) * (1.15 - r) * 1.6 + (n - 0.5) * 0.5, 0.0, 1.0) * vHeat;
  vec3 col = mix(vec3(0.5, 0.06, 0.01), vec3(1.0, 0.45, 0.08), smoothstep(0.1, 0.45, temp));
  col = mix(col, vec3(1.0, 0.85, 0.5), smoothstep(0.45, 0.8, temp));
  col = mix(col, vec3(1.0, 0.93, 0.75), smoothstep(0.85, 1.0, temp));
  float inten = mix(0.9, 5.5, temp) * pow(1.0 - vAge, 1.3);
  gl_FragColor = vec4(col * inten * shape, 1.0);
}`;

const SMOKE_FRAG = /* glsl */ `
varying vec2 vUv; varying float vAge; varying float vSeed; varying float vHeat;
${PUFF_NOISE}
void main(){
  float r = length(vUv);
  float n = fbm2(vUv * 1.8 + vSeed * 11.0 + vAge * 0.9);
  float shape = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9);
  float a = shape * smoothstep(0.0, 0.12, vAge) * pow(1.0 - vAge, 1.5) * 0.75;
  if (a <= 0.004) discard;
  vec3 col = mix(vec3(0.05, 0.05, 0.055), vec3(0.28, 0.26, 0.25), n);
  // embers glow inside young smoke
  col += vec3(0.9, 0.3, 0.05) * (1.0 - smoothstep(0.0, 0.35, vAge)) * (1.0 - r) * 0.8;
  gl_FragColor = vec4(col, a);
}`;

class PuffSystem {
  mesh: Mesh;
  mat: ShaderMaterial;
  constructor(puffs: Puff[], additive: boolean) {
    const n = Math.max(1, puffs.length);
    const g = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    const c = new Float32Array(n * 3), v = new Float32Array(n * 3), pr = new Float32Array(n * 4), ht = new Float32Array(n);
    puffs.forEach((p, i) => {
      c.set([p.center.x, p.center.y, p.center.z], i * 3);
      v.set([p.vel.x, p.vel.y, p.vel.z], i * 3);
      pr.set([p.t0, p.dur, p.size, p.seed], i * 4);
      ht[i] = p.heat;
    });
    if (!puffs.length) pr.set([-100, 0.001, 0, 0], 0);
    g.setAttribute('aCenter', new InstancedBufferAttribute(c, 3));
    g.setAttribute('aVel', new InstancedBufferAttribute(v, 3));
    g.setAttribute('aParams', new InstancedBufferAttribute(pr, 4));
    g.setAttribute('aHeat', new InstancedBufferAttribute(ht, 1));
    g.instanceCount = n;
    this.mat = new ShaderMaterial({
      vertexShader: PUFF_VERT,
      fragmentShader: additive ? FIRE_FRAG : SMOKE_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 4;
  }
}

/* ----------------------------------------------------------------- brick debris */

interface Piece {
  t0: number;
  life: number;
  from: Vector3;
  vel: Vector3;
  axis: Vector3;
  spin: number;
  scale: number;
  shape: number;
  color: Color;
}

/* ----------------------------------------------------------------- sparks */

interface Spark {
  t0: number;
  life: number;
  from: Vector3;
  vel: Vector3;
  size: number;
}

export interface ExplosionOpts {
  /** overall size (units); fighters ~6, capital-ship hits ~120 */
  size: number;
  colors?: ColorKey[];
  pieces?: number;
  /** debris brick scale (1 = minifig-scale bricks, 8 = macro) */
  brickScale?: number;
  sparks?: number;
  smoke?: number;
  /** velocity of the exploding object (debris inherits it) */
  inherit?: Vector3;
  seed?: number;
  flashes?: number;
}

export class FX {
  group = new Group();
  lasers = new LaserSystem();
  private puffsFire: Puff[] = [];
  private puffsSmoke: Puff[] = [];
  private pieces: Piece[] = [];
  private sparks: Spark[] = [];
  private fire?: PuffSystem;
  private smoke?: PuffSystem;
  private debris: InstancedMesh[] = [];
  private sparkPts?: Points;
  private sparkMat?: ShaderMaterial;
  private built = false;
  /** explosion log (for the soundtrack) */
  explosions: { t0: number; pos: Vector3; size: number; pieces: number }[] = [];

  constructor() {
    this.group.name = 'fx';
    this.group.add(this.lasers.group);
  }

  laser(e: LaserEvent): void {
    this.lasers.events.push({ ...e, from: e.from.clone(), dir: e.dir.clone().normalize() });
  }

  /** Schedule an explosion at world position `pos` starting at t0. */
  explosion(t0: number, pos: Vector3, o: ExplosionOpts): void {
    const rng = new Rng(o.seed ?? Math.floor(t0 * 1000 + pos.x * 7 + pos.y * 13));
    const S = o.size;
    this.explosions.push({ t0, pos: pos.clone(), size: S, pieces: o.pieces ?? 40 });
    const inherit = o.inherit ?? new Vector3();
    const flashes = o.flashes ?? 1;
    for (let k = 0; k < flashes; k++) {
      const dt = k * rng.range(0.06, 0.18);
      const nf = 5 + Math.floor(rng.range(0, 3));
      for (let i = 0; i < nf; i++) {
        const off = new Vector3(rng.gauss(), rng.gauss(), rng.gauss()).multiplyScalar(S * 0.28);
        this.puffsFire.push({
          center: pos.clone().add(off),
          t0: t0 + dt + i * 0.025,
          dur: rng.range(0.55, 1.0) * Math.pow(S / 6, 0.25),
          size: S * rng.range(0.6, 1.1),
          seed: rng.next(),
          heat: rng.range(0.85, 1.15),
          vel: off.clone().normalize().multiplyScalar(S * 0.6).add(inherit),
        });
      }
    }
    const ns = o.smoke ?? 6;
    for (let i = 0; i < ns; i++) {
      const off = new Vector3(rng.gauss(), rng.gauss(), rng.gauss()).multiplyScalar(S * 0.35);
      this.puffsSmoke.push({
        center: pos.clone().add(off),
        t0: t0 + 0.12 + i * 0.04,
        dur: rng.range(1.6, 2.8) * Math.pow(S / 6, 0.2),
        size: S * rng.range(0.9, 1.5),
        seed: rng.next(),
        heat: 1,
        vel: off.clone().normalize().multiplyScalar(S * 0.35).add(inherit.clone().multiplyScalar(0.9)),
      });
    }
    const np = o.pieces ?? 40;
    const colors = o.colors ?? ['lbg', 'dbg', 'white'];
    const bs = o.brickScale ?? 1;
    for (let i = 0; i < np; i++) {
      const dir = new Vector3(rng.gauss(), rng.gauss(), rng.gauss()).normalize();
      const speed = S * rng.range(1.2, 4.5);
      this.pieces.push({
        t0,
        life: rng.range(2.5, 5),
        from: pos.clone().add(dir.clone().multiplyScalar(S * 0.1)),
        vel: dir.multiplyScalar(speed).add(inherit),
        axis: new Vector3(rng.gauss(), rng.gauss(), rng.gauss()).normalize(),
        spin: rng.range(4, 14) * (rng.chance(0.5) ? 1 : -1),
        scale: bs * rng.range(0.7, 1.3),
        shape: rng.int(0, 3),
        color: new Color(swatch(rng.pick(colors)).hex),
      });
    }
    const nsp = o.sparks ?? 40;
    for (let i = 0; i < nsp; i++) {
      const dir = new Vector3(rng.gauss(), rng.gauss(), rng.gauss()).normalize();
      this.sparks.push({ t0: t0 + rng.range(0, 0.1), life: rng.range(0.4, 1.1), from: pos.clone(), vel: dir.multiplyScalar(S * rng.range(3, 9)).add(inherit), size: rng.range(2, 5) });
    }
  }

  /** A stream of cutting sparks (buzz droid saws) from a point along a direction. */
  sparkStream(t0: number, t1: number, at: (t: number) => Vector3, dir: (t: number) => Vector3, rate = 90, seed = 1, speed = 3): void {
    const rng = new Rng(seed);
    const n = Math.floor((t1 - t0) * rate);
    for (let i = 0; i < n; i++) {
      const t = t0 + (i / rate) + rng.range(0, 1 / rate);
      const d = dir(t).clone().add(new Vector3(rng.gauss(), rng.gauss(), rng.gauss()).multiplyScalar(0.45)).normalize();
      this.sparks.push({ t0: t, life: rng.range(0.15, 0.45), from: at(t).clone(), vel: d.multiplyScalar(speed * rng.range(0.6, 1.6)), size: rng.range(1.5, 3.5) });
    }
  }

  /** Call once after all events are scheduled. */
  build(): void {
    if (this.built) return;
    this.built = true;
    this.smoke = new PuffSystem(this.puffsSmoke, false);
    this.fire = new PuffSystem(this.puffsFire, true);
    this.group.add(this.smoke.mesh, this.fire.mesh);
    // debris pieces: 1x1 brick, 1x2 plate, 2x2 tile, 1x1 round
    const shapes = [box(0.96, 1.16, 0.96, 0.04), box(1.96, 0.38, 0.96, 0.04), box(1.96, 0.38, 1.96, 0.04), cylinder(0.48, 0.38, 0.04, 12)];
    const counts = [0, 0, 0, 0];
    for (const p of this.pieces) counts[p.shape]++;
    const pm = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, roughnessMap: plasticRoughnessTexture(), clearcoat: 0.5, clearcoatRoughness: 0.15 });
    shapes.forEach((md, si) => {
      const b = new Builder({ tint: 0 });
      b.add('white', md);
      if (si === 0) b.studs('white', -0.5, 1.45, -0.5, 1, 1);
      if (si === 1) b.studs('white', -1, 0.475, -0.5, 2, 1);
      const built = b.build('debris');
      const geo = (built.group.children[0] as Mesh).geometry;
      const im = new InstancedMesh(geo, pm, Math.max(1, counts[si]));
      im.count = 0;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(DynamicDrawUsage);
      im.castShadow = true;
      this.debris.push(im);
      this.group.add(im);
    });
    // sparks as GPU-animated points
    const n = Math.max(1, this.sparks.length);
    const g = new BufferGeometry();
    const from = new Float32Array(n * 3), vel = new Float32Array(n * 3), par = new Float32Array(n * 3);
    this.sparks.forEach((s, i) => {
      from.set([s.from.x, s.from.y, s.from.z], i * 3);
      vel.set([s.vel.x, s.vel.y, s.vel.z], i * 3);
      par.set([s.t0, s.life, s.size], i * 3);
    });
    if (!this.sparks.length) par.set([-100, 0.001, 0], 0);
    g.setAttribute('position', new BufferAttribute(from, 3));
    g.setAttribute('aVel', new BufferAttribute(vel, 3));
    g.setAttribute('aPar', new BufferAttribute(par, 3));
    this.sparkMat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec3 aVel; attribute vec3 aPar; uniform float uTime; uniform float uScale; varying float vA;
        void main(){
          float age = uTime - aPar.x;
          if (age < 0.0 || age > aPar.y) { gl_Position = vec4(2.0,2.0,2.0,1.0); gl_PointSize = 0.0; vA = 0.0; return; }
          vA = 1.0 - age / aPar.y;
          vec3 p = position + aVel * age;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aPar.z * uScale * (0.4 + vA);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d) * 14.0) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vec3(1.0, 0.72, 0.35) * a * 8.0, 1.0); }`,
    });
    this.sparkPts = new Points(g, this.sparkMat);
    this.sparkPts.frustumCulled = false;
    this.sparkPts.renderOrder = 7;
    this.group.add(this.sparkPts);
  }

  update(t: number, pixelScale = 1): void {
    if (!this.built) this.build();
    this.lasers.update(t);
    this.fire!.mat.uniforms.uTime.value = t;
    this.smoke!.mat.uniforms.uTime.value = t;
    this.sparkMat!.uniforms.uTime.value = t;
    this.sparkMat!.uniforms.uScale.value = pixelScale;
    const counts = [0, 0, 0, 0];
    const m = new Matrix4();
    const q = new Quaternion();
    const p = new Vector3();
    const s = new Vector3();
    for (const pc of this.pieces) {
      const age = t - pc.t0;
      if (age < 0 || age > pc.life) continue;
      const im = this.debris[pc.shape];
      const i = counts[pc.shape]++;
      p.copy(pc.vel).multiplyScalar(age * (1 - age * 0.06)).add(pc.from);
      q.setFromAxisAngle(pc.axis, pc.spin * age);
      const sc = pc.scale * Math.min(1, (pc.life - age) / 0.4);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
      im.setColorAt(i, pc.color);
    }
    this.debris.forEach((im, k) => {
      im.count = counts[k];
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
  }
}
