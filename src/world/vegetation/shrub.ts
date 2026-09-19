/**
 * Shrub crowns as layered leaf clusters (round 47 — the owner's review of 2026-09-19, item 10:
 * "the tree shrubs look really low quality — exactly like Zelda", references ref-04's path edges
 * and ref-01's house shrubs). One builder, `shrubCrown`, carries the three looks the vegetation
 * scatters place (plants.ts): the clipped HEDGE crowns of the shot-A rows, the loose leafy BUSHES
 * of the banks and ledges, and the BIG-LEAF shrub at the house (ref-01: hosta-like round glossy
 * laminae). All three are the same construction:
 *
 *  - an irregular crown: 3–5 overlapping ellipsoid LOBES of different centres and sizes, so the
 *    silhouette is a ragged mass, never a dome or a fan;
 *  - an opaque dark CORE per lobe (no light through the crown — ref-04's edges are dark masses);
 *  - 3–4 DEPTH LAYERS of leaves on each lobe's surface, the outer layer lit (two-tone lamina:
 *    a deep rib grading to the lit margin, the tip lightest) and every layer inward sunk toward
 *    the core tone, so the crown reads as lit leaf clusters over a dark heart; the outer leaves
 *    grow in BUNCHES whose cores stand proud and whose fringes sink — the clustered bumps of a
 *    real shrub, with lit rims where a bunch top meets the light;
 *  - a few leaf SPRAYS on twigs escaping the surface, breaking the outline;
 *  - stems from the ground into the crown, visible at the skirt.
 *
 * Leaves are ovate / heart / round laminae (geometry.ts): `shapedLeaf` with a midrib fold at the
 * near LODs, `curvedLeaf` at the high / mid LODs, `foldedLeaf` far. The upper faces take the
 * glossy roughness (materials.ts topRoughness). Every LOD of a variant draws its crown from the
 * same stream, so heights and lobe layout agree (the hedge scatters scale a crown by the near
 * LOD's height) and a LOD switch keeps the silhouette.
 */
import { Vector3, type BufferGeometry } from 'three';
import { createRng, type Rng } from '../util/prng';
import { BROADLEAF_U, MeshBuilder, NOT_LAMINA, TAU, V, blend, curvedLeaf, foldedLeaf, sampleCurve, shapedLeaf, tone, tube, type LeafShape, type RGB } from './geometry';
import type { Detail, PlantPalette } from './plantgeo';

/**
 * Camera distance (m) inside which a bush draws its ultra LOD (round 44; round 47 keeps the ring:
 * no fixed camera has a bush inside it — plants.test — so the six frames see the high LOD).
 */
export const BUSH_ULTRA_M = 5;
export const BUSH_DETAILS: readonly Detail[] = ['ultra', 'high', 'mid', 'low'];
/**
 * Round 47: the hedge crowns gain an ultra LOD too (the walker passes the door row and the shelf
 * tier at arm's length). Camera A's bank crowns stand ≥ 5.8 m off (plants.ts hedge-shotA-bank),
 * so the ring stops short of them and every fixed camera keeps the high LOD.
 */
export const HEDGE_ULTRA_M = 5.5;
export const HEDGE_DETAILS: readonly Detail[] = ['ultra', 'high', 'mid', 'low'];
/** the bush variant (of three) built as the big-leaf shrub, and its mirror's index in the doubled set (plantgeo.ts withMirrors) */
export const BIG_LEAF_VARIANT = 2;
export const BIG_LEAF_VARIANTS: readonly [number, number] = [BIG_LEAF_VARIANT * 2, BIG_LEAF_VARIANT * 2 + 2];
/** the glossy upper-face roughness of the shrub laminae (materials.ts topRoughness; the weeds' hosta laminae use 0.55) */
export const SHRUB_TOP_ROUGHNESS = 0.42;

