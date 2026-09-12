/**
 * Plant geometry variants (ferns, bushes, purple and white flowers, fiddleheads, broad-leaf
 * plants, seed-head stalks, clover, moss tufts, saplings). Each builder returns one geometry per
 * LOD, highest detail first. Derived from Verdant Forest by Leonxlnx (understory.js /
 * botanical-refinement.js); leaf, flower and bud shapes follow the owner's concept sheets
 * (reference/concepts/01, see reference/CONCEPTS.md — the sheets are never loaded at runtime).
 */
import { Uint8BufferAttribute, Vector3, type BufferGeometry } from 'three';
import { createRng, type Rng } from '../util/prng';
import { MeshBuilder, TAU, V, blend, curvedLeaf, disc, dome, foldedLeaf, lanceLeaf, rgb, sampleCurve, shapedLeaf, tone, tube, type LeafOptions, type LeafShape, type RGB } from './geometry';

export type Detail = 'high' | 'mid' | 'low';
const DETAILS: Detail[] = ['high', 'mid', 'low'];

export interface PlantPalette {
  fern: RGB;
  leaf: RGB;
  leafSun: RGB;
  stem: RGB;
  bark: RGB;
  purple: RGB;
  purpleLight: RGB;
  purpleDeep: RGB;
  yellow: RGB;
  weed: RGB;
  straw: RGB;
  mossDeep: RGB;
  mossBright: RGB;
  grassLight: RGB;
}

export function makePalette(p: { fernGreen: number; leafCanopy: number; leafSun: number; barkDark: number; flowerPurple: number; mossDeep: number; mossBright: number; grassLight: number; grassMid: number }): PlantPalette {
  return {
    fern: rgb(p.fernGreen),
    // Understory foliage sits in the reference's olive band (shrubs #4c5537, sunlit leaves #8b8948):
    // pull the canopy tones (shared with the trees) toward it rather than rendering lime bushes.
    leaf: blend(rgb(p.leafCanopy), rgb(0x4c5537), 0.5),
    leafSun: blend(rgb(p.leafSun), rgb(0x8b8948), 0.6),
    stem: blend(rgb(p.grassMid), rgb(p.barkDark), 0.35),
    bark: rgb(p.barkDark),
    // The haze adds a grey pedestal to anything beyond a few metres, which kills saturation of dark
    // petals; a brighter, strongly saturated violet (same hue family as palette.flowerPurple) keeps
    // the blooms reading purple through the mist.
    purple: blend(rgb(p.flowerPurple), rgb(0x7a3fd8), 0.7),
    purpleLight: blend(rgb(p.flowerPurple), rgb(0x9d6ff0), 0.7),
    purpleDeep: blend(rgb(p.flowerPurple), rgb(0x5a2aa8), 0.7),
    yellow: rgb(0xf0d060),
    // broad-leaf weeds: a touch yellower than the grass, no brighter (the old lime blend read ≈ 0.6
    // luminance in the verges, well above the reference's brightest foliage)
    weed: blend(rgb(p.grassLight), rgb(0x7f8a3c), 0.5),
    straw: rgb(0xa89555),
    mossDeep: rgb(p.mossDeep),
    mossBright: rgb(p.mossBright),
    grassLight: rgb(p.grassLight),
  };
}

const arch = (radial: Vector3, lateral: Vector3, reach: number, sway: number, h: number, rise = 0.75) => (t: number) =>
  radial
    .clone()
    .multiplyScalar(0.02 + reach * Math.pow(t, 1.6))
    .addScaledVector(lateral, sway * t * t)
    .add(V(0, h * Math.sin(t * Math.PI * rise), 0));

// ---------------------------------------------------------------- ferns
export function fernGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const fronds = low ? 5 : 6 + rng.int(0, 3);
  const height = 0.5 + rng() * 0.32;
  const azimuth = rng() * TAU;
  const stemColor = blend(pal.stem, pal.fern, 0.5);
  for (let f = 0; f < fronds; f++) {
    const angle = azimuth + (f * TAU) / fronds + (rng() - 0.5) * 0.35;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    const h = height * (f === 0 ? 1 : 0.68 + rng() * 0.32);
    const reach = 0.58 + rng() * 0.36 + (1 - h / height) * 0.2;
    const curve = arch(radial, lateral, reach, (rng() - 0.5) * 0.18, h);
    const segs = high ? 10 : low ? 4 : 6;
    tube(m, sampleCurve(curve, segs), 0.0075, 0.001, stemColor, high ? 4 : 3);
    const pairs = high ? 11 : low ? 5 : 8;
    const frondTone = 0.85 + rng() * 0.3;
    for (let p = 0; p < pairs; p++) {
      const t = 0.15 + (p / (pairs - 1)) * 0.8;
      const envelope = Math.pow(Math.sin(Math.PI * ((t - 0.05) / 0.95)), 0.8);
      const length = (0.2 + rng() * 0.05) * Math.max(0.1, envelope) * (1 - t * 0.25) * (low ? 1.25 : 1);
      for (const sign of [-1, 1]) {
        const origin = curve(Math.min(1, Math.max(0, t + sign * 0.005)));
        const dir = lateral
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(radial, 0.25 + t * 0.3)
          .add(V(0, 0.12 - t * 0.28 + (rng() - 0.5) * 0.15, 0));
        const color = tone(pal.fern, frondTone * (0.9 + rng() * 0.2));
        const opts = { curl: 0.05 + rng() * 0.12, twist: sign * (0.05 + rng() * 0.2), ridge: 0.15, serration: 0.05 };
        if (high) lanceLeaf(m, origin, dir, length * (0.92 + rng() * 0.16), length * (0.26 + rng() * 0.06), color, { ...opts, sections: 3 });
        else if (low) foldedLeaf(m, origin, dir, length, length * 0.3, color, opts);
        else curvedLeaf(m, origin, dir, length, length * 0.28, color, opts);
      }
    }
    const tipDir = radial.clone().add(V(0, -0.35, 0));
    if (low) foldedLeaf(m, curve(0.96), tipDir, 0.07, 0.02, tone(pal.fern, 1.05));
    else curvedLeaf(m, curve(0.96), tipDir, 0.075, 0.02, tone(pal.fern, 1.05), { curl: 0.2 });
  }
  return m.finish({ groundToZero: true });
}

