import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { mat, type ColorKey } from '../core/palette';

/**
 * Sculpted minifig hair pieces: a thick moulded shell over the head, shaped per azimuth (face
 * opening, sideburns, nape) and carved with chunky locks and a parting — the look of a LEGO hair
 * element, generated as a smooth mesh so the glossy highlights run along the locks.
 * Head frame: y = 0 at the neck, head top at 1.08, head radius 0.6, face toward +Z.
 */
export interface HairSpec {
  key: ColorKey;
  /** hem heights (head units) in front of the face, at the sides, at the back */
  hemFront: number;
  hemSide: number;
  hemBack: number;
  /** half-angle (deg) of the face opening, and the angle (deg) by which the hem reaches hemSide */
  faceHalf: number;
  sideAt: number;
  /** outward flare of the hem (units) */
  flare: number;
  /** number of locks around, their depth, and how much they twist from crown to hem (turns) */
  locks: number;
  lockAmp: number;
  lockTwist: number;
  /** parting azimuth (deg, + = viewer's right = figure's left) and depth */
  partDeg: number;
  partDepth: number;
  /** fringe scallop depth over the forehead */
  fringe: number;
  /** extra height/volume at the front-top (quiff) */
  quiff: number;
  /** lateral sweep of the fringe (deg): locks over the forehead lean this way */
  sweepDeg: number;
  /** sideways shell radius and crown height */
  radius: number;
  crown: number;
  seed: number;
  /** individual fringe lock tips over the forehead: [azimuth deg, depth, width deg] */
  bangs: [number, number, number][];
}

export const ANAKIN_HAIR: HairSpec = {
  key: 'hairAnakin',
  hemFront: 1.0,
  hemSide: 0.02,
  hemBack: -0.12,
  faceHalf: 44,
  sideAt: 74,
  flare: 0.13,
  locks: 11,
  lockAmp: 0.065,
  lockTwist: 0.1,
  partDeg: -14,
  partDepth: 0.06,
  fringe: 0.0,
  quiff: 0.03,
  sweepDeg: 16,
  radius: 0.7,
  crown: 1.36,
  seed: 3,
  bangs: [[-48, 0.2, 14], [-26, 0.09, 12], [6, 0.13, 13], [30, 0.2, 13], [50, 0.26, 12]],
};

