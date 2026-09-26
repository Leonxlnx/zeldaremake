import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Euler,
  Group,
  HemisphereLight,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Scene,
  Vector3,
  type CubeTexture,
  type Texture,
} from 'three';
import type { Pipeline } from '../render/pipeline';
import { HANGAR_ENV, SPACE_ENV, makeEnvironment } from '../render/env';
import { bakeNebula, makeStars } from '../world/sky';
import { makeCoruscant, type PlanetHandle } from '../world/planet';
import { FX } from '../fx/fx';
import { eta2 } from '../assets/eta2';
import { astromech } from '../assets/astromech';
import { venator } from '../assets/venator';
import { arc170 } from '../assets/arc170';
import { vultureDroid } from '../assets/vulture';
import { triFighter } from '../assets/trifighter';
import { discordMissile } from '../assets/missile';
import { buzzDroid } from '../assets/buzzdroid';
import { battleDroid } from '../assets/battleDroid';
import { munificent } from '../assets/munificent';
import { invisibleHand } from '../assets/invisibleHand';
import { hangarInterior } from '../assets/hangar';
import { lightsaber, type Lightsaber } from '../assets/lightsaber';
import { anakin as mkAnakin, obiwan as mkObiwan } from '../assets/lab-figs';
import type { Minifig } from '../assets/minifig';
import type { Astromech, BattleDroid, BuzzDroid, CapitalShip, Eta2, Hangar, InvisibleHand, Missile, SmallCraft, VultureDroid } from '../assets/types';
import { Swarm } from './instancing';
import { Crawl } from './crawl';

/** segments in R2's zap arc */
const ZAP_SEGS = 7;

/** Light comes from the upper port side, slightly behind the fleet's heading. */
export const SUN_DIR = new Vector3(0.55, 0.62, -0.38).normalize();
/** The planet's own (lower) sun so a terminator and city lights show below the battle. */
export const PLANET_SUN = new Vector3(0.62, 0.21, -0.45).normalize();
export const PLANET_R = 100000;
export const PLANET_C = new Vector3(0, -104000, 0);
/** hero Venator cruise velocity (world units / s) along +Z */
export const VENATOR_SPEED = 40;
/** the frigate destroyed on camera in the tracking shot sits here for the whole film */
export const VICTIM_POSE = { pos: new Vector3(3658, -1896, 6467), rot: new Euler(0.05, 2.6, 0.1) };

export interface Ship {
  root: Object3D;
}

/** Position of `o` expressed in `root`'s local frame (root's current pose is factored out). */
export function localIn(root: Object3D, o: Object3D): Vector3 {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  o.updateWorldMatrix(true, false);
  return new Vector3().setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv);
}

export class World {
  scene = new Scene();
  camera = new PerspectiveCamera(30, 2.39, 0.05, 3e6);
  sun: DirectionalLight;
  rim: DirectionalLight;
  hemi: HemisphereLight;
  /** close-up key (off unless a shot aims it with `keyLight`); shadowless, so it reaches faces inside canopies */
  key: DirectionalLight;
  /** R2's electric zap: a jagged glowing arc, posed per frame by zapArc() */
  zap = new Group();
  hangarLights = new Group();
  envSpace: Texture;
  envHangar: Texture;
  nebula: CubeTexture;
  stars: Group;
  planet: PlanetHandle;
  fx = new FX();
  crawl = new Crawl();
  // capital ships
  venator: CapitalShip;
  fleet: { root: Object3D; kind: string; ship: CapitalShip }[] = [];
  hand: InvisibleHand;
  munis: CapitalShip[] = [];
  // heroes
  anakinShip: Eta2;
  obiwanShip: Eta2;
  anakin: Minifig;
  obiwan: Minifig;
  r2: Astromech;
  r4: Astromech;
  sabers: Lightsaber[];
  // craft
  vultures: VultureDroid[] = [];
  arcs: SmallCraft[] = [];
  vultureSwarm: Swarm;
  arcSwarm: Swarm;
  triSwarm: Swarm;
  crawlers: VultureDroid[] = [];
  missiles: Missile[] = [];
  buzz: BuzzDroid[] = [];
  // hangar
  hangar: Hangar;
  droids: BattleDroid[] = [];
  /** everything whose visibility the shots control */
  actors: Object3D[] = [];
  /** ship-local anchor positions (computed once at build) */
  loc = {
    muzzlesA: [] as Vector3[],
    muzzlesO: [] as Vector3[],
    socketA: new Vector3(),
    socketO: new Vector3(),
    zapA: new Vector3(),
    cockpitA: new Vector3(),
    cockpitO: new Vector3(),
  };