export interface ShrubStyle {
  /** crown height range (m at unit scale) */
  height: readonly [number, number];
  /** crown half-width range (m) */
  radius: readonly [number, number];
  /** lobe count range, the wander of their centres (share of the radius) and their size range (share of the radius) */
  lobes: readonly [number, number];
  lobeSpread: number;
  lobeSize: readonly [number, number];
  /** share of the height where the crown is widest */
  bulge: number;
  /** leaf shares per depth layer, outer first (sum 1) */
  layers: readonly number[];
  /** how far each layer sinks under the one outside it (share of the lobe radius) */
  layerStep: number;
  /** outer leaf length range (m) and width / length */
  leafLen: readonly [number, number];
  leafAspect: number;
  shape: LeafShape;
  /** leaf counts per LOD */
  leaves: Readonly<Record<Detail, number>>;
  /** bunches the outer layer grows in (0 = an even shell) */
  bunches: number;
  /** stems from the ground: count range and foot girth (m) */
  stems: readonly [number, number];
  stemGirth: number;
  /** escaping leaf sprays: count range and reach beyond the surface (share of the radius) */
  sprays: readonly [number, number];
  sprayReach: number;
  /** the core / innermost tone (× leaf) and the outer layer's sun share at the crown top */
  coreTone: number;
  sun: number;
  /** leaf-to-leaf tone spread on the outer layer (±) and how far a bunch fringe sinks toward the core tone */
  spread: number;
  fringe: number;
  /** the lit margin's leafSun share on the near LODs' two-tone laminae */
  twoTone: number;
  /** the near laminae carry the broad-lamina uv band (materials.ts: a hosta's venation) */
  broad: boolean;
  /** leaves rise from petioles at the crown centre rather than lying on the surface (the big-leaf shrub) */
  rosette: boolean;
}

/** the clipped hedge crown: tight lobes, small ovate leaves, four layers, a few stems at the skirt */
export const HEDGE_STYLE: ShrubStyle = {
  height: [1.15, 1.45],
  radius: [0.6, 0.72],
  lobes: [4, 5],
  lobeSpread: 0.3,
  lobeSize: [0.62, 0.86],
  bulge: 0.45,
  layers: [0.46, 0.28, 0.16, 0.1],
  layerStep: 0.1,
  leafLen: [0.075, 0.125],
  leafAspect: 0.66,
  shape: 'ovate',
  leaves: { ultra: 560, high: 460, mid: 210, low: 96 },
  bunches: 26,
  stems: [4, 6],
  stemGirth: 0.016,
  sprays: [5, 8],
  sprayReach: 0.16,
  coreTone: 0.42,
  sun: 0.6,
  spread: 0.14,
  fringe: 0.45,
  twoTone: 0.4,
  broad: false,
  rosette: false,
};

/** the loose leafy bush of the banks and ledges: fewer, looser lobes, bigger leaves, stems showing, sprays escaping */
export const BUSH_STYLE: ShrubStyle = {
  height: [0.95, 1.5],
  radius: [0.5, 0.72],
  lobes: [3, 4],
  lobeSpread: 0.42,
  lobeSize: [0.55, 0.85],
  bulge: 0.55,
  layers: [0.5, 0.3, 0.2],
  layerStep: 0.12,
  leafLen: [0.13, 0.21],
  leafAspect: 0.6,
  shape: 'ovate',
  leaves: { ultra: 420, high: 330, mid: 150, low: 70 },
  bunches: 18,
  stems: [5, 7],
  stemGirth: 0.02,
  sprays: [6, 9],
  sprayReach: 0.24,
  coreTone: 0.45,
  sun: 0.7,
  spread: 0.16,
  fringe: 0.4,
  twoTone: 0.45,
  broad: true,
  rosette: false,
};

