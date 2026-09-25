import { Group, Mesh, Object3D, Vector3, type Material } from 'three';
import { Builder, PLATE } from '../core/builder';
import type { ColorKey } from '../core/palette';
import { hash3, Rng } from '../core/rng';
import type { CapitalShip } from './types';
import { anchorFrom, bar, flatQuad, frameFwd, greeblePatch, loft, sideProfile, surf, thList, withFrame, type Sec, type TileCtx, type TileSpec } from './d-kit';

/**
 * Munificent-class star frigate (Banking Clan) as a macro-scale LEGO display build: 288 studs long
 * with ×8 pushed (2304 units), bow +Z, port +X. A big split dome forward (the two clam shells, each
 * skinned in overlapping petals that step down toward the rim, drawn out into the bow prongs), a
 * smaller split dome aft with the stern prongs, the narrow midsection neck carrying the lateral
 * comm arms and docking hooks, the hyperwave mast through the aft trench, the stacked command
 * bridge, the prow cannon between the prongs, a dark keel and the engine cluster in the stern band.
 */

const S = 8;

interface Q {
  lod: 0 | 1 | 2;
  step: number;
  fN: number;
  aN: number;
  kN: number;
  mN: number;
  wid: number;
  lens: number[];
  flat: boolean;
  studs: boolean;
  greeble: boolean;
  /** separate rib strips on the petal edges (otherwise the petals just step) */
  ribs: boolean;
  windows: boolean;
  radial: number;
  c: number;
}

const QS: Record<0 | 1 | 2, Q> = {
  0: { lod: 0, step: 6, fN: 26, aN: 20, kN: 20, mN: 18, wid: 2.6, lens: [3, 4, 4, 6, 8], flat: false, studs: true, greeble: true, ribs: true, windows: true, radial: 24, c: 0.06 },
  1: { lod: 1, step: 9, fN: 16, aN: 12, kN: 12, mN: 10, wid: 4, lens: [6, 8, 10], flat: true, studs: false, greeble: false, ribs: true, windows: true, radial: 14, c: 0 },
  2: { lod: 2, step: 14, fN: 10, aN: 7, kN: 8, mN: 6, wid: 7, lens: [14], flat: true, studs: false, greeble: false, ribs: false, windows: false, radial: 8, c: 0 },
};

/* --- hull sections --------------------------------------------------------------------------- */

/** Superellipse falloff: 1 at t = 0, 0 at t = 1. */
const se = (t: number, p: number): number => Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.max(0, t)), p)), 1 / p);

const FZ0 = -4;
const FZK = 30;
const FZ1 = 144;
/** Forward shell, port half (offset by x0 = trench half width); steep domed rear, long bow taper. */
function fwdSec(z: number): Sec {
  const u = z > FZK ? (z - FZK) / (FZ1 - FZK) : 0;
  const v = z < FZK ? (FZK - z) / (FZK - FZ0) : 0;
  const r = se(v, 4);
  return {
    z,
    a: Math.max(0.3, 25 * se(u, 1.8) * r),
    b: Math.max(0.3, 14 * se(u, 1.5) * r),
    bb: Math.max(0.4, 7 * (1 - 0.6 * u) * r),
    x0: 6 - 3.4 * u * u,
    y0: 4 - 1.5 * u,
    n: 2.2,
    nb: 2,
  };
}

const AZ0 = -144;
const AZK = -60;
const AZ1 = -50;
/** Aft shell, port half: steep front face, prongs toward the stern. */
function aftSec(z: number): Sec {
  const u = z < AZK ? (AZK - z) / (AZK - AZ0) : 0;
  const v = z > AZK ? (z - AZK) / (AZ1 - AZK) : 0;
  const r = se(v, 4);
  return {
    z,
    a: Math.max(0.3, 17 * se(u, 2.2) * r),
    b: Math.max(0.3, 9 * se(u, 2.5) * r),
    bb: Math.max(0.4, 5.5 * (1 - 0.5 * u) * r),
    x0: 4.5 + 1.2 * u,
    y0: 3.5 - 1.2 * u,
    n: 2.2,
    nb: 2,
  };
}

function stations(fn: (z: number) => Sec, z0: number, z1: number, step: number, extra: number[]): Sec[] {
  const zs = new Set<number>();
  for (let z = z0; z < z1 - 0.01; z += step) zs.add(+z.toFixed(3));
  zs.add(z1);
  for (const z of extra) if (z > z0 + 0.2 && z < z1 - 0.2) zs.add(z);
  return [...zs].sort((a, b) => a - b).map(fn);
}

const KEEL: Sec[] = [
  { z: -120, a: 1.2, b: 0.8, bb: 1.2, y0: -6 },
  { z: -112, a: 4, b: 2.5, bb: 3.5, y0: -7 },
  { z: -98, a: 7, b: 4, bb: 6, y0: -8 },
  { z: -75, a: 9, b: 5, bb: 8, y0: -9 },
  { z: -40, a: 10, b: 5.5, bb: 9, y0: -9.5 },
  { z: 0, a: 10, b: 5.5, bb: 8.5, y0: -9.5 },
  { z: 40, a: 9, b: 5, bb: 7.5, y0: -9 },
  { z: 76, a: 7, b: 4.5, bb: 6, y0: -8 },
  { z: 102, a: 4.6, b: 3.5, bb: 4, y0: -7 },
  { z: 116, a: 2.4, b: 2.2, bb: 2.4, y0: -6 },
  { z: 122, a: 0.9, b: 0.8, bb: 0.9, y0: -5.5 },
].map((s) => ({ n: 2.4, nb: 2.2, ...s }));

