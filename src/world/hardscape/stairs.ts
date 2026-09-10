/**
 * Procedural stone stairways (W02). Every tread is a distinct hand-cut slab: jittered outline,
 * chipped corners, bevelled edges, a slightly dished top and small yaw/depth variation; ~1/3 of
 * the treads are split into two stones. Risers are separate darker stones (sometimes two or three
 * stacked pieces). Both flanks get stacked retaining stones ("cheeks") that step up with the run
 * and sink into the embankment, and the top gets a short landing of slabs so the stair meets the
 * plateau flush. Moss is written into the `aMoss` attribute where joints/edges meet grass.
 */
import { BufferGeometry, Matrix4, Vector3 } from 'three';
import type { StairDef } from '../layout';
import type { Terrain } from '../terrain/heightfield';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { MeshBuilder, buildSlab, jitteredRect, type P2 } from './geometry';

export interface StairFrame {
  def: StairDef;
  base: Vector3;
  dx: number;
  dz: number;
  run: number;
  matrix: Matrix4;
}

export function stairFrame(def: StairDef): StairFrame {
  const l = Math.hypot(def.dir[0], def.dir[1]);
  const dx = def.dir[0] / l;
  const dz = def.dir[1] / l;
  // local x = across (right-handed with local z = ascent), local z = along the ascent
  const m = new Matrix4().makeBasis(new Vector3(dz, 0, -dx), new Vector3(0, 1, 0), new Vector3(dx, 0, dz));
  m.setPosition(def.base[0], def.base[1], def.base[2]);
  return { def, base: new Vector3(def.base[0], def.base[1], def.base[2]), dx, dz, run: def.steps * def.tread, matrix: m };
}

/** local (across, along) → world xz */
export function stairToWorld(f: StairFrame, across: number, along: number): [number, number] {
  return [f.base.x + across * f.dz + along * f.dx, f.base.z - across * f.dx + along * f.dz];
}

/** world xz → local (across, along) */
export function worldToStair(f: StairFrame, x: number, z: number): [number, number] {
  const rx = x - f.base.x;
  const rz = z - f.base.z;
  return [rx * f.dz - rz * f.dx, rx * f.dx + rz * f.dz];
}

/** true if the point lies in the stair footprint incl. cheeks and landing (no flagstones here) */
export function inStairFootprint(f: StairFrame, x: number, z: number, margin = 0): boolean {
  const [a, u] = worldToStair(f, x, z);
  return u > -0.3 - margin && u < f.run + 1.75 + margin && Math.abs(a) < f.def.width / 2 + 0.5 + margin;
}

export interface StairBuild {
  geometry: BufferGeometry;
  steps: number;
  treadSlabs: number;
  shapeHashes: string[];
  triangles: number;
  /** world-space points on the top of every tread's front edge (for the audit) */
  treadNose: [number, number, number][];
}

function outlineHash(p: P2[]): string {
  return p.map((q) => `${Math.round(q.x * 200)}:${Math.round(q.z * 200)}`).join('|');
}

