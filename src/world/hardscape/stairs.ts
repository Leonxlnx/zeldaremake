/**
 * Procedural stone stairways (W02). Every tread is a distinct hand-cut slab: jittered outline,
 * chipped corners, bevelled edges, a slightly dished top and small yaw/depth variation; ~1/3 of
 * the treads are split into two stones. Risers are separate darker stones (sometimes two or three
 * stacked pieces). Both flanks get stacked retaining stones ("cheeks") that step up with the run
 * and sink into the embankment, and the top gets a short landing of slabs so the stair meets the
 * plateau flush. Moss is written into the `aMoss` attribute where joints/edges meet grass.
 */
import { BufferGeometry, Matrix4, Vector3 } from 'three';
import type { StairDef } from '../layout';
import type { Terrain } from '../terrain/heightfield';
import { hash2, type Rng } from '../util/prng';
import { Noise2D, clamp, smoothstep } from '../util/noise';
import { MeshBuilder, buildSlab, ccw, inset, jitteredRect, type P2 } from './geometry';

export interface StairFrame {
  def: StairDef;
  base: Vector3;
  dx: number;
  dz: number;
  run: number;
  matrix: Matrix4;
}

export function stairFrame(def: StairDef): StairFrame {
  const l = Math.hypot(def.dir[0], def.dir[1]);
  const dx = def.dir[0] / l;
  const dz = def.dir[1] / l;
  // local x = across (right-handed with local z = ascent), local z = along the ascent
  const m = new Matrix4().makeBasis(new Vector3(dz, 0, -dx), new Vector3(0, 1, 0), new Vector3(dx, 0, dz));
  m.setPosition(def.base[0], def.base[1], def.base[2]);
  return { def, base: new Vector3(def.base[0], def.base[1], def.base[2]), dx, dz, run: def.steps * def.tread, matrix: m };
}

/** local (across, along) → world xz */
export function stairToWorld(f: StairFrame, across: number, along: number): [number, number] {
  return [f.base.x + across * f.dz + along * f.dx, f.base.z - across * f.dx + along * f.dz];
}

/** world xz → local (across, along) */
export function worldToStair(f: StairFrame, x: number, z: number): [number, number] {
  const rx = x - f.base.x;
  const rz = z - f.base.z;
  return [rx * f.dz - rz * f.dx, rx * f.dx + rz * f.dz];
}

/** flights whose foot stands on paving: the path's slabs run up to the first riser (see terrain/heightfield.ts, the house-west apron) */
export function hasPavedApron(def: StairDef): boolean {
  return def.id === 'house-west';
}

/**
 * rows of landing slabs past the top step: two (1.62 m) on the main and north runs, one on the
 * house-west flight — its head is Saria's turf yard, and from camera B (14 m, 1.8° down on to
 * the terrace) a second row showed as a grey band beside Link where frame 14 s has turf
 */
export function landingRows(def: StairDef): number {
  return hasPavedApron(def) ? 1 : 2;
}

/** length of the landing past the top step (m) — the terrain's stair mask stops here (heightfield StairFrame.landing) */
export function landingLength(def: StairDef): number {
  return landingRows(def) === 1 ? 0.85 : 1.75;
}

/** true if the point lies in the stair footprint incl. cheeks and landing (no flagstones here) */
export function inStairFootprint(f: StairFrame, x: number, z: number, margin = 0): boolean {
  const [a, u] = worldToStair(f, x, z);
  // 30 cm of soil in front of the first riser (the main run's foot bank), or 5 cm where the
  // paving laps the riser
  const front = hasPavedApron(f.def) ? -0.05 : -0.3;
  return u > front - margin && u < f.run + landingLength(f.def) + margin && Math.abs(a) < f.def.width / 2 + 0.5 + margin;
}

export interface StairBuild {
  geometry: BufferGeometry;
  steps: number;
  treadSlabs: number;
  shapeHashes: string[];
  triangles: number;
  /** world-space points on the top of every tread's front edge (for the audit) */
  treadNose: [number, number, number][];
}

function outlineHash(p: P2[]): string {
  return p.map((q) => `${Math.round(q.x * 200)}:${Math.round(q.z * 200)}`).join('|');
}

/**
 * Worn nosing: the front edge of a tread is not the straight line `jitteredRect` cuts. The front
 * segments are subdivided to ~16 cm and the points displaced along the run by a low-frequency
 * wave (a few cm over ~1 m) plus chips (a point pulled back where the chip field peaks), both
 * tapered toward the slab ends by `endTaper`, so the lit lip undulates like the frame's. Returns
 * the new outline and, per point, whether it lies on the front edge (for the shoulder ring and
 * the highlight).
 */
