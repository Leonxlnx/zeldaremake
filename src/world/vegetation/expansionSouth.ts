/**
 * Round 56 (expansion-south) — the vegetation's side of the village's south exit (layout
 * `EXPANSION_SOUTH`, terrain/south.ts). The LIVE view cut a ravine, paved a path down to it and
 * raised a bank round the hollow log; `expansionCull` clears the legacy streams' instances off
 * that ground (vegetation/expansion.ts), so this pass dresses it against the live view:
 *
 *  - the south path's verges: tufts leaning over the slab rims, leaves in the angles;
 *  - the ravine's lips: turf rolling over the edge, tufts and ferns leaning out, moss;
 *  - its walls: ferns and moss on the ledges the strata make, tufts under the lip;
 *  - its floor: ferns (the big crowns near the bridge), moss and leaf litter under the mist;
 *  - the bridge heads: ferns and tufts round the posts and stakes, off the walk;
 *  - the far bank: a thicket of bushes and ferns either side of the few metres from the south
 *    sill to the log's mouth (the walker's only ground there — the undergrowth says so), turf,
 *    ferns and bushes over the bank the log burrows into, ferns banked against the log's flanks.
 *
 * Own sets built from the disc sets' templates, own seeded streams (`expansion-south/…`), one
 * group that `vegetation/index.ts` shows only where the camera can see the locality
 * (util/expansionLocality.ts `southVisible`), so the frames that never look south pay nothing.
 */
import { Group, Sphere, Vector3 } from 'three';
import { EXPANSION_SOUTH, southBridgeFrame, southPathHalfWidth, southPathLine, southRavineLine } from '../layout';
import type { WorldContext } from '../system';
import { getTerrain, type Terrain } from '../terrain/heightfield';
import { RAVINE_BOX, bridgeLocal, inFarCorridor, moundHeight, ravineCut, ravineHit, ravineProfile, southOfRavine, tunnelFootprint, tunnelLocal, tunnelWorld } from '../terrain/south';
import { casterSpheres, southPathSpheres, sunVector, type Caster } from '../util/expansionLocality';
import { clamp, smoothstep } from '../util/noise';
import type { Rng } from '../util/prng';
import type { ExpansionTemplates, ExpansionVegetation, SetTemplate } from './expansion';
import { composeMatrix } from './field';
import { LodInstancedSet } from './lodset';

export interface SouthTemplates extends ExpansionTemplates {
  /** the big lit fern crowns (plants.ts heroFerns) — the ravine floor's under the bridge */
  heroFerns: SetTemplate;
}

const B = EXPANSION_SOUTH.bridge;
const TN = EXPANSION_SOUTH.tunnel;
const BF = southBridgeFrame();
/** the bridge hardware's feet in bridge-frame (a, c): the four posts and the four backstay stakes (structures/expansionSouth.ts) */
const POSTS: readonly [number, number][] = [-1, 1].flatMap((s) => [
  [-B.postBack, s * B.postOut],
  [BF.len + B.postBack, s * B.postOut],
]) as [number, number][];
const STAKES: readonly [number, number][] = [-1, 1].flatMap((s) => [
  [-1.05, s * 1.45],
  [BF.len + 1.05, s * 1.45],
]) as [number, number][];
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

/** distance (m) from (a, c) to the segment (a0, c0) → (a1, c1) */
function segDistance(a: number, c: number, a0: number, c0: number, a1: number, c1: number): number {
  const da = a1 - a0;
  const dc = c1 - c0;
  const t = clamp(((a - a0) * da + (c - c0) * dc) / Math.max(da * da + dc * dc, 1e-9), 0, 1);
  return Math.hypot(a - a0 - da * t, c - c0 - dc * t);
}

