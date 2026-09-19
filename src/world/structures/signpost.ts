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
import { type GlyphStroke, glyphDistance } from './glyphs';
import { Noise3D, WOOD_ON_FENCE_WOOD, type StructureMaterials } from './materials';
import { buildMossTufts } from './mossTufts';
import { checkedCap, endFrame, footMoss, woodFibre, woodGrain } from './woodGrain';

export interface SignpostBuild {
  group: Group;
  base: [number, number, number];
  /** round 41 audit: the detail added at 2 m */
  detail41: { postTriangles: number; plankTriangles: number; footTufts: number; checks: number };
  /** round 47 (structures-30): the carved lettering — strokes on the board, front-face vertices sunk */
  glyphs: { strokes: number; carvedVertices: number };
}

/**
 * Round 41: grain the plank. A BoxGeometry with many width / height segments; every vertex is
 * moved by a CONTINUOUS field of its local position (faces share edge positions, so no seams):
 *  - front / back faces (± z): grain relief ± `relief` along ± z, grain lines darker;
 *  - the top / bottom edges bow ± 8 mm along the length (hand-cut);
 *  - the ends (|x| → W/2) are CHECKED: the end face is pushed in along the grain lines where a
 *    check runs, up to 3 cm, and the notch is shaded.
 */
function grainPlank(geo: BufferGeometry, W: number, H: number, T: number, rng: Rng, noise: Noise2D, base: [number, number, number], relief = 0.0035): void {
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
    const line = lerp(0.66, 1.12, g) * lerp(0.95, 1.05, fib);
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

/**
 * Round 47 (structures-30): sink the plank's front face (+z) along the lettering's strokes. The
 * decal is centred on the plank; a front-face vertex at local (x, y) sits at decal coordinates
 * (x / decalW + 0.5, y / decalH + 0.5). Depth is `depth` inside the stroke (a V from the edge
 * to half the width), the groove's floor is darkened in the vertex tint. Returns the vertices
 * moved (audit).
 */
function carveGlyphs(geo: BufferGeometry, T: number, decalW: number, decalH: number, strokes: GlyphStroke[], depth: number): number {
  const pos = geo.attributes.position as Float32BufferAttribute;
  const col = geo.attributes.color as Float32BufferAttribute | undefined;
  const aspect = decalW / decalH;
  const hw = strokes.length ? strokes[0].hw * decalW : 0.01;
  let moved = 0;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z < T * 0.45) continue;
    const u = pos.getX(i) / decalW + 0.5;
    const v = pos.getY(i) / decalH + 0.5;
    if (u < -0.02 || u > 1.02 || v < -0.02 || v > 1.02) continue;
    const d = glyphDistance(strokes, u, v, aspect) * decalW;
    if (d >= 0.002) continue;
    const cut = d <= -hw * 0.5 ? 1 : clamp((0.002 - d) / (hw * 0.5 + 0.002), 0, 1);
    pos.setZ(i, z - depth * cut);
    if (col) {
      const k = 1 - 0.55 * cut;
      col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
    }
    moved++;
  }
  pos.needsUpdate = true;
  if (col) col.needsUpdate = true;
  geo.computeVertexNormals();
  return moved;
}

/** round 45 (details-1): the signpost's wood draws in the fences' material — see the mesh below */
function scaleColors(geo: BufferGeometry, k: [number, number, number]): void {
  const c = geo.attributes.color;
  if (!c) return;
  for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * k[0], c.getY(i) * k[1], c.getZ(i) * k[2]);
  c.needsUpdate = true;
}

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