  constructor(pipeline: Pipeline) {
    const r = pipeline.renderer;
    const s = this.scene;
    this.envSpace = makeEnvironment(r, SPACE_ENV([SUN_DIR.x, SUN_DIR.y, SUN_DIR.z]));
    this.envHangar = makeEnvironment(r, HANGAR_ENV);
    this.nebula = bakeNebula(r, { size: 512, strength: 0.9 });
    this.stars = makeStars({ count: 11000 });
    s.add(this.stars);
    this.planet = makeCoruscant({ radius: PLANET_R, center: PLANET_C, sunDir: PLANET_SUN });
    s.add(this.planet.group);

    this.sun = new DirectionalLight(0xfff1e0, 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.radius = 2.5;
    this.sun.layers.enableAll();
    s.add(this.sun, this.sun.target);
    this.rim = new DirectionalLight(0x9cc0ff, 0.9);
    this.rim.position.copy(new Vector3(-0.6, 0.15, 0.75));
    this.rim.layers.enableAll();
    s.add(this.rim, this.rim.target);
    this.hemi = new HemisphereLight(0x1d2a45, 0x6a86b8, 0.55);
    this.hemi.layers.enableAll();
    s.add(this.hemi);
    this.key = new DirectionalLight(0xffd6a8, 0);
    this.key.layers.enableAll();
    s.add(this.key, this.key.target);

    // interior lights for the hangar (enabled only there)
    const mkPoint = (c: number, i: number, x: number, y: number, z: number, d = 160) => {
      const p = new PointLight(c, i, d, 1.6);
      p.position.set(x, y, z);
      p.layers.enableAll();
      this.hangarLights.add(p);
    };
    mkPoint(0xfff0d8, 900, -40, 34, -20);
    mkPoint(0xfff0d8, 900, 40, 34, -20);
    mkPoint(0x5aa8ff, 700, 0, 18, 58, 140);
    mkPoint(0xff6a3a, 260, -80, 10, -40, 90);
    s.add(this.hangarLights);

    // --- ships
    this.venator = venator({ lod: 0, seed: 1 });
    this.venator.group.name = 'hero-venator';
    s.add(this.venator.group);
    const fleetSpec: [string, number, number, number, number][] = [
      // kind, x, y, z, yaw
      ['venator', -5200, -700, 7000, 0.05],
      ['venator', 5600, 400, 3000, -0.08],
      ['venator', 2600, -1500, 11500, 0.1],
      ['venator', -7400, 900, -2000, 0.12],
      ['venator', 9000, -1100, 15000, -0.05],
      ['venator', -3000, 1500, 19000, 0.2],
      ['muni', 3600, -1900, 16500, 3.3],
      ['muni', -4200, -1300, 13200, 3.0],
      ['muni', 8200, 400, 21500, 3.4],
      ['muni', -8800, -400, 24000, 2.9],
    ];
    for (const [kind, x, y, z, yaw] of fleetSpec) {
      const far = Math.hypot(x, z) > 14000;
      // the first frigate is the one destroyed on camera in the tracking shot: keep its detail
      const lod = kind === 'muni' && this.munis.length === 0 ? 1 : far ? 2 : 1;
      const ship = kind === 'venator' ? venator({ lod, seed: Math.floor(x) }) : munificent({ lod, seed: Math.floor(z) });
      ship.group.position.set(x, y, z);
      ship.group.rotation.y = yaw;
      if (kind === 'muni' && this.munis.length === 0) {
        ship.group.position.copy(VICTIM_POSE.pos);
        ship.group.rotation.copy(VICTIM_POSE.rot);
      }
      s.add(ship.group);
      this.fleet.push({ root: ship.group, kind, ship });
      if (kind === 'muni') this.munis.push(ship);
    }
    this.hand = invisibleHand({ lod: 0 });
    s.add(this.hand.group);

    // --- heroes
    this.anakinShip = eta2({ variant: 'anakin', lod: 0 });
    this.obiwanShip = eta2({ variant: 'obiwan', lod: 0 });
    this.anakin = mkAnakin();
    this.obiwan = mkObiwan();
    this.r2 = astromech({ variant: 'r2d2', socket: true });
    this.r4 = astromech({ variant: 'r4p17', socket: true });
    this.anakinShip.astromechAnchor.add(this.r2.group);
    this.obiwanShip.astromechAnchor.add(this.r4.group);
    s.add(this.anakinShip.group, this.obiwanShip.group);
    this.sabers = [lightsaber('blue'), lightsaber('blue')];
    this.anakinShip.setFoils(1);
    this.obiwanShip.setFoils(1);
    this.loc.muzzlesA = this.anakinShip.muzzles.map((m) => localIn(this.anakinShip.group, m));
    this.loc.muzzlesO = this.obiwanShip.muzzles.map((m) => localIn(this.obiwanShip.group, m));
    this.loc.socketA = localIn(this.anakinShip.group, this.anakinShip.astromechAnchor);
    this.loc.socketO = localIn(this.obiwanShip.group, this.obiwanShip.astromechAnchor);
    this.loc.zapA = localIn(this.anakinShip.group, this.r2.zapAnchor);
    this.loc.cockpitA = localIn(this.anakinShip.group, this.anakinShip.cockpitAnchor);
    this.loc.cockpitO = localIn(this.obiwanShip.group, this.obiwanShip.cockpitAnchor);

    // --- droid craft
    for (let i = 0; i < 8; i++) {
      const v = vultureDroid({ lod: 0, seed: i + 1 });
      s.add(v.group);
      this.vultures.push(v);
    }
    for (let i = 0; i < 10; i++) {
      const v = vultureDroid({ lod: 1, seed: 50 + i });
      v.setMode(1);
      s.add(v.group);
      this.crawlers.push(v);
    }
    for (let i = 0; i < 4; i++) {
      const a = arc170({ lod: 0 });
      s.add(a.group);
      this.arcs.push(a);
    }
    const vs = vultureDroid({ lod: 1, seed: 99 });
    this.vultureSwarm = new Swarm(vs.group, 60, 'vulture-swarm');
    const as = arc170({ lod: 1 });
    this.arcSwarm = new Swarm(as.group, 24, 'arc-swarm');
    const ts = triFighter({ lod: 1 });
    this.triSwarm = new Swarm(ts.group, 16, 'tri-swarm');
    s.add(this.vultureSwarm.group, this.arcSwarm.group, this.triSwarm.group);
    for (let i = 0; i < 2; i++) {
      const m = discordMissile();
      s.add(m.group);
      this.missiles.push(m);
    }
    for (let i = 0; i < 6; i++) {
      const b = buzzDroid({ seed: i + 1 });
      s.add(b.group);
      this.buzz.push(b);
    }

    // --- hangar
    this.hangar = hangarInterior();
    s.add(this.hangar.group);
    const variants = ['commander', 'standard', 'standard', 'security', 'standard', 'pilot', 'standard'] as const;
    for (let i = 0; i < variants.length; i++) {
      const d = battleDroid({ variant: variants[i], seed: i + 3 });
      s.add(d.group);
      this.droids.push(d);
    }

    s.add(this.crawl.group);
    s.add(this.fx.group);
    // HDR colour (not tone-mapped) so the bloom pass makes the arc glow: a hot core inside a soft halo
    const zapCore = new MeshBasicMaterial({ color: new Color(3.0, 4.6, 8.0), blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    const zapHalo = new MeshBasicMaterial({ color: new Color(0.35, 0.75, 1.9), blending: AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    const coreSeg = new CylinderGeometry(0.11, 0.11, 1, 6, 1, true);
    const haloSeg = new CylinderGeometry(0.32, 0.32, 1, 8, 1, true);
    for (let i = 0; i < ZAP_SEGS; i++) this.zap.add(new Mesh(coreSeg, zapCore));
    for (let i = 0; i < ZAP_SEGS; i++) this.zap.add(new Mesh(haloSeg, zapHalo));
    s.add(this.zap);

    this.actors = [
      this.zap,
      this.venator.group,
      ...this.fleet.map((f) => f.root),
      this.hand.group,
      this.anakinShip.group,
      this.obiwanShip.group,
      ...this.vultures.map((v) => v.group),
      ...this.crawlers.map((v) => v.group),
      ...this.arcs.map((a) => a.group),
      this.vultureSwarm.group,
      this.arcSwarm.group,
      this.triSwarm.group,
      ...this.missiles.map((m) => m.group),
      ...this.buzz.map((b) => b.group),
      this.hangar.group,
      ...this.droids.map((d) => d.group),
      this.crawl.group,
      this.anakin.group,
      this.obiwan.group,
      ...this.sabers.map((sb) => sb.group),
    ];
    this.space();
  }

  /** Show R2's zap as a jagged arc from `from` to `to`; `seed` picks the jag (change it per frame to crackle). */
  zapArc(from: Vector3, to: Vector3, seed: number): void {
    const segs = this.zap.children;
    const d = to.clone().sub(from);
    const len = d.length();
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    const pts = [from.clone()];
    for (let i = 1; i < ZAP_SEGS; i++) pts.push(from.clone().addScaledVector(d, i / ZAP_SEGS).add(new Vector3(rnd(), rnd(), rnd()).multiplyScalar(len * 0.16)));
    pts.push(to.clone());
    const up = new Vector3(0, 1, 0);
    segs.forEach((seg, j) => {
      const i = j % ZAP_SEGS;
      const a = pts[i], b = pts[i + 1];
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.scale.set(1, Math.max(1e-3, a.distanceTo(b)), 1);
      seg.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    });
    this.zap.visible = true;
  }

  /** Hide every actor (shots then show what they need). */
  reset(): void {
    for (const a of this.actors) a.visible = false;
    this.key.intensity = 0;
    // the missile shot shrinks buzz droids into their payload bays; every other shot expects full size
    for (const b of this.buzz) b.group.scale.setScalar(1);
    this.fx.group.visible = true;
  }

  space(): void {
    this.scene.environment = this.envSpace;
    this.scene.environmentIntensity = 1;
    this.scene.background = this.nebula;
    this.stars.visible = true;
    this.planet.group.visible = true;
    this.sun.intensity = 3.1;
    this.sun.color.set(0xfff1e0);
    this.rim.intensity = 0.9;
    this.hemi.intensity = 0.55;
    this.hemi.color.set(0x1d2a45);
    this.hemi.groundColor.set(0x6a86b8);
    this.hangarLights.visible = false;
  }

  interior(): void {
    this.scene.environment = this.envHangar;
    this.scene.environmentIntensity = 1;
    this.scene.background = this.nebula;
    this.stars.visible = true;
    this.planet.group.visible = true;
    this.sun.intensity = 1.2;
    this.sun.color.set(0xffe2c0);
    this.rim.intensity = 0.25;
    this.hemi.intensity = 0.35;
    this.hemi.color.set(0x6d6258);
    this.hemi.groundColor.set(0x2a2622);
    this.hangarLights.visible = true;
  }

  /** Point the sun's shadow frustum at a subject. */
  aimShadow(center: Vector3, radius: number, dir = SUN_DIR): void {
    this.sun.position.copy(dir).multiplyScalar(radius * 6).add(center);
    this.sun.target.position.copy(center);
    const c = this.sun.shadow.camera;
    c.left = -radius;
    c.right = radius;
    c.top = radius;
    c.bottom = -radius;
    c.near = radius * 2;
    c.far = radius * 12;
    c.updateProjectionMatrix();
    this.sun.shadow.normalBias = radius * 0.0015;
    this.sun.target.updateMatrixWorld();
  }

  /** Light `center` from direction `dir` (toward the light) with the close-up key. */
  keyLight(center: Vector3, dir: Vector3, intensity: number, color = 0xffd6a8): void {
    this.key.position.copy(dir).normalize().multiplyScalar(20).add(center);
    this.key.target.position.copy(center);
    this.key.target.updateMatrixWorld();
    this.key.intensity = intensity;
    this.key.color.set(color);
  }

  /** Seat a minifig in a fighter cockpit. */
  seat(fig: Minifig, ship: Eta2): void {
    if (fig.group.parent !== ship.cockpitAnchor) ship.cockpitAnchor.add(fig.group);
    fig.group.position.set(0, 0, 0);
    fig.group.quaternion.identity();
    fig.group.visible = true;
    fig.seated();
  }

  /** Stand a minifig in the world (soles on y). */
  stand(fig: Minifig, pos: Vector3, yaw: number): void {
    if (fig.group.parent !== this.scene) this.scene.add(fig.group);
    fig.group.position.set(pos.x, pos.y + 1.25, pos.z);
    fig.group.quaternion.setFromAxisAngle(new Vector3(0, 1, 0), yaw);
    fig.group.visible = true;
  }
}

export const tmpM = new Matrix4();
export const tmpQ = new Quaternion();
export const tmpC = new Color();