const MIDS: Sec[] = [
  { z: -54, a: 12.5, b: 8.5, bb: 6.5, y0: 2.5 },
  { z: -42, a: 11.5, b: 8, bb: 6.5, y0: 2.5 },
  { z: -14, a: 11.5, b: 8, bb: 6.5, y0: 2.5 },
  { z: -2, a: 12.5, b: 8.5, bb: 6.5, y0: 2.5 },
].map((s) => ({ n: 3, nb: 2.6, ...s }));

/** Resample a station list at a spacing (keeps the original stations). */
function resample(secs: Sec[], step: number): Sec[] {
  const out: Sec[] = [];
  for (let i = 0; i < secs.length - 1; i++) {
    const p = secs[i];
    const q = secs[i + 1];
    const n = Math.max(1, Math.round((q.z - p.z) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const L = (x: number, y: number) => x + (y - x) * t;
      out.push({ z: L(p.z, q.z), a: L(p.a, q.a), b: L(p.b, q.b), bb: L(p.bb ?? p.b, q.bb ?? q.b), x0: 0, y0: L(p.y0 ?? 0, q.y0 ?? 0), n: p.n, nb: p.nb });
    }
  }
  out.push({ ...secs[secs.length - 1] });
  return out;
}

/* --- livery and petals (θ on the shell sections: 0 = trench rim / crest, π/2 = widest) --------- */

const RIM = 0.07;
const RIB_W = 0.04;
const F_TE = Math.PI * 0.7;
const A_TE = Math.PI * 0.72;
const F_STRIPES: [number, number][] = [[0.6, 0.72], [1.1, 1.22]];
const F_RIBS = [0.42, 0.9, 1.42, 1.84];
const A_STRIPES: [number, number][] = [[0.92, 1.04]];
const A_RIBS = [0.5, 1.3, 1.86];
const KEEL_WIN: [number, number] = [1.2, 1.36];
/** Each petal overlaps the one below it by this much (plates). */
const STEP = 2;

const bandOf = (th: number, ribs: number[]): number => ribs.reduce((k, r) => (th > r ? k + 1 : k), 0);
const bandT = (th: number, ribs: number[]): number => PLATE * (1 + STEP * (ribs.length - bandOf(th, ribs)));
/** Height of the rim tiles above the loft crest. */
const rimT = (ribs: number[]): number => PLATE * (2 + STEP * ribs.length);

function shellThs(q: Q, N: number, te: number, stripes: [number, number][], ribs: number[]): number[] {
  const br = [RIM, ...stripes.flat(), ...(q.ribs ? ribs.flatMap((r) => [r - RIB_W, r + RIB_W]) : ribs)];
  return thList(N, br, 0, te);
}

const inR = (th: number, rs: [number, number][]): boolean => rs.some(([a, b]) => th > a && th < b);
const onRib = (th: number, ribs: number[]): boolean => ribs.some((r) => Math.abs(th - r) < RIB_W);
const h3 = (v: Vector3, s = 0): number => hash3(Math.round(v.x * 4) + s * 131, Math.round(v.y * 4), Math.round(v.z * 4));
/** Plates are laid in rectangular sections: 14 studs along, ~0.4 rad across. */
const zoneHash = (z: number, th: number, s: number): number => hash3(Math.floor((z + 200) / 14), Math.floor(th * 2.6), s);

function tileLen(q: Q, s: number) {
  return (c: Vector3): number => q.lens[Math.floor(h3(c, s) * q.lens.length)];
}

/** Window lights along a trench tile (tile frame: X across, Z along). */
function windowsAlong(b: Builder, t: TileCtx, y: number, lit: number, seed: number): void {
  const pitch = 1.1;
  const cnt = Math.max(1, Math.floor(t.l / pitch));
  for (let i = 0; i < cnt; i++) {
    const z = -t.l / 2 + (i + 0.5) * (t.l / cnt);
    if (hash3(Math.round(t.c.x * 5), Math.round((t.c.z + z) * 3), seed) < lit) flatQuad(b, 'windowWarm', 0, y, z, Math.min(0.6, t.w * 0.55), 0.55);
  }
}

function shellSpec(q: Q, seed: number, stripes: [number, number][], ribs: number[], te: number, ths: number[]) {
  const facetT = (j: number): number => {
    if (j < 0 || j >= ths.length - 1) return 0;
    const th = (ths[j] + ths[j + 1]) / 2;
    if (th < RIM || (q.ribs && onRib(th, ribs))) return bandT(th, ribs) + PLATE;
    return bandT(th, ribs);
  };
  const ft = ths.slice(0, -1).map((_, j) => facetT(j));
  return (t: TileCtx): TileSpec | null => {
    const { c, n, th, j } = t;
    const hx = h3(c, seed);
    const hy = h3(c, seed + 3);
    const tj = ft[j];
    const walls = { px: t.col === t.cols - 1 && tj > (ft[j + 1] ?? 0) + 1e-4, nx: t.col === 0 && tj > (ft[j - 1] ?? 0) + 1e-4 };
    if (th < RIM) return { key: 'lbg', t: tj, walls };
    if (q.ribs && onRib(th, ribs)) return { key: 'dbg', t: tj, walls };
    if (inR(th, stripes)) return { key: hx < 0.05 ? 'darkRed' : 'reddishBrown', t: tj, walls };
    const zh = zoneHash(c.z, th, seed);
    let key: ColorKey = zh < (th > te - 0.55 ? 0.45 : 0.15) ? 'darkTan' : 'tan';
    if (hx < 0.035) key = key === 'tan' ? 'darkTan' : 'tan';
    if (hy > 0.987) key = 'lbg';
    const raised = !q.flat && hy < 0.05;
    const spec: TileSpec = { key, t: tj + (raised ? PLATE : 0), walls };
    if (q.studs && n.y > 0.75 && hy > 0.1 && hy < 0.14) spec.studs = true;
    if (q.greeble && n.y > 0.45 && hx > 0.6 && hx < 0.612 && t.l > 1.8) {
      spec.fill = (b, tc) => {
        b.push();
        b.translate(0, spec.t!, 0);
        greeblePatch(b, new Rng(Math.floor(hx * 1e6)), tc.w, tc.l, ['dbg', 'darkTan', 'lbg'], { density: 0.4 });
        b.pop();
      };
    }
    return spec;
  };
}

function keelSpec(q: Q, seed: number) {
  return (t: TileCtx): TileSpec | null => {
    const { c, n, th } = t;
    const tm = th > Math.PI ? Math.PI * 2 - th : th;
    const hx = h3(c, seed + 11);
    if (tm > KEEL_WIN[0] && tm < KEEL_WIN[1]) {
      if (q.lod === 2) return { key: 'black', t: 0.16, fill: hx < 0.5 ? (b, tc) => flatQuad(b, 'windowWarm', 0, 0.17, 0, tc.w * 0.3, tc.l * 0.7) : undefined };
      return { key: 'black', t: 0.16, fill: (b, tc) => windowsAlong(b, tc, 0.17, 0.55, seed) };
    }
    const zh = zoneHash(c.z, tm, seed + 5);
    let key: ColorKey = n.y < -0.4 ? (zh < 0.6 ? 'darkBrown' : zh < 0.85 ? 'dbg' : 'darkTan') : zh < 0.2 ? 'dbg' : zh < 0.6 ? 'darkTan' : 'darkBrown';
    if (hx < 0.04) key = key === 'dbg' ? 'darkTan' : 'dbg';
    if (n.y > -0.4 && hx > 0.97) key = 'reddishBrown';
    return { key, t: PLATE };
  };
}

function midSpec(q: Q, seed: number) {
  return (t: TileCtx): TileSpec | null => {
    const { c, n } = t;
    const hx = h3(c, seed + 21);
    const zh = zoneHash(c.z, t.th, seed + 7);
    let key: ColorKey = zh < 0.35 ? 'reddishBrown' : zh < 0.7 ? 'darkTan' : 'dbg';
    if (hx < 0.05) key = 'dbg';
    const spec: TileSpec = { key, t: !q.flat && hx > 0.9 ? PLATE * 2 : PLATE };
    if (q.greeble && n.y > 0.3 && hx > 0.4 && hx < 0.46) {
      spec.fill = (b, tc) => {
        b.push();
        b.translate(0, spec.t!, 0);
        greeblePatch(b, new Rng(Math.floor(hx * 1e6)), tc.w, tc.l, ['dbg', 'gunmetal', 'lbg', 'darkTan'], { density: 0.45 });
        b.pop();
      };
    }
    return spec;
  };
}

/* --- builders -------------------------------------------------------------------------------- */

function mk(q: Q, seed: number): Builder {
  const b = new Builder({ seed, studSegments: q.lod ? 6 : 8, uvScale: 0.11 / S, tint: 0.05, chamfer: q.c });
  b.scale(S);
  return b;
}

/**
 * One shell half (port; the caller mirrors for starboard). Toward the prong tip the lower petals
 * stop short of the upper ones (`fan`: distance from the tip per petal), fanning the prongs out.
 */
function shell(b: Builder, q: Q, secs: Sec[], N: number, te: number, stripes: [number, number][], ribs: number[], seed: number, fan: { tip: number; dir: number; d: number[] }, zr: { zMin?: number; zMax?: number } = {}): void {
  const ths = shellThs(q, N, te, stripes, ribs);
  const fanD = ths.slice(0, -1).map((t0, j) => fan.d[Math.min(fan.d.length - 1, bandOf((t0 + ths[j + 1]) / 2, ribs))]);
  loft(b, secs, {
    ...zr,
    ths,
    cut: (j, z) => (fan.tip - z) * fan.dir < fanD[j],
    tileLen: tileLen(q, seed),
    tileWid: q.wid,
    spec: shellSpec(q, seed, stripes, ribs, te, ths),
    core: 'black',
    inner: { key: 'darkBrown', inset: 1.1 },
    // LOD0: the underside petals (only seen from below) are cheap flat plates
    flat: q.flat ? true : (_c, n) => n.y < -0.2,
  });
}

/** Solid dark body filling a shell's interior (seen through the open underside). */
function innerBody(b: Builder, secs: Sec[], N: number): void {
  const body = secs.map((s) => ({ ...s, x0: 0, a: Math.max(0.2, (s.x0 ?? 0) + s.a - 4.2), b: Math.max(0.2, s.b - 3.6), bb: Math.max(0.2, (s.bb ?? s.b) + 1), n: 2.4, nb: 2.4 }));
  loft(b, body, { N, tileLen: 99, tileWid: 99, spec: () => null, core: 'darkBrown', capStart: 'darkBrown', capEnd: 'darkBrown' });
}

/** Top of the forward / aft rim tiles at z. */
const fCrest = (z: number): number => (fwdSec(z).y0 ?? 0) + fwdSec(z).b + rimT(F_RIBS);
const aCrest = (z: number): number => (aftSec(z).y0 ?? 0) + aftSec(z).b + rimT(A_RIBS);

/** Blocks of the dorsal superstructure in a trench from z0 to z1, rising around the crest line. */
function spine(b: Builder, q: Q, rng: Rng, z0: number, z1: number, hw: number, top: (z: number) => number, y0: number): void {
  let z = z0;
  while (z < z1 - 0.5) {
    const len = Math.min(z1 - z, rng.pick([6, 8, 10, 12]));
    const zc = z + len / 2;
    const crest = top(zc);
    const yt = crest + rng.range(-2.5, 1.8);
    const w = hw * 2 - rng.pick([0, 0, 1.2]);
    b.box(rng.chance(0.3) ? 'dbg' : 'lbg', 0, (y0 + yt) / 2, zc, w, yt - y0, len - 0.2);
    b.box('dbg', 0, yt + 0.2, zc, w - 1.2, 0.4, len - 1.2);
    for (const s of [-1, 1]) {
      const x = s * (w / 2 + 0.01);
      if (q.windows) {
        for (let r = 0; r < 3; r++) {
          const y = yt - 1.4 - r * 2.2;
          if (y < crest - 1.5) break;
          b.box('black', x - s * 0.05, y, zc, 0.2, 1.1, len - 1.4);
          const cnt = Math.floor((len - 1.4) / 1.1);
          for (let i = 0; i < cnt; i++) {
            if (!rng.chance(0.6)) continue;
            b.push();
            b.translate(x + s * 0.06, y, zc - (len - 1.4) / 2 + (i + 0.5) * ((len - 1.4) / cnt));
            b.rotateZ((-s * Math.PI) / 2);
            flatQuad(b, 'windowWarm', 0, 0, 0, 0.65, 0.6);
            b.pop();
          }
        }
      } else if (yt - 1.4 > crest - 1.5) {
        b.push();
        b.translate(x + s * 0.02, yt - 1.4, zc);
        b.rotateZ((-s * Math.PI) / 2);
        flatQuad(b, 'windowWarm', 0, 0, 0, 0.8, len - 2);
        b.pop();
      }
    }
    if (q.greeble && len > 6 && rng.chance(0.6)) {
      b.push();
      b.translate(0, yt + 0.4, zc);
      greeblePatch(b, rng, w - 1.6, len - 1.6, ['dbg', 'lbg', 'gunmetal', 'darkTan'], { density: 0.3 });
      b.pop();
    } else if (q.lod === 1 && rng.chance(0.5)) {
      b.box('lbg', rng.range(-1.5, 1.5), yt + 1, zc, 2.4, 1.2, len * 0.4);
    }
    if (rng.chance(0.3)) mast(b, q, rng, rng.range(-2, 2), yt + 0.4, zc, rng.range(3, 8));
    z += len;
  }
}

function mast(b: Builder, q: Q, rng: Rng, x: number, y: number, z: number, h: number): void {
  bar(b, 'lbg', [x, y, z], [x, y + h, z], 0.18, { radial: q.lod < 2 ? 6 : 4 });
  if (q.lod < 2) {
    bar(b, 'dbg', [x, y + h * 0.45, z], [x, y + h * 0.75, z], 0.28, { radial: 6 });
    if (rng.chance(0.5)) bar(b, 'lbg', [x - 1.1, y + h * 0.7, z], [x + 1.1, y + h * 0.7, z], 0.1, { radial: 5 });
  }
  b.cyl('glowRed', x, y + h + 0.1, z, 0.22, 0.2, { radial: 6 });
}

/** Oval deck (lathe scaled along z) with an optional window band. */
function ovalDeck(b: Builder, q: Q, key: ColorKey, z: number, y0: number, h: number, rx: number, rz: number, win: boolean, rng: Rng): void {
  const sz = rz / rx;
  b.push();
  b.translate(0, 0, z);
  b.scale(1, 1, sz);
  b.lathe(key, [[0, y0 + h, 0, 1, rx, y0 + h, 0, 1], [rx, y0 + h, 1, 0, rx, y0, 1, 0], [rx, y0, 0, -1, 0, y0, 0, -1]], { radial: q.radial });
  if (win) {
    const wy0 = y0 + h * 0.3;
    const wy1 = y0 + h * 0.78;
    b.lathe(q.windows ? 'black' : 'windowWarm', [[rx + 0.08, wy1, 1, 0, rx + 0.08, wy0, 1, 0]], { radial: q.radial });
  }
  b.pop();
  if (win && q.windows) {
    const cnt = Math.round((Math.PI * (rx + rz)) / 1.3);
    for (let i = 0; i < cnt; i++) {
      if (!rng.chance(0.7)) continue;
      const ph = (i / cnt) * Math.PI * 2;
      const p = new Vector3(Math.sin(ph) * (rx + 0.1), y0 + h * 0.54, z + Math.cos(ph) * (rz + 0.1 * sz));
      const n = new Vector3(Math.sin(ph) / rx, 0, Math.cos(ph) / rz).normalize();
      withFrame(b, frameFwd(p, n, new Vector3(0, 1, 0)), () => flatQuad(b, 'windowWarm', 0, 0, 0, 0.7, h * 0.36));
    }
  }
}

/** The command bridge: pylon out of the trench, four stacked oval decks widening upward, masts. */
function tower(b: Builder, q: Q, rng: Rng, z: number, yb: number): number {
  const y1 = 24;
  b.box('lbg', 0, (yb + y1) / 2, z, 8, y1 - yb, 16);
  b.box('dbg', 0, (yb + y1) / 2, z - 7.2, 6, y1 - yb, 2);
  if (q.windows) {
    for (const s of [-1, 1]) {
      b.box('black', s * 4.02, y1 - 2, z, 0.1, 1.2, 12);
      for (let i = 0; i < 9; i++) if (rng.chance(0.7)) {
        b.push();
        b.translate(s * 4.1, y1 - 2, z - 5.4 + i * 1.35);
        b.rotateZ((-s * Math.PI) / 2);
        flatQuad(b, 'windowWarm', 0, 0, 0, 0.7, 0.8);
        b.pop();
      }
    }
  }
  const decks: [number, number, number, number, ColorKey][] = [
    [y1, 2.2, 7, 10, 'lbg'],
    [y1 + 2.2, 2.2, 8.2, 11.5, 'tan'],
    [y1 + 4.4, 2.2, 9.4, 13, 'lbg'],
    [y1 + 6.6, 1.8, 10.6, 14.5, 'tan'],
  ];
  for (const [y0, h, rx, rz, k] of decks) ovalDeck(b, q, k, z, y0, h, rx, rz, true, rng);
  const yc = y1 + 8.4;
  ovalDeck(b, q, 'dbg', z, yc, 0.8, 9.8, 13.6, false, rng);
  ovalDeck(b, q, 'lbg', z - 1, yc + 0.8, 1.4, 5, 7, q.lod < 2, rng);
  const yt = yc + 2.2;
  b.lathe('dbg', [[0, yt + 1, 0, 1, 2.6, yt, 0.5, 0.8], [2.6, yt, 1, 0, 2.6, yt - 0.1, 1, 0]], { radial: q.radial, at: [0, 0, z + 2] });
  const masts: [number, number, number][] = [[0, 2, 8], [2.2, -3, 5], [-2.2, -3, 5.5], [0, -5.5, 4], [3.5, 3.5, 3]];
  for (const [x, dz, h] of masts) mast(b, q, rng, x, yt, z + dz, h);
  if (q.lod < 2) {
    b.cyl('lbg', 4.5, yt + 1.3, z - 4, 1.4, 0.2, { axis: 'z', radial: 12 });
    bar(b, 'dbg', [4.5, yt, z - 4], [4.5, yt + 1.2, z - 4], 0.12, { radial: 5 });
  }
  return yt;
}

/** Hyperwave comm mast through the aft trench: tall slab with stacked slats above and below. */
function commMast(b: Builder, q: Q, rng: Rng, z: number): void {
  const L = 18;
  const T = 3.6;
  for (const [ya, yb] of [[9, 36], [-44, -12]] as const) {
    b.box('darkTan', 0, (ya + yb) / 2, z, T, yb - ya, L);
    for (let y = ya + 1.6; y < yb - 1; y += q.lod === 2 ? 4.8 : 2.4) {
      const k: ColorKey = Math.round((y - ya) / 2.4) % 3 === 0 ? 'dbg' : 'tan';
      b.box(k, 0, y, z + 0.4, T + 0.8, 0.8, L - 1.6);
    }
    if (q.lod < 2) {
      for (const s of [-1, 1]) {
        b.box('dbg', s * (T / 2 + 0.3), (ya + yb) / 2, z - L / 2 + 1.2, 0.6, yb - ya - 2, 1.6);
        b.box('dbg', s * (T / 2 + 0.3), (ya + yb) / 2, z + L / 2 - 1.2, 0.6, yb - ya - 2, 1.6);
        for (let y = ya + 3; y < yb - 2; y += 3.2) if (rng.chance(0.6)) {
          b.push();
          b.translate(s * (T / 2 + 0.62), y, z - L / 2 + 1.2);
          b.rotateZ((-s * Math.PI) / 2);
          flatQuad(b, 'windowWarm', 0, 0, 0, 0.8, 0.9);
          b.pop();
        }
      }
    }
  }
  b.box('lbg', 0, 36.6, z + 1, T + 1.2, 1.2, L + 1.6);
  sideProfile(b, 'dbg', [[z - L / 2, 37.2], [z + L / 2 + 1.6, 37.2], [z + L / 2 - 2, 39], [z - L / 2, 39]], T);
  b.box('lbg', 0, -44.6, z, T + 1.2, 1.2, L + 1);
  mast(b, q, rng, 0, 39, z - 5, 6);
  mast(b, q, rng, 0, 39, z + 2, 3.5);
  b.cyl('glowRed', 0, -45.4, z + 6, 0.3, 0.4, { radial: 6 });
}

/** Long lateral comm arm (port; mirrored for starboard) rooted in the midsection at zc. */
function arm(b: Builder, q: Q, rng: Rng, zc: number, y: number): void {
  const segs = q.lod === 2 ? 4 : 8;
  const x0 = 10;
  const x1 = 62;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const xa = x0 + (x1 - x0) * t0;
    const xb = x0 + (x1 - x0) * (i + 1) / segs - 0.15;
    const chord = 14 - 6 * t0;
    const th = 2.8 - 1.2 * t0;
    const lead = zc + 7;
    const zm = lead - chord / 2;
    const xm = (xa + xb) / 2;
    const w = xb - xa;
    b.box('darkTan', xm, y, zm, w, th, chord);
    b.box('tan', xm, y + th / 2 + 0.2, zm - 0.6, w - 0.3, 0.4, chord - 2.2);
    b.box('reddishBrown', xm, y + th / 2 + 0.25, zm - 0.6, w - 0.3, 0.42, 1.4);
    b.box('lbg', xm, y, lead - 0.5, w, th * 0.7, 1.2);
    if (q.lod < 2) b.box('dbg', xm, y - th / 2 - 0.2, zm, w - 0.6, 0.4, chord - 3);
    const lights = q.lod === 2 ? 1 : 3;
    for (let k = 0; k < lights; k++) {
      const lx = xa + (w * (k + 0.5)) / lights;
      b.push();
      b.translate(lx, y, lead + 0.11);
      b.rotateX(Math.PI / 2);
      flatQuad(b, 'glowYellow', 0, 0, 0, (w / lights) * 0.7, th * 0.3);
      b.pop();
    }
    if (q.greeble && rng.chance(0.7)) {
      b.push();
      b.translate(xm, y + th / 2 + 0.4, zm - chord / 2 + 1.6);
      greeblePatch(b, rng, w - 0.6, 2.4, ['dbg', 'gunmetal', 'lbg'], { density: 0.6 });
      b.pop();
    }
  }
  // tip pod with fork antennas
  const tz = zc + 7 - 4;
  b.cyl('darkTan', x1 + 0.8, y, tz, 1.5, 5, { radial: q.radial });
  b.cyl('dbg', x1 + 0.8, y + 2.7, tz, 1.1, 0.5, { radial: q.radial });
  bar(b, 'lbg', [x1 + 0.8, y + 2.9, tz], [x1 + 0.8, y + 8, tz], 0.18, { radial: 6 });
  bar(b, 'lbg', [x1 + 0.8, y - 2.5, tz], [x1 + 0.8, y - 6, tz], 0.18, { radial: 6 });
  if (q.lod < 2) {
    bar(b, 'lbg', [x1 + 0.8, y + 6.5, tz], [x1 + 2.6, y + 7.5, tz + 1], 0.12, { radial: 5 });
    bar(b, 'lbg', [x1 + 0.8, y + 6.5, tz], [x1 - 1, y + 7.5, tz + 1], 0.12, { radial: 5 });
  }
  b.cyl('glowRed', x1 + 0.8, y + 8.1, tz, 0.25, 0.2, { radial: 6 });
  b.cyl('glowRed', x1 + 2.35, y, tz, 0.3, 0.3, { axis: 'x', radial: 6 });
}

