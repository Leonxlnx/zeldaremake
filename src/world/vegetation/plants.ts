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
import { LodInstancedSet } from './lodset';
import { createVegMaterial, createVegShadowMaterials, type VegMaterialOptions } from './materials';
import { bushGeometry, cloverGeometry, fernGeometry, flowerGeometry, flowerSpikeGeometry, makePalette, maxHeight, mossGeometry, saplingGeometry, seedheadGeometry, variants, weedGeometry } from './plantgeo';

export interface PlantSets {
  ferns: LodInstancedSet;
  bushes: LodInstancedSet;
  /** the tall shot-A hedge on the bank between the plaza and Saria's terrace */
  hedge: LodInstancedSet;
  flowers: LodInstancedSet;
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
  const bushes = mk('bushes', variants(3, `${seed}/bush`, pal, bushGeometry), 'bush', [14, 34], 1);
  // hero hedge: same bush variants at shrub scale, but it is read from 15 m in shot A so it keeps
  // the high LOD much further out than the scattered bushes
  const hedge = mk('hedge', variants(3, `${seed}/hedge`, pal, bushGeometry), 'bush', [26, 48], 1, { sway: 0.9, flutter: 0.014, stiffness: 0.7 });
  // matte petals: no specular sheen so the violet stays saturated under the bright sun/haze
  const flowers = mk('flowers', [...variants(2, `${seed}/flower`, pal, flowerGeometry), ...variants(2, `${seed}/flower-spike`, pal, flowerSpikeGeometry)], 'plant', [9, 16], 0, { sway: 2.2, flutter: 0.01, stiffness: 0.4, roughness: 1, ambientBoost: 0.02, transmission: 0.08 });
  const weeds = mk('weeds', variants(3, `${seed}/weed`, pal, weedGeometry, ['high', 'low']), 'plant', [13], 0, { sway: 1.2, flutter: 0.012, stiffness: 0.55 });
  const seedheads = mk('seedheads', variants(3, `${seed}/seedhead`, pal, seedheadGeometry, ['high', 'low']), 'plant', [14], 0, { sway: 4.5, flutter: 0.008, stiffness: 0.15 });
  const clover = mk('clover', variants(3, `${seed}/clover`, pal, cloverGeometry, ['high', 'low']), 'plant', [9], 0, { sway: 0.6, flutter: 0.006, stiffness: 0.7 });
  const moss = mk('moss', [[mossGeometry(`${seed}/moss/0`, pal)], [mossGeometry(`${seed}/moss/1`, pal)]], 'moss', [], 0, { roughness: 0.95 });
  const saplings = mk('saplings', variants(3, `${seed}/sapling`, pal, saplingGeometry), 'bush', [16, 40], 1, { sway: 1.6, flutter: 0.02, stiffness: 0.6 });