export function buildExpansionSouthVegetation(ctx: WorldContext, templates: SouthTemplates, parent: Group): ExpansionVegetation {
  const T: Terrain = getTerrain();
  const q = ctx.quality;
  const group = new Group();
  group.name = 'expansion-south';
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
  const tufts = mk('tufts-south', templates.tufts);
  const ferns = mk('ferns-south', templates.ferns);
  const heroFerns = mk('hero-ferns-south', templates.heroFerns);
  const moss = mk('moss-south', templates.moss);
  const flowers = mk('flowers-south', templates.flowers);
  const whiteFlowers = mk('flowers-white-south', templates.whiteFlowers);
  const bushes = mk('bushes-south', templates.bushes);
  const weeds = mk('weeds-south', templates.weeds);
  const clumps = mk('grass-clumps-south', templates.clumps);
  const mats = mk('turf-mats-south', templates.mats);
  const leaves = mk('litter-leaves-south', templates.leaves);
  const sets = [mats, clumps, tufts, weeds, moss, ferns, heroFerns, flowers, whiteFlowers, bushes, leaves];

  const M = new Float32Array(16);
  const data = new Float32Array(4);
  const n = new Vector3();
  const white: [number, number, number] = [1, 1, 1];
  const bm = ravineHit(B.north[0] + BF.ax * BF.len * 0.5, B.north[1] + BF.az * BF.len * 0.5);
  const sBridge = bm ? bm.s : 0;
  /** 1 within 14 m of the bridge along the gorge, easing to 0.3 by 34 m: the walker sees the gorge from the deck and its heads */
  const nearBridge = (s: number) => 0.3 + 0.7 * (1 - smoothstep(14, 34, Math.abs(s - sBridge)));

  /**
   * Ground every seat obeys: off the live paving, stairs and structure pads; off the deck and
   * its heads (under the deck deeper than 1.5 m is ravine floor and wall, dressed like the rest);
   * `pad` m clear of the posts, stakes and backstays; off the far corridor and the log's plan.
   * Returns the seat's slope (1 − n.y, the normal left in `n`) or −1.
   */
  const groundOk = (x: number, z: number, pad = 0.15): number => {
    const m = T.mask(x, z);
    if (m.path > 0.3 || m.stairs > 0.2 || m.structure > 0.3) return -1;
    const bl = bridgeLocal(x, z);
    if (bl.a > -1.3 && bl.a < BF.len + 1.3) {
      if (Math.abs(bl.c) < B.deckHalfWidth + 0.1 + pad && ravineCut(x, z) < 1.5) return -1;
      for (const [pa, pc] of POSTS) if (Math.hypot(bl.a - pa, bl.c - pc) < 0.16 + pad) return -1;
    }
    if (bl.a < 0.5 || bl.a > BF.len - 0.5) {
      for (let i = 0; i < 4; i++) {
        const [sa, sc] = STAKES[i];
        const [pa, pc] = POSTS.find((p) => Math.sign(p[0] - BF.len / 2) === Math.sign(sa - BF.len / 2) && Math.sign(p[1]) === Math.sign(sc))!;
        if (segDistance(bl.a, bl.c, pa, pc, sa, sc) < 0.08 + pad) return -1;
      }
    }
    if (inFarCorridor(x, z)) return -1;
    const t = tunnelLocal(x, z);
    if (tunnelFootprint(t.a, t.c) > 0) return -1;
    T.normal(x, z, n);
    return 1 - clamp(n.y, 0, 1);
  };

  /** seat a standing plant of `set` at (x, z) (the normal in `n`): terrain contact, tilt toward the normal, yaw from the stream */
  const plant = (set: LodInstancedSet, x: number, z: number, rng: Rng, scale: number, tilt: number, sink: number, color: [number, number, number], sxz = scale) => {
    const y = T.height(x, z) - sink;
    composeMatrix(M, 0, x, y, z, n.x, n.y, n.z, tilt, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(0, set.variantCount), color);
  };
  const greenVar = (rng: Rng, amount = 0.14): [number, number, number] => [1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2];
  /** a moss cushion of `radius` m (the unit dome 0.45 tall, flattened, a little longer one way) */
  const cushion = (x: number, z: number, rng: Rng, radius: number, color: [number, number, number]) => {
    const h = radius * (0.22 + rng() * 0.2);
    composeMatrix(M, 0, x, T.height(x, z) - 0.012, z, n.x, n.y, n.z, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
    moss.add(M, rng.int(0, moss.variantCount), color);
  };
  const mossTint = (rng: Rng): [number, number, number] => [0.95 + rng() * 0.1, 1, 0.9 + rng() * 0.1];
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
  const mat = (x: number, z: number, rng: Rng, palette: number, dry: number, width = 1) => {
    const w = (MAT_W[0] + (MAT_W[1] - MAT_W[0]) * rng()) * width;
    const tile = rng.int(0, templates.mats.tiles);
    const yaw = rng() * Math.PI * 2;
    composeMatrix(M, 0, x, T.height(x, z) + MAT_LIFT, z, n.x, n.y, n.z, 1, yaw, w, 1, w);
    data[0] = palette;
    data[1] = 1;
    data[2] = 0.25 / 4;
    data[3] = tile + clamp(dry, 0, 0.95) * 0.6;
    mats.add(M, 0, white, data);
  };

  /**
   * A lawn over a box: cards and mats on the jittered CELL grid wherever `weight` > 0 (the card
   * density; the mats close the ground at weight ≥ 0.35, not on slopes past 0.6), tufts at
   * `tuftsPerM2` × weight. Returns the cards placed.
   */
  const lawn = (label: string, box: readonly [number, number, number, number], weight: (x: number, z: number) => number, opts: { tuftsPerM2: number; tint: number; dry: number; height: number; tuftHeight?: readonly [number, number] }) => {
    const rng = ctx.rng.fork(`expansion-south/lawn/${label}`);
    const nx = Math.ceil((box[2] - box[0]) / CELL);
    const nz = Math.ceil((box[3] - box[1]) / CELL);
    let placed = 0;
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = mm(box[0] + (i + rng()) * CELL);
        const z = mm(box[1] + (j + rng()) * CELL);
        const cw = rng();
        const mw = rng();
        const wgt = weight(x, z);
        if (wgt <= 0) continue;
        const slope = groundOk(x, z, 0.1);
        if (slope < 0) continue;
        const slopeK = 1 - smoothstep(0.45, 0.7, slope);
        if (mw < Math.min(1, wgt * 1.6) * (1 - smoothstep(0.45, 0.65, slope)) * q.density) mat(x, z, rng, opts.tint, opts.dry);
        if (cw < wgt * slopeK * q.density) {
          card(x, z, rng, opts.height * (0.9 + 0.2 * rng()), opts.tint < 1.5 ? 1 : 2, opts.dry * (0.3 + 0.7 * rng()));
          placed++;
        }
      }
    }
    const area = (box[2] - box[0]) * (box[3] - box[1]);
    const nt = Math.round(area * opts.tuftsPerM2 * q.density);
    const th = opts.tuftHeight ?? [0.55, 1.05];
    for (let i = 0; i < nt; i++) {
      const x = mm(box[0] + rng() * (box[2] - box[0]));
      const z = mm(box[1] + rng() * (box[3] - box[1]));
      const draw = rng();
      const scale = th[0] + (th[1] - th[0]) * rng();
      const c = greenVar(rng, 0.16);
      if (draw > weight(x, z)) continue;
      const slope = groundOk(x, z, 0.1);
      if (slope < 0 || slope > 0.62) continue;
      plant(tufts, x, z, rng, scale, 0.6, 0.015, c);
    }
    counts[`lawn-${label}`] = placed;
    return placed;
  };

  /** keep `set`'s new plant `minGap` m from the ones it already holds (a local scan of the tail — the passes add in spatial runs) */
  const crowded = (set: LodInstancedSet, x: number, z: number, minGap: number, tail = 400) => {
    const it = set.items;
    for (let i = Math.max(0, it.length - tail); i < it.length; i++) if (Math.hypot(it[i].x - x, it[i].z - z) < minGap) return true;
    return false;
  };

  // ---- the south path's verges: tufts leaning over the slab rims, leaves in the angles (the
  // round-50 disc paths' treatment — vegetation/expansion.ts)
  {
    const rng = ctx.rng.fork('expansion-south/verges');
    const line = southPathLine();
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
      const hw = southPathHalfWidth(s);
      s += len;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 3; k++) {
          const u = rng();
          const out = 0.04 + Math.pow(rng(), 1.5) * 0.95;
          const x = mm(x0 + (x1 - x0) * u + nx * side * (hw + out));
          const z = mm(z0 + (z1 - z0) * u + nz * side * (hw + out));
          const scale = 0.45 + rng() * 0.6;
          const c = greenVar(rng, 0.16);
          if (groundOk(x, z, 0.05) < 0) continue;
          // a blade at the rim leans over the stones (toward the path's axis)
          const lean = 1 - smoothstep(0.04, 0.35, out);
          n.x -= nx * side * 0.9 * lean;
          n.z -= nz * side * 0.9 * lean;
          n.normalize();
          plant(tufts, x, z, rng, scale, 0.6, 0.01, c);
          vergeTufts++;
        }
        {
          const u = rng();
          const out = -0.25 + rng() * 0.7;
          const x = mm(x0 + (x1 - x0) * u + nx * side * (hw + out));
          const z = mm(z0 + (z1 - z0) * u + nz * side * (hw + out));
          const m = T.mask(x, z);
          if (m.stairs < 0.2 && m.structure < 0.3) {
            T.normal(x, z, n);
            leaf(x, z, rng, out < 0 ? 0.05 : 0.004);
            vergeLeaves++;
          }
        }
        // ferns a little further out, every few metres: the path runs between the giants' roots through the understory
        if (rng() < 0.22) {
          const u = rng();
          const out = 0.9 + rng() * 1.6;
          const x = mm(x0 + (x1 - x0) * u + nx * side * (hw + out));
          const z = mm(z0 + (z1 - z0) * u + nz * side * (hw + out));
          const scale = 0.55 + rng() * 0.45;
          const c = greenVar(rng, 0.2);
          if (groundOk(x, z, 0.3) < 0 || crowded(ferns, x, z, 0.7)) continue;
          plant(ferns, x, z, rng, scale, 0.6, 0.02, c);
          vergeFerns++;
        }
      }
    }
    counts['verge-tufts'] = vergeTufts;
    counts['verge-leaves'] = vergeLeaves;
    counts['verge-ferns'] = vergeFerns;
  }

  // ---- the ravine: lips, walls and floor, by the cross-section (terrain/south.ts ravineProfile)
  const R = RAVINE_BOX;
  const rbox: [number, number, number, number] = [R.x0, R.z0, R.x1, R.z1];
  {
    /** the lip's roll-over: from where the cut starts to where the wall steepens past 0.5 */
    const lip = (x: number, z: number) => {
      const rp = ravineProfile(x, z);
      if (!rp) return 0;
      const band = smoothstep(rp.edge + 0.5, rp.edge - 0.1, rp.dEff) * (1 - smoothstep(0.1, 0.24, rp.g));
      return band * nearBridge(rp.hit.s);
    };
    lawn('lip', rbox, lip, { tuftsPerM2: 1.6, tint: 1.2, dry: 0.3, height: 0.95 });
  }
  {
    const rng = ctx.rng.fork('expansion-south/ravine');
    const area = (R.x1 - R.x0) * (R.z1 - R.z0);
    let lipTufts = 0;
    let lipFerns = 0;
    let wallFerns = 0;
    let wallMoss = 0;
    let wallTufts = 0;
    let floorFerns = 0;
    let floorHero = 0;
    let floorMoss = 0;
    let floorLeaves = 0;
    let floorWeeds = 0;
    const candidates = Math.round(area * 4);
    for (let i = 0; i < candidates; i++) {
      const x = mm(R.x0 + rng() * (R.x1 - R.x0));
      const z = mm(R.z0 + rng() * (R.z1 - R.z0));
      const kind = rng();
      const draw = rng();
      const scaleR = rng();
      const c = greenVar(rng, 0.2);
      const rp = ravineProfile(x, z);
      if (!rp || rp.cut <= 0.02) continue;
      const near = nearBridge(rp.hit.s);
      if (draw > near * q.density) continue;
      const slope = groundOk(x, z, 0.12);
      if (slope < 0) continue;
      const g = rp.g;
      if (g < 0.14) {
        // the lip: tufts hanging out over the edge (leaning down the fall line), a fern now and then
        if (kind < 0.55) {
          n.x += rp.fx * 0.8;
          n.z += rp.fz * 0.8;
          n.normalize();
          plant(tufts, x, z, rng, 0.5 + scaleR * 0.6, 0.75, 0.01, c);
          lipTufts++;
        } else if (kind < 0.68 && slope < 0.6 && !crowded(ferns, x, z, 0.6)) {
          plant(ferns, x, z, rng, 0.5 + scaleR * 0.4, 0.55, 0.03, c);
          lipFerns++;
        }
      } else if (g < 0.86) {
        // the wall: ferns out of its cracks (on the ledges the strata make, upright; on the face,
        // growing off it), moss patching the rock, tufts hanging under the lip
        const ledge = 1 - smoothstep(0.35, 0.7, slope);
        if (kind < 0.1 + 0.22 * ledge) {
          if (slope > 0.86 || crowded(ferns, x, z, 0.6)) continue;
          plant(ferns, x, z, rng, 0.4 + scaleR * 0.45, 0.4 + 0.4 * (1 - ledge), 0.05, c);
          wallFerns++;
        } else if (kind < 0.56) {
          cushion(x, z, rng, 0.1 + scaleR * 0.26, mossTint(rng));
          wallMoss++;
        } else if (kind < 0.76 && g < 0.5) {
          if (slope > 0.85) continue;
          n.x += rp.fx * 0.6;
          n.z += rp.fz * 0.6;
          n.normalize();
          plant(tufts, x, z, rng, 0.45 + scaleR * 0.5, 0.7, 0.01, c);
          wallTufts++;
        }
      } else {
        // the floor: ferns and moss in the damp, leaves washed into the channel
        if (kind < 0.22) {
          if (crowded(ferns, x, z, 0.75)) continue;
          plant(ferns, x, z, rng, 0.6 + scaleR * 0.55, 0.45, 0.03, c);
          floorFerns++;
        } else if (kind < 0.3 && Math.abs(rp.hit.s - sBridge) < 18) {
          if (crowded(heroFerns, x, z, 1.5, 200)) continue;
          plant(heroFerns, x, z, rng, 0.75 + scaleR * 0.4, 0.35, 0.03, c);
          floorHero++;
        } else if (kind < 0.55) {
          cushion(x, z, rng, 0.1 + scaleR * 0.24, mossTint(rng));
          floorMoss++;
        } else if (kind < 0.62) {
          plant(weeds, x, z, rng, 0.6 + scaleR * 0.5, 0.6, 0.01, greenVar(rng, 0.14));
          floorWeeds++;
        } else if (kind < 0.9) {
          leaf(x, z, rng);
          floorLeaves++;
        }
      }
    }
    Object.assign(counts, { lipTufts, lipFerns, wallFerns, wallMoss, wallTufts, floorFerns, floorHero, floorMoss, floorLeaves, floorWeeds });
  }

  // ---- the bridge heads: ferns and tufts round the posts' and stakes' feet (the walk stays open)
  {
    const rng = ctx.rng.fork('expansion-south/heads');
    let headFerns = 0;
    let headTufts = 0;
    for (const [pa, pc] of [...POSTS, ...STAKES]) {
      for (let k = 0; k < 9; k++) {
        const r = 0.28 + Math.pow(rng(), 1.3) * 1.1;
        const ang = rng() * Math.PI * 2;
        const a = pa + Math.cos(ang) * r;
        const cc = pc + Math.sin(ang) * r;
        const x = mm(B.north[0] + BF.ax * a + BF.cx * cc);
        const z = mm(B.north[1] + BF.az * a + BF.cz * cc);
        const scale = rng();
        const kind = rng();
        const c = greenVar(rng, 0.18);
        const slope = groundOk(x, z, 0.08);
        if (slope < 0 || slope > 0.6 || ravineCut(x, z) > 0.6) continue;
        if (kind < 0.3 && r > 0.45) {
          if (crowded(ferns, x, z, 0.55)) continue;
          plant(ferns, x, z, rng, 0.5 + scale * 0.4, 0.6, 0.03, c);
          headFerns++;
        } else {
          plant(tufts, x, z, rng, 0.5 + scale * 0.55, 0.65, 0.01, c);
          headTufts++;
        }
      }
    }
    counts['head-ferns'] = headFerns;
    counts['head-tufts'] = headTufts;
  }

  // ---- the far bank: the thicket either side of the far path, the bank over the log, the log's flanks
  const M0 = TN.mound;
  const bankBox = (() => {
    const xs: number[] = [];
    const zs: number[] = [];
    for (const a of [-4.5, M0.back]) {
      for (const c of [-M0.halfBase - 1, M0.halfBase + 1]) {
        const [x, z] = tunnelWorld(a, c);
        xs.push(x);
        zs.push(z);
      }
    }
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] as [number, number, number, number];
  })();
  /** the far bank's ground south of the ravine's lip (off the walls: the ravine pass dresses those) */
  const farGround = (x: number, z: number) => southOfRavine(x, z) && ravineCut(x, z) < 0.05;
  {
    // turf over the bank the log burrows into, thinning on its steep flanks
    const bank = (x: number, z: number) => {
      if (!farGround(x, z)) return 0;
      const t = tunnelLocal(x, z);
      const rise = moundHeight(t.a, t.c);
      return smoothstep(0.15, 0.8, rise) * (0.75 + 0.25 * hash01(x, z, 11));
    };
    lawn('bank', bankBox, bank, { tuftsPerM2: 2.2, tint: 1.1, dry: 0.4, height: 0.85, tuftHeight: [0.5, 0.95] });
  }
  {
    const rng = ctx.rng.fork('expansion-south/far-bank');
    let thicketBushes = 0;
    let thicketFerns = 0;
    let thicketTufts = 0;
    let bankBushes = 0;
    let bankFerns = 0;
    let bankFlowers = 0;
    let flankFerns = 0;
    let flankMoss = 0;
    // the thicket: bushes and ferns from the south lip to the log's shoulders, either side of the
    // far path, densest at the corridor's edge (the walker brushes it), thinning 6 m out
    const [sx, sz] = [B.south[0], B.south[1]];
    const thicketBox: [number, number, number, number] = [sx - 9, sz - 2.5, sx + 9, TN.mouth[1] + 2.5];
    const corridorDistance = (x: number, z: number) => {
      // distance to the far path's centre line (south sill → mouth), less its half width
      const pts: [number, number][] = [...EXPANSION_SOUTH.farPath.map((p) => [p[0], p[2]] as [number, number]), [TN.mouth[0], TN.mouth[1]]];
      let best = Infinity;
      for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDistance(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
      return best - EXPANSION_SOUTH.farPathHalfWidth;
    };
    for (let i = 0; i < 900; i++) {
      const x = mm(thicketBox[0] + rng() * (thicketBox[2] - thicketBox[0]));
      const z = mm(thicketBox[1] + rng() * (thicketBox[3] - thicketBox[1]));
      const kind = rng();
      const draw = rng();
      const scale = rng();
      const c = greenVar(rng, 0.18);
      if (!farGround(x, z)) continue;
      const d = corridorDistance(x, z);
      if (d < 0.3) continue;
      const wgt = 1 - smoothstep(2.5, 7, d);
      if (draw > wgt * q.density) continue;
      const slope = groundOk(x, z, 0.3);
      if (slope < 0 || slope > 0.6) continue;
      if (kind < 0.3 && d > 0.7) {
        if (crowded(bushes, x, z, 1.15)) continue;
        plant(bushes, x, z, rng, 0.62 + scale * 0.4, 0.3, 0.05, greenVar(rng, 0.12));
        thicketBushes++;
      } else if (kind < 0.72) {
        if (crowded(ferns, x, z, 0.6)) continue;
        plant(ferns, x, z, rng, 0.6 + scale * 0.5, 0.55, 0.03, c);
        thicketFerns++;
      } else {
        plant(tufts, x, z, rng, 0.55 + scale * 0.5, 0.6, 0.01, c);
        thicketTufts++;
      }
    }
    // the bank: shrubs scattered over its shoulders and top, ferns in its folds, a few blooms
    for (let i = 0; i < 700; i++) {
      const x = mm(bankBox[0] + rng() * (bankBox[2] - bankBox[0]));
      const z = mm(bankBox[1] + rng() * (bankBox[3] - bankBox[1]));
      const kind = rng();
      const draw = rng();
      const scale = rng();
      const c = greenVar(rng, 0.18);
      if (!farGround(x, z)) continue;
      const t = tunnelLocal(x, z);
      const rise = moundHeight(t.a, t.c);
      if (rise < 0.35 || draw > smoothstep(0.35, 1.2, rise) * q.density) continue;
      const slope = groundOk(x, z, 0.25);
      if (slope < 0 || slope > 0.66) continue;
      if (kind < 0.14) {
        if (crowded(bushes, x, z, 1.6)) continue;
        plant(bushes, x, z, rng, 0.6 + scale * 0.45, 0.35, 0.06, greenVar(rng, 0.12));
        bankBushes++;
      } else if (kind < 0.5) {
        if (crowded(ferns, x, z, 0.7)) continue;
        plant(ferns, x, z, rng, 0.55 + scale * 0.5, 0.6, 0.03, c);
        bankFerns++;
      } else if (kind < 0.56) {
        plant(kind < 0.53 ? flowers : whiteFlowers, x, z, rng, 0.7 + scale * 0.4, 0.5, 0.01, greenVar(rng, 0.1));
        bankFlowers++;
      }
    }
    // the log's flanks: ferns banked against the bark from the mouth to the bank's face (they
    // hide where the berm meets it), moss along the contact
    for (let i = 0; i < 260; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const a = -0.2 + rng() * (M0.face[0] + 0.2);
      const off = TN.outerRadius + 0.12 + Math.pow(rng(), 1.4) * 1.3;
      const [x, z] = tunnelWorld(a, side * off).map(mm);
      const kind = rng();
      const scale = rng();
      const c = greenVar(rng, 0.2);
      const slope = groundOk(x, z, 0.1);
      if (slope < 0 || slope > 0.66) continue;
      if (kind < 0.45) {
        if (crowded(ferns, x, z, 0.55)) continue;
        // the fronds lean off the bark
        const [ox, oz] = tunnelWorld(a, side * (off + 1));
        n.x += (ox - x) * 0.5;
        n.z += (oz - z) * 0.5;
        n.normalize();
        plant(ferns, x, z, rng, 0.55 + scale * 0.5, 0.5, 0.03, c);
        flankFerns++;
      } else if (kind < 0.8 && off < TN.outerRadius + 0.6) {
        cushion(x, z, rng, 0.08 + scale * 0.2, mossTint(rng));
        flankMoss++;
      } else {
        plant(tufts, x, z, rng, 0.5 + scale * 0.5, 0.6, 0.01, c);
      }
    }
    Object.assign(counts, { thicketBushes, thicketFerns, thicketTufts, bankBushes, bankFerns, bankFlowers, flankFerns, flankMoss });
  }

  for (const set of sets) group.add(set.build());

  // ---- the locality's spheres: the ravine as a chain of spheres from its floor to over its lips
  // (the dressing's reach), the bank's footprint, the path's verges (the paving's spheres, grown)
  const sun = sunVector(ctx.config.sun.azimuthDeg, ctx.config.sun.elevationDeg);
  const casters: Caster[] = [];
  const line = southRavineLine();
  for (let i = 0; i < line.length; i += 4) {
    const [x, z, W, D] = line[i];
    if (D < 0.2) continue;
    const top = Math.max(T.height(x + (W + 1) * 0.7, z), T.height(x - (W + 1) * 0.7, z));
    casters.push({ x, z, r: W + EXPANSION_SOUTH.ravine.lip + 0.8, y0: top - D - 0.4, y1: top + 1.2, shadow: true });
  }
  for (let a = -2; a <= M0.back; a += 3.5) {
    for (let c = -M0.halfBase; c <= M0.halfBase; c += 3.5) {
      const [x, z] = tunnelWorld(a, c);
      const y = T.height(x, z);
      casters.push({ x, z, r: 2.6, y0: y - 0.4, y1: y + 1.6, shadow: true });
    }
  }
  const spheres: Sphere[] = casters.flatMap((c) => casterSpheres(c, sun));
  for (const s of southPathSpheres((x, z) => T.height(x, z))) spheres.push(new Sphere(s.center.clone(), s.radius + 1.6));
  return { group, sets, spheres, counts };
}
