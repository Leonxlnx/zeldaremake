/**
 * Round 57 (expansion-ruins): the ivy on the great rock right of the stair. The reference's ruins
 * shot (r_036–r_043) drapes the rock's stair-side face in loose strands of large five-lobed leaves
 * hung from under its crown down to the mossy ledge, the grey rock showing between them.
 *
 * Here: strands walked over the rock as built (rock.ts `pillarSideR`) on its shaded south-east face,
 * the face the approach and the stair look at — most hanging from under the crown, some from its
 * ledges, a few climbing from the foot — each throwing a side shoot now and then and stopping on
 * whatever is under it (`floor`: the outcrop, the terrace's paving). Leaves alternate along them on
 * short stalks, faces turned out and a little up, tips hanging, in clumps with gaps between. One
 * builder, one draw.
 */
import { Vector3 } from 'three';
import { EXPANSION_RUINS } from '../layout';
import { PILLAR_BEDS } from '../terrain/ruins';
import { Noise2D, lerp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import { MeshBuilder, type RGB } from './geom';
import { ARCH_RING } from './masonry';
import { pillarSideR } from './rock';

const R = EXPANSION_RUINS;
/** the face the ivy covers: centred on the rock's shaded side toward the approach and the stair (rad), and its half width */
const FACE_A = 0.8;
const FACE_HALF = 1.35;
/** a strand's step over the rock (m), and how far it lies off it */
const STEP = 0.12;
const LIFT = 0.022;
/**
 * A Hedera leaf's outline: stalk notch at the origin, tip at v = 1, u across — counter-clockwise in
 * (u, v), which is the front seen from the face normal. Basal lobes, side lobes, a long central lobe.
 */
const LEAF: [number, number][] = [
  [0, 0.03],
  [0.17, -0.05],
  [0.4, 0.1],
  [0.5, 0.36],
  [0.3, 0.45],
  [0.21, 0.7],
  [0, 1],
  [-0.21, 0.7],
  [-0.3, 0.45],
  [-0.5, 0.36],
  [-0.4, 0.1],
  [-0.17, -0.05],
];
const LEAF_C: [number, number] = [0, 0.42];
const DARK: RGB = [0.04, 0.094, 0.024];
const MID: RGB = [0.085, 0.18, 0.034];
const BRIGHT: RGB = [0.14, 0.26, 0.042];
const YOUNG: RGB = [0.17, 0.29, 0.05];
const WOOD: RGB = [0.085, 0.066, 0.048];

const clumps = new Noise2D('ruins-ivy');

const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** one leaf: stalk notch at `at`, face toward `face`, tip toward `tip` (made square to the face); cupped, the midrib proud of the rim */
function ivyLeaf(mb: MeshBuilder, at: Vector3, tip: Vector3, face: Vector3, size: number, c: RGB): void {
  const n0 = face.clone().normalize();
  const d = tip.clone().addScaledVector(n0, -tip.dot(n0)).normalize();
  const w = d.clone().cross(n0);
  const P = (u: number, v: number, h: number) => at.clone().addScaledVector(w, u * size).addScaledVector(d, v * size).addScaledVector(n0, h);
  const centre = mb.vertex(P(LEAF_C[0], LEAF_C[1], 0.07 * size), n0, scale(c, 1.15));
  const rim = LEAF.map(([u, v]) => {
    const out = w.clone().multiplyScalar(u - LEAF_C[0]).addScaledVector(d, v - LEAF_C[1]).normalize();
    return mb.vertex(P(u, v, 0), n0.clone().addScaledVector(out, 0.45).normalize(), c);
  });
  for (let i = 0; i < rim.length; i++) mb.idx.push(centre, rim[i], rim[(i + 1) % rim.length]);
}

/** a stem along `pts`, a ribbon lying on the rock (facing `outs`), half width r0 → r1 — pressed flat to the face, a tube would only add its hidden side */
function stem(mb: MeshBuilder, pts: Vector3[], outs: Vector3[], r0: number, r1: number): void {
  if (pts.length < 2) return;
  const start = mb.vertexCount;
  for (let i = 0; i < pts.length; i++) {
    const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
    const n = outs[i].clone().addScaledVector(t, -outs[i].dot(t)).normalize();
    const b = t.clone().cross(n);
    const r = lerp(r0, r1, i / (pts.length - 1));
    mb.vertex(pts[i].clone().addScaledVector(b, -r), n, WOOD);
    mb.vertex(pts[i].clone().addScaledVector(b, r), n, WOOD);
  }
  // counter-clockwise seen from the face: b × t = n with b = t × n
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = start + i * 2;
    mb.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
}

export interface RuinsIvy {
  builder: MeshBuilder;
  strands: number;
  leaves: number;
}

/**
 * The leaves along one strand (`pts`, lying off the stone along `outs`; `dir` −1 hanging, +1
 * climbing): alternating every 9–14 cm, in clumps (`clump(i)`, noise −1…1), faces turned out and a
 * little up — `tilt(i)` scales how far a face may turn off the stone — tips hanging, smaller and
 * lighter toward the growing tip. `inside(q)` is how far a point of a leaf sits inside the stone
 * (m, ≤ 0 clear): a leaf that would dip a lobe in is lifted clear along its stem's normal.
 */
function dressStrand(mb: MeshBuilder, rng: Rng, pts: Vector3[], outs: Vector3[], dir: number, clump: (i: number) => number, tilt: (i: number) => number, inside: (q: Vector3, i: number) => number): number {
  let leaves = 0;
  let next = 0.04 + rng() * 0.07;
  let run = 0;
  let flank = rng() < 0.5 ? -1 : 1;
  for (let i = 1; i < pts.length; i++) {
    run += pts[i].distanceTo(pts[i - 1]);
    if (run < next) continue;
    next = run + 0.09 + rng() * 0.05;
    flank = -flank;
    const k = i / (pts.length - 1);
    if (rng() > 0.3 + 0.7 * smoothstep(-0.5, 0.3, clump(i))) continue;
    const n = outs[i];
    const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[i - 1]).normalize();
    const across = t.clone().cross(n).normalize().multiplyScalar(flank);
    const at = pts[i].clone().addScaledVector(n, 0.015 + rng() * 0.03).addScaledVector(across, 0.025 + rng() * 0.03);
    const tip = new Vector3(0, -1, 0).addScaledVector(across, 0.55).add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.5));
    const tl = tilt(i);
    const face = n.clone().add(new Vector3(0, 0.3 * tl, 0)).add(new Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.3 * tl));
    const young = dir < 0 ? k : 1 - k;
    const size = lerp(0.16, 0.26, rng()) * (1 - 0.3 * smoothstep(0.75, 1, young));
    {
      const f = face.clone().normalize();
      const d = tip.clone().addScaledVector(f, -tip.dot(f)).normalize();
      const w = d.clone().cross(f);
      let deficit = 0;
      for (const [u, v] of [
        [0, 1],
        [0.5, 0.36],
        [-0.5, 0.36],
      ]) {
        deficit = Math.max(deficit, inside(at.clone().addScaledVector(w, u * size).addScaledVector(d, v * size), i));
      }
      if (deficit > 0) at.addScaledVector(n, deficit);
    }
    const tone = rng();
    let c = tone < 0.5 ? mix(DARK, MID, tone * 2) : mix(MID, BRIGHT, (tone - 0.5) * 2);
    c = mix(c, YOUNG, 0.6 * smoothstep(0.8, 1, young));
    ivyLeaf(mb, at, tip, face, size, c);
    leaves++;
  }
  return leaves;
}

