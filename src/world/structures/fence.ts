/**
 * Fences. Two styles:
 *  - 'rail' (plateau lip, layout.fences): weathered post-and-rail — posts every ~1.8 m seated on
 *    the terrain with per-post jitter and lean, two slightly bowed wooden rails between neighbours.
 *  - 'rope' (concept sheets 02/04 "Path & surroundings", `ROPE_FENCES`): rough bark log posts
 *    (r 0.07–0.1 m, 1.0–1.2 m tall, leaning a little) with two sagging vine-rope rails lashed to
 *    them, along the plaza's west bank foot and the stair-side bank.
 * Each run is one mesh per material.
 */
import { CatmullRomCurve3, Color, type Material, Mesh, MeshStandardMaterial, TorusGeometry, Vector3 } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D } from '../util/noise';
import { merge, setColorAttribute, sweepTube } from './geometry';
import type { StructureMaterials } from './materials';

export interface FenceDef {
  id: string;
  points: readonly (readonly [number, number, number])[];
  style?: 'rail' | 'rope';
}

export interface FenceBuild {
  meshes: Mesh[];
  posts: number;
  bases: [number, number, number][];
}

/**
 * Rope fences off the paving (the layout's `fences` are the plateau-lip rails). Placed against the
 * fixed cameras (gauntlet/tmp/proj.mjs): the plaza-west run projects outside A/B/D/E/F and off C's
 * right edge (x ≥ 1.09); the stair-bank run sits outside A (x ≥ 1.08), in F at (0.74–0.82,
 * 0.54–0.67) right of the kid spot (0.72, 0.67), and in C at (0.22–0.31, 0.49–0.58) behind the
 * stair-foot rock — clear of the stair foot (C 0.10–0.20, 0.60–0.66). Both keep ≥ 1 m from the
 * npc spots (kokiri-b (−6.5, −2): the west run starts at z = −0.9; kokiri-a (9.0, 3.6): the bank
 * run starts 1.4 m away).
 */
export const ROPE_FENCES: FenceDef[] = [
  // foot of the west bank, ~0.5 m off the plaza rim (paving ends at x ≈ −6 at z = 0)
  { id: 'plaza-west', style: 'rope', points: [[-6.6, 0, -0.9], [-6.75, 0, 1.3], [-6.3, 0, 2.7], [-5.9, 0, 3.9]] },
  // stair-side bank south of the stair foot, east of the stair-foot rock
  { id: 'stair-bank', style: 'rope', points: [[9.5, 0, 4.9], [10.3, 0, 4.2], [11.0, 0, 3.6]] },
];

/** Twisted vine rope (rails, lashings, lantern-post bindings). Owned by the structures system. */
export function createRopeMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(0x8d7d5e), roughness: 1, vertexColors: true });
}

