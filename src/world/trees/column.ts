/**
 * Column trees — the dark mid-distance trunks of the forest wall (12–45 m from the hero cameras).
 *
 * The reference frames read their far wall as a few bold dark boles standing in bright haze:
 * ≈ 1–1.4 m thick, bare from the ground to 10–12 m, crowns only above that. The white-bark species
 * cannot give that (its pale bole matches the haze's luminance and its crown starts at 5–9 m), so
 * this family is a tall straight tree with a dark, lightly gnarled bole, buttress roots, and a
 * lobed laminae crown lifted onto the top 40 %: from 20–40 m the bole is a dark column with light
 * between it and the next, the crown a broken silhouette at the frame's top edge. Same writer
 * primitives and LOD scheme as the white-barks (three detail levels, one InstancedMesh per
 * variant/LOD); the bark is the giants' (materials.giantTree), so the trunks match the giant boles
 * the same frames show at 9–15 m. Geometry-only: metres, +Y up, base at y = 0.
 */
import { BufferGeometry, Color, Vector3 } from 'three';
import { createRng, type Rng } from '../util/prng';
import { Noise2D, smoothstep } from '../util/noise';
import { GeometryWriter, TAU, UP, addLeaf, between, divergingLeaderPath, frame, growthPath, mergeParts, rootButtress, sample, stiffnessFor, tangent, taper, tube, type Detail } from './writer';
import type { Palette, TreeAsset } from './whitebark';

export interface ColumnParams {
  seed: string;
  height: number;
  /** bole radius at the ground (before the root flare) */
  trunkRadius: number;
  leanDeg: number;
  leanAzimuth: number;
  /** height fraction where the bole forks into the crown leaders (the crown starts here) */
  fork: number;
  leaders: number;
  boughs: number;
  /** fraction of the bole (0 = ground, 1 = fork) where the lowest bough leaves it */
  boughStart: number;
  /** crown radius as a fraction of height */
  crownWidth: number;
  leafSize: [number, number];
  leafDensity: number;
  roots: number;
  /** buttress root reach as a multiple of the trunk radius (min, max) */
  rootReach: [number, number];
  /** extra bole radius at the ground (fraction of the trunk radius), gone by ≈ 3 m up */
  flare: number;
  /** metres of bark texture per tile around the bole */
  barkTile: number;
  /** amplitude of the bole's gnarl (radius displacement, fraction) — also its crevice shading */
  gnarl: number;
}

/** Deterministic architecture for variant `index` of `total`. */
export function columnParams(rng: Rng, index: number, total: number): ColumnParams {
  const r = rng.fork(`variant-${index}`);
  // the taller variants are also the girthier ones (old trees), spread evenly over the set
  const f = total > 1 ? index / (total - 1) : 0.5;
  return {
    seed: `col-${index}-${r.int(0, 1e9)}`,
    height: 17.5 + f * 5 + r.range(-0.6, 0.6),
    trunkRadius: 0.5 + f * 0.2 + r.range(-0.03, 0.03),
    leanDeg: r.range(1, 4),
    leanAzimuth: r.range(0, TAU),
    fork: r.range(0.54, 0.62),
    leaders: r.int(2, 4),
    boughs: r.int(4, 6),
    boughStart: 0.72,
    crownWidth: r.range(0.2, 0.27),
    leafSize: [0.24, 0.36],
    leafDensity: r.range(0.9, 1.1),
    roots: r.int(5, 8),
    rootReach: [2.4, 3.8],
    flare: 0.55,
    barkTile: 1.6,
    gnarl: 0.1,
  };
}

/**
 * The emergent: one very tall column (≈ 28 m) with a straight bole bare to ≈ 18 m and a narrow, thin
 * crown on the top third. It is the near dark trunk of a hero frame's edge (reference B's left
 * 13 %: a 1.5 m bole from the ground out of the frame's top), so the crown is never in a frame;
 * what matters is where its shadow lands — from a seat beside the plaza, foliage 18–28 m up throws
 * its shade ≥ 14 m east-south-east of the bole, past the plaza and the stair bank the sun
 * corridors keep lit (index.ts), and only the bole's thin shadow crosses them. Short roots and a
 * slight flare keep it off a path edge it may stand next to; the same bole stands 4.4 m from
 * camera D, so its bark is tiled finer and gnarled deeper than the far columns' (which the haze
 * would flatten anyway) to keep that frame's texture where it hides the verge ferns.
 */
export function emergentParams(rng: Rng): ColumnParams {
  const r = rng.fork('emergent');
  return {
    seed: `col-emergent-${r.int(0, 1e9)}`,
    height: 28 + r.range(-0.4, 0.4),
    trunkRadius: 0.62 + r.range(-0.02, 0.02),
    leanDeg: r.range(0.5, 2),
    leanAzimuth: r.range(0, TAU),
    fork: r.range(0.66, 0.7),
    leaders: 3,
    boughs: 4,
    boughStart: 0.88,
    crownWidth: r.range(0.14, 0.16),
    leafSize: [0.24, 0.36],
    leafDensity: 0.75,
    roots: 7,
    rootReach: [1.4, 1.9],
    flare: 0.3,
    barkTile: 1.0,
    gnarl: 0.14,
  };
}

