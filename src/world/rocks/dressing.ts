/**
 * Near-LOD rock dressing (round 42): the small surface-bound geometry a hero boulder shows at
 * player height — moss cushions (small lumpy domes with lit tops on the upper faces and in the
 * crevices, the pads of the owner's 'Roots' panel), lichen plates (flat pale crusts with a darker
 * rim on the bare side faces, frame-05's rock) — and a merge helper that folds any rock geometry
 * (the loose fragments at the foot) into the near mesh so the whole kit is ONE draw with the rock
 * material. Everything is written in the rock's local frame with the rock material's attribute
 * set (position, normal, color, aMoss, aWet):
 *
 *   aMoss  > 1  cushion vertex — the material's moss path, lifted toward the bright green by
 *               (aMoss − 1) so the crown of each pad is lit and its rim stays deep
 *   aMoss  < 0  lichen plate — the material flattens the rock texture under it and paints the
 *               vertex colour (pale centre, darker rim)
 *
 * Geometry only; deterministic from the given stream.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Matrix3, Matrix4, Vector3, type BufferAttribute } from 'three';
import type { Rng } from '../util/prng';

const ATTRS: { name: string; size: number }[] = [
  { name: 'position', size: 3 },
  { name: 'normal', size: 3 },
  { name: 'color', size: 3 },
  { name: 'aMoss', size: 1 },
  { name: 'aWet', size: 1 },
];

/** growable attribute arrays for the dressing */
class Writer {
  position: number[] = [];
  normal: number[] = [];
  color: number[] = [];
  aMoss: number[] = [];
  aWet: number[] = [];
  vertices = 0;
  push(p: Vector3, n: Vector3, c: Color, moss: number, wet = 0) {
    this.position.push(p.x, p.y, p.z);
    this.normal.push(n.x, n.y, n.z);
    this.color.push(c.r, c.g, c.b);
    this.aMoss.push(moss);
    this.aWet.push(wet);
    this.vertices++;
  }
}

export interface DressingOptions {
  /** the rock's radius (m) */
  radius: number;
  /** local y below which nothing is placed (the buried collar) */
  minY: number;
  /** target counts */
  cushions: number;
  lichen: number;
  /** local xz direction away from the sun: cushions favour faces turned that way */
  shade?: [number, number];
}

export interface DressingStats {
  cushions: number;
  lichen: number;
  vertices: number;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _n = new Vector3();
const _t = new Vector3();
const _u = new Vector3();
const _p = new Vector3();
const _pn = new Vector3();
const _col = new Color();

/**
 * an orthonormal frame (t, u) around the unit normal n, laid out like three's (x, z) about +y
 * (t × u = −n), so a ring written as t·cos a + u·sin a with a increasing runs clockwise seen from
 * +n and the triangle patterns below (the joint-sprout cushion's) come out front-facing
 */
function frame(n: Vector3, t: Vector3, u: Vector3) {
  if (Math.abs(n.y) < 0.9) t.set(0, 1, 0);
  else t.set(1, 0, 0);
  t.cross(n).normalize();
  u.crossVectors(t, n).normalize();
}

/**
 * One moss cushion: a lumpy dome of radius R and height 0.5·R about `centre` with its axis on
 * `up`, sunk 0.3·R into the surface. 10 segments × 3 rings (54 triangles).
 */
function cushion(w: Writer, rng: Rng, centre: Vector3, up: Vector3, R: number, deep: Color, bright: Color) {
  frame(up, _t, _u);
  const segs = 10;
  const rings = 3;
  const bump = Array.from({ length: segs * (rings + 1) }, () => rng.range(0.86, 1.14));
  const squash = rng.range(0.42, 0.58);
  const pt = (r: number, s: number, out: Vector3, nrm: Vector3): number => {
    const t = r / rings;
    const a = (s / segs) * Math.PI * 2 + (r & 1 ? Math.PI / segs : 0);
    const k = bump[r * segs + (s % segs)];
    const rad = Math.sin((t * Math.PI) / 2) * R * (0.9 + 0.14 * k);
    const h = R * squash * Math.cos((t * Math.PI) / 2) * k - 0.3 * R;
    out.copy(centre).addScaledVector(_t, Math.cos(a) * rad).addScaledVector(_u, Math.sin(a) * rad).addScaledVector(up, h);
    // dome normal: from a point 0.35 R under the base
    nrm.copy(_t).multiplyScalar(Math.cos(a) * rad).addScaledVector(_u, Math.sin(a) * rad).addScaledVector(up, h + 0.35 * R).normalize();
    return t;
  };
  const crownP = new Vector3().copy(centre).addScaledVector(up, R * squash - 0.3 * R);
  const emit = (r: number, s: number) => {
    const t = pt(r, s, _p, _pn);
    // aMoss 1.05..1.9 (always > 1: a cushion vertex): the crown is lifted, the rim is the plain
    // deep moss; the colour is a fallback the moss path overrides
    _col.copy(bright).lerp(deep, 0.3 + 0.6 * t);
    w.push(_p, _pn, _col, 1.05 + 0.85 * (1 - t));
  };
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      if (r === 0) {
        _col.copy(bright);
        w.push(crownP, up, _col, 1.9);
        emit(1, s + 1);
        emit(1, s);
      } else {
        emit(r, s);
        emit(r + 1, s + 1);
        emit(r + 1, s);
        emit(r, s);
        emit(r, s + 1);
        emit(r + 1, s + 1);
      }
    }
  }
}

