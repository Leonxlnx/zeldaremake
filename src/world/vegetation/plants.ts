/**
 * Placement of the non-grass plants: ferns and their fiddleheads, bushes, purple and white
 * flowers, broad-leaf plants, seed-head stalks, clover, moss tufts (including the path-edge
 * band) and saplings. Every plant is seated on the exact terrain height
 * and tilted toward the local normal; positions respect the terrain mask (never on flagstones,
 * stairs, house pads or cliffs) and the layout (clearings at NPC spots, boulder rings, trunks).
 */
import { Color, Group, type Material } from 'three';
import { ROPE_FENCES, houseSteppingStones } from '../layout';
import type { WorldContext } from '../system';
import { smoothstep, clamp } from '../util/noise';
import type { Rng } from '../util/prng';
import { VegField, composeMatrix, newSample, type FieldSample } from './field';
import { rgb } from './geometry';
import { LodInstancedSet, type PackLayout } from './lodset';
import { createVegMaterial, createVegShadowMaterials, type VegMaterialOptions } from './materials';
import { bushGeometry, cloverGeometry, fernGeometry, fiddleheadGeometry, flowerGeometry, flowerSpikeGeometry, heroFernGeometry, makePalette, maxHeight, mossGeometry, saplingGeometry, seedheadGeometry, variants, weedGeometry, whiteFlowerGeometry } from './plantgeo';

export interface PlantSets {
  ferns: LodInstancedSet;
  /** big lit tree-fern crowns (0.7–0.9 m): the shot-D clump left of the boulder and accents on the east bank */
  heroFerns: LodInstancedSet;
  /** spiral buds (0.25–0.45 m) at the hero crowns and a share of the near fern clumps (concept sheet 01 / 04) */
  fiddleheads: LodInstancedSet;
  bushes: LodInstancedSet;
  /** the low dark shot-A hedge on the bank between the plaza and Saria's terrace (≤ 1.2 m) */
  hedge: LodInstancedSet;
  flowers: LodInstancedSet;
  /** pale-yellow cluster blooms tucked into the shot-D hero clump */
  yellowFlowers: LodInstancedSet;
  /** small five-petal white forest flowers with yellow centres, in clumps along the path edges (concept sheets 01 / 02 / 04) */
  whiteFlowers: LodInstancedSet;
  /** broad-leaf ground plants: heart / ovate / round laminae with a glossy top face */
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
  /**
   * ≤ 0.3 m herb layer (clover, moss) that may grow in the trodden strip between Saria's stepping
   * stones and right up to their rims; everything else keeps 0.5 m off the stones and out of the
   * strip (reference B/E: short sparse grass and litter there, nothing standing).
   */
  low?: boolean;
  /** stop after this many placements (authored clump counts) */
  max?: number;
  /** returns acceptance probability (0 = reject) */
  accept(x: number, z: number, s: FieldSample, rng: Rng): number;
}

const STONE_CLEARANCE = 0.5;
/** metres of lawn outside the flagstone rim that the path-edge moss / litter soften (sheet 02) */
const RIM_BAND = 0.25;
const RIM_MOSS_CANDIDATES_PER_M = 3.8;
/** frame 56's sunlit bud stalks are khaki-yellow against the green bank */
const TALL_BUD_TINT = new Color(1.55, 1.38, 0.82);

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
  let placed = 0;
  for (let i = 0; i < opts.candidates && placed < (opts.max ?? Infinity); i++) {
    const x = box[0] + rng() * (box[2] - box[0]);
    const z = box[1] + rng() * (box[3] - box[1]);
    if (!opts.box && Math.hypot(x, z) > R) continue;
    field.sample(x, z, s);
    if (!field.allowed(x, z, s)) continue;
    if (field.insideGiantTrunk(x, z)) continue;
    const p = opts.accept(x, z, s, rng);
    if (p <= 0 || rng() > p) continue;
    // after the draw, so the candidate stream stays as it was for every other placement
    if (!opts.low && (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6)) continue;
    if (spacing) {
      if (!spacing.ok(x, z, opts.minSpacing!)) continue;
      spacing.add(x, z);
    }
    place(x, z, s, rng);
    placed++;
  }
}

const M = new Float32Array(16);

/**
 * Variant packs (lodset.ts): which variants of a set share one InstancedMesh at each LOD. Every
 * variant merged into a pack saves a draw (two where the LOD casts shadows), but each instance
 * then submits every packed variant's triangles — the unselected ones collapsed to zero area, so
 * they cost vertex work and the W38 triangle budget, never fill. LODs with thousands of instances
 * and big geometry therefore stay in separate draws. Measured on the layout cameras (A / B / D)
 * against one draw per variant: this table saves 51 / 49 / 48 draws for +1.1 M submitted
 * triangles, where packing every LOD would save 66 for +2.3 M (ferns alone +2.1 M). Sets without
 * an entry take the default: all variants in one pack at every LOD.
 *
 * Round 13 trades five of the ~45 spare draws back for triangles, where the hero views sit
 * 150–400 K under the 9 M line: the flowers' mid LOD (56–147 instances of 2 593 packed triangles
 * from B / D) pairs like the near one, and the near weeds (240–300 laminae × 642 packed) and near
 * fiddleheads (110–140 buds × 1 926 packed) go one draw per variant — ≈ 300 / 340 / 385 / 510 K
 * fewer submitted triangles from A / B / C / D, room for this round's foreground clusters.
 */
