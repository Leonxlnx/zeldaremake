/**
 * Weathered wooden signpost: a slightly leaning tapered post seated in the terrain, a plank
 * with soft irregular edges carved with rune-like marks (canvas decal), a brace and two pegs.
 *
 * Round 41 (structures-26): readable at 2 m — the post carries long grain (± 4 mm ridges that
 * wander round it, darker in the lines, silvered on the ridges), a CHECKED top (an end-grain
 * disc with drying cracks, woodGrain.ts), a damp dark foot with a little moss (cushion tufts on
 * the terrain, mossTufts.ts, merged into the cap-moss bucket: no new draw); the plank's faces
 * carry grain relief and grain lines, its outline bows a little and its ENDS are checked (split
 * notches along the grain), and the brace and pegs take the same grain.
 */
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, PlaneGeometry, Vector3, type BufferGeometry } from 'three';
import type { WorldContext } from '../system';
import type { Rng } from '../util/prng';
import { Noise2D, clamp, lerp, smoothstep } from '../util/noise';
import { basisMatrix, merge, setColorAttribute, sweepTube } from './geometry';
import { Noise3D, type StructureMaterials } from './materials';
import { buildMossTufts } from './mossTufts';
import { checkedCap, endFrame, footMoss, woodFibre, woodGrain } from './woodGrain';

export interface SignpostBuild {
  group: Group;
  base: [number, number, number];
  /** round 41 audit: the detail added at 2 m */
  detail41: { postTriangles: number; plankTriangles: number; footTufts: number; checks: number };
}

/**
 * Round 41: grain the plank. A BoxGeometry with many width / height segments; every vertex is
 * moved by a CONTINUOUS field of its local position (faces share edge positions, so no seams):
 *  - front / back faces (± z): grain relief ± `relief` along ± z, grain lines darker;
 *  - the top / bottom edges bow ± 8 mm along the length (hand-cut);
 *  - the ends (|x| → W/2) are CHECKED: the end face is pushed in along the grain lines where a
 *    check runs, up to 3 cm, and the notch is shaded.
 */
function grainPlank(geo: BufferGeometry, W: number, H: number, T: number, rng: Rng, noise: Noise2D, base: [number, number, number], relief = 0.0025): void {
  const pos = geo.attributes.position as Float32BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const seed = rng() * 50;
  const bowA = (rng() - 0.5) * 0.016;
  const bowB = (rng() - 0.5) * 0.012;
  // checks at each end: y positions (along the grain) and depths
  const checks: { side: number; y: number; w: number; d: number }[] = [];
  for (const side of [-1, 1]) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) checks.push({ side, y: (rng() - 0.5) * H * 0.8, w: 0.012 + rng() * 0.012, d: 0.012 + rng() * 0.02 });
  }
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const gx = x / W + 0.5;
    const gy = y / H + 0.5;
    // grain: lines run along x, 3–4 cm apart, wandering; a fine fibre between them
    const g = noise.ridged(x * 1.4 + seed, y * 22 + seed * 0.3 + 0.6 * Math.sin(x * 3 + seed), 2);
    const fib = 0.5 + 0.5 * noise.noise(x * 30 + seed, y * 90);
    // relief on the faces (continuous in x, y; the sign of z picks the face)
    const zs = Math.sign(z) || 1;
    const onFace = clamp(Math.abs(z) / (T / 2), 0, 1);
    z += zs * onFace * (g - 0.5) * 2 * relief;
    // bow of the long edges
    y += (y / (H / 2)) * (bowA * Math.sin(gx * Math.PI) + bowB * Math.sin(gx * TAU + seed));
    // checked ends
    let notch = 0;
    for (const k of checks) {
      if (Math.sign(x) !== k.side) continue;
      const nearEnd = smoothstep(W / 2 - 0.09, W / 2, Math.abs(x));
      const prof = Math.exp(-((y - k.y) * (y - k.y)) / (k.w * k.w));
      notch = Math.max(notch, k.d * prof * nearEnd);
    }
    x -= Math.sign(x) * notch;
    // a slightly ragged end outline too
    const endRag = smoothstep(W / 2 - 0.05, W / 2, Math.abs(x)) * 0.006 * noise.noise(y * 40 + seed, gy * 3);
    x -= Math.sign(x) * Math.max(0, endRag);
    pos.setXYZ(i, x, y, z);
    // tint: grain lines darker, ridges paler and a touch greyer (silvering); notches dark
    const line = lerp(0.78, 1.08, g) * lerp(0.95, 1.05, fib);
    const silver = 0.06 * g;
    const dark = 1 - 0.5 * clamp(notch / 0.03, 0, 1);
    colors[i * 3] = base[0] * line * dark * (1 - silver * 0.4);
    colors[i * 3 + 1] = base[1] * line * dark * (1 - silver * 0.2);
    colors[i * 3 + 2] = base[2] * line * dark * (1 + silver * 0.6);
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
}
const TAU = Math.PI * 2;

