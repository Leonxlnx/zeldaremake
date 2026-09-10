/**
 * Kokiri tree-trunk house: a hollow living trunk (parametric lathe with bulges, vertical bark
 * ridges, a flared base and buttress roots seated on the terrain), an arched child-sized doorway
 * cut through the wall with a wooden frame and threshold, a warm lit interior, a round glowing
 * window, a mossy thatched dome roof grown over by pale living branches with heart-leaf vines,
 * grass tufts and ferns, a stubby chimney branch and glowing pod lanterns on cords.
 */
import {
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  PointLight,
  TorusGeometry,
  Vector3,
} from 'three';
import type { HouseDef } from '../layout';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { TAU, angleDiff, basisMatrix, ensureColor, faceTowards, gridSurface, merge, setColorAttribute, sweepTube } from './geometry';
import { FoliageBuilder } from './foliage';
import { buildLantern, type LanternRig } from './lantern';
import type { StructureMaterials } from './materials';

export interface HouseBuild {
  group: Group;
  /** terrain contact points (root tips) */
  bases: [number, number, number][];
  lanterns: LanternRig[];
  lights: PointLight[];
  roots: number;
  branches: number;
  leaves: number;
}

/** Local frame: F = out of the door, Rt = viewer's right when facing the door. */
class Frame {
  constructor(
    public C: Vector3,
    public F: Vector3,
    public Rt: Vector3,
  ) {}
  dir(a: number, out = new Vector3()): Vector3 {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return out.set(this.F.x * c + this.Rt.x * s, 0, this.F.z * c + this.Rt.z * s);
  }
  at(a: number, r: number, y: number, out = new Vector3()): Vector3 {
    this.dir(a, out).multiplyScalar(r).add(this.C);
    out.y += y;
    return out;
  }
  /** door-space: lateral w (right +), height y, depth d along F from the centre */
  door(w: number, y: number, d: number, out = new Vector3()): Vector3 {
    out.copy(this.C).addScaledVector(this.F, d).addScaledVector(this.Rt, w);
    out.y += y;
    return out;
  }
}

interface LanternSpec {
  /** angle around the house (0 = door, + = viewer's right) */
  a: number;
  /** cord length */
  cord: number;
  /**
   * hook: 'shoulder' hangs on a vine from the roof mound's lower shoulder (polar angle phi),
   * 'rim' from the roof fringe, 'peg' from a short stub branch at height y
   */
  hook: 'shoulder' | 'rim' | 'peg';
  y?: number;
  phi?: number;
}

// Reference B: three pods in a loose row just left of the door, hanging on vines from the roof's
// left shoulder at about 1 m above the door top (y ≈ 0.29–0.32 in frame, x 0.74–0.79 vs door 0.78–0.84).
const LANTERNS: Record<string, LanternSpec[]> = {
  saria: [
    { a: -0.14, cord: 0.5, hook: 'shoulder', phi: 1.4 },
    { a: -0.3, cord: 0.72, hook: 'shoulder', phi: 1.38 },
    { a: -0.47, cord: 0.55, hook: 'shoulder', phi: 1.42 },
  ],
  upper: [
    { a: -0.2, cord: 0.5, hook: 'shoulder', phi: 1.4 },
    { a: 0.35, cord: 0.65, hook: 'shoulder', phi: 1.42 },
  ],
};