/** Curled docking hook hanging off the midsection flank (port). */
function hook(b: Builder, z: number): void {
  b.box('darkTan', 12.6, 3.4, z, 2.6, 4, 3);
  sideProfile(b, 'dbg', [[z - 1.3, 2], [z + 1.3, 2], [z + 1.3, -6], [z - 1.3, -8.5]], 1.2, 14.2);
  b.push();
  b.translate(14.2, 0, 0);
  b.rotateY(-Math.PI / 2);
  b.prism('darkTan', [[z - 1.3, -8.5], [z + 3.2, -9.6], [z + 3.2, -8.2], [z + 1.3, -6]], 1.2);
  b.pop();
}

/** Twin turbolaser turret on a surface frame; returns the muzzle anchors. */
function turret(b: Builder, q: Q, parent: Object3D, name: string, p: Vector3, n: Vector3, yaw: number, size: number): Object3D[] {
  const out: Object3D[] = [];
  withFrame(b, frameFwd(p, n), () => {
    b.scale(size);
    b.rotateY(yaw);
    if (q.lod < 2) {
      b.cyl('dbg', 0, 0.3, 0, 1.8, 0.6, { radial: q.radial > 12 ? 14 : 8 });
      sideProfile(b, 'darkTan', [[1.2, 0.5], [2.1, 0.5], [1.2, 1.7]], 2.6);
      b.box('dbg', 0, 1.85, -0.8, 1.8, 0.3, 1.6);
    } else {
      b.box('dbg', 0, 0.3, 0, 3.2, 0.6, 3.2);
    }
    b.box('tan', 0, 1.1, -0.3, 2.6, 1.2, 3);
    for (const sx of [-0.55, 0.55]) {
      if (q.lod < 2) bar(b, 'gunmetal', [sx, 1.1, 1.1], [sx, 1.1, 5.2], 0.18, { radial: 8 });
      else b.box('gunmetal', sx, 1.1, 3.15, 0.36, 0.36, 4.1);
      out.push(anchorFrom(b, `${name}-${sx < 0 ? 'l' : 'r'}`, parent, [sx, 1.1, 5.3]));
    }
  });
  return out;
}