/**
 * The ivy over the rock's `span` (rock.ts `pillarSpan`), stopping `floor(x, z)` + a hand above
 * whatever is under it.
 */
export function buildIvy(rng: Rng, span: { y0: number; yTop: number }, floor: (x: number, z: number) => number): RuinsIvy {
  const P = R.pillar;
  const mb = new MeshBuilder();
  const side = (a: number, y: number) => {
    const r = pillarSideR(a, y, span);
    return new Vector3(P.x + Math.cos(a) * r, y, P.z + Math.sin(a) * r);
  };
  const normalAt = (a: number, y: number) => {
    const e = 0.03;
    const r = pillarSideR(a, y, span);
    const ta = side(a + e / r, y).sub(side(a - e / r, y));
    const ty = side(a, y + e).sub(side(a, y - e));
    const n = ta.cross(ty).normalize();
    if (n.x * Math.cos(a) + n.z * Math.sin(a) < 0) n.negate();
    return n;
  };
  const faceAngle = () => FACE_A + FACE_HALF * (rng() + rng() - 1);
  const offFace = (a: number) => Math.abs(a - FACE_A) > FACE_HALF + 0.2;
  let strands = 0;
  let leaves = 0;

  /** walk one strand from (a, y), `dir` −1 hanging or +1 climbing, up to `len` m; `lat` its sideways drift (m per m) */
  const grow = (a: number, y: number, len: number, dir: number, lat: number, main: boolean) => {
    const pts: Vector3[] = [];
    const outs: Vector3[] = [];
    const angles: number[] = [];
    const heights: number[] = [];
    const branches: [number, number, number, number][] = [];
    const steps = Math.max(2, Math.round(len / STEP));
    for (let s = 0; s <= steps; s++) {
      const n = normalAt(a, y);
      const p = side(a, y).addScaledVector(n, LIFT);
      if (y > span.yTop - 0.02 || p.y < floor(p.x, p.z) + 0.12 || offFace(a)) break;
      pts.push(p);
      outs.push(n);
      angles.push(a);
      heights.push(y);
      if (main && s > 3 && rng() < 0.06) branches.push([a, y, 0.5 + rng() * 1.4, (rng() < 0.5 ? -1 : 1) * (0.35 + rng() * 0.3)]);
      lat = lat * 0.86 + (rng() - 0.5) * 0.3;
      a += (lat * STEP) / pillarSideR(a, y, span);
      y += dir * STEP * (0.8 + 0.2 * rng());
    }
    if (pts.length < 3) return;
    strands++;
    stem(mb, pts, outs, main ? 0.013 : 0.009, 0.006);
    leaves += dressStrand(mb, rng, pts, outs, dir, (i) => clumps.noise(angles[i] * 4.2, heights[i] * 0.55), () => 1, (q) => 0.012 - (Math.hypot(q.x - P.x, q.z - P.z) - pillarSideR(Math.atan2(q.z - P.z, q.x - P.x), q.y, span)));
    for (const [ba, by, blen, blat] of branches) grow(ba, by, blen, dir, blat, false);
  };

  // hanging from under the crown, longest; from the ledges part way down; climbing from the foot
  for (let i = 0; i < 34; i++) grow(faceAngle(), span.yTop - 0.15 - rng() * 1.1, 4 + rng() * 6, -1, (rng() - 0.5) * 0.4, true);
  for (let i = 0; i < 18; i++) grow(faceAngle(), span.y0 + 0.6 + PILLAR_BEDS[1 + (i % (PILLAR_BEDS.length - 1))] + 0.12 + rng() * 0.25, 1.6 + rng() * 3.2, -1, (rng() - 0.5) * 0.4, true);
  for (let i = 0; i < 10; i++) {
    const a = faceAngle();
    const foot = side(a, span.y0 + 3);
    grow(a, floor(foot.x, foot.z) + 0.2, 1.2 + rng() * 2.6, 1, (rng() - 0.5) * 0.4, true);
  }
  return { builder: mb, strands, leaves };
}

