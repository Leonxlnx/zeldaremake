/**
 * White-bark trees — the Verdant Forest birch, ported and grown up for Kokiri Forest.
 * Derived from Verdant Forest by Leonxlnx (github.com/Leonxlnx/verdant-forest, app/forest/trees.js).
 *
 * Improvements over the source: seeded per-variant architecture (age classes sapling → mature,
 * lean 2–8°, taper power, cross-section ridging, side-leader count, bough count, crown width,
 * pendulous twig droop), root flare + below-ground skirt for exact ground contact, grey lower
 * trunk via vertex colour, palette-driven leaf colours with per-leaf variation, and per-vertex
 * wind attributes (trunk / branch / leaf layers). Geometry-only: metres, +Y up, base at y = 0.
 */
import { BufferGeometry, Color, Vector3 } from 'three';
import { createRng, type Rng } from '../util/prng';
import { smoothstep } from '../util/noise';
import {
  GeometryWriter,
  TAU,
  UP,
  addLeaf,
  between,
  divergingLeaderPath,
  frame,
  growthPath,
  mergeParts,
  rootButtress,
  sample,
  stiffnessFor,
  tangent,
  taper,
  tube,
  type Detail,
} from './writer';

export type Age = 'sapling' | 'young' | 'mature';

export interface WhiteBarkParams {
  seed: string;
  age: Age;
  height: number;
  trunkRadius: number;
  leanDeg: number;
  leanAzimuth: number;
  taperPower: number;
  ridge: number;
  sideLeaders: number;
  boughs: number;
  /** crown radius as a fraction of height */
  crownWidth: number;
  /** 0 = upright twigs, 1 = strongly pendulous */
  droop: number;
  leafSize: [number, number];
  /** leaf population multiplier */
  leafDensity: number;
  lowerLimbs: number;
  roots: number;
}

export interface TreeAsset {
  /** wood + leaves merged (leaf vertices flagged in aRoot.w) */
  geometry: BufferGeometry;
  leafCount: number;
  woodTriangles: number;
  leafTriangles: number;
  height: number;
  radius: number;
}

export interface Palette {
  barkWhite: number;
  barkGrey: number;
  barkDark: number;
  leafCanopy: number;
  leafSun: number;
}

/** Deterministic architecture for variant `index` of `total` (ages spread from saplings to mature). */
export function whiteBarkParams(rng: Rng, index: number, total: number): WhiteBarkParams {
  const r = rng.fork(`variant-${index}`);
  const f = index / Math.max(1, total - 1);
  const age: Age = f < 0.2 ? 'sapling' : f < 0.5 ? 'young' : 'mature';
  const base =
    age === 'sapling'
      ? { height: [3.6, 5.4], radius: [0.06, 0.1], boughs: [3, 3], leaders: [0, 0], leaf: [0.08, 0.13], density: 0.5, roots: [3, 4] }
      : age === 'young'
        ? { height: [7, 10], radius: [0.13, 0.2], boughs: [3, 4], leaders: [1, 1], leaf: [0.09, 0.15], density: 0.55, roots: [4, 5] }
        : { height: [11, 15], radius: [0.22, 0.34], boughs: [4, 5], leaders: [1, 2], leaf: [0.1, 0.17], density: 0.62, roots: [4, 6] };
  return {
    seed: `wb-${index}-${r.int(0, 1e9)}`,
    age,
    height: r.range(base.height[0], base.height[1]),
    trunkRadius: r.range(base.radius[0], base.radius[1]),
    leanDeg: r.range(2, 8),
    leanAzimuth: r.range(0, TAU),
    taperPower: r.range(0.8, 1.25),
    ridge: r.range(0.04, 0.13),
    sideLeaders: r.int(base.leaders[0], base.leaders[1] + 1),
    boughs: r.int(base.boughs[0], base.boughs[1] + 1),
    crownWidth: r.range(0.17, 0.26),
    droop: r.range(0.15, 1),
    leafSize: [base.leaf[0], base.leaf[1]],
    leafDensity: base.density * r.range(0.9, 1.12),
    lowerLimbs: age === 'sapling' ? 0 : r.chance(0.55) ? 1 : 0,
    roots: r.int(base.roots[0], base.roots[1] + 1),
  };
}

