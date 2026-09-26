import {
  ClampToEdgeWrapping,
  DataTexture,
  FloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  RedFormat,
  RGBAFormat,
  RGFormat,
  UnsignedByteType,
  type Vector3,
} from 'three';
import { hash2, hash3 } from '../core/rng';
import { BLOCK, BLOCK_N, CLOUD_N, GRID_ANGLE, GRID_MIN, GRID_SPAN, SB_OFF, SHADE_N, SUPERW, TIER0_MIN, TOWER_N, TOWER_STYLES, Z_SHADE } from './planet-glsl';

/**
 * CPU-side layout of Coruscant, baked once into small textures: per-superblock district data
 * (exact, for the ray-cast city) and its filtered averages (for the far field), the mega-tower
 * list, a height-aware mega-tower shadow map and the large-scale cloud field.
 */

export interface Tower {
  /** centre in grid coordinates */
  cx: number;
  cy: number;
  /** base half size (studs) */
  hs: number;
  /** height of the top tier (studs) */
  h: number;
  round: boolean;
  style: number;
  /** colour scheme 0..3 and a free random */
  pal: number;
  seed: number;
}

export interface PlanetData {
  district: DataTexture;
  /** PALETTE_GLSL's wall (rows 0-3) and roof (rows 4-7) colour per scheme (row) and pick (column) */
  palette: DataTexture;
  farWall: DataTexture;
  farRoof: DataTexture;
  shade: DataTexture;
  cloud: DataTexture;
  towers: Tower[];
}

// LEGO palette (linear), mirrored from PALETTE_GLSL
const WHITE = [0.905, 0.905, 0.88];
const LBG = [0.366, 0.392, 0.407];
const DBG = [0.122, 0.133, 0.144];
const TAN = [0.745, 0.571, 0.305];
const DTAN = [0.301, 0.254, 0.171];
const SBLUE = [0.114, 0.175, 0.31];
const SGREEN = [0.275, 0.434, 0.329];
const BLACK = [0.016, 0.018, 0.021];
const DRED = [0.168, 0.012, 0.012];
const DBLUE = [0.01, 0.04, 0.12];
const DORANGE = [0.352, 0.1, 0.012];
const RBROWN = [0.155, 0.045, 0.02];
const WALLS = [
  [WHITE, LBG, WHITE, TAN],
  [TAN, DTAN, WHITE, RBROWN],
  [DBG, LBG, DTAN, LBG],
  [SBLUE, LBG, WHITE, SGREEN],
];
const ROOFS = [
  [LBG, DBG, LBG, TAN],
  [DTAN, DBG, DRED, TAN],
  [DBG, BLACK, LBG, DORANGE],
  [SBLUE, DBG, SGREEN, LBG],
];
/** plaza / park mix of open lots, as seen from far away */
const OPEN_MEAN = [0.16, 0.2, 0.13];
/** fraction of a facade that is glass (window bands), matching the near-field facade styles */
export const GLASS_FRAC = 0.42;
/** share of a block's lots painted in its dominant colour (the rest pick from the scheme's four) */
export const DOM_W = 0.45;
/** how often the other lots pick each of the scheme's colours: the first two are its neutrals */
export const PICK_W = [0.35, 0.35, 0.15, 0.15];
const GLASS = [0.03, 0.045, 0.07];

const mean = (cs: number[][]) => [0, 1, 2].map((k) => cs.reduce((s, c, i) => s + c[k] * PICK_W[i], 0));

/** fast deterministic 2D value noise in [0, 1] */
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash3(ix, iy, seed);
  const b = hash3(ix + 1, iy, seed);
  const c = hash3(ix, iy + 1, seed);
  const d = hash3(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number, seed: number, oct: number): number {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * vnoise(x, y, seed + o * 31);
    n += a;
    const nx = 1.62 * x - 1.18 * y + 3.1;
    y = 1.18 * x + 1.62 * y + 1.7;
    x = nx;
    a *= 0.5;
  }
  return s / n;
}