/**
 * Ivy over the hero arch's ring (masonry.ts `ARCH_RING`), into `mb`: strands rooted part way across
 * the extrados that run over its top to one face, down the face, and past the intrados hang free in
 * the opening — the hanging leaves that soften it — more of them on the approach's (east) face and
 * toward the crown, none over the keystone's proud block. None hangs below the springing, 2.9 m
 * over the paving.
 */
export function hangArchIvy(rng: Rng, mb: MeshBuilder): { strands: number; leaves: number } {
  const A = R.arch;
  const G = ARCH_RING;
  /** the face's plane (x off the arch's axis): clear of every voussoir's face (≤ 0.29 m) */
  const FACE_X = G.half + 0.022;
  let strands = 0;
  let leaves = 0;
  const ringPoint = (x: number, a: number, r: number) => new Vector3(A.x + x, G.spring + r * Math.sin(a), A.z + r * Math.cos(a));
  /** the keystone's half angle, its pendant's top, the capitals' axis off the arch's centre (masonry.ts) */
  const KEY_HALF = Math.PI / 26;
  const yk = G.spring + G.r0 - 0.05;
  const capZ = G.r0 + A.columnR;
  for (let s = 0; s < 24; s++) {
    const sx = rng() < 0.62 ? 1 : -1;
    // 0.3 rad or more off the crown: a leaf's reach (≤ 0.3 m) short of the keystone's joints
    const u = rng() + rng() - 1;
    const a0 = Math.PI / 2 + Math.sign(u || 1) * (0.3 + 0.9 * Math.abs(u));
    const len = 0.9 + rng() * 1.9;
    const pts: Vector3[] = [];
    const outs: Vector3[] = [];
    const onFace: boolean[] = [];
    // over the top, from part way across to the face's edge, and round it
    const radial = new Vector3(0, Math.sin(a0), Math.cos(a0));
    for (let x = 0.04 + rng() * 0.14; x < FACE_X - 0.01; x += 0.07) {
      pts.push(ringPoint(sx * x, a0, G.r1 + 0.035));
      outs.push(radial.clone());
      onFace.push(false);
    }
    pts.push(ringPoint(sx * (FACE_X - 0.004), a0, G.r1 + 0.012));
    outs.push(new Vector3(sx, 0, 0).add(radial).normalize());
    onFace.push(false);
    // down the face; past the intrados, free in the opening
    const p = ringPoint(sx * FACE_X, a0, G.r1 - 0.03);
    let run = 0;
    let drift = (rng() - 0.5) * 0.1;
    while (run < len && p.y - G.spring > 0.05) {
      pts.push(p.clone());
      outs.push(new Vector3(sx, 0, 0));
      onFace.push(Math.hypot(p.z - A.z, p.y - G.spring) >= G.r0 - 0.01);
      const dy = STEP * (0.8 + 0.2 * rng());
      drift = drift * 0.8 + (rng() - 0.5) * 0.06;
      p.y -= dy;
      p.z += drift * dy;
      run += dy;
    }
    if (pts.length < 4) continue;
    strands++;
    stem(mb, pts, outs, 0.011, 0.005);
    // how far a leaf point sits inside the stone — the ring, the keystone, its pendant, a capital and
    // its abacus — out along the face's normal on the face, radially on the top
    const inside = (q: Vector3, i: number) => {
      const qx = Math.abs(q.x - A.x);
      const qz = q.z - A.z;
      const dy = q.y - G.spring;
      const faceSide = onFace[i] || Math.abs(outs[i].x) > 0.9;
      if (dy < 0.005) return dy > -0.4 && Math.abs(Math.abs(qz) - capZ) < 0.38 ? Math.max(0, 0.38 + 0.012 - qx) : 0;
      if (Math.hypot(qx, qz) < 0.17 && q.y > yk - 0.5 && q.y < yk + 0.03) return 0.17 + 0.012 - Math.hypot(qx, qz);
      const rho = Math.hypot(qz, dy);
      if (Math.abs(Math.atan2(dy, qz) - Math.PI / 2) < KEY_HALF + 0.015) {
        const kx = G.half + 0.04 - qx;
        const kr = Math.min(rho - G.r0 + 0.06, G.r1 + 0.18 - rho);
        return kx > 0 && kr > 0 ? (faceSide ? kx : kr) + 0.012 : 0;
      }
      const ex = G.half + 0.01 - qx;
      const er = Math.min(rho - G.r0 + 0.01, G.r1 + 0.03 - rho);
      if (dy < -0.02 || ex <= 0 || er <= 0) return 0;
      return (faceSide ? ex : er) + 0.012;
    };
    leaves += dressStrand(mb, rng, pts, outs, -1, (i) => clumps.noise(pts[i].z * 2.3 + sx * 5, pts[i].y * 1.1), (i) => (onFace[i] ? 0.35 : 1), inside);
  }
  return { strands, leaves };
}