/** ref-01's house shrub: a low mound of big round glossy laminae on arching petioles, two layers, a dark heart */
export const BIG_LEAF_STYLE: ShrubStyle = {
  height: [0.62, 0.9],
  radius: [0.55, 0.72],
  lobes: [3, 4],
  lobeSpread: 0.35,
  lobeSize: [0.6, 0.85],
  bulge: 0.6,
  layers: [0.62, 0.38],
  layerStep: 0.16,
  leafLen: [0.24, 0.34],
  leafAspect: 0.92,
  shape: 'round',
  leaves: { ultra: 120, high: 96, mid: 48, low: 26 },
  bunches: 0,
  stems: [0, 0],
  stemGirth: 0.012,
  sprays: [0, 0],
  sprayReach: 0,
  coreTone: 0.4,
  sun: 0.75,
  spread: 0.14,
  fringe: 0,
  twoTone: 0.5,
  broad: true,
  rosette: true,
};

interface Lobe {
  c: Vector3;
  r: Vector3;
}

/** a point on lobe `L`'s ellipsoid along the unit direction `d`, `k` × its radii; and the outward normal there */
function onLobe(L: Lobe, d: Vector3, k: number): { p: Vector3; n: Vector3 } {
  const p = V(L.c.x + d.x * L.r.x * k, L.c.y + d.y * L.r.y * k, L.c.z + d.z * L.r.z * k);
  const n = V(d.x / (L.r.x * L.r.x), d.y / (L.r.y * L.r.y), d.z / (L.r.z * L.r.z)).normalize();
  return { p, n };
}

/** a direction on the sphere biased to the upper hemisphere (the visible half; few leaves under the bulge) */
function crownDirection(rng: Rng, phiBias: number): Vector3 {
  const phi = Math.acos(1 - rng() * phiBias);
  const ang = rng() * TAU;
  return V(Math.cos(ang) * Math.sin(phi), Math.cos(phi), Math.sin(ang) * Math.sin(phi));
}

/**
 * Build one shrub crown. `detail` picks the leaf primitive and counts; the crown's height, lobes,
 * stems and bunch centres come first from the stream so every LOD agrees on them.
 */