/**
 * One lichen plate: an irregular disc of radius R lying 2 mm off the surface — a pale centre fan
 * to an inner ring, a darker rim band to the outer ring (8 segments, 24 triangles).
 */
function lichenPlate(w: Writer, rng: Rng, centre: Vector3, n: Vector3, R: number, pale: Color, rim: Color) {
  frame(n, _t, _u);
  const segs = 8;
  const outer = Array.from({ length: segs }, () => rng.range(0.78, 1.22));
  const phase = rng.range(0, Math.PI * 2);
  const lift = 0.002;
  const ring = (k: number, s: number, out: Vector3) => {
    const a = phase + (s / segs) * Math.PI * 2;
    const rad = R * (k === 1 ? 0.66 : outer[s % segs]);
    const h = lift + (k === 1 ? 0.0015 : 0);
    out.copy(centre).addScaledVector(_t, Math.cos(a) * rad).addScaledVector(_u, Math.sin(a) * rad).addScaledVector(n, h);
  };
  const c0 = new Vector3().copy(centre).addScaledVector(n, lift + 0.0025);
  const mid = new Color().copy(pale).lerp(rim, 0.25);
  for (let s = 0; s < segs; s++) {
    // centre fan (pale)
    w.push(c0, n, pale, -1);
    ring(1, s + 1, _p);
    w.push(_p, n, mid, -1);
    ring(1, s, _p);
    w.push(_p, n, mid, -1);
    // rim band (inner pale-mid → outer dark rim)
    ring(1, s, _a);
    ring(1, s + 1, _b);
    ring(2, s, _c);
    w.push(_a, n, mid, -1);
    w.push(_b, n, mid, -1);
    w.push(_c, n, rim, -1);
    ring(2, s + 1, _p);
    w.push(_b, n, mid, -1);
    w.push(_p, n, rim, -1);
    w.push(_c, n, rim, -1);
  }
}

interface Site {
  p: Vector3;
  n: Vector3;
  moss: number;
  crack: boolean;
}

/**
 * Dress a built rock (`buildRock` output, local frame) with moss cushions and lichen plates and
 * return the merged geometry. Candidates are the rock's triangles: cushions on upward faces that
 * carry moss and in the dark crevices (a crack crossing a shoulder), lichen on the bare, un-mossed
 * side faces; both spaced by their size so pads do not overlap and plates cluster in twos and
 * threes. The input geometry is not modified.
 */