function wornFront(outline: P2[], depth: number, wave: (ax: number) => number, chip: (ax: number) => number, cxl: number, endTaper: (x: number) => number): { outline: P2[]; front: boolean[] } {
  const isFront = (p: P2) => p.z < -depth / 2 + 0.05;
  const out: P2[] = [];
  const front: boolean[] = [];
  const n = outline.length;
  for (let k = 0; k < n; k++) {
    const p = outline[k];
    const q = outline[(k + 1) % n];
    const fp = isFront(p);
    out.push(p);
    front.push(fp);
    if (fp && isFront(q)) {
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      const sub = clamp(Math.round(len / 0.16), 1, 5);
      for (let s = 1; s < sub; s++) {
        const t = s / sub;
        out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
        front.push(true);
      }
    }
  }
  return { outline: out.map((p, k) => (front[k] ? { x: p.x, z: p.z + (wave(p.x + cxl) + chip(p.x + cxl)) * endTaper(p.x) } : p)), front };
}

export function buildStairway(def: StairDef, terrain: Terrain, rng: Rng, seed: string): StairBuild {
  const f = stairFrame(def);
  const noise = new Noise2D(`${seed}/stairs-moss-${def.id}`);
  const wear = new Noise2D(`${seed}/stairs-wear-${def.id}`);
  // round 23: nosing waviness / chips and the lichen mottling are noise fields (no stream draws),
  // so every existing draw below — outlines, splits, tints, riser counts, cheeks, landing — keeps
  // its place and the flight stays the same set of stones
  const nosing = new Noise2D(`${seed}/stairs-nosing-${def.id}`);
  const lichen = new Noise2D(`${seed}/stairs-lichen-${def.id}`);
  // round 42 (the player-height pass; frame 03 / the third tread looking down): nosing spalls,
  // riser fissures and the per-riser corner moss are noise fields and hash forks keyed on the
  // step, so every draw of the flight below keeps its place
  const spall = new Noise2D(`${seed}/stairs-spall-${def.id}`);
  const all = new MeshBuilder();
  const w = def.width;
  const hw = w / 2;
  const shapeHashes: string[] = [];
  const treadNose: [number, number, number][] = [];
  let treadSlabs = 0;
  const tmpM = new Matrix4();
  const uvScale = 1 / 1.7;
  const isMain = def.id === 'main';

  // moss field in stair-local coords: stronger toward both flanks and slightly up the run
  const mossAt = (ax: number, al: number) => {
    const edge = smoothstep(hw - 0.85, hw + 0.05, Math.abs(ax));
    const n = noise.fbm(ax * 1.9 + 3.1, al * 1.9 - 7.7, 3) * 0.5 + 0.5;
    return clamp((0.16 + 0.9 * edge) * (0.45 + 0.95 * n), 0, 1);
  };
  // where feet go: 1 on the centre third of the run, 0 at the flanks (wear dish, bare corners)
  const feet = (ax: number) => 1 - smoothstep(0.3 * hw, 0.85 * hw, Math.abs(ax));

  const placeSlab = (outline: P2[], cx: number, cy: number, cz: number, yaw: number, tiltX: number, tiltZ: number, opts: Parameters<typeof buildSlab>[2], rough = 0) => {
    const mb = new MeshBuilder();
    mb.currentRough = rough;
    buildSlab(mb, outline, opts);
    tmpM.makeRotationY(yaw);
    if (tiltX || tiltZ) {
      const t = new Matrix4().makeRotationX(tiltX).multiply(new Matrix4().makeRotationZ(tiltZ));
      tmpM.multiply(t);
    }
    tmpM.setPosition(cx, cy, cz);
    mb.transform(tmpM);
    all.append(mb);
    return mb;
  };

  const baseY = 0; // local y relative to def.base[1]
  for (let i = 0; i < def.steps; i++) {
    const topY = baseY + (i + 1) * def.rise + rng.range(-0.008, 0.008);
    // Round 31 (frames 1 s / 8 s, the owner's "one-to-one with Link's steps"): each tread is a
    // heavy slab whose nose overhangs the riser by a hand's width, so every step reads as a lit
    // rolled lip over a deep shadow line — the frame's flight (A x 0.60–0.80) has 15 lit lips
    // 0.45–0.59 over troughs 0.24–0.36, ours read 0.32–0.49 over 0.24–0.27 with a 2–4.5 cm nose
    const ts = rng.range(0.13, 0.16); // slab thickness
    const nose = rng.range(0.065, 0.095);
    const uFront = i * def.tread - nose + rng.range(-0.012, 0.012);
    const uBack = (i + 1) * def.tread + 0.03;
    const depth = uBack - uFront;
    const yaw = rng.range(-0.02, 0.02);
    // worn treads: a darker grey-brown than the plaza slabs (reference A lit tread #746d5d
    // against flagstone #a79774 — ≈ 0.7× in sRGB, cooler: B/R 0.80 vs 0.69), with only a mild
    // tread-to-tread swing so the flight reads as one stone with lit nosings, not a patchwork
    const tint = 0.7 + rng.range(0, 0.12);
    const hue = rng.range(-0.025, 0.025);
    // (round 22: cooler still - the flight in frame 1 s (x 0.60-0.80, y 0.27-0.60) reads sat 0.118 /
    // hue 50 deg on its lit stone against our 0.150 / 48 deg, i.e. a greyer, cooler stone than the
    // plaza's, where the plaza itself matches the frame; red 0.98 -> 0.90, blue 1.14 -> 1.34 - the post chain passes ~1/4 of an albedo shift)
    const color: [number, number, number] = [tint * (1 + hue) * 0.9, tint, tint * (1 - hue * 0.6) * 1.34];

    // split the tread into two stones sometimes (round 31: 0.36 → 0.2 — frame 8 s reads the
    // flight with a third of our vertical joint energy, 0.037 against 0.068 in its box)
    const split = rng.chance(0.2);
    const pieces: { a0: number; a1: number }[] = [];
    if (split) {
      const s = rng.range(-0.55, 0.55) * hw;
      const gap = rng.range(0.02, 0.04);
      pieces.push({ a0: -hw + rng.range(-0.03, 0.03), a1: s - gap / 2 }, { a0: s + gap / 2, a1: hw + rng.range(-0.03, 0.03) });
    } else {
      pieces.push({ a0: -hw + rng.range(-0.03, 0.03), a1: hw + rng.range(-0.03, 0.03) });
    }
    for (const pc of pieces) {
      const pw = pc.a1 - pc.a0;
      const cxl = (pc.a0 + pc.a1) / 2;
      const czl = (uFront + uBack) / 2;
      const cut = jitteredRect(rng, pw, depth, { jitter: 0.014, segs: 5, chip: 0.09, chipChance: 0.5 });
      // worn front edge (frame 1 s / 8 s: wavy, chipped lips, no two alike): ±2 cm over ~1 m plus
      // worn hollows of up to 3 cm where the chip field peaks (only ever pulled back into the
      // stone). Kept gentle — local slopes ≲ 0.15 and tapered toward the slab ends — so a long
      // tread stays star-shaped from its centroid and the top keeps its centred dish (a sharper
      // notch far from the centre made `slabFanCentre` drag the fan centre 0.7–0.9 m off)
      const endTaper = (x: number) => 1 - 0.6 * smoothstep(0.55, 1, Math.abs(x) / (pw / 2));
      const chipAt = (ax: number) => Math.max(0, nosing.noise(ax * 4.2 + 11.3, i * 3.9 + 4.2) - 0.5) / 0.5;
      const { outline, front: isFront } = wornFront(
        cut,
        depth,
        (ax) => 0.02 * nosing.noise(ax * 1.0 + i * 5.1, i * 2.7 + 0.5),
        (ax) => 0.03 * chipAt(ax),
        cxl,
        endTaper,
      );
      shapeHashes.push(outlineHash(outline));
      const dip = rng.range(0.01, 0.026);
      // the nose catches the light. Round 31: back up from round 23's 1.2–1.36 — measured along
      // the flight's centre line the frame's lips stand 0.12–0.20 over the riser troughs (A mid
      // flight 0.45–0.52 over 0.29–0.36; F p90 0.58 over p10 0.31) where ours stood 0.05–0.10
      // (A 0.32–0.38 over 0.26; F 0.43 over 0.23)
      const noseBright = rng.range(1.35, 1.5);
      // the roll's drop (bevel) is 5–7 cm of the 13–16 cm slab, in three bands (bevelRings) on a
      // quarter-round: a bulging, log-like lip like the frame's rather than a cut chamfer
      const bevel = rng.range(0.05, 0.07);
      // worn, rounded nose (sheet 01 / 04 stairs insets): the shoulder ring is pushed a further
      // 4–6 cm back along the front edge, so the nose roll is 9–13 cm wide for the same drop
      // and, smoothed as one group with the top (softBevel), rolls over instead of showing a
      // cut crease; the back and flanks keep the plain roll. The roll varies along the edge
      // (0.6–1.4×, chips widening it) so the lip's highlight is a worn, broken line
      const noseRound = rng.range(0.04, 0.06);
      const topRing = inset(outline, bevel).map((p, k) => {
        if (!isFront[k]) return p;
        const ax = p.x + cxl;
        const roll = 0.6 + 0.8 * (nosing.noise(ax * 1.6 + 21, i * 1.7) * 0.5 + 0.5) + 0.4 * chipAt(ax);
        return { x: p.x, z: p.z + noseRound * (1 + (roll - 1) * endTaper(p.x)) };
      });
      // lichen / wear mottling on the tops (frame: subtle tonal blotches, not one flat grey):
      // ±3 % luminance at ~0.4–0.6 m, the paler blotches a touch greener (lichen)
      const mottle = (ax: number, al: number): [number, number, number] => {
        const m = lichen.fbm(ax * 1.9 + 4.4, al * 1.9 + i * 0.37, 2);
        const pale = Math.max(0, m);
        const k = 1 + 0.03 * m;
        return [k * (1 - 0.012 * pale), k * (1 + 0.008 * pale), k * (1 - 0.02 * pale)];
      };
      // round 42: the nosing's wear — spalls on the front edge (geometry.ts `rimDrop`): where a
      // 5 cycles/m noise peaks along the lip the wall top and the roll drop 1–2.5 cm, a chip out
      // of the rolled nose every 0.4–0.8 m, heavier where feet go (the centre third); nothing on
      // the back or the flanks. The frame's lips are broken lines, not one continuous highlight.
      const noseSpall = (x: number, z: number) => {
        if (z > -depth / 2 + 0.06) return 0;
        const nz = spall.noise((x + cxl) * 5.0 + i * 7.3, i * 2.1 + 0.7) * 0.5 + 0.5;
        return (0.01 + 0.015 * feet(x + cxl)) * smoothstep(0.62, 0.82, nz);
      };
      // per-tread micro-roughness (aRough): the treads catch the low sun a little differently
      const treadRough = (hash2(i, Math.round(cxl * 100) + 91, 7) - 0.5) * 0.08;
      placeSlab(outline, cxl, topY - ts, czl, yaw, 0, 0, {
        thickness: ts,
        bevel,
        bevelRings: 3,
        topRing,
        softBevel: true,
        notchedTop: true,
        rimDrop: noseSpall,
        // the overhang's underside is visible from below the flight (camera F looks up at the
        // treads above eye level), so the slab is closed
        bottom: true,
        dip,
        color,
        // the tread's own front face is the upper band of the riser: closer to the riser stone
        // than round 22's 0.62 (× 1.34 lit) so a step is nose → one dark face, not a two-tone
        // riser. (Round 31: the roll is shaded from the TOP colour (bevelColor), not this — as the
        // side colour × 1.2–1.36 the "lit lip" was 0.6–0.68 of the tread top's albedo, darker
        // than the tread it was meant to crown; the frame's lips are its palest stone.)
        sideColor: [color[0] * 0.5, color[1] * 0.5, color[2] * 0.56],
        // a touch cooler than the tread top: the frame's lit lips are its palest and coolest
        // stone (A lit-20 % B/G 0.84, F 0.87; ours read 0.80 / 0.75 with the lip at the top colour)
        bevelColor: [color[0] * 0.95, color[1], color[2] * 1.15],
        mossEdge: 0.85,
        mossInner: 0.05,
        mossFn: (x, z) => mossAt(x + cxl, z + czl),
        // moss pads in the tread/riser corner: the back edge of the tread, where the next riser
        // stands on it, carries moss in patches that spill a hand's width onto the tread — dense
        // toward the flanks, sparse on the centre third where feet keep the corner bare
        mossAdd: (x, z, edge) => {
          const back = smoothstep(depth / 2 - 0.16, depth / 2 - 0.02, z);
          const patch = smoothstep(0.35, 0.8, noise.fbm((x + cxl) * 3.4 + i * 17.3, (z + czl) * 3.4 - 2.2, 2) * 0.5 + 0.5);
          const flankBias = 0.3 + 1.1 * (1 - feet(x + cxl));
          return 1.1 * flankBias * back * patch * (0.3 + 0.7 * smoothstep(0.4, 1, edge)) * (0.55 + 0.45 * mossAt(x + cxl, z + czl));
        },
        // worn nose: the front bevel and the first ~12 cm of the tread catch the light, the back
        // of the tread (under the next riser) and the flanks pick up grime
        colorFn: (x, z, part) => {
          const front = smoothstep(-depth / 2 + 0.16, -depth / 2 + 0.02, z); // 1 at the nose
          const back = smoothstep(depth / 2 - 0.2, depth / 2 - 0.02, z); // 1 at the back edge
          const flank = smoothstep(hw - 0.75, hw + 0.05, Math.abs(x + cxl));
          const grime = 1 - 0.16 * flank * (0.6 + 0.4 * (wear.noise((x + cxl) * 2.1 + 7, (z + czl) * 2.1) * 0.5 + 0.5));
          // wet / dark patches (frames 1 s / 8 s: the treads carry damp blotches 0.3–0.6 m across,
          // darkest toward the back of the tread and the flanks, the trodden centre-front stays dry)
          const wet = smoothstep(0.2, 0.7, wear.fbm((x + cxl) * 1.7 + 31, (z + czl) * 1.7 + i * 0.61, 2)) * (0.45 + 0.55 * Math.max(back, 1 - feet(x + cxl)));
          const damp = 1 - 0.2 * wet;
          if (part === 'bevel') return (0.98 + (noseBright - 0.98) * front) * grime * (1 - 0.08 * wet);
          // the nose face under the lip: a shade lighter and greener than the riser stone below it
          // (a damp skin under the overhang), the buried sides stay dark
          if (part === 'side') return z < 0 ? [1.02 * grime, 1.06 * grime, 0.98 * grime] : 0.92 * grime;
          const m = mottle(x + cxl, z + czl);
          const k = (1 + 0.09 * front - 0.13 * back) * grime * damp;
          return [m[0] * k, m[1] * k, m[2] * k * (1 + 0.04 * wet)];
        },
        uvScale,
        uvOffset: [rng() * 3, rng() * 3],
        // fine wear grain plus the feet path: a ~1.2 cm deeper dish over the centre third of the
        // run (the nosing line sags with it at the middle, half as much)
        topNoise: (x, z) => 0.004 * wear.noise((x + cxl) * 9, (z + czl) * 9) - 0.012 * feet(x + cxl),
        rings: 3,
      }, treadRough);
      treadSlabs++;
      const [wx, wz] = stairToWorld(f, cxl, uFront + 0.01);
      treadNose.push([wx, def.base[1] + topY, wz]);
    }

    // riser: 1–3 darker stacked stones under the tread nose
    const rTop = topY - ts + 0.006;
    // the first riser is buried well below the under-tread trench (ramp − 0.18) so no gap can
    // open between it and the joint fill at the stair foot
    const rBottom = i === 0 ? baseY - 0.32 : baseY + i * def.rise - 0.05;
    const rh = rTop - rBottom;
    // round 31: one stone in most risers, two in a quarter, never three (frame 8 s: the riser
    // band under each lip is one dark recess, not stacked pieces)
    const nR = rng.chance(0.75) ? 1 : 2;
    let a = -hw + 0.02;
    for (let r = 0; r < nR; r++) {
      const remaining = hw - 0.02 - a;
      const len = r === nR - 1 ? remaining : clamp(remaining / (nR - r) + rng.range(-0.25, 0.25), 0.3, remaining - 0.3 * (nR - r - 1));
      // risers read as shadowed warm stone (reference #453e32 under #746d5d treads) with a moss
      // skin creeping over them from the joints. Round 23: a shade lighter than round 22's
      // 0.27–0.35 — the frame's riser troughs sit at the same luminance as ours (≈ 0.25), it is
      // the lip and the tread's own face that were too bright, so the tread face comes down to
      // meet the riser (above) and the riser comes up a little to meet it. Round 31: up again
      // (0.31–0.39 → 0.38–0.46) — with the deep nose overhang the whole face sits in the tread's
      // shadow, and frame 8 s reads its riser band at 0.31 (p10 of the flight box) against our
      // 0.23, frame 1 s' mid-flight troughs at 0.29–0.36 against our 0.26–0.27
      const rc = 0.38 + rng.range(0, 0.08);
      // more vertices along the face (segs 7) so the moss patches below can vary every 15–40 cm
      const riserOutline = jitteredRect(rng, len - 0.015, def.tread * 0.9, { jitter: 0.012, segs: 7, chip: 0.05, chipChance: 0.3 });
      const ac = a + len / 2;
      const uc = i * def.tread + 0.01 + (def.tread * 0.9) / 2;
      // the first riser stands in the plaza soil (heightfield: the approach banks up ~9 cm to the
      // foot): its face carries the soil stain higher, like a stone half sunk into the ground
      const footStain = i === 0 ? 2.0 : 1.0;
      // a touch cooler than neutral: frame 8 s reads the risers at sat 0.17 / B/R 0.71 face-on
      // where ours rendered 0.20 / 0.67 (the post chain passes ~1/4 of an albedo shift)
      const riserColor: [number, number, number] = [rc * 0.99, rc, rc * 1.1];
      // round 42: a fissure up two riser faces in five (hash fork on the step, so the stream is
      // untouched) — the stone shader's dirt-filled crack (`aCrack`) on the side walls: it starts
      // at the foot at a random point along the face, leans up to ± 20° and peters out between
      // half and nine tenths of the way up (the shader fades the last quarter of its length)
      const frng = rng.fork(`fissure/${i}/${r}`);
      const fissured = frng.chance(0.4);
      const fissA = frng.range(-0.4, 0.4) * (len - 0.015);
      const fissLean = frng.range(-0.35, 0.35);
      const fissTop = frng.range(0.5, 0.9) * rh;
      // the tread/riser corner (sheet 04, frame 03): moss sits thicker at the very foot of the
      // riser where it meets the tread below — a hash-forked weight per riser, 0.6–1.4
      const cornerMoss = 0.6 + 0.8 * frng();
      placeSlab(riserOutline, ac, rBottom, uc, yaw * 0.5, 0, 0, {
        thickness: rh,
        bevel: 0.012,
        color: riserColor,
        sideColor: [riserColor[0] * 0.92, riserColor[1] * 0.9, riserColor[2] * 0.9],
        // round 44 (crop 36): the house-west risers' faces take a third of the top's shading
        // normal and the shader's grime / lichen mottling, so in the giant's shade they read as
        // weathered stone under the lip rather than flat black; the main run's are the control's
        sideNormalUp: isMain ? 0 : 0.3,
        sideWear: isMain ? 0 : 0.7,
        // across: the horizontal distance from the leaning line x = fissA + lean · y; along: the
        // height over the fissure's half-length (the shader fades it out toward its top). Affine
        // over every wall, so it is exact on the front face; the back face is under the tread
        // and the ends are inside the flight, so nowhere else shows it
        sideCrackFn: fissured ? (x, y) => [x - fissA - fissLean * y, (y - fissTop * 0.5) / (fissTop * 0.5)] : undefined,
        // soil stain at the foot fading to none under the nosing: the face is not one flat band
        // but darker and browner where it meets the tread below, lighter under the overhang
        sideStain: footStain,
        // mossy risers (sheet 01 / 04): a moss skin creeps up the face from the tread below —
        // strongest toward the flanks — broken into patches by the noise so it reads as
        // cushions of moss between bare dark stone, not a green wash. Round 23: the general
        // film is thinner (a thin film renders as dark grime, which made the risers a black
        // band) and the patches are fuller and flank-heavy, so where there is moss it is green
        // and the centre third stays bare stone
        mossEdge: 0.4 * cornerMoss,
        mossInner: 0.15,
        mossFn: (x, z) => 0.3 + 0.8 * mossAt(x + ac, z + uc),
        mossAdd: (x) => {
          const patch = smoothstep(0.36, 0.64, noise.fbm((x + ac) * 3.1 + 5.5, i * 11.7 + r * 3.3, 2) * 0.5 + 0.5);
          const flankBias = 0.3 + 1.0 * (1 - feet(x + ac));
          return 1.6 * flankBias * patch * (0.55 + 0.45 * mossAt(x + ac, uc));
        },
        // riser shadow: darker toward the flanks; damp patches along the face a shade darker
        colorFn: (x) => {
          const k = 1 - 0.2 * smoothstep(hw - 0.9, hw + 0.05, Math.abs(x + ac));
          const damp = smoothstep(0.1, 0.6, noise.fbm((x + ac) * 2.2 + 9.1, i * 7.3 + r, 2));
          return [k * (1 - 0.06 * damp), k * (1 - 0.05 * damp), k * (1 - 0.02 * damp)];
        },
        uvScale,
        uvOffset: [rng() * 3, rng() * 3],
        rings: 1,
      });
      a += len;
    }
  }

  // cheeks: the grass bank beside the run is flush with the treads (heightfield), so the flanks
  // are only punctuated by sparse, half-buried edging stones — irregular, mossy, sunk into the
  // bank — like the loose kerb stones in the reference rather than a continuous wall
  // Round 23: on the main run's south-east flank (local −x, the side cameras A and F look along)
  // frame 1 s shows grass and leaves lapping over the step ends with no kerb line at all — only
  // the mossy boulder at the foot — while our row of proud stones read as a straight kerb up the
  // whole flight. That side keeps one stone in three (a stateless hash decides, so the stream and
  // with it the north-west flank and the landing are byte-identical to before), seated on the
  // raised bank the heightfield builds there (`SE_BANK_LIFT` in terrain/heightfield.ts) with only
  // 2–8 cm showing, mossed over: half-buried lumps in the turf. The north-west flank (toward the
  // house, seen end-on in B) is unchanged. Round 32: the house-west flight keeps the proud stones
  // on both flanks — frame 14 s reads its south flank (face-on to camera B at 10–12 m) as pale
  // stones climbing a grassy rise, which is the tread ends and these cheeks in the turf
  // (round 31 had buried them under a 0.3 m turf lip; that flight is gone).
  for (const side of [-1, 1]) {
    const southEast = isMain && side < 0;
    let u = rng.range(-0.15, 0.45);
    while (u < f.run + 0.2) {
      const len = rng.range(0.42, 0.78);
      const cw = rng.range(0.3, 0.5);
      const uc = u + len / 2;
      const ramp = baseY + clamp(uc / f.run, 0, 1) * def.rise * def.steps;
      // top just proud of the bank (+0.07 over the ramp) so the stones read as embedded
      const proud = 0.07 + rng.range(0.04, 0.13);
      const th = rng.range(0.28, 0.4);
      const ac = side * (hw + 0.1 + cw / 2 + rng.range(-0.03, 0.06));
      const outline = jitteredRect(rng, cw, len, { jitter: 0.04, segs: 3, chip: 0.12, chipChance: 0.8 });
      const tint = 0.64 + rng.range(0, 0.18);
      const yawJ = rng.range(-0.25, 0.25);
      const tiltXJ = rng.range(-0.08, 0.08);
      const tiltZJ = side * rng.range(-0.04, 0.12);
      const bevelJ = rng.range(0.035, 0.06);
      const uvJ: [number, number] = [rng() * 3, rng() * 3];
      const advance = rng.range(0.55, 1.5);
      let top = ramp + proud;
      let keep = true;
      if (southEast) {
        keep = hash2(Math.round(uc * 100), 23, 7) < 0.34;
        const [wx, wz] = stairToWorld(f, ac, uc);
        // seated on the bank itself (whatever the heightfield makes of it), 2–8 cm showing
        top = terrain.height(wx, wz) - def.base[1] + 0.02 + 0.06 * hash2(Math.round(uc * 100), 23, 11);
      }
      if (keep) {
        // round 44 (survey-1, crop 36 — the house-west flight's step blocks): these cheeks stand
        // 15–25 cm proud on both flanks of the short flight (round 32 keeps them proud for camera
        // B), and at player height from the path (w29-house-d, 1.6 m) their faces rendered as flat
        // near-black planes with a hard top/side break — the flat side colour (× 0.7, grime × 0.75)
        // under the true outward normal in the giant's shade. The house-west blocks take the
        // kerb treatment: the face in the top's own stone (× 0.88), its shading normal half-way
        // to +y (sideNormalUp 0.5 — lit like the top, the shadow map still shades it), the
        // shader's grime / lichen mottling on the face (sideWear), a soil band at the foot
        // (sideStain), and a 5–8 cm two-band roll (bevelRings 2, softBevel) instead of a
        // one-crease chamfer. Draw-free: only the slab options change. The main run's cheeks are
        // the control's (cameras A / F).
        const block = !isMain;
        placeSlab(outline, ac, top - th, uc, yawJ, tiltXJ * (southEast ? 2 : 1), tiltZJ, {
          thickness: th,
          bevel: block ? bevelJ * 1.4 : bevelJ,
          bevelRings: block ? 2 : 1,
          softBevel: block,
          dip: -0.01,
          color: [tint, tint, tint * 0.97],
          sideColor: block ? [tint * 0.88, tint * 0.88, tint * 0.9] : [tint * 0.7, tint * 0.7, tint * 0.72],
          sideNormalUp: block ? 0.5 : 0,
          sideGrime: block ? 0.9 : 0.75,
          sideStain: block ? 0.9 : 0,
          sideWear: block ? 0.9 : 0,
          wear: block ? 0.6 : 0,
          mossEdge: 1.0,
          mossInner: southEast ? 0.85 : 0.6,
          mossFn: (x, z) => 0.55 + 0.45 * (noise.fbm((x + ac) * 2.3, (z + uc) * 2.3 + 5, 2) * 0.5 + 0.5),
          uvScale,
          uvOffset: uvJ,
          rings: 1,
        });
      }
      u += len + advance;
    }
  }

  // landing: slabs on the plateau just past the top step
  {
    const topY = baseY + def.steps * def.rise;
    const rows = [
      [f.run + 0.03, f.run + 0.78],
      [f.run + 0.83, f.run + 1.62],
    ].slice(0, landingRows(def));
    for (const [u0, u1] of rows) {
      const cols = rng.chance(0.5) ? 2 : 3;
      let a = -hw - 0.05;
      const total = w + 0.1;
      for (let c = 0; c < cols; c++) {
        const len = c === cols - 1 ? -hw + 0.05 + total - a - 0.04 : total / cols + rng.range(-0.15, 0.15);
        const ac = a + len / 2;
        const uc = (u0 + u1) / 2;
        const [wx, wz] = stairToWorld(f, ac, uc);
        const ground = terrain.height(wx, wz) - def.base[1];
        // Round 38: the main run's landing is the walkable top of the flight — the character's
        // ground reads the analytic terrace height (base.y + steps · rise) there, and its feet
        // stand on the rendered slab tops. Seated on the terrain (+5 cm) the slabs followed the
        // ±14 cm breakup the heightfield leaves under the stair mask: tops from −4 to +2.8 cm of
        // the terrace height, the boots floating over the proud ones. The rim now sits 4 mm
        // over the analytic plane and the dish sags 8 mm, so the whole walked surface is within
        // ±0.4 cm of it; each slab is as thick as it needs to be to sit ≥ 3 cm into the ground
        // at its lowest corner (buried sides — nothing of this shows from A / F, which look up
        // at the landing's lip from 3.6 m below it). The house-west flight keeps its seated,
        // gently falling landing: its head eases to the lawn's 1.56 m and B / E frame its edge.
        const flushLanding = isMain;
        const top = flushLanding ? topY + 0.004 : Math.max(ground + 0.05, topY - 0.02 - (uc - f.run) * 0.03);
        let th = rng.range(0.07, 0.1);
        if (flushLanding) {
          let groundMin = ground;
          for (const [da, du] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]] as const) {
            const [cx, cz] = stairToWorld(f, ac + da * (len - 0.04), uc + du * (u1 - u0 - 0.04));
            groundMin = Math.min(groundMin, terrain.height(cx, cz) - def.base[1]);
          }
          th = Math.max(th, top - groundMin + 0.03);
        }
        const outline = jitteredRect(rng, len - 0.04, u1 - u0 - 0.04, { jitter: 0.02, segs: 4, chip: 0.1, chipChance: 0.5 });
        const tint = 0.8 + rng.range(0, 0.16);
        placeSlab(outline, ac, top - th, uc, rng.range(-0.05, 0.05), 0, 0, {
          thickness: th,
          bevel: 0.025,
          dip: flushLanding ? 0.008 : 0.012,
          color: [tint, tint, tint * 0.97],
          mossEdge: 0.7,
          mossInner: 0.15,
          mossFn: (x, z) => 0.4 + 0.6 * (noise.fbm((x + ac) * 2.1 + 9, (z + uc) * 2.1, 2) * 0.5 + 0.5),
          uvScale,
          uvOffset: [rng() * 3, rng() * 3],
          rings: 2,
        });
        a += len + 0.04;
      }
    }
  }

  // apron: the paved shelf in front of the first riser of a flight whose foot stands on the
  // paving (the house-west flight; terrain/heightfield.ts flattens it to the flight's base level).
  // Round 38 (hardscape-29, landed round 42): frame 56 s reads it as the flight's wide first
  // tread — a pale flat slab at the path's edge with its kerb face standing over the path's
  // stones (D x 0.72–0.95, y 0.72–0.85) — where ours was flattened but stoneless, and its bare
  // joint-fill soil was the brightest thing in D's lower right. Two slabs across the flight's
  // width, each as deep as the flat shelf under it (the west edge follows the line where the
  // ground falls 0.12 m off the shelf toward the path) and as thick as it needs to sit 4 cm into
  // the ground at its lowest corner, so the kerb is a stone face down to the path. Confined to
  // the flight's width (the cheeks stand on the flanks from u −0.15) and to u < −0.03 (the first
  // riser's face is at u ≈ 0.01, the tread nose overhangs to −0.08). Own stream fork, laid last:
  // every draw above keeps its place. Round 42 lowered the flight's base to 0.18 m (layout.ts),
  // so the shelf is a low first tread 0.18 m over the path, as the frame's low first lip reads.
  if (hasPavedApron(def)) {
    const arng = rng.fork('apron');
    const localH = (a: number, u: number) => {
      const [wx, wz] = stairToWorld(f, a, u);
      return terrain.height(wx, wz) - def.base[1];
    };
    /** metres in front of the riser face where the ground has fallen 0.12 m off the shelf (the kerb's foot) */
    const shelfDepth = (a: number) => {
      let au = 0.15;
      while (au < 1.6 && localH(a, -au) > -0.12) au += 0.05;
      return au;
    };
    const top = baseY + 0.035;
    const aS = -hw - 0.05;
    const aN = hw + 0.05;
    const split = (aS + aN) / 2 + arng.range(-0.2, 0.2);
    for (const [a0, a1] of [
      [aS, split - 0.02],
      [split + 0.02, aN],
    ]) {
      const ac = (a0 + a1) / 2;
      // west edge: five points on the kerb's foot line, plus 3 cm so the face stands on the path
      const west: [number, number][] = [];
      for (let k = 0; k <= 4; k++) {
        const ak = a0 + ((a1 - a0) * k) / 4;
        west.push([ak, -(shelfDepth(ak) + 0.03) + arng.range(-0.015, 0.015)]);
      }
      const uW = Math.min(...west.map((p) => p[1]));
      const uc = (uW - 0.03) / 2;
      const outline: P2[] = [
        { x: a0 - ac, z: -0.03 - uc },
        { x: (a0 + a1) / 2 - ac + arng.range(-0.02, 0.02), z: -0.03 - uc + arng.range(-0.012, 0.012) },
        { x: a1 - ac, z: -0.03 - uc },
        ...west.reverse().map(([ak, uk], k) => ({ x: ak - ac + (k === 0 || k === 4 ? 0 : arng.range(-0.02, 0.02)), z: uk - uc })),
      ];
      let groundMin = localH(ac, uc);
      for (const p of outline) groundMin = Math.min(groundMin, localH(ac + p.x, uc + p.z));
      const th = top - groundMin + 0.04;
      const tint = 0.82 + arng.range(0, 0.12);
      placeSlab(ccw(outline), ac, top - th, uc, 0, 0, 0, {
        thickness: th,
        bevel: 0.03,
        dip: 0.008,
        color: [tint, tint, tint * 0.97],
        // the kerb face: the top's own stone, lit like the top (its shading normal 70 % toward +y,
        // no grime band), a trace of soil at the path line and a thin moss film. The apron stands
        // in the north-west-near giant's canopy shade, where a true west-facing wall gets half the
        // sky and rendered — grey-brown (× 0.62, stain 1.2) or pale (× 0.9, stain 0.4) — as a dark
        // block beside Link's head in camera B (frame 14 s has smooth pale path there; the SSIM
        // window at B (0.44–0.47, 0.64–0.69) swung from +0.5 to −0.5: B −0.0010 / −0.0013), while
        // the same slabs gained D +0.0018 (frame 56 s's pale first tread at D x 0.72–0.95).
        sideColor: [tint, tint, tint * 0.97],
        sideNormalUp: 0.7,
        sideGrime: 1,
        sideStain: 0.25,
        softBevel: true,
        bevelRings: 2,
        mossEdge: 0.15,
        mossInner: 0.05,
        mossFn: (x, z) => 0.4 + 0.6 * (noise.fbm((x + ac) * 2.1 + 17, (z + uc) * 2.1 + 3, 2) * 0.5 + 0.5),
        uvScale,
        uvOffset: [arng() * 3, arng() * 3],
        // round 44 (crop 36's "diagonal crease on the transition slab"): the 8-point outline's
        // dished top fanned in two rings showed its triangulation under the grazing light; three
        // rings and the validated fan centre smooth it
        rings: 3,
        notchedTop: true,
        sideWear: 0.6,
      });
    }
  }

  all.transform(f.matrix);
  const geometry = all.build();
  return { geometry, steps: def.steps, treadSlabs, shapeHashes, triangles: all.vertexCount / 3, treadNose };
}
