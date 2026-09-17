/**
 * The ring of small plants at a near bole's foot (concept 05 "Mossy Tree Trunk" / "Roots": small
 * plants in the crevices, ferns and broad ground leaves between the roots, leaf litter on the
 * moss) — built from the trees' own laminae (writer.ts addLeaf) into the near-base writer, so
 * they render through the tree shader: leaf midrib / veins / sky transmission, the leaf shade
 * floor, the shared wind (branch layer by stiffness, flutter by aWind.z). Geometry-only, local
 * space, seated on `groundAt`; every draw from the stream the caller forks per tree.
 */
import { Color, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { smoothstep } from '../util/noise';
import { GeometryWriter, TAU, UP, addLeaf, between, frame, tube } from './writer';

export interface BasePlantOptions {
  /** local ground height under local (x, z) */
  groundAt: (x: number, z: number) => number;
  /** 0–1 path / paving mask under local (x, z): nothing grows on it */
  pathAt?: (x: number, z: number) => number;
  /** false where a root fin stands (nothing grows inside the wood) */
  clear?: (x: number, z: number) => boolean;
  /** bole radius at the foot (the ring of plants starts just outside it) */
  footRadius: number;
  /** outer radius of the plant ring */
  reach: number;
  /** population scale (1 = a giant's foot: 6–9 fern clumps, 5–8 tufts, ~90 litter leaves) */
  density?: number;
  /** local horizontal unit vector away from the sun: the shaded side carries more ferns and moss */
  shadeDir?: Vector3;
  palette: { fern: Color; fernDeep: Color; tuft: Color; tuftSun: Color; litter: Color; litterDark: Color };
}

export interface BasePlantResult {
  ferns: number;
  fronds: number;
  tufts: number;
  litter: number;
  triangles: number;
}

const _dir = new Vector3();
const _side = new Vector3();

/**
 * One fern frond: a rachis (thin tube) rising from `base` toward `dir`, arching over under its
 * own weight, with pinnae (4-triangle laminae) in alternating pairs shortening toward the tip.
 */
function frond(writer: GeometryWriter, base: Vector3, dir: Vector3, length: number, color: Color, rng: Rng) {
  const bt = (a: number, b: number) => between(rng, a, b);
  const segs = 7;
  const path: Vector3[] = [];
  const horiz = new Vector3(dir.x, 0, dir.z).normalize();
  const rise = bt(0.55, 0.9);
  const droop = bt(0.5, 0.9);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // a rising arc that bends over: height peaks around 60 % of the run
    const y = length * (rise * t - droop * t * t * 0.75);
    path.push(base.clone().addScaledVector(horiz, length * t * (0.55 + 0.45 * t)).addScaledVector(UP, Math.max(0.02, y)));
  }
  const radii = path.map((_, i) => 0.006 * (1 - (i / segs) * 0.8) + 0.0015);
  const stem = color.clone().multiplyScalar(0.75);
  tube(writer, path, radii, 3, rng, { color: stem, roughness: 0, structural: true, stiffness: () => 0.35 });
  // pinnae: alternating pairs from 15 % out, longest a third of the way along, tapering to the tip
  const pairs = 9;
  const opts = {
    widthRatio: 0.32,
    wideFirst: 0.9,
    wideSecond: 0.7,
    stiffness: 0.3,
    flutter: 0.012,
    detailOverride: 'medium' as const,
    tipColor: color.clone().multiplyScalar(1.12),
  };
  let leaves = 0;
  for (let k = 0; k < pairs; k++) {
    const t = 0.15 + (0.83 * k) / pairs;
    const i = Math.min(segs - 1, Math.floor(t * segs));
    const f = t * segs - i;
    const at = path[i].clone().lerp(path[i + 1], f);
    _dir.subVectors(path[i + 1], path[i]).normalize();
    _side.crossVectors(_dir, UP);
    if (_side.lengthSq() < 1e-4) _side.set(1, 0, 0);
    _side.normalize();
    const pinna = length * (0.16 + 0.22 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * bt(0.85, 1.1);
    for (const s of [-1, 1]) {
      const d = _side.clone().multiplyScalar(s).addScaledVector(_dir, 0.45).addScaledVector(UP, bt(-0.15, 0.1)).normalize();
      if (addLeaf(writer, at, d, pinna, color.clone().multiplyScalar(bt(0.9, 1.08)), rng, opts)) leaves++;
    }
  }
  // the tip leaflet
  const tip = path[segs];
  _dir.subVectors(path[segs], path[segs - 1]).normalize();
  if (addLeaf(writer, tip, _dir, length * 0.14, color, rng, opts)) leaves++;
  return leaves;
}

/** A fern clump: 4–8 fronds fanning out from one crown. */
function fernClump(writer: GeometryWriter, at: Vector3, size: number, o: BasePlantOptions, rng: Rng): number {
  const bt = (a: number, b: number) => between(rng, a, b);
  const n = rng.int(4, 8);
  const phase = rng() * TAU;
  let fronds = 0;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU + bt(-0.3, 0.3);
    const dir = new Vector3(Math.cos(a), bt(0.5, 1.1), Math.sin(a)).normalize();
    const color = o.palette.fern.clone().lerp(o.palette.fernDeep, bt(0, 0.5));
    frond(writer, at, dir, size * bt(0.75, 1.15), color, rng);
    fronds++;
  }
  return fronds;
}

/**
 * A broad-leaf ground tuft (concept 05 "Ground Leaf (Round)"): 4–7 wide laminae on short stalks
 * radiating from one point, the outer ones lying nearly flat.
 */