export function shrubCrown(seed: string, pal: PlantPalette, detail: Detail, style: ShrubStyle): BufferGeometry {
  const rng = createRng(seed);
  const m = new MeshBuilder();
  const ultra = detail === 'ultra';
  const high = detail === 'high';
  const low = detail === 'low';
  const height = style.height[0] + rng() * (style.height[1] - style.height[0]);
  const radius = style.radius[0] + rng() * (style.radius[1] - style.radius[0]);
  const cy = height * style.bulge;
  // the lobes: the first is the crown's body, the rest wander off it
  const lobeCount = style.lobes[0] + rng.int(0, style.lobes[1] - style.lobes[0] + 1);
  const lobes: Lobe[] = [];
  for (let i = 0; i < lobeCount; i++) {
    const size = i === 0 ? 1 : style.lobeSize[0] + rng() * (style.lobeSize[1] - style.lobeSize[0]);
    const ang = rng() * TAU;
    const off = i === 0 ? 0 : style.lobeSpread * radius * (0.6 + 0.4 * rng());
    const rise = i === 0 ? 0 : (rng() - 0.35) * cy * 0.6;
    const rx = radius * size * (0.9 + rng() * 0.2);
    const rz = radius * size * (0.9 + rng() * 0.2);
    const ry = (height - cy) * size * (0.9 + rng() * 0.2);
    lobes.push({ c: V(Math.cos(ang) * off, cy + rise, Math.sin(ang) * off), r: V(rx, ry, rz) });
  }
  const shade = tone(pal.leaf, style.coreTone);
  const lit = blend(pal.leaf, pal.leafSun, 0.25);

  // the stems (drawn before the leaves so their draws never move a leaf): from the ground about
  // the base, leaning out and up into the crown, bark at the foot to green-brown young wood
  const stemFoot = tone(pal.bark, 0.92);
  const stemTop = blend(pal.bark, pal.leaf, 0.45);
  const stemAt = (t: number, up: number) => tone(blend(stemFoot, stemTop, Math.pow(t, 1.2)), 0.8 + 0.2 * (0.5 + 0.5 * up));
  const stemCount = style.stems[0] + rng.int(0, style.stems[1] - style.stems[0] + 1);
  for (let s = 0; s < stemCount; s++) {
    const ang = (s * TAU) / Math.max(1, stemCount) + (rng() - 0.5) * 0.7;
    const radial = V(Math.cos(ang), 0, Math.sin(ang));
    const lean = radius * (0.35 + rng() * 0.35);
    const top = cy * (0.9 + rng() * 0.5);
    const girth = style.stemGirth * (0.8 + rng() * 0.4);
    const curve = (t: number) => radial.clone().multiplyScalar(radius * 0.08 + lean * t * t).add(V(0, t * top, 0));
    if (!low) tube(m, sampleCurve(curve, ultra ? 5 : 3), girth, girth * 0.35, pal.bark, ultra ? 6 : high ? 4 : 3, false, stemAt);
    else tube(m, sampleCurve(curve, 2), girth, girth * 0.4, stemFoot, 3);
  }

  // the opaque cores: one low-poly ellipsoid per lobe at 0.74 of it, darkest at the bottom
  {
    const seg = ultra || high ? 10 : low ? 6 : 8;
    const rings = ultra || high ? 5 : low ? 3 : 4;
    for (const L of lobes) {
      const top = m.vertex(onLobe(L, V(0, 1, 0), 0.74).p, NOT_LAMINA + 0.5, 1, tone(shade, 1.3));
      const levels: number[][] = [];
      for (let r = 1; r <= rings; r++) {
        const phi = (r / rings) * Math.PI * 0.96;
        const level: number[] = [];
        for (let k = 0; k < seg; k++) {
          const ang = (k * TAU) / seg + (r % 2) * (Math.PI / seg);
          const d = V(Math.cos(ang) * Math.sin(phi), Math.cos(phi), Math.sin(ang) * Math.sin(phi));
          const c = blend(tone(shade, 1.3), tone(shade, 0.85), Math.min(1, (r / rings) * 1.3));
          level.push(m.vertex(onLobe(L, d, 0.74 * (0.96 + 0.08 * rng())).p, NOT_LAMINA + k / seg, 1 - r / rings, c));
        }
        levels.push(level);
      }
      for (let k = 0; k < seg; k++) m.tri(top, levels[0][(k + 1) % seg], levels[0][k]);
      for (let r = 0; r < rings - 1; r++) {
        for (let k = 0; k < seg; k++) {
          const n = (k + 1) % seg;
          m.tri(levels[r][k], levels[r][n], levels[r + 1][k]);
          m.tri(levels[r][n], levels[r + 1][n], levels[r + 1][k]);
        }
      }
    }
  }

  /** one leaf of layer `layer` on lobe `L` along `d`, at radius factor `k`; `depth` 0 = bunch top … 1 = sunk fringe */
  const leaf = (L: Lobe, d: Vector3, k: number, layer: number, depth: number, lenMul: number, spray = false) => {
    const { p, n } = onLobe(L, d, k);
    const len = (style.leafLen[0] + rng() * (style.leafLen[1] - style.leafLen[0])) * lenMul * (low ? 1.45 : 1);
    const width = len * style.leafAspect * (0.85 + rng() * 0.3);
    let base: Vector3;
    let dir: Vector3;
    let planeNormal: Vector3;
    if (style.rosette) {
      // the big-leaf shrub: the lamina rises from a petiole at the lobe's heart and turns its
      // face to the sky at the surface — a hosta's mound of overlapping round leaves
      const heart = L.c.clone().add(V(0, -L.r.y * 0.6, 0));
      const knee = heart.clone().lerp(p, 0.55 + 0.25 * rng());
      if (!low) tube(m, [heart.clone().lerp(knee, 0.35), knee], 0.004 * (ultra ? 1 : 1.3), 0.0028, blend(stemTop, lit, 0.4), ultra ? 4 : 3);
      dir = p.clone().sub(knee).normalize().add(V(0, -0.25 + 0.3 * rng(), 0)).normalize();
      base = knee;
      planeNormal = n.clone().lerp(V(0, 1, 0), 0.55).normalize();
    } else {
      // the blade lies on the surface (its plane normal the outward direction), points up the
      // crown with a random yaw and its tip flares out — the outer layers flare more
      const tangent = n.y > 0.97 ? V(Math.cos(rng() * TAU), 0, Math.sin(rng() * TAU)) : V(0, 1, 0).addScaledVector(n, -n.y).normalize();
      dir = tangent
        .applyAxisAngle(n, (rng() - 0.5) * 2.6)
        .addScaledVector(n, (spray ? 0.7 : 0.3 + 0.35 * (1 - layer / Math.max(1, style.layers.length - 1))) + rng() * 0.35)
        .normalize();
      base = p.clone().addScaledVector(dir, -len * 0.55);
      planeNormal = n;
    }
    // colour: the outer layer lit by its exposure (the crown top toward leafSun, the skirt in
    // shade), every layer inward sunk toward the core tone, the bunch fringes sunk further; the
    // leaf-to-leaf spread stays inside ± `spread` on the outer layer so the high LOD's mass reads
    // as the frames' soft dark blur from the fixed cameras (round 35), the near LOD's two-tone
    // laminae carry the leaf-scale contrast
    const sun = Math.min(1, Math.max(0, n.y * 0.8 + 0.2));
    const exposed = blend(lit, pal.leafSun, sun * style.sun * (spray ? 1.1 : 1));
    const inward = Math.min(1, layer * 0.36 + depth * style.fringe);
    let color = blend(tone(exposed, 1 - style.spread + rng() * 2 * style.spread), shade, inward);
    if (style.broad && (ultra || high)) {
      // older leaves yellow-olive, fresh ones blue-green (a mound a metre out is not one green)
      const age = rng() * 2 - 1;
      const kk = 0.08 * Math.abs(age);
      color = age > 0 ? [color[0] * (1 + kk), color[1] * (1 + kk * 0.4), color[2] * (1 - kk)] : [color[0] * (1 - kk), color[1] * (1 + kk * 0.2), color[2] * (1 + kk)];
    }
    const tipColor = tone(blend(color, pal.leafSun, 0.35 * (1 - inward)), 1.08);
    const curl = 0.1 + rng() * 0.16;
    const twist = (rng() - 0.5) * 0.7;
    if (low) {
      foldedLeaf(m, base, dir, len, width, color, { curl, twist, ridge: 0.1, planeNormal, tipColor });
      return;
    }
    if (ultra || (high && style.rosette)) {
      // the near lamina: a shaped blade with a midrib fold (the margins rise, the rib sinks) and a
      // two-tone lamina — deep along the rib, lit at the margin and the tip
      const ribTone = tone(color, 0.78);
      const marginTone = blend(color, pal.leafSun, style.twoTone * (1 - inward * 0.7));
      const colorAt = (t: number, s: number, row: RGB): RGB => {
        const outward = Math.abs(s) * 0.7 + t * 0.3;
        return blend(blend(ribTone, marginTone, outward * outward), row, 0.2);
      };
      const big = style.rosette;
      shapedLeaf(m, base, dir, len, width, color, {
        shape: style.shape,
        sections: ultra ? (big ? 5 : 3) : 3,
        across: ultra && big ? 5 : 3,
        curl,
        twist,
        ridge: -0.16,
        cup: 0.28 + rng() * 0.2,
        wave: ultra ? 0.04 : 0,
        serration: big ? 0 : 0.05,
        planeNormal,
        colorAt,
        tipColor,
        uOffset: style.broad ? BROADLEAF_U : 0,
      });
      return;
    }
    curvedLeaf(m, base, dir, len, width, color, { curl, twist, ridge: 0.12, planeNormal, tipColor });
  };

  // the leaf layers over every lobe: leaves per lobe by its surface share; the outer layer in
  // bunches (proud cores, sunk fringes), the inner layers even
  const count = style.leaves[detail];
  const area = lobes.map((L) => L.r.x * L.r.z + L.r.y * (L.r.x + L.r.z) * 0.5);
  const areaSum = area.reduce((a, b) => a + b, 0);
  const phiBias = style.rosette ? 1.15 : 1.6;
  for (let li = 0; li < lobes.length; li++) {
    const L = lobes[li];
    const share = area[li] / areaSum;
    for (let layer = 0; layer < style.layers.length; layer++) {
      const nLeaves = Math.round(count * share * style.layers[layer]);
      const k0 = 1.03 - style.layerStep * layer;
      if (layer === 0 && style.bunches > 0 && !low) {
        const bunches = Math.max(1, Math.round(style.bunches * share));
        const per = Math.max(1, Math.round(nLeaves / bunches));
        for (let b = 0; b < bunches; b++) {
          const centre = crownDirection(rng, phiBias);
          const spreadA = 0.22 + rng() * 0.14;
          for (let l = 0; l < per; l++) {
            const u = rng() + rng() - 1;
            const v = rng() + rng() - 1;
            const depth = Math.min(1, Math.hypot(u, v) / 1.2);
            const d = centre.clone().add(V(u * spreadA, (rng() - 0.5) * spreadA * 0.6, v * spreadA)).normalize();
            if (d.y < -0.35) d.y = -0.35 + (rng() * 0.1);
            leaf(L, d.normalize(), k0 + 0.05 - 0.13 * depth, layer, depth, 1);
          }
        }
      } else {
        for (let l = 0; l < nLeaves; l++) leaf(L, crownDirection(rng, phiBias), k0 * (0.97 + 0.06 * rng()), layer, layer === 0 ? 0.5 : 0, layer === 0 ? 1 : 0.9);
      }
    }
  }

  // the sprays: twigs from inside the crown out past the surface, 3–5 lit leaves along their end
  const sprayCount = low ? 0 : style.sprays[0] + rng.int(0, style.sprays[1] - style.sprays[0] + 1);
  for (let s = 0; s < sprayCount; s++) {
    const L = lobes[rng.int(0, lobes.length)];
    const d = crownDirection(rng, 1.3);
    const from = onLobe(L, d, 0.5).p;
    const to = onLobe(L, d, 1 + style.sprayReach * (0.6 + 0.8 * rng())).p;
    const twig = (u: number) => from.clone().lerp(to, u).add(V(0, Math.sin(u * Math.PI) * 0.03, 0));
    tube(m, sampleCurve(twig, ultra ? 4 : 2), 0.006, 0.002, tone(pal.bark, 1.15), ultra ? 4 : 3, false, (t, up) => tone(blend(stemTop, tone(stemTop, 1.1), t), 0.82 + 0.18 * (0.5 + 0.5 * up)));
    const leaves = ultra || high ? 4 : 3;
    for (let l = 0; l < leaves; l++) {
      const u = 0.55 + (l / (leaves - 1)) * 0.45;
      const at = twig(u);
      const dd = at.clone().sub(L.c);
      dd.x /= L.r.x;
      dd.y /= L.r.y;
      dd.z /= L.r.z;
      const kk = dd.length();
      leaf(L, dd.normalize(), kk, 0, 0, 0.85 + 0.2 * rng(), true);
    }
  }
  return m.finish({ groundToZero: true });
}

/** the clipped hedge crown (plants.ts `hedge`): proportions as the round-14 crown (1.15–1.45 m tall, ≈ 1.3 m across), so every scatter's `top / hedgeHeight` scaling holds */
export function hedgeGeometry(seed: string, pal: PlantPalette, detail: Detail): BufferGeometry {
  return shrubCrown(seed, pal, detail, HEDGE_STYLE);
}

/** the bushes (plants.ts `bushes`): variant BIG_LEAF_VARIANT is the house's big-leaf shrub, the others the leafy bank bush */
export function bushGeometry(seed: string, pal: PlantPalette, detail: Detail, variant = 0): BufferGeometry {
  return shrubCrown(seed, pal, detail, variant === BIG_LEAF_VARIANT ? BIG_LEAF_STYLE : BUSH_STYLE);
}
