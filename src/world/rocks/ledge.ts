/**
 * Rock ledge faces (fable-2, owner review 2026-09-19 ref-04): the tall rock/root ledge that
 * stands over the north path's right bank — damp dark stone in tilted beds, vertical joints
 * breaking the beds into blocks, an overhanging mossy lip, moss sheets hanging where the face is
 * damp and lying on the bed ledges, a wet band and drip streaks at the foot.
 *
 * Geometry is a welded column grid along a foot polyline. Every column samples the heightfield
 * twice: at the foot (the face enters the ground there, exactly) and at the top point `inset` m
 * behind it (the lip's shoulder rolls down onto that ground), so the face fits whatever bank the
 * layout raises. With `height` set the top is a free-standing shelf instead of a terrain step.
 * Attributes are the rock material's (position, normal, color, aMoss, aWet) so `createRockMaterial`
 * renders it; the ledge variant of that material (material.ts `opts.ledge`) keeps the near terms
 * legible out to path distance.
 *
 * WHERE a ledge stands is layout's business: rocks/index.ts reads `layout.rockLedges` (see
 * `RockLedgeDef`) — fable-cursor's expansion-1 lane authors the entries.
 */
import { BufferGeometry, Color, Float32BufferAttribute, Vector2, Vector3 } from 'three';
import { clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import type { Terrain } from '../terrain/heightfield';
import { Noise3, computeCreaseNormals } from './rockgen';

export interface RockLedgeDef {
  id: string;
  /** the foot line on the path side, world xz, in order; the face rises on `side` of the walk direction */
  foot: [number, number][];
  /** which side of the walk direction the bank is on (default: whichever the terrain says is higher) */
  side?: 'left' | 'right';
  /** horizontal distance from the foot line to the top's ground point (default 2.2 m) */
  inset?: number;
  /** face height above the foot; omit to read it from the terrain at the top point (a terrain step) */
  height?: number;
  /** how far the lip overhangs the face at the top (default 0.35 m) */
  lean?: number;
  /** end taper: the face sinks into the bank over this run at both ends (default 1.4 m) */
  taper?: number;
}

export interface LedgeBuild {
  geometry: BufferGeometry;
  /** foot contact points on the terrain, world (every ~1 m along the foot) */
  contacts: [number, number, number][];
  columns: number;
  rows: number;
  /** measured facts for the audit */
  stats: { height: number; length: number; mossShare: number; wetShare: number; triangles: number };
}

const _p = new Vector3();
const _q = new Vector3();
const _tmp = new Color();

/** resample a polyline at ~`step` m spacing (world xz) */
function resample(pts: [number, number][], step: number): Vector2[] {
  const out: Vector2[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = new Vector2(pts[k][0], pts[k][1]);
    const b = new Vector2(pts[k + 1][0], pts[k + 1][1]);
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) out.push(a.clone().lerp(b, i / n));
  }
  out.push(new Vector2(pts[pts.length - 1][0], pts[pts.length - 1][1]));
  return out;
}

/**
 * Build one ledge face. Deterministic from `rng` + `seed`. The result is in world coordinates
 * (mesh at the origin).
 */