export function createWhiteBarkTree(p: WhiteBarkParams, palette: Palette, detail: Detail): TreeAsset {
  const rng = createRng(`whitebark/${p.seed}`);
  const bt = (a: number, b: number) => between(rng, a, b);
  const wood = new GeometryWriter(detail);
  const leaves = new GeometryWriter(detail);
  const H = p.height;
  const R = p.trunkRadius;
  const white = new Color(palette.barkWhite).multiplyScalar(1.12);
  const grey = new Color(palette.barkGrey);
  const dark = new Color(palette.barkDark);
  const canopy = new Color(palette.leafCanopy);
  const sunny = new Color(palette.leafSun);
  const greyHeight = 0.9 + H * 0.12;

  const trunkColor = (pt: Vector3, _t: number) => {
    const w = smoothstep(0.15, greyHeight, pt.y);
    return grey.clone().lerp(white, w).lerp(dark, 0.25 * (1 - smoothstep(-0.2, 0.5, pt.y)));
  };
  const branchColor = (radius: number) => {
    // thick boughs stay pale, twigs go dark brown like real birch
    const w = smoothstep(0.004, 0.05, radius);
    return dark.clone().lerp(white.clone().multiplyScalar(0.94), w);
  };

  // ---------- trunk ----------
  const crownRadius = H * p.crownWidth;
  const stemHeight = H * 0.915;
  const lean = Math.tan((p.leanDeg * Math.PI) / 180) * stemHeight;
  const stemTarget = new Vector3(Math.cos(p.leanAzimuth) * lean, stemHeight, Math.sin(p.leanAzimuth) * lean);
  const skirt = 0.5;
  const trunk = growthPath(new Vector3(0, -skirt, 0), stemTarget, UP, rng, 26, 0.22);
  const tipRadius = 0.02;
  const trunkRadii = trunk.map((pt, i) => {
    const t = i / (trunk.length - 1);
    const above = Math.max(0, pt.y) / stemHeight;
    const radius = tipRadius + (R - tipRadius) * Math.pow(1 - t, p.taperPower);
    return radius * (1 + 0.5 * Math.exp(-above * 22));
  });
  tube(wood, trunk, trunkRadii, 12, rng, {
    color: trunkColor,
    roughness: p.ridge,
    barkTile: 1.0,
    flatBase: true,
    isTrunk: true,
    structural: true,
    stiffness: () => 1,
  });

  // root flare
  const rootColor = grey.clone().lerp(dark, 0.35);
  for (let i = 0; i < p.roots; i++) {
    rootButtress(wood, (i / p.roots) * TAU + bt(-0.3, 0.3), R * bt(2.6, 4.2), R * bt(0.4, 0.62), R * bt(0.9, 1.4), rootColor, rng);
  }

  // ---------- leaf sprays ----------
  const leafOpts = (radius: number) => ({
    widthRatio: 0.69,
    wideFirst: 1,
    wideSecond: 0.54,
    stiffness: stiffnessFor(radius),
    flutter: 0.016,
    mediumEvery: 5,
    mediumScale: 2.0,
    lowEvery: 10,
    lowScale: 2.9,
  });

  /** lobe context for interior shading: leaves deep inside a lobe are darker (self-shadowed) */
  let lobe: { center: Vector3; hR: number } | null = null;
  function leafSpray(path: Vector3[], pathRadius: number, count: number, vigor = 1, startT = 0.15) {
    count = Math.max(1, Math.round(count * p.leafDensity * 1.75));
    const phase = rng() * TAU;
    const opts = leafOpts(pathRadius);
    for (let j = 0; j < count; j++) {
      const t = startT + ((1 - startT) * (j + bt(0.15, 0.85))) / count;
      const base = sample(path, t);
      const axis = tangent(path, t);
      const [u, v] = frame(axis);
      const angle = phase + j * 2.399963229728653 + bt(-0.3, 0.3);
      const outward = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle));
      const direction = axis
        .clone()
        .multiplyScalar(bt(0.28, 0.67))
        .addScaledVector(outward, 1)
        .addScaledVector(UP, bt(-0.18, 0.42) - p.droop * 0.15)
        .normalize();
      // outer/upper leaves catch the sun: lerp toward the bright palette green
      const heightF = base.y / H;
      const outF = Math.hypot(base.x, base.z) / Math.max(0.5, crownRadius);
      const sun = Math.min(1, Math.max(0, (heightF - 0.5) * 1.2 + outF * 0.35)) * bt(0.35, 1);
      const interior = lobe ? 0.7 + 0.3 * smoothstep(0.25, 0.85, base.distanceTo(lobe.center) / Math.max(0.3, lobe.hR)) : 1;
      const color = canopy.clone().lerp(sunny, sun).multiplyScalar(vigor * interior);
      const leafLength = bt(p.leafSize[0], p.leafSize[1]) * bt(0.91, 1.12);
      addLeaf(leaves, base, direction, leafLength, color, rng, opts);
    }
  }

  /** Volumetric leaf lobe: forks reach to its sides, back and interior; every leaf sits on a twig. */
  function foliateLobe(bough: Vector3[], center: Vector3, hR: number, vR: number, boughRadius: number, subCount = 3, twigCount = 5, sprigCount = 6) {
    lobe = { center, hR };
    leafSpray(bough, boughRadius * 0.4, 10, 0.94, 0.78);
    const phase = rng() * TAU;
    for (let j = 0; j < subCount; j++) {
      const attachment = 0.4 + (j / subCount) * 0.48 + bt(-0.035, 0.035);
      const origin = sample(bough, attachment);
      const a = phase + j * 2.39996 + bt(-0.45, 0.45);
      const elevation = bt(-0.55, 0.8);
      const reach = hR * Math.sqrt(1 - elevation * elevation) * bt(0.58, 0.95);
      const target = center.clone().add(new Vector3(Math.cos(a) * reach, elevation * vR, Math.sin(a) * reach));
      const secondary = growthPath(origin, target, tangent(bough, attachment), rng, 6, 0.85);
      const secondaryRadius = Math.max(0.015, boughRadius * Math.pow(1 - attachment, 0.9) * 0.53);
      tube(wood, secondary, taper(secondary, secondaryRadius, 0.0038), 4, rng, { color: branchColor(secondaryRadius), roughness: 0.027 });
      leafSpray(secondary, secondaryRadius * 0.5, 8, bt(0.88, 1.03), 0.65);

      for (let k = 0; k < twigCount; k++) {
        const twigT = 0.18 + (k / twigCount) * 0.72 + bt(-0.025, 0.025);
        const twigOrigin = sample(secondary, twigT);
        const twigAngle = a - 1.08 + (k / Math.max(1, twigCount - 1)) * 2.16 + bt(-0.23, 0.23);
        const twigElevation = bt(-0.75, 0.82);
        const twigReach = hR * (k === 2 ? bt(0.16, 0.36) : bt(0.57, 1.04));
        const twigTarget = center.clone().add(new Vector3(Math.cos(twigAngle) * twigReach, twigElevation * vR, Math.sin(twigAngle) * twigReach));
        twigTarget.y -= p.droop * bt(0.1, 0.6);
        const twig = growthPath(twigOrigin, twigTarget, tangent(secondary, twigT), rng, 4, 0.64);
        const twigRadius = Math.max(0.005, secondaryRadius * (1 - twigT) * 0.39);
        tube(wood, twig, taper(twig, twigRadius, 0.0016), 3, rng, { color: branchColor(twigRadius), roughness: 0.015 });
        leafSpray(twig, twigRadius * 0.6, 14, bt(0.9, 1.04), 0.3);

        const sprigPhase = rng() * TAU;
        for (let s = 0; s < sprigCount; s++) {
          const sprigT = 0.12 + s * (0.84 / sprigCount);
          const start = sample(twig, sprigT);
          const axis = tangent(twig, sprigT);
          const [u, v] = frame(axis);
          const angle = sprigPhase + s * 2.39996 + bt(-0.25, 0.25);
          const direction = u
            .clone()
            .multiplyScalar(Math.cos(angle))
            .addScaledVector(v, Math.sin(angle))
            .addScaledVector(axis, 0.36)
            .addScaledVector(UP, -0.05 - p.droop * 0.3)
            .normalize();
          const end = start.clone().addScaledVector(direction, bt(0.26, 0.5));
          const sprig = [start, end];
          tube(wood, sprig, [0.0036, 0.0011], 3, rng, { color: dark, roughness: 0 });
          leafSpray(sprig, 0.003, 12, bt(0.9, 1.04), 0.05);
        }
      }
    }
    lobe = null;
  }

  // ---------- scaffolds: central leader + diverging side leaders ----------
  interface Scaffold {
    path: Vector3[];
    radius: number;
    angle: number;
    attachMin: number;
    attachSpan: number;
    boughs: number;
    central?: boolean;
  }
  const scaffolds: Scaffold[] = [
    { path: trunk, radius: R * 0.44, angle: p.leanAzimuth, attachMin: 0.56, attachSpan: 0.37, boughs: p.boughs, central: true },
  ];
  for (let i = 0; i < p.sideLeaders; i++) {
    const t = 0.47 + i * 0.16 + bt(-0.035, 0.035);
    const origin = sample(trunk, t);
    const angle = p.leanAzimuth + 1.2 + i * 2.65 + bt(-0.6, 0.6);
    const reach = crownRadius * bt(0.42, 0.64);
    const target = new Vector3(Math.cos(angle) * reach, H * bt(0.8, 0.88), Math.sin(angle) * reach);
    const path = divergingLeaderPath(origin, target, rng, 16);
    const radius = R * Math.pow(1 - t, 0.8) * bt(0.53, 0.64);
    tube(wood, path, taper(path, radius, 0.014), 8, rng, { color: trunkColor, roughness: p.ridge * 0.7, barkTile: 1.0 });
    scaffolds.push({ path, radius, angle, attachMin: 0.35, attachSpan: 0.55, boughs: Math.max(3, p.boughs - 1) });
  }

  const isSapling = p.age === 'sapling';
  for (const scaffold of scaffolds) {
    for (let j = 0; j < scaffold.boughs; j++) {
      const t = scaffold.attachMin + (j / Math.max(1, scaffold.boughs - 1)) * scaffold.attachSpan + bt(-0.025, 0.025);
      const origin = sample(scaffold.path, t);
      const inward = j >= 2 && !(scaffold.boughs === 5 && j === 3);
      const angle = scaffold.central
        ? scaffold.angle + j * 2.13 + bt(-0.6, 0.6)
        : scaffold.angle + (j === 0 ? -1.02 : j === 1 ? 0.96 : j === 2 ? 1.5 : j === 3 ? -0.06 : -0.7) + bt(-0.33, 0.33);
      const radial = crownRadius * (inward ? bt(0.17, 0.38) : bt(0.63, 0.84));
      const lobeY = H * (j === 0 ? bt(0.66, 0.75) : j === 1 ? bt(0.77, 0.85) : j === 2 ? bt(0.765, 0.82) : inward ? bt(0.86, 0.93) : bt(0.82, 0.88));
      const center = new Vector3(Math.cos(angle) * radial, lobeY, Math.sin(angle) * radial);
      const end = center.clone().add(new Vector3(bt(-0.22, 0.22), bt(-0.32, 0.04), bt(-0.22, 0.22)));
      const bough = growthPath(origin, end, tangent(scaffold.path, t), rng, 12, 0.66);
      const radius = Math.max(0.03, scaffold.radius * Math.pow(1 - t, 0.73) * bt(0.5, 0.72));
      tube(wood, bough, taper(bough, radius, 0.007, 1.03), 6, rng, { color: branchColor(radius), roughness: p.ridge * 0.5 });
      const hR = crownRadius * bt(inward ? 0.29 : 0.31, inward ? 0.38 : 0.4);
      const vR = H * bt(0.1, 0.135);
      if (isSapling) foliateLobe(bough, center, hR, vR, radius, 2, 4, 4);
      else foliateLobe(bough, center, hR, vR, radius);
    }
  }

  // ---------- lower limb (pruning history) ----------
  for (let i = 0; i < p.lowerLimbs; i++) {
    const t = bt(0.3, 0.42);
    const origin = sample(trunk, t);
    const angle = p.leanAzimuth + 1.9 + i * 2.5 + bt(-0.55, 0.55);
    const reach = crownRadius * bt(0.35, 0.58);
    const center = origin.clone().add(new Vector3(Math.cos(angle) * reach, H * bt(0.065, 0.12), Math.sin(angle) * reach));
    const path = growthPath(origin, center, tangent(trunk, t).lerp(new Vector3(Math.cos(angle), 0.2, Math.sin(angle)), 0.62), rng, 8, 1.1);
    const radius = R * bt(0.12, 0.18);
    tube(wood, path, taper(path, radius, 0.004), 6, rng, { color: branchColor(radius), roughness: p.ridge * 0.5 });
    foliateLobe(path, center, crownRadius * 0.17, H * 0.04, radius, 2, 3, 4);
  }

  // ---------- epicormic shoots through the trunk surface (detail near the eye) ----------
  if (p.age === 'mature') {
    const shoots = rng.int(0, 3);
    for (let i = 0; i < shoots; i++) {
      const t = 0.2 + (i / Math.max(1, shoots - 1)) * 0.3 + bt(-0.04, 0.04);
      const origin = sample(trunk, t);
      const angle = rng() * TAU;
      const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
      const ri = t * (trunkRadii.length - 1);
      const radius = trunkRadii[Math.floor(ri)];
      const shoulder = origin.clone().addScaledVector(outward, radius * 1.14).addScaledVector(UP, 0.04);
      const end = shoulder.clone().addScaledVector(outward, 0.2 + rng() * 0.3).addScaledVector(UP, 0.12 + rng() * 0.2);
      const shoot = [origin, shoulder, end];
      tube(wood, shoot, [0.009, 0.0045, 0.0012], 3, rng, { color: dark, roughness: 0.012 });
      leafSpray(shoot, 0.005, 6, 0.94, 0.68);
    }
  }

  const geometry = mergeParts(`whitebark-${p.seed}-${detail}`, [wood.finish('wood'), leaves.finish('leaves')]);
  let radius = 0;
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) radius = Math.max(radius, Math.hypot(positions.getX(i), positions.getZ(i)));
  const height = geometry.boundingBox!.max.y;
  return {
    geometry,
    leafCount: leaves.leafCount,
    woodTriangles: wood.triangles,
    leafTriangles: leaves.triangles,
    height,
    radius,
  };
}