  const tint = new Color();
  const placeInstance = (set: LodInstancedSet, x: number, z: number, s: FieldSample, rng: Rng, scale: number, tiltAmount: number, sink: number, color: Color, sxz = scale) => {
    const y = T.height(x, z) - sink;
    composeMatrix(M, 0, x, y, z, s.nx, s.ny, s.nz, tiltAmount, rng() * Math.PI * 2, sxz, scale, sxz);
    set.add(M, rng.int(0, set.variantCount), color);
  };
  const greenVar = (rng: Rng, amount = 0.14) => tint.setRGB(1 + (rng() - 0.5) * amount, 1 + (rng() - 0.5) * amount * 0.7, 1 + (rng() - 0.5) * amount * 1.2);

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
        const gd = field.giantDistance(x, z);
        const bd = field.boulderDistance(x, z);
        const house = field.houseInfo(x, z);
        let p = 0.055 * field.falloff(x, z);
        p *= 1 + 3.2 * smoothstep(0.15, 0.45, s.slope) * (1 - s.cliff);
        p *= 1 + 3 * (1 - smoothstep(0.35, 2.6, edge));
        p *= 1 + 3.5 * (1 - smoothstep(0.2, 3.2, gd));
        p *= 1 + 3 * (bd > 0.15 ? 1 - smoothstep(0.15, 1.6, bd) : 0);
        p *= 1 + 4 * (house.dist > 0.3 ? (1 - smoothstep(0.3, 3.5, house.dist)) * house.shade : 0);
        p *= 0.45 + 1.1 * field.cluster(x, z);
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.6 + rng() * 0.55, 0.7, 0.02, greenVar(rng, 0.2)),
  );
  // large ferns arching over the west verge in the left foreground of shot D (with the flowers)
  scatter(
    ctx,
    field,
    {
      label: 'ferns-shotD',
      candidates: 1400,
      box: [-6.2, -12, -3.2, -5.6],
      minSpacing: 0.55,
      accept(x, z) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || clr.npc > 0.2) return 0;
        return 0.45 * (1 - smoothstep(0.3, 2.4, edge) * 0.7);
      },
    },
    (x, z, s, rng) => placeInstance(ferns, x, z, s, rng, 0.95 + rng() * 0.5, 0.7, 0.02, greenVar(rng, 0.2)),
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

  // ---- shot-A hedge. In reference frame 1 the centre of the frame beyond the plaza is a dark
  // hedge/embankment; in ours Saria's doorway sat there. Camera A's sight line to the door runs
  // over the grass bank at x ≈ 7.7–8.3 for z ∈ [-5.5, -4.5] while camera B's runs ≈ 1.5 m further
  // west (x ≈ 6.0–6.9), so a dense mass of tall shrubs east of B's corridor hides the trunk and
  // doorway from A yet only brushes the right of the door from B — where the reference B frame
  // has a shrub as well. Positions stay on terrain that the mask allows (never path/stairs).
  const bRayX = (z: number) => (2 - z) * 0.92;
  const aRayX = (z: number) => 0.4 + (8.6 - z) * 0.556;
  scatter(
    ctx,
    field,
    {
      label: 'hedge-shotA',
      candidates: 2600,
      box: [7.2, -6.6, 10.2, -3.8],
      minSpacing: 0.62,
      accept(x, z, s) {
        // A's sight line runs ~1.5 m east of B's; crowns reach ~0.6 m from the centre, so a row
        // centred 1.1–1.45 m east of B's ray covers A's ray while leaving B's door (whose
        // right-edge ray is ~0.4 m east of B's centre ray here) clear
        if (x < bRayX(z) + 1.1) return 0;
        if (x > bRayX(z) + 1.45) return 0;
        if (s.cliff > 0.3 || field.edgeDistance(x, z) < 0.5) return 0;
        if (field.houseInfo(x, z).dist < 0.4) return 0;
        return 0.9;
      },
    },
    (x, z, s, rng) => {
      // scale 1 bushes stand 0.95–1.5 m; the hedge needs a 2.4–3 m crown so its top reaches the
      // door lintel's projection in A, and it is kept narrower than tall so it stays out of B
      const sc = 2.1 + rng() * 0.6;
      placeInstance(hedge, x, z, s, rng, sc, 0.12, 0.05, tint.setRGB(0.7 + rng() * 0.1, 0.78 + rng() * 0.08, 0.66 + rng() * 0.1), sc * (0.46 + rng() * 0.08));
    },
  );

  // ---- purple flowers: shot D left foreground, west verge of the spine, shot A left, scattered
  const flowerPlace = (scaleMin: number, scaleMax: number) => (x: number, z: number, s: FieldSample, rng: Rng) => placeInstance(flowers, x, z, s, rng, scaleMin + rng() * (scaleMax - scaleMin), 0.6, 0.012, tint.setRGB(0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1));
  const flowerVerge = (x: number, z: number) => {
    const edge = field.edgeDistance(x, z);
    if (edge < 0.25) return 0;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || clr.npc > 0) return 0;
    return 1 - smoothstep(0.25, 4, edge) * 0.6;
  };
  // shot D (camera 1.2,1.9,-1 looking north): the frame's left edge runs from ≈(-2,-6) to (-7,-14),
  // so the visible left-foreground verge is the strip just west of the path edge (x ≈ -4.5…-3.2)
  // at z ∈ [-10,-5.5], opening into the hillside drift further north.
  // camera D now stands at (1, -3) looking north, so the near bed extends 1.5 m further south
  // and is denser: reference frame 56 carries a purple bed over the whole lower-left
  scatter(ctx, field, { label: 'flowers-shotD-near', candidates: 9500, box: [-5.8, -11, -3.0, -3.8], minSpacing: 0.21, accept: (x, z) => 1.0 * flowerVerge(x, z) }, flowerPlace(1.6, 2.2));
  scatter(ctx, field, { label: 'flowers-shotD-drift', candidates: 9000, box: [-7.8, -16.5, -3.2, -7.5], minSpacing: 0.24, accept: (x, z) => 0.95 * flowerVerge(x, z) }, flowerPlace(1.5, 2.1));
  scatter(ctx, field, { label: 'flowers-shotD', candidates: 5000, box: [-7, -7.5, -2.6, 3], minSpacing: 0.4, accept: (x, z) => 0.6 * flowerVerge(x, z) }, flowerPlace(1.25, 1.8));
  // a few blooms on the near right verge below the house stair (3–6 m from the shot-D camera)
  scatter(ctx, field, { label: 'flowers-shotD-right', candidates: 1500, box: [2.4, -7.6, 4.8, -3.4], minSpacing: 0.45, accept: (x, z) => 0.5 * flowerVerge(x, z) }, flowerPlace(1.3, 1.8));
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
        return 0.075 * field.falloff(x, z) * field.flowerPatch(x, z) * (0.4 + v) * (1 - 0.6 * s.plateau) * (1 - field.giantProximity(x, z));
      },
    },
    flowerPlace(0.85, 1.4),
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
        return 0.28 * field.falloff(x, z) * field.meadow(x, z) * (0.5 + field.cluster(x, z)) * (1 - field.giantProximity(x, z));
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
        const clr = field.clearing(x, z);
        if (clr.npc > 0 || clr.boulder > 0) return 0;
        if (s.slope > 0.35) return 0;
        return 0.008 * (0.3 + field.cluster(x, z));
      },
    },
    (x, z, s, rng) => placeInstance(saplings, x, z, s, rng, 0.7 + rng() * 0.6, 0.3, 0.03, greenVar(rng, 0.16)),
  );

  const all = [ferns, bushes, hedge, flowers, weeds, seedheads, clover, moss, saplings];
  for (const set of all) parent.add(set.build());
  return { ferns, bushes, hedge, flowers, weeds, seedheads, clover, moss, saplings, all, materials };
}

export { clamp };
