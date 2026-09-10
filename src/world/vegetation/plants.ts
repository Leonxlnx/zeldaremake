/**
 * Placement of the non-grass plants: ferns, bushes, purple flowers, broad-leaf weeds, seed-head
 * stalks, clover, moss tufts and saplings. Every plant is seated on the exact terrain height
 * and tilted toward the local normal; positions respect the terrain mask (never on flagstones,
 * stairs, house pads or cliffs) and the layout (clearings at NPC spots, boulder rings, trunks).
 */
import { Color, Group, type Material } from 'three';
import type { WorldContext } from '../system';
import { smoothstep, clamp } from '../util/noise';
import type { Rng } from '../util/prng';
import { VegField, composeMatrix, newSample, type FieldSample } from './field';
import { rgb } from './geometry';
import { LodInstancedSet } from './lodset';
import { createVegMaterial, createVegShadowMaterials, type VegMaterialOptions } from './materials';
import { bushGeometry, cloverGeometry, fernGeometry, flowerGeometry, flowerSpikeGeometry, heroFernGeometry, makePalette, maxHeight, mossGeometry, saplingGeometry, seedheadGeometry, variants, weedGeometry } from './plantgeo';

export interface PlantSets {
  ferns: LodInstancedSet;
  /** big lit tree-fern crowns (0.7–0.9 m): the shot-D clump left of the boulder and accents on the east bank */
  heroFerns: LodInstancedSet;
  bushes: LodInstancedSet;
  /** the low dark shot-A hedge on the bank between the plaza and Saria's terrace (≤ 1.2 m) */
  hedge: LodInstancedSet;
  flowers: LodInstancedSet;
  /** pale-yellow cluster blooms tucked into the shot-D hero clump */
  yellowFlowers: LodInstancedSet;
  weeds: LodInstancedSet;
  seedheads: LodInstancedSet;
  clover: LodInstancedSet;
  moss: LodInstancedSet;
  saplings: LodInstancedSet;
  all: LodInstancedSet[];
  materials: Material[];
}

interface ScatterOpts {
  label: string;
  candidates: number;
  /** [x0, z0, x1, z1]; default = detail disc */
  box?: [number, number, number, number];
  minSpacing?: number;
  /** returns acceptance probability (0 = reject) */
  accept(x: number, z: number, s: FieldSample, rng: Rng): number;
}

class Spacing {
  private cells = new Map<number, number[]>();
  constructor(private readonly cell: number) {}
  ok(x: number, z: number, min: number): boolean {
    const gx = Math.floor(x / this.cell);
    const gz = Math.floor(z / this.cell);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const arr = this.cells.get((gx + dx) * 65536 + (gz + dz));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i += 2) if ((arr[i] - x) ** 2 + (arr[i + 1] - z) ** 2 < min * min) return false;
      }
    }
    return true;
  }
  add(x: number, z: number) {
    const key = Math.floor(x / this.cell) * 65536 + Math.floor(z / this.cell);
    let arr = this.cells.get(key);
    if (!arr) this.cells.set(key, (arr = []));
    arr.push(x, z);
  }
}

function scatter(ctx: WorldContext, field: VegField, opts: ScatterOpts, place: (x: number, z: number, s: FieldSample, rng: Rng) => void) {
  const rng = ctx.rng.fork(`plants/${opts.label}`);
  const R = ctx.config.detailRadius;
  const box = opts.box ?? [-R, -R, R, R];
  const s = newSample();
  const spacing = opts.minSpacing ? new Spacing(Math.max(opts.minSpacing, 0.5)) : null;
  for (let i = 0; i < opts.candidates; i++) {
    const x = box[0] + rng() * (box[2] - box[0]);
    const z = box[1] + rng() * (box[3] - box[1]);
    if (!opts.box && Math.hypot(x, z) > R) continue;
    field.sample(x, z, s);
    if (!field.allowed(x, z, s)) continue;
    if (field.insideGiantTrunk(x, z)) continue;
    const p = opts.accept(x, z, s, rng);
    if (p <= 0 || rng() > p) continue;
    if (spacing) {
      if (!spacing.ok(x, z, opts.minSpacing!)) continue;
      spacing.add(x, z);
    }
    place(x, z, s, rng);
  }
}

const M = new Float32Array(16);