function makePalette(): DataTexture {
  const d = new Float32Array(4 * 8 * 4);
  [...WALLS, ...ROOFS].forEach((row, j) => row.forEach((c, i) => d.set([c[0], c[1], c[2], 1], (j * 4 + i) * 4)));
  const t = new DataTexture(d, 4, 8, RGBAFormat, FloatType);
  t.magFilter = t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

function makeTex(data: Uint8Array, n: number, format: typeof RGBAFormat | typeof RGFormat | typeof RedFormat, mips: boolean): DataTexture {
  const t = new DataTexture(data, n, n, format, UnsignedByteType);
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.magFilter = mips ? LinearFilter : NearestFilter;
  t.minFilter = mips ? LinearMipmapLinearFilter : NearestFilter;
  t.generateMipmaps = mips;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

export function bakePlanet(R: number, sunDir: Vector3): PlanetData {
  const N = TOWER_N;
  const GU = [Math.cos(GRID_ANGLE), Math.sin(GRID_ANGLE)];
  const GV = [-Math.sin(GRID_ANGLE), Math.cos(GRID_ANGLE)];

  // --- districts (superblocks): height scale, colour scheme, merge probability, open-lot fraction. Schemes come
  // from a warped low-frequency zone field, so a district of one character spans a dozen superblocks and its
  // edge wanders; nb is the share of its blocks that take the scheme's first neutral (neighbours agree).
  const hsOf = new Float32Array(N * N);
  const schemeOf = new Uint8Array(N * N);
  const mergeOf = new Float32Array(N * N);
  const openOf = new Float32Array(N * N);
  const nbOf = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const si = i - SB_OFF;
      const sj = j - SB_OFF;
      const town = fbm(si * 0.19 + 3.7, sj * 0.19 + 3.7, 11, 2);
      const big = vnoise(si * 0.06 + 1.3, sj * 0.06 + 8.1, 23);
      const r1 = hash3(si, sj, 101);
      hsOf[j * N + i] = Math.min(1, Math.max(0, r1 * 0.38 + town * town * 1.25 + (big - 0.5) * 0.55 - 0.12));
      const wx = si + 4 * (vnoise(si * 0.11 + 9.2, sj * 0.11 + 0.7, 33) - 0.5);
      const wy = sj + 4 * (vnoise(si * 0.11 + 2.6, sj * 0.11 + 6.3, 34) - 0.5);
      const zone = fbm(wx * 0.07 + 5.1, wy * 0.07 + 2.2, 31, 2) * 2.6 + (hash3(si, sj, 102) - 0.5) * 0.12;
      schemeOf[j * N + i] = Math.floor(((zone * 4) % 4) + 4) % 4;
      nbOf[j * N + i] = 0.15 + 0.7 * vnoise(si * 0.23 + 4.4, sj * 0.23 + 1.8, 35);
      mergeOf[j * N + i] = 0.15 + 0.45 * hash3(si, sj, 103);
      openOf[j * N + i] = hash3(si, sj, 104) < 0.08 ? 0.34 : 0.03;
    }
  }

  // --- blocks (4×4 lots): the neighbourhood data the city reads, and its filtered averages
  const BN = BLOCK_N;
  const block = new Uint8Array(BN * BN * 4);
  const farWall = new Uint8Array(BN * BN * 4);
  const farRoof = new Uint8Array(BN * BN * 4);
  const wallMeans = WALLS.map(mean);
  const roofMeans = ROOFS.map(mean);
  for (let bj = 0; bj < BN; bj++) {
    for (let bi = 0; bi < BN; bi++) {
      const d = (bj >> 2) * N + (bi >> 2);
      const bx = bi - 4 * SB_OFF;
      const by = bj - 4 * SB_OFF;
      let hs = Math.min(1, Math.max(0, hsOf[d] * (0.72 + 0.56 * hash3(bx, by, 301)) + (hash3(bx, by, 302) - 0.5) * 0.12));
      const sch = hash3(bx, by, 303) < 0.93 ? schemeOf[d] : Math.floor(hash3(bx, by, 304) * 4) % 4;
      let merge = Math.min(0.9, Math.max(0.05, mergeOf[d] + (hash3(bx, by, 305) - 0.5) * 0.2));
      let open = openOf[d];
      if (hash3(bx, by, 306) < 0.035) open = 0.5;
      // block-wide complexes: hangars, markets, landing fields
      const mega = open < 0.1 && hash3(bx, by, 307) < 0.06;
      if (mega) {
        merge = 1;
        open = 0;
      }
      // most lots of a block share its dominant colour, usually one of the scheme's neutrals (blocks
      // of saturated accents read as a patchwork quilt from orbit)
      const dom = (hash3(bx, by, 308) < 0.9 ? 0 : 2) + (hash3(bx, by, 309) < nbOf[d] ? 0 : 1);
      const k = (bj * BN + bi) * 4;
      block[k] = Math.round(hs * 255);
      block[k + 1] = Math.round(((sch * 4 + dom + 0.5) / 16) * 255);
      block[k + 2] = Math.round(merge * 255);
      block[k + 3] = Math.round(open * 255);
      if (mega) hs = 0.45;
      const w = [0, 1, 2].map((c) => DOM_W * WALLS[sch][dom][c] + (1 - DOM_W) * wallMeans[sch][c]);
      const rm = [0, 1, 2].map((c) => DOM_W * ROOFS[sch][dom][c] + (1 - DOM_W) * roofMeans[sch][c]);
      // open lots show plazas and parks instead of roofs
      const ro = [0, 1, 2].map((c) => rm[c] * (1 - open) + OPEN_MEAN[c] * open);
      for (let c = 0; c < 3; c++) {
        farWall[k + c] = Math.round(Math.min(1, w[c] * (1 - GLASS_FRAC) + GLASS[c] * GLASS_FRAC) * 255);
        farRoof[k + c] = Math.round(Math.min(1, ro[c]) * 255);
      }
      farWall[k + 3] = Math.round(hs * 255);
      farRoof[k + 3] = Math.round(open * 255);
    }
  }

  // --- mega-towers, kept off the avenues: one per superblock at most in the spread-out districts; the dense
  // cores add a cluster on block centres (a skyline with canyons between the towers), and the densest a spire
  // that pierces the cloud deck
  const towers: Tower[] = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const si = i - SB_OFF;
      const sj = j - SB_OFF;
      const hs = hsOf[j * N + i];
      const mine: Tower[] = [];
      const add = (T: Tower) => {
        for (const o of mine) if (Math.hypot(o.cx - T.cx, o.cy - T.cy) < (o.hs + T.hs) * 1.25 + 40) return;
        mine.push(T);
      };
      const style = (k: number) => Math.floor(hash3(si, sj, k) * TOWER_STYLES.length) % TOWER_STYLES.length;
      if (hash3(si, sj, 201) <= 0.04 + 0.5 * hs * hs) {
        const tall = hs > 0.72 && hash3(si, sj, 209) < 0.3;
        const half = tall ? 90 + 30 * hash3(si, sj, 202) : 44 + 52 * hash3(si, sj, 202);
        const h = tall ? 1500 + 700 * hash3(si, sj, 203) : (330 + 600 * Math.pow(hash3(si, sj, 203), 1.6)) * (0.55 + 0.45 * hs);
        const room = SUPERW / 2 - 70 - half;
        add({
          cx: (si + 0.5) * SUPERW + (hash3(si, sj, 204) * 2 - 1) * room,
          cy: (sj + 0.5) * SUPERW + (hash3(si, sj, 205) * 2 - 1) * room,
          hs: half,
          h,
          round: hash3(si, sj, 206) < 0.38,
          style: style(207),
          pal: Math.floor(hash3(si, sj, 208) * 4) % 4,
          seed: hash2(si * 17 + 3, sj * 29 + 7),
        });
      }
      const extra = hs < 0.42 ? 0 : Math.floor(Math.pow((hs - 0.42) / 0.58, 1.3) * 7 * (0.5 + hash3(si, sj, 210)));
      for (let k = 0; k < extra; k++) {
        const b = Math.floor(hash3(si, sj, 220 + k) * 16);
        const bi = b & 3;
        const bj = b >> 2;
        const half = 30 + 40 * hash3(si, sj, 240 + k);
        const room = BLOCK / 2 - 34 - half;
        add({
          cx: si * SUPERW + (bi + 0.5) * BLOCK + (hash3(si, sj, 260 + k) * 2 - 1) * room,
          cy: sj * SUPERW + (bj + 0.5) * BLOCK + (hash3(si, sj, 280 + k) * 2 - 1) * room,
          hs: half,
          h: (240 + 520 * Math.pow(hash3(si, sj, 300 + k), 1.4)) * (0.6 + 0.4 * hs),
          round: hash3(si, sj, 320 + k) < 0.3,
          style: style(340 + k),
          pal: Math.floor(hash3(si, sj, 360 + k) * 4) % 4,
          seed: hash2(si * 17 + 3 + k * 101, sj * 29 + 7 + k * 37),
        });
      }
      towers.push(...mine);
    }
  }

  // --- mega-tower shadow map: R = coverage, G = coverage * (altitude where the sun ray leaves the tower) / Z_SHADE
  const SN = SHADE_N;
  const texel = GRID_SPAN / SN;
  const shade = new Uint8Array(SN * SN * 2);
  const L = sunDir.clone().normalize();
  for (const T of towers) {
    const xz0 = T.cx * GU[0] + T.cy * GV[0];
    const xz1 = T.cx * GU[1] + T.cy * GV[1];
    const nx = xz0 / R;
    const nz = xz1 / R;
    const ny = Math.sqrt(Math.max(0, 1 - nx * nx - nz * nz));
    const muS = nx * L.x + ny * L.y + nz * L.z;
    if (muS < 0.015) continue;
    const ltx = L.x - nx * muS;
    const ltz = L.z - nz * muS;
    // grid displacement per unit altitude toward the sun
    const du = (ltx * GU[0] + ltz * GU[1]) / muS;
    const dv = (ltx * GV[0] + ltz * GV[1]) / muS;
    const dl = Math.hypot(du, dv);
    const st = TOWER_STYLES[T.style];
    for (let tier = 0; tier < 3; tier++) {
      const half = T.hs * st[tier * 2];
      const top = tier === 0 ? Math.max(st[1] * T.h, TIER0_MIN) : st[tier * 2 + 1] * T.h;
      bakeTierShadow(shade, SN, texel, T.cx, T.cy, half, T.round, top, du, dv, dl);
    }
  }

  // --- cloud field (large scales; the shader adds the fine ones)
  const CN = CLOUD_N;
  const ct = GRID_SPAN / CN;
  const cloud = new Uint8Array(CN * CN);
  const ca = Math.cos(0.4);
  const sa = Math.sin(0.4);
  for (let y = 0; y < CN; y++) {
    const gv = GRID_MIN + (y + 0.5) * ct;
    for (let x = 0; x < CN; x++) {
      const gu = GRID_MIN + (x + 0.5) * ct;
      // weather systems: where the decks are
      const w = fbm(gu / 26000 + 4.1, gv / 26000 + 1.9, 71, 2);
      // domain warp, then cumulus streets stretched along one direction
      const wx = gu + 2400 * (vnoise(gu / 11000, gv / 11000, 73) - 0.5);
      const wy = gv + 2400 * (vnoise(gu / 11000 + 7.3, gv / 11000 + 2.1, 74) - 0.5);
      const pu = (wx * ca + wy * sa) / 6800;
      const pv = (-wx * sa + wy * ca) / 3600;
      const c = fbm(pu, pv, 75, 4);
      const d = 0.5 + (c - 0.5) * 1.35 + (w - 0.5) * 0.85;
      cloud[y * CN + x] = Math.round(Math.min(1, Math.max(0, d)) * 255);
    }
  }

  return {
    district: makeTex(block, BN, RGBAFormat, false),
    palette: makePalette(),
    farWall: makeTex(farWall, BN, RGBAFormat, true),
    farRoof: makeTex(farRoof, BN, RGBAFormat, true),
    shade: makeTex(shade, SN, RGFormat, true),
    cloud: makeTex(cloud, CN, RedFormat, true),
    towers,
  };
}