const SINGLE = (n: number): number[][] => Array.from({ length: n }, (_, v) => [v]);
const ALL = (n: number): number[][] => [Array.from({ length: n }, (_, v) => v)];
const PACKS: Record<string, PackLayout> = {
  // 965 clumps of the biggest geometry: near / mid LODs one draw per variant, far LOD in pairs
  ferns: [SINGLE(4), SINGLE(4), [[0, 1], [2, 3]]],
  // the two heads and the two spikes pair up near and mid, everything shares the far draw
  flowers: [[[0, 1], [2, 3]], [[0, 1], [2, 3]], ALL(4)],
  // 3 000+ laminae: one draw per variant at both LODs (packing the 2 900 far ones would cost 150 K)
  weeds: [SINGLE(3), SINGLE(3)],
  seedheads: [ALL(3), SINGLE(3)],
  // 428–856-triangle coils: per variant near, one draw for the 160+ far buds
  fiddleheads: [SINGLE(3), ALL(3)],
  // 12 hero hedges, all high-LOD from every camera: packing ALL(3) near submitted 3x the placed
  // geometry (300 K vs 97 K triangles); per variant near, +4 draws (Astra, docs/proposals/astra-hedge-packs)
  hedge: [SINGLE(3), ALL(3), ALL(3)],
};

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
    return new LodInstancedSet({ name: label, variants: geos, material, shadowMaterials, lodDistances: lodDistances.map((d) => d * q.distance), castShadowLods, packs: PACKS[label] });
  };

  const ferns = mk('ferns', variants(4, `${seed}/fern`, pal, fernGeometry), 'plant', [11, 26], 1, { sway: 2.6, flutter: 0.012, stiffness: 0.3 });
  // Hero crowns are read at frond scale from 6–8 m in shot D: high LOD out to 16 m. The reference
  // clump is sunlit (0.35 mean, 0.49 p90 in frame 56) while our west verge sits under the
  // north-west-near canopy, where fill alone rendered the fronds at 0.24: the crowns get the same
  // kind of skylight lift the shaded grass bank uses (materials.ts uShadeFill), plus more backlight.
  // Under the round-4 lighting the clump (D 0.03–0.14 × 0.58–0.70) still measures 0.27 against
  // the reference's 0.32 even with this boost and the +30 % fern palette, so the crowns take the
  // west-verge zone lift (materials.ts SHADE_LIFT_ZONE) like the rest of the verge.
  const heroFerns = mk('hero-ferns', variants(3, `${seed}/hero-fern`, pal, heroFernGeometry), 'plant', [16, 32], 1, { sway: 2.0, flutter: 0.014, stiffness: 0.35, transmission: 0.25, ambientBoost: 0.4 });
  const bushes = mk('bushes', variants(3, `${seed}/bush`, pal, bushGeometry), 'bush', [14, 34], 1);
  // hero hedge: same bush variants at shrub scale, but it is read from 15 m in shot A so it keeps
  // the high LOD much further out than the scattered bushes
  const hedge = mk('hedge', variants(3, `${seed}/hedge`, pal, bushGeometry), 'bush', [26, 48], 1, { sway: 0.9, flutter: 0.014, stiffness: 0.7, leafSkyTransmission: 0.65, leafSurfaceDetail: true });
  // matte petals: no specular sheen so the violet stays saturated under the bright sun/haze
  const flowers = mk('flowers', [...variants(2, `${seed}/flower`, pal, flowerGeometry), ...variants(2, `${seed}/flower-spike`, pal, flowerSpikeGeometry)], 'plant', [9, 16], 0, { sway: 2.2, flutter: 0.01, stiffness: 0.4, roughness: 1, ambientBoost: 0.02, transmission: 0.08 });
  // the pale-yellow blooms tucked into the shot-D fern clump: the same cluster-head plant in a
  // straw-yellow palette (reference frame 56: small pale flowers at the base of the fronds)
  const yellowPal = { ...pal, purple: rgb(0xd6c15c), purpleLight: rgb(0xefe094), purpleDeep: rgb(0xa8933a) };
  const yellowFlowers = mk('flowers-yellow', variants(2, `${seed}/flower-yellow`, yellowPal, flowerGeometry), 'plant', [9, 16], 0, { sway: 2.2, flutter: 0.01, stiffness: 0.4, roughness: 1, ambientBoost: 0.02, transmission: 0.08 });
  // white forest flowers (concept sheet 01): matte petals like the violets; the far LOD keeps every
  // bloom as an enlarged four-petal fold so the white dots survive at 12–25 m, and the petals get
  // a little skylight fill so they still read white under the verge canopy (frame 14 s dots ≈ 0.6)
  const whiteFlowers = mk('flowers-white', variants(3, `${seed}/flower-white`, pal, whiteFlowerGeometry, ['high', 'low']), 'plant', [12], 0, { sway: 2.0, flutter: 0.01, stiffness: 0.45, roughness: 1, ambientBoost: 0.36, transmission: 0.06 });
  // the three sheet laminae (heart / ovate / round) with a waxy upper face and a matte underside
  const weeds = mk('weeds', variants(3, `${seed}/weed`, pal, weedGeometry, ['high', 'low']), 'plant', [13], 0, { sway: 1.2, flutter: 0.012, stiffness: 0.55, roughness: 0.9, topRoughness: 0.55 });
  // stout buds barely move in the wind
  const fiddleheads = mk('fiddleheads', variants(3, `${seed}/fiddlehead`, pal, fiddleheadGeometry, ['high', 'low']), 'plant', [14], 0, { sway: 0.9, flutter: 0.003, stiffness: 0.75, transmission: 0.05 });
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
  const cameraXZ = ctx.layout.viewpoints.map((v) => [v.position[0], v.position[2]] as const);
  const nearCamera = (x: number, z: number, r: number) => cameraXZ.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < r);

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
  const fernsBeforeShotD = ferns.count;
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
  /** the boulder ring's fronds: frame 56's cluster, kept when the lawn band is cleared of fern clumps below */
  const shotDRingFerns = new Set(ferns.items.slice(fernsBeforeShotD));
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

  // ---- fiddleheads (concept sheet 01 “Forest buds”, sheet 04): 2–4 spiral buds rise from the
  // centre of every hero crown and from about 30 % of the ordinary fern clumps within 15 m of a
  // camera. Their own stream, seeded after every fern is placed, so the ferns never reshuffle.
  // Each bud keeps the fern's own clearances (stones, the trodden strip, camera C's stair foot).
  {
    const rng = ctx.rng.fork('plants/fiddleheads');
    const s = newSample();
    const budsAt = (cx: number, cz: number, spread: number, scale: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const d = spread * (0.3 + 0.7 * rng());
        const x = cx + Math.cos(a) * d;
        const z = cz + Math.sin(a) * d;
        field.sample(x, z, s);
        if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
        if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6 || field.sightlineC(x, z, 0.3) > 0) continue;
        placeInstance(fiddleheads, x, z, s, rng, scale, 0.5, 0.012, greenVar(rng, 0.12));
      }
    };
    for (const it of heroFerns.items) budsAt(it.x, it.z, 0.16, 1.0 + rng() * 0.1, 2 + rng.int(0, 3));
    for (const it of ferns.items) {
      // the draw comes first so the 30 % pick does not depend on the camera set
      const pick = rng() < 0.3;
      if (!pick || !nearCamera(it.x, it.z, 15)) continue;
      const fernScale = Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
      budsAt(it.x, it.z, 0.1 * fernScale, 0.96 + rng() * 0.14, 2 + rng.int(0, 2));
    }
  }
  // Shot D's hero clump (reference frame 56, 0.05–0.14 × 0.55–0.68): the lit mass left of the
  // mossy rock is five or six TALL unopened bud stalks, 0.6–0.8 m, their yellow-green coils
  // standing above the rock with fronds at their feet. Our boulder projects about twice the
  // reference rock's size (sx 0.05–0.24), so the stalks sit on the bank where their coils clear
  // its left shoulder (root sx 0.01–0.09). The one place the sheet's 0.25–0.45 m bud is outgrown.
  {
    const rng = ctx.rng.fork('plants/fiddleheads-shotD');
    const s = newSample();
    const spots: readonly [number, number][] = [
      [dbx - 1.0, dbz + 0.3],
      [dbx - 1.15, dbz - 0.6],
      [dbx - 1.4, dbz - 1.1],
    ];
    for (const [cx, cz] of spots) {
      const x = cx + (rng() - 0.5) * 0.12;
      const z = cz + (rng() - 0.5) * 0.12;
      field.sample(x, z, s);
      if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.boulderDistance(x, z) < 0.15) continue;
      // lit khaki-yellow like the footage's buds (sunlit above the green fronds, so they separate
      // from the bank behind); stretched sideways so the stalks read as thumb-thick and the coils
      // as fist-sized bulbs
      const scale = 1.95 + rng() * 0.3;
      placeInstance(fiddleheads, x, z, s, rng, scale, 0.3, 0.015, greenVar(rng, 0.1).multiply(TALL_BUD_TINT), scale * 1.7);
    }
  }

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

  // ---- shot-A bank hedge: the dark leafy bushes on the crest of the stair's south bank
  // (terrain S_BANK). Reference frame 1 s: the hedge behind and right of the Kokiri kid, x 0.80–1.0
  // with its top at y ≈ 0.30; frame 8 s: the dark mass on the bank right of the kid (0.6–0.95 ×
  // 0.3–0.5); frame 46 s: dark bushes over the bank behind the stair-foot rock. Crowns are sized
  // so their tops meet camera A's y ≈ 0.30 ray (1.8 m + 0.11 m per metre of depth above the
  // plaza), ≈ 1.7–1.9 m tall. They stay on the crest (off the face and toe), 1.2 m from the kid
  // spots of frames 1 and 8 (placement.ts marches them to ≈ (5.0, 5.3) and (6.2, 3.2)), 0.7 m
  // from the stair-bank rope fence, out of the kokiri-a clearing and the rock ring, and — seen
  // from F — either behind the frame-8 kid or wholly right of his column, so he is never covered.
  // Camera C keeps them beyond the stair-foot rock (depth ≥ 12.2 m): behind it, never over the
  // stair foot at C's left edge.
  const A_BANK_KID: readonly [number, number] = [4.96, 5.29];
  const F_BANK_KID: readonly [number, number] = [6.21, 3.2];
  const bankFence = ROPE_FENCES.find((f) => f.id === 'stair-bank')?.points ?? [];
  const bankFenceDistance = (x: number, z: number) => {
    let best = Infinity;
    for (let i = 0; i < bankFence.length - 1; i++) {
      const [ax, , az] = bankFence[i];
      const [bx, , bz] = bankFence[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
    }
    return best;
  };
  const BANK_CROWN_REACH = 1.1;
  scatter(
    ctx,
    field,
    {
      label: 'hedge-shotA-bank',
      candidates: 1600,
      box: [6.0, 3.9, 8.6, 5.6],
      minSpacing: 0.8,
      accept(x, z, s) {
        if (s.h < 0.55 || s.slope > 0.2 || s.path > 0.02 || s.cliff > 0.3) return 0;
        if (field.edgeDistance(x, z) < 0.6) return 0;
        if (Math.hypot(x - A_BANK_KID[0], z - A_BANK_KID[1]) < 1.2 || Math.hypot(x - F_BANK_KID[0], z - F_BANK_KID[1]) < 1.5) return 0;
        const clr = field.clearing(x, z);
        if (clr.npc > 0 || clr.boulder > 0) return 0;
        if (bankFenceDistance(x, z) < 0.7) return 0;
        const a = field.screenX('A_stairs', x, z);
        if (!a || a.depth < 5.8 || a.sx < 0.84 || a.sx > 1.1) return 0;
        const f = field.screenX('F_canopy', x, z);
        // F's right is +z: the crown's west edge is its left edge in frame 8
        const fEdge = field.screenX('F_canopy', x, z - BANK_CROWN_REACH);
        if (f && fEdge && f.depth < 9.2 && fEdge.sx < 0.62) return 0;
        const c = field.screenX('C_lookback', x, z);
        if (c && c.depth < 12.2) return 0;
        return 0.9;
      },
    },
    (x, z, s, rng) => {
      const depthA = field.screenX('A_stairs', x, z)?.depth ?? 6.5;
      const ground = T.height(x, z);
      const top = clamp(1.8 + 0.11 * depthA - ground, 1.4, 2.1) * (0.92 + rng() * 0.12);
      const variant = rng.int(0, hedge.variantCount);
      const sc = top / hedgeHeight(variant);
      composeMatrix(M, 0, x, ground - 0.05, z, s.nx, s.ny, s.nz, 0.12, rng() * Math.PI * 2, sc * (1.1 + rng() * 0.2), sc, sc * (1.1 + rng() * 0.2));
      // a shade darker than the shot-A hedge: the reference reads these crowns at ≈ 0.22 median
      // luminance in frame 1 (0.9–1.0 × 0.28–0.45) against the lit bank, a soft near-black mass
      hedge.add(M, variant, tint.setRGB(0.42 + rng() * 0.07, 0.48 + rng() * 0.07, 0.39 + rng() * 0.07));
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

  // ---- white forest flowers (concept sheets 01 “Flower clumps”, 02, 04): small five-petal white
  // clusters with yellow centres, 8–15 blooms per 0.3–0.5 m clump, growing in natural clusters
  // along the path edges, near roots and rocks. Placed AFTER the violets by their own streams, so
  // no purple clump moves; each clump keeps ≥ 0.45 m from every violet so the whites never cover
  // them (D's purple fraction is a scored metric). All clumps are ≤ 0.3 m tall, so they may sit
  // near the Kokiri (≥ 1 m) and the ramp lawn, but they are gated off the stones and the trodden strip.
  const whitePlace = (x: number, z: number, s: FieldSample, rng: Rng) =>
    placeInstance(whiteFlowers, x, z, s, rng, 0.8 + rng() * 0.35, 0.6, 0.01, tint.setRGB(0.96 + rng() * 0.08, 0.96 + rng() * 0.08, 0.94 + rng() * 0.08));
  const nearViolet = (x: number, z: number, r: number) => flowers.items.some((it) => Math.hypot(it.x - x, it.z - z) < r);
  const nearKokiri = (x: number, z: number, r: number) => ctx.layout.npcSpots.some((n) => Math.hypot(x - n.position[0], z - n.position[2]) < r);
  // D's bottom-left corner (the near west verge) stays grass and litter, as for the violets —
  // except the rim strip that frame 14 s shows dotted white (`allowRim`, the B-rim cluster below)
  const dNearCorner = (x: number, z: number) => x > -3.1 && x < -1.4 && z > -9.4 && z < -6.3;
  const whiteGround = (x: number, z: number, s: FieldSample, cReach = 0.2, allowRim = false) => {
    if (s.cliff > 0.3 || (!allowRim && dNearCorner(x, z)) || field.bankFace(x, z) > 0.3) return false;
    const clr = field.clearing(x, z);
    if (clr.insideBoulder || field.boulderDistance(x, z) < 0.25 || field.giantDistance(x, z) < 0.3) return false;
    if (nearKokiri(x, z, 1.0) || field.sightlineC(x, z, cReach) > 0 || nearViolet(x, z, 0.45)) return false;
    return true;
  };
  // B / E left lawn edge (frame 14 s: a few white dots at 0–0.4 × 0.6–0.85): the west verge of the
  // spine, 0.3–1.8 m off the flagstones, from the boulder north to the bank
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-west-verge',
      candidates: 3000,
      box: [-4.0, -16.5, -0.8, -5.0],
      minSpacing: 0.8,
      max: 12,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3 || edge > 1.8 || !whiteGround(x, z, s)) return 0;
        return 0.7 * (1 - 0.5 * smoothstep(0.3, 1.8, edge));
      },
    },
    whitePlace,
  );
  // the stepping-stone ramp's outer lawn (frames 14 / 24), off the trodden strip and the spine's verge
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-ramp',
      candidates: 3000,
      box: [1.0, -10.5, 10.5, -1.5],
      minSpacing: 0.9,
      max: 9,
      accept(x, z, s) {
        if (field.troddenZone(x, z) > 0) return 0;
        const ramp = field.rampDistance(x, z);
        if (ramp < 1.3 || ramp > 3.2 || field.lawnEdgeDistance(x, z) < 0.4 || field.houseInfo(x, z).dist < 1.0) return 0;
        return whiteGround(x, z, s) ? 0.7 : 0;
      },
    },
    whitePlace,
  );
  // shot A's right bank near the kid (frame 1: 0.8–1 × 0.3–0.6, the stair's south flank above the
  // kid). With the flight re-laid toward the plaza (aff169d) that box is the flank 11–15 m out at
  // 1–3.3 m of ground, x 10.5–14.5; the old depth-only gate (≥ 11.5 m, x ≥ 10.8) now put the clumps
  // on the plateau ramp at 3–4 m, above the box (A y 0.26–0.34), so each clump is projected in full.
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-east-bank',
      candidates: 3000,
      box: [10.0, -3.0, 15.5, 2.5],
      minSpacing: 0.8,
      max: 8,
      accept(x, z, s) {
        if (s.h > 4.6 || field.edgeDistance(x, z) < 0.45 || !whiteGround(x, z, s)) return 0;
        const a = field.screenPoint('A_stairs', x, T.height(x, z), z);
        return a && a.sx >= 0.81 && a.sx <= 0.99 && a.sy >= 0.32 && a.sy <= 0.58 ? 0.7 : 0;
      },
    },
    whitePlace,
  );
  // sparingly among the shot-D verge ferns, on the bank behind the edge strip
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-d-verge',
      candidates: 2000,
      box: [-5.6, -17.5, -2.4, -9.6],
      minSpacing: 1.1,
      max: 5,
      accept(x, z, s) {
        if (field.edgeDistance(x, z) < 1.6 || !whiteGround(x, z, s)) return 0;
        return 0.6;
      },
    },
    whitePlace,
  );
  // natural clusters elsewhere within 25 m of the cameras: path edges, boulder feet and tree roots
  scatter(
    ctx,
    field,
    {
      label: 'white-flowers-scatter',
      candidates: Math.round(12000 * q.density),
      minSpacing: 1.2,
      max: 14,
      accept(x, z, s) {
        if (!nearCamera(x, z, 25) || !whiteGround(x, z, s, 0.3)) return 0;
        const edge = field.edgeDistance(x, z);
        if (edge < 0.3) return 0;
        const verge = 1 - smoothstep(0.3, 1.5, edge);
        const rock = 1 - smoothstep(0.25, 1.2, field.boulderDistance(x, z));
        const root = 1 - smoothstep(0.3, 2.5, field.giantDistance(x, z));
        return 0.35 * Math.max(verge, rock, root) * (0.4 + field.flowerPatch(x, z)) * (1 - field.lowZone(x, z));
      },
    },
    whitePlace,
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
        // the turf face climbing off the paving beside the shot-A kid is grass only (frame 1)
        if (clr.insideBoulder || field.bankFace(x, z) > 0.3) return 0;
        let p = 0.42 * field.falloff(x, z) * (0.3 + field.flowerPatch(x, z)) * field.cluster(x, z);
        p *= 1 + 1.6 * (1 - smoothstep(0.15, 3, edge));
        p *= 1 - 0.6 * field.giantProximity(x, z);
        p *= 1 - 0.5 * clr.npc;
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(weeds, x, z, s, rng, 0.65 + rng() * 0.65, 0.8, 0.012, greenVar(rng, 0.22)),
  );

  // The west-verge white clumps beyond 11 m sit below B's line of sight over the nearer ferns, so
  // the dots that actually read in frame 14 s (0.06–0.14 × 0.70–0.79, just left of the flagstones)
  // come from this cluster on the spine's west rim 7.5–10 m out, the one pocket of that verge with
  // nothing taller in front of it. Placed after the weeds so the blooms are kept out from under the
  // boulder cluster's big paddle leaves. It is also D's bottom-left grass strip: a few clumps only.
  {
    const weedReach = (it: (typeof weeds.items)[number]) =>
      (weeds.opts.variants[it.variant][0].boundingBox?.max.x ?? 0.16) * Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
    const underLeaves = (x: number, z: number) =>
      weeds.items.some((it) => {
        const r = weedReach(it);
        return r >= 0.25 && Math.hypot(it.x - x, it.z - z) < r;
      });
    scatter(
      ctx,
      field,
      {
        label: 'white-flowers-b-rim',
        candidates: 2500,
        box: [-2.5, -9.4, -1.6, -7.0],
        minSpacing: 0.35,
        max: 4,
        accept(x, z, s) {
          const edge = field.lawnEdgeDistance(x, z);
          if (edge < 0.15 || edge > 0.8 || field.troddenZone(x, z) > 0 || !whiteGround(x, z, s, 0.2, true) || underLeaves(x, z)) return 0;
          const b = field.screenX('B_house', x, z);
          return b && b.sx >= 0.075 && b.sx <= 0.145 && b.depth >= 7.5 && b.depth <= 10.2 ? 0.8 : 0;
        },
      },
      // the top of the clump size range: these are the dots the frame is scored on
      (x, z, s, rng) => placeInstance(whiteFlowers, x, z, s, rng, 1.0 + rng() * 0.15, 0.6, 0.01, tint.setRGB(0.98 + rng() * 0.06, 0.98 + rng() * 0.06, 0.96 + rng() * 0.06)),
    );
  }

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
      low: true,
      accept(x, z, s) {
        const edge = field.edgeDistance(x, z);
        if (edge < 0.1) return 0;
        const clr = field.clearing(x, z);
        if (clr.insideBoulder || field.bankFace(x, z) > 0.3) return 0;
        let p = 0.16 * field.falloff(x, z) * (0.4 + field.cluster(x, z));
        p *= 1 + 1.5 * (1 - smoothstep(0.1, 4, edge));
        p *= 1 + 0.8 * field.giantProximity(x, z, 5);
        return p;
      },
    },
    (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.75 + rng() * 0.6, 0.9, 0.008, greenVar(rng, 0.2)),
  );
  // Clover hugging Saria's stepping stones (frames 14 / 24: a green fringe at each slab's rim where
  // feet never land): 6–9 tufts per stone within 0.25 m of the rim, seated by their own stream.
  {
    const rng = ctx.rng.fork('plants/clover-stones');
    const s = newSample();
    for (const st of houseSteppingStones()) {
      let left = 6 + rng.int(0, 4);
      for (let i = 0; i < 40 && left > 0; i++) {
        const a = rng() * Math.PI * 2;
        const d = st.r + 0.04 + rng() * 0.21;
        const x = st.x + Math.cos(a) * d;
        const z = st.z + Math.sin(a) * d;
        field.sample(x, z, s);
        if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z)) continue;
        if (field.stoneDistance(x, z) < 0.03) continue;
        placeInstance(clover, x, z, s, rng, 0.8 + rng() * 0.45, 0.9, 0.008, greenVar(rng, 0.16));
        left--;
      }
    }
  }

  // ---- moss tufts: boulder bases, tree roots, shaded embankments
  const mossRng = ctx.rng.fork('plants/moss');
  const mossSample = newSample();
  const placeMossWith = (rng: Rng, x: number, z: number, radius: number): boolean => {
    field.sample(x, z, mossSample);
    if (!field.allowed(x, z, mossSample) || field.insideGiantTrunk(x, z)) return false;
    const y = T.height(x, z) - 0.012;
    const h = radius * (0.22 + rng() * 0.2);
    composeMatrix(M, 0, x, y, z, mossSample.nx, mossSample.ny, mossSample.nz, 0.95, rng() * Math.PI * 2, radius, h / 0.45, radius * (0.75 + rng() * 0.5));
    const variant = rng.int(0, 2);
    tint.setRGB(0.9 + rng() * 0.2, 0.92 + rng() * 0.16, 0.9 + rng() * 0.2);
    // drawn first so the stream is the same with or without the cushion: the shot-A turf bank
    // (frame 1) stays grass, the stair-foot rock's moss skirt included
    if (field.bankFace(x, z) > 0.3) return false;
    moss.add(M, variant, tint);
    return true;
  };
  const placeMoss = (x: number, z: number, radius: number) => placeMossWith(mossRng, x, z, radius);
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
      low: true,
      accept(x, z, s) {
        // the slope boost would otherwise pick the shot-A bank face, which stays grass (frame 1)
        if (field.edgeDistance(x, z) < 0.2 || field.bankFace(x, z) > 0.3) return 0;
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
  // Path-edge softening (concept sheet 02 “Moss edges” / “Path boundary”): grass and moss creep
  // over the flagstone rim. Dense short moss cushions in the 0.25 m band just outside the paved
  // edge of the spine, the stair branch and the plaza discs (the house branch is a grassy ramp,
  // no rim), walked along the layout polylines and the mask-derived rim by their own stream and
  // checked against the exact terrain mask so nothing lands on a slab. Adds ≈ 20 % to the moss
  // count. The blades leaning over the stones and the dirt-seam litter live in grass.ts /
  // litter.ts. Where the paving meets the foot of the shot-A turf bank (frame 1: grass tufts
  // overhang the slabs, no dark cushion line) the band stays grass.
  {
    const rng = ctx.rng.fork('plants/moss-path-edge');
    field.rimCandidates(rng, RIM_MOSS_CANDIDATES_PER_M * q.density, RIM_BAND, (x, z) => {
      const p = 0.55 * (0.4 + 0.6 * field.cluster(x, z)) * field.falloff(x, z);
      if (rng() > p || field.bankFace(x, z) > 0.3) return;
      placeMossWith(rng, x, z, 0.05 + rng() * 0.09);
    });
  }

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

  // ======== Round 13: foreground framing and ground detail (owner boards 01 / 02 / 06 / 08,
  // frames 1 s / 14 s / 46 s / 56 s). Everything below runs after the scatters above from its own
  // streams, so no earlier plant moves; each cluster is seated where the reference's screen box
  // unprojects onto OUR ground, through `field.screenPoint`, and keeps every standing rule (the
  // paving, the shot-A bank face, the kids' spots, camera C's stair-foot wedge, the stones).
  {
    const kidSpots: readonly (readonly [number, number])[] = [...ctx.layout.npcSpots.map((n) => [n.position[0], n.position[2]] as const), A_BANK_KID, F_BANK_KID];
    const nearKid = (x: number, z: number, r: number) => kidSpots.some(([kx, kz]) => Math.hypot(x - kx, z - kz) < r);
    const nearWhite = (x: number, z: number, r: number) => whiteFlowers.items.some((it) => Math.hypot(it.x - x, it.z - z) < r);
    /** the plant's root, seated on the ground, projects inside the viewpoint's box [x0, y0, x1, y1] */
    const inFrame = (viewpointId: string, x: number, z: number, box: readonly [number, number, number, number], minDepth = 0) => {
      const p = field.screenPoint(viewpointId, x, T.height(x, z), z);
      return !!p && p.depth >= minDepth && p.sx >= box[0] && p.sx <= box[2] && p.sy >= box[1] && p.sy <= box[3];
    };
    /** ground every plant of this round needs: off the stones and the trodden strip, off the bank face, clear of the kids and the rock rings */
    const clearGround = (x: number, z: number, s: FieldSample) => {
      if (s.cliff > 0.3 || field.bankFace(x, z) > 0.3 || field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6) return false;
      const clr = field.clearing(x, z);
      if (clr.insideBoulder || clr.npc > 0 || field.boulderDistance(x, z) < 0.3 || field.giantDistance(x, z) < 0.3) return false;
      return !nearKid(x, z, 1.2);
    };
    /** clear ground that also keeps a plant of this `reach` out of camera C's stair-foot wedge and the grass around the camera */
    const standingGround = (x: number, z: number, s: FieldSample, reach: number) => clearGround(x, z, s) && field.sightlineC(x, z, reach) === 0;
    /** `per` plants within `radius` of each centre from one stream; `ok` gates each spot, `place` seats it */
    const clusterAt = (label: string, centres: readonly (readonly [number, number])[], per: number, radius: number, ok: (x: number, z: number, s: FieldSample) => boolean, place: (x: number, z: number, s: FieldSample, rng: Rng) => void) => {
      const rng = ctx.rng.fork(`plants/${label}`);
      const s = newSample();
      for (const [cx, cz] of centres) {
        let left = per;
        for (let i = 0; i < per * 5 && left > 0; i++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * radius;
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder || !ok(x, z, s)) continue;
          place(x, z, s, rng);
          left--;
        }
      }
    };
    // board 06 "small plants, flowers, rocks and leaves": heart / ovate laminae 15–30 cm across
    // (variant spans × 1.3–2.2), ≤ 0.33 m tall so they pass under every "grass only" height rule
    const broadleafPlace = (scaleMin: number, scaleMax: number, dark = 0.9) => (x: number, z: number, s: FieldSample, rng: Rng) => placeInstance(weeds, x, z, s, rng, scaleMin + rng() * (scaleMax - scaleMin), 0.8, 0.012, greenVar(rng, 0.18).multiplyScalar(dark));
    const broadleafGround = (x: number, z: number, s: FieldSample) => clearGround(x, z, s) && field.lawnEdgeDistance(x, z) >= 0.2 && !nearWhite(x, z, 0.45);
    const newFerns: { x: number; z: number; scale: number }[] = [];

    // ---- (2) frame 14 s' lawn band (field.ts LAWN_BAND): the fern clumps the general scatter
    // grew on the near west verge come out — the band is short turf with white dots in the
    // footage, and the clumps stood between camera B and the far dots. Pruned after the fiddlehead
    // pass so the buds elsewhere keep their stream; the buds that stood in the removed clumps go
    // with them. The shot-D boulder ring keeps its fronds (frame 56's cluster beside the rock).
    {
      const removed: { x: number; z: number }[] = [];
      ferns.prune((it) => {
        if (shotDRingFerns.has(it) || field.lawnBand(it.x, it.z) <= 0.5) return false;
        removed.push({ x: it.x, z: it.z });
        return true;
      });
      const crownLeft = (x: number, z: number) => ferns.items.concat(heroFerns.items).some((f) => Math.hypot(f.x - x, f.z - z) <= 0.2);
      fiddleheads.prune((b) => removed.some((f) => Math.hypot(f.x - b.x, f.z - b.z) <= 0.25) && !crownLeft(b.x, b.z));
    }

    // ---- (1) / (3) the west verge bed: frame 1 s' left edge (A 0–0.12 × 0.45–0.58 is the verge
    // 14–20 m out; its 0.6–0.75 is the plaza's paving) and frame 56's bottom-left cluster (D 0–0.2
    // × 0.6–0.72 beyond the near grass strip) are the same ground: the verge and bank slope from the
    // shot-D boulder north to the mist hollow, x −4.8…−2.3, z −11.2…−16.5, where the six D clumps
    // already grow. It gets a fern cluster (0.6–0.9 m), three more purple clumps and broad-leaf
    // clusters. The near strip south of the boulder (D's bottom-left corner) stays grass — it is
    // frame 14 s' lawn band.
    const WEST_BED: [number, number, number, number] = [-4.8, -16.5, -2.3, -11.2];
    const D_BED_BOX: [number, number, number, number] = [-0.02, 0.56, 0.22, 0.74];
    scatter(
      ctx,
      field,
      {
        label: 'ferns-west-bed',
        candidates: 1500,
        box: WEST_BED,
        minSpacing: 0.7,
        max: 6,
        accept: (x, z, s) => (field.edgeDistance(x, z) >= 0.5 && standingGround(x, z, s, 1.0) && !nearWhite(x, z, 0.6) && inFrame('D_log', x, z, D_BED_BOX) ? 0.7 : 0),
      },
      (x, z, s, rng) => {
        const scale = 0.95 + rng() * 0.35;
        newFerns.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.2));
      },
    );
    clusterAt(
      'flowers-west-bed',
      [
        [-2.75, -11.75],
        [-3.55, -12.55],
        [-2.7, -14.35],
      ],
      9,
      0.45,
      (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && inFrame('D_log', x, z, D_BED_BOX),
      flowerPlace(1.05, 1.4),
    );
    clusterAt(
      'weeds-west-bed',
      [
        [-2.6, -12.4],
        [-3.3, -14.1],
        [-3.0, -15.6],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('D_log', x, z, [-0.02, 0.55, 0.24, 0.76]),
      broadleafPlace(1.7, 2.4, 0.85),
    );

    // ---- (1) frame 1 s' right bank behind the kid (A 0.8–1.0 × 0.45–0.75): ferns and a hedge, not
    // grass. The hedge crowns are there (hedge-shotA-bank); the crest between them and the kid takes
    // 0.5–0.75 m fern clumps and a skirt of broad leaves, on the flat crest only (the bank FACE stays
    // grass, frame 1's lit tufts), ≥ 1.2 m from both kid spots, 0.4 m off the stair-bank rope
    // fence, beyond the stair-foot rock from camera C (depth ≥ 12.1 m) and never over the frame-8
    // kid from F (the hedge's rule).
    const A_BANK_BOX: [number, number, number, number] = [0.8, 0.45, 1.02, 0.74];
    const bankCrest = (x: number, z: number, s: FieldSample, reach: number) => {
      if (s.slope > 0.18 || s.path > 0.02 || s.cliff > 0.3 || field.edgeDistance(x, z) < 0.5 || field.bankFace(x, z) > 0.3) return false;
      if (nearKid(x, z, 1.2) || field.clearing(x, z).npc > 0 || field.boulderDistance(x, z) < 0.3 || bankFenceDistance(x, z) < 0.4) return false;
      if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6) return false;
      const c = field.screenX('C_lookback', x, z);
      if (c && c.depth < 12.1) return false;
      if (field.sightlineC(x, z, reach) > 0) return false;
      const f = field.screenX('F_canopy', x, z);
      const fEdge = field.screenX('F_canopy', x, z - reach);
      if (f && fEdge && f.depth < 9.2 && fEdge.sx < 0.62) return false;
      return true;
    };
    scatter(
      ctx,
      field,
      {
        label: 'ferns-a-bank',
        candidates: 2000,
        box: [6.0, 3.5, 8.8, 5.6],
        minSpacing: 0.6,
        max: 8,
        accept: (x, z, s) => (bankCrest(x, z, s, 0.75) && !nearWhite(x, z, 0.5) && inFrame('A_stairs', x, z, A_BANK_BOX, 5.5) ? 0.7 : 0),
      },
      (x, z, s, rng) => {
        const scale = 0.8 + rng() * 0.3;
        newFerns.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.18).multiplyScalar(0.94));
      },
    );
    scatter(
      ctx,
      field,
      {
        label: 'weeds-a-bank',
        candidates: 2500,
        box: [6.0, 3.2, 9.0, 5.6],
        minSpacing: 0.3,
        max: 16,
        accept: (x, z, s) => (bankCrest(x, z, s, 0.4) && s.slope <= 0.12 && !nearWhite(x, z, 0.4) && inFrame('A_stairs', x, z, [0.78, 0.5, 1.02, 0.8], 5.0) ? 0.8 : 0),
      },
      broadleafPlace(1.6, 2.2, 0.85),
    );

    // ---- (2) frame 14 s' right foreground (B 0.85–1.0 × 0.55–0.9): a dark leafy mass of fronds,
    // coils and purple bells. Its lower half is camera C's left third at 4–6 m and Saria's ramp
    // (grass only, frame 46), so the mass thickens on the stair-flank bank 8–10 m out, x 8–9.6,
    // z −6.2…−3.4, around the door-side hedge: 0.55–0.8 m fern clumps with buds, purple clumps
    // and broad-leaf skirts, none of it inside C's wedge.
    const B_MASS_BOX: [number, number, number, number] = [0.85, 0.52, 1.0, 0.82];
    scatter(
      ctx,
      field,
      {
        label: 'ferns-shotB-near',
        candidates: 2000,
        box: [8.0, -6.2, 9.6, -3.4],
        minSpacing: 0.55,
        max: 8,
        accept: (x, z, s) => (field.edgeDistance(x, z) >= 0.3 && standingGround(x, z, s, 1.0) && field.houseInfo(x, z).dist >= 0.5 && !nearWhite(x, z, 0.5) && inFrame('B_house', x, z, B_MASS_BOX) ? 0.7 : 0),
      },
      (x, z, s, rng) => {
        const scale = 0.9 + rng() * 0.3;
        newFerns.push({ x, z, scale });
        placeInstance(ferns, x, z, s, rng, scale, 0.7, 0.02, greenVar(rng, 0.2));
      },
    );
    clusterAt(
      'flowers-shotB-near',
      [
        [8.6, -4.4],
        [8.3, -5.6],
        [9.1, -3.9],
      ],
      8,
      0.4,
      (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && !nearKid(x, z, 1.2) && inFrame('B_house', x, z, B_MASS_BOX),
      flowerPlace(1.05, 1.35),
    );
    clusterAt(
      'weeds-shotB-near',
      [
        [8.3, -4.0],
        [8.9, -5.9],
        [8.2, -5.0],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('B_house', x, z, [0.84, 0.52, 1.0, 0.86]),
      broadleafPlace(1.7, 2.4, 0.85),
    );

    // fiddleheads for this round's fern clumps (sheet 01: 2–3 buds in a share of the near crowns),
    // their own stream after every clump above is seated
    {
      const rng = ctx.rng.fork('plants/fiddleheads-r13');
      const s = newSample();
      for (const f of newFerns) {
        if (rng() > 0.6) continue;
        const count = 2 + rng.int(0, 2);
        for (let i = 0; i < count; i++) {
          const a = rng() * Math.PI * 2;
          const d = 0.1 * f.scale * (0.3 + 0.7 * rng());
          const x = f.x + Math.cos(a) * d;
          const z = f.z + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || field.clearing(x, z).insideBoulder) continue;
          if (field.stoneDistance(x, z) < STONE_CLEARANCE || field.troddenZone(x, z) > 0.6 || field.sightlineC(x, z, 0.3) > 0) continue;
          placeInstance(fiddleheads, x, z, s, rng, 0.96 + rng() * 0.14, 0.5, 0.012, greenVar(rng, 0.12));
        }
      }
    }

    // ---- (3) frame 56's right verge (D 0.75–1.0 × 0.55–0.85: the slope right of the north path,
    // x 4–8, z −8…−14) — purple and leaf clusters among the short grass. The strip is camera C's
    // grass box, so the violets are the low cluster heads (≤ 0.54 m, the D-right rule) where the
    // wedge allows them (north of z −12.3 or east of x 7.6) and the leaves stay ≤ 0.33 m.
    const D_RIGHT_BOX: [number, number, number, number] = [0.74, 0.52, 1.02, 0.86];
    clusterAt(
      'flowers-shotD-right',
      [
        [5.6, -12.9],
        [6.7, -13.6],
        [6.3, -14.4],
      ],
      8,
      0.4,
      (x, z) => flowerVerge(x, z) > 0 && !nearWhite(x, z, 0.5) && !nearKid(x, z, 1.2) && inFrame('D_log', x, z, D_RIGHT_BOX),
      flowerPlace(0.95, 1.2, CLUSTER_HEADS),
    );
    clusterAt(
      'weeds-shotD-right',
      [
        [3.6, -7.7],
        [4.6, -9.4],
        [5.4, -11.0],
        [7.2, -12.2],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('D_log', x, z, D_RIGHT_BOX),
      broadleafPlace(1.5, 2.1),
    );
    // ---- (4) frame 46's foreground (C 0–0.3 × 0.8–1.0: the grass 3–5 m in front of camera C) —
    // heart-leaf clusters in the turf, 0.33 m at most so the stair foot stays visible over them
    clusterAt(
      'weeds-shotC-foot',
      [
        [4.3, -4.4],
        [5.5, -4.0],
        [6.2, -4.8],
        [4.9, -5.2],
      ],
      8,
      0.45,
      (x, z, s) => broadleafGround(x, z, s) && inFrame('C_lookback', x, z, [-0.02, 0.78, 0.32, 1.02]),
      // 4-6 m from camera C: at 1.5-2.1 the cluster filled C's bottom-left to green 0.74 vs the
      // frame's 0.45; 1.1-1.5 keeps it a foreground accent
      broadleafPlace(1.1, 1.5),
    );

    // ---- (5) broad-leaf clusters along every path edge within reach of the cameras (board 06):
    // 5–12 leaves per cluster 0.3–1.3 m outside the paving, ≤ 0.32 m tall, off the bank face, the
    // kids' spots, the boulder rings, the stones and the near west verge (frame 14 s' lawn band),
    // never over a white clump. One stream draws the cluster centres and their leaves.
    {
      const rng = ctx.rng.fork('plants/weeds-rim-clusters');
      const s = newSample();
      const spacing = new Spacing(2.4);
      const R = ctx.config.detailRadius;
      const place = broadleafPlace(1.3, 2.1);
      let clusters = 0;
      for (let i = 0; i < 6000 && clusters < 44; i++) {
        const cx = -R + rng() * 2 * R;
        const cz = -R + rng() * 2 * R;
        if (!nearCamera(cx, cz, 22)) continue;
        const edge = field.lawnEdgeDistance(cx, cz);
        if (edge < 0.3 || edge > 1.3) continue;
        field.sample(cx, cz, s);
        if (!field.allowed(cx, cz, s) || field.insideGiantTrunk(cx, cz) || !broadleafGround(cx, cz, s) || field.lawnBand(cx, cz) > 0) continue;
        if (!spacing.ok(cx, cz, 2.4)) continue;
        spacing.add(cx, cz);
        clusters++;
        let left = 5 + rng.int(0, 8);
        for (let k = 0; k < 40 && left > 0; k++) {
          const a = rng() * Math.PI * 2;
          const d = Math.sqrt(rng()) * 0.5;
          const x = cx + Math.cos(a) * d;
          const z = cz + Math.sin(a) * d;
          field.sample(x, z, s);
          if (!field.allowed(x, z, s) || field.insideGiantTrunk(x, z) || !broadleafGround(x, z, s) || field.lawnBand(x, z) > 0) continue;
          place(x, z, s, rng);
          left--;
        }
      }
    }

    // ---- (2) the lawn band itself: dense short turf is grass.ts' second pass; here the white dots
    // frame 14 s has (0–0.3 × 0.62–0.9, ≈ 12–20 of them — the paving's lawn pocket is hardscape's,
    // so ours sit on the verge north of it, 7.5–13.5 m from camera B), clover between them and a
    // few moss cushions for the footage's mossy stones. The character system stands frame 14 s'
    // kid at B (0.035, 0.885), 4.6 m out, so he covers sx 0–0.07 up to y ≈ 0.58: the dots keep to
    // the strip beside the paving that shows past him (sx ≥ 0.075). Placed after every violet and
    // leaf above, so they cover none and sit under none.
    const underLeaves = (x: number, z: number) =>
      weeds.items.some((it) => {
        const r = (weeds.opts.variants[it.variant][0].boundingBox?.max.x ?? 0.16) * Math.hypot(it.matrix[0], it.matrix[1], it.matrix[2]);
        return r >= 0.25 && Math.hypot(it.x - x, it.z - z) < r;
      });
    scatter(
      ctx,
      field,
      {
        label: 'white-flowers-lawn-band',
        candidates: 5000,
        box: field.lawnBandBox(),
        minSpacing: 0.35,
        max: 12,
        accept(x, z, s) {
          const edge = field.lawnEdgeDistance(x, z);
          if (edge < 0.2 || edge > 1.5 || field.troddenZone(x, z) > 0 || !whiteGround(x, z, s, 0.2, true) || underLeaves(x, z)) return 0;
          const b = field.screenPoint('B_house', x, T.height(x, z), z);
          return b && b.depth <= 13.5 && b.sx >= 0.075 && b.sx <= 0.24 && b.sy >= 0.6 && b.sy <= 0.86 ? 0.8 : 0;
        },
      },
      (x, z, s, rng) => placeInstance(whiteFlowers, x, z, s, rng, 1.0 + rng() * 0.15, 0.6, 0.01, tint.setRGB(0.98 + rng() * 0.06, 0.98 + rng() * 0.06, 0.96 + rng() * 0.06)),
    );
    scatter(
      ctx,
      field,
      {
        label: 'clover-lawn-band',
        candidates: 1500,
        box: field.lawnBandBox(),
        minSpacing: 0.2,
        low: true,
        max: 90,
        accept: (x, z) => (field.lawnEdgeDistance(x, z) >= 0.1 && field.bankFace(x, z) <= 0.3 ? 0.9 * field.lawnBand(x, z) : 0),
      },
      (x, z, s, rng) => placeInstance(clover, x, z, s, rng, 0.8 + rng() * 0.5, 0.9, 0.008, greenVar(rng, 0.18)),
    );
    {
      const rng = ctx.rng.fork('plants/moss-lawn-band');
      const spots: readonly [number, number][] = [
        [-2.55, -7.35],
        [-3.05, -8.7],
        [-2.3, -9.85],
      ];
      for (const [cx, cz] of spots) {
        for (let i = 0; i < 24; i++) {
          const x = cx + (rng() - 0.5) * 0.7;
          const z = cz + (rng() - 0.5) * 0.7;
          if (field.lawnEdgeDistance(x, z) < 0.35 || field.stoneDistance(x, z) < 0.3 || nearWhite(x, z, 0.45) || nearKid(x, z, 1.0)) continue;
          if (placeMossWith(rng, x, z, 0.28 + rng() * 0.1)) break;
        }
      }
    }

    // ---- (4) frame 46's white clumps on the bank beside the stair foot (C 0.12–0.32 × 0.4–0.58,
    // beyond the stair-foot rock): a few on the south bank's crest, clear of the kids
    scatter(
      ctx,
      field,
      {
        label: 'white-flowers-stair-bank',
        candidates: 3000,
        box: [7.2, 3.2, 10.0, 5.2],
        minSpacing: 0.6,
        max: 3,
        accept: (x, z, s) => (s.slope <= 0.2 && s.path <= 0.02 && whiteGround(x, z, s, 0.2) && !nearKid(x, z, 1.0) && bankFenceDistance(x, z) >= 0.3 && inFrame('C_lookback', x, z, [0.12, 0.4, 0.32, 0.58], 12.2) ? 0.8 : 0),
      },
      whitePlace,
    );
  }

  const all = [ferns, heroFerns, fiddleheads, bushes, hedge, flowers, yellowFlowers, whiteFlowers, weeds, seedheads, clover, moss, saplings];
  for (const set of all) parent.add(set.build());
  return { ferns, heroFerns, fiddleheads, bushes, hedge, flowers, yellowFlowers, whiteFlowers, weeds, seedheads, clover, moss, saplings, all, materials };
}

export { clamp };
