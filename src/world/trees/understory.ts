/**
 * Understory trees (fable-4, round 53 — the owner's 2026-09-23 "the trees do not populate"): small and
 * medium trees with round, dense, leafy crowns and brown trunks, the layer the reference
 * (review46 r_020–r_028) shows at every depth beside the path and that the clearing lacked between
 * the tall white-barks and the giants. 4.5–9 m tall, a 1.8–4 m crown radius, three LODs through the
 * same laminae machinery as the white-barks (writer.ts addLeaf keeps a stable subset and widens it).
 * Seeded per variant; no placement draws happen here.
 */
import { Color, Vector3 } from 'three';
import { createRng, type Rng } from '../util/prng';
import { smoothstep } from '../util/noise';
import { GeometryWriter, TAU, UP, addLeaf, between, growthPath, mergeParts, sample, tangent, taper, tube, type Detail } from './writer';
import type { Palette, TreeAsset } from './whitebark';

export interface UnderstoryParams {
  seed: string;
  /** trunk top (crown apex) above the ground, m */
  height: number;
  trunkRadius: number;
  /** crown radius, m (the crown is an ellipsoid slightly flatter than a sphere) */
  crownRadius: number;
  /** lean of the stem, degrees, and its azimuth */
  leanDeg: number;
  leanAzimuth: number;
  /** relative laminae count */
  leafDensity: number;
  /** how many limbs leave the stem into the crown */
  limbs: number;
  /** 0 = olive-dark crown, 1 = warm-lit crown */
  warmth: number;
}

export function understoryParams(rng: Rng, index: number, total: number): UnderstoryParams {
  const r = rng.fork(`understory-${index}`);
  // spread the sizes across the variants so a stand mixes small and medium trees
  const f = total > 1 ? index / (total - 1) : 0.5;
  const height = 4.5 + f * 4.0 + r.range(-0.3, 0.3);
  return {
    seed: `us${index}-${Math.floor(r() * 1e9)}`,
    height,
    trunkRadius: 0.11 + height * 0.016 + r.range(-0.01, 0.015),
    crownRadius: height * r.range(0.38, 0.47),
    leanDeg: r.range(1.5, 7),
    leanAzimuth: r() * TAU,
    leafDensity: r.range(0.9, 1.15),
    limbs: r.int(4, 7),
    warmth: r(),
  };
}

