/**
 * Fences. Two styles:
 *  - 'rail' (plateau lip, layout.fences): weathered post-and-rail — posts every ~1.8 m seated on
 *    the terrain with per-post jitter and lean, two slightly bowed wooden rails between neighbours.
 *  - 'rope' (concept sheets 02/04 "Path & surroundings", `ROPE_FENCES`): rough bark log posts
 *    (r 0.07–0.1 m, 1.0–1.2 m tall, leaning a little) with two sagging vine-rope rails lashed to
 *    them, along the plaza's west bank foot and the stair-side bank.
 * Each run is one mesh per material.
 *
 * Round 41 (structures-26): readable at 2 m. Rail posts carry long grain (± 4 mm, grain lines
 * darker, ridges silvered), a CHECKED top (end-grain disc with drying cracks, woodGrain.ts) and
 * a damp, mossy foot; the rails take the same grain. Rope posts get a second, finer cord octave
 * with grime in the furrows and a split top. The vine ropes are THREE-STRAND: the twist is a
 * sharp three-lobe profile (± 4 mm on a 2.2 cm rope) at 2.5 cm sampling with fine fibre lines
 * in the tint, and the lashings are continuous 2½-turn helices of the same rope instead of
 * three stacked tori. Cushion moss tufts sit round every post foot (mossTufts.ts) in the
 * cap-moss material with castShadow off, so they fold into the roof-tuft bucket (no new draw).
 */