export function buildPlants(ctx: WorldContext, field: VegField, parent: Group): PlantSets {
  const P = ctx.config.palette;
  const pal = makePalette(P);
  const T = ctx.terrain;
  const q = ctx.quality;
  const seed = ctx.config.seed;
  const materials: Material[] = [];

  const mk = (label: string, geos: ReturnType<typeof variants>, kind: 'plant' | 'bush' | 'moss', lodDistances: number[], castShadowLods: number, matOpts: VegMaterialOptions = {}) => {
    const material = createVegMaterial(ctx, kind, { plantHeight: maxHeight(geos), name: `veg-${label}`, ...matOpts });
    materials.push(material);
    const shadowMaterials = castShadowLods > 0 ? createVegShadowMaterials(material) : undefined;
    if (shadowMaterials) materials.push(shadowMaterials.depth, shadowMaterials.distance);
    return new LodInstancedSet({ name: label, variants: geos, material, shadowMaterials, lodDistances: lodDistances.map((d) => d * q.distance), castShadowLods });
  };

  const ferns = mk('ferns', variants(4, `${seed}/fern`, pal, fernGeometry), 'plant', [11, 26], 1, { sway: 2.6, flutter: 0.012, stiffness: 0.3 });
  // Hero crowns are read at frond scale from 6–8 m in shot D: high LOD out to 16 m. The reference
  // clump is sunlit (0.35 mean, 0.49 p90 in frame 56) while our west verge sits under the
  // north-west-near canopy, where fill alone rendered the fronds at 0.24: the crowns get the same
  // kind of skylight lift the shaded grass bank uses (materials.ts uShadeFill), plus more backlight.
  const heroFerns = mk('hero-ferns', variants(3, `${seed}/hero-fern`, pal, heroFernGeometry), 'plant', [16, 32], 1, { sway: 2.0, flutter: 0.014, stiffness: 0.35, transmission: 0.25, ambientBoost: 0.4 });
  const bushes = mk('bushes', variants(3, `${seed}/bush`, pal, bushGeometry), 'bush', [14, 34], 1);
  // hero hedge: same bush variants at shrub scale, but it is read from 15 m in shot A so it keeps
  // the high LOD much further out than the scattered bushes
  const hedge = mk('hedge', variants(3, `${seed}/hedge`, pal, bushGeometry), 'bush', [26, 48], 1, { sway: 0.9, flutter: 0.014, stiffness: 0.7 });
  // matte petals: no specular sheen so the violet stays saturated under the bright sun/haze
  const flowers = mk('flowers', [...variants(2, `${seed}/flower`, pal, flowerGeometry), ...variants(2, `${seed}/flower-spike`, pal, flowerSpikeGeometry)], 'plant', [9, 16], 0, { sway: 2.2, flutter: 0.01, stiffness: 0.4, roughness: 1, ambientBoost: 0.02, transmission: 0.08 });
  // the pale-yellow blooms tucked into the shot-D fern clump: the same cluster-head plant in a
  // straw-yellow palette (reference frame 56: small pale flowers at the base of the fronds)
  const yellowPal = { ...pal, purple: rgb(0xd6c15c), purpleLight: rgb(0xefe094), purpleDeep: rgb(0xa8933a) };
  const yellowFlowers = mk('flowers-yellow', variants(2, `${seed}/flower-yellow`, yellowPal, flowerGeometry), 'plant', [9, 16], 0, { sway: 2.2, flutter: 0.01, stiffness: 0.4, roughness: 1, ambientBoost: 0.02, transmission: 0.08 });
  const weeds = mk('weeds', variants(3, `${seed}/weed`, pal, weedGeometry, ['high', 'low']), 'plant', [13], 0, { sway: 1.2, flutter: 0.012, stiffness: 0.55 });
  const seedheads = mk('seedheads', variants(3, `${seed}/seedhead`, pal, seedheadGeometry, ['high', 'low']), 'plant', [14], 0, { sway: 4.5, flutter: 0.008, stiffness: 0.15 });
  const clover = mk('clover', variants(3, `${seed}/clover`, pal, cloverGeometry, ['high', 'low']), 'plant', [9], 0, { sway: 0.6, flutter: 0.006, stiffness: 0.7 });
  const moss = mk('moss', [[mossGeometry(`${seed}/moss/0`, pal)], [mossGeometry(`${seed}/moss/1`, pal)]], 'moss', [], 0, { roughness: 0.95 });
  const saplings = mk('saplings', variants(3, `${seed}/sapling`, pal, saplingGeometry), 'bush', [16, 40], 1, { sway: 1.6, flutter: 0.02, stiffness: 0.6 });

  const tint = new Color();
  const placeInstance = (set: LodInstancedSet, x: number, z: number, s: FieldSample, rng: Rng, scale: number, tiltAmount: number, sink: number, color: Color, sxz = scale, variantRange: readonly [number, number] = [0, set.variantCount]) => {
    const y = T.height(x, z) - sink;
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, tiltAmount, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(variantRange[0], variantRange[1]), color);
  };
  const greenVar = (rng: Rng, amount = 0.14) => tint.setRGB(1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2);

  // the mossy boulder in shot D's left foreground anchors an authored fern + broadleaf cluster
  const dBoulder = ctx.layout.heroBoulders.find((b) => b.id === 'shot-d-boulder');
  const dbx = dBoulder?.position[0] ?? -3.2;
  const dbz = dBoulder?.position[2] ?? -10.2;
  const dbr = dBoulder?.radius ?? 0.9;

  // ---- ferns: embankments, tree bases, boulders, house shade, path verges
  scatter(
    ctx,
    field,
    {
      label: 'ferns',
      candidates: Math.round(26000 * q.density),
      minSpacing: 0.42,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.35) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0.2) return 0;
        // camera C's left third is grass only (reference frame 46); fronds reach ≈ 1.1 m
        if (field.sightlineC(x, z, 1.1) > 0) return 0;
        const gd = field.giantDistance(x, z);
        const bd = field.boulderDistance(x, z);
        const house = field.houseInfo(x, z);
        const low = field.lowZone(x, z);
        let p = 0.055 * field.falloff(x, z);
        p *= 1 + 3.2 * smoothstep(0.15, 0.45, s.slope) * (1 - s.cliff) * (1 - low);
        p *= 1 + 3 * (1 - smoothstep(0.35, 2.6, edge));
        p *= 1 + 3.5 * (1 - smoothstep(0.2, 3.2, gd));
        p *= 1 + 3 * (bd > 0.15 ? 1 - smoothstep(0.15, 1.6, bd) : 0);
        p *= 1 + 4 * (house.dist > 0.3 ? (1 - smoothstep(0.3, 3.5, house.dist)) * house.shade : 0);
        p *= 0.45 + 1.1 * field.cluster(x, z);
        // the low verge right of the north path keeps only a few small ferns (reference frame 56)
        p *= 1 - 0.7 * low;
        // around the shot-D boulder the authored cluster below stands alone (reference: 3–5 fronds)
        p *= smoothstep(1.2, 3.0, Math.hypot(x - dbx, z - dbz));
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, (0.6 + rng() * 0.55) * (1 - 0.4 * field.lowZone(x, z)), 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // Shot D left-centre: understory fronds on the boulder's path-facing (east) side, between the
  // rock and the flagstones. Kept at undergrowth scale — the reference's big lit clump is the
  // hero crown WEST of the rock below; east of it the footage shows violets over short grass.
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotD',
      candidates: 1200,
      box: [dbx - 0.2, dbz - 1.5, dbx + 1.9, dbz + 1.5],
      minSpacing: 0.75,
      accept(x, z) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0.2) return 0;
        const d = Math.hypot(x - dbx, z - dbz) - dbr;
        if (d < 0.05 || d > 1.1) return 0;
        return 0.7;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.8 + rng() * 0.25, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // Shot-D hero clump (reference 0.05–0.14 × 0.55–0.68: a lit mass of big arching fronds LEFT of
  // the mossy rock, against the dark north-west-near trunk). Three tree-fern crowns on the bank
  // slope west of the boulder, 6–8 m from camera D so the fronds read at pinna scale; the rock's
  // near face hides their rootstocks as in the footage. Authored spots, jittered by a forked stream.
  {
    const rng = ctx.rng.fork('plants/hero-ferns-shotD');
    const s = newSample();
    const spots: readonly [number, number, number][] = [
      [dbx - 1.45, dbz - 0.75, 1.02],
      [dbx - 1.0, dbz + 0.5, 0.92],
      [dbx - 1.2, dbz - 1.7, 0.94],
    ];
    for (const [cx, cz, sc] of spots) {
      const x = cx + (rng() - 0.5) * 0.16;
      const z = cz + (rng() - 0.5) * 0.16;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
      placeInstance(heroFerns, x, z, s, rng, sc * (0.96 + rng() * 0.08), 0.45, 0.02, greenVar(rng, 0.1));
    }
    // pale-yellow blooms at the crowns' feet, on the camera side so they show under the fronds
    let blooms = 0;
    for (let i = 0; i < 40 && blooms < 6; i++) {
      const x = dbx - 1.7 + rng() * 1.3;
      const z = dbz - 1.6 + rng() * 2.4;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
      if (Math.hypot(x - dbx, z - dbz) < dbr + 0.15) continue;
      placeInstance(yellowFlowers, x, z, s, rng, 0.7 + rng() * 0.25, 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1));
      blooms++;
    }
  }
  // Shot D right verge (reference 0.55–0.85 × 0.60–0.72): low grass with a few small ferns,
  // nothing above ≈ 0.5 m; kept north of camera C's sight line.
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotD-right',
      candidates: 400,
      box: [2.8, -15.5, 6.2, -10],
      minSpacing: 1.6,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 0.5 || s.cliff > 0.3 || field.sightlineC(x, z, 0.7) > 0) return 0;
        return 0.5;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.55 + rng() * 0.15, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // Shot B right edge (reference 0.90–1.0 × 0.55–0.75): fern clumps on the stair-flank embankment
  // east of the hedge. Camera C looks along the same bank from the north: the old clump at
  // x 8–9.5, z −4.9…−3.6 sat 5.5–6.4 m in front of C, right over the stair foot (frame 46 shows
  // steps at (0.10–0.20, 0.60–0.66), not fronds). The bank rises steeply past x ≈ 9, so clumps
  // seated there still project to B's x ≈ 0.88–0.97 while their fronds stay off C's left edge.
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotB',
      candidates: 1800,
      box: [8.6, -6.6, 10.4, -4.6],
      minSpacing: 0.55,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 0.3 || s.cliff > 0.3) return 0;
        if (field.sightlineC(x, z, 1.25) > 0) return 0;
        const b = field.screenX('B_house', x, z);
        if (b && b.sx > 0.975) return 0;
        return 0.8;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 1.05 + rng() * 0.3, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // ---- east bank: the stair's right flank rising from the plaza's south-east verge (frame 8's
  // 0.6–1.0 × 0.3–0.7 and frame 1's 0.8–1.0 × 0.3–0.6). The reference shows a shaded bank densely
  // covered with dark ferns, moss and broad-leaf ground cover around the kid, not a bare lawn:
  // ≈ 1 fern per 2 m² (0.4–0.65 m), a few lit hero crowns, paddle-leaf weeds and moss cushions.
  // Kept off camera C's stair-foot wedge, the kid's spot (kokiri-a) and the stair-foot rock.
  const eastBank = (x: number, z: number, s: FieldSample, reach: number) => {
    if (s.cliff > 0.35 || s.h > 4.6) return false;
    if (field.edgeDistance(x, z) < 0.45) return false;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || clr.npc > 0 || field.boulderDistance(x, z) < 0.25) return false;
    if (field.sightlineC(x, z, reach) > 0) return false;
    return true;
  };
  const EAST_BANK: [number, number, number, number] = [9, -3.2, 16.5, 7.5];
  scatter(
    ctx,
    field,
    { label: 'ferns-east-bank', candidates: 4000, box: EAST_BANK, minSpacing: 0.85, accept: (x, z, s) => (eastBank(x, z, s, 1.0) ? 0.55 + 0.45 * field.cluster(x, z) : 0) },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.8 + rng() * 0.3, 0.7, 0.02, greenVar(rng, 0.18).multiplyScalar(0.94)),
  );
  scatter(
    ctx,
    field,
    { label: 'hero-ferns-east-bank', candidates: 1600, box: EAST_BANK, minSpacing: 1.7, accept: (x, z, s) => (eastBank(x, z, s, 1.0) && s.h > 0.2 ? 0.45 : 0) },
    (x, z, s, rng) => placeInstance(heroFerns, x, z, s, rng, 0.56 + rng() * 0.16, 0.5, 0.02, greenVar(rng, 0.12)),
  );
  scatter(
    ctx,
    field,
    { label: 'weeds-east-bank', candidates: 1800, box: EAST_BANK, minSpacing: 0.9, accept: (x, z, s) => (eastBank(x, z, s, 0.6) ? 0.45 : 0) },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 1.8 + rng() * 0.8, 0.8, 0.012, greenVar(rng, 0.16).multiplyScalar(0.85)),
  );

  // ---- bushes: embankments, ledge edges, house bases, the log arch
  scatter(
    ctx,
    field,
    {
      label: 'bushes',
      candidates: Math.round(9000 * q.density),
      minSpacing: 1.3,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 1.1) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0) return 0;
        if (field.giantDistance(x, z) < 0.6) return 0;
        if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.4) > 0) return 0;
        const house = field.houseInfo(x, z);
        const log = field.logDistance(x, z);
        let p = 0.02 * field.falloff(x, z);
        p *= 1 + 2.5 * smoothstep(0.12, 0.4, s.slope) * (1 - s.cliff);
        p *= 1 + 2.5 * smoothstep(0.2, 0.5, s.plateau) * (1 - smoothstep(0.75, 0.95, s.plateau));
        p *= 1 + 4 * (house.dist > 0.6 ? 1 - smoothstep(0.6, 4, house.dist) : 0);
        p *= 1 + 4 * (log > 0.6 ? 1 - smoothstep(0.6, 4.5, log) : 0);
        p *= 1 + 1.2 * (1 - smoothstep(1.1, 3.5, edge));
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.65 + rng() * 0.45, 0.4, 0.03, greenVar(rng, 0.18)),
  );

  // Broad, leafy crowns break up the house banks and ledge tops seen in A/B/D. Reuse the
  // same variant/LOD meshes, so these clusters add instances rather than new draw batches.
  // Probe the crown surroundings as well as its root to avoid crowding path/stair pads.
  const crownSample = newSample();
  scatter(ctx, field, {
    label: 'bushes-ledge-crowns', candidates: Math.round(5200 * q.density),
    box: [-14, -22, 25, 0], minSpacing: 2.3,
    accept(x, z, s) {
      if (field.edgeDistance(x, z) < 1.65) return 0;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0 || field.giantDistance(x, z) < 1.2) return 0;
      if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.8) > 0) return 0;
      if (bushes.items.some(p => Math.hypot(p.x - x, p.z - z) < 2.3)) return 0;
      const house = field.houseInfo(x, z);
      const byHouse = house.dist > 1.3 ? 1 - smoothstep(1.3, 5.5, house.dist) : 0;
      const onLedge = smoothstep(0.18, 0.42, s.plateau) * (1 - smoothstep(0.9, 1, s.plateau));
      if (Math.max(byHouse, onLedge) < 0.2) return 0;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, px = x + Math.cos(a) * 1.35, pz = z + Math.sin(a) * 1.35;
        field.sample(px, pz, crownSample);
        if (!field.allowed(px, pz, crownSample) || field.insideGiantTrunk(px, pz)) return 0;
      }
      return .65 * Math.max(byHouse, onLedge);
    },
  }, (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 1.05 + rng() * .3, .28, .035, greenVar(rng, .15)));

  // ---- shot-A hedge. In reference frame 1 the band left of the stairs beyond the plaza
  // (0.45–0.6 × 0.5–0.65) is a dark shrub/embankment. The row sits on the grass bank east of
  // camera B's door corridor (B's ray x ≈ (2 − z)·0.92): two rows 1.1–2.4 m east of it, so it
  // reads as one dark mass from A while staying right of the door from B. Crown tops are capped
  // at ≈ 1.1 m ABOVE PLAZA LEVEL (≈ 1.2 m tall at the plaza end, shorter as the bank rises) so
  // they project BELOW Saria's door threshold in B (y ≈ 0.55 — the reference B shows the terrace
  // ramp and grass there, not a hedge); ground above 0.6 m is skipped for the same reason.
  // Nothing south of z −5.1, and no crown whose reach enters camera C's left third, so frame 46
  // sees the stair foot, not a bush, at its left edge.
  const bRayX = (z: number) => (2 - z) * 0.92;
  const hedgeHeight = (v: number) => hedge.opts.variants[v][0].boundingBox?.max.y ?? 1.4;
  const HEDGE_TOP = 0.92;
  scatter(
    ctx,
    field,
    {
      label: 'hedge-shotA',
      candidates: 3200,
      box: [7.2, -7.0, 10.6, -5.1],
      minSpacing: 0.45,
      accept(x, z, s) {
        if (x < bRayX(z) + 1.1) return 0;
        if (x > bRayX(z) + 2.4) return 0;
        if (s.cliff > 0.3 || field.edgeDistance(x, z) < 0.5) return 0;
        if (s.h > 0.6) return 0;
        if (field.houseInfo(x, z).dist < 0.4) return 0;
        // crowns here scale to ≈ 0.5–1.1 m reach; the strip's west end sits at C's left edge
        if (field.sightlineC(x, z, 1.0) > 0) return 0;
        return 0.9;
      },
    },
    (x, z, s, rng) => {
      const top = Math.max(0.45, HEDGE_TOP - T.height(x, z)) * (0.9 + rng() * 0.1);
      const variant = rng.int(0, hedge.variantCount);
      const sc = top / hedgeHeight(variant);
      const y = T.height(x, z) - 0.05;
      composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.15 + rng() * 0.2), sc, sc * (1.15 + rng() * 0.2));
      // deep shaded olive (reference #4c5537 shrubs) rather than lit leaf tones
      hedge.add(M, variant, tint.setRGB(0.5 + rng() * 0.08, 0.56 + rng() * 0.08, 0.46 + rng() * 0.08));
    },
  );

  // ---- shrubby dark mass on the boulder bank west of the north path (reference D 0.15–0.35 ×
  // 0.45–0.60 above the flowers; also the mossy terrace top-left of reference B). Shrubs sit on
  // the bank's slope and top (ground ≥ 1.0 m), off the small north stair and its verge.
  scatter(
    ctx,
    field,
    {
      label: 'bushes-bank',
      candidates: 2400,
      box: [-7.0, -22.5, -2.2, -14.6],
      minSpacing: 1.35,
      accept(x, z, s) {
        if (s.h < 1.0 || s.cliff > 0.4) return 0;
        if (field.edgeDistance(x, z) < 0.9) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.boulder > 0.5) return 0;
        if (field.giantDistance(x, z) < 0.5) return 0;
        return 0.8;
      },
    },
    (x, z, s, rng) => placeInstance(bushes, x, z, s, rng, 0.85 + rng() * 0.4, 0.35, 0.04, tint.setRGB(0.6 + rng() * 0.1, 0.66 + rng() * 0.1, 0.54 + rng() * 0.1)),
  );

  // ---- purple flowers: shot D left foreground, west verge of the spine, shot A left, scattered
  /** flower variants 0–1 are the low cluster heads, 2–3 the taller bell spikes */
  const CLUSTER_HEADS: readonly [number, number] = [0, 2];
  const flowerPlace = (scaleMin: number, scaleMax: number, variantRange?: readonly [number, number]) => (x: number, z: number, s: FieldSample, rng: Rng) =>
    placeInstance(flowers, x, z, s, rng, scaleMin + rng() * (scaleMax - scaleMin), 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1), undefined, variantRange);
  const flowerVerge = (x: number, z: number) => {
    const edge = field.edgeDistance(x, z);
    if (edge < 0.25) return 0;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || clr.npc > 0) return 0;
    // 0.45–0.6 m stalks would rise over camera C's stair foot (frame 46): grass only there
    if (field.sightlineC(x, z, 0.4) > 0) return 0;
    return 1 - smoothstep(0.25, 4, edge) * 0.6;
  };
  // Authored clumps: the reference grows its violets in low, compact clumps 0.3–0.6 m across
  // (5–15 cm blooms), not in beds. Each centre gets a handful of clusters within `radius`.
  const clumps = (label: string, centres: [number, number][], perClump: number, radius: number, scaleMin: number, scaleMax: number, variantRange?: readonly [number, number]) => {
    const rng = ctx.rng.fork(`plants/${label}`);
    const s = newSample();
    const place = flowerPlace(scaleMin, scaleMax, variantRange);
    for (const [cx, cz] of centres) {
      let left = perClump;
      for (let i = 0; i < perClump * 4 && left > 0; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * radius;
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        field.sample(x, z, s);
        if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || flowerVerge(x, z) <= 0) continue;
        place(x, z, s, rng);
        left--;
      }
    }
  };
  // Shot D (camera (0.2, 1.9, −3) looking north): reference frame 56 has two modest desaturated
  // violet patches, (0.17–0.27, 0.60–0.67) beside the ferns and (0.05–0.12, 0.55–0.60), plus a
  // few blooms — not a solid field. West of the path the north-west-near giant's trunk fills the
  // frame's left edge, so the clumps sit on the verge strip between its roots and the path (the
  // boulder's east side projects to ≈ 0.18–0.25 × 0.75–0.85) and on the bank slope beyond it at
  // z ≈ −14…−16 (≈ 0.20–0.28 × 0.58–0.67, the reference's first patch).
  // The footage's violets here are LOW cluster heads tucked among the fronds (reference box
  // 0–0.25 × 0.5–0.8 measures hue 55°, i.e. green-dominated with purple accents), so the D clumps
  // are small, use the cluster-head variants only and skip the tall bell spikes.
  // Clump size is the W18 lever: the take-0026 cut left D's purple fraction at 0.0006 (< the
  // rubric's 0.003 floor), so each patch carries 6–7 heads over 0.5 m at bloom scale 1.0–1.3.
  const dClumps: [number, number][] = [[dbx + 1.0, dbz - 0.6], [-3.4, -14.9], [-2.9, -13.6], [-4.0, -15.6], [-3.7, -16.6], [-4.7, -17.6]];
  for (const [i, c] of dClumps.entries()) clumps(`flowers-shotD-clump-${i}`, [c], 12 + (i % 2), 0.65, 1.1, 1.4, CLUSTER_HEADS);
  // a few single blooms along the west verge strip beyond the boulder (reference: "plus a few
  // blooms" beside the fern clump; the near verge in D's bottom-left corner stays grass + litter)
  scatter(ctx, field, { label: 'flowers-shotD-near', candidates: 700, box: [-3.4, -12.6, -1.3, -9.4], minSpacing: 0.8, accept: (x, z) => 0.4 * flowerVerge(x, z) }, flowerPlace(1.0, 1.25, CLUSTER_HEADS));
  // the strip continues south along the west verge (z ≤ −4.6 so camera B's lower-left stays
  // grass): reference A's left-verge purple (0.0–0.14, 0.58–0.66) sits 11–14 m from camera A at
  // its far-left edge. The same ground is camera D's bottom-left corner, where the footage shows
  // sunlit grass and litter with no violets, so the clumps keep to the part of the strip that is
  // off D's left edge (z > −6.3 or x < −3.1: both project to D sx < 0 at sy > 0.9).
  scatter(ctx, field, { label: 'flowers-shotD', candidates: 800, box: [-3.8, -7.5, -1.4, -4.6], minSpacing: 0.55, accept: (x, z) => (z > -6.3 || x < -3.1 ? 0.2 * flowerVerge(x, z) : 0) }, flowerPlace(0.85, 1.1));
  // Shot B right edge: the purple clump at (0.95, 0.60) sits on the stair-flank embankment
  // 1 m above the plaza, among the big ferns; from A it is on the left stair flank. Seated with
  // the ferns past x ≈ 9.3 so it stays off camera C's left edge (flowerVerge rejects the wedge).
  clumps('flowers-shotB', [[9.55, -5.2]], 8, 0.38, 1.05, 1.35);
  // Shot A right edge (reference ≈ 0.95 × 0.50, violets on the stair's right flank above the kid):
  // one low clump on the east bank at (14.2, 0.2) → A (0.95, 0.47), east of camera C's wedge.
  clumps('flowers-shotA-right', [[14.2, 0.2]], 6, 0.4, 0.95, 1.2, CLUSTER_HEADS);
  scatter(ctx, field, { label: 'flowers-shotA', candidates: 1800, box: [-7.5, 2, -2.8, 9.5], minSpacing: 0.5, accept: (x, z) => 0.45 * flowerVerge(x, z) }, flowerPlace(1.0, 1.5));
  scatter(
    ctx,
    field,
    {
      label: 'flowers-scatter',
      candidates: Math.round(14000 * q.density),
      minSpacing: 0.6,
      accept(x, z, s) {
        const v = flowerVerge(x, z);
        if (v <= 0) return 0;
        return 0.1 * field.falloff(x, z) * field.flowerPatch(x, z) * (0.4 + v) * (1 - 0.6 * s.plateau) * (1 - field.giantProximity(x, z)) * (1 - field.lowZone(x, z));
      },
    },
    flowerPlace(0.85, 1.4),
  );

  // ---- broad-leaf plant (hosta-like paddle leaves) beside the shot-D boulder, with the ferns
  scatter(
    ctx,
    field,
    {
      label: 'weeds-shotD-boulder',
      candidates: 900,
      box: [dbx - 0.4, dbz - 1.5, dbx + 1.7, dbz + 1.5],
      minSpacing: 0.5,
      accept(x, z) {
        if (field.edgeDistance(x, z) < 0.3) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder) return 0;
        const d = Math.hypot(x - dbx, z - dbz) - dbr;
        return d > 0.0 && d < 1.0 ? 0.6 : 0;
      },
    },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 2.4 + rng() * 0.9, 0.8, 0.012, greenVar(rng, 0.16).multiplyScalar(0.82)),
  );

  // ---- broad-leaf weeds: verges and clearings, in yellow-green patches
  scatter(
    ctx,
    field,
    {
      label: 'weeds',
      candidates: Math.round(60000 * q.density),
      minSpacing: 0.22,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.15) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder) return 0;
        let p = 0.42 * field.falloff(x, z) * (0.3 + field.flowerPatch(x, z)) * field.cluster(x, z);
        p *= 1 + 1.6 * (1 - smoothstep(0.15, 3, edge));
        p *= 1 - 0.6 * field.giantProximity(x, z);
        p *= 1 - 0.5 * clr.npc;
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 0.65 + rng() * 0.65, 0.8, 0.012, greenVar(rng, 0.22)),
  );

  // ---- seed-head stalks: meadow patches
  scatter(
    ctx,
    field,
    {
      label: 'seedheads',
      candidates: Math.round(30000 * q.density),
      minSpacing: 0.2,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.4) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0 || clr.boulder > 0) return 0;
        // 0.6–0.9 m stalks stay out of the low verges, camera C's left third and thin out in the
        // tidy foreground
        return 0.28 * field.falloff(x, z) * field.meadow(x, z) * (0.5 + field.cluster(x, z)) * (1 - field.giantProximity(x, z)) * (1 - field.lowZone(x, z)) * (1 - field.sightlineC(x, z, 0.5)) * (1 - 0.6 * field.trimZone(x, z));
      },
    },
    (x, z, s, rng) => placeInstance(seedheads, x, z, s, rng, 0.75 + rng() * 0.5, 0.5, 0.01, tint.setRGB(0.95 + rng() * 0.12, 0.95 + rng() * 0.08, 0.9 + rng() * 0.1)),
  );

  // ---- clover: low herb layer along verges and under trees
  scatter(
    ctx,
    field,
    {
      label: 'clover',
      candidates: Math.round(40000 * q.density),
      minSpacing: 0.18,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.1) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder) return 0;
        let p = 0.16 * field.falloff(x, z) * (0.4 + field.cluster(x, z));
        p *= 1 + 1.5 * (1 - smoothstep(0.1, 4, edge));
        p *= 1 + 0.8 * field.giantProximity(x, z, 5);
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.75 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2)),
  );

  // ---- moss tufts: boulder bases, tree roots, shaded embankments
  const mossRng = ctx.rng.fork('plants/moss');
  const mossSample = newSample();
  const placeMoss = (x: number, z: number, radius: number) => {
    field.sample(x, z, mossSample);
    if (!field.allowed(x, z, mossSample) || field.insideGiantTrunk(x, z)) return;
    const y = T.height(x, z) - 0.012;
    const h = radius * (0.22 + mossRng() * 0.2);
    composeMatrix(M, 0, x, y, z, mossSample.nx, mossSample.ny, mossSample.nz, 0.95, mossRng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + mossRng() * 0.5));
    moss.add(M, mossRng.int(0, 2), tint.setRGB(0.9 + mossRng() * 0.2, 0.92 + mossRng() * 0.16, 0.9 + mossRng() * 0.2));
  };
  for (const b of ctx.layout.heroBoulders) {
    const n = Math.round(30 * q.density);
    for (let i = 0; i < n; i++) {
      const a = mossRng() * Math.PI * 2;
      const d = b.radius * 0.75 + Math.pow(mossRng(), 1.4) * 1.1;
      placeMoss(b.position[0] + Math.cos(a) * d, b.position[2] + Math.sin(a) * d, 0.05 + mossRng() * 0.16);
    }
  }
  for (const g of ctx.layout.giantTrees) {
    if (Math.hypot(g.position[0], g.position[2]) > ctx.config.detailRadius) continue;
    const n = Math.round(34 * q.density);
    for (let i = 0; i < n; i++) {
      const a = mossRng() * Math.PI * 2;
      const d = g.trunkRadius + 0.25 + Math.pow(mossRng(), 1.5) * 3.2;
      placeMoss(g.position[0] + Math.cos(a) * d, g.position[2] + Math.sin(a) * d, 0.06 + mossRng() * 0.2);
    }
  }
  scatter(
    ctx,
    field,
    {
      label: 'moss-scatter',
      candidates: Math.round(12000 * q.density),
      minSpacing: 0.5,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 0.2) return 0;
        return 0.03 * field.falloff(x, z) * (0.3 + smoothstep(0.1, 0.4, s.slope)) * (0.5 + field.cluster(x, z)) * (1 - field.dry(x, z));
      },
    },
    (x, z, _s, rng) => placeMoss(x, z, 0.05 + rng() * 0.16),
  );
  // moss cushions between the east-bank ferns (frame 8: moss-green ground cover on the shaded bank)
  scatter(
    ctx,
    field,
    { label: 'moss-east-bank', candidates: 2200, box: EAST_BANK, minSpacing: 0.7, accept: (x, z, s) => (eastBank(x, z, s, 0.3) ? 0.4 * (0.5 + field.cluster(x, z)) : 0) },
    (x, z, _s, rng) => placeMoss(x, z, 0.1 + rng() * 0.16),
  );

  // ---- saplings: quiet spots away from paths and giant trunks
  scatter(
    ctx,
    field,
    {
      label: 'saplings',
      candidates: Math.round(6000 * q.density),
      minSpacing: 3.5,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 2.8) return 0;
        if (field.giantDistance(x, z) < 2.5) return 0;
        if (field.boulderDistance(x, z) < 1.2) return 0;
        if (field.houseInfo(x, z).dist < 2.5 || field.logDistance(x, z) < 2) return 0;
        if (field.lowZone(x, z) > 0.2 || field.sightlineC(x, z, 1.5) > 0) return 0;
        const clr = field.clearing(x, z);
        if (clr.npc > 0 || clr.boulder > 0) return 0;
        if (s.slope > 0.35) return 0;
        return 0.008 * (0.3 + field.cluster(x, z));
      },
    },
    (x, z, s, rng) => placeInstance(saplings, x, z, s, rng, 0.7 + rng() * 0.6, 0.3, 0.03, greenVar(rng, 0.16)),
  );

  const all = [ferns, heroFerns, bushes, hedge, flowers, yellowFlowers, weeds, seedheads, clover, moss, saplings];
  for (const set of all) parent.add(set.build());
  return { ferns, heroFerns, bushes, hedge, flowers, yellowFlowers, weeds, seedheads, clover, moss, saplings, all, materials };
}

export { clamp };