export function createUnderstoryTree(p: UnderstoryParams, palette: Palette, detail: Detail): TreeAsset {
  const rng = createRng(`understory/${p.seed}`);
  const bt = (a: number, b: number) => between(rng, a, b);
  const wood = new GeometryWriter(detail);
  const leaves = new GeometryWriter(detail);
  const H = p.height;
  const R = p.trunkRadius;
  const CR = p.crownRadius;
  const dark = new Color(palette.barkDark);
  const grey = new Color(palette.barkGrey);
  const canopy = new Color(palette.leafCanopy);
  const sunny = new Color(palette.leafSun);
  // a warm brown bark: the deep tone at the foot, the grey-brown up the stem
  const bark = (pt: Vector3) => dark.clone().lerp(grey, 0.35 + 0.4 * smoothstep(0.2, H * 0.6, pt.y)).multiplyScalar(0.92);

  // ---------- stem ----------
  const stemTop = H - CR * 0.55; // the stem ends inside the crown
  const lean = Math.tan((p.leanDeg * Math.PI) / 180) * stemTop;
  const target = new Vector3(Math.cos(p.leanAzimuth) * lean, stemTop, Math.sin(p.leanAzimuth) * lean);
  const stem = growthPath(new Vector3(0, -0.3, 0), target, UP, rng, 12, 0.3);
  const stemRadii = taper(stem, R, 0.06, 1.15).map((r, i) => (i === 0 ? r * 1.35 : r));
  tube(wood, stem, stemRadii, detail === 'high' ? 10 : 7, rng, {
    color: bark,
    roughness: 0.12,
    barkTile: 1.1,
    isTrunk: true,
    structural: true,
    creviceShade: 0.35,
  });

  // ---------- limbs into the crown ----------
  const crownCenter = new Vector3(target.x * 0.9, H - CR * 0.85, target.z * 0.9);
  const limbPhase = rng() * TAU;
  for (let i = 0; i < p.limbs; i++) {
    const t0 = bt(0.55, 0.88);
    const origin = sample(stem, t0);
    const angle = limbPhase + (i / p.limbs) * TAU + bt(-0.35, 0.35);
    const reach = CR * bt(0.55, 0.85);
    const tip = new Vector3(crownCenter.x + Math.cos(angle) * reach, crownCenter.y + bt(-0.2, 0.55) * CR, crownCenter.z + Math.sin(angle) * reach);
    const path = growthPath(origin, tip, tangent(stem, t0), rng, 6, 0.5);
    const radii = taper(path, R * bt(0.3, 0.45), 0.012, 1.2);
    tube(wood, path, radii, detail === 'high' ? 6 : 4, rng, { color: bark, roughness: 0.08, barkTile: 0.8, structural: i < 3 });
  }

  // ---------- the crown: laminae on an ellipsoid shell with an inner fill ----------
  // Round 54 (fable-4, squad2's lodcheck): the medium LOD keeps EVERY lamina at its size. On the
  // writer's default (one in 4 at 1.8 ×) these crowns were the owner's "trees only get detailed when
  // I come up close" at his north and west poses — 64–74 % of the pixels that differ between the
  // shipped rungs and every tree forced high are understory stems at 28–44 m, whose leaves
  // quadrupled and shrank at the 28 m rung. Every leaf at medium reads as the high LOD (same size,
  // count and tone; the swap is the wood's sides only) for +34 K / +20 K triangles at those poses,
  // where the rung at 40.6 m costs +163 K / +495 K. The low LOD keeps the default 1 in 8 at 2.6 ×
  // past 44 m (art/environment/round54-understory-medium).
  const leafOpts = { widthRatio: 0.62, wideFirst: 0.55, wideSecond: 0.3, stiffness: 0.35, flutter: 0.05, mediumEvery: 1, mediumScale: 1 };
  // Round 53 follow-up (a walker passes these at 2–4 m): twice the laminae at two thirds the size —
  // the same covered area (count × size² ≈ 0.95 of before), leaves that read as leaves instead of
  // 0.45 m cards at arm's length. Distance LODs keep their coverage through addLeaf's retention.
  const shellCount = Math.round(CR * CR * 72 * p.leafDensity);
  const fillCount = Math.round(shellCount * 0.32);
  const total = shellCount + fillCount;
  const golden = 2.399963229728653;
  const leafSize = 0.2 + CR * 0.038;
  const warm = sunny.clone().lerp(canopy, 0.35 - 0.2 * p.warmth);
  for (let j = 0; j < total; j++) {
    const shell = j < shellCount;
    // a golden spiral over the sphere, the lowest 30 % left open so the crown has an underside
    const u = shell ? 0.3 + 0.7 * ((j + 0.5) / shellCount) : bt(0.2, 0.95);
    const yN = u * 2 - 1;
    const rN = Math.sqrt(Math.max(0, 1 - yN * yN));
    const ang = j * golden + bt(-0.15, 0.15);
    const radial = shell ? bt(0.86, 1.04) : bt(0.3, 0.72);
    const base = new Vector3(crownCenter.x + Math.cos(ang) * rN * CR * radial, crownCenter.y + yN * CR * 0.82 * radial, crownCenter.z + Math.sin(ang) * rN * CR * radial);
    const outward = base.clone().sub(crownCenter).normalize();
    const direction = outward
      .multiplyScalar(bt(0.6, 1))
      .addScaledVector(UP, bt(-0.45, 0.15))
      .add(new Vector3(bt(-0.25, 0.25), 0, bt(-0.25, 0.25)))
      .normalize();
    // tone: the lit rim and top toward the sunny palette, the core and underside toward the deep canopy
    const top = 0.5 + 0.5 * yN;
    const rim = shell ? 1 : 0.45;
    const sunF = Math.min(1, Math.max(0, (top * 0.7 + rim * 0.5 - 0.35) * bt(0.6, 1.1)));
    const color = canopy.clone().lerp(warm, sunF).multiplyScalar(shell ? 1 : 0.8);
    // the shade fill share per leaf (writer.ts aRoot.w): the core keeps the shade, the rim reads lit
    leaves.leafShade = (shell ? 0.75 + 0.25 * top : 0.55) * bt(0.85, 1.15);
    addLeaf(leaves, base, direction, leafSize * bt(0.85, 1.2), color, rng, leafOpts);
  }
  leaves.leafShade = 1;

  const geometry = mergeParts(`understory-${p.seed}-${detail}`, [wood.finish('wood'), leaves.finish('leaves')]);
  return {
    geometry,
    leafCount: leaves.leafCount,
    woodTriangles: wood.triangles,
    leafTriangles: leaves.triangles,
    height: H,
    radius: CR,
  };
}