/** `groundAt` samples terrain in this particular seat's local coordinates; only roots use it. */
export function createColumnTree(p: ColumnParams, palette: Palette, detail: Detail, groundAt: (x: number, z: number) => number = () => 0): TreeAsset {
  const rng = createRng(`column/${p.seed}`);
  const bt = (a: number, b: number) => between(rng, a, b);
  const gnarl = new Noise2D(`column-bark/${p.seed}`);
  const wood = new GeometryWriter(detail);
  const leaves = new GeometryWriter(detail);
  const H = p.height;
  const R = p.trunkRadius;
  // well below the giants' bark tones (giant.ts, 0.70/0.64/0.56): at 20–35 m the haze mixes ≈ 55–65 %
  // of its own brightness into whatever stands there, so only a bole this dark still reads as a
  // dark column against it (the reference's far trunks sit 0.03–0.07 under the haze between them,
  // its near ones at 0.30–0.33); never the pale white-bark species beside them
  const barkBase = new Color(0.44, 0.39, 0.33);
  const barkDeep = new Color(0.19, 0.155, 0.125);
  const canopy = new Color(palette.leafCanopy);
  const sunny = new Color(palette.leafSun);
  const barkColor = (pt: Vector3) => {
    const soil = 1 - smoothstep(-0.5, 3, pt.y);
    return barkBase.clone().lerp(barkDeep, 0.45 * soil).multiplyScalar(0.92 + 0.1 * smoothstep(3, 14, pt.y));
  };
  const gnarlBump = (angle: number, distance: number) => {
    const cx = Math.cos(angle) * 1.6;
    const cz = Math.sin(angle) * 1.6;
    const low = gnarl.fbm(cx + distance * 0.11, cz + distance * 0.09, 3);
    const flute = Math.sin(angle * 6 + distance * 0.1) * 0.3;
    return 1 + p.gnarl * (low * 0.9 + flute * 0.4);
  };
  const stiff = () => 1;

  // ---------- bole ----------
  const crownRadius = H * p.crownWidth;
  const forkY = H * p.fork;
  const lean = Math.tan((p.leanDeg * Math.PI) / 180) * forkY;
  const top = new Vector3(Math.cos(p.leanAzimuth) * lean, forkY, Math.sin(p.leanAzimuth) * lean);
  const skirt = 0.8;
  const trunk = growthPath(new Vector3(0, -skirt, 0), top, UP, rng, 22, 0.14);
  const forkRadius = R * 0.42;
  const trunkRadii = trunk.map((pt, i) => {
    const t = i / (trunk.length - 1);
    const above = Math.max(0, pt.y) / H;
    const radius = forkRadius + (R - forkRadius) * Math.pow(1 - t, 0.85);
    return radius * (1 + p.flare * Math.exp(-above * 9));
  });
  tube(wood, trunk, trunkRadii, 16, rng, {
    color: barkColor,
    roughness: 0.05,
    bump: gnarlBump,
    // crevice shading scaled with the gnarl so a deeper gnarl also reads darker in its folds
    creviceShade: 1.8 * (p.gnarl / 0.1),
    barkTile: p.barkTile,
    flatBase: true,
    isTrunk: true,
    structural: true,
    stiffness: stiff,
  });

  // ---------- buttress roots ----------
  const rootColor = barkBase.clone().lerp(barkDeep, 0.5);
  for (let i = 0; i < p.roots; i++) {
    rootButtress(wood, (i / p.roots) * TAU + bt(-0.25, 0.25), R * bt(p.rootReach[0], p.rootReach[1]), R * bt(0.42, 0.6), R * bt(0.9, 1.3), rootColor, rng, groundAt);
  }

  // ---------- crown ----------
  const leafOpts = (radius: number) => ({
    widthRatio: 0.62,
    wideFirst: 0.72,
    wideSecond: 0.8,
    stiffness: stiffnessFor(radius),
    flutter: 0.03,
    // seen from 20–45 m: stylised laminae, medium triangles; distance LODs keep every 3rd / 6th
    detailOverride: 'medium' as Detail,
    mediumEvery: 3,
    lowEvery: 6,
    mediumScale: 1.7,
    lowScale: 2.4,
    tipColor: new Color('#8a9a4c'),
  });
  /**
   * A leaf lobe on a bough end: a few twigs fan from the bough into an ellipsoid and each carries
   * a spray of laminae, denser toward the shell so the lobe is a broken mass with a dark heart.
   */
  const lobe = (bough: Vector3[], boughRadius: number, center: Vector3, hR: number, vR: number, vigor: number) => {
    const twigs = 7;
    const count = Math.max(2, Math.round(56 * p.leafDensity));
    const phase = rng() * TAU;
    for (let k = 0; k < twigs; k++) {
      const attach = 0.55 + (k / twigs) * 0.45 + bt(-0.03, 0.03);
      const origin = sample(bough, Math.min(1, attach));
      const a = phase + k * 2.39996 + bt(-0.4, 0.4);
      const elevation = bt(-0.5, 0.75);
      const reach = hR * Math.sqrt(1 - elevation * elevation) * bt(0.55, 0.95);
      const target = center.clone().add(new Vector3(Math.cos(a) * reach, elevation * vR, Math.sin(a) * reach));
      const twig = growthPath(origin, target, tangent(bough, Math.min(1, attach)), rng, 5, 0.8);
      const twigRadius = Math.max(0.012, boughRadius * 0.35);
      tube(wood, twig, taper(twig, twigRadius, 0.004), 4, rng, { color: barkDeep, roughness: 0.02 });
      const opts = leafOpts(twigRadius);
      for (let j = 0; j < count; j++) {
        const t = 0.25 + (0.75 * (j + bt(0.1, 0.9))) / count;
        const base = sample(twig, t);
        const axis = tangent(twig, t);
        const [u, v] = frame(axis);
        const angle = phase + j * 2.399963229728653 + bt(-0.3, 0.3);
        const outward = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
        const direction = axis.clone().multiplyScalar(bt(0.3, 0.7)).addScaledVector(outward, 1).addScaledVector(UP, bt(-0.25, 0.35)).normalize();
        const heightF = smoothstep(0, 1, (base.y - center.y) / Math.max(0.5, vR) * 0.5 + 0.5);
        const shell = smoothstep(0.3, 1, base.distanceTo(center) / Math.max(0.5, hR));
        const sun = Math.min(1, heightF * 0.6 + shell * 0.5) * bt(0.3, 1);
        const color = canopy.clone().lerp(sunny, sun).multiplyScalar(vigor * (0.7 + 0.3 * shell));
        addLeaf(leaves, base, direction, bt(p.leafSize[0], p.leafSize[1]), color, rng, opts);
      }
    }
  };

  // leaders: the fork divides into a few rising stems that carry the highest lobes
  const forkTangent = tangent(trunk, 1);
  for (let i = 0; i < p.leaders; i++) {
    const angle = p.leanAzimuth + (i / p.leaders) * TAU + bt(-0.5, 0.5);
    const reach = crownRadius * bt(0.35, 0.7);
    const target = new Vector3(top.x + Math.cos(angle) * reach, H * bt(0.9, 1.0), top.z + Math.sin(angle) * reach);
    const path = divergingLeaderPath(top, target, rng, 12);
    const radius = forkRadius * bt(0.55, 0.75);
    tube(wood, path, taper(path, radius, 0.03, 1.05), 8, rng, { color: barkColor, roughness: 0.04, barkTile: 1.4, structural: true, stiffness: stiff });
    const center = target.clone().add(new Vector3(bt(-0.3, 0.3), -H * bt(0.03, 0.06), bt(-0.3, 0.3)));
    lobe(path, radius, center, crownRadius * bt(0.32, 0.42), H * bt(0.07, 0.1), bt(0.9, 1.05));
  }
  // boughs: leave the bole between `boughStart` and just under the fork, reach out to the crown's rim
  for (let j = 0; j < p.boughs; j++) {
    const t = p.boughStart + (j / Math.max(1, p.boughs - 1)) * (0.99 - p.boughStart) + bt(-0.02, 0.02);
    const origin = sample(trunk, Math.min(1, t));
    const angle = p.leanAzimuth + 1.1 + j * 2.13 + bt(-0.5, 0.5);
    const radial = crownRadius * bt(0.62, 0.9);
    const lobeY = origin.y + H * bt(0.06, 0.14);
    const center = new Vector3(Math.cos(angle) * radial, lobeY, Math.sin(angle) * radial);
    const end = center.clone().add(new Vector3(bt(-0.3, 0.3), bt(-0.4, 0.0), bt(-0.3, 0.3)));
    const bough = growthPath(origin, end, forkTangent.clone().lerp(new Vector3(Math.cos(angle), 0.35, Math.sin(angle)), 0.7), rng, 10, 0.6);
    const radius = Math.max(0.05, forkRadius * bt(0.4, 0.6));
    tube(wood, bough, taper(bough, radius, 0.02, 1.05), 6, rng, { color: barkColor, roughness: 0.04, structural: true, stiffness: stiff });
    lobe(bough, radius, center, crownRadius * bt(0.36, 0.48), H * bt(0.08, 0.12), bt(0.85, 1.0));
  }

  const geometry: BufferGeometry = mergeParts(`column-${p.seed}-${detail}`, [wood.finish('wood'), leaves.finish('leaves')]);
  let radius = 0;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) radius = Math.max(radius, Math.hypot(positions.getX(i), positions.getZ(i)));
  return {
    geometry,
    leafCount: leaves.leafCount,
    woodTriangles: wood.triangles,
    leafTriangles: leaves.triangles,
    height: geometry.boundingBox!.max.y,
    radius,
  };
}