function broadleafTuft(writer: GeometryWriter, at: Vector3, size: number, o: BasePlantOptions, rng: Rng): number {
  const bt = (a: number, b: number) => between(rng, a, b);
  const n = rng.int(4, 7);
  const phase = rng() * TAU;
  const opts = {
    widthRatio: 0.88,
    wideFirst: 0.78,
    wideSecond: 0.86,
    stiffness: 0.28,
    flutter: 0.01,
    detailOverride: 'high' as const,
    tipColor: o.palette.tuft.clone().multiplyScalar(1.05),
  };
  let leaves = 0;
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * TAU + bt(-0.35, 0.35);
    // outer leaves lie flatter, the inner ones stand up a little
    const inner = i % 2 === 0;
    const elev = inner ? bt(0.45, 0.9) : bt(0.1, 0.35);
    const dir = new Vector3(Math.cos(a), elev, Math.sin(a)).normalize();
    const stalk = at.clone().addScaledVector(dir, size * 0.15).addScaledVector(UP, 0.03);
    const [u] = frame(dir);
    const leafDir = dir.clone().addScaledVector(u, bt(-0.1, 0.1)).normalize();
    const sun = bt(0, 0.4);
    const color = o.palette.tuft.clone().lerp(o.palette.tuftSun, sun).multiplyScalar(inner ? 0.94 : 1.02);
    if (addLeaf(writer, stalk, leafDir, size * bt(0.75, 1.15), color, rng, opts)) leaves++;
  }
  return leaves;
}

/** Fallen leaves lying flat on the moss and soil (2-triangle laminae, brown to olive). */
function litter(writer: GeometryWriter, at: Vector3, o: BasePlantOptions, rng: Rng): boolean {
  const bt = (a: number, b: number) => between(rng, a, b);
  const a = rng() * TAU;
  const dir = new Vector3(Math.cos(a), bt(0.02, 0.14), Math.sin(a)).normalize();
  const color = o.palette.litter.clone().lerp(o.palette.litterDark, bt(0, 0.7)).multiplyScalar(bt(0.85, 1.1));
  return addLeaf(writer, at.clone().addScaledVector(UP, 0.012), dir, bt(0.09, 0.16), color, rng, {
    widthRatio: 0.62,
    wideFirst: 0.7,
    wideSecond: 0.8,
    stiffness: 1,
    flutter: 0,
    detailOverride: 'low',
    tipColor: o.palette.litterDark,
  });
}

/**
 * Populate the ring `footRadius`–`reach` around the origin. Every candidate spot draws the same
 * numbers whether or not it is built (path, wood or a failed clear test), so the population is
 * one stream whatever the terrain says.
 */
export function basePlants(writer: GeometryWriter, rng: Rng, o: BasePlantOptions): BasePlantResult {
  const gen = basePlantsSteps(writer, rng, o);
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

/**
 * `basePlants` as a chunked build (lodPool.ts): yields after every fern clump, after the tufts
 * and every 30 litter leaves. Same draws, same geometry.
 */
export function* basePlantsSteps(writer: GeometryWriter, rng: Rng, o: BasePlantOptions): Generator<void, BasePlantResult> {
  const bt = (a: number, b: number) => between(rng, a, b);
  const density = o.density ?? 1;
  const trisBefore = writer.triangles;
  const result: BasePlantResult = { ferns: 0, fronds: 0, tufts: 0, litter: 0, triangles: 0 };
  const spot = (rMin: number, rMax: number, shadeBias: number): Vector3 | null => {
    const a = rng() * TAU;
    const rr = Math.sqrt(bt(rMin * rMin, rMax * rMax));
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    // the shaded side is the mossy, ferny one: a spot on the sun side is dropped by `shadeBias`
    const keep = rng();
    if (o.shadeDir && shadeBias > 0) {
      const away = 0.5 + 0.5 * (Math.cos(a) * o.shadeDir.x + Math.sin(a) * o.shadeDir.z);
      if (keep > 1 - shadeBias * (1 - smoothstep(0.2, 0.7, away))) return null;
    }
    if (o.pathAt && o.pathAt(x, z) > 0.15) return null;
    if (o.clear && !o.clear(x, z)) return null;
    return new Vector3(x, o.groundAt(x, z), z);
  };
  const fernN = Math.round(bt(6, 9) * density);
  for (let i = 0; i < fernN; i++) {
    const size = bt(0.45, 0.8);
    const at = spot(o.footRadius * 1.05, o.reach, 0.55);
    if (!at) {
      // consume the clump's draws anyway on a scratch writer so the stream stays aligned
      fernClump(new GeometryWriter('high'), new Vector3(), size, o, rng);
      continue;
    }
    result.fronds += fernClump(writer, at, size, o, rng);
    result.ferns++;
    yield;
  }
  const tuftN = Math.round(bt(5, 8) * density);
  for (let i = 0; i < tuftN; i++) {
    const size = bt(0.16, 0.26);
    const at = spot(o.footRadius * 1.0, o.reach * 0.9, 0.25);
    if (!at) {
      broadleafTuft(new GeometryWriter('high'), new Vector3(), size, o, rng);
      continue;
    }
    broadleafTuft(writer, at, size, o, rng);
    result.tufts++;
  }
  yield;
  const litterN = Math.round(bt(70, 110) * density);
  for (let i = 0; i < litterN; i++) {
    const at = spot(o.footRadius * 0.95, o.reach * 1.1, 0);
    if (!at) {
      litter(new GeometryWriter('high'), new Vector3(), o, rng);
      continue;
    }
    if (litter(writer, at, o, rng)) result.litter++;
    if (i % 30 === 29) yield;
  }
  result.triangles = writer.triangles - trisBefore;
  return result;
}
