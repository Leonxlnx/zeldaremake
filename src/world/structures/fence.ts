/**
 * Post-and-rail fences along the plateau edge: posts every ~1.8 m seated on the terrain with
 * per-post jitter and lean, two slightly bowed rails between neighbours, all one mesh per run.
 */
import { CatmullRomCurve3, Mesh, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { merge, sweepTube } from './geometry';
import type { StructureMaterials } from './materials';

export interface FenceBuild {
  mesh: Mesh;
  posts: number;
  bases: [number, number, number][];
}

export function buildFence(def: { id: string; points: readonly (readonly [number, number, number])[] }, ctx: WorldContext, mats: StructureMaterials, rng: Rng): FenceBuild {
  const terrain = ctx.terrain;
  const parts = [];
  const bases: [number, number, number][] = [];
  const spacing = 1.8;
  const postH = 1.1;
  const railHeights = [0.5, 0.92];
  // silvered, weathered wood: dark enough to silhouette against the haze at the plateau lip
  // (reference F: dark posts along y ≈ 0.19; reference A: the same posts hazed pale at 25 m)
  const postShade = () => 0.42 + rng() * 0.22;

  // resample the polyline at ~spacing
  const pts: Vector3[] = [];
  for (let i = 0; i < def.points.length - 1; i++) {
    const a = new Vector3(def.points[i][0], 0, def.points[i][2]);
    const b = new Vector3(def.points[i + 1][0], 0, def.points[i + 1][2]);
    const len = a.distanceTo(b);
    const n = Math.max(1, Math.round(len / spacing));
    for (let j = 0; j < n; j++) pts.push(a.clone().lerp(b, j / n));
    if (i === def.points.length - 2) pts.push(b.clone());
  }

  const tops: Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    p.x += (rng() - 0.5) * 0.08;
    p.z += (rng() - 0.5) * 0.08;
    const gy = terrain.height(p.x, p.z);
    const lean = new Vector3((rng() - 0.5) * 0.09, 0, (rng() - 0.5) * 0.09);
    const h = postH * (0.94 + rng() * 0.12);
    const bottom = new Vector3(p.x - lean.x * 0.3, gy - 0.32, p.z - lean.z * 0.3);
    const ground = new Vector3(p.x, gy, p.z);
    const top = new Vector3(p.x + lean.x * h, gy + h, p.z + lean.z * h);
    const shade = postShade();
    const grey = rng() * 0.12;
    const post = sweepTube(new CatmullRomCurve3([bottom, ground, top]), {
      // ≥ 0.16 m thick at the ground so a post still covers a few pixels at 20–25 m
      radius: (t) => 0.095 - 0.028 * t,
      tubularSegments: 6,
      radialSegments: 10,
      uvMetres: 0.8,
      displace: (t, ang) => Math.sin(ang * 4 + i) * 0.006 + Math.sin(ang * 7 + t * 9) * 0.004,
      // greyer, darker toward the ground where the wood stays damp
      color: (t) => [(shade + grey * 0.3) * (0.8 + 0.2 * t), (shade * 0.95 + grey * 0.35) * (0.8 + 0.2 * t), (shade * 0.86 + grey * 0.5) * (0.8 + 0.2 * t)],
      capEnd: true,
    });
    parts.push(post);
    tops.push(top);
    bases.push([ground.x, ground.y, ground.z]);
  }

  // rails: bowed tubes between neighbouring posts, at jittered heights
  for (let i = 0; i < tops.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ga = terrain.height(a.x, a.z);
    const gb = terrain.height(b.x, b.z);
    const dir = new Vector3(b.x - a.x, 0, b.z - a.z);
    const len = dir.length();
    dir.normalize();
    const side = new Vector3(dir.z, 0, -dir.x);
    for (const rh of railHeights) {
      const ya = ga + rh * (0.95 + rng() * 0.1);
      const yb = gb + rh * (0.95 + rng() * 0.1);
      const sag = 0.02 + rng() * 0.04;
      const bow = (rng() - 0.5) * 0.06;
      const p0 = new Vector3(a.x - dir.x * 0.06, ya, a.z - dir.z * 0.06);
      const p2 = new Vector3(b.x + dir.x * 0.06, yb, b.z + dir.z * 0.06);
      const p1 = p0.clone().lerp(p2, 0.5).addScaledVector(side, bow);
      p1.y -= sag;
      const shade = postShade() + 0.08;
      const rail = sweepTube(new CatmullRomCurve3([p0, p1, p2]), {
        radius: (t) => 0.056 * (1 + 0.15 * Math.sin(t * Math.PI * 1.7 + i)),
        tubularSegments: Math.max(4, Math.round(len * 3)),
        radialSegments: 8,
        uvMetres: 0.8,
        color: () => [shade, shade * 0.94, shade * 0.84],
        capEnd: true,
        capStart: true,
      });
      parts.push(rail);
    }
  }

  const mesh = new Mesh(merge(parts), mats.fenceWood);
  mesh.name = `fence-${def.id}`;
  mesh.castShadow = mesh.receiveShadow = true;
  return { mesh, posts: tops.length, bases };
}