export function buildRockLedge(def: RockLedgeDef, T: Terrain, rng: Rng, seed: string): LedgeBuild {
  const N = new Noise3(`${seed}/ledge-${def.id}`);
  const inset = def.inset ?? 2.2;
  const lean = def.lean ?? 0.35;
  const taper = def.taper ?? 1.4;
  const foot = resample(def.foot, 0.14);
  const J = foot.length;
  // walk direction and the "into the bank" normal per column
  const tan: Vector2[] = [];
  const nIn: Vector2[] = [];
  for (let j = 0; j < J; j++) {
    const a = foot[Math.max(0, j - 1)];
    const b = foot[Math.min(J - 1, j + 1)];
    const t = b.clone().sub(a).normalize();
    tan.push(t);
    nIn.push(new Vector2(-t.y, t.x)); // left of the walk direction
  }
  // which side is the bank: the def says, or the terrain (higher side at mid-run)
  let sideSign = def.side === 'right' ? -1 : def.side === 'left' ? 1 : 0;
  if (sideSign === 0) {
    const m = foot[Math.floor(J / 2)];
    const n = nIn[Math.floor(J / 2)];
    const hl = T.height(m.x + n.x * inset, m.y + n.y * inset);
    const hr = T.height(m.x - n.x * inset, m.y - n.y * inset);
    sideSign = hr > hl ? -1 : 1;
  }
  for (const n of nIn) n.multiplyScalar(sideSign);
  // cumulative run length (m) per column for the along-wall noise domain
  const u: number[] = [0];
  for (let j = 1; j < J; j++) u.push(u[j - 1] + foot[j].distanceTo(foot[j - 1]));
  const length = u[J - 1];
  // per-column foot ground, top ground and face height (tapered at the ends)
  const footY: number[] = [];
  const topY: number[] = [];
  const faceH: number[] = [];
  let maxH = 0;
  for (let j = 0; j < J; j++) {
    const f = foot[j];
    const n = nIn[j];
    const fy = T.height(f.x, f.y);
    const ty = def.height !== undefined ? fy + def.height : T.height(f.x + n.x * inset, f.y + n.y * inset);
    const endW = smoothstep(0, taper, u[j]) * smoothstep(0, taper, length - u[j]);
    // the wall rides the bank: its own height is the ground rise, tapered to nothing at the ends
    // (the ends sink back into the slope, so the face never ends in a cut wall)
    const h = Math.max(0, ty - fy) * (0.25 + 0.75 * endW);
    footY.push(fy);
    topY.push(ty);
    faceH.push(h);
    maxH = Math.max(maxH, h);
  }
  // rows: the buried skirt (v < 0), the face (0..1), the lip shoulder (> 1)
  const faceRows = Math.max(8, Math.round(maxH / 0.1));
  const skirtRows = 2;
  const capRows = 4;
  const I = skirtRows + faceRows + capRows;
  // bedding: bed thickness and the tilt of the beds along the run
  const bedThick = rng.range(0.42, 0.6);
  const bedTilt = rng.range(-0.08, 0.08);
  const bedPhase = rng.range(0, 1);
  const bedOff = Array.from({ length: 12 }, () => rng.range(-1, 1));
  // vertical joints: block length along the wall
  const blockLen = rng.range(0.7, 1.1);
  const blockPhase = rng.range(0, 1);
  const seedOff = rng.range(-40, 40);

  /** bedding at wall coordinates (run u, height y): { groove 0..1, step -1..1 } */
  const bedding = (uu: number, y: number) => {
    const h = (y + uu * bedTilt) / bedThick + bedPhase + 0.16 * N.fbm(uu * 0.7 + seedOff, y * 0.7, 3.3, 2);
    const k = Math.floor(h);
    const f = h - k;
    const groove = 1 - smoothstep(0, 0.13, Math.min(f, 1 - f));
    return { groove, step: bedOff[((k % 12) + 12) % 12], k };
  };
  /** vertical joints: { joint 0..1, block id } — the blocks are offset per bed so joints stagger */
  const joints = (uu: number, y: number, bedK: number) => {
    const q = uu / blockLen + blockPhase + 0.37 * bedK + 0.12 * N.fbm(uu * 1.3 - seedOff, y * 1.9, 7.1, 2);
    const k = Math.floor(q);
    const f = q - k;
    const joint = 1 - smoothstep(0, 0.07, Math.min(f, 1 - f));
    return { joint, block: k };
  };

  // vertex grid (welded by construction: one vertex per (i, j), triangles copy exact values)
  const gx = new Float32Array(I * J);
  const gy = new Float32Array(I * J);
  const gz = new Float32Array(I * J);
  const gMoss = new Float32Array(I * J);
  const gWet = new Float32Array(I * J);
  const gCol = new Float32Array(I * J * 3);
  // damp dark stone: the face stands in the sun at ref-04's hour, so the tint itself carries the
  // dark (the hero boulders' 0.72 rendered this wall pale tan); the wet band takes the foot darker
  const stone = new Color(0.33, 0.34, 0.33);
  const dark = new Color(0.1, 0.095, 0.085);
  const soil = new Color(0.16, 0.14, 0.09);
  const at = (i: number, j: number) => i * J + j;
  for (let j = 0; j < J; j++) {
    const f = foot[j];
    const n = nIn[j];
    const h = faceH[j];
    const uu = u[j];
    for (let i = 0; i < I; i++) {
      // v: −skirt..0 buried, 0..1 the face, 1..1+cap the lip shoulder
      let v: number;
      let phase: 'skirt' | 'face' | 'cap';
      if (i < skirtRows) {
        v = -((skirtRows - i) / skirtRows) * 0.35;
        phase = 'skirt';
      } else if (i < skirtRows + faceRows) {
        v = (i - skirtRows) / faceRows;
        phase = 'face';
      } else {
        v = 1 + (i - skirtRows - faceRows + 1) / capRows;
        phase = 'cap';
      }
      const vf = clamp(v, 0, 1);
      const y0 = footY[j] + vf * h;
      // the face retreats a little with height (a lean back of ~12 % of the height) and the lip
      // overhangs the top: `lean` m out over the last quarter
      let back = 0.12 * h * vf - lean * smoothstep(0.55, 1.0, vf) * (h > 0.6 ? 1 : h / 0.6);
      let y = y0;
      let out = 0; // displacement along −n (toward the path)
      let moss = 0;
      let wet = 0;
      _tmp.copy(stone);
      const hs = Math.min(1, h / 1.5); // small (tapered) columns carry less relief
      if (phase === 'skirt') {
        y = footY[j] + v * 1.0; // 0.35 m into the ground
        back = 0.05;
        _tmp.copy(soil);
        wet = 1;
      } else if (phase === 'face') {
        // beds are continuous in world height, so they run level along a rising foot
        const bed = bedding(uu, y0);
        const jn = joints(uu, y0, bed.k);
        // relief: beds step ± 0.16 m, blocks ± 0.09 m, a ridged skin ± 0.06 m, micro ± 0.02 m —
        // all of it tapered to nothing at the foot row, which must sit exactly on the terrain
        const rd = N.ridged(uu * 1.7 + seedOff, y0 * 1.7, 2.2, 3);
        const mic = N.fbm(uu * 6.5 - seedOff, y0 * 6.5, 5.5, 2);
        const blockOff = N.fbm(jn.block * 3.7 + 0.5, bed.k * 2.9 + seedOff, 1.0, 1);
        const footTaper = smoothstep(0, 0.22, vf);
        out = hs * footTaper * (0.16 * bed.step + 0.09 * blockOff + 0.06 * (rd - 0.5) * 2 + 0.02 * mic);
        // the parting grooves and joints sink
        out -= hs * footTaper * (0.09 * bed.groove + 0.05 * jn.joint);
        // colour: bed tone ± 10 %, block tone ± 8 %, partings and joints dark, ridges a shade paler
        let tone = 1 + 0.1 * bed.step + 0.08 * blockOff + 0.14 * (rd - 0.5);
        _tmp.copy(stone).multiplyScalar(tone);
        _tmp.lerp(dark, 0.85 * Math.max(bed.groove, jn.joint * 0.9));
        // drip streaks below the lip: dark vertical streaks fading down ~2 m
        const streakN = N.fbm(uu * 4.1 + seedOff * 0.5, 2.0, 0.7, 2) * 0.5 + 0.5;
        const streak = smoothstep(0.54, 0.7, streakN) * smoothstep(0.45, 0.9, vf) * (1 - smoothstep(0.92, 1.0, vf));
        _tmp.lerp(dark, 0.55 * streak);
        // wet: the foot band (1.1 m, wobbled) and the streaks
        const yAbove = y0 - footY[j];
        wet = clamp(1 - smoothstep(0.25, 1.1, yAbove + 0.15 * (N.fbm(uu * 2.3, 1.1, 3.3, 2))) + 0.6 * streak, 0, 1);
        // moss sheets: damp patches under the lip and in the parting ledges (their up-facing
        // steps), big soft-edged patches ~0.6–1.4 m; none in the wet foot band
        const sheetN = N.fbm(uu * 0.9 + seedOff, y0 * 1.3, 9.9, 3) * 0.5 + 0.5;
        const ledgeMoss = smoothstep(0.35, 0.9, bed.groove) * (bed.step > 0 ? 0.8 : 0.35);
        const underLip = smoothstep(0.45, 0.85, vf);
        moss = clamp((smoothstep(0.42, 0.62, sheetN) * (0.6 + 0.4 * underLip) + ledgeMoss) * (1 - smoothstep(0.1, 0.4, wet)) * (1 - 0.7 * jn.joint), 0, 1) * hs;
        // the collar just above the ground: soil-dark
        _tmp.lerp(soil, 0.7 * (1 - smoothstep(0.02, 0.28, yAbove)));
      } else {
        // the lip shoulder: a quarter-round from the face's top edge back and down onto the top
        // ground, under a continuous moss sheet; the last row sits 6 cm into the top ground
        // a quarter-ellipse from the lip edge (back = lipBack, y = lipY) to the top ground point
        // (back = inset, y = the terrain there, 6 cm under it for contact): convex shoulder
        const c = clamp(v - 1, 0, 1); // 0 at the lip edge, 1 at the top ground point
        const ang = (c * Math.PI) / 2;
        const lipBack = 0.12 * h - lean * (h > 0.6 ? 1 : h / 0.6);
        const groundTop = topY[j] - 0.06;
        const lipY = footY[j] + h + 0.12 * hs;
        back = lipBack + (inset - lipBack) * Math.sin(ang);
        y = lipY + (groundTop - lipY) * (1 - Math.cos(ang));
        const lump = N.fbm(uu * 2.4 + seedOff, c * 3.1, 4.4, 2);
        out = hs * (0.06 * lump) * (1 - c);
        y += hs * 0.05 * lump * (1 - c);
        moss = 1 - 0.15 * (lump * 0.5 + 0.5);
        _tmp.copy(stone).multiplyScalar(0.9);
        wet = 0;
      }
      const px = f.x + n.x * back - n.x * out;
      const pz = f.y + n.y * back - n.y * out;
      const k = at(i, j);
      gx[k] = px;
      gy[k] = y;
      gz[k] = pz;
      gMoss[k] = moss;
      gWet[k] = wet;
      gCol[k * 3] = _tmp.r;
      gCol[k * 3 + 1] = _tmp.g;
      gCol[k * 3 + 2] = _tmp.b;
    }
  }

  // triangles (non-indexed, front faces toward −nIn: the path side). Skip degenerate columns.
  const pos: number[] = [];
  const col: number[] = [];
  const mossA: number[] = [];
  const wetA: number[] = [];
  const emit = (k: number) => {
    pos.push(gx[k], gy[k], gz[k]);
    col.push(gCol[k * 3], gCol[k * 3 + 1], gCol[k * 3 + 2]);
    mossA.push(gMoss[k]);
    wetA.push(gWet[k]);
  };
  for (let i = 0; i < I - 1; i++) {
    for (let j = 0; j < J - 1; j++) {
      const a = at(i, j);
      const b = at(i, j + 1);
      const c = at(i + 1, j + 1);
      const d = at(i + 1, j);
      // winding so the face normal points along −nIn (toward the path): test with the first quad
      emit(a);
      emit(c);
      emit(b);
      emit(a);
      emit(d);
      emit(c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('aMoss', new Float32BufferAttribute(mossA, 1));
  g.setAttribute('aWet', new Float32BufferAttribute(wetA, 1));
  computeCreaseNormals(g, 32);
  // orientation check: the mean face normal must point toward the path (−nIn); flip if not
  {
    const nrm = g.attributes.normal;
    let dot = 0;
    const mid = Math.floor(J / 2);
    for (let i = 0; i < nrm.count; i++) dot += nrm.getX(i) * -nIn[mid].x + nrm.getZ(i) * -nIn[mid].y;
    if (dot < 0) {
      const p = g.attributes.position as Float32BufferAttribute;
      for (let i = 0; i < p.count; i += 3) {
        _p.fromBufferAttribute(p, i + 1);
        _q.fromBufferAttribute(p, i + 2);
        p.setXYZ(i + 1, _q.x, _q.y, _q.z);
        p.setXYZ(i + 2, _p.x, _p.y, _p.z);
        for (const name of ['color', 'aMoss', 'aWet'] as const) {
          const a = g.attributes[name] as Float32BufferAttribute;
          const sz = a.itemSize;
          for (let s = 0; s < sz; s++) {
            const t1 = a.array[(i + 1) * sz + s];
            (a.array as Float32Array)[(i + 1) * sz + s] = a.array[(i + 2) * sz + s];
            (a.array as Float32Array)[(i + 2) * sz + s] = t1;
          }
        }
      }
      computeCreaseNormals(g, 32);
    }
  }
  // the moss sheets and the lip are soft: blend toward smooth normals where aMoss is high
  {
    const hard = (g.attributes.normal.array as Float32Array).slice();
    computeCreaseNormals(g, 100);
    const soft = g.attributes.normal.array as Float32Array;
    const m = g.attributes.aMoss;
    for (let i = 0; i < m.count; i++) {
      const w = smoothstep(0.3, 0.8, m.getX(i));
      const x = hard[i * 3] + (soft[i * 3] - hard[i * 3]) * w;
      const y = hard[i * 3 + 1] + (soft[i * 3 + 1] - hard[i * 3 + 1]) * w;
      const z = hard[i * 3 + 2] + (soft[i * 3 + 2] - hard[i * 3 + 2]) * w;
      const l = Math.hypot(x, y, z) || 1;
      hard[i * 3] = x / l;
      hard[i * 3 + 1] = y / l;
      hard[i * 3 + 2] = z / l;
    }
    g.setAttribute('normal', new Float32BufferAttribute(hard, 3));
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();

  // foot contacts: the row-0 face vertices sit on the terrain by construction; report every ~1 m
  const contacts: [number, number, number][] = [];
  for (let j = 0; j < J; j += Math.max(1, Math.round(1 / 0.24))) {
    const k = at(skirtRows, j);
    contacts.push([gx[k], gy[k], gz[k]]);
  }
  let nMoss = 0;
  let nWet = 0;
  for (let i = 0; i < mossA.length; i++) {
    if (mossA[i] > 0.5) nMoss++;
    if (wetA[i] > 0.5) nWet++;
  }
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  return {
    geometry: g,
    contacts,
    columns: J,
    rows: I,
    stats: { height: r3(maxH), length: r3(length), mossShare: r3(nMoss / mossA.length), wetShare: r3(nWet / wetA.length), triangles: pos.length / 9 },
  };
}