/** Map box UVs to a slice of the plank texture so the grain runs along the plank. */
function plankUV(geo: BufferGeometry, su: number, sv: number, swap: boolean, u0 = 0, v0 = 0) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (swap) uv.setXY(i, u0 + v * su, v0 + u * sv);
    else uv.setXY(i, u0 + u * su, v0 + v * sv);
  }
}

/** Soften a box into a hand-cut plank: jitter the corner vertices and slightly bow the face. */
function roughen(geo: BufferGeometry, rng: Rng, amount: number) {
  const pos = geo.attributes.position as Float32BufferAttribute;
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)}|${pos.getY(i).toFixed(3)}|${pos.getZ(i).toFixed(3)}`;
    let j = seen.get(key);
    if (!j) {
      j = [(rng() - 0.5) * amount, (rng() - 0.5) * amount, (rng() - 0.5) * amount * 0.4];
      seen.set(key, j);
    }
    pos.setXYZ(i, pos.getX(i) + j[0], pos.getY(i) + j[1], pos.getZ(i) + j[2]);
  }
  geo.computeVertexNormals();
}

export function buildSignpost(def: { id: string; position: readonly [number, number, number]; facing: readonly [number, number] }, ctx: WorldContext, mats: StructureMaterials, rng: Rng): SignpostBuild {
  const group = new Group();
  group.name = `signpost-${def.id}`;
  const x = def.position[0];
  const z = def.position[2];
  const gy = ctx.terrain.height(x, z);
  const F = new Vector3(def.facing[0], 0, def.facing[1]).normalize();
  const Rt = new Vector3(F.z, 0, -F.x);

  // lean: a few degrees, mostly sideways
  const leanA = (rng() - 0.5) * Math.PI * 2;
  const lean = 0.045 + rng() * 0.03;
  const leanDir = new Vector3(Math.cos(leanA), 0, Math.sin(leanA)).multiplyScalar(lean);
  const postH = 1.62;
  const axisAt = (y: number) => new Vector3(x + leanDir.x * y, gy + y, z + leanDir.z * y);

  const parts = [];
  // round 41: the post's own grain field and the detail stream (forked: the lean / plank draws above are unchanged)
  const detailRng = rng.fork('detail41');
  const grainNoise = new Noise2D(`${ctx.config.seed}/structures/signpost/${def.id}/grain`);
  const postLen = postH + 0.35;
  const postR = (t: number) => 0.078 - 0.028 * t;
  const postCurve = new CatmullRomCurve3([axisAt(-0.35), axisAt(postH * 0.5), axisAt(postH)]);
  const postSegs = { tubular: 26, radial: 20 };
  /** the ground sits at t ≈ 0.35 / postLen along the sweep */
  const tGround = 0.35 / postLen;
  const post = sweepTube(postCurve, {
    radius: postR,
    tubularSegments: postSegs.tubular,
    radialSegments: postSegs.radial,
    uvMetres: 0.9,
    displace: (t, ang) => {
      const along = t * postLen;
      const g = woodGrain(grainNoise, along, ang, 14, 0.7, 3);
      // the old five-lobe rounding stays under the grain; relief fades to 0 at the checked top
      const topFade = 1 - smoothstep(0.96, 1, t);
      return (Math.sin(ang * 5 + t * 12) * 0.004 + (g - 0.5) * 0.008) * topFade;
    },
    color: (t, ang) => {
      const along = t * postLen;
      const g = woodGrain(grainNoise, along, ang, 14, 0.7, 3);
      const fib = woodFibre(grainNoise, along, ang, 14, 3);
      const line = lerp(0.74, 1.06, g) * lerp(0.95, 1.05, fib);
      // damp and dark toward the ground, greener in the last 12 cm; silvered up the post
      const hAbove = along - 0.35;
      const damp = smoothstep(0.35, 0.02, hAbove);
      const mossy = smoothstep(0.14, 0.0, hAbove) * (0.35 + 0.35 * (1 - g));
      const r0 = 0.78 * line * (1 - 0.35 * damp);
      const g0 = 0.7 * line * (1 - 0.3 * damp);
      const b0 = 0.58 * line * (1 - 0.32 * damp);
      return [lerp(r0, 0.3, mossy), lerp(g0, 0.36, mossy), lerp(b0, 0.1, mossy)];
    },
  });
  parts.push(post);
  // the checked top: end-grain disc with drying cracks on the sweep's end frame
  const topFrame = endFrame(postCurve, postSegs.tubular);
  const postCap = checkedCap(topFrame, detailRng.fork('cap'), grainNoise, {
    radius: postR(1),
    segments: postSegs.radial,
    color: [0.66, 0.58, 0.47],
    checks: 3,
    depth: [0.006, 0.014],
    dome: 0.004,
    uvMetres: 0.9,
    uvOffset: [0.3, 0.7],
  });
  parts.push(postCap);

  // plank: wide, soft edged, mounted at eye height for a child
  const plankW = 0.98;
  const plankH = 0.44;
  const plankT = 0.055;
  const plank = new BoxGeometry(plankW, plankH, plankT, 30, 14, 1);
  plankUV(plank, 0.42, 0.24, true, 0.1, 0.2);
  // the weathered_planks map is grey (~0.35 linear); lift it to the reference's sunlit tan;
  // round 41: grain relief, bowed edges and checked ends in place of the corner jitter
  grainPlank(plank, plankW, plankH, plankT, detailRng.fork('plank'), grainNoise, [2.3, 1.95, 1.35]);
  const plankY = 1.08;
  const plankCentre = axisAt(plankY + plankH / 2).addScaledVector(F, 0.085);
  const tiltM = new Matrix4().makeRotationZ((rng() - 0.5) * 0.06);
  const plankM = basisMatrix(plankCentre, F).multiply(tiltM);
  plank.applyMatrix4(plankM);
  parts.push(plank);

  // brace behind the plank and two pegs through it (round 41: the brace is grained like the plank, hand-cut)
  const braceH = plankH * 0.85;
  const brace = new BoxGeometry(0.09, braceH, 0.05, 2, 8, 1);
  plankUV(brace, 0.08, 0.3, false);
  grainPlank(brace, 0.09, braceH, 0.05, detailRng.fork('brace'), grainNoise, [0.75, 0.68, 0.55], 0.0015);
  roughen(brace, detailRng.fork('brace-rough'), 0.008);
  brace.applyMatrix4(basisMatrix(axisAt(plankY + plankH / 2).addScaledVector(F, 0.035), F));
  parts.push(brace);
  for (const side of [-1, 1]) {
    const peg = new CylinderGeometry(0.02, 0.023, 0.09, 12);
    peg.rotateX(Math.PI / 2);
    setColorAttribute(peg, [0.5, 0.42, 0.32]);
    peg.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(Rt, side * plankW * 0.36).addScaledVector(F, 0.02), F));
    parts.push(peg);
  }
  const woodGeo = merge(parts);
  const woodMesh = new Mesh(woodGeo, mats.wood);
  woodMesh.name = 'signpost-wood';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // carved marks decal on the front face
  const decal = new PlaneGeometry(plankW * 0.9, plankH * 0.8);
  decal.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(F, plankT / 2 + 0.004), F).multiply(tiltM));
  const decalMesh = new Mesh(decal, mats.runes);
  decalMesh.name = 'signpost-runes';
  group.add(decalMesh);

  // round 41: a little moss at the post's foot (the damp, shaded side away from the sun — the
  // sun stands at azimuth −128°, so the moss favours the +x / +z quarter); cushion tufts on the
  // terrain in the cap-moss material, castShadow off like the roof tufts so they fold into that bucket
  const mossRng = detailRng.fork('foot-moss');
  const tuftNoise = new Noise3D(mossRng.fork('noise'));
  const specs = footMoss(ctx, new Vector3(x, gy, z), mossRng, {
    postRadius: postR(tGround),
    count: 22,
    size: [0.018, 0.04],
    color: [0.34, 0.46, 0.09],
    favour: [0.62, 0.78],
  });
  const tufts = buildMossTufts(specs, tuftNoise, { topGain: 1.4, rimGain: 0.5, topTint: [1.0, 1.05, 0.8] });
  if (tufts.count > 0) {
    const tuftMesh = new Mesh(tufts.geometry, mats.capMoss);
    tuftMesh.name = 'signpost-foot-moss';
    tuftMesh.castShadow = false;
    tuftMesh.receiveShadow = true;
    group.add(tuftMesh);
  }

  const tri = (g: BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  return {
    group,
    base: [x, gy, z],
    detail41: { postTriangles: tri(post) + tri(postCap), plankTriangles: tri(plank), footTufts: tufts.count, checks: 3 },
  };
}
