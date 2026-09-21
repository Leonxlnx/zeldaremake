/**
 * Round bark-timber nosings on the hero flight (fable-2 for hardscape, fable-cursor's 2026-09-21 10:45
 * offer; ANALYSIS_VIDEO2 §9 / V18′ / W02): the demo's stair is log-risered — a dark round timber
 * ≈ 0.15–0.20 m across lies along every riser's top edge with moss on its upper side, and short
 * end stakes hold the logs every second step. Ours was cut stone with a moss lip; §9 calls the logs
 * "the single largest change left at A".
 *
 * Built as its own mesh over the stone flight (which stays as it is, so the change can be pulled by
 * `STAIR_LOGS`): one bark geometry per flight, structures' `logBark` recipe on `bark_brown_02`
 * (dark weathered grey-brown, strong normal map, vertex colours carrying the moss and the damp
 * underside). The log rides the slab's front edge, its crown ≈ 6 cm proud of the tread — the timber
 * is the step's edge, the pale slab the tread behind it — and its front tangent 10 cm past the nose line.
 * Every draw is a hash or a noise field keyed on the step, so the flight's stone stream is untouched.
 */
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import type { StairDef } from '../layout';
import type { WorldConfig } from '../config';
import type { TextureLibrary } from '../materials/textures';
import { applyShadeFloor } from '../materials/shadeFloor';
import { HOUSE_BARK_TINT, LOG_BARK_FLOOR } from '../structures/materials';
import { hash2 } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { stairFrame, stairToWorld } from './stairs';

/** the log nosings on the main flight (false: the cut-stone flight as it was) */
export const STAIR_LOGS = true;
/** flights that take the logs (the demo shows them on the hero flight; the house-west and expansion flights stay stone) */
export const LOG_FLIGHTS = new Set(['main']);
/** log radius range (m): ≈ 0.16–0.20 m across, §9 */
export const LOG_RADIUS: [number, number] = [0.08, 0.1];
/**
 * the log's crown above the tread surface, as a share of its radius: 0.7 → a 0.18 m log stands
 * ≈ 6 cm proud, its upper half in the light — the timber IS the step's edge (first take: 3.5 cm and
 * the slab's nose rode over it — a stone stair with a bark band, the reverse of log-risered)
 */
export const LOG_PROUD_R = 0.7;
/** the log's front tangent this far in front of the slab's nose line (m); the slab noses overhang their risers 6.5–9.5 cm */
export const LOG_FRONT = 0.1;
/** stake radius and height above the tread (m) */
export const STAKE_RADIUS = 0.045;
export const STAKE_HEIGHT: [number, number] = [0.22, 0.34];

export interface LogNosingBuild {
  geometry: BufferGeometry;
  logs: number;
  stakes: number;
  triangles: number;
}

const RADIAL = 14;
const ALONG = 18;

/** the timber material: structures' log-arch bark recipe, a shade darker for the damp flight */
export async function createStairTimberMaterial(textures: TextureLibrary, config: WorldConfig, anisotropy = 8): Promise<MeshStandardMaterial> {
  const [barkC, barkN, barkR] = await Promise.all([
    textures.load('bark_brown_02', 'color', { anisotropy }),
    textures.load('bark_brown_02', 'normal', { anisotropy }),
    textures.load('bark_brown_02', 'roughness', { anisotropy }),
  ]);
  const mat = new MeshStandardMaterial({
    map: barkC,
    normalMap: barkN,
    normalScale: new Vector2(2.0, 2.0),
    roughnessMap: barkR,
    roughness: 1,
    color: new Color(0x6e6258),
    vertexColors: true,
  });
  applyShadeFloor(mat, LOG_BARK_FLOOR, new Color(HOUSE_BARK_TINT));
  mat.name = 'stair-timber';
  return mat;
}

/**
 * The logs and stakes of one flight, in world space. Deterministic: every value is a hash of the
 * step (or a noise field), no stream draws.
 */
