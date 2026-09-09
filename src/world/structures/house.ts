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
  /** hook: 'rim' hangs from the roof fringe, 'peg' from a short stub branch at height y */
  hook: 'rim' | 'peg';
  y?: number;
}

const LANTERNS: Record<string, LanternSpec[]> = {
  saria: [
    { a: -0.1, cord: 0.32, hook: 'rim' },
    { a: -0.27, cord: 0.38, hook: 'rim' },
    { a: -0.72, cord: 0.36, hook: 'peg', y: 2.55 },
  ],
  upper: [
    { a: -0.22, cord: 0.4, hook: 'rim' },
    { a: 0.38, cord: 0.55, hook: 'rim' },
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
  const winA = 0.82;
  const winY = 2.35;
  const winR = 0.3;

  // ---- trunk radius model ----
  const rSmooth = (a: number, y: number) => {
    const flare = 0.42 * Math.exp(-(y + 0.2) / 1.15);
    const bulge = 0.05 * smoothstep(0.55 * H, H, y);
    const oval = 1 + 0.045 * noise.fbm(Math.cos(a) * 1.3 + 10, Math.sin(a) * 1.3, 2) + 0.025 * noise.noise(a * 0.5, y * 0.15);
    return R * (1 + flare + bulge) * oval;
  };
  const detail = (a: number, y: number) => {
    const arc = a * R;
    // deep vertical bark ridges that wander slightly with height, broad lumps, fine grain
    const ridge = noise.ridged(arc * 1.25 + noise.noise(y * 0.15, arc * 0.1) * 1.8, y * 0.16, 3);
    const furrow = Math.pow(Math.max(0, noise.noise(arc * 0.7 + 21, y * 0.12)), 2);
    const lumps = noise.fbm(arc * 0.35, y * 0.4, 3);
    const fine = noise.noise(arc * 3.5, y * 3.5);
    return (ridge - 0.5) * 0.2 * k - furrow * 0.14 * k + lumps * 0.12 * k + fine * 0.015;
  };
  const doorW = (a: number, y: number, r: number) => angleDiff(a, 0) * r;
  const winW = (a: number, r: number) => angleDiff(a, winA) * r;

  // ---- outer shell ----
  const cols = Math.round(200 * Math.sqrt(k));
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
      // bark tint: darker + mossy toward the base, subtle warm variation
      const base = smoothstep(1.4, -0.3, y);
      const mossy = smoothstep(0.3, 0.8, noise.fbm(a * R * 0.5, y * 0.5, 2)) * smoothstep(2.6, 0.2, y);
      const vari = 0.9 + 0.2 * noise.noise(a * R * 0.8 + 5, y * 0.8);
      const rr = lerp(1.05 * vari, 0.62, base * 0.7);
      const gg = lerp(0.98 * vari, 0.62, base * 0.6);
      const bb = lerp(0.9 * vari, 0.6, base * 0.6);
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
    const hearth = new PlaneGeometry(1.3 * k, 1.0 * k);
    hearth.applyMatrix4(basisMatrix(frame.at(Math.PI, back, 0.35 + 0.5 * k), F));
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
  const doorLight = new PointLight(0xffa64d, 34 * k, 10 * k, 2);
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
  const domeR = R * 1.52;
  const rimY = H - 0.3;
  const domeH = domeTop - rimY;
  const phiMax = 1.82;
  const domeBase = (a: number, phi: number, out = new Vector3()) => {
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    frame.dir(a, out).multiplyScalar(domeR * s).add(frame.C);
    out.y += rimY + domeH * c;
    return out;
  };
  const domeNormal = (a: number, phi: number, out = new Vector3()) => {
    // ellipsoid normal: (x/a², y/b²)
    const s = Math.sin(phi);
    const c = Math.cos(phi);
    frame.dir(a, out).multiplyScalar(s / domeR);
    out.y = c / domeH;
    return out.normalize();
  };
  const domeDisp = (p: Vector3, phi: number) => {
    const lumps = noise.fbm(p.x * 0.5, p.z * 0.5 + p.y * 0.3, 3) * 0.34 * k;
    const cushions = (noise.ridged(p.x * 0.9 + 3, p.z * 0.9, 2) - 0.5) * 0.16 * k * smoothstep(1.4, 0.3, phi);
    const fine = noise.noise(p.x * 2.4, p.z * 2.4 + p.y) * 0.05;
    return lumps + cushions + fine;
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
      // drooping thatch fringe: uneven sag toward the rim
      const fringe = smoothstep(0.78, 1, v);
      out.position.y -= fringe * (0.28 + 0.22 * noise.noise(a * R * 1.1, 3.3) + 0.1 * noise.noise(a * R * 4, 7)) * k;
      out.uv = [(a * domeR) / 1.6, (phi * domeH) / 1.6];
      // moss gradient: heavy on top, straw at the fringe; sunlit tops brighter
      const p = out.position;
      const patches = noise.fbm(p.x * 0.8 + 11, p.z * 0.8, 2);
      // moss reaches right down to the rim (the reference roof is green to its edge); straw
      // shows through in patches and at the drooping fringe
      const m = clamp(0.4 + 0.6 * smoothstep(1.0, 0.7, v) * (0.9 + 0.5 * patches) + 0.35 * smoothstep(0.3, 0.7, noise.noise(p.x * 1.5 + 3, p.z * 1.5)) * smoothstep(1, 0.85, v), 0, 1);
      const upness = smoothstep(0.1, 0.9, _n.y);
      const bright = clamp(upness * (0.5 + 0.5 * noise.noise(p.x * 1.1, p.z * 1.1 + 9)) + 0.35 * (disp / (0.3 * k)), 0, 1);
      // vertex colours multiply the light straw map (~0.48 linear): fresh lime moss on lit
      // cushions, deeper green in the hollows, golden straw at the fringe
      const straw: [number, number, number] = [1.05, 0.86, 0.5];
      const deep: [number, number, number] = [0.24, 0.4, 0.08];
      const sun: [number, number, number] = [0.74, 1.0, 0.18];
      const mossC = [lerp(deep[0], sun[0], bright), lerp(deep[1], sun[1], bright), lerp(deep[2], sun[2], bright)];
      out.color = [lerp(straw[0], mossC[0], m), lerp(straw[1], mossC[1], m), lerp(straw[2], mossC[2], m)];
    },
    { cols: roofRes, rows: Math.round(roofRes * 0.38), closedU: true },
  );
  // soffit: underside ring from the fringe back to the trunk top
  const soffit = gridSurface(
    (u, v, out) => {
      const a = u * TAU;
      const rimP = domeBase(a, phiMax);
      const inP = frame.at(a, rSmooth(a, H) - 0.05, H - 0.15);
      out.position.lerpVectors(rimP, inP, v);
      out.position.y -= (1 - v) * 0.3 * k;
      out.uv = [(a * domeR) / 1.6, v * 2];
      out.color = [0.4, 0.32, 0.18];
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
  const branchDefs: BranchDef[] = [
    { path: [[-2.35, 1.78], [-1.95, 1.1], [-1.35, 0.66], [-0.78, 0.56], [-0.36, 0.78], [-0.14, 1.12], [0.04, 1.5], [0.16, 1.9]], r0: 0.5, r1: 0.13, leavesAt: [1, 0.55] },
    { path: [[2.65, 1.7], [2.2, 0.95], [1.45, 0.38], [0.55, 0.42], [0.18, 0.9], [0.32, 1.32], [0.42, 1.62]], r0: 0.4, r1: 0.11, leavesAt: [1] },
    { path: [[-1.3, 1.62], [-1.05, 1.2], [-0.72, 1.02], [-0.5, 1.28], [-0.42, 1.62]], r0: 0.27, r1: 0.09, leavesAt: [1] },
    { path: [[1.35, 1.42], [1.05, 1.02], [0.9, 1.35], [0.98, 1.72], [1.1, 1.98]], r0: 0.26, r1: 0.09, leavesAt: [1] },
    { path: [[3.6, 1.75], [3.3, 1.2], [2.75, 0.75], [2.1, 0.6], [1.85, 0.95], [1.7, 1.3]], r0: 0.34, r1: 0.1, leavesAt: [1] },
  ];
  const foliage = new FoliageBuilder(rng.fork('foliage'), `${ctx.config.seed}/house/${def.id}`);
  const branchParts = [];
  for (let bi = 0; bi < branchDefs.length; bi++) {
    const b = branchDefs[bi];
    const pts = b.path.map(([a, phi], idx) => {
      const r = lerp(b.r0, b.r1, idx / (b.path.length - 1)) * k;
      // gnarl: wander sideways and lift a little off the moss between waypoints
      const lift = r * 0.5 + (branchRng() - 0.5) * 0.08 + (idx % 2 ? 0.06 : 0) * k;
      return surfacePoint(a + (branchRng() - 0.5) * 0.14, phi + (branchRng() - 0.5) * 0.06, lift);
    });
    const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const twist = branchRng() * 10;
    const geo = sweepTube(curve, {
      radius: (t) => lerp(b.r0, b.r1, t) * k * (1 + 0.14 * Math.sin(t * 9 + twist) + 0.08 * Math.sin(t * 23 + twist * 2)),
      tubularSegments: 48,
      radialSegments: 12,
      uvMetres: 1.2,
      displace: (t, ang, pos) => (noise.ridged(ang * 1.4 + t * 4 + bi, pos.y * 1.5, 2) - 0.5) * 0.07 * k,
      color: (t) => {
        const d = lerp(0.72, 0.9, t);
        return [d, d * 0.94, d * 0.86];
      },
      capEnd: true,
    });
    branchParts.push(geo);
    for (const at of b.leavesAt) {
      const p = curve.getPointAt(at);
      foliage.addLeafCluster(p, 0.6 * k, 34, { size: 0.19, amount: 0.06, droop: 0.55 });
      // a couple of short vines trail from each leafy tip
      const strands = 2;
      for (let s = 0; s < strands; s++) {
        const hook = p.clone().add(new Vector3((branchRng() - 0.5) * 0.4, -0.1, (branchRng() - 0.5) * 0.4));
        foliage.addHangingVine(hook, 0.45 + branchRng() * 0.55, { leafSize: 0.15, amount: 0.1 });
      }
    }
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
      color: (t) => (t > 0.985 ? [0.12, 0.1, 0.08] : [0.95, 0.92, 0.86]),
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
  const hanging = def.id === 'saria' ? 14 : 10;
  for (let i = 0; i < hanging; i++) {
    // spread over the front 250°, thinner directly above the door
    let a = -2.2 + (i / (hanging - 1)) * 4.4 + (vineRng() - 0.5) * 0.2;
    if (Math.abs(a) < 0.3) a += a < 0 ? -0.3 : 0.3;
    const hook = surfacePoint(a, phiMax - 0.03, -0.12);
    hook.y -= 0.25 * k;
    const len = (0.6 + vineRng() * 1.1) * (0.8 + 0.4 * Math.abs(Math.sin(a)));
    foliage.addHangingVine(hook, len * k, { leafSize: 0.16, amount: 0.1 });
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
    foliage.addSurfaceVine(pts, nrms, { leafSize: 0.17, amount: 0.02, leafEvery: 0.13 });
  }
  const tuftCount = def.id === 'saria' ? 34 : 22;
  for (let i = 0; i < tuftCount; i++) {
    const a = vineRng() * TAU;
    const phi = 0.12 + vineRng() * 1.05;
    const p = surfacePoint(a, phi, -0.03);
    const n = domeNormal(a, phi);
    const fern = vineRng() < 0.3;
    foliage.addTuft(p, n, (fern ? 0.42 : 0.3) * (0.8 + vineRng() * 0.5) * Math.sqrt(k), fern ? 1 : 0, 0.05);
  }

  // ---- pod lanterns on cords ----
  const lanterns: LanternRig[] = [];
  const lanternRng = rng.fork('lanterns');
  const specs = LANTERNS[def.id] ?? LANTERNS.upper;
  const podPositions: Vector3[] = [];
  for (const spec of specs.slice(0, Math.max(def.lanterns, specs.length))) {
    let hook: Vector3;
    if (spec.hook === 'rim') {
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
      foliage.addHangingVine(end.clone().add(new Vector3(0, 0.02, 0)), 0.5, { leafSize: 0.16, amount: 0.08 });
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

  return { group, bases, lanterns, lights, roots: rootCount, branches: branchDefs.length + 1, leaves: foliage.leafCount };
}