/** round 46 (structures-29): the board's and the post's tint scales — see the plank note in `buildSignpost` */
const BOARD_LIFT = 4.5;
const POST_LIFT = 1.4;

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
      const r0 = 0.78 * POST_LIFT * line * (1 - 0.35 * damp);
      const g0 = 0.7 * POST_LIFT * line * (1 - 0.3 * damp);
      const b0 = 0.58 * POST_LIFT * line * (1 - 0.32 * damp);
      return [lerp(r0, 0.3, mossy), lerp(g0, 0.36, mossy), lerp(b0, 0.1, mossy)];
    },
  });
  parts.push(post);
  // the checked top: end-grain disc with drying cracks on the sweep's end frame
  const topFrame = endFrame(postCurve, postSegs.tubular);
  const postCap = checkedCap(topFrame, detailRng.fork('cap'), grainNoise, {
    radius: postR(1),
    segments: postSegs.radial,
    color: [0.66 * POST_LIFT, 0.58 * POST_LIFT, 0.47 * POST_LIFT],
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
  // round 47 (structures-30): 96 × 42 face segments (9 mm cells) so the lettering can be CARVED
  // into the front face (`carveGlyphs` below); 30 × 14 before
  const plank = new BoxGeometry(plankW, plankH, plankT, 96, 42, 1);
  plankUV(plank, 0.42, 0.24, true, 0.1, 0.2);
  // the weathered_planks map is grey (~0.35 linear); lift it to the reference's sunlit tan;
  // round 41: grain relief, bowed edges and checked ends in place of the corner jitter
  // Round 46 (structures-29): the board measured in B against the frame — ours rgb(70,57,42),
  // lum p50 0.253 at (0.62–0.655, 0.455–0.48); the frame's board rgb(186,145,85), 0.587, hue 35°
  // at (0.552–0.598, 0.445–0.5) — a pale tan plank lit by the pods, 2.3× ours in sRGB. The
  // round-45 rescale had held the board at the round-44 SHADED level (sRGB ≈ 0.26) and left its
  // lit faces 27 % darker still. Measured at ×3 in B: p50 0.253 → 0.333, p90 0.288 → 0.471 — the
  // veil at 12 m is ≈ 0.63 of the pixel there (0.052 = 0.63 H + 0.37 S; H ≈ S ≈ 0.05 linear), so
  // the board's own albedo has to carry the whole move: ×4.5 (albedo ≈ 0.5 linear — a pale
  // plank, which is what the sign is) lands the pixel near 0.39; the frame's 0.587 is its pods'
  // light, which ours does not put there. The post, brace, pegs and cap go ×1.4. The runes decal
  // stays.
  grainPlank(plank, plankW, plankH, plankT, detailRng.fork('plank'), grainNoise, [2.3 * BOARD_LIFT, 1.95 * BOARD_LIFT, 1.35 * BOARD_LIFT]);
  // Round 47 (structures-30, owner ref-01 "carved lettering"): the glyphs are CUT into the
  // board — the front face is sunk 6 mm along the decal's strokes (glyphs.ts: the same strokes
  // the decal paints), the groove's floor darkened in the tint, so the lettering has real
  // relief under a grazing light and a dark fill even where the decal's texel is between
  // strokes. The decal (fill, bevel lips, normal map) lies 1.5 mm over the carved face.
  const decalW = plankW * 0.9;
  const decalH = plankH * 0.8;
  const carved = carveGlyphs(plank, plankT, decalW, decalH, mats.runeGlyphs, 0.006);
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
  grainPlank(brace, 0.09, braceH, 0.05, detailRng.fork('brace'), grainNoise, [0.75 * POST_LIFT, 0.68 * POST_LIFT, 0.55 * POST_LIFT], 0.0015);
  roughen(brace, detailRng.fork('brace-rough'), 0.008);
  brace.applyMatrix4(basisMatrix(axisAt(plankY + plankH / 2).addScaledVector(F, 0.035), F));
  parts.push(brace);
  for (const side of [-1, 1]) {
    const peg = new CylinderGeometry(0.02, 0.023, 0.09, 12);
    peg.rotateX(Math.PI / 2);
    setColorAttribute(peg, [0.5 * POST_LIFT, 0.42 * POST_LIFT, 0.32 * POST_LIFT]);
    peg.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(Rt, side * plankW * 0.36).addScaledVector(F, 0.02), F));
    parts.push(peg);
  }
  const woodGeo = merge(parts);
  // round 45 (details-1): the fences' plank material (`fenceWood`, under FENCE_WOOD_FLOOR) in
  // place of `wood`, which has no floor: at 2 m in the canopy's shade (sn-signpost) the post and
  // board rendered p10 / p50 / p90 at 0.056 / 0.070 / 0.088 and 0.044 / 0.078 / 0.090, a black
  // box with the runes lost in it. Sharing the fences' material folds the signpost into their
  // static bucket (consolidateStaticMeshes: same flags, same vertex layout), so the lit signpost
  // costs no draw of its own; a material of its own cost a colour draw and a shadow draw. The
  // vertex tints above were set against `wood`'s tint and calibrated under a lift-8 floor (a
  // board at ≈ 0.055 linear, sRGB ≈ 0.26; the post ≈ 0.15): WOOD_ON_FENCE_WOOD (materials.ts)
  // rescales them for the fence tint and the fence floor's lift 11, so the shaded planks land at
  // that same level and colour; the sunlit faces (rare, the post stands in canopy shade) come out
  // 27 % darker than on `wood`.
  scaleColors(woodGeo, WOOD_ON_FENCE_WOOD);
  const woodMesh = new Mesh(woodGeo, mats.fenceWood);
  woodMesh.name = 'signpost-wood';
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // carved marks decal on the front face (round 47: 1.5 mm off the carved face, was 4 mm)
  const decal = new PlaneGeometry(decalW, decalH);
  decal.applyMatrix4(basisMatrix(plankCentre.clone().addScaledVector(F, plankT / 2 + 0.0015), F).multiply(tiltM));
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
    glyphs: { strokes: mats.runeGlyphs.length, carvedVertices: carved },
  };
}
