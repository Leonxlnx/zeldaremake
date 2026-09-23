/**
 * Round bark-timber nosings on the hero flight (fable-2 for hardscape, fable-cursor's 2026-09-21 10:45
 * offer; ANALYSIS_VIDEO2 §9 / V18′ / W02): the demo's stair is log-risered — a dark round timber
 * ≈ 0.15–0.20 m across lies along every riser's top edge with moss on its upper side, and short
 * end stakes hold the logs every second step. Ours was cut stone with a moss lip; §9 calls the logs
 * "the single largest change left at A".
 *
 * Built as its own mesh over the stone flight (which stays as it is, so the change can be pulled by
 * `STAIR_LOGS`): one bark geometry per flight on `bark_brown_02` (lifted and cooled to the frames'
 * lit grey-tan `#746d5d` — `LOG_TINT` — with a strong normal map, vertex colours carrying the moss and
 * the damp underside). The log rides the slab's front edge, its crown ≈ 6 cm proud of the tread — the timber
 * is the step's edge, the pale slab the tread behind it — and its front tangent 10 cm past the nose line.
 * Every draw is a hash or a noise field keyed on the step, so the flight's stone stream is untouched.
 */
import { BufferGeometry, Color, Float32BufferAttribute, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import type { StairDef } from '../layout';
import type { WorldConfig } from '../config';
import type { TextureLibrary } from '../materials/textures';
import { applyShadeFloor } from '../materials/shadeFloor';
import { LOG_BARK_FLOOR } from '../structures/materials';
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
/**
 * The timber's tint over `bark_brown_02` (linear mean 0.113 / 0.091 / 0.047 — a dark, orange bark).
 * The first takes carried the log arch's `0x6e6258` (≈ 0.15 linear), an effective albedo near 2 %,
 * and were tuned with the tube's side triangles wound inward (Astra's fix, 27c2e3c8): what read as
 * "the timber" then was the far inner wall. With the faces outward the A frame's flight measured
 * lips l 68 over troughs 63 where the reference has l 100 over 85 (§6.6b: bark `#746d5d` lit, shadow
 * `#453e32`) — the dark logs sat exactly where the lit lips belong. The tint lifted the bark to a
 * lit grey-tan and cooled the texture's orange (R/B 2.4 → 1.4) at [1.35, 1.5, 2.3], pinning the
 * A-frame lips ≈ 15 points over the treads behind.
 * 2026-09-23 (owner review: this flight's "odd repeated pattern"): at the player's distance that
 * tint read as twenty identical silver-white birch poles striped against their shaded treads.
 * Swept at runtime on the owner's pose (gauntlet/scripts/probe-look.mjs, ×1.0 / 0.7 / 0.52 / 0.4):
 * at ≈ half the old lift the timber sits in the stone's value range as weathered grey-brown wood
 * (R/B 1.8), the steps read as stone treads with timber edges, and the lit crowns still lead.
 */
export const LOG_TINT: [number, number, number] = [0.76, 0.74, 1.0];
/**
 * The shade floor's light tint (the tone the shaded side is lifted toward). The arch's
 * `HOUSE_BARK_TINT` (0x70553f, a saturated brown) put the flight's saturation at 0.36 whatever the
 * albedo; the reference's lit bark tone itself keeps the lifted shade grey-tan.
 */
export const LOG_FLOOR_TINT = 0x746d5d;

export interface LogNosingBuild {
  geometry: BufferGeometry;
  logs: number;
  stakes: number;
  triangles: number;
}

const RADIAL = 14;
const ALONG = 18;

/** the timber material: the arch's bark set and shade floor, tinted to the frames' lit grey-tan (`LOG_TINT`, `LOG_FLOOR_TINT`) */
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
    color: new Color(...LOG_TINT),
    vertexColors: true,
  });
  applyShadeFloor(mat, LOG_BARK_FLOOR, new Color(LOG_FLOOR_TINT));
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
   * ridges; `colorAt(t, angle, upness)` gives the vertex colour. `look` makes each timber its own
   * piece of wood (2026-09-23, the owner's "odd repeated pattern" on this flight: every log's bark
   * started at u = 0 at the same end, tiled every 0.6 m and began its roll at the same angle, so
   * the map's features lined up in columns down all twenty risers):
   *  - `uvOffset` / `uvTile`: where along the bark map this log starts, and its repeat (m). The
   *    map's fissures run up the image, so the image's v runs ALONG the log (the grain follows the
   *    timber; the first mapping ran it round the circumference, rings across every log) and u
   *    round it, one turn of the map per `uvAround` of circumference
   *  - `roll`: the log's rotation about its own axis (rad) — which side of the bark faces up
   *  - `buttAtA` / `taper`: a felled log is thicker at the butt; laid as it came, either way round
   *  - `bow` / `bowDir`: a gentle sweep along the length (m, peak at mid-span), kept horizontal
   *  - `ridgeAt(t)`: the bark ridges' scale along the length (worn flatter where feet land)
   */
  type TubeLook = { uvOffset: number; uvTile: number; uvAround: number; uvShift: number; roll: number; buttAtA: boolean; taper: number; bow: number; bowDir: Vector3; ridgeAt?: (t: number) => number };
  const plainLook = (taper: number): TubeLook => ({ uvOffset: 0, uvTile: 0.9, uvAround: 0.6, uvShift: 0, roll: 0, buttAtA: true, taper, bow: 0, bowDir: new Vector3() });
  const tube = (a: Vector3, b: Vector3, r: number, seedK: number, wobble: number, ridges: number, colorAt: (t: number, ang: number, up: number, n: Vector3) => Color, look: TubeLook) => {
    const axis = new Vector3().subVectors(b, a);
    const len = axis.length();
    axis.normalize();
    // a stable radial frame around the axis, turned by the log's own roll
    const ref = Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const f1 = new Vector3().crossVectors(axis, ref).normalize();
    const f2 = new Vector3().crossVectors(axis, f1).normalize();
    const n1 = f1.clone().multiplyScalar(Math.cos(look.roll)).addScaledVector(f2, Math.sin(look.roll));
    const n2 = new Vector3().crossVectors(axis, n1).normalize();
    const base = pos.length / 3;
    const p = new Vector3();
    const n = new Vector3();
    // whole turns of the (tiling) map round the circumference, so the wrap has no seam
    const turns = Math.max(1, Math.round((Math.PI * 2 * r) / look.uvAround));
    for (let i = 0; i <= ALONG; i++) {
      const t = i / ALONG;
      // the log swells and pinches along its length and tapers from its butt to its tip
      const swell = 1 + wobble * bark.noise(t * 6.3 + seedK * 0.37, seedK * 1.7);
      const fromButt = look.buttAtA ? t : 1 - t;
      const tap = 1 - look.taper * fromButt;
      const sweep = look.bow * Math.sin(Math.PI * t);
      const ridgeK = look.ridgeAt ? look.ridgeAt(t) : 1;
      for (let j = 0; j <= RADIAL; j++) {
        const ang = (j / RADIAL) * Math.PI * 2;
        // bark ridges: angular noise ± `ridges`, running along the length
        const ridge = ridges * ridgeK * bark.noise(ang * 1.9 + seedK * 3.1, t * 14 + seedK);
        const rr = r * swell * tap + ridge;
        n.copy(n1).multiplyScalar(Math.cos(ang)).addScaledVector(n2, Math.sin(ang));
        p.copy(a).addScaledVector(axis, t * len).addScaledVector(look.bowDir, sweep).addScaledVector(n, rr);
        pos.push(p.x, p.y, p.z);
        nrm.push(n.x, n.y, n.z);
        uv.push(look.uvShift + (j / RADIAL) * turns, look.uvOffset + (t * len) / look.uvTile);
        const c = colorAt(t, ang, n.y, n);
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
      const endFromButt = look.buttAtA === (dir > 0) ? 1 : 0;
      const rEnd = r * (1 - look.taper * endFromButt);
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

  // the run's along axis in world xz: the logs' bow stays horizontal so a crown's height holds
  const [ax0, az0] = stairToWorld(f, 0, 0);
  const [ax1, az1] = stairToWorld(f, 0, 1);
  const alongDir = new Vector3(ax1 - ax0, 0, az1 - az0).normalize();
  // where feet land across the flight — the stone treads' own `feet` band: the centre third
  const walked = (across: number) => 1 - smoothstep(0.3 * hw, 0.85 * hw, Math.abs(across));
  // boots rub the bark off the crown: smoother, darker, polished with trodden dirt (not paler)
  const wornCol = new Color(0.8, 0.72, 0.62);
  const soilCol = new Color(0.46, 0.4, 0.33);

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
    const span = 2 * hw + overL + overR;
    const a = new Vector3(...worldOf(-hw - overL, along, cy));
    const b = new Vector3(...worldOf(hw + overR, along, cy));
    // a slight sag / tilt across (a few mm), so the run is not ruled
    a.y += 0.01 * (hash2(i, 31, 7) - 0.5);
    b.y += 0.01 * (hash2(i, 37, 7) - 0.5);
    // the timber's age: 0 a newer log (warm brown bark), 1 an old one (silvered, mossier). A step
    // or two was repaired: a newer, warmer log, hardly worn yet; an old log may have checked (a
    // dark split along its crown)
    const replaced = hash2(i, 131, 7) > 0.88;
    const age = replaced ? 0.04 : hash2(i, 83, 7);
    const logTone = (replaced ? 1.07 : 1) * (0.9 + 0.2 * hash2(i, 89, 7));
    const wearK = replaced ? 0.3 : 1;
    const checked = !replaced && hash2(i, 137, 7) > 0.8;
    const acrossAt = (t: number) => -hw - overL + t * span;
    tube(
      a,
      b,
      r,
      i * 1.13,
      0.07,
      0.006,
      (t, ang, up, n) => {
        const across = acrossAt(t);
        const w = walked(across);
        const tone = (0.82 + 0.28 * (bark.noise(t * 9 + i * 2.3, ang * 1.3) * 0.5 + 0.5)) * logTone;
        tmpC.setRGB(tone * (1.04 - 0.1 * age) * (replaced ? 1.05 : 1), tone * (0.97 - 0.02 * age), tone * (0.9 + 0.07 * age) * (replaced ? 0.93 : 1));
        // the crown where boots land: bark rubbed smooth and dark with trodden dirt
        tmpC.lerp(wornCol, 0.5 * w * wearK * smoothstep(0.35, 0.9, up));
        // an old log's check: a thin dark split along the crown, broken where the wood held
        if (checked && up > 0.88 && Math.abs(n.x * alongDir.x + n.z * alongDir.z) < 0.07 && bark.noise(t * 11 + i * 1.9, 4.7) > -0.25) tmpC.multiplyScalar(0.38);
        const under = smoothstep(0.1, -0.6, up);
        tmpC.lerp(dampCol, 0.55 * under);
        // soil and grit packed into the crease against the tread behind the log
        const back = n.x * alongDir.x + n.z * alongDir.z;
        tmpC.lerp(soilCol, 0.6 * smoothstep(0.2, 0.8, back) * smoothstep(0.3, -0.2, up));
        // moss on the upper side where nobody steps: the ends and flanks, more on the older logs
        const mossField = mossN.fbm(t * 4.2 + i * 1.7, ang * 0.8 + 0.5, 2) * 0.5 + 0.5;
        const moss = smoothstep(0.1, 0.8, up) * smoothstep(0.42, 0.62, mossField) * (1 - 0.85 * w) * (replaced ? 0.25 : 0.6 + 0.4 * age);
        tmpC.lerp(mossCol, 0.85 * moss);
        return tmpC;
      },
      {
        uvOffset: 7.3 * hash2(i, 59, 7),
        // the map covers ≈ 0.6 m of bark; a 0.8–1.3 m repeat along keeps its two knots from
        // recurring down the flight in step
        uvTile: 0.8 + 0.5 * hash2(i, 61, 7),
        uvAround: 0.55,
        uvShift: hash2(i, 63, 7),
        roll: Math.PI * 2 * hash2(i, 67, 7),
        buttAtA: hash2(i, 71, 7) < 0.5,
        taper: 0.1 + 0.12 * hash2(i, 73, 7),
        bow: 0.05 * (hash2(i, 79, 7) - 0.5),
        bowDir: alongDir,
        ridgeAt: (t) => 1 - 0.7 * wearK * walked(acrossAt(t)),
      },
    );
    logs++;
    // end stakes where a builder needed them: most even steps and an odd one now and then, and
    // an end that sat firm got none — not a post pair every second riser like a fence
    const stakeStep = i % 2 === 0 ? hash2(i, 97, 7) < 0.8 : hash2(i, 101, 7) < 0.25;
    if (stakeStep) {
      for (const side of [-1, 1] as const) {
        if (hash2(i, side < 0 ? 103 : 107, 7) < 0.18) continue;
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
          { ...plainLook(0.15), uvOffset: 3.1 * hs, roll: Math.PI * 2 * hash2(i, side < 0 ? 109 : 113, 7) },
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