export function buildFence(def: FenceDef, ctx: WorldContext, mats: StructureMaterials, rng: Rng, rope?: Material): FenceBuild {
  const terrain = ctx.terrain;
  const style = def.style ?? 'rail';
  const noise = new Noise2D(`${ctx.config.seed}/structures/fence/${def.id}`);
  const postParts = [];
  const ropeParts = [];
  const bases: [number, number, number][] = [];
  const spacing = style === 'rope' ? 1.5 : 1.8;
  const postH = style === 'rope' ? 1.1 : 1.1;
  const railHeights = style === 'rope' ? [0.42, 0.82] : [0.5, 0.92];
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
  const heights: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    p.x += (rng() - 0.5) * 0.08;
    p.z += (rng() - 0.5) * 0.08;
    const gy = terrain.height(p.x, p.z);
    const leanAmt = style === 'rope' ? 0.16 : 0.09;
    const lean = new Vector3((rng() - 0.5) * leanAmt, 0, (rng() - 0.5) * leanAmt);
    const h = postH * (style === 'rope' ? 0.92 + rng() * 0.18 : 0.94 + rng() * 0.12);
    const bottom = new Vector3(p.x - lean.x * 0.3, gy - 0.32, p.z - lean.z * 0.3);
    const ground = new Vector3(p.x, gy, p.z);
    const top = new Vector3(p.x + lean.x * h, gy + h, p.z + lean.z * h);
    const shade = postShade();
    const grey = rng() * 0.12;
    const post =
      style === 'rope'
        ? sweepTube(new CatmullRomCurve3([bottom, ground, top.clone().lerp(ground, 0.45), top]), {
            // a rough log: r 0.09 at the ground tapering to 0.065, bark cords and a knobbly top
            radius: (t) => (0.092 - 0.027 * t) * (1 + 0.05 * Math.sin(t * 7 + i)),
            tubularSegments: 8,
            radialSegments: 10,
            uvMetres: 0.7,
            displace: (t, ang) => (noise.ridged(ang * 1.3 + i * 2.1, t * 3, 2) - 0.5) * 0.02 + Math.sin(ang * 5 + i) * 0.004,
            // damp dark bark near the ground, greyer and lighter up the post; the trunk's bark map
            color: (t, ang) => {
              const d = (0.5 + 0.35 * t) * (0.9 + 0.2 * Math.max(0, Math.sin(ang)));
              return [d, d * 0.92, d * 0.84];
            },
            capEnd: true,
          })
        : sweepTube(new CatmullRomCurve3([bottom, ground, top]), {
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
    postParts.push(post);
    tops.push(top);
    heights.push(h);
    bases.push([ground.x, ground.y, ground.z]);
  }

  /** point on post i at fraction f of its height (posts lean, so the rail ends follow them) */
  const onPost = (i: number, f: number) => {
    const g = new Vector3(pts[i].x, terrain.height(pts[i].x, pts[i].z), pts[i].z);
    return g.lerp(tops[i], f);
  };

  if (style === 'rope') {
    // vine ropes: sag between posts, twisted, lashed round each post with a few turns
    const ropeR = 0.022;
    const ropeTint = (): [number, number, number] => {
      const s = 0.8 + rng() * 0.3;
      return [s, s * 0.96, s * 0.9];
    };
    for (let i = 0; i < tops.length - 1; i++) {
      for (const rh of railHeights) {
        const fa = (rh / postH) * (0.97 + rng() * 0.06);
        const fb = (rh / postH) * (0.97 + rng() * 0.06);
        const p0 = onPost(i, fa);
        const p2 = onPost(i + 1, fb);
        const len = p0.distanceTo(p2);
        const sag = 0.06 + rng() * 0.07;
        const p1 = p0.clone().lerp(p2, 0.5);
        p1.y -= sag;
        const twist = rng() * 10;
        const tint = ropeTint();
        ropeParts.push(
          sweepTube(new CatmullRomCurve3([p0, p1, p2]), {
            radius: () => ropeR,
            tubularSegments: Math.max(6, Math.round(len * 6)),
            radialSegments: 7,
            uvMetres: 0.3,
            // twisted strands: two ridges spiralling along the rope
            displace: (t, ang) => 0.005 * Math.sin(ang * 2 + t * len * 34 + twist),
            color: (t, ang) => {
              const s = 0.85 + 0.15 * Math.sin(ang * 2 + t * len * 34 + twist);
              return [tint[0] * s, tint[1] * s, tint[2] * s];
            },
          }),
        );
      }
    }
    // lashings: three turns of rope round each post at each rail height
    for (let i = 0; i < tops.length; i++) {
      for (const rh of railHeights) {
        const f = rh / postH;
        const c = onPost(i, f);
        const tint = ropeTint();
        for (let turn = -1; turn <= 1; turn++) {
          const ring = new TorusGeometry(0.092 - 0.027 * f + 0.02, 0.016, 5, 14);
          ring.rotateX(Math.PI / 2);
          ring.translate(c.x, c.y + turn * 0.034, c.z);
          setColorAttribute(ring, [tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9]);
          ropeParts.push(ring);
        }
      }
    }
  } else {
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
        postParts.push(rail);
      }
    }
  }

  const meshes: Mesh[] = [];
  const postMesh = new Mesh(merge(postParts), style === 'rope' ? mats.bark : mats.fenceWood);
  postMesh.name = `fence-${def.id}`;
  postMesh.castShadow = postMesh.receiveShadow = true;
  meshes.push(postMesh);
  if (ropeParts.length) {
    const ropeMesh = new Mesh(merge(ropeParts), rope ?? createRopeMaterial());
    ropeMesh.name = `fence-${def.id}-rope`;
    ropeMesh.castShadow = ropeMesh.receiveShadow = true;
    meshes.push(ropeMesh);
  }
  return { meshes, posts: tops.length, bases };
}