export function buildHouse(def: HouseDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng): HouseBuild {
  const group = new Group();
  group.name = `house-${def.id}`;
  const noise = new Noise2D(`${ctx.config.seed}/structures/house/${def.id}`);
  const terrain = ctx.terrain;
  const R = def.trunkRadius;
  const k = R / 3.2; // detail scale relative to the hero house
  const H = def.roofHeight * 0.56; // wall height (local, above the threshold)
  const T = 0.45; // wall thickness
  // the dome is a broad mushroom cap: it overhangs the trunk widely and peaks above roofHeight
  const domeTop = def.roofHeight * 1.14;

  const F = new Vector3(def.facing[0], 0, def.facing[1]).normalize();
  const Rt = new Vector3(F.z, 0, -F.x);
  const cx = def.position[0];
  const cz = def.position[2];
  // floor level = ground in front of the door (the terrain pad is flat-ish here)
  const yFloor = terrain.height(cx + F.x * (R * 1.15), cz + F.z * (R * 1.15));
  const frame = new Frame(new Vector3(cx, yFloor, cz), F, Rt);

  // ground ring under the trunk: sink the base below the lowest point so nothing floats
  let ringMin = Infinity;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const p = frame.at(a, R * 1.35, 0);
    ringMin = Math.min(ringMin, terrain.height(p.x, p.z) - yFloor);
  }
  const yBase = ringMin - 0.45;

  // ---- door + window fields (door-space lateral metres × local height) ----
  const doorH = 1.72;
  const doorHalfW = 0.62;
  const straight = doorH - doorHalfW;
  const doorSD = (w: number, y: number) => {
    if (y <= straight) return Math.max(Math.abs(w) - doorHalfW, -y - 0.5);
    return Math.hypot(w, y - straight) - doorHalfW;
  };
  // small round window right of the door, low enough to clear the drooping roof fringe
  const winA = 0.62;
  const winY = 2.05;
  const winR = 0.3;

  // ---- trunk radius model ----
  const rSmooth = (a: number, y: number) => {
    const flare = 0.42 * Math.exp(-(y + 0.2) / 1.15);
    const bulge = 0.05 * smoothstep(0.55 * H, H, y);
    const oval = 1 + 0.045 * noise.fbm(Math.cos(a) * 1.3 + 10, Math.sin(a) * 1.3, 2) + 0.025 * noise.noise(a * 0.5, y * 0.15);
    return R * (1 + flare + bulge) * oval;
  };
  // rope-like vertical bark cords: dense ridged noise that twists slowly with height, deep
  // furrows between cord bundles, broad lumps and fine grain
  const cords = (a: number, y: number) => {
    const arc = a * R;
    return noise.ridged(arc * 1.9 + noise.noise(y * 0.15, arc * 0.1) * 1.6 + y * 0.12, y * 0.14, 3) - 0.5;
  };
  const detail = (a: number, y: number) => {
    const arc = a * R;
    const furrow = Math.pow(Math.max(0, noise.noise(arc * 0.7 + 21, y * 0.12)), 2);
    const lumps = noise.fbm(arc * 0.35, y * 0.4, 3);
    const fine = noise.noise(arc * 3.5, y * 3.5);
    return cords(a, y) * 0.36 * k - furrow * 0.16 * k + lumps * 0.12 * k + fine * 0.015;
  };
  const doorW = (a: number, y: number, r: number) => angleDiff(a, 0) * r;
  const winW = (a: number, r: number) => angleDiff(a, winA) * r;

  // ---- outer shell ----
  const cols = Math.round(240 * Math.sqrt(k));
  const rows = Math.round(72 * Math.sqrt(k));
  const outer = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const y = lerp(yBase, H, v);
      const rs = rSmooth(a, y);
      const dsd = doorSD(doorW(a, y, rs), y);
      const wsd = Math.hypot(winW(a, rs), y - winY) - winR;
      const fade = smoothstep(0.02, 0.4, Math.min(dsd, wsd));
      const r = rs + detail(a, y) * fade;
      frame.at(a, r, y, out.position);
      out.uv = [(a * R) / 2.2, y / 2.2];
      // bark tint: darker + mossy toward the base, subtle warm variation; cord crests carry a
      // warm highlight and furrows a dark occlusion tint so the cords still read in shade
      const base = smoothstep(1.4, -0.3, y);
      const mossy = smoothstep(0.3, 0.8, noise.fbm(a * R * 0.5, y * 0.5, 2)) * smoothstep(2.6, 0.2, y);
      const vari = 0.9 + 0.2 * noise.noise(a * R * 0.8 + 5, y * 0.8);
      const crest = clamp(cords(a, y) * 2.2, -1, 1) * fade;
      const ao = 1 + 0.55 * crest;
      const rr = lerp(1.05 * vari, 0.62, base * 0.7) * ao * (1 + 0.08 * Math.max(0, crest));
      const gg = lerp(0.98 * vari, 0.62, base * 0.6) * ao;
      const bb = lerp(0.9 * vari, 0.6, base * 0.6) * ao * (1 - 0.1 * Math.max(0, crest));
      out.color = [lerp(rr, 0.55, mossy * 0.6), lerp(gg, 0.72, mossy * 0.6), lerp(bb, 0.4, mossy * 0.6)];
    },
    {
      cols,
      rows,
      closedU: true,
      // u runs clockwise (viewer's right) and v upward → dv × du points inward; flip to face out
      flip: true,
      hole: (u, v) => {
        const a = u * TAU;
        const y = lerp(yBase, H, v);
        const rs = rSmooth(a, y);
        return doorSD(doorW(a, y, rs), y) < 0 || Math.hypot(winW(a, rs), y - winY) < winR;
      },
    },
  );
  const trunk = new Mesh(outer, mats.bark);
  trunk.name = 'trunk';
  trunk.castShadow = trunk.receiveShadow = true;
  group.add(trunk);

  // ---- inner shell + floor + ceiling (seen through the door, BackSide material) ----
  const inner = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const y = lerp(-0.05, H + 0.25, v);
      frame.at(a, rSmooth(a, y) - T, y, out.position);
      out.uv = [(a * R) / 2.2, y / 2.2];
    },
    {
      cols: 96,
      rows: 20,
      closedU: true,
      flip: true,
      hole: (u, v) => {
        const a = u * TAU;
        const y = lerp(-0.05, H + 0.25, v);
        return doorSD(doorW(a, y, rSmooth(a, y) - T), y) < 0;
      },
    },
  );
  const ceiling = new CircleGeometry(R * 1.2, 32);
  ceiling.rotateX(-Math.PI / 2); // normal up → BackSide shows it from below
  ceiling.translate(cx, yFloor + H + 0.25, cz);
  const floor = new CircleGeometry(R * 1.2, 32);
  floor.rotateX(Math.PI / 2); // normal down → BackSide shows it from above
  floor.translate(cx, yFloor - 0.04, cz);
  const interior = new Mesh(merge([inner, ceiling, floor]), mats.interior);
  interior.name = 'interior';
  interior.receiveShadow = true;
  group.add(interior);

  // ---- doorway tunnel (wall thickness), threshold, frame ----
  const outline = 2 * straight + Math.PI * doorHalfW;
  const outlinePoint = (s: number): [number, number] => {
    const L = s * outline;
    if (L < straight) return [-doorHalfW, L];
    if (L > outline - straight) return [doorHalfW, outline - L];
    const t = (L - straight) / (Math.PI * doorHalfW);
    const ang = Math.PI - t * Math.PI;
    return [Math.cos(ang) * doorHalfW, straight + Math.sin(ang) * doorHalfW];
  };
  const dOut = (w: number, y: number) => {
    const rs = rSmooth(Math.atan2(w, rSmooth(0, y)), y);
    return Math.sqrt(Math.max(0.01, rs * rs - w * w));
  };
  const tunnel = gridSurface(
    (s, q, out) => {
      const [w, y] = outlinePoint(s);
      const d = lerp(dOut(w, y) + 0.06, dOut(w, y) - T - 0.02, q);
      frame.door(w, y, d, out.position);
      out.uv = [s * outline, q * T];
      const dark = lerp(0.55, 0.3, q);
      out.color = [dark, dark * 0.92, dark * 0.82];
    },
    { cols: 40, rows: 3 },
  );
  faceTowards(tunnel, (p, o) => frame.door(0, Math.min(p.y - yFloor, straight), 0, o));
  const tunnelMesh = new Mesh(tunnel, mats.bark);
  tunnelMesh.name = 'doorway';
  tunnelMesh.castShadow = tunnelMesh.receiveShadow = true;
  group.add(tunnelMesh);

  const woodParts = [];
  const threshold = new BoxGeometry(doorHalfW * 2 + 0.36, 0.1, T + 0.55);
  {
    const d0 = dOut(0, 0.05);
    const m = basisMatrix(frame.door(0, 0.02, d0 - T / 2 + 0.12), F);
    threshold.applyMatrix4(m);
    setColorAttribute(threshold, [0.7, 0.62, 0.5]);
    woodParts.push(threshold);
  }
  // door posts and arched lintel — dark wood, protruding to hide the cut edge
  const frameR = 0.095 * Math.sqrt(k);
  for (const side of [-1, 1]) {
    const w = side * (doorHalfW + frameR * 0.85);
    const pts = [frame.door(w, -0.2, dOut(w, 0) + 0.02), frame.door(w * 1.01, straight * 0.5, dOut(w, straight * 0.5) + 0.03), frame.door(w * 1.02, straight + 0.06, dOut(w, straight) + 0.03)];
    const post = sweepTube(new CatmullRomCurve3(pts), { radius: (t) => frameR * (1 - 0.15 * t), tubularSegments: 6, radialSegments: 9, uvMetres: 0.6 });
    setColorAttribute(post, [0.62, 0.52, 0.4]);
    woodParts.push(post);
  }
  {
    const arcR = doorHalfW + frameR * 0.85;
    const pts: Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const ang = Math.PI - (i / 12) * Math.PI;
      const w = Math.cos(ang) * arcR;
      const y = straight + Math.sin(ang) * arcR;
      pts.push(frame.door(w, y, dOut(w, Math.min(y, H - 0.1)) + 0.03));
    }
    const lintel = sweepTube(new CatmullRomCurve3(pts), { radius: (t) => frameR * (0.95 + 0.15 * Math.sin(t * Math.PI)), tubularSegments: 24, radialSegments: 9, uvMetres: 0.6 });
    setColorAttribute(lintel, [0.6, 0.5, 0.38]);
    woodParts.push(lintel);
  }
  const woodMesh = new Mesh(merge(woodParts), mats.wood);
  woodMesh.name = 'door-frame';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // ---- interior warmth: hearth + shelf glows and one point light behind the doorway ----
  const glows = [];
  {
    // hearth on the back wall, seen straight through the door
    const back = rSmooth(Math.PI, 0.9) - T - 0.08;
    const hearth = new PlaneGeometry(0.8 * k, 0.6 * k);
    hearth.applyMatrix4(basisMatrix(frame.at(Math.PI, back, 0.3 + 0.3 * k), F));
    glows.push(hearth);
    // warm pool of light on the floor just inside the threshold
    const pool = new CircleGeometry(0.9 * k, 20);
    pool.rotateX(-Math.PI / 2);
    const pp = frame.door(0, 0.005, dOut(0, 0.2) - T - 1.1 * k);
    pool.translate(pp.x, pp.y, pp.z);
    glows.push(pool);
    for (const a of [-2.25, 2.35]) {
      const shelf = new PlaneGeometry(0.5 * k, 0.32 * k);
      const p = frame.at(a, rSmooth(a, 1.35) - T - 0.08, 1.35);
      shelf.applyMatrix4(basisMatrix(p, frame.dir(a).negate()));
      glows.push(shelf);
    }
  }
  const glowMesh = new Mesh(merge(glows), mats.hearth);
  glowMesh.name = 'interior-glow';
  group.add(glowMesh);

  const lights: PointLight[] = [];
  const doorLight = new PointLight(0xffa64d, 42 * k, 10 * k, 2);
  doorLight.position.copy(frame.door(0, 1.25, dOut(0, 1) - T - 1.0));
  doorLight.name = 'door-light';
  group.add(doorLight);
  lights.push(doorLight);

  // ---- round window: socket + glow + wooden ring ----
  {
    const O = frame.dir(winA);
    const surf = frame.at(winA, rSmooth(winA, winY) + 0.02, winY);
    const socket = new CylinderGeometry(winR, winR, T + 0.1, 24, 1, true);
    socket.rotateX(Math.PI / 2);
    socket.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -(T + 0.1) / 2 + 0.02), O));
    const socketMesh = new Mesh(socket, mats.interior);
    socketMesh.name = 'window-socket';
    group.add(socketMesh);
    const glass = new CircleGeometry(winR, 24);
    glass.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, -T + 0.04), O));
    const glassMesh = new Mesh(glass, mats.windowGlow);
    glassMesh.name = 'window-glow';
    group.add(glassMesh);
    const ring = new TorusGeometry(winR + 0.03, 0.065, 8, 28);
    ring.applyMatrix4(basisMatrix(surf.clone().addScaledVector(O, 0.02), O));
    const ringMesh = new Mesh(ring, mats.woodDark);
    ringMesh.name = 'window-frame';
    ringMesh.castShadow = ringMesh.receiveShadow = true;
    group.add(ringMesh);
  }

  // ---- buttress roots seated on the terrain ----
  const bases: [number, number, number][] = [];
  const rootParts = [];
  const rootCount = def.id === 'saria' ? 6 : 5;
  const rootRng = rng.fork('roots');
  for (let i = 0; i < rootCount; i++) {
    const a = 0.8 + (i / (rootCount - 1)) * (TAU - 1.6) + (rootRng() - 0.5) * 0.25;
    const y0 = 0.55 + rootRng() * 0.7;
    const r0 = (0.3 + rootRng() * 0.14) * k;
    const reach = R * (0.55 + rootRng() * 0.4);
    const rs0 = rSmooth(a, 0);
    const dir = frame.dir(a);
    const side = new Vector3(dir.z, 0, -dir.x).multiplyScalar((rootRng() - 0.5) * 0.7);
    const p0 = frame.at(a, rSmooth(a, y0) - 0.4, y0);
    const p1 = frame.at(a, rSmooth(a, y0 * 0.65) + 0.1, y0 * 0.66);
    const p2 = frame.at(a, rs0 + reach * 0.45, 0).addScaledVector(side, 0.5);
    p2.y = terrain.height(p2.x, p2.z) + 0.28 * k;
    const p3 = frame.at(a, rs0 + reach, 0).add(side);
    p3.y = terrain.height(p3.x, p3.z);
    const p4 = frame.at(a, rs0 + reach + 0.6, 0).addScaledVector(side, 1.3);
    p4.y = terrain.height(p4.x, p4.z) - 0.4;
    const curve = new CatmullRomCurve3([p0, p1, p2, p3, p4], false, 'catmullrom', 0.5);
    const rootN = 4.5 + rootRng() * 3;
    const root = sweepTube(curve, {
      radius: (t) => r0 * (1 - 0.72 * t) * (0.9 + 0.2 * Math.abs(Math.sin(t * rootN))),
      tubularSegments: 22,
      radialSegments: 11,
      uvMetres: 1.4,
      displace: (t, ang) => (noise.ridged(ang * 1.2 + i * 3.1, t * 6, 2) - 0.5) * 0.05 * k * (1 - 0.5 * t),
      color: (t) => {
        const d = lerp(0.72, 0.58, t);
        return [d, d * 0.95, d * 0.85];
      },
      capEnd: true,
    });
    rootParts.push(root);
    bases.push([p3.x, p3.y, p3.z]);
  }
  const rootsMesh = new Mesh(merge(rootParts), mats.bark);
  rootsMesh.name = 'roots';
  rootsMesh.castShadow = rootsMesh.receiveShadow = true;
  group.add(rootsMesh);

  // ---- roof dome ----
  // A leafy mound sitting on the trunk (reference B: the roof is barely wider than the trunk
  // and reads as a tree crown / overgrown stump, not a mushroom cap): rounded crown, full
  // shoulders, a modest rim and a short lip that sags unevenly (heavier toward the back-left).
  // φ ∈ [0, π/2] is the cap, (π/2, phiMax] the under-curling lip.
  const domeR = R * 1.32;
  const rimY = H - 0.3;
  const domeH = domeTop - rimY;
  const lipH = 0.45 * k;
  const phiMax = Math.PI / 2 + 0.6;
  const domeBase = (a: number, phi: number, out = new Vector3()) => {
    let r: number;
    let y: number;
    if (phi <= Math.PI / 2) {
      const s = Math.sin(phi);
      const c = Math.cos(phi);
      r = domeR * Math.pow(s, 0.9);
      y = rimY + domeH * Math.pow(c, 0.9);
    } else {
      const q = (phi - Math.PI / 2) / (phiMax - Math.PI / 2);
      r = domeR * (1 - 0.08 * q - 0.14 * q * q);
      y = rimY - lipH * Math.sin(q * Math.PI * 0.5);
    }
    frame.dir(a, out).multiplyScalar(r).add(frame.C);
    out.y += y;
    // asymmetric sag (back-left heavier) and the crown shifted a little toward the back
    const t = phi / phiMax;
    out.y -= (0.22 + 0.22 * Math.sin(a + 2.2)) * smoothstep(0.2, 1, t) * k;
    out.addScaledVector(F, -0.28 * k * Math.pow(Math.max(0, Math.cos(phi)), 2));
    return out;
  };
  const _da = new Vector3();
  const _db = new Vector3();
  const domeNormal = (a: number, phi: number, out = new Vector3()) => {
    // outward normal of the undisplaced cap from finite differences
    const e = 0.01;
    domeBase(a + e, phi, _da).sub(domeBase(a - e, phi, _db));
    const phi0 = Math.max(0.001, phi - e);
    const phi1 = Math.min(phiMax, phi + e);
    domeBase(a, phi1, out).sub(domeBase(a, phi0, _db));
    out.cross(_da);
    if (out.lengthSq() < 1e-10) return out.set(0, 1, 0); // crown pole
    out.normalize();
    // orient outward: compare with the coarse ellipsoid direction
    if (out.dot(frame.dir(a, _db).multiplyScalar(Math.sin(phi)).setY(Math.cos(phi))) < 0) out.negate();
    return out;
  };
  const domeDisp = (p: Vector3, phi: number) => {
    const onCap = smoothstep(phiMax, Math.PI / 2 - 0.1, phi);
    const lumps = noise.fbm(p.x * 0.5, p.z * 0.5 + p.y * 0.3, 3) * 0.4 * k * (0.35 + 0.65 * onCap);
    const cushions = (noise.ridged(p.x * 1.2 + 3, p.z * 1.2, 2) - 0.5) * 0.24 * k * smoothstep(1.6, 0.3, phi);
    // small clumps: the crown is a mass of leaf clusters, so the surface itself is knobbly
    const clumps = (noise.ridged(p.x * 2.2 + 8, p.z * 2.2 + p.y * 0.5, 2) - 0.5) * 0.1 * k * onCap;
    const fine = noise.noise(p.x * 2.4, p.z * 2.4 + p.y) * 0.05;
    return lumps + cushions + clumps + fine;
  };
  const _n = new Vector3();
  const roofRes = Math.round(180 * Math.sqrt(k));
  const dome = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const phi = v * phiMax;
      domeBase(a, phi, out.position);
      domeNormal(a, phi, _n);
      const disp = domeDisp(out.position, phi);
      out.position.addScaledVector(_n, disp);
      // uneven droop of the lip
      const lip = smoothstep(Math.PI / 2, phiMax, phi);
      out.position.y -= lip * (0.12 + 0.16 * noise.noise(a * R * 1.1, 3.3) + 0.08 * noise.noise(a * R * 4, 7)) * k;
      out.uv = [(a * domeR) / 1.6, (phi * domeH) / 1.6];
      const p = out.position;
      const patches = noise.fbm(p.x * 0.8 + 11, p.z * 0.8, 2);
      // moss covers the whole cap down to the rim edge (the reference roof is green to its
      // edge); the under-curling lip fades to dark straw seen from below
      const m = clamp(0.72 + 0.28 * (0.5 + 0.5 * patches) + 0.2 * smoothstep(0.3, 0.7, noise.noise(p.x * 1.5 + 3, p.z * 1.5)), 0, 1) * (1 - 0.85 * smoothstep(0.25, 1, lip));
      const upness = smoothstep(0.05, 0.9, _n.y);
      // lit crowns of the clumps vs shaded hollows and flanks: a steep curve so the mound reads
      // as many small lit/dark leaf clusters (reference: p10 0.21 / p90 0.57 across the roof)
      const bright = clamp(Math.pow(upness, 1.4) * (0.35 + 0.65 * (0.5 + 0.5 * noise.noise(p.x * 1.3, p.z * 1.3 + 9))) + 0.6 * (disp / (0.3 * k)), 0, 1);
      // broad mottling so the moss reads as clumps rather than a uniform skin
      const mottle = 0.62 + 0.42 * noise.fbm(p.x * 0.38 + 5, p.z * 0.38 - 2, 2) + 0.14 * noise.noise(p.x * 3.1, p.z * 3.1 + 1);
      // vertex colours multiply the light straw map (~0.48 linear): yellow-olive on the lit
      // clumps (reference hue ≈ 45°), deep olive-green in the hollows and down the flanks;
      // the straw under the lip is dark and shaded
      const straw: [number, number, number] = [lerp(0.95, 0.42, lip), lerp(0.76, 0.33, lip), lerp(0.42, 0.18, lip)];
      const deep: [number, number, number] = [0.1, 0.16, 0.04];
      // > 1: the mound sits in canopy shade, so the lit clumps need a bright albedo to reach the
      // reference's sunlit yellow-green (p90 ≈ 0.57) under mostly ambient light
      const sun: [number, number, number] = [1.6, 1.5, 0.42];
      const flank = lerp(0.4, 1, smoothstep(-0.2, 0.8, _n.y));
      const mossC = [lerp(deep[0], sun[0], bright) * mottle * flank, lerp(deep[1], sun[1], bright) * mottle * flank, lerp(deep[2], sun[2], bright) * mottle * flank];
      out.color = [lerp(straw[0], mossC[0], m), lerp(straw[1], mossC[1], m), lerp(straw[2], mossC[2], m)];
    },
    { cols: roofRes, rows: Math.round(roofRes * 0.42), closedU: true },
  );
  // soffit: underside ring from the lip edge back to the trunk top
  const soffit = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rimP = domeBase(a, phiMax);
      const inP = frame.at(a, rSmooth(a, H) - 0.05, H - 0.15);
      out.position.lerpVectors(rimP, inP, v);
      out.position.y -= (1 - v) * 0.12 * k;
      out.uv = [(a * domeR) / 1.6, v * 2];
      out.color = [0.36, 0.28, 0.15];
    },
    { cols: 64, rows: 2, closedU: true },
  );
  faceTowards(soffit, (p, o) => o.set(p.x, p.y - 5, p.z));
  const roofMesh = new Mesh(merge([dome, soffit]), mats.roof);
  roofMesh.name = 'roof';
  roofMesh.castShadow = roofMesh.receiveShadow = true;
  group.add(roofMesh);

  // ---- living branches curling over the roof (pale bark) + chimney branch ----
  const branchRng = rng.fork('branches');
  const surfacePoint = (a: number, phi: number, lift: number) => {
    const p = domeBase(a, phi);
    const n = domeNormal(a, phi);
    return p.addScaledVector(n, domeDisp(p, phi) * 0.6 + lift);
  };
  type BranchDef = { path: [number, number][]; r0: number; r1: number; leavesAt: number[] };
  // (angle around the house, polar angle on the dome) waypoints; branches climb from behind the
  // dome, wrap over the crown and curl up into leafy tips above the front
  // one thick limb drapes diagonally from the back-right over the crown and ends mid-left; a
  // second comes over the right shoulder and stops on the crown; two shorter side branches
  // curl up into leafy tips over the left front. The front above the door stays mostly moss.
  const branchDefs: BranchDef[] = [
    { path: [[2.5, 1.7], [2.1, 1.2], [1.6, 0.8], [1.0, 0.5], [0.3, 0.5], [-0.35, 0.8], [-0.75, 1.1], [-0.95, 1.25]], r0: 0.4, r1: 0.12, leavesAt: [1] },
    { path: [[2.7, 1.6], [2.35, 1.2], [1.95, 0.9], [1.5, 0.72], [1.15, 0.62], [0.95, 0.5]], r0: 0.36, r1: 0.12, leavesAt: [1] },
    { path: [[-1.75, 0.95], [-1.4, 1.1], [-1.05, 1.32], [-0.85, 1.5], [-0.8, 1.6]], r0: 0.24, r1: 0.08, leavesAt: [1] },
    { path: [[3.1, 1.45], [2.85, 1.05], [2.55, 0.7], [2.2, 0.5], [2.0, 0.55]], r0: 0.3, r1: 0.1, leavesAt: [1] },
  ];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/house/${def.id}`);
  const branchParts = [];
  const leafTint: [number, number, number] = [0.68, 0.76, 0.36];
  // dark grey-brown limb bark (willow set, darkened): the reference limbs are as dark as the
  // shaded trunk but cooler/greyer than its warm bark
  const limbColor = (t: number, ang: number): [number, number, number] => {
    const d = lerp(0.5, 0.6, t) * (0.8 + 0.35 * Math.max(0, Math.sin(ang)));
    return [d, d * 0.93, d * 0.86];
  };
  for (let bi = 0; bi < branchDefs.length; bi++) {
    const b = branchDefs[bi];
    const pts = b.path.map(([a, phi], idx) => {
      const r = lerp(b.r0, b.r1, idx / (b.path.length - 1)) * k;
      // half-sunk into the moss, wandering sideways a little between waypoints
      const lift = r * 0.3 + (branchRng() - 0.5) * 0.08 + (idx % 2 ? 0.05 : 0) * k;
      return surfacePoint(a + (branchRng() - 0.5) * 0.16, phi + (branchRng() - 0.5) * 0.07, lift);
    });
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const twist = branchRng() * 10;
    const geo = sweepTube(curve, {
      radius: (t) => lerp(b.r0, b.r1, t) * k * (1 + 0.14 * Math.sin(t * 9 + twist) + 0.08 * Math.sin(t * 23 + twist * 2)),
      tubularSegments: 48,
      radialSegments: 12,
      uvMetres: 1.2,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.4 + t * 4 + bi, pos.y * 1.5, 2) - 0.5) * 0.08 * k,
      color: limbColor,
      capEnd: true,
    });
    branchParts.push(geo);
    for (const at of b.leavesAt) {
      const p = curve.getPointAt(at);
      foliage.addLeafCluster(p, 0.6 * k, 48, { size: 0.13, amount: 0.06, droop: 0.55, tint: leafTint, tintSpread: 0.28 });
      // a couple of short vines trail from each leafy tip
      const strands = 2;
      for (let s = 0; s < strands; s++) {
        const hook = p.clone().add(new Vector3((branchRng() - 0.5) * 0.4, -0.1, (branchRng() - 0.5) * 0.4));
        foliage.addHangingVine(hook, 0.45 + branchRng() * 0.55, { amount: 0.1 });
      }
    }
  }
  // ---- hero limb: a thick broken stub jutting out of the roof's left shoulder and leaning
  // left-down (reference B: the limb at (0.62–0.72, 0.15–0.30), ~2 m long, splintered end, no
  // leaves). The pods hang from the shoulder just right of it, left of the door.
  const limbPts = [
    frame.at(-0.55, R - 0.4, H + 0.55 * k),
    frame.at(-0.72, R + 0.55 * k, H + 0.62 * k),
    frame.at(-0.88, R + 1.35 * k, H + 0.4 * k),
    frame.at(-1.0, R + 2.05 * k, H + 0.02 * k),
  ];
  for (let i = 1; i < limbPts.length; i++) limbPts[i].add(new Vector3((branchRng() - 0.5) * 0.16, (branchRng() - 0.5) * 0.1, (branchRng() - 0.5) * 0.16));
  const limbCurve = new CatmullRomCurve3(limbPts, false, 'catmullrom', 0.5);
  const limbR = (t: number) => (0.48 - 0.16 * t) * k * (1 + 0.08 * Math.sin(t * 9 + 2) + 0.05 * Math.sin(t * 23));
  branchParts.push(
    sweepTube(limbCurve, {
      radius: limbR,
      tubularSegments: 24,
      radialSegments: 12,
      uvMetres: 1.2,
      // deep longitudinal ridges; the broken end flares a little and is jagged
      displace: (t, ang, pos) => (noise.ridged(ang * 1.6 + 7, pos.y * 1.5 + t * 2, 2) - 0.5) * 0.11 * k + smoothstep(0.85, 1, t) * (0.06 + 0.1 * Math.abs(Math.sin(ang * 5 + 1))) * k,
      color: (t, ang) => (t > 0.985 ? [0.2, 0.16, 0.12] : limbColor(t, ang)),
      capEnd: true,
    }),
  );
  {
    // a couple of vines trail off the stub's underside; one small ivy tuft rides on top
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.25;
      const p = limbCurve.getPointAt(t);
      p.y -= limbR(t) * 0.85;
      p.x += (branchRng() - 0.5) * 0.2;
      p.z += (branchRng() - 0.5) * 0.2;
      foliage.addHangingVine(p, (0.5 + branchRng() * 0.7) * k, { amount: 0.1 });
    }
    const top = limbCurve.getPointAt(0.55);
    top.y += limbR(0.55) * 0.8;
    foliage.addLeafCluster(top, 0.3 * k, 22, { size: 0.12, amount: 0.05, droop: 0.4, tint: leafTint, tintSpread: 0.28, flatten: 0.4 });
  }
  // chimney branch: stubby, hollow-looking, tilted
  {
    const a = 2.85;
    const phi = 0.42;
    const base = surfacePoint(a, phi, -0.25 * k);
    const up = domeNormal(a, phi).add(new Vector3(0, 1.2, 0)).normalize();
    const tilt = frame.dir(a + 1.2).multiplyScalar(0.18);
    const pts = [base, base.clone().addScaledVector(up, 0.45 * k).add(tilt), base.clone().addScaledVector(up, 0.95 * k).addScaledVector(tilt, 2.2)];
    const chimney = sweepTube(new CatmullRomCurve3(pts), {
      radius: (t) => (0.26 - 0.06 * t) * k,
      tubularSegments: 10,
      radialSegments: 12,
      uvMetres: 1.0,
      displace: (t, ang) => (noise.ridged(ang * 1.6 + 2, t * 5, 2) - 0.5) * 0.05 * k,
      color: (t, ang) => (t > 0.985 ? [0.12, 0.1, 0.08] : limbColor(t, ang)),
      capEnd: true,
    });
    branchParts.push(chimney);
  }
  const branchMesh = new Mesh(merge(branchParts), mats.barkPale);
  branchMesh.name = 'roof-branches';
  branchMesh.castShadow = branchMesh.receiveShadow = true;
  group.add(branchMesh);

  // ---- heart-leaf vines hanging from the fringe + draped over the dome, tufts and ferns on top ----
  const vineRng = rng.fork('vines');
  const hanging = def.id === 'saria' ? 20 : 14;
  for (let i = 0; i < hanging; i++) {
    // spread over the front 260°; strands right above the door stay short so it is not veiled
    const a = -2.3 + (i / (hanging - 1)) * 4.6 + (vineRng() - 0.5) * 0.2;
    const hook = surfacePoint(a, phiMax - 0.03, -0.12);
    hook.y -= 0.25 * k;
    const overDoor = smoothstep(0.55, 0.15, Math.abs(a));
    const len = (0.6 + vineRng() * 1.1) * (0.8 + 0.4 * Math.abs(Math.sin(a))) * (1 - 0.55 * overDoor);
    foliage.addHangingVine(hook, len * k, { amount: 0.1 });
  }
  const draped = def.id === 'saria' ? 6 : 4;
  for (let i = 0; i < draped; i++) {
    const a0 = (i / draped) * TAU + vineRng() * 0.6;
    const pts: Vector3[] = [];
    const nrms: Vector3[] = [];
    const n = 7;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const a = a0 + Math.sin(t * 2.2 + i) * 0.35;
      const phi = lerp(0.35 + vineRng() * 0.2, phiMax - 0.12, t);
      pts.push(surfacePoint(a, phi, 0.03));
      nrms.push(domeNormal(a, phi));
    }
    foliage.addSurfaceVine(pts, nrms, { amount: 0.02 });
  }
  const tuftCount = def.id === 'saria' ? 46 : 28;
  const roofShade: [number, number, number] = [0.72, 0.78, 0.6];
  for (let i = 0; i < tuftCount; i++) {
    const a = vineRng() * TAU;
    const phi = 0.12 + vineRng() * 1.15;
    const p = surfacePoint(a, phi, -0.03);
    const n = domeNormal(a, phi);
    const fern = vineRng() < 0.35;
    foliage.addTuft(p, n, (fern ? 0.5 : 0.34) * (0.8 + vineRng() * 0.5) * Math.sqrt(k), fern ? 1 : 0, 0.05, roofShade);
  }
  // ---- leaf-cluster shroud: the crown is a mass of overlapping leaf clumps (reference B:
  // a leafy mound with lit yellow-green tops and dark shaded undersides), so the smooth moss
  // shell only shows through between them. Tints run from deep olive in the hollows to
  // yellow-green on the lit clumps; the front above the door is thinned so the doorway stays clear.
  const clumpRng = rng.fork('clumps');
  const clumpCount = Math.round(140 * k * k);
  const tints: [number, number, number][] = [
    [0.4, 0.48, 0.22],
    [0.7, 0.78, 0.32],
    [1.05, 1.1, 0.44],
    [1.45, 1.4, 0.55],
  ];
  for (let i = 0; i < clumpCount; i++) {
    const a = clumpRng() * TAU;
    const phi = 0.1 + Math.pow(clumpRng(), 0.8) * (phiMax - 0.25);
    if (Math.abs(angleDiff(a, 0)) < 0.55 && phi > 1.1 && clumpRng() < 0.6) continue;
    const p = surfacePoint(a, phi, 0.08 * k);
    const n = domeNormal(a, phi);
    // lit side (upper faces) gets the yellower clumps, flanks the deep ones
    const lit = clamp(n.y * 0.75 + 0.3 * clumpRng() + 0.15 * noise.noise(p.x * 1.5, p.z * 1.5), 0, 0.999);
    const tint = tints[Math.floor(lit * tints.length)];
    const radius = (0.3 + clumpRng() * 0.26) * k;
    foliage.addLeafCluster(p, radius, 34, { size: 0.2 * Math.sqrt(k), amount: 0.05, droop: 0.5, tint, tintSpread: 0.25, flatten: 0.5 });
  }
  // a few big ferns / grass clumps on the shoulders and crown that break the dome silhouette
  const heroTufts: { a: number; phi: number; size: number; kind: 0 | 1 }[] = [
    { a: -1.45, phi: 1.0, size: 0.85, kind: 1 },
    { a: -1.85, phi: 1.25, size: 0.7, kind: 0 },
    { a: -0.95, phi: 0.62, size: 0.75, kind: 1 },
    { a: 0.7, phi: 0.42, size: 0.8, kind: 1 },
    { a: 2.1, phi: 0.95, size: 0.7, kind: 0 },
  ];
  for (const ht of heroTufts) {
    const p = surfacePoint(ht.a, ht.phi, -0.05);
    const n = domeNormal(ht.a, ht.phi);
    // lean the clump a little toward vertical so it stands proud of the moss
    n.y += 0.6;
    n.normalize();
    foliage.addTuft(p, n, ht.size * Math.sqrt(k), ht.kind, 0.06);
  }

  // ---- pod lanterns on cords ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('lanterns');
  const specs = LANTERNS[def.id] ?? LANTERNS.upper;
  const podPositions: Vector3[] = [];
  for (const spec of specs.slice(0, Math.max(def.lanterns, specs.length))) {
    let hook: Vector3;
    if (spec.hook === 'shoulder') {
      // hook on the mound's shoulder, pushed just clear of the leaf clumps; the cord is a vine
      hook = surfacePoint(spec.a, spec.phi ?? 1.2, 0.22 * k);
      hook.addScaledVector(frame.dir(spec.a), 0.15 * k);
      foliage.addHangingVine(hook.clone(), spec.cord * k * 0.85, { amount: 0.08, thickness: 0.012 });
    } else if (spec.hook === 'rim') {
      hook = surfacePoint(spec.a, phiMax - 0.05, -0.05);
      hook.y -= 0.2 * k;
      hook.addScaledVector(frame.dir(spec.a), 0.08);
    } else {
      const y = spec.y ?? 2.6;
      const start = frame.at(spec.a, rSmooth(spec.a, y) - 0.2, y);
      const end = frame.at(spec.a, rSmooth(spec.a, y) + 0.5 * k, y + 0.12);
      const peg = sweepTube(new CatmullRomCurve3([start, start.clone().lerp(end, 0.5).add(new Vector3(0, 0.04, 0)), end]), {
        radius: (t) => (0.075 - 0.03 * t) * k,
        tubularSegments: 6,
        radialSegments: 8,
        capEnd: true,
        color: () => [0.9, 0.85, 0.75],
      });
      const pegMesh = new Mesh(ensureColor(peg), mats.bark);
      pegMesh.name = 'lantern-peg';
      pegMesh.castShadow = true;
      group.add(pegMesh);
      hook = end.clone().addScaledVector(frame.dir(spec.a), -0.06);
      hook.y -= 0.04;
      // a hanging vine trails off the peg too
      foliage.addHangingVine(end.clone().add(new Vector3(0, 0.02, 0)), 0.5, { amount: 0.08 });
    }
    const rig = buildLantern(hook, spec.cord * k, mats, lanternRng, 1.0);
    group.add(rig.pivot);
    lanterns.push(rig);
    podPositions.push(rig.pod);
  }
  if (podPositions.length) {
    const c = new Vector3();
    for (const p of podPositions.slice(0, 2)) c.add(p);
    c.divideScalar(Math.min(2, podPositions.length));
    c.addScaledVector(F, 0.35);
    const lanternLight = new PointLight(ctx.config.palette.lanternGlow, 6.5, 6, 2);
    lanternLight.position.copy(c);
    lanternLight.name = 'lantern-light';
    group.add(lanternLight);
    lights.push(lanternLight);
  }

  for (const m of foliage.build(mats, `house-${def.id}`)) group.add(m);

  return { group, bases, lanterns, lights, roots: rootCount, branches: branchDefs.length + 2, leaves: foliage.leafCount };
}