export function dressRock(rock: BufferGeometry, rng: Rng, o: DressingOptions, palette: { mossDeep: Color; mossBright: Color }): { geometry: BufferGeometry; stats: DressingStats } {
  const pos = rock.attributes.position as BufferAttribute;
  const nrm = rock.attributes.normal as BufferAttribute;
  const col = rock.attributes.color as BufferAttribute;
  const mossA = rock.attributes.aMoss as BufferAttribute;
  const r = o.radius;
  const shade = o.shade ?? [0, 0];
  const cushionSites: Site[] = [];
  const lichenSites: Site[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    _a.fromBufferAttribute(pos, i);
    _b.fromBufferAttribute(pos, i + 1);
    _c.fromBufferAttribute(pos, i + 2);
    _p.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3);
    if (_p.y < o.minY) continue;
    _n.fromBufferAttribute(nrm, i).add(_t.fromBufferAttribute(nrm, i + 1)).add(_u.fromBufferAttribute(nrm, i + 2)).normalize();
    const m = (mossA.getX(i) + mossA.getX(i + 1) + mossA.getX(i + 2)) / 3;
    const lum = (col.getX(i) + col.getY(i) + col.getZ(i) + col.getX(i + 1) + col.getY(i + 1) + col.getZ(i + 1)) / 6;
    const crack = lum < 0.36;
    if (m < 0) continue;
    const facing = _n.x * shade[0] + _n.z * shade[1];
    if ((_n.y > 0.3 && m > 0.12) || (crack && _n.y > 0.05) || (_n.y > 0.55 && facing > 0.2)) cushionSites.push({ p: _p.clone(), n: _n.clone(), moss: m, crack });
    if (_n.y > -0.25 && _n.y < 0.72 && m < 0.12 && !crack && _p.y > o.minY + 0.15 * r) lichenSites.push({ p: _p.clone(), n: _n.clone(), moss: m, crack });
  }
  const w = new Writer();
  const stats: DressingStats = { cushions: 0, lichen: 0, vertices: 0 };
  // cushions: crevices first (a pad in every dark parting reads as the moss that fills cracks),
  // then the shaded shoulders, the thick cap last (its own swell is already a pad); a pad's
  // radius 3–9 cm scaled a little with the rock
  const cRng = rng.fork('cushions');
  const order = cushionSites.map((s, i) => ({ s, k: (s.crack ? 1 : 0) + 0.5 * Math.min(s.moss, 0.5) - 0.6 * Math.max(0, s.moss - 0.5) + 0.35 * cRng() + (s.n.x * shade[0] + s.n.z * shade[1] > 0.2 ? 0.3 : 0), i })).sort((p, q) => q.k - p.k || p.i - q.i);
  const placedC: { p: Vector3; R: number }[] = [];
  const sizeK = Math.sqrt(Math.max(0.5, r));
  const cCentre = new Vector3();
  const cUp = new Vector3();
  const worldUp = new Vector3(0, 1, 0);
  for (const { s } of order) {
    if (placedC.length >= o.cushions) break;
    const R = cRng.range(0.03, 0.09) * sizeK;
    if (placedC.some((q) => q.p.distanceTo(s.p) < 0.9 * (q.R + R) + 0.02)) continue;
    // in a crevice the pad sits a little deeper (the moss fills the parting)
    cCentre.copy(s.p).addScaledVector(s.n, s.crack ? -0.35 * R : -0.12 * R);
    // the up axis leans from the surface normal toward world up so the pads read as growing up
    cUp.copy(s.n).lerp(worldUp, 0.35).normalize();
    cushion(w, cRng, cCentre, cUp, R, palette.mossDeep, palette.mossBright);
    placedC.push({ p: s.p.clone(), R });
    stats.cushions++;
  }
  // lichen: clustered plates 2–5 cm across on the bare faces, a satellite or two beside each seed
  const lRng = rng.fork('lichen');
  const pale = new Color(0.66, 0.69, 0.56);
  const rim = new Color(0.4, 0.42, 0.34);
  const placedL: { p: Vector3; R: number }[] = [];
  const shuffled = lichenSites.map((s, i) => ({ s, k: lRng(), i })).sort((p, q) => p.k - q.k || p.i - q.i);
  const tryPlate = (site: Site, R: number): boolean => {
    if (placedL.some((q) => q.p.distanceTo(site.p) < 0.85 * (q.R + R))) return false;
    if (placedC.some((q) => q.p.distanceTo(site.p) < q.R + R)) return false;
    _col.copy(pale).multiplyScalar(lRng.range(0.9, 1.1));
    lichenPlate(w, lRng, site.p, site.n, R, _col.clone(), rim);
    placedL.push({ p: site.p.clone(), R });
    stats.lichen++;
    return true;
  };
  for (const { s } of shuffled) {
    if (placedL.length >= o.lichen) break;
    const R = lRng.range(0.02, 0.05) * sizeK;
    if (!tryPlate(s, R)) continue;
    // satellites: the nearest other sites within 3 R
    const sats = lRng.int(1, 3);
    let n = 0;
    for (const t of lichenSites) {
      if (n >= sats || placedL.length >= o.lichen) break;
      const d = t.p.distanceTo(s.p);
      if (d < 1.2 * R || d > 3.2 * R) continue;
      if (tryPlate(t, R * lRng.range(0.55, 0.9))) n++;
    }
  }
  stats.vertices = w.vertices;
  return { geometry: mergeGeometries(rock, w), stats };
}