import { CatmullRomCurve3, Color, type Material, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import type { WorldContext } from '../system';
import type { FenceDef } from '../layout';
import type { Rng } from '../util/prng';
import { Noise2D, lerp, smoothstep } from '../util/noise';
import { merge, sweepTube, TAU } from './geometry';
import { Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts, type MossTuftSpec } from './mossTufts';
import { checkedCap, endFrame, footMoss, woodFibre, woodGrain } from './woodGrain';

export interface FenceBuild {
  meshes: Mesh[];
  posts: number;
  bases: [number, number, number][];
  /** round 41 audit */
  detail41: { postTriangles: number; ropeTriangles: number; footTufts: number; lashings: number; mortises: number };
}

/**
 * Three-strand rope profile: the radial offset of a laid rope's surface at angle `ang` round it
 * and phase `phase` along it — three lobes, sharp in the grooves, ± `depth`.
 */
function strandProfile(ang: number, phase: number, depth: number): number {
  const s = Math.sin(3 * ang + phase);
  // sharpen the grooves: a laid rope's lobes are round, its grooves narrow
  return depth * (Math.sign(s) * Math.pow(Math.abs(s), 0.7));
}

/** rope tint: pale straw with the strands' shading and fine fibre lines */
function ropeColor(tint: [number, number, number], ang: number, phase: number, fibre: number): [number, number, number] {
  const s = 0.82 + 0.18 * Math.sin(3 * ang + phase);
  const f = 0.94 + 0.12 * fibre;
  return [tint[0] * s * f, tint[1] * s * f, tint[2] * s * f];
}

/** a laid rope swept along `curve` (rails and lashings share this) */
function ropeTube(curve: CatmullRomCurve3, ropeR: number, twist: number, tint: [number, number, number], noise: Noise2D, seed: number): BufferGeometry {
  const len = curve.getLength();
  // twist pitch: one full turn of the lay every ≈ 4 rope diameters
  const pitch = TAU / (ropeR * 8);
  return sweepTube(curve, {
    radius: () => ropeR,
    tubularSegments: Math.max(8, Math.round(len / 0.03)),
    radialSegments: 8,
    uvMetres: 0.3,
    displace: (t, ang) => strandProfile(ang, t * len * pitch + twist, ropeR * 0.2) + 0.0008 * Math.sin(ang * 9 - t * len * pitch * 3 + seed),
    color: (t, ang) => ropeColor(tint, ang, t * len * pitch + twist, 0.5 + 0.5 * noise.noise(ang * 1.5 + seed, t * len * 40)),
  });
}

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
  // (reference F: dark posts along y ≈ 0.19; reference A: the same posts hazed pale at 25 m).
  // Round 44 (structures-28): 0.42–0.64 → 0.6–0.9. The rail wood's diffuse albedo was ≈ 0.005
  // linear (weathered_planks colour map mean 0.06 × the 0x8e8272 tint 0.23 × this shade): at 2 m
  // the shaft rendered lum 0.06 with the ×0.48–1.28 grain inside three grey levels, and no shade
  // floor could lift a surface that dark (survey-1 crops 19/20, sn-fence-post). With the tint at
  // 0xc8bba8 the shaded albedo is ≈ 0.015; F's 25 m posts sit under a 0.9 veil and keep their
  // dark silhouette. (Rail style only: the rope posts colour themselves.)
  const postShade = () => 0.6 + rng() * 0.3;

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
  // round 41: the close-scale detail's own streams (forked: the posts' jitter / lean / shade draws are unchanged)
  const detailRng = rng.fork('detail41');
  const tuftNoise = new Noise3D(detailRng.fork('tuft-noise'));
  const tuftSpecs: MossTuftSpec[] = [];
  let postTriangles = 0;
  const tri = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
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
    const postRng = detailRng.fork(`post/${i}`);
    const postLen = h + 0.32;
    /** metres above the ground along the sweep */
    const above = (t: number) => t * postLen - 0.32;
    const topFade = (t: number) => 1 - smoothstep(0.96, 1, t);
    const segs = { tubular: style === 'rope' ? 16 : 14, radial: 16 };
    const curve = style === 'rope' ? new CatmullRomCurve3([bottom, ground, top.clone().lerp(ground, 0.45), top]) : new CatmullRomCurve3([bottom, ground, top]);
    // round 44 (structures-28): the rail posts' tops are CHAMFERED — the shaft steps in 28 % over
    // its last ring (≈ 10 cm) so the checked cap sits inside a bevel, a hewn end rather than a
    // cut-off tube (survey-1 crop 19/20: "smooth boxes")
    const radius = style === 'rope' ? (t: number) => (0.092 - 0.027 * t) * (1 + 0.05 * Math.sin(t * 7 + i)) : (t: number) => (0.095 - 0.028 * t) * (1 - 0.28 * smoothstep(0.93, 1, t));
    const post =
      style === 'rope'
        ? sweepTube(curve, {
            // a rough log: r 0.09 at the ground tapering to 0.065, bark cords (two octaves) and a split top
            radius,
            tubularSegments: segs.tubular,
            radialSegments: segs.radial,
            uvMetres: 0.7,
            displace: (t, ang) => {
              const coarse = (noise.ridged(ang * 1.3 + i * 2.1, t * 3, 2) - 0.5) * 0.02;
              const fine = (woodGrain(noise, above(t), ang, 18, 1.2, i + 11) - 0.5) * 0.007;
              return (coarse + fine + Math.sin(ang * 5 + i) * 0.004) * topFade(t);
            },
            // damp dark bark near the ground, greyer and lighter up the post; grime in the furrows
            color: (t, ang) => {
              const fine = woodGrain(noise, above(t), ang, 18, 1.2, i + 11);
              const coarse = noise.ridged(ang * 1.3 + i * 2.1, t * 3, 2);
              const furrow = lerp(0.6, 1.1, 0.5 * fine + 0.5 * coarse);
              const d = (0.5 + 0.35 * t) * (0.9 + 0.2 * Math.max(0, Math.sin(ang))) * furrow;
              const mossy = smoothstep(0.16, 0.0, above(t)) * (0.3 + 0.4 * (1 - fine));
              return [lerp(d, 0.22, mossy), lerp(d * 0.92, 0.27, mossy), lerp(d * 0.84, 0.07, mossy)];
            },
          })
        : sweepTube(curve, {
            // ≥ 0.16 m thick at the ground so a post still covers a few pixels at 20–25 m
            radius,
            tubularSegments: segs.tubular,
            radialSegments: segs.radial,
            uvMetres: 0.8,
            displace: (t, ang) => {
              const g = woodGrain(noise, above(t), ang, 14, 0.7, i + 3);
              return (Math.sin(ang * 4 + i) * 0.006 + Math.sin(ang * 7 + t * 9) * 0.004 + (g - 0.5) * 0.012) * topFade(t);
            },
            // greyer, darker toward the ground where the wood stays damp; grain lines dark, ridges
            // silvered — the swing is wide because the plateau posts stand in shade against the
            // haze, where a ± 15 % line vanishes at 2 m (the mean tone holds). Round 44: × 0.48–1.28
            // (was 0.62–1.15) with the fibre at ± 10 % — under the new shade floor (materials.ts
            // FENCE_WOOD_FLOOR) the shaded faces now show their albedo, and it is this swing they show
            color: (t, ang) => {
              const g = woodGrain(noise, above(t), ang, 14, 0.7, i + 3);
              const fib = woodFibre(noise, above(t), ang, 14, i + 3);
              const line = lerp(0.48, 1.28, g) * lerp(0.9, 1.1, fib);
              const up = 0.8 + 0.2 * t;
              const damp = smoothstep(0.3, 0.0, above(t));
              const mossy = smoothstep(0.12, 0.0, above(t)) * (0.3 + 0.4 * (1 - g));
              const r0 = (shade + grey * 0.3) * up * line * (1 - 0.3 * damp);
              const g0 = (shade * 0.95 + grey * 0.35) * up * line * (1 - 0.26 * damp);
              const b0 = (shade * 0.86 + grey * 0.5) * up * line * (1 - 0.28 * damp + 0.08 * g);
              return [lerp(r0, 0.2, mossy), lerp(g0, 0.25, mossy), lerp(b0, 0.06, mossy)];
            },
          });
    postParts.push(post);
    // the checked / split top on the sweep's end frame (the tube's relief fades to 0 there)
    const capColor: [number, number, number] = style === 'rope' ? [0.55, 0.5, 0.44] : [shade * 0.95, shade * 0.9, shade * 0.82];
    const cap = checkedCap(endFrame(curve, segs.tubular), postRng.fork('cap'), noise, {
      radius: radius(1),
      segments: segs.radial,
      color: capColor,
      checks: 2 + Math.floor(postRng() * 2),
      depth: style === 'rope' ? [0.01, 0.022] : [0.006, 0.014],
      dome: style === 'rope' ? 0.008 : 0.003,
      uvMetres: 0.8,
      uvOffset: [0.2 + i * 0.13, 0.6],
    });
    postParts.push(cap);
    postTriangles += tri(post) + tri(cap);
    // moss round the foot, favouring the shaded quarter (sun azimuth −128° → moss toward +x/+z)
    tuftSpecs.push(
      ...footMoss(ctx, ground, postRng.fork('foot-moss'), {
        postRadius: radius(0.32 / postLen),
        count: style === 'rope' ? 16 : 12,
        size: [0.016, 0.038],
        color: style === 'rope' ? [0.32, 0.44, 0.09] : [0.3, 0.4, 0.09],
        favour: [0.62, 0.78],
      }),
    );
    tops.push(top);
    heights.push(h);
    bases.push([ground.x, ground.y, ground.z]);
  }

  /** point on post i at fraction f of its height (posts lean, so the rail ends follow them) */
  const onPost = (i: number, f: number) => {
    const g = new Vector3(pts[i].x, terrain.height(pts[i].x, pts[i].z), pts[i].z);
    return g.lerp(tops[i], f);
  };

  let lashings = 0;
  let mortises = 0;
  if (style === 'rope') {
    // vine ropes: sag between posts, three-strand laid, lashed round each post with 2½ turns
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
        const sag = 0.06 + rng() * 0.07;
        const p1 = p0.clone().lerp(p2, 0.5);
        p1.y -= sag;
        const twist = rng() * 10;
        const tint = ropeTint();
        ropeParts.push(ropeTube(new CatmullRomCurve3([p0, p1, p2]), ropeR, twist, tint, noise, i * 7.3 + rh));
      }
    }
    // lashings: a continuous helix of the same rope, 2½ turns round the post at each rail height,
    // sitting on the post's surface (post radius at that height + the rope's radius)
    for (let i = 0; i < tops.length; i++) {
      for (const rh of railHeights) {
        const f = rh / postH;
        const tint = ropeTint();
        const lashRng = detailRng.fork(`lash/${i}/${rh}`);
        // the post's radius at this height plus its bark relief's peak (≈ 1.6 cm), plus the rope
        const rPost = (0.092 - 0.027 * f) * 1.05 + 0.016;
        const helixR = rPost + 0.014;
        const turns = 2.5;
        const rise = 0.034;
        const a0 = lashRng() * TAU;
        const pts: Vector3[] = [];
        const n = Math.ceil(turns * 12);
        for (let k = 0; k <= n; k++) {
          const s = k / n;
          const a = a0 + s * turns * TAU;
          // the helix follows the leaning post's axis
          const ck = onPost(i, f + ((s - 0.5) * turns * rise) / heights[i]);
          pts.push(new Vector3(ck.x + Math.cos(a) * helixR, ck.y, ck.z + Math.sin(a) * helixR));
        }
        ropeParts.push(ropeTube(new CatmullRomCurve3(pts), 0.014, lashRng() * TAU, [tint[0] * 0.92, tint[1] * 0.92, tint[2] * 0.92], noise, i * 3.1 + rh * 5));
        lashings++;
      }
    }
  } else {
    // rails: bowed tubes between neighbouring posts, at jittered heights.
    // Round 44 (structures-28): MORTISED. Round 41 ran each rail from the posts' GROUND points,
    // 6 cm past them — but the posts lean (up to 9 cm per metre) and taper to r 0.07 at the top
    // rail, so a rail's end could stand 2–4 cm off the leaning shaft and poke out of its far side
    // (survey-1 crops 19/20: "rails pass straight through posts"). Now a rail runs from a point
    // 2 cm PAST the post's axis AT THE RAIL'S HEIGHT to the same on the next post — buried in
    // both shafts — its radius steps down to a TENON over the last 6 cm before each shaft, and a
    // dark MORTISE COLLAR (a 3 cm ring of the rail's radius + 1.2 cm in the post's damp shade)
    // sits round the rail where it enters the shaft: the cut in the post the rail passes through.
    // The rails' rng draws are unchanged (the same four per rail, in order).
    for (let i = 0; i < tops.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dir = new Vector3(b.x - a.x, 0, b.z - a.z);
      const len = dir.length();
      dir.normalize();
      const side = new Vector3(dir.z, 0, -dir.x);
      /** the post's shaft radius at height fraction f (its relief peaks ≈ 1.2 cm over this) */
      const shaftR = (f: number) => (0.095 - 0.028 * ((f * postH + 0.32) / (postH + 0.32))) + 0.012;
      for (const rh of railHeights) {
        const fa = (rh / postH) * (0.95 + rng() * 0.1);
        const fb = (rh / postH) * (0.95 + rng() * 0.1);
        const sag = 0.02 + rng() * 0.04;
        const bow = (rng() - 0.5) * 0.06;
        const axisA = onPost(i, fa);
        const axisB = onPost(i + 1, fb);
        const p0 = axisA.clone().addScaledVector(dir, -0.02);
        const p2 = axisB.clone().addScaledVector(dir, 0.02);
        const p1 = p0.clone().lerp(p2, 0.5).addScaledVector(side, bow);
        p1.y -= sag;
        const shade = postShade() + 0.08;
        const railLen = p0.distanceTo(p2);
        const rA = shaftR(fa);
        const rB = shaftR(fb);
        // the tenons: the rail thins to 0.8 over the last 6 cm before each shaft's surface
        const tenon = (t: number) => {
          const along = t * railLen;
          const inA = smoothstep(rA + 0.06, rA + 0.005, along);
          const inB = smoothstep(rB + 0.06, rB + 0.005, railLen - along);
          return 1 - 0.2 * Math.max(inA, inB);
        };
        // round 41: the rail's grain runs along it (± 3 mm, lines darker); its ends sit inside the posts
        const rail = sweepTube(new CatmullRomCurve3([p0, p1, p2]), {
          radius: (t) => 0.056 * (1 + 0.15 * Math.sin(t * Math.PI * 1.7 + i)) * tenon(t),
          tubularSegments: Math.max(10, Math.round(len * 7)),
          radialSegments: 12,
          uvMetres: 0.8,
          displace: (t, ang) => (woodGrain(noise, t * len, ang, 10, 0.5, i * 1.7 + rh) - 0.5) * 0.006,
          color: (t, ang) => {
            const g = woodGrain(noise, t * len, ang, 10, 0.5, i * 1.7 + rh);
            const fib = woodFibre(noise, t * len, ang, 10, i * 1.7 + rh);
            const line = lerp(0.6, 1.22, g) * lerp(0.92, 1.08, fib);
            return [shade * line, shade * 0.94 * line, shade * 0.84 * line * (1 + 0.08 * g)];
          },
          capEnd: true,
          capStart: true,
        });
        postParts.push(rail);
        // the mortise collars at both shafts
        for (const [axis, rr, sgn] of [
          [axisA, rA, 1],
          [axisB, rB, -1],
        ] as const) {
          const c0 = axis.clone().addScaledVector(dir, sgn * (rr - 0.012));
          const c1 = axis.clone().addScaledVector(dir, sgn * (rr + 0.02));
          const collar = sweepTube(new CatmullRomCurve3([c0, c0.clone().lerp(c1, 0.5), c1]), {
            radius: (t) => 0.056 * 1.15 + 0.012 * (1 - Math.abs(t * 2 - 1)),
            tubularSegments: 4,
            radialSegments: 12,
            uvMetres: 0.8,
            color: () => [shade * 0.38, shade * 0.36, shade * 0.32],
            capEnd: true,
            capStart: true,
          });
          postParts.push(collar);
          mortises++;
        }
      }
    }
  }

  const meshes: Mesh[] = [];
  const postMesh = new Mesh(merge(postParts), style === 'rope' ? mats.bark : mats.fenceWood);
  postMesh.name = `fence-${def.id}`;
  postMesh.castShadow = postMesh.receiveShadow = true;
  meshes.push(postMesh);
  let ropeTriangles = 0;
  if (ropeParts.length) {
    const ropeGeo = merge(ropeParts);
    ropeTriangles = tri(ropeGeo);
    const ropeMesh = new Mesh(ropeGeo, rope ?? createRopeMaterial());
    ropeMesh.name = `fence-${def.id}-rope`;
    ropeMesh.castShadow = ropeMesh.receiveShadow = true;
    meshes.push(ropeMesh);
  }
  // round 41: the post-foot moss, one cap-moss mesh per run (folds into the roof-tuft bucket)
  const tufts = buildMossTufts(tuftSpecs, tuftNoise, { topGain: 1.4, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
  if (tufts.count > 0) {
    const tuftMesh = new Mesh(tufts.geometry, mats.capMoss);
    tuftMesh.name = `fence-${def.id}-foot-moss`;
    tuftMesh.castShadow = false;
    tuftMesh.receiveShadow = true;
    meshes.push(tuftMesh);
  }
  return { meshes, posts: tops.length, bases, detail41: { postTriangles, ropeTriangles, footTufts: tufts.count, lashings, mortises } };
}
