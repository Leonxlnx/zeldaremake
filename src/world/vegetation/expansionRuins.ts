/**
 * Round 57 (expansion-ruins) — the vegetation's side of the waterfall ruins west of the village
 * (layout `EXPANSION_RUINS`, terrain/ruins.ts). The LIVE view flattens the trail, raises the pale
 * outcrop and cuts the pool's basin with its rim; `expansionCull` clears the legacy streams off
 * that ground (vegetation/expansion.ts), so this pass dresses it against the live view:
 *
 *  - the trail's verges: tufts leaning over its packed earth, leaves in the ruts, ferns further out;
 *  - the outcrop: turf up to the rock skin's ragged outline (terrain/ruins.ts `outcropCover`),
 *    moss and tufts along it, a tuft in a crack of the skin here and there;
 *  - the pool's rim: damp moss and tufts at the water, turf, ferns and a few violets up the bank;
 *  - the cliff's foot and the ivy rock's: big ferns in the shade, moss, tufts;
 *  - the terrace and the stair: tufts in the paving and at the treads' ends, moss at the columns'
 *    feet and along the parapet, a fern in the north face's corners (seated at the masonry's
 *    level, not the ground's).
 *
 * Seats keep off the ruins' fallen pieces and boulders — the ruins system publishes them in
 * `ctx.shared.propBlockers` before this system builds (src/world/index.ts order). Own sets from
 * the disc sets' templates, own seeded streams (`expansion-ruins/…`), one group that
 * `vegetation/index.ts` shows only where the camera can see the locality
 * (util/expansionLocality.ts `ruinsVisible`), so the six fixed frames pay nothing for it.
 */