/** Surface point + normal on a (port) shell loft, mirrored for starboard. */
function onShell(secs: Sec[], z: number, th: number, side: number, lift = 0): { p: Vector3; n: Vector3 } {
  const { p, n } = surf(secs, z, th);
  p.addScaledVector(n, lift);
  if (side < 0) {
    p.x = -p.x;
    n.x = -n.x;
  }
  return { p, n };
}

/** Engine nozzle (bell, rim, glow disc and ring) at (x, y) opening toward -Z at z = EZ. */
function nozzle(b: Builder, glow: Builder, q: Q, x: number, y: number, ez: number, R: number): void {
  const k = R / 3;
  const P = (segs: number[][]) => segs.map((s) => s.map((v, i) => (i === 2 || i === 3 || i === 6 || i === 7 ? v : v * k))) as [number, number, number, number, number, number, number, number][];
  b.lathe('gunmetal', P([[3.0, 0, 1, 0, 2.7, -2.6, 1, 0.1], [2.7, -2.6, 0, -1, 2.3, -2.6, 0, -1], [2.3, -2.6, -1, 0, 2.5, 0, -1, 0]]), { radial: q.radial, at: [x, y, ez], axis: 'z' });
  b.lathe('dbg', P([[3.3, 0.6, 1, 0, 3.3, 0, 1, 0], [3.3, 0, 0, -1, 2.9, 0, 0, -1]]), { radial: q.radial, at: [x, y, ez], axis: 'z' });
  glow.lathe('glowCyan', P([[0, -1.2, 0, -1, 2.35, -1.2, 0, -1]]), { radial: q.radial, at: [x, y, ez], axis: 'z' });
  glow.lathe('glowBlue', P([[2.3, -2.5, 0, -1, 2.62, -2.5, 0, -1]]), { radial: q.radial, at: [x, y, ez], axis: 'z' });
}