/** convex hull (counter-clockwise) of a small point set, as flat [x0, y0, x1, y1, ...] */
function hull(pts: number[][]): number[][] {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: number[][] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: number[][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/**
 * Rasterise the ground shadow of one tier (a box or cylinder standing on the ground up to `top`)
 * for a sun that moves (du, dv) in grid units per unit of altitude.
 */
function bakeTierShadow(
  out: Uint8Array,
  SN: number,
  texel: number,
  cx: number,
  cy: number,
  half: number,
  round: boolean,
  top: number,
  du: number,
  dv: number,
  dl: number,
) {
  const LCAP = 6500;
  const FADE0 = 3800;
  const len = Math.min(top * dl, LCAP);
  const zTop = len / dl;
  const vx = (-du / dl) * len;
  const vy = (-dv / dl) * len;
  // outline of the swept footprint (circles approximated by 12-gons for the scan bounds)
  const base: number[][] = [];
  if (round) {
    const rr = half / Math.cos(Math.PI / 12) + texel;
    for (let k = 0; k < 12; k++) base.push([cx + rr * Math.cos((k * Math.PI) / 6), cy + rr * Math.sin((k * Math.PI) / 6)]);
  } else {
    const e = half + texel * 1.5;
    base.push([cx - e, cy - e], [cx + e, cy - e], [cx + e, cy + e], [cx - e, cy + e]);
  }
  const poly = hull(base.concat(base.map((q) => [q[0] + vx, q[1] + vy])));
  const segX = vx;
  const segY = vy;
  const segL2 = segX * segX + segY * segY;
  // swept square = convex hull of its corners at both ends; signed distance = max over the CCW edges
  const trueHull = round
    ? []
    : hull(
        [
          [cx - half, cy - half],
          [cx + half, cy - half],
          [cx + half, cy + half],
          [cx - half, cy + half],
        ].flatMap((q) => [q, [q[0] + vx, q[1] + vy]]),
      );
  const edges = trueHull.map((a, k) => {
    const b = trueHull[(k + 1) % trueHull.length];
    const el = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [a[0], a[1], (b[1] - a[1]) / el, -(b[0] - a[0]) / el];
  });
  const sdBox = (px: number, py: number) => {
    let best = -1e9;
    for (const e of edges) best = Math.max(best, (px - e[0]) * e[2] + (py - e[1]) * e[3]);
    return best;
  };
  const sdCap = (px: number, py: number) => {
    const qx = px - cx;
    const qy = py - cy;
    const t = segL2 > 0 ? Math.min(1, Math.max(0, (qx * segX + qy * segY) / segL2)) : 0;
    return Math.hypot(qx - segX * t, qy - segY * t) - half;
  };
  // ray from p toward the sun, p + s (du, dv): altitude interval inside an (enlarged) footprint
  const eh = half + texel;
  const rayHit = (px: number, py: number): number => {
    let sIn: number;
    let sOut: number;
    if (round) {
      const ox = px - cx;
      const oy = py - cy;
      const A = du * du + dv * dv;
      const B = ox * du + oy * dv;
      const C = ox * ox + oy * oy - eh * eh;
      const D = B * B - A * C;
      if (D < 0) return -1;
      const sq = Math.sqrt(D);
      sIn = (-B - sq) / A;
      sOut = (-B + sq) / A;
    } else {
      const ix = 1 / (Math.abs(du) < 1e-6 ? 1e-6 : du);
      const iy = 1 / (Math.abs(dv) < 1e-6 ? 1e-6 : dv);
      const ax = (cx - eh - px) * ix;
      const bx = (cx + eh - px) * ix;
      const ay = (cy - eh - py) * iy;
      const by = (cy + eh - py) * iy;
      sIn = Math.max(Math.min(ax, bx), Math.min(ay, by));
      sOut = Math.min(Math.max(ax, bx), Math.max(ay, by));
    }
    if (sOut < 0 || sIn > sOut) return -1;
    if (Math.max(sIn, 0) >= zTop) return -1;
    return Math.min(sOut, zTop);
  };
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const q of poly) {
    y0 = Math.min(y0, q[1]);
    y1 = Math.max(y1, q[1]);
  }
  const ty0 = Math.max(0, Math.floor((y0 - GRID_MIN) / texel - 0.5));
  const ty1 = Math.min(SN - 1, Math.ceil((y1 - GRID_MIN) / texel - 0.5));
  for (let ty = ty0; ty <= ty1; ty++) {
    const py = GRID_MIN + (ty + 0.5) * texel;
    // x extent of the outline on this row
    let xa = Infinity;
    let xb = -Infinity;
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k];
      const b = poly[(k + 1) % poly.length];
      if ((a[1] <= py && b[1] >= py) || (b[1] <= py && a[1] >= py)) {
        const t = b[1] !== a[1] ? (py - a[1]) / (b[1] - a[1]) : 0;
        const x = a[0] + (b[0] - a[0]) * t;
        xa = Math.min(xa, x);
        xb = Math.max(xb, x);
      }
    }
    if (xa > xb) continue;
    const tx0 = Math.max(0, Math.floor((xa - GRID_MIN) / texel - 0.5));
    const tx1 = Math.min(SN - 1, Math.ceil((xb - GRID_MIN) / texel - 0.5));
    for (let tx = tx0; tx <= tx1; tx++) {
      const px = GRID_MIN + (tx + 0.5) * texel;
      const sd = round ? sdCap(px, py) : sdBox(px, py);
      const cov0 = Math.min(1, Math.max(0, 0.5 - sd / texel));
      if (cov0 <= 0) continue;
      const zOut = rayHit(px, py);
      if (zOut < 0) continue;
      // fade the far end of long shadows (penumbra widening, dimmer grazing sun)
      const along = Math.max(0, ((px - cx) * -du + (py - cy) * -dv) / dl);
      const cov = cov0 * (1 - smooth(FADE0, LCAP, along));
      const k = (ty * SN + tx) * 2;
      const r = Math.round(cov * 255);
      const g = Math.round(((cov * Math.min(zOut, Z_SHADE)) / Z_SHADE) * 255);
      if (r > out[k]) out[k] = r;
      if (g > out[k + 1]) out[k + 1] = g;
    }
  }
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