import { Group, Sphere, Vector3 } from 'three';
import { EXPANSION_RUINS, EXPANSION_RUINS_BOXES, ruinsTrailLine } from '../layout';
import type { WorldContext } from '../system';
import { getTerrain, type Terrain } from '../terrain/heightfield';
import { RUINS_COLUMN_FEET, cliffFaceAt, cliffFaceX, inStairCut, inTerrace, outcropCover, pillarRadius, platformSigned, poolSigned, trailHalfWidth } from '../terrain/ruins';
import { casterSpheres, sunVector, type Caster } from '../util/expansionLocality';
import { clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import type { ExpansionTemplates, ExpansionVegetation, SetTemplate } from './expansion';
import { composeMatrix } from './field';
import { LodInstancedSet } from './lodset';

export interface RuinsTemplates extends ExpansionTemplates {
  /** the big lit fern crowns (plants.ts heroFerns) — the cliff's foot */
  heroFerns: SetTemplate;
}

const R = EXPANSION_RUINS;
const SITE = EXPANSION_RUINS_BOXES[1];
/** carpet card / mat footprints and the card grid pitch (vegetation/expansion.ts, carpet.ts) */
const CARD_W: readonly [number, number] = [0.42, 0.62];
const CARD_H: readonly [number, number] = [0.19, 0.32];
const MAT_W: readonly [number, number] = [0.9, 1.2];
const MAT_LIFT = 0.018;
const CARD_SINK = 0.03;
const CELL = 0.42;

/** 0..1 position hash (mm-quantised seats) */
const hash01 = (x: number, z: number, salt = 0) => {
  let h = (Math.imul(Math.round(x * 1000) + salt * 7919, 374761393) + Math.imul(Math.round(z * 1000), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mm = (v: number) => Math.round(v * 1000) / 1000;

export function buildExpansionRuinsVegetation(ctx: WorldContext, templates: RuinsTemplates, parent: Group): ExpansionVegetation {
  const T: Terrain = getTerrain();
  const height = (x: number, z: number) => T.height(x, z);
  const q = ctx.quality;
  const group = new Group();
  group.name = 'expansion-ruins';
  parent.add(group);
  const counts: Record<string, number> = {};

  const mk = (name: string, t: SetTemplate) =>
    new LodInstancedSet({
      name,
      variants: t.variants,
      material: t.material,
      shadowMaterials: t.shadowMaterials,
      lodDistances: t.lodDistances,
      maxDistance: t.maxDistance,
      castShadowLods: t.castShadowLods,
      nearLods: t.nearLods,
      receiveShadow: true,
      packs: t.packs,
      instanceData: t.instanceData,
      cullPad: t.cullPad,
    });
  const tufts = mk('tufts-ruins', templates.tufts);
  const ferns = mk('ferns-ruins', templates.ferns);
  const heroFerns = mk('hero-ferns-ruins', templates.heroFerns);
  const moss = mk('moss-ruins', templates.moss);
  const flowers = mk('flowers-ruins', templates.flowers);
  const clumps = mk('grass-clumps-ruins', templates.clumps);
  const mats = mk('turf-mats-ruins', templates.mats);
  const leaves = mk('litter-leaves-ruins', templates.leaves);
  const sets = [mats, clumps, tufts, moss, ferns, heroFerns, flowers, leaves];

  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const n = new Vector3();
  const white: [number, number, number] = [1, 1, 1];
  // the ruins' fallen pieces and boulders (published by the ruins system, which builds first)
  const blockers = (ctx.shared?.propBlockers ?? []).filter((b) => b.x > SITE.x0 - 2 && b.x < SITE.x1 + 2 && b.z > SITE.z0 - 2 && b.z < SITE.z1 + 2);
  const nearBlocker = (x: number, z: number, pad: number) => {
    for (const b of blockers) if ((x - b.x) ** 2 + (z - b.z) ** 2 < (b.r + pad) ** 2) return true;
    return false;
  };

  /**
   * Ground every seat obeys: off the trail's earth, the stair's cut, the ruins' built footprints,
   * the water and its wet shore, and `pad` m clear of the fallen pieces and boulders. Returns the
   * seat's slope (1 − n.y, the normal left in `n`) or −1.
   */
  const groundOk = (x: number, z: number, pad = 0.15): number => {
    const m = T.mask(x, z);
    if (m.path > 0.3 || m.stairs > 0.2 || m.structure > 0.3) return -1;
    if (inStairCut(x, z, 0.25) || poolSigned(x, z) < 0.3) return -1;
    if (nearBlocker(x, z, pad)) return -1;
    T.normal(x, z, n);
    return 1 - clamp(n.y, 0, 1);
  };

  /** seat a standing plant of `set` at (x, y, z) (the normal in `n`): tilt toward the normal, yaw from the stream */
  const plantAt = (set: LodInstancedSet, x: number, y: number, z: number, rng: Rng, scale: number, tilt: number, color: [number, number, number], sxz = scale) => {
    composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, tilt, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(0, set.variantCount), color);
  };
  const plant = (set: LodInstancedSet, x: number, z: number, rng: Rng, scale: number, tilt: number, sink: number, color: [number, number, number], sxz = scale) => plantAt(set, x, T.height(x, z) - sink, z, rng, scale, tilt, color, sxz);
  const greenVar = (rng: Rng, amount = 0.14): [number, number, number] => [1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2];
  const mossTint = (rng: Rng): [number, number, number] => [0.95 + rng() * 0.1, 1, 0.9 + rng() * 0.1];
  /** a moss cushion of `radius` m at height y (the unit dome 0.45 tall, flattened, a little longer one way) */
  const cushionAt = (x: number, y: number, z: number, rng: Rng, radius: number, color: [number, number, number]) => {
    const h = radius * (0.22 + rng() * 0.2);
    composeMatrix(M, 0, x, y - 0.012, z, n.x, n.y, n.z, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
    moss.add(M, rng.int(0, moss.variantCount), color);
  };
  const cushion = (x: number, z: number, rng: Rng, radius: number, color: [number, number, number]) => cushionAt(x, T.height(x, z), z, rng, radius, color);
  /** a leaf lying on the ground (the litter's variants and tints) */
  const leaf = (x: number, z: number, rng: Rng, lift = 0.004) => {
    const scale = 0.7 + rng() * 0.7;
    const tintK = 0.8 + rng() * 0.4;
    const tint = templates.leaves.tints[rng.int(0, templates.leaves.tints.length)];
    const variant = rng.int(0, leaves.variantCount);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) + lift, z, n.x, n.y, n.z, 1, yaw, scale, scale, scale);
    leaves.add(M, variant, [tint[0] * tintK, tint[1] * tintK, tint[2] * tintK]);
  };
  /** a carpet card (carpet.ts seatClump's aData: phase, stiffness, tint slot, atlas tile + dryness step with the mirror flag) on the live ground */
  const card = (x: number, z: number, rng: Rng, hk: number, tintIndex: number, dry: number) => {
    const w = (CARD_W[0] + (CARD_W[1] - CARD_W[0]) * rng()) * (0.8 + 0.45 * hash01(x, z, 1));
    const h = Math.min((CARD_H[0] + (CARD_H[1] - CARD_H[0]) * Math.pow(rng(), 1.3)) * hk * (0.7 + 0.6 * hash01(x, z, 2)), CARD_H[1] * hk);
    const tile = rng.int(0, templates.clumps.tiles);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) - CARD_SINK * (h / CARD_H[1]), z, n.x, n.y, n.z, 0.5, yaw, w, h, w);
    data[0] = rng();
    data[1] = clamp(1 - h * (0.75 + 0.35 * rng()), 0.05, 0.95);
    data[2] = (tintIndex + 0.25) / 4;
    const mirror = hash01(x, z, 3) < 0.5;
    data[3] = tile + (Math.floor(dry * 16) + (mirror ? 0.75 : 0.25)) / 16;
    const hue = hash01(x, z, 4) * 2 - 1;
    const light = 1 + (hash01(x, z, 5) * 2 - 1) * 0.09;
    clumps.add(M, 0, [light * (1 + 0.07 * hue), light * (1 + 0.07 * 0.25 * Math.abs(hue)), light * (1 - 0.07 * 1.2 * hue)], data);
  };
  /** a turf mat (its first float the continuous palette position 0..3 — carpet.ts matPalettePosition) */
  const mat = (x: number, z: number, rng: Rng, palette: number, dry: number) => {
    const w = MAT_W[0] + (MAT_W[1] - MAT_W[0]) * rng();
    const tile = rng.int(0, templates.mats.tiles);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) + MAT_LIFT, z, n.x, n.y, n.z, 1, yaw, w, 1, w);
    data[0] = palette;
    data[1] = 1;
    data[2] = 0.25 / 4;
    data[3] = tile + clamp(dry, 0, 0.95) * 0.6;
    mats.add(M, 0, white, data);
  };
  /** keep `set`'s new plant `minGap` m from the ones it already holds (a local scan of the tail — the passes add in spatial runs) */
  const crowded = (set: LodInstancedSet, x: number, z: number, minGap: number, tail = 300) => {
    const it = set.items;
    for (let i = Math.max(0, it.length - tail); i < it.length; i++) if (Math.hypot(it[i].x - x, it[i].z - z) < minGap) return true;
    return false;
  };

  /**
   * A lawn over a box: cards and mats on the jittered CELL grid wherever `weight` > 0 (the card
   * density; the mats close the ground where it is ≥ 0.35 and not steeper than 0.6), tufts at
   * `tuftsPerM2` × weight. Every rng draw is made before a seat is judged, so a rule that changes
   * one seat moves no other.
   */
  const lawn = (label: string, box: readonly [number, number, number, number], weight: (x: number, z: number) => number, opts: { tuftsPerM2: number; tint: number; dry: number; height: number }) => {
    const rng = ctx.rng.fork(`expansion-ruins/lawn/${label}`);
    const nx = Math.ceil((box[2] - box[0]) / CELL);
    const nz = Math.ceil((box[3] - box[1]) / CELL);
    let placed = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = mm(box[0] + (i + rng()) * CELL);
        const z = mm(box[1] + (j + rng()) * CELL);
        const cw = rng();
        const mw = rng();
        const hk = 0.9 + 0.2 * rng();
        const dk = 0.3 + 0.7 * rng();
        const wgt = weight(x, z);
        if (wgt <= 0) continue;
        const slope = groundOk(x, z, 0.1);
        if (slope < 0) continue;
        const slopeK = 1 - smoothstep(0.45, 0.7, slope);
        if (mw < Math.min(1, wgt * 1.6) * (1 - smoothstep(0.45, 0.65, slope)) * q.density) mat(x, z, rng, opts.tint, opts.dry);
        if (cw < wgt * slopeK * q.density) {
          card(x, z, rng, opts.height * hk, opts.tint < 1.5 ? 1 : 2, opts.dry * dk);
          placed++;
        }
      }
    }
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    const nt = Math.round(area * opts.tuftsPerM2 * q.density);
    for (let i = 0; i < nt; i++) {
      const x = mm(box[0] + rng() * (box[2] - box[0]));
      const z = mm(box[1] + rng() * (box[3] - box[1]));
      const draw = rng();
      const scale = 0.55 + 0.5 * rng();
      const c = greenVar(rng, 0.16);
      if (draw > weight(x, z)) continue;
      const slope = groundOk(x, z, 0.1);
      if (slope < 0 || slope > 0.62) continue;
      plant(tufts, x, z, rng, scale, 0.6, 0.015, c);
    }
    counts[`lawn-${label}`] = placed;
  };

  // ---- the trail's verges: tufts leaning over the packed earth, leaves in the ruts, ferns further
  // out every few metres (the round-50 disc paths' and round 56's south path's treatment)
  {
    const rng = ctx.rng.fork('expansion-ruins/verges');
    const line = ruinsTrailLine();
    let s = 0;
    let vergeTufts = 0;
    let vergeLeaves = 0;
    let vergeFerns = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const [x0, , z0] = line[i];
      const [x1, , z1] = line[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      const steps = Math.max(1, Math.round(len / 0.8));
      for (let k = 0; k < steps; k++) {
        const u = (k + 0.5) / steps;
        const hw = trailHalfWidth(s + len * u);
        for (const side of [-1, 1]) {
          const out = 0.04 + Math.pow(rng(), 1.5) * 1.1;
          const scale = 0.45 + rng() * 0.6;
          const c = greenVar(rng, 0.16);
          const lr = rng();
          const lo = -0.35 + rng() * 0.6;
          const fr = rng();
          const fo = 1.1 + rng() * 1.6;
          const fs = 0.55 + rng() * 0.45;
          {
            const x = mm(x0 + (x1 - x0) * u + nx * side * (hw + out));
            const z = mm(z0 + (z1 - z0) * u + nz * side * (hw + out));
            if (groundOk(x, z, 0.05) >= 0) {
              // a blade at the rim leans over the earth (toward the trail's axis)
              const lean = 1 - smoothstep(0.04, 0.35, out);
              n.x -= nx * side * 0.9 * lean;
              n.z -= nz * side * 0.9 * lean;
              n.normalize();
              plant(tufts, x, z, rng, scale, 0.6, 0.01, c);
              vergeTufts++;
            }
          }
          if (lr < 0.45) {
            const x = mm(x0 + (x1 - x0) * u + nx * side * (hw + lo));
            const z = mm(z0 + (z1 - z0) * u + nz * side * (hw + lo));
            const m = T.mask(x, z);
            if (m.stairs < 0.2 && m.structure < 0.3 && poolSigned(x, z) > 0.3 && !nearBlocker(x, z, 0.05)) {
              T.normal(x, z, n);
              leaf(x, z, rng, 0.004);
              vergeLeaves++;
            }
          }
          if (fr < 0.1) {
            const x = mm(x0 + (x1 - x0) * u + nx * side * (hw + fo));
            const z = mm(z0 + (z1 - z0) * u + nz * side * (hw + fo));
            if (groundOk(x, z, 0.3) >= 0 && !crowded(ferns, x, z, 0.8)) {
              plant(ferns, x, z, rng, fs, 0.6, 0.02, greenVar(rng, 0.2));
              vergeFerns++;
            }
          }
        }
      }
      s += len;
    }
    Object.assign(counts, { vergeTufts, vergeLeaves, vergeFerns });
  }

  // ---- the outcrop: turf up to the rock skin's outline, moss and tufts along it, a crack tuft
  {
    const P = R.platform;
    const box: [number, number, number, number] = [P.x0 - 0.6, P.z0 - P.edge - 1.2, P.x1 + P.edge + 1.4, R.wall.z - R.wall.half];
    lawn('outcrop', box, (x, z) => {
      const c = outcropCover(x, z);
      return c > 0.3 ? 0 : (0.75 - c) * (1 - smoothstep(P.edge + 0.9, P.edge + 1.5, platformSigned(x, z)));
    }, { tuftsPerM2: 1.1, tint: 1.2, dry: 0.25, height: 0.9 });
    const rng = ctx.rng.fork('expansion-ruins/outcrop-edge');
    let edgeMoss = 0;
    let edgeTufts = 0;
    let crackTufts = 0;
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    for (let i = 0; i < Math.round(area * 2.2); i++) {
      const x = mm(box[0] + rng() * (box[2] - box[0]));
      const z = mm(box[1] + rng() * (box[3] - box[1]));
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.16);
      const cov = outcropCover(x, z);
      const onEdge = cov > 0.25 && cov < 0.75;
      if (!onEdge && !(cov >= 0.75 && kind < 0.025)) continue;
      if (groundOk(x, z, 0.12) < 0) continue;
      if (!onEdge) {
        // a tuft in a crack of the skin: seated on the ground under the rock's 3–10 cm
        plant(tufts, x, z, rng, 0.4 + scale * 0.3, 0.3, -0.02, c);
        crackTufts++;
      } else if (kind < 0.45) {
        cushion(x, z, rng, 0.1 + scale * 0.22, mossTint(rng));
        edgeMoss++;
      } else if (kind < 0.8) {
        plant(tufts, x, z, rng, 0.45 + scale * 0.45, 0.6, 0.01, c);
        edgeTufts++;
      }
    }
    Object.assign(counts, { edgeMoss, edgeTufts, crackTufts });
  }

  // ---- the pool's rim: damp moss and tufts at the water, turf, ferns and violets up the bank
  {
    const Q = R.pool;
    const box: [number, number, number, number] = [Q.x - Q.hx - 4.5, R.wall.z + R.wall.half, Q.x + Q.hx + 5.5, Q.z + Q.hz + 5.5];
    const rimW = (x: number, z: number) => {
      const sd = poolSigned(x, z);
      if (sd < 0.35 || sd > Q.bank + 3.2) return 0;
      return (0.35 + 0.5 * smoothstep(0.5, 1.6, sd)) * (1 - smoothstep(Q.bank + 1.8, Q.bank + 3.2, sd));
    };
    lawn('rim', box, rimW, { tuftsPerM2: 1.4, tint: 0.9, dry: 0.15, height: 1.0 });
    const rng = ctx.rng.fork('expansion-ruins/rim');
    let shoreMoss = 0;
    let shoreTufts = 0;
    let bankFerns = 0;
    let bankFlowers = 0;
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    for (let i = 0; i < Math.round(area * 1.3); i++) {
      const x = mm(box[0] + rng() * (box[2] - box[0]));
      const z = mm(box[1] + rng() * (box[3] - box[1]));
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.2);
      const sd = poolSigned(x, z);
      if (sd < 0.3 || sd > Q.bank + 3) continue;
      const slope = groundOk(x, z, 0.12);
      if (slope < 0 || slope > 0.72) continue;
      if (sd < 1.1) {
        // the damp shore: moss cushions and wet tufts over the waterline
        if (kind < 0.5) {
          cushion(x, z, rng, 0.12 + scale * 0.25, [0.86 + scale * 0.1, 0.95, 0.8]);
          shoreMoss++;
        } else if (kind < 0.85) {
          plant(tufts, x, z, rng, 0.5 + scale * 0.5, 0.7, 0.01, c);
          shoreTufts++;
        }
      } else if (kind < 0.12) {
        if (crowded(ferns, x, z, 0.8)) continue;
        plant(ferns, x, z, rng, 0.6 + scale * 0.5, 0.6, 0.02, c);
        bankFerns++;
      } else if (kind < 0.15) {
        plant(flowers, x, z, rng, 0.7 + scale * 0.4, 0.5, 0.01, greenVar(rng, 0.1));
        bankFlowers++;
      }
    }
    Object.assign(counts, { shoreMoss, shoreTufts, bankFerns, bankFlowers });
  }

  // ---- the cliff's foot and the ivy rock's: big ferns in the shade, moss, tufts
  {
    const C = R.cliff;
    const F = R.fall;
    const rng = ctx.rng.fork('expansion-ruins/cliff-foot');
    let footFerns = 0;
    let footHero = 0;
    let footMoss = 0;
    for (let i = 0; i < 260; i++) {
      const z = mm(C.z0 - 1 + rng() * (C.z1 - C.z0 + 2));
      const out = 0.12 + Math.pow(rng(), 1.3) * 2.6;
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.2);
      if (Math.abs(z - F.z) < F.width * 0.9) continue;
      // off the rock face as built at the plant's height (its foot flares, its strata stand proud)
      const g = T.height(cliffFaceX(z, 2) + 0.9, z);
      const face = Math.max(cliffFaceAt(z, g, height), cliffFaceAt(z, g + 0.35, height), cliffFaceAt(z, g + 0.7, height));
      const x = mm(face + out);
      const slope = groundOk(x, z, 0.15);
      if (slope < 0 || slope > 0.7) continue;
      if (kind < 0.1 && out > 1.0) {
        if (crowded(heroFerns, x, z, 2.0)) continue;
        plant(heroFerns, x, z, rng, 0.7 + scale * 0.35, 0.5, 0.03, c);
        footHero++;
      } else if (kind < 0.45) {
        if (crowded(ferns, x, z, 0.7)) continue;
        // the fronds lean off the rock
        n.x += 0.5;
        n.normalize();
        plant(ferns, x, z, rng, 0.6 + scale * 0.5, 0.5, 0.03, c);
        footFerns++;
      } else if (kind < 0.8) {
        cushion(x, z, rng, 0.12 + scale * 0.3, [0.82 + scale * 0.1, 0.92, 0.78]);
        footMoss++;
      } else {
        plant(tufts, x, z, rng, 0.5 + scale * 0.5, 0.6, 0.01, c);
      }
    }
    const Pl = R.pillar;
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2;
      const out = 0.1 + Math.pow(rng(), 1.4) * 1.6;
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.2);
      const r = Pl.r * 1.12 + out;
      const x = mm(Pl.x + Math.cos(a) * r);
      const z = mm(Pl.z + Math.sin(a) * r);
      // the rock's mesh stays within 10 % of `pillarRadius`
      if (Math.hypot(x - Pl.x, z - Pl.z) < pillarRadius(a, 0.3) * 1.1 + 0.12) continue;
      const slope = groundOk(x, z, 0.12);
      if (slope < 0 || slope > 0.7) continue;
      if (kind < 0.35) {
        if (crowded(ferns, x, z, 0.65)) continue;
        n.x += Math.cos(a) * 0.5;
        n.z += Math.sin(a) * 0.5;
        n.normalize();
        plant(ferns, x, z, rng, 0.55 + scale * 0.5, 0.5, 0.03, c);
        footFerns++;
      } else if (kind < 0.75) {
        cushion(x, z, rng, 0.1 + scale * 0.28, mossTint(rng));
        footMoss++;
      } else {
        plant(tufts, x, z, rng, 0.5 + scale * 0.5, 0.6, 0.01, c);
      }
    }
    Object.assign(counts, { footFerns, footHero, footMoss });
  }

  // ---- the terrace and the stair: tufts in the paving and at the treads' ends, moss at the
  // columns' feet and along the parapet, ferns in the north face's corners — seated on the stone
  {
    const Tr = R.terrace;
    const S = R.stairs;
    const rng = ctx.rng.fork('expansion-ruins/terrace');
    let paveTufts = 0;
    let paveMoss = 0;
    let treadTufts = 0;
    let cornerFerns = 0;
    const top = Tr.y - 0.012;
    const onPaving = (x: number, z: number) => inTerrace(x, z, -0.35) && !nearBlocker(x, z, 0.2) && !RUINS_COLUMN_FEET.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 0.12);
    const area = (Tr.x1 - Tr.x0) * (Tr.z1 - Tr.z0);
    for (let i = 0; i < Math.round(area * 0.9); i++) {
      const x = mm(Tr.x0 + rng() * (Tr.x1 - Tr.x0));
      const z = mm(Tr.z0 + rng() * (Tr.z1 - Tr.z0));
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.18);
      if (!onPaving(x, z)) continue;
      // the trodden line along the axis from the stair to the arch stays clean
      if (Math.abs(z - S.base[2]) < 0.9 && x > R.arch.x - 1) continue;
      // hugging the walls and the column feet, sparse in the open
      const nearWall = Math.min(z - Tr.z0, Tr.z1 - z, x - Tr.x0) < 0.9;
      const nearFoot = RUINS_COLUMN_FEET.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + 0.6);
      if (!nearWall && !nearFoot && kind > 0.35) continue;
      n.set(0, 1, 0);
      if (kind < 0.55 && (nearWall || nearFoot)) {
        cushionAt(x, top, z, rng, 0.08 + scale * 0.2, mossTint(rng));
        paveMoss++;
      } else {
        plantAt(tufts, x, top - 0.01, z, rng, 0.35 + scale * 0.4, 0, c);
        paveTufts++;
      }
    }
    // the north face's corners and the notch's: a fern each, in the damp angle
    for (const [x, z] of [
      [Tr.x0 + 0.55, Tr.z0 + 0.55],
      [Tr.notchX - 0.5, Tr.z0 + 0.55],
      [Tr.notchX - 0.55, Tr.notchZ + 0.5],
      [Tr.x0 + 0.6, Tr.z1 - 0.6],
    ] as const) {
      if (!onPaving(x, z)) continue;
      n.set(0, 1, 0);
      plantAt(ferns, x, top - 0.02, z, rng, 0.45 + rng() * 0.25, 0, greenVar(rng, 0.2));
      cornerFerns++;
    }
    // tufts at the treads' ends, where no foot wears them
    for (let i = 0; i < S.steps; i++) {
      for (const side of [-1, 1]) {
        const draw = rng();
        const scale = rng();
        const c = greenVar(rng, 0.18);
        if (draw > 0.6) continue;
        const u = i * S.tread + 0.12 + 0.2 * rng();
        const v = side * (S.width / 2 - 0.12);
        const x = mm(S.base[0] - u);
        const z = mm(S.base[2] - v);
        n.set(0, 1, 0);
        plantAt(tufts, x, S.base[1] + (i + 1) * S.rise - 0.02, z, rng, 0.3 + scale * 0.3, 0, c);
        treadTufts++;
      }
    }
    Object.assign(counts, { paveTufts, paveMoss, treadTufts, cornerFerns });
  }

  for (const set of sets) group.add(set.build());

  // ---- the locality's spheres: the trail's verges as a chain of spheres, the site's ground as a
  // grid of them (their shadow footprints with them)
  const sun = sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const casters: Caster[] = [];
  for (const [x, , z] of ruinsTrailLine()) {
    const y = T.height(x, z);
    casters.push({ x, z, r: 3.2, y0: y - 0.4, y1: y + 1.4, shadow: true });
  }
  for (let x = SITE.x0 + 3; x < SITE.x1; x += 6) {
    for (let z = SITE.z0 + 3; z < SITE.z1; z += 6) {
      const y = T.height(x, z);
      casters.push({ x, z, r: 4.6, y0: y - 1.5, y1: Math.max(y, R.terrace.y) + 1.4, shadow: true });
    }
  }
  const spheres: Sphere[] = casters.flatMap((c) => casterSpheres(c, sun));
  return { group, sets, spheres, counts };
}
