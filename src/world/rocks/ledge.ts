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
  /**
   * the face's line, world xz, in order along the path. Either the FOOT (ground level on the path
   * side) or the LIP of a terrain step: when a point stands above a drop on the path side the
   * builder walks down the slope to its base and uses that as the foot, the given point as the
   * top's ground point (`LAYOUT.rockLedges.north-terrace` is authored at the terrace lip).
   */
  foot: [number, number][];
  /** which side of the walk direction the bank is on (default: whichever the terrain says is higher, probed 1–3 m out) */
  side?: 'left' | 'right';
  /** horizontal distance from the foot line to the top's ground point (default 2.2 m; added to the walked slope when the line is a lip) */
  inset?: number;
  /**
   * face height above the foot; omit to read it from the terrain at the top point (a terrain
   * step). Ignored when the line is a lip — the step's own rise is the height.
   */
  height?: number;
  /** how far the lip overhangs the face at the top, metres (default 0.35 m) */
  lean?: number;
  /** end taper: the face sinks into the bank over this run at both ends (default 1.4 m) */
  taper?: number;
  /**
   * root ridges per 3 m of run (default 0.7): rounded ridges of dark bark that emerge at the lip
   * and run down the face to the foot, wandering a little — ref-04's rock-AND-root wall. 0 = none.
   */
  roots?: number;
  /**
   * the stone's scale (default 1): beds, blocks, panels, the mass swell and the parting depths all
   * grow with it, so a 6–12 m CLIFF (the trailer's waterfall ruins, `review46/r_036–r_043`) reads as a
   * few thick beds and buttresses, not the 3 m terrace's fine strata stretched tall. Opt-in — the
   * north terrace's face is byte-identical at 1.
   */
  scale?: number;
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
const _tmp2 = new Color();

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
  const insetDef = def.inset ?? 2.2;
  const lean = def.lean ?? 0.35;
  const S = Math.max(1, def.scale ?? 1);
  // the authored line is the face at full height: it is extended along its end tangents by the
  // taper run on both sides, and those extensions are what sink into the bank. Columns on a
  // stair or a structure pad are dropped (the north terrace's line runs into the `ledge`
  // flight's flank at its east end: the face stops short of the treads).
  const authored = def.foot.map(([x, z]) => new Vector2(x, z));
  let authoredLen = 0;
  for (let k = 1; k < authored.length; k++) authoredLen += authored[k].distanceTo(authored[k - 1]);
  const ext = Math.min(def.taper ?? 1.4, 0.4 * authoredLen);
  const t0 = authored[1].clone().sub(authored[0]).normalize();
  const t1 = authored[authored.length - 1].clone().sub(authored[authored.length - 2]).normalize();
  const extended: [number, number][] = [
    [authored[0].x - t0.x * ext, authored[0].y - t0.y * ext],
    ...def.foot,
    [authored[authored.length - 1].x + t1.x * ext, authored[authored.length - 1].y + t1.y * ext],
  ];
  const line = resample(extended, 0.14).filter((p) => {
    const m = T.mask(p.x, p.y);
    return m.stairs < 0.3 && m.structure < 0.5;
  });
  const J = line.length;
  if (J < 3) throw new Error(`rock ledge ${def.id}: fewer than three columns off the stairs / structures`);
  // walk direction and the "into the bank" normal per column
  const tan: Vector2[] = [];
  const nIn: Vector2[] = [];
  for (let j = 0; j < J; j++) {
    const a = line[Math.max(0, j - 1)];
    const b = line[Math.min(J - 1, j + 1)];
    const t = b.clone().sub(a).normalize();
    tan.push(t);
    nIn.push(new Vector2(-t.y, t.x)); // left of the walk direction
  }
  // which side is the bank: the def says, or the terrain — the higher side, read as the mean of
  // the ground 1, 2 and 3 m out on each side of the mid-run point (a lip is a local crest, so the
  // ground right beside it says nothing; the slope 2–3 m out does)
  let sideSign = def.side === 'right' ? -1 : def.side === 'left' ? 1 : 0;
  if (sideSign === 0) {
    const m = line[Math.floor(J / 2)];
    const n = nIn[Math.floor(J / 2)];
    let hl = 0;
    let hr = 0;
    for (const d of [1, 2, 3]) {
      hl += T.height(m.x + n.x * d, m.y + n.y * d);
      hr += T.height(m.x - n.x * d, m.y - n.y * d);
    }
    sideSign = hr > hl ? -1 : 1;
  }
  for (const n of nIn) n.multiplyScalar(sideSign);
  // lip → base: a line point standing above a drop on the path side walks down the slope (0.1 m
  // steps along −n, while the ground keeps falling and stays off the paving, ≤ 4.5 m) to the base
  // of the step, which becomes the foot; the point itself becomes the top's ground point. The
  // walked distances are smoothed over neighbouring columns so the foot line stays a line.
  const walked = new Float32Array(J);
  for (let j = 0; j < J; j++) {
    const f = line[j];
    const n = nIn[j];
    const here = T.height(f.x, f.y);
    // a drop of ≥ 0.2 m within 1.5 m on the path side marks a lip (the crest may run flat first)
    let lowest = here;
    for (const d of [0.5, 1.0, 1.5]) lowest = Math.min(lowest, T.height(f.x - n.x * d, f.y - n.y * d));
    if (here - lowest < 0.2) continue;
    let d = 0;
    let prev = here;
    let descending = false;
    for (let k = 1; k <= 45; k++) {
      const x = f.x - n.x * k * 0.1;
      const z = f.y - n.y * k * 0.1;
      const hk = T.height(x, z);
      if (T.mask(x, z).path > 0.3) break;
      const fell = prev - hk >= 0.015;
      // the crest may run flat for up to 1.2 m before the slope; once descending, stop at the flat
      if (!fell && (descending || k * 0.1 > 1.2)) break;
      if (fell) descending = true;
      prev = hk;
      d = k * 0.1;
    }
    walked[j] = descending ? d : 0;
  }
  const walkedS = new Float32Array(J);
  for (let j = 0; j < J; j++) {
    let s = 0;
    let c = 0;
    for (let k = -2; k <= 2; k++) {
      const jj = Math.min(J - 1, Math.max(0, j + k));
      s += walked[jj];
      c++;
    }
    walkedS[j] = s / c;
  }
  const isLip = walkedS.some((w) => w > 0.3);
  const foot: Vector2[] = line.map((f, j) => f.clone().addScaledVector(nIn[j], -walkedS[j]));
  // cumulative run length (m) per column for the along-wall noise domain
  const u: number[] = [0];
  for (let j = 1; j < J; j++) u.push(u[j - 1] + foot[j].distanceTo(foot[j - 1]));
  const length = u[J - 1];
  // the end taper is the extension run (never more than a quarter of the whole run each side)
  const taper = Math.min(Math.max(ext, 0.4), 0.25 * length);
  // per-column inset (the def's, plus the slope walked), foot ground, top ground and face height.
  // The ends do not drop: the column SINKS into the bank along n (fable-5's review of the first
  // build: a height taper left the terrace's pale cut showing above the crest), so the lip stays
  // on the terrace top and the face runs back into the slope, its foot re-seated on the higher
  // ground it now stands on, until the face is nothing but the shoulder.
  const insetJ: number[] = [];
  const footY: number[] = [];
  const topY: number[] = [];
  const faceH: number[] = [];
  let maxH = 0;
  for (let j = 0; j < J; j++) {
    const n = nIn[j];
    const insetFull = insetDef + walkedS[j];
    const endW = smoothstep(0, taper, u[j]) * smoothstep(0, taper, length - u[j]);
    const topPt = foot[j].clone().addScaledVector(n, insetFull);
    const sink = (1 - endW) * 0.85 * insetFull;
    foot[j].addScaledVector(n, sink);
    const inset = Math.max(0.12, insetFull - sink);
    const fy = T.height(foot[j].x, foot[j].y);
    const ty = def.height !== undefined && !isLip ? fy + def.height * (0.25 + 0.75 * endW) : T.height(topPt.x, topPt.y);
    const h = Math.max(0, ty - fy);
    insetJ.push(inset);
    footY.push(fy);
    topY.push(ty);
    faceH.push(h);
    maxH = Math.max(maxH, h);
  }
  // root ridges (see RockLedgeDef.roots): each has a run position at the lip, a wander, a radius
  const rootsPer3m = def.roots ?? 1.1;
  const nRoots = Math.round((length / 3) * rootsPer3m);
  const roots: { u0: number; wander: number; R: number; phase: number }[] = [];
  for (let k = 0; k < nRoots; k++) {
    roots.push({ u0: length * ((k + 0.5 + rng.range(-0.3, 0.3)) / nRoots), wander: rng.range(-0.45, 0.45), R: rng.range(0.1, 0.16), phase: rng.range(0, 10) });
  }
  /**
   * root ridge at wall coordinates (run uu, face fraction vf 0 foot … 1 lip, > 1 shoulder):
   * bump (m), bark weight 0..1, and the longitudinal rib tone (bark is ribbed along the root)
   */
  const rootAt = (uu: number, vf: number) => {
    let bump = 0;
    let bark = 0;
    let rib = 0.5;
    for (const rt of roots) {
      // the ridge wanders across the run as it descends and thins toward the foot; over the
      // shoulder (vf > 1) it thickens back toward the tree it came from
      const centre = rt.u0 + rt.wander * (1 - Math.min(1, vf)) + 0.12 * N.fbm(vf * 2.1 + rt.phase, rt.u0 * 0.7, 2.2, 2);
      const taperR = vf >= 1 ? 1 + 0.15 * Math.min(1, vf - 1) : 0.45 + 0.55 * vf;
      const R = rt.R * taperR;
      const d = Math.abs(uu - centre);
      if (d >= 2 * R) continue;
      const w = 1 - (d / (2 * R)) * (d / (2 * R));
      const b = R * w * w;
      if (b > bump) {
        bump = b;
        // ribs: fast across the root (the d/R phase), slow along it
        rib = N.ridged((d / R) * 4.5 + rt.phase, vf * 1.3, 3.1, 2);
      }
      bark = Math.max(bark, smoothstep(0.12, 0.55, w));
    }
    return { bump, bark, rib };
  };
  // rows: the buried skirt (v < 0), the face (0..1), the lip shoulder (> 1)
  const faceRows = Math.max(8, Math.round(maxH / 0.1));
  const skirtRows = 2;
  const capRows = 4;
  const I = skirtRows + faceRows + capRows;
  // bedding: bed thickness and the tilt of the beds along the run
  // (fable-5's review at 3 m: "one smooth boulder, faint layering" — beds 0.3–0.45 m, so a 1.7 m
  // face carries four or five, stepped and parted hard enough to read from the clearing)
  const bedThick = rng.range(0.3, 0.45) * S;
  const bedTilt = rng.range(-0.08, 0.08);
  const bedPhase = rng.range(0, 1);
  const bedOff = Array.from({ length: 12 }, () => rng.range(-1, 1));
  // vertical joints: block length along the wall
  const blockLen = rng.range(0.7, 1.1) * S;
  const blockPhase = rng.range(0, 1);
  const seedOff = rng.range(-40, 40);

  /**
   * bedding at wall coordinates (run u, height y, face fraction vf): { groove 0..1, step -1..1 }.
   * The beds thin toward the top of the face (a full bed at the foot, 55 % of it under the lip —
   * fable-5 at 3 m: "chunky angular facets more than thin strata"), so the upper face reads as
   * layered stone while the base keeps its heavy blocks.
   */
  const bedding = (uu: number, y: number, vf = 0.5) => {
    // beds undulate along the run (slow) and pinch/swell (faster), so the ledges are not
    // evenly ruled lines
    const thick = bedThick * (1 - 0.45 * vf);
    // (a cliff's beds pinch, swell and die out along the run — at scale the ruled undulation of the
    // terrace's beds read as masonry courses; a slow, deep warp and a broken parting break the rows)
    const cliffWarp = S > 1 ? 0.9 * N.fbm((uu * 0.09) / S + seedOff * 0.3, (y * 0.11) / S + 1.3, 9.1, 2) : 0;
    const h = (y + uu * bedTilt) / thick + bedPhase + 0.3 * N.fbm(uu * 0.22 + seedOff, y * 0.3, 3.3, 2) + 0.16 * N.fbm(uu * 0.7 + seedOff, y * 0.7, 6.1, 2) + cliffWarp;
    const k = Math.floor(h);
    const f = h - k;
    let groove = 1 - smoothstep(0, 0.13, Math.min(f, 1 - f));
    if (S > 1) groove *= smoothstep(0.25, 0.6, N.fbm(uu * 0.35 + seedOff, y * 0.4 + 2.0, 10.3, 2) * 0.5 + 0.5);
    return { groove, step: bedOff[((k % 12) + 12) % 12], k };
  };
  /** vertical joints: { joint 0..1, block id } — the blocks are offset per bed so joints stagger */
  const joints = (uu: number, y: number, bedK: number) => {
    // (a cliff's joints are fewer and wander: the block length swings ± 40 % along the run)
    const bl = S > 1 ? blockLen * (1 + 0.4 * N.fbm(uu * 0.2 + seedOff, y * 0.1, 11.7, 1)) : blockLen;
    const q = uu / bl + blockPhase + 0.37 * bedK + 0.12 * N.fbm(uu * 1.3 - seedOff, y * 1.9, 7.1, 2);
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
  // bark: a warm mid brown — against the near-black damp stone a dark bark read as more stone
  // (fable-5 at 3–7 m); it separates in value and hue, and stays matte where the stone is wet
  const bark = new Color(0.36, 0.25, 0.14);
  for (let j = 0; j < J; j++) {
    const f = foot[j];
    const n = nIn[j];
    const h = faceH[j];
    const uu = u[j];
    const inset = insetJ[j];
    // the face climbs steeply: its top edge sits `retreat` behind the foot — 12 % of the height on
    // a free-standing shelf, 30 % of the inset when the face dresses a terrain slope (a 24° lean
    // over the north terrace's 1.7 m rise), the lip overhanging that by `lean`
    const retreat = Math.min(0.45 * inset, Math.max(0.12 * h, isLip ? 0.3 * inset : 0));
    const leanHere = lean * (h > 0.6 ? 1 : h / 0.6);
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
      // the face retreats to `retreat` at the top and the lip overhangs it over the last quarter
      let back = retreat * vf - leanHere * smoothstep(0.55, 1.0, vf);
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
        const bed = bedding(uu, y0, vf);
        const jn = joints(uu, y0, bed.k);
        // relief: beds step ± 0.16 m, blocks ± 0.09 m, a ridged skin ± 0.06 m, micro ± 0.02 m —
        // all of it tapered to nothing at the foot row, which must sit exactly on the terrain
        const rd = N.ridged((uu * 1.7) / S + seedOff, (y0 * 1.7) / S, 2.2, 3);
        const mic = N.fbm(uu * 6.5 - seedOff, y0 * 6.5, 5.5, 2);
        const blockOff = N.fbm(jn.block * 3.7 + 0.5, bed.k * 2.9 + seedOff, 1.0, 1);
        const footTaper = smoothstep(0, 0.22, vf);
        // (block offsets and the ridged skin shrink up the face with the beds: thin strata, not chunks)
        const thin = 1 - 0.4 * vf;
        // fable-2 (round-50 #1's macro half — fable-5 at 3 m: "still one lightly bulged plane … a face
        // of several planes"): the face in PANELS — 1.2–2 m wide, 0.6–1 m tall, each its own plane
        // stepping ± 0.12 m from its neighbours at wobbled but sharp boundaries (a joint or a bed
        // line: vertical and horizontal arrises, the frame's rock/root mass) — under a slow swell of
        // ± 0.1 m and a shelf where the upper bed stands proud over a recess. Tapered to nothing at
        // the foot row like the rest of the relief.
        const massN = N.fbm((uu * 0.42) / S + seedOff * 0.7, (y0 * 0.55) / S + 2.2, 4.4, 2);
        const pw = (1.6 + 0.4 * N.fbm(uu * 0.3 + 1.0, 0.5, 6.6, 1)) * S;
        const pu = uu / pw + 0.11 * seedOff + 0.08 * N.fbm(uu * 1.1, y0 * 1.6, 7.7, 2);
        const pv = y0 / (0.8 * S) + 0.07 * seedOff + 0.06 * N.fbm(uu * 1.4 + 3.0, y0 * 1.2, 8.2, 2);
        const pi = Math.floor(pu + 0.5 * Math.floor(pv)); // staggered like the blocks
        const pj = Math.floor(pv);
        const panelOff = N.fbm(pi * 2.3 + 0.7, pj * 3.1 + seedOff, 2.0, 1) * 2.4; // ≈ ± 1
        const shelfBand = smoothstep(0.5, 0.64, vf) * (1 - smoothstep(0.82, 0.92, vf));
        const recessBand = smoothstep(0.24, 0.4, vf) * (1 - smoothstep(0.46, 0.58, vf));
        const shelfN = N.fbm(uu * 0.6 + seedOff, 1.7, 8.8, 2) * 0.5 + 0.5;
        const shelf = smoothstep(0.35, 0.6, shelfN);
        // (a cliff is buttresses and clefts before it is courses: the mass swell doubles and deep vertical
        // fissures cut it, so the wall reads as a rock face and not a stacked one)
        const cliffMass = S > 1 ? 0.25 * massN : 0;
        const fissure = S > 1 ? smoothstep(0.72, 0.9, N.fbm((uu * 0.9) / S + seedOff * 1.3, (y0 * 0.12) / S, 12.4, 2) * 0.5 + 0.5) : 0;
        const mass = S * (0.12 * Math.max(-1, Math.min(1, panelOff)) + 0.22 * massN + cliffMass + 0.14 * shelf * shelfBand - 0.1 * shelf * recessBand) - 0.32 * S * fissure * (S > 1 ? 1 : 0);
        out = hs * footTaper * (mass + S * (0.2 * bed.step * (0.7 + 0.3 * thin) + 0.06 * blockOff * thin) + 0.05 * (rd - 0.5) * 2 * thin + 0.02 * mic);
        // the parting grooves and joints sink
        out -= hs * footTaper * S * (0.12 * bed.groove + (S > 1 ? 0.03 : 0.06) * jn.joint);
        // colour: bed tone ± 14 %, block tone ± 8 %, partings and joints dark, ridges a shade paler
        // (the mass in the tone too, a shade: a recess a little darker, a buttress a little paler)
        let tone = 1 + 0.14 * bed.step + 0.08 * blockOff + 0.14 * (rd - 0.5) + 0.2 * massN + 0.07 * Math.max(-1, Math.min(1, panelOff));
        _tmp.copy(stone).multiplyScalar(tone);
        _tmp.lerp(dark, 0.9 * Math.max(bed.groove, jn.joint * 0.9));
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
        // the damp band is in the stone's own colour too (a third darker, cooler), so it reads
        // from the clearing and not only inside the material's near fade
        _tmp.lerp(_tmp2.set(0.09, 0.1, 0.12), 0.35 * wet);
        // root ridges: a rounded bark ridge bulging out of the stone — bark, not stone: warmer and
        // darker, ribbed along its length, moss along its crest near the lip, thinning to the foot
        // (tapered with the relief at the foot row)
        const rt = rootAt(uu, vf);
        if (rt.bump > 0) {
          out += hs * footTaper * rt.bump * 1.2;
          const barkTone = (0.7 + 0.6 * rt.rib) * (0.9 + 0.2 * (N.fbm(uu * 9.1 + seedOff, y0 * 9.1, 1.3, 2) * 0.5 + 0.5));
          _tmp.lerp(_tmp2.copy(bark).multiplyScalar(barkTone), rt.bark);
          moss = Math.max(moss * (1 - 0.7 * rt.bark), rt.bark * 0.5 * smoothstep(0.55, 0.95, vf) * smoothstep(0.2, 0.8, rt.rib));
          wet *= 1 - 0.9 * rt.bark;
        }
      } else {
        // the lip shoulder: a quarter-round from the face's top edge back and down onto the top
        // ground, under a continuous moss sheet; the last row sits 6 cm into the top ground
        // a quarter-ellipse from the lip edge (back = lipBack, y = lipY) to the top ground point
        // (back = inset, y = the terrain there, 6 cm under it for contact): convex shoulder
        const c = clamp(v - 1, 0, 1); // 0 at the lip edge, 1 at the top ground point
        const ang = (c * Math.PI) / 2;
        const lipBack = retreat - leanHere;
        const groundTop = topY[j] - 0.06;
        // the lip stands 0.2 m proud of the terrace turf (was 0.12): it carries the top and hides
        // the terrain's cut behind it
        const lipY = footY[j] + h + 0.2 * hs;
        back = lipBack + (inset - lipBack) * Math.sin(ang);
        y = lipY + (groundTop - lipY) * (1 - Math.cos(ang));
        const lump = N.fbm(uu * 2.4 + seedOff, c * 3.1, 4.4, 2);
        out = hs * (0.06 * lump) * (1 - c);
        y += hs * 0.05 * lump * (1 - c);
        // the shoulder is the top bed broken into slabs: the vertical joints run on over it as
        // moss-filled grooves, the slab middles stand a little proud under a thinner moss skin,
        // so at 3 m the crest is a broken slab top, not one smooth hump
        const jn = joints(uu, lipY, 0);
        const slabW = (1 - smoothstep(0.999, 1.0, c)) * hs;
        y -= 0.05 * jn.joint * slabW;
        moss = clamp(0.72 + 0.28 * jn.joint - 0.12 * (lump * 0.5 + 0.5) * (1 - jn.joint), 0, 1);
        _tmp.copy(stone).multiplyScalar(0.9 + 0.08 * N.fbm(jn.block * 3.7 + 0.5, seedOff, 1.0, 1));
        _tmp.lerp(dark, 0.7 * jn.joint);
        wet = 0;
        // the roots run on over the shoulder toward the trees they came from, thickening
        const rt = rootAt(uu, 1 + c);
        if (rt.bump > 0 && c < 0.999) {
          y += hs * 0.6 * rt.bump * (1 - c);
          const barkTone = (0.7 + 0.6 * rt.rib) * (0.9 + 0.2 * (N.fbm(uu * 9.1 + seedOff, c * 9.1, 1.3, 2) * 0.5 + 0.5));
          _tmp.lerp(_tmp2.copy(bark).multiplyScalar(barkTone), rt.bark * (1 - c));
          moss = Math.max(0.3 * (1 - rt.bark) + 0.45 * smoothstep(0.3, 0.8, rt.rib) * rt.bark, moss - 0.6 * rt.bark * (1 - c));
        }
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
  // foot contacts (audit): the standing part of the face only — the end columns sink into the
  // bank and their feet are up the slope by design
  const contacts: [number, number, number][] = [];
  for (let j = 0; j < J; j += Math.max(1, Math.round(1 / 0.24))) {
    const endW = smoothstep(0, taper, u[j]) * smoothstep(0, taper, length - u[j]);
    if (endW < 0.6) continue;
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