export function munificent(o: { lod: 0 | 1 | 2; seed?: number }): CapitalShip {
  const q = QS[o.lod];
  const seed = o.seed ?? 1;
  const rng = new Rng(seed * 7 + 3);
  const group = new Group();
  group.name = 'munificent';
  const anchors: Record<string, Object3D> = {};
  const turrets: Object3D[] = [];
  const engineGlows: Mesh[] = [];
  const parts: Record<string, number> = {};
  let tris = 0;

  const builders = new Map<string, Builder>();
  const partOf: Record<string, string> =
    q.lod === 0
      ? { fwdA: 'mun-fwd-a', fwdB: 'mun-fwd-b', aft: 'mun-aft', keel: 'mun-keel', top: 'mun-top', arms: 'mun-arms', eng: 'mun-engines', tur: 'mun-turrets' }
      : q.lod === 1
        ? { fwdA: 'mun-hull', fwdB: 'mun-hull', aft: 'mun-hull', keel: 'mun-hull', top: 'mun-details', arms: 'mun-details', eng: 'mun-details', tur: 'mun-details' }
        : { fwdA: 'mun-lod2', fwdB: 'mun-lod2', aft: 'mun-lod2', keel: 'mun-lod2', top: 'mun-lod2', arms: 'mun-lod2', eng: 'mun-lod2', tur: 'mun-lod2' };
  const B = (part: string): Builder => {
    const name = partOf[part];
    let b = builders.get(name);
    if (!b) {
      b = mk(q, seed * 31 + builders.size);
      builders.set(name, b);
    }
    return b;
  };

  /* ---- shells ---- */
  const ends = q.lod === 2 ? [0.5, 2, 5] : q.lod === 1 ? [0.5, 1.8, 4, 7.5] : [0.4, 1.2, 2.5, 4.5, 7.5];
  const tips = q.lod === 2 ? [2, 7] : q.lod === 1 ? [1.5, 5, 11] : [0.8, 2.5, 5.5, 10, 16];
  const FWD = stations(fwdSec, FZ0, FZ1, q.step, [...tips.map((d) => FZ1 - d), ...ends.map((d) => FZ0 + d)]);
  const AFT = stations(aftSec, AZ0, AZ1, q.step, [...tips.map((d) => AZ0 + d), ...ends.map((d) => AZ1 - d)]);
  const fanD = [0, ...tips.slice(1)];
  for (const side of [1, -1]) {
    const sd = seed * 13 + (side < 0 ? 97 : 0);
    for (const [part, zr] of [['fwdA', { zMax: 40 }], ['fwdB', { zMin: 40 }]] as const) {
      const b = B(part);
      b.push();
      if (side < 0) b.mirrorX();
      shell(b, q, FWD, q.fN, F_TE, F_STRIPES, F_RIBS, sd, { tip: FZ1, dir: 1, d: fanD }, zr);
      b.pop();
    }
    const b = B('aft');
    b.push();
    if (side < 0) b.mirrorX();
    shell(b, q, AFT, q.aN, A_TE, A_STRIPES, A_RIBS, sd + 5, { tip: AZ0, dir: -1, d: fanD });
    b.pop();
  }
  if (q.lod < 2) {
    innerBody(B('fwdA'), FWD.filter((s) => s.z > FZ0 + 3 && s.z < 124), 12);
    innerBody(B('aft'), AFT.filter((s) => s.z > -130 && s.z < AZ1 - 3), 10);
  }

  /* ---- keel and midsection ---- */
  {
    const b = B('keel');
    const kths = thList(q.kN, [KEEL_WIN[0], KEEL_WIN[1], Math.PI * 2 - KEEL_WIN[1], Math.PI * 2 - KEEL_WIN[0]]);
    loft(b, resample(KEEL, q.step * 1.2), { N: q.kN, ths: kths, tileLen: tileLen(q, 40), tileWid: q.wid, spec: keelSpec(q, seed), core: 'black', capStart: 'darkBrown', capEnd: 'darkBrown', flat: true });
    loft(b, resample(MIDS, q.step), { N: q.mN, tileLen: tileLen(q, 41), tileWid: q.wid, spec: midSpec(q, seed), core: 'black', capStart: 'darkBrown', capEnd: 'darkBrown', flat: q.flat });
    for (const side of [1, -1]) {
      b.push();
      if (side < 0) b.mirrorX();
      for (const z of [-46, -37, -28, -19]) hook(b, z);
      b.pop();
    }
    // heavy guns on the keel flanks and the prow cannon between the bow prongs
    const rb = q.lod < 2 ? 10 : 6;
    for (const s of [-1, 1]) {
      b.box('darkTan', s * 8.6, -5.2, 76, 3.6, 3.4, 14);
      b.box('dbg', s * 8.6, -3.3, 75, 2.6, 0.6, 10);
      bar(b, 'gunmetal', [s * 8.6, -5.2, 83], [s * 8.6, -5.2, 101], 0.6, { radial: rb });
      bar(b, 'dbg', [s * 8.6, -5.2, 99], [s * 8.6, -5.2, 102], 0.8, { radial: rb });
    }
    b.box('dbg', 0, 0.2, 112, 7, 4.4, 16);
    b.box('darkTan', 0, 2.6, 110, 6, 0.8, 12);
    sideProfile(b, 'darkTan', [[104, -2], [120, -2], [120, 1], [104, 2.4]], 7.4);
    for (const s of [-1, 1]) {
      bar(b, 'gunmetal', [s * 1.7, 0.4, 118], [s * 1.7, 0.4, 142], 0.75, { radial: rb + 2 });
      bar(b, 'dbg', [s * 1.7, 0.4, 139], [s * 1.7, 0.4, 143], 1.0, { radial: rb + 2 });
      bar(b, 'dbg', [s * 1.7, 0.4, 122], [s * 1.7, 0.4, 125], 1.0, { radial: rb + 2 });
    }
  }

  /* ---- dorsal superstructure, bridge, comm mast ---- */
  const TZ = 98;
  let bridgeY = 0;
  {
    const b = B('top');
    spine(b, q, rng, FZ0 - 2, TZ - 9, 5.2, fCrest, 6);
    spine(b, q, rng, TZ + 9, 120, 3.4, fCrest, 5);
    bridgeY = tower(b, q, rng, TZ, fCrest(TZ) - 3);
    spine(b, q, rng, -136, -80, 3.6, aCrest, 5);
    spine(b, q, rng, -62, AZ1, 3.6, aCrest, 5);
    // midsection deck
    b.box('darkTan', 0, 11.6, -28, 12, 2, 48);
    spine(b, q, rng, -50, -6, 4.4, () => 15.5, 12.4);
    commMast(b, q, rng, -71);
  }

  /* ---- arms ---- */
  {
    const b = B('arms');
    for (const side of [1, -1]) {
      b.push();
      if (side < 0) b.mirrorX();
      arm(b, q, rng, -30, 8);
      b.pop();
    }
  }

  /* ---- engines in the stern band, between the aft prongs ---- */
  const EZ = -128;
  const NOZ: [number, number][] = [[-9.6, -2.4], [-3.2, -2.4], [3.2, -2.4], [9.6, -2.4], [-6.4, 3.4], [0, 3.4], [6.4, 3.4]];
  const glowB = mk(q, seed * 31 + 99);
  {
    const b = B('eng');
    b.box('dbg', 0, 0.5, EZ + 12, 24, 12, 24, { hide: { pz: true } });
    b.box('darkTan', 0, 6.9, EZ + 12, 20, 0.8, 22);
    for (const [x, y] of NOZ) nozzle(b, glowB, q, x, y, EZ, 2.8);
  }

  /* ---- turrets ---- */
  {
    const b = B('tur');
    const tsize = 1.35;
    const tlist: [Sec[], number[], number, number, number][] = [
      [FWD, F_RIBS, 14, 0.55, 0],
      [FWD, F_RIBS, 58, 0.55, 0],
      [FWD, F_RIBS, 100, 0.62, 0],
      [FWD, F_RIBS, 6, 1.6, 0.3],
      [FWD, F_RIBS, 46, 1.6, 0.3],
      [FWD, F_RIBS, 86, 1.6, 0.2],
      [AFT, A_RIBS, -118, 0.7, 0],
      [AFT, A_RIBS, -88, 0.7, 0],
    ];
    let ti = 0;
    for (const side of [1, -1]) {
      for (const [secs, ribs, z, th, yaw] of tlist) {
        const { p, n } = onShell(secs, z, th, side, bandT(th, ribs));
        const yw = yaw * side + (rng.next() - 0.5) * 0.3;
        turrets.push(...turret(b, q, group, `turret${ti++}`, p, n, yw, tsize));
      }
    }
    for (const z of [-48, -8]) {
      turrets.push(...turret(b, q, group, `turret${ti++}`, new Vector3(0, 12.6, z), new Vector3(0, 1, 0), 0, tsize));
    }
  }

  /* ---- build ---- */
  for (const [name, b] of builders) {
    const bt = b.build(name);
    group.add(bt.group);
    tris += bt.triangles;
    parts[name] = bt.triangles;
  }
  const eg = glowB.build('mun-engine-glow', { castShadow: false });
  group.add(eg.group);
  tris += eg.triangles;
  parts['mun-engine-glow'] = eg.triangles;
  for (const m of eg.group.children) {
    const mesh = m as Mesh;
    mesh.material = (mesh.material as Material).clone();
    engineGlows.push(mesh);
  }

  /* ---- anchors ---- */
  const ab = mk(q, 1);
  const hit = (name: string, p: Vector3, n: Vector3) => {
    anchors[name] = anchorFrom(ab, name, group, [p.x, p.y, p.z], [n.x, n.y, n.z]);
  };
  {
    const a = onShell(FWD, 40, 1.2, 1, bandT(1.2, F_RIBS) + 0.3);
    hit('hit0', a.p, a.n);
    const c = onShell(FWD, 76, 0.75, -1, bandT(0.75, F_RIBS) + 0.3);
    hit('hit1', c.p, c.n);
    hit('hit2', new Vector3(0, bridgeY - 4.5, TZ + 14.8), new Vector3(0, 0, 1));
    hit('hit3', new Vector3(12.6, 6, -10), new Vector3(1, 0, 0));
    const d = onShell(AFT, -100, 1.0, -1, bandT(1.0, A_RIBS) + 0.3);
    hit('hit4', d.p, d.n);
    hit('hit5', new Vector3(0, -18.6, -20), new Vector3(0, -1, 0));
  }
  anchors.bridge = anchorFrom(ab, 'bridge', group, [0, bridgeY, TZ], [0, 0, 1]);
  anchors.bow = anchorFrom(ab, 'bow', group, [0, 3, FZ1], [0, 0, 1]);
  anchors.stern = anchorFrom(ab, 'stern', group, [0, 0.5, EZ - 3], [0, 0, -1]);
  anchors.cannon = anchorFrom(ab, 'cannon', group, [0, 0.4, 143.2], [0, 0, 1]);
  anchors.comm = anchorFrom(ab, 'comm', group, [0, 39, -71], [0, 1, 0], [0, 0, 1]);

  group.userData.triangles = tris;
  group.userData.parts = parts;
  return { group, length: (FZ1 - AZ0) * S, turrets, engineGlows, anchors };
}