export const OBIWAN_HAIR: HairSpec = {
  key: 'hairObiwan',
  hemFront: 1.04,
  hemSide: 0.48,
  hemBack: 0.26,
  faceHalf: 46,
  sideAt: 80,
  flare: 0.03,
  locks: 13,
  lockAmp: 0.05,
  lockTwist: -0.25,
  partDeg: 38,
  partDepth: 0.05,
  fringe: 0.0,
  quiff: 0.09,
  sweepDeg: -22,
  radius: 0.68,
  crown: 1.36,
  seed: 5,
  bangs: [[-30, 0.07, 16], [-4, 0.05, 14], [22, 0.03, 12]],
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function hairMesh(spec: HairSpec, detail = 1): Mesh {
  const NT = Math.round(144 * detail);
  const NS = Math.round(44 * detail);
  const yEq = 0.74;
  const zc = -0.03;
  const a = spec.radius;
  const b = spec.crown - yEq;
  const thick = 0.1;
  // hem height as a function of azimuth θ (0 = front, ± toward the back)
  const hemY = (th: number) => {
    const d = Math.abs(((th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) * (180 / Math.PI);
    const front = spec.hemFront;
    const toSide = smooth(spec.faceHalf, spec.sideAt, d);
    const toBack = smooth(110, 170, d);
    let y = front + (spec.hemSide - front) * toSide;
    y = y + (spec.hemBack - spec.hemSide) * toBack;
    // individual lock tips hanging over the forehead / framing the face
    const deg = (th * 180) / Math.PI;
    for (const [c, depth, w] of spec.bangs) y -= depth * Math.exp(-Math.pow((deg - c) / w, 2));
    // fringe scallops over the forehead
    if (spec.fringe > 0 && d < spec.faceHalf + 10) {
      const u = (th * 180) / Math.PI + spec.sweepDeg * 0.5;
      const scallop = Math.pow(Math.abs(Math.sin((u / 360) * spec.locks * Math.PI * 1.4)), 0.8);
      y -= spec.fringe * scallop * (1 - smooth(spec.faceHalf - 8, spec.faceHalf + 10, d));
    }
    return y;
  };
  // quarter-ellipse arc length (numeric)
  let L1 = 0;
  {
    let px = 0, py = b;
    for (let i = 1; i <= 64; i++) {
      const ps = (i / 64) * (Math.PI / 2);
      const x = a * Math.sin(ps), y = b * Math.cos(ps);
      L1 += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
  }
  const ellipseAt = (s: number) => {
    // invert arc length approx by uniform parameter (good enough for a hair shell)
    const ps = Math.min(1, s / L1) * (Math.PI / 2);
    return { r: a * Math.sin(ps), y: yEq + b * Math.cos(ps), nr: Math.sin(ps) / a, ny: Math.cos(ps) / b };
  };
  const outer: number[] = [];
  const inner: number[] = [];
  const partRad = (spec.partDeg * Math.PI) / 180;
  for (let j = 0; j <= NS; j++) {
    for (let i = 0; i < NT; i++) {
      const th = (i / NT) * Math.PI * 2 - Math.PI;
      const yh = hemY(th);
      const L2 = Math.max(0, yEq - yh);
      let L = L2 > 0 ? L1 + L2 : 0;
      if (L2 === 0) {
        // hem above the equator: find the arc length where the ellipse reaches yh
        const c = Math.max(-1, Math.min(1, (yh - yEq) / b));
        L = (Math.acos(c) / (Math.PI / 2)) * L1;
      }
      const s = (j / NS) * L;
      let r: number, y: number, nr: number, ny: number;
      if (s <= L1) {
        const e = ellipseAt(s);
        r = e.r;
        y = e.y;
        const nl = Math.hypot(e.nr, e.ny);
        nr = e.nr / nl;
        ny = e.ny / nl;
      } else {
        const f = (s - L1) / Math.max(1e-6, L2);
        r = a + spec.flare * Math.pow(f, 1.6);
        y = yEq - (s - L1);
        nr = 1;
        ny = spec.flare * 0.6;
        const nl = Math.hypot(nr, ny);
        nr /= nl;
        ny /= nl;
      }
      const sn = j / NS;
      // chunky locks: rounded ridges with sharp grooves, twisting toward the hem
      const lockU = ((th + Math.PI) / (Math.PI * 2)) * spec.locks + spec.lockTwist * sn * spec.locks * 0.35 + Math.sin(th * 3 + spec.seed) * 0.32 + Math.sin(th * 7 + spec.seed * 2.1) * 0.16;
      const ridge = Math.pow(Math.abs(Math.sin(Math.PI * lockU)), 0.55);
      const lockW = 0.25 + 0.75 * smooth(0.05, 0.6, sn);
      let d = spec.lockAmp * (ridge - 0.5) * lockW;
      // parting groove near the crown/front
      const dp = Math.atan2(Math.sin(th - partRad), Math.cos(th - partRad));
      d -= spec.partDepth * Math.exp(-Math.pow(dp / 0.09, 2)) * (1 - smooth(0.2, 0.7, sn)) * (Math.abs(th) < 2.2 ? 1 : 0.3);
      // quiff at the front-top
      d += spec.quiff * Math.exp(-Math.pow(th / 0.8, 2)) * Math.exp(-Math.pow((sn - 0.35) / 0.25, 2));
      // curl the hem outward a touch
      d += 0.02 * smooth(0.85, 1.0, sn);
      const R = r + d * nr;
      const Y = y + d * ny;
      const sx = Math.sin(th), cz = Math.cos(th);
      outer.push(R * sx, Y, R * cz + zc);
      const Ri = Math.max(0.2, r - thick * nr);
      const Yi = y - thick * ny;
      inner.push(Ri * sx, Yi, Ri * cz + zc);
    }
  }
  const nv = NT * (NS + 1);
  const pos = new Float32Array(nv * 2 * 3);
  pos.set(outer, 0);
  pos.set(inner, nv * 3);
  const idx: number[] = [];
  const O = (i: number, j: number) => j * NT + (i % NT);
  const I = (i: number, j: number) => nv + j * NT + (i % NT);
  for (let j = 0; j < NS; j++) {
    for (let i = 0; i < NT; i++) {
      idx.push(O(i, j), O(i + 1, j + 1), O(i + 1, j), O(i, j), O(i, j + 1), O(i + 1, j + 1));
      idx.push(I(i, j), I(i + 1, j), I(i + 1, j + 1), I(i, j), I(i + 1, j + 1), I(i, j + 1));
    }
  }
  // hem lip joining outer and inner rims (faces down)
  for (let i = 0; i < NT; i++) {
    idx.push(O(i, NS), I(i + 1, NS), O(i + 1, NS), O(i, NS), I(i, NS), I(i + 1, NS));
  }
  // crown: collapse the j = 0 ring (all points coincide) — already degenerate triangles are harmless
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.getAttribute('normal').count;
  g.setAttribute('uv', new BufferAttribute(new Float32Array(n * 2), 2));
  const m = new Mesh(g, mat(spec.key, { plain: true }));
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = 'hair';
  return m;
}