/**
 * Fold `part` (a rock geometry in its own frame) into the writer under `matrix` (part → rock
 * local), with normals transformed by the matrix's normal matrix. Missing `aWet` reads 0.
 */
function appendGeometry(target: Writer, part: BufferGeometry, matrix: Matrix4) {
  const nm = new Matrix3().getNormalMatrix(matrix);
  const pos = part.attributes.position as BufferAttribute;
  const nrm = part.attributes.normal as BufferAttribute;
  const col = part.attributes.color as BufferAttribute;
  const moss = part.attributes.aMoss as BufferAttribute | undefined;
  const wet = part.attributes.aWet as BufferAttribute | undefined;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    _n.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    target.position.push(_p.x, _p.y, _p.z);
    target.normal.push(_n.x, _n.y, _n.z);
    target.color.push(col.getX(i), col.getY(i), col.getZ(i));
    target.aMoss.push(moss ? moss.getX(i) : 0);
    target.aWet.push(wet ? wet.getX(i) : 0);
    target.vertices++;
  }
}

/** the rock's own attributes followed by the writer's, as a new non-indexed geometry */
function mergeGeometries(rock: BufferGeometry, w: Writer): BufferGeometry {
  const g = new BufferGeometry();
  for (const { name, size } of ATTRS) {
    const src = rock.attributes[name] as BufferAttribute | undefined;
    const base = src ? (src.array as Float32Array) : new Float32Array(rock.attributes.position.count * size);
    const extra = (w as unknown as Record<string, number[]>)[name];
    const arr = new Float32Array(base.length + extra.length);
    arr.set(base, 0);
    arr.set(extra, base.length);
    g.setAttribute(name, new Float32BufferAttribute(arr, size));
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * Merge several rock geometries (each under its own matrix into the shared local frame) with a
 * base geometry into one — the near mesh with its loose fragments.
 */
export function mergeRockParts(base: BufferGeometry, parts: { geometry: BufferGeometry; matrix: Matrix4 }[]): BufferGeometry {
  const w = new Writer();
  for (const part of parts) appendGeometry(w, part.geometry, part.matrix);
  return mergeGeometries(base, w);
}