export function buildStairway(def: StairDef, terrain: Terrain, rng: Rng, seed: string): StairBuild {
  const f = stairFrame(def);
  const noise = new Noise2D(`${seed}/stairs-moss-${def.id}`);
  const wear = new Noise2D(`${seed}/stairs-wear-${def.id}`);
  const all = new MeshBuilder();
  const w = def.width;
  const hw = w / 2;
  const shapeHashes: string[] = [];
  const treadNose: [number, number, number][] = [];
  let treadSlabs = 0;
  const tmpM = new Matrix4();
  const uvScale = 1 / 1.7;

  // moss field in stair-local coords: stronger toward both flanks and slightly up the run
  const mossAt = (ax: number, al: number) => {
    const edge = smoothstep(hw - 0.85, hw + 0.05, Math.abs(ax));
    const n = noise.fbm(ax * 1.9 + 3.1, al * 1.9 - 7.7, 3) * 0.5 + 0.5;
    return clamp((0.16 + 0.9 * edge) * (0.45 + 0.95 * n), 0, 1);
  };

  const placeSlab = (outline: P2[], cx: number, cy: number, cz: number, yaw: number, tiltX: number, tiltZ: number, opts: Parameters<typeof buildSlab>[2]) => {
    const mb = new MeshBuilder();
    buildSlab(mb, outline, opts);
    tmpM.makeRotationY(yaw);
    if (tiltX || tiltZ) {
      const t = new Matrix4().makeRotationX(tiltX).multiply(new Matrix4().makeRotationZ(tiltZ));
      tmpM.multiply(t);
    }
    tmpM.setPosition(cx, cy, cz);
    mb.transform(tmpM);
    all.append(mb);
    return mb;
  };

  const baseY = 0; // local y relative to def.base[1]
  for (let i = 0; i < def.steps; i++) {
    const topY = baseY + (i + 1) * def.rise + rng.range(-0.008, 0.008);
    const ts = rng.range(0.11, 0.15); // slab thickness
    const nose = rng.range(0.02, 0.045);
    const uFront = i * def.tread - nose + rng.range(-0.012, 0.012);
    const uBack = (i + 1) * def.tread + 0.03;
    const depth = uBack - uFront;
    const yaw = rng.range(-0.02, 0.02);
    // worn treads: a darker grey-brown than the plaza slabs (reference A lit tread #746d5d
    // against flagstone #a79774 — ≈ 0.7× in sRGB, cooler: B/R 0.80 vs 0.69), with only a mild
    // tread-to-tread swing so the flight reads as one stone with lit nosings, not a patchwork
    const tint = 0.7 + rng.range(0, 0.12);
    const hue = rng.range(-0.025, 0.025);
    const color: [number, number, number] = [tint * (1 + hue) * 0.98, tint, tint * (1 - hue * 0.6) * 1.14];

    // split the tread into two stones sometimes
    const split = rng.chance(0.36);
    const pieces: { a0: number; a1: number }[] = [];
    if (split) {
      const s = rng.range(-0.55, 0.55) * hw;
      const gap = rng.range(0.02, 0.04);
      pieces.push({ a0: -hw + rng.range(-0.03, 0.03), a1: s - gap / 2 }, { a0: s + gap / 2, a1: hw + rng.range(-0.03, 0.03) });
    } else {
      pieces.push({ a0: -hw + rng.range(-0.03, 0.03), a1: hw + rng.range(-0.03, 0.03) });
    }
    for (const pc of pieces) {
      const pw = pc.a1 - pc.a0;
      const cxl = (pc.a0 + pc.a1) / 2;
      const czl = (uFront + uBack) / 2;
      const outline = jitteredRect(rng, pw, depth, { jitter: 0.014, segs: 5, chip: 0.09, chipChance: 0.5 });
      shapeHashes.push(outlineHash(outline));
      const dip = rng.range(0.01, 0.026);
      // the nose catches the light: brighter still now that the tread body is darker
      const noseBright = rng.range(1.3, 1.48);
      placeSlab(outline, cxl, topY - ts, czl, yaw, 0, 0, {
        thickness: ts,
        bevel: rng.range(0.022, 0.034),
        dip,
        color,
        sideColor: [color[0] * 0.62, color[1] * 0.62, color[2] * 0.64],
        mossEdge: 0.85,
        mossInner: 0.05,
        mossFn: (x, z) => mossAt(x + cxl, z + czl),
        // worn nose: the front bevel and the first ~12 cm of the tread catch the light, the back
        // of the tread (under the next riser) and the flanks pick up grime
        colorFn: (x, z, part) => {
          const front = smoothstep(-depth / 2 + 0.16, -depth / 2 + 0.02, z); // 1 at the nose
          const back = smoothstep(depth / 2 - 0.2, depth / 2 - 0.02, z); // 1 at the back edge
          const flank = smoothstep(hw - 0.75, hw + 0.05, Math.abs(x + cxl));
          const grime = 1 - 0.16 * flank * (0.6 + 0.4 * (wear.noise((x + cxl) * 2.1 + 7, (z + czl) * 2.1) * 0.5 + 0.5));
          if (part === 'bevel') return (0.98 + (noseBright - 0.98) * front) * grime;
          if (part === 'side') return (z < 0 ? 1.34 : 0.92) * grime; // the nose face is sky-lit, the buried sides stay dark
          return (1 + 0.16 * front - 0.13 * back) * grime;
        },
        uvScale,
        uvOffset: [rng() * 3, rng() * 3],
        topNoise: (x, z) => 0.004 * wear.noise((x + cxl) * 9, (z + czl) * 9),
        rings: 2,
      });
      treadSlabs++;
      const [wx, wz] = stairToWorld(f, cxl, uFront + 0.01);
      treadNose.push([wx, def.base[1] + topY, wz]);
    }

    // riser: 1–3 darker stacked stones under the tread nose
    const rTop = topY - ts + 0.006;
    // the first riser is buried well below the under-tread trench (ramp − 0.18) so no gap can
    // open between it and the joint fill at the stair foot
    const rBottom = i === 0 ? baseY - 0.32 : baseY + i * def.rise - 0.05;
    const rh = rTop - rBottom;
    const nR = rng.chance(0.55) ? 1 : rng.chance(0.6) ? 2 : 3;
    let a = -hw + 0.02;
    for (let r = 0; r < nR; r++) {
      const remaining = hw - 0.02 - a;
      const len = r === nR - 1 ? remaining : clamp(remaining / (nR - r) + rng.range(-0.25, 0.25), 0.3, remaining - 0.3 * (nR - r - 1));
      // risers read as shadowed warm stone (reference #453e32 under #746d5d treads ≈ 0.35× the
      // tread in linear light) with a moss skin creeping over them from the joints
      const rc = 0.27 + rng.range(0, 0.08);
      const riserOutline = jitteredRect(rng, len - 0.015, def.tread * 0.9, { jitter: 0.012, segs: 3, chip: 0.05, chipChance: 0.3 });
      const ac = a + len / 2;
      placeSlab(riserOutline, ac, rBottom, i * def.tread + 0.01 + (def.tread * 0.9) / 2, yaw * 0.5, 0, 0, {
        thickness: rh,
        bevel: 0.012,
        color: [rc * 1.04, rc, rc * 0.9],
        sideColor: [rc * 0.94, rc * 0.9, rc * 0.82],
        mossEdge: 0.9,
        mossInner: 0.3,
        mossFn: (x, z) => 0.35 + 0.65 * mossAt(x + ac, z + i * def.tread),
        // riser shadow: darker still toward the flanks and at the foot (splash grime)
        colorFn: (x) => 1 - 0.22 * smoothstep(hw - 0.9, hw + 0.05, Math.abs(x + ac)),
        uvScale,
        uvOffset: [rng() * 3, rng() * 3],
        rings: 1,
      });
      a += len;
    }
  }

  // cheeks: the grass bank beside the run is flush with the treads (heightfield), so the flanks
  // are only punctuated by sparse, half-buried edging stones — irregular, mossy, sunk into the
  // bank — like the loose kerb stones in the reference rather than a continuous wall
  for (const side of [-1, 1]) {
    let u = rng.range(-0.15, 0.45);
    while (u < f.run + 0.2) {
      const len = rng.range(0.42, 0.78);
      const cw = rng.range(0.3, 0.5);
      const uc = u + len / 2;
      const ramp = baseY + clamp(uc / f.run, 0, 1) * def.rise * def.steps;
      // top just proud of the bank (+0.07 over the ramp) so the stones read as embedded
      const top = ramp + 0.07 + rng.range(0.04, 0.13);
      const th = rng.range(0.28, 0.4);
      const ac = side * (hw + 0.1 + cw / 2 + rng.range(-0.03, 0.06));
      const outline = jitteredRect(rng, cw, len, { jitter: 0.04, segs: 3, chip: 0.12, chipChance: 0.8 });
      const tint = 0.64 + rng.range(0, 0.18);
      placeSlab(outline, ac, top - th, uc, rng.range(-0.25, 0.25), rng.range(-0.08, 0.08), side * rng.range(-0.04, 0.12), {
        thickness: th,
        bevel: rng.range(0.035, 0.06),
        dip: -0.01,
        color: [tint, tint, tint * 0.97],
        sideColor: [tint * 0.7, tint * 0.7, tint * 0.72],
        mossEdge: 1.0,
        mossInner: 0.6,
        mossFn: (x, z) => 0.55 + 0.45 * (noise.fbm((x + ac) * 2.3, (z + uc) * 2.3 + 5, 2) * 0.5 + 0.5),
        uvScale,
        uvOffset: [rng() * 3, rng() * 3],
        rings: 1,
      });
      u += len + rng.range(0.55, 1.5);
    }
  }

  // landing: slabs on the plateau just past the top step
  {
    const topY = baseY + def.steps * def.rise;
    const rows = [
      [f.run + 0.03, f.run + 0.78],
      [f.run + 0.83, f.run + 1.62],
    ];
    for (const [u0, u1] of rows) {
      const cols = rng.chance(0.5) ? 2 : 3;
      let a = -hw - 0.05;
      const total = w + 0.1;
      for (let c = 0; c < cols; c++) {
        const len = c === cols - 1 ? -hw + 0.05 + total - a - 0.04 : total / cols + rng.range(-0.15, 0.15);
        const ac = a + len / 2;
        const uc = (u0 + u1) / 2;
        const [wx, wz] = stairToWorld(f, ac, uc);
        const ground = terrain.height(wx, wz) - def.base[1];
        const top = Math.max(ground + 0.05, topY - 0.02 - (uc - f.run) * 0.03);
        const th = rng.range(0.07, 0.1);
        const outline = jitteredRect(rng, len - 0.04, u1 - u0 - 0.04, { jitter: 0.02, segs: 4, chip: 0.1, chipChance: 0.5 });
        const tint = 0.8 + rng.range(0, 0.16);
        placeSlab(outline, ac, top - th, uc, rng.range(-0.05, 0.05), 0, 0, {
          thickness: th,
          bevel: 0.025,
          dip: 0.012,
          color: [tint, tint, tint * 0.97],
          mossEdge: 0.7,
          mossInner: 0.15,
          mossFn: (x, z) => 0.4 + 0.6 * (noise.fbm((x + ac) * 2.1 + 9, (z + uc) * 2.1, 2) * 0.5 + 0.5),
          uvScale,
          uvOffset: [rng() * 3, rng() * 3],
          rings: 2,
        });
        a += len + 0.04;
      }
    }
  }

  all.transform(f.matrix);
  const geometry = all.build();
  return { geometry, steps: def.steps, treadSlabs, shapeHashes, triangles: all.vertexCount / 3, treadNose };
}