export function buildLogNosings(def: StairDef, seed: string): LogNosingBuild {
  const f = stairFrame(def);
  const bark = new Noise2D(`${seed}/stair-logs-bark-${def.id}`);
  const mossN = new Noise2D(`${seed}/stair-logs-moss-${def.id}`);
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const hw = def.width / 2;
  // stair-local frame → world: across (right of the ascent), along the run
  const worldOf = (across: number, along: number, y: number): [number, number, number] => {
    const [wx, wz] = stairToWorld(f, across, along);
    return [wx, def.base[1] + y, wz];
  };
  const tmpC = new Color();
  const mossCol = new Color(0.62, 1.05, 0.42);
  const dampCol = new Color(0.78, 0.74, 0.7);

  /**
   * a cylinder along `axis` from `a` to `b` (world), radius `r` with a per-ring wobble and bark
   * ridges; `colorAt(t, angle, upness)` gives the vertex colour
   */
  const tube = (a: Vector3, b: Vector3, r: number, seedK: number, wobble: number, ridges: number, colorAt: (t: number, ang: number, up: number) => Color, taper = 0) => {
    const axis = new Vector3().subVectors(b, a);
    const len = axis.length();
    axis.normalize();
    // a stable radial frame around the axis
    const ref = Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const n1 = new Vector3().crossVectors(axis, ref).normalize();
    const n2 = new Vector3().crossVectors(axis, n1).normalize();
    const base = pos.length / 3;
    const p = new Vector3();
    const n = new Vector3();
    for (let i = 0; i <= ALONG; i++) {
      const t = i / ALONG;
      // the log swells and pinches along its length, and thins toward a tapered end
      const swell = 1 + wobble * bark.noise(t * 6.3 + seedK * 0.37, seedK * 1.7);
      const tap = 1 - taper * smoothstep(0.7, 1, t);
      for (let j = 0; j <= RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2;
        // bark ridges: angular noise ± `ridges`, running along the length
        const ridge = ridges * bark.noise(ang * 1.9 + seedK * 3.1, t * 14 + seedK);
        const rr = r * swell * tap + ridge;
        n.copy(n1).multiplyScalar(Math.cos(ang)).addScaledVector(n2, Math.sin(ang));
        p.copy(a).addScaledVector(axis, t * len).addScaledVector(n, rr);
        pos.push(p.x, p.y, p.z);
        nrm.push(n.x, n.y, n.z);
        uv.push((t * len) / 0.6, j / RADIAL);
        const c = colorAt(t, ang, n.y);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < ALONG; i++) {
      for (let j = 0; j < RADIAL; j++) {
        const a0 = base + i * (RADIAL + 1) + j;
        const a1 = a0 + 1;
        const b0 = a0 + RADIAL + 1;
        const b1 = b0 + 1;
        idx.push(a0, a1, b0, a1, b1, b0);
      }
    }
    // end caps: a fan on each end (the sawn face, paler wood)
    for (const [end, dir] of [
      [a, -1],
      [b, 1],
    ] as const) {
      const cBase = pos.length / 3;
      const cap = new Color(0.95, 0.86, 0.7);
      pos.push(end.x, end.y, end.z);
      nrm.push(axis.x * dir, axis.y * dir, axis.z * dir);
      uv.push(0.5, 0.5);
      col.push(cap.r, cap.g, cap.b);
      const rEnd = r * (dir > 0 ? 1 - taper : 1);
      for (let j = 0; j <= RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2;
        n.copy(n1).multiplyScalar(Math.cos(ang)).addScaledVector(n2, Math.sin(ang));
        p.copy(end).addScaledVector(n, rEnd * 0.98);
        pos.push(p.x, p.y, p.z);
        nrm.push(axis.x * dir, axis.y * dir, axis.z * dir);
        uv.push(0.5 + 0.5 * Math.cos(ang), 0.5 + 0.5 * Math.sin(ang));
        const ring = 0.85 + 0.15 * bark.noise(ang * 3 + seedK, seedK * 0.5);
        col.push(cap.r * ring, cap.g * ring, cap.b * ring);
      }
      for (let j = 0; j < RADIAL; j++) {
        const v1 = cBase + 1 + j;
        const v2 = cBase + 1 + j + 1;
        if (dir > 0) idx.push(cBase, v1, v2);
        else idx.push(cBase, v2, v1);
      }
    }
  };

  let logs = 0;
  let stakes = 0;
  for (let i = 0; i < def.steps; i++) {
    const h = hash2(i, 11, 7);
    const h2 = hash2(i, 23, 7);
    const r = LOG_RADIUS[0] + (LOG_RADIUS[1] - LOG_RADIUS[0]) * h;
    const topY = (i + 1) * def.rise;
    const cy = topY - r + LOG_PROUD_R * r;
    // the log rides the slab's front edge like a fixed timber kerb: its front tangent LOG_FRONT
    // past the nose line, its back over the slab's first 8 cm; the overhang past the flanks is uneven
    const along = i * def.tread - LOG_FRONT + r;
    const overL = 0.08 + 0.1 * h2;
    const overR = 0.08 + 0.1 * hash2(i, 29, 7);
    const a = new Vector3(...worldOf(-hw - overL, along, cy));
    const b = new Vector3(...worldOf(hw + overR, along, cy));
    // a slight sag / tilt across (a few mm), so the run is not ruled
    a.y += 0.01 * (hash2(i, 31, 7) - 0.5);
    b.y += 0.01 * (hash2(i, 37, 7) - 0.5);
    tube(
      a,
      b,
      r,
      i * 1.13,
      0.07,
      0.006,
      (t, ang, up) => {
        // bark tone: a dark weathered timber, the underside damp and darker, the crown taking moss
        // in patches (the demo's logs are mossy on top)
        const tone = 0.82 + 0.28 * (bark.noise(t * 9 + i * 2.3, ang * 1.3) * 0.5 + 0.5);
        tmpC.setRGB(tone, tone * 0.97, tone * 0.93);
        const under = smoothstep(0.1, -0.6, up);
        tmpC.lerp(dampCol, 0.55 * under);
        const mossField = mossN.fbm(t * 4.2 + i * 1.7, ang * 0.8 + 0.5, 2) * 0.5 + 0.5;
        const moss = smoothstep(0.25, 0.85, up) * smoothstep(0.42, 0.62, mossField);
        tmpC.lerp(mossCol, 0.85 * moss);
        return tmpC;
      },
      0.12 * hash2(i, 41, 7),
    );
    logs++;
    // end stakes every second step: a short post driven in at each log end, leaning a little
    if (i % 2 === 0) {
      for (const side of [-1, 1] as const) {
        const over = side < 0 ? overL : overR;
        const across = side * (hw + over - 0.04);
        const hs = hash2(i, side < 0 ? 43 : 47, 7);
        const height = STAKE_HEIGHT[0] + (STAKE_HEIGHT[1] - STAKE_HEIGHT[0]) * hs;
        const foot = new Vector3(...worldOf(across, along + r + STAKE_RADIUS + 0.01, topY - 0.3));
        const head = new Vector3(...worldOf(across + side * 0.03 * (hs - 0.3), along + r + STAKE_RADIUS + 0.01 + 0.02 * (hash2(i, 53, 7) - 0.5), topY + height));
        tube(
          foot,
          head,
          STAKE_RADIUS,
          i * 2.71 + side,
          0.05,
          0.004,
          (t, ang) => {
            const tone = 0.78 + 0.25 * (bark.noise(t * 7 + i, ang * 1.1 + side) * 0.5 + 0.5);
            tmpC.setRGB(tone, tone * 0.96, tone * 0.9);
            // the driven foot is dark and damp; the top weathers pale
            tmpC.lerp(dampCol, 0.6 * (1 - smoothstep(0.1, 0.5, t)));
            tmpC.multiplyScalar(1 + 0.12 * smoothstep(0.8, 1, t));
            return tmpC;
          },
          0.15,
        );
        stakes++;
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setIndex(idx);
  geometry.computeBoundingSphere();
  return { geometry, logs, stakes, triangles: idx.length / 3 };
}