/**
 * Hero fern (reference D 0.05–0.14 × 0.55–0.68, left of the shot-d boulder): a tree-fern-like
 * crown of 8–12 big arching fronds, 0.7–0.9 m tall, rising steeply from a short fibrous
 * rootstock and leaning out at the top; broad rounded pinnae and curled fiddlehead tips. Lit
 * yellow-olive (`#69692e` in the footage) rather than the deep shade green of the understory
 * ferns, so the clump reads as the bright mass the reference box measures (lum ≈ 0.36).
 */
export function heroFernGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const fronds = low ? 6 : 8 + rng.int(0, 4);
  const height = 0.7 + rng() * 0.2;
  const azimuth = rng() * TAU;
  // the footage's fronds are a lit yellow-olive (`#69692e`), a full step lighter than the
  // understory fern green, and stay legible as separate arches against the dark bank
  const frondColor = blend(pal.fern, pal.leafSun, 0.5);
  const stemColor = blend(pal.stem, frondColor, 0.4);
  // rootstock: a stubby fibrous trunk the fronds spring from
  tube(m, [V(0, -0.02, 0), V(0.01, 0.06, 0), V(0, 0.13, 0.01)], 0.055, 0.035, tone(pal.bark, 0.9), high ? 6 : 4, true);
  for (let f = 0; f < fronds; f++) {
    const angle = azimuth + (f * TAU) / fronds + (rng() - 0.5) * 0.3;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    // the odd fronds are the younger inner ring: steeper and shorter
    const inner = f % 2 === 1;
    const h = height * (inner ? 0.78 + rng() * 0.14 : 0.92 + rng() * 0.1);
    const reach = inner ? 0.42 + rng() * 0.16 : 0.62 + rng() * 0.24;
    const rise = inner ? 0.62 : 0.7 + rng() * 0.1;
    const curve = arch(radial, lateral, reach, (rng() - 0.5) * 0.14, h, rise);
    const segs = high ? 12 : low ? 5 : 7;
    tube(m, sampleCurve(curve, segs), 0.012, 0.0025, stemColor, high ? 5 : 3);
    const pairs = high ? 12 : low ? 6 : 8;
    const frondTone = 0.86 + rng() * 0.34;
    for (let p = 0; p < pairs; p++) {
      const t = 0.14 + (p / (pairs - 1)) * 0.82;
      const envelope = Math.pow(Math.sin(Math.PI * ((t - 0.04) / 0.98)), 0.7);
      const length = (0.2 + rng() * 0.05) * Math.max(0.12, envelope) * (1 - t * 0.2) * (low ? 1.3 : 1);
      for (const sign of [-1, 1]) {
        const origin = curve(Math.min(1, Math.max(0, t + sign * 0.004)));
        const dir = lateral
          .clone()
          .multiplyScalar(sign)
          .addScaledVector(radial, 0.2 + t * 0.35)
          .add(V(0, 0.18 - t * 0.34 + (rng() - 0.5) * 0.12, 0));
        // pinnae brighten toward the sunlit tip of the frond
        const color = tone(frondColor, frondTone * (0.86 + t * 0.24 + rng() * 0.1));
        const opts = { curl: 0.08 + rng() * 0.1, twist: sign * (0.05 + rng() * 0.15), ridge: 0.18, serration: 0.04 };
        if (high) lanceLeaf(m, origin, dir, length * (0.94 + rng() * 0.12), length * (0.27 + rng() * 0.07), color, { ...opts, sections: 3 });
        else if (low) foldedLeaf(m, origin, dir, length, length * 0.32, color, opts);
        else curvedLeaf(m, origin, dir, length, length * 0.3, color, opts);
      }
    }
    // fiddlehead: the tip curls back over itself
    const tip = curve(1);
    const back = radial.clone().multiplyScalar(-1);
    if (high) {
      const spiral: Vector3[] = [];
      for (let k = 0; k <= 5; k++) {
        const a = (k / 5) * Math.PI * 1.35;
        const r = 0.035 * (1 - k / 9);
        spiral.push(tip.clone().addScaledVector(radial, 0.035 - Math.cos(a) * r).add(V(0, Math.sin(a) * r + k * 0.002, 0)));
      }
      tube(m, spiral, 0.007, 0.004, tone(frondColor, 1.15), 4, true);
    } else {
      curvedLeaf(m, tip, back.add(V(0, 0.6, 0)), 0.07, 0.03, tone(frondColor, 1.1), { curl: 0.5 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- bushes
/**
 * Near hedge lamina: broad ovate shoulders and a continuous curved midrib (owner sheets 01/05).
 * Keep the old five anchors, including their colours and UVs. Only six shoulder-row vertices
 * are added, inside the inherited leaf bounds: crown height and hedgeHeight placement stay exact.
 * No random draws, and no change to the shared cheap lamina used by other plants and lower LODs.
 */
function hedgeLeaf(mesh: MeshBuilder, base: Vector3, direction: Vector3, length: number, width: number, color: RGB, options: LeafOptions = {}) {
  const first = mesh.p.length / 3;
  const indexStart = mesh.i.length;
  curvedLeaf(mesh, base, direction, length, width, color, options);
  mesh.i.length = indexStart;
  const [a, l, c, r, t] = Array.from({ length: 5 }, (_, i) => V().fromArray(mesh.p, (first + i) * 3));
  const minimum = a.clone();
  const maximum = a.clone();
  for (const p of [l, c, r, t]) {
    minimum.min(p);
    maximum.max(p);
  }
  const anchorColor = (i: number): RGB => mesh.c.slice((first + i) * 3, (first + i + 1) * 3) as RGB;
  const middleColor = anchorColor(2);
  const rows: number[][] = [[first]];
  for (const u of [0.25, 0.5, 0.75]) {
    if (u === 0.5) {
      rows.push([first + 1, first + 2, first + 3]);
      continue;
    }
    // Quadratic interpolation through the existing attachment, raised midrib and curled tip.
    const centre = a.clone().multiplyScalar((1 - u) * (1 - 2 * u))
      .addScaledVector(c, 4 * u * (1 - u)).addScaledVector(t, u * (2 * u - 1));
    const safeCentre = u < 0.5 ? a.clone().lerp(c, u * 2) : c.clone().lerp(t, u * 2 - 1);
    const shoulder = u < 0.5 ? 0.82 : 0.68;
    const rowColor = u < 0.5 ? blend(anchorColor(0), middleColor, u * 2) : blend(middleColor, anchorColor(4), u * 2 - 1);
    rows.push([-1, 0, 1].map((side) => {
      const point = centre.clone();
      if (side) point.addScaledVector((side < 0 ? l : r).clone().sub(c), shoulder);
      // Limit along this displacement, rather than clamping axes independently into flat corners.
      const delta = point.clone().sub(safeCentre);
      let inset = 1;
      for (const axis of ['x', 'y', 'z'] as const) {
        if (delta[axis] > 0) inset = Math.min(inset, (maximum[axis] - safeCentre[axis]) / delta[axis]);
        else if (delta[axis] < 0) inset = Math.min(inset, (minimum[axis] - safeCentre[axis]) / delta[axis]);
      }
      point.copy(safeCentre).addScaledVector(delta, Math.max(0, inset));
      return mesh.vertex(point, (side + 1) / 2, u, side ? tone(rowColor, side < 0 ? 0.95 / 1.07 : 0.97 / 1.07) : rowColor);
    }));
  }
  rows.push([first + 4]);
  mesh.tri(rows[0][0], rows[1][0], rows[1][1]);
  mesh.tri(rows[0][0], rows[1][1], rows[1][2]);
  for (let row = 1; row < 3; row++) {
    for (let side = 0; side < 2; side++) {
      mesh.tri(rows[row][side], rows[row + 1][side], rows[row][side + 1]);
      mesh.tri(rows[row][side + 1], rows[row + 1][side], rows[row + 1][side + 1]);
    }
  }
  mesh.tri(rows[3][0], rows[4][0], rows[3][1]);
  mesh.tri(rows[3][1], rows[4][0], rows[3][2]);
}

export function bushGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  // variants() appends /0, /1, ...; only the authored hedge namespace receives the near detail.
  const isHedge = /\/hedge\/\d+$/.test(seed);
  const leaf = high && isHedge ? hedgeLeaf : curvedLeaf;
  // Separate thin laminae from solid stems without changing any generated surface or RNG draw.
  const leafRanges: [number, number][] | null = isHedge ? [] : null;
  const stems = 5 + rng.int(0, 3);
  const height = 0.95 + rng() * 0.55;
  const phase = rng() * TAU;
  for (let s = 0; s < stems; s++) {
    const angle = phase + (s * TAU) / stems + (rng() - 0.5) * 0.8;
    const radial = V(Math.cos(angle), 0, Math.sin(angle));
    const lateral = V(-Math.sin(angle), 0, Math.cos(angle));
    const bend = 0.32 + rng() * 0.4;
    const h = height * (0.65 + rng() * 0.35);
    const curve = (t: number) => radial.clone().multiplyScalar(0.05 + bend * t * t).addScaledVector(lateral, Math.sin(t * Math.PI) * 0.06).add(V(0, t * h, 0));
    tube(m, sampleCurve(curve, high ? 5 : 3), 0.012 + rng() * 0.005, 0.0025, pal.bark, high ? 4 : 3);
    const branches = high ? 5 : low ? 2 : 3;
    for (let b = 0; b < branches; b++) {
      const t = 0.2 + (b / Math.max(1, branches - 1)) * 0.72;
      const start = curve(t);
      const sign = b % 2 ? -1 : 1;
      const reach = (0.32 + rng() * 0.22) * (1.1 - t * 0.3);
      const branchDir = lateral.clone().multiplyScalar(sign * (0.7 + rng() * 0.35)).addScaledVector(radial, 0.45 + rng() * 0.4).normalize();
      const rise = 0.1 + rng() * 0.18;
      const twig = (u: number) => start.clone().addScaledVector(branchDir, reach * u).add(V(0, rise * u + Math.sin(u * Math.PI) * 0.04, 0));
      if (!low) tube(m, sampleCurve(twig, high ? 3 : 2), 0.005 * (1 - t * 0.4), 0.001, tone(pal.bark, 1.15), 3);
      const leafCount = high ? 9 : low ? 4 : 6;
      for (let l = 0; l < leafCount; l++) {
        const u = 0.1 + (l / (leafCount - 1)) * 0.9;
        const attach = twig(u);
        const leafSide = l % 2 ? -1 : 1;
        const cross = V(-branchDir.z, 0, branchDir.x);
        const dir = cross
          .multiplyScalar(leafSide * (0.6 + rng() * 0.45))
          .addScaledVector(branchDir, 0.4 + rng() * 0.35)
          .add(V(0, (rng() - 0.4) * 0.7, 0))
          .normalize();
        const len = (0.16 + rng() * 0.09) * (1.05 - u * 0.15) * (low ? 1.4 : 1);
        const sun = Math.min(1, (attach.y / height) * 0.7 + Math.hypot(attach.x, attach.z) * 0.5);
        const color = tone(blend(pal.leaf, pal.leafSun, sun * 0.7), 0.85 + rng() * 0.3);
        const opts = { curl: 0.1 + rng() * 0.12, twist: (rng() - 0.5) * 0.6, ridge: 0.12 };
        const leafStart = m.p.length / 3;
        if (low) foldedLeaf(m, attach, dir, len, len * 0.6, color, opts);
        else leaf(m, attach, dir, len, len * (0.55 + rng() * 0.25), color, opts);
        leafRanges?.push([leafStart, m.p.length / 3]);
      }
    }
    for (let terminal = 0; terminal < 2; terminal++) {
      const dir = radial.clone().addScaledVector(lateral, terminal ? 0.55 : -0.55).add(V(0, 0.45, 0));
      const color = tone(pal.leafSun, 0.95 + rng() * 0.15);
      const leafStart = m.p.length / 3;
      if (low) foldedLeaf(m, curve(0.98), dir, 0.12, 0.08, color);
      else leaf(m, curve(0.98), dir, terminal ? 0.1 : 0.13, terminal ? 0.06 : 0.085, color, { curl: 0.17, twist: 0.15, ridge: 0.11 });
      leafRanges?.push([leafStart, m.p.length / 3]);
    }
  }
  const geometry = m.finish({ groundToZero: true });
  if (leafRanges) {
    const surface = new Uint8Array(geometry.attributes.position.count);
    for (const [start, end] of leafRanges) surface.fill(255, start, end);
    geometry.setAttribute('aLeafSurface', new Uint8BufferAttribute(surface, 1, true));
  }
  return geometry;
}

// ---------------------------------------------------------------- purple flowers
/**
 * Hydrangea / allium-like cluster bloom: a bumpy violet dome of florets with a few petals
 * flaring from its rim. Dense enough to read as a solid purple blob at distance.
 */
function clusterHead(m: MeshBuilder, center: Vector3, normal: Vector3, radius: number, rng: Rng, pal: PlantPalette, detail: Detail) {
  const n = normal.clone().normalize();
  const side = new Vector3().crossVectors(Math.abs(n.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), n).normalize();
  const fwd = new Vector3().crossVectors(n, side).normalize();
  const high = detail === 'high';
  const low = detail === 'low';
  const rings = high ? 3 : 2;
  const segments = low ? 5 : high ? 8 : 6;
  const floret = () => blend(blend(pal.purple, pal.purpleLight, rng() * 0.5), pal.purpleDeep, rng() * 0.4);
  const at = (u: number, v: number, h: number) => center.clone().addScaledVector(side, u).addScaledVector(fwd, v).addScaledVector(n, h);
  const top = m.vertex(at(0, 0, radius * 0.8), 0.5, 1, blend(pal.purple, pal.purpleLight, 0.3));
  const levels: number[][] = [];
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const phi = t * Math.PI * 0.55;
    const level: number[] = [];
    for (let k = 0; k < segments; k++) {
      const ang = (k * TAU) / segments + (r % 2) * (Math.PI / segments);
      const rr = radius * Math.sin(phi) * (0.85 + rng() * 0.3);
      const h = radius * 0.8 * Math.cos(phi) * (0.85 + rng() * 0.3);
      level.push(m.vertex(at(Math.cos(ang) * rr, Math.sin(ang) * rr, h), k / segments, 1 - t, floret()));
    }
    levels.push(level);
  }
  for (let k = 0; k < segments; k++) m.tri(top, levels[0][(k + 1) % segments], levels[0][k]);
  for (let r = 0; r < rings - 1; r++) {
    for (let k = 0; k < segments; k++) {
      const nx = (k + 1) % segments;
      m.tri(levels[r][k], levels[r][nx], levels[r + 1][k]);
      m.tri(levels[r][nx], levels[r + 1][nx], levels[r + 1][k]);
    }
  }
  // rim petals for a fluffy silhouette
  const petals = low ? 3 : high ? 6 : 4;
  const p0 = rng() * TAU;
  for (let p = 0; p < petals; p++) {
    const a = p0 + (p * TAU) / petals;
    const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(fwd, Math.sin(a)).addScaledVector(n, 0.25 + rng() * 0.3).normalize();
    const base = at(Math.cos(a) * radius * 0.75, Math.sin(a) * radius * 0.75, radius * 0.25);
    foldedLeaf(m, base, dir, radius * (0.55 + rng() * 0.3), radius * 0.5, floret(), { curl: 0.25, tipColor: pal.purpleLight });
  }
}

export function flowerGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const low = detail === 'low';
  const stems = low ? 5 : 6 + rng.int(0, 4);
  const phase = rng() * TAU;
  const leafColor = blend(pal.leaf, pal.grassLight, 0.3);
  for (let i = 0; i < stems; i++) {
    const angle = phase + (i * TAU) / stems + (rng() - 0.5) * 0.5;
    const radius = 0.03 + rng() * 0.11;
    const root = V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const height = 0.22 + rng() * 0.2;
    const lean = V(Math.cos(angle) * height * 0.3, height, Math.sin(angle) * height * 0.3);
    const curve = (t: number) => root.clone().add(lean.clone().multiplyScalar(t)).add(V(Math.sin(angle + 0.8) * Math.sin(t * Math.PI) * 0.015, 0, Math.cos(angle + 0.8) * Math.sin(t * Math.PI) * 0.015));
    // High/mid share the skeleton, including the root tangent used to ground the mesh.
    // Most mid-LOD savings come from the head, not these six extra stem triangles.
    tube(m, sampleCurve(curve, low ? 2 : 3), 0.0026, 0.0014, pal.stem, 3);
    if (!low) {
      for (let j = 0; j < 2; j++) {
        for (const sign of [-1, 1]) {
          const dir = V(Math.cos(angle + j * 1.3) * sign, 0.3, Math.sin(angle + j * 1.3) * sign);
          curvedLeaf(m, curve(0.22 + j * 0.3), dir, 0.05 + rng() * 0.035, 0.02, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.12, twist: sign * 0.15 });
        }
      }
    }
    // head: dense cluster bloom (~7–10 cm across)
    const up = lean.clone().normalize().add(V((rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3)).normalize();
    // Petal tessellation must not advance the layout stream and move the next stem.
    // Retain the existing cheap low LOD; only high/mid need matching silhouettes.
    clusterHead(m, curve(1), up, 0.034 + rng() * 0.016, low ? rng : rng.fork(`head-${i}`), pal, detail);
  }
  if (!low) {
    const rosette = 4 + rng.int(0, 3);
    for (let l = 0; l < rosette; l++) {
      const a = phase + (l * TAU) / rosette + rng() * 0.4;
      const dir = V(Math.cos(a), 0.55 + rng() * 0.3, Math.sin(a)).normalize();
      curvedLeaf(m, V(Math.cos(a) * 0.02, 0.005, Math.sin(a) * 0.02), dir, 0.07 + rng() * 0.05, 0.035, tone(leafColor, 0.85 + rng() * 0.2), { curl: 0.2, ridge: 0.12 });
    }
  }
  return m.finish({ groundToZero: true });
}

/** Purple flower spikes (hyacinth / lupin-like): a stem carrying a column of small bells. */
export function flowerSpikeGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const low = detail === 'low';
  const stems = low ? 4 : 5 + rng.int(0, 4);
  const phase = rng() * TAU;
  const leafColor = blend(pal.leaf, pal.grassLight, 0.35);
  for (let i = 0; i < stems; i++) {
    const angle = phase + (i * TAU) / stems + (rng() - 0.5) * 0.5;
    const radius = 0.02 + rng() * 0.13;
    const root = V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const height = 0.26 + rng() * 0.2;
    const lean = V(Math.cos(angle) * height * 0.22, height, Math.sin(angle) * height * 0.22);
    const curve = (t: number) => root.clone().add(lean.clone().multiplyScalar(t)).add(V(Math.sin(angle + 1.1) * Math.sin(t * Math.PI) * 0.012, 0, Math.cos(angle + 1.1) * Math.sin(t * Math.PI) * 0.012));
    tube(m, sampleCurve(curve, low ? 2 : 3), 0.0026, 0.0014, pal.stem, 3);
    if (!low) {
      for (const sign of [-1, 1]) {
        const dir = V(Math.cos(angle + 0.9) * sign, 0.35, Math.sin(angle + 0.9) * sign);
        curvedLeaf(m, curve(0.18), dir, 0.07 + rng() * 0.04, 0.022, tone(leafColor, 0.9 + rng() * 0.25), { curl: 0.15, twist: sign * 0.2 });
      }
    }
    const bells = low ? 5 : 7 + rng.int(0, 4);
    const bellR = 0.022 + rng() * 0.008;
    for (let b = 0; b < bells; b++) {
      const t = 0.45 + (b / (bells - 1)) * 0.55;
      const c = curve(t);
      const a0 = rng() * TAU;
      const petals = low ? 3 : 4;
      const scale = 1 - 0.35 * Math.max(0, (t - 0.85) / 0.15);
      for (let p = 0; p < petals; p++) {
        const a = a0 + (p * TAU) / petals;
        const dir = V(Math.cos(a), -0.35 + rng() * 0.3, Math.sin(a)).normalize();
        const color = blend(blend(pal.purple, pal.purpleLight, 0.2 + rng() * 0.5), pal.purpleDeep, rng() * 0.3);
        // Mid-distance bells keep every floret but use a folded lamina instead of four triangles.
        if (low || detail === 'mid') foldedLeaf(m, c, dir, bellR * (low ? 1.6 : 1.7) * scale, bellR * 1.6 * scale, color, { curl: 0.2 });
        else curvedLeaf(m, c, dir, bellR * 1.7 * scale, bellR * 1.6 * scale, color, { curl: 0.3, ridge: -0.1, tipColor: pal.purpleLight });
      }
    }
    // terminal bud
    clusterHead(m, curve(1), lean.clone().normalize(), bellR * 1.1, rng, pal, 'low');
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- broad-leaf plants
/** the three concept-sheet laminae, one per weed variant (sheet 01 “Leaves & plants”) */
export const BROADLEAF_SHAPES: readonly LeafShape[] = ['heart', 'ovate', 'round'];

/**
 * Broad-leaf ground plant: 3–6 waxy leaves on short petioles rising from a crown, 0.15–0.35 m
 * across at unit scale. Variant 0 grows the heart-shaped Kokiri leaf, 1 the broad ovate forest
 * leaf, 2 the round ground leaf; each lamina carries a raised, lighter midrib. The glossy upper
 * face comes from the material (`topRoughness`), the underside stays matte.
 */
export function weedGeometry(seed: string, pal: PlantPalette, detail: Detail, variant = 0): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const shape = BROADLEAF_SHAPES[variant % BROADLEAF_SHAPES.length];
  const leaves = high ? 4 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  // heart leaves are the fresh mid green, forest leaves the deep glossy green, ground leaves yellower
  const lamina = shape === 'ovate' ? blend(pal.weed, pal.leaf, 0.55) : shape === 'round' ? blend(pal.weed, pal.leafSun, 0.25) : blend(pal.weed, pal.leaf, 0.3);
  const petioleColor = blend(pal.stem, lamina, 0.5);
  const aspect = shape === 'round' ? 0.95 : shape === 'heart' ? 0.82 : 0.58;
  for (let l = 0; l < leaves; l++) {
    const a = phase + (l * TAU) / leaves + (rng() - 0.5) * 0.6;
    const radial = V(Math.cos(a), 0, Math.sin(a));
    const len = (0.075 + rng() * 0.055) * (high ? 1 : 1.15);
    const rise = 0.55 + rng() * 0.75;
    // petiole: from the crown up and out, the blade continuing flatter so its face turns to the sky
    const petiole = 0.03 + rng() * 0.05;
    const root = V(Math.cos(a) * 0.01, 0.003, Math.sin(a) * 0.01);
    const knee = root.clone().addScaledVector(radial, petiole * 0.8).add(V(0, petiole * rise, 0));
    if (high) tube(m, [root, knee], 0.0035, 0.0025, petioleColor, 3);
    const dir = radial.clone().multiplyScalar(1).add(V(0, rise * 0.35 - 0.1 + (rng() - 0.5) * 0.2, 0)).normalize();
    const color = tone(lamina, 0.88 + rng() * 0.26);
    shapedLeaf(m, knee, dir, len, len * aspect * (0.9 + rng() * 0.2), color, {
      shape,
      sections: high ? (shape === 'heart' ? 6 : 5) : 3,
      across: high ? 5 : 3,
      curl: 0.1 + rng() * 0.14,
      twist: (rng() - 0.5) * 0.35,
      ridge: 0.13,
    });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- white forest flowers
/**
 * White forest flowers (sheet 01 “Flower clumps”, 02 / 04): a clump of 8–15 small five-petal white
 * blooms with yellow centres on thin stems, 0.3–0.5 m across and ≤ 0.25 m tall at unit scale,
 * with a few heart-shaped leaves at its base.
 */
export function whiteFlowerGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const blooms = high ? 8 + rng.int(0, 8) : 8;
  // root radius; with the leaning stems and petals the clump reads 0.3–0.5 m across
  const clumpR = 0.1 + rng() * 0.07;
  const phase = rng() * TAU;
  const white: RGB = [0.9, 0.9, 0.84];
  const cream: RGB = [0.96, 0.95, 0.88];
  const yellow: RGB = blend(pal.yellow, [1, 0.8, 0.2], 0.4);
  const stemColor = blend(pal.stem, pal.grassLight, 0.4);
  const leafColor = blend(pal.leaf, pal.grassLight, 0.3);
  for (let i = 0; i < blooms; i++) {
    const a = phase + (i * TAU) / blooms + (rng() - 0.5) * 0.8;
    const r = clumpR * (0.25 + 0.75 * Math.sqrt(rng()));
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.09 + rng() * 0.12;
    const lean = V(Math.cos(a) * h * 0.22, h, Math.sin(a) * h * 0.22);
    const top = root.clone().add(lean);
    tube(m, high ? [root, root.clone().addScaledVector(lean, 0.5).add(V(Math.sin(a) * 0.006, 0, Math.cos(a) * 0.006)), top] : [root, top], 0.002, 0.0012, stemColor, 3);
    // the bloom faces up and a little outward
    const up = lean.clone().normalize().add(V((rng() - 0.5) * 0.4, 0.5, (rng() - 0.5) * 0.4)).normalize();
    const side = new Vector3().crossVectors(Math.abs(up.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), up).normalize();
    const fwd = new Vector3().crossVectors(up, side).normalize();
    const petalLen = 0.014 + rng() * 0.006;
    const p0 = rng() * TAU;
    const petals = high ? 5 : 4;
    // the far LOD (> 12 m, where a bloom is a pixel or two) grows its petals so the white dots
    // of frame 14 s survive the distance
    const far = high ? 1 : 2.4;
    for (let p = 0; p < petals; p++) {
      const pa = p0 + (p * TAU) / petals;
      const dir = side.clone().multiplyScalar(Math.cos(pa)).addScaledVector(fwd, Math.sin(pa)).addScaledVector(up, 0.12).normalize();
      const base = top.clone().addScaledVector(dir, 0.003);
      const color = blend(white, cream, rng() * 0.6);
      // petals cup upward (positive curl toward `up`), the lamina plane pinned to the bloom's axis
      if (high) curvedLeaf(m, base, dir, petalLen, petalLen * 0.72, color, { curl: 0.28, ridge: -0.05, planeNormal: up, tipColor: cream });
      else foldedLeaf(m, base, dir, petalLen * far, petalLen * 0.9 * far, color, { curl: 0.25, ridge: -0.05, planeNormal: up });
    }
    disc(m, top.clone().addScaledVector(up, 0.002), up, 0.0042 * far, high ? 6 : 3, yellow, tone(yellow, 0.85), 0.002);
  }
  if (high) {
    const leaves = 3 + rng.int(0, 3);
    for (let l = 0; l < leaves; l++) {
      const a = phase + (l * TAU) / leaves + rng() * 0.5;
      const radial = V(Math.cos(a), 0, Math.sin(a));
      const root = V(Math.cos(a) * 0.02, 0.003, Math.sin(a) * 0.02);
      const knee = root.clone().addScaledVector(radial, 0.03).add(V(0, 0.035, 0));
      tube(m, [root, knee], 0.0025, 0.0018, stemColor, 3);
      const len = 0.04 + rng() * 0.025;
      shapedLeaf(m, knee, radial.clone().add(V(0, 0.15, 0)), len, len * 0.85, tone(leafColor, 0.9 + rng() * 0.2), { shape: 'heart', sections: 4, across: 5, curl: 0.15, ridge: 0.12 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- fiddleheads (forest buds)
/**
 * Fiddleheads (sheet 01 “Forest buds (unopened)”, sheet 04): 2–4 spiral buds on stout stalks,
 * 0.25–0.45 m tall at unit scale, the coil curling back over itself toward the crown. Sits at
 * the centre of a fern crown.
 */
export function fiddleheadGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const buds = high ? 2 + rng.int(0, 3) : 2;
  const phase = rng() * TAU;
  // dark fibrous stalks, the coil a lighter yellow-green (sheet 01: pale fuzzy spirals on dark stems)
  const stalkColor = blend(pal.fern, pal.bark, 0.35);
  const coilColor = tone(blend(pal.fern, pal.leafSun, 0.55), 1.1);
  const scaleColor = blend(pal.bark, pal.straw, 0.35);
  for (let b = 0; b < buds; b++) {
    const a = phase + (b * TAU) / buds + (rng() - 0.5) * 0.7;
    const radial = V(Math.cos(a), 0, Math.sin(a));
    const root = radial.clone().multiplyScalar(0.02 + rng() * 0.04);
    // stalk + coil: 0.26–0.41 m at unit scale
    const h = 0.24 + rng() * 0.13;
    const lean = 0.05 + rng() * 0.09;
    const stalk = (t: number) => root.clone().addScaledVector(radial, lean * t * t).add(V(0, h * t, 0));
    const points = sampleCurve(stalk, high ? 5 : 3);
    tube(m, points, 0.0072, 0.0055, stalkColor, high ? 5 : 3);
    // coil: tangent to the stalk at its top, curling inward (toward the crown) and over itself
    const top = stalk(1);
    const R = 0.026 + rng() * 0.014;
    const centre = top.clone().addScaledVector(radial, -R);
    const turns = 1.25 + rng() * 0.3;
    const n = high ? 12 : 6;
    const coil: Vector3[] = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const ang = u * turns * TAU;
      const r = R * (1 - 0.55 * u);
      coil.push(centre.clone().addScaledVector(radial, Math.cos(ang) * r).add(V(0, Math.sin(ang) * r, 0)).addScaledVector(V(-radial.z, 0, radial.x), Math.sin(u * Math.PI) * 0.004));
    }
    // a rope-thick spiral (sheet 01: fat fuzzy coils), tapering toward the tip
    tube(m, coil, 0.0085, 0.0032, coilColor, high ? 6 : 3, true);
    if (high) {
      // papery brown scales clinging to the stalk and the outer coil
      for (let s = 0; s < 3; s++) {
        const t = 0.3 + s * 0.25;
        const at = stalk(t);
        const dir = radial.clone().multiplyScalar(s % 2 ? 1 : -1).add(V(0, 0.9, 0)).normalize();
        foldedLeaf(m, at, dir, 0.014, 0.007, scaleColor, { curl: 0.3 });
      }
      foldedLeaf(m, coil[2], V(-radial.x, 0.4, -radial.z).normalize(), 0.012, 0.007, scaleColor, { curl: 0.3 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- tall seed-head stalks
export function seedheadGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const stalks = high ? 3 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  const stalkColor = blend(pal.weed, pal.straw, 0.5);
  for (let s = 0; s < stalks; s++) {
    const a = phase + (s * TAU) / stalks + (rng() - 0.5) * 0.7;
    const r = 0.02 + rng() * 0.06;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.42 + rng() * 0.33;
    const lean = 0.08 + rng() * 0.16;
    const curve = (t: number) => root.clone().add(V(Math.cos(a) * lean * t * t, h * t, Math.sin(a) * lean * t * t));
    tube(m, sampleCurve(curve, high ? 3 : 2), 0.0022, 0.0012, stalkColor, 3);
    // seed spike
    const top = curve(1);
    const tipDir = V(Math.cos(a) * lean * 2, h, Math.sin(a) * lean * 2).normalize();
    const spike = [top, top.clone().addScaledVector(tipDir, 0.035), top.clone().addScaledVector(tipDir, 0.075)];
    tube(m, spike, 0.006, 0.002, blend(pal.straw, pal.bark, 0.25), 3, true);
    if (high) foldedLeaf(m, curve(0.35), V(-Math.sin(a), 0.55, Math.cos(a)), 0.11, 0.012, tone(pal.weed, 0.95), { curl: 0.2 });
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- clover / sorrel ground cover
export function cloverGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const stems = high ? 4 + rng.int(0, 3) : 3;
  const phase = rng() * TAU;
  const color = blend(pal.leaf, pal.grassLight, 0.45);
  for (let s = 0; s < stems; s++) {
    const a = phase + (s * TAU) / stems + (rng() - 0.5) * 0.6;
    const r = 0.015 + rng() * 0.05;
    const root = V(Math.cos(a) * r, 0, Math.sin(a) * r);
    const h = 0.04 + rng() * 0.05;
    const top = root.clone().add(V(Math.cos(a) * h * 0.3, h, Math.sin(a) * h * 0.3));
    if (high) tube(m, [root, top], 0.0012, 0.0008, pal.stem, 3);
    const size = 0.022 + rng() * 0.014;
    for (let l = 0; l < 3; l++) {
      const la = a + (l * TAU) / 3 + rng() * 0.3;
      const dir = V(Math.cos(la), 0.2 + (rng() - 0.5) * 0.3, Math.sin(la)).normalize();
      foldedLeaf(m, top, dir, size, size * 0.85, tone(color, 0.9 + rng() * 0.3), { curl: 0.12, ridge: 0.15 });
    }
  }
  return m.finish({ groundToZero: true });
}

// ---------------------------------------------------------------- moss tufts
export function mossGeometry(seed: string, pal: PlantPalette): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const jitterTable = Array.from({ length: 512 }, () => rng());
  dome(m, 1, 0.38 + rng() * 0.12, 9, 3, tone(pal.mossDeep, 0.85), tone(pal.mossBright, 0.9), (i) => jitterTable[Math.abs(i) % 512]);
  return m.finish();
}

// ---------------------------------------------------------------- saplings
export function saplingGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const high = detail === 'high';
  const low = detail === 'low';
  const height = 1.3 + rng() * 0.9;
  const lean = V((rng() - 0.5) * 0.25, 0, (rng() - 0.5) * 0.25);
  const trunk = (t: number) => lean.clone().multiplyScalar(t * t * height).add(V(0, t * height, 0));
  tube(m, sampleCurve(trunk, high ? 6 : 4), 0.022, 0.006, blend(pal.bark, [0.35, 0.33, 0.3], 0.35), high ? 5 : 3);
  const branches = high ? 5 : low ? 3 : 4;
  for (let b = 0; b < branches; b++) {
    const t = 0.45 + (b / branches) * 0.5;
    const a = rng() * TAU;
    const start = trunk(t);
    const dir = V(Math.cos(a), 0.35 + rng() * 0.3, Math.sin(a)).normalize();
    const reach = 0.3 + rng() * 0.25;
    const twig = (u: number) => start.clone().addScaledVector(dir, reach * u).add(V(0, Math.sin(u * Math.PI) * 0.03, 0));
    if (!low) tube(m, sampleCurve(twig, 3), 0.006, 0.0015, tone(pal.bark, 1.1), 3);
    const leaves = high ? 8 : low ? 4 : 6;
    for (let l = 0; l < leaves; l++) {
      const u = 0.15 + (l / (leaves - 1)) * 0.85;
      const side = l % 2 ? -1 : 1;
      const cross = V(-dir.z, 0, dir.x);
      const ld = cross.multiplyScalar(side * 0.7).addScaledVector(dir, 0.5).add(V(0, (rng() - 0.3) * 0.5, 0)).normalize();
      const len = (0.09 + rng() * 0.05) * (low ? 1.6 : 1);
      const color = tone(blend(pal.leaf, pal.leafSun, 0.3 + u * 0.4), 0.85 + rng() * 0.3);
      if (low) foldedLeaf(m, twig(u), ld, len, len * 0.6, color);
      else curvedLeaf(m, twig(u), ld, len, len * 0.6, color, { curl: 0.12, twist: (rng() - 0.5) * 0.5 });
    }
  }
  // crown tuft
  for (let l = 0; l < (low ? 3 : 5); l++) {
    const a = rng() * TAU;
    const ld = V(Math.cos(a), 0.6, Math.sin(a)).normalize();
    curvedLeaf(m, trunk(1), ld, 0.1, 0.06, tone(pal.leafSun, 0.95 + rng() * 0.1), { curl: 0.15 });
  }
  return m.finish({ groundToZero: true });
}

/** Build `count` variants × all LODs; builders may key their shape off the variant index. */
export function variants(count: number, seed: string, pal: PlantPalette, build: (seed: string, pal: PlantPalette, detail: Detail, variant: number) => BufferGeometry, lods: Detail[] = DETAILS): BufferGeometry[][] {
  const out: BufferGeometry[][] = [];
  for (let v = 0; v < count; v++) out.push(lods.map((d) => build(`${seed}/${v}`, pal, d, v)));
  return out;
}

export function maxHeight(geos: BufferGeometry[][]): number {
  let h = 0;
  for (const row of geos) for (const g of row) h = Math.max(h, g.boundingBox?.max.y ?? 1);
  return h;
}

export type { Rng };
