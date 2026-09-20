/**
 * Where on the paving each treatment applies — shared by the flagstone lattice (slab size and
 * joint width), the joint fill (turf / moss / soil) and the joint flora. All soft weights 0..1;
 * world axes: north = −z, east = +x.
 */
import { LAYOUT } from '../layout';
import { Noise2D, smoothstep } from '../util/noise';

/**
 * The damp band: where the path leaves the plaza northward under the canopy (reference B/E
 * foreground, camera B's lower quarter is z ≈ −1.5 → −5.5) the stones are darker, greyer and
 * mossier. Everywhere else — the open plaza south of the spawn (A/F) and the north path beyond
 * the band (camera D's foreground, z ≈ −6.6 → −11) — the paving is pale. 1 inside the band.
 */
export function dampBand(z: number) {
  return smoothstep(0.8, -1.8, z) * smoothstep(-6.3, -4.8, z);
}

/**
 * the open plaza south of the spawn (cameras A/F look across it): 1 there, 0 on the north path.
 * Camera B's frame bottom is z ≈ −1.5 → −0.5, so the ramp sits north of z = 1 and B's foreground
 * keeps the big damp-band and north-path stones.
 */
export function southPlaza(z: number) {
  return smoothstep(-1.0, 1.0, z);
}

/**
 * camera D's foreground path (reference D: three or four 1–1.5 m slabs fill the bottom quarter,
 * clearly domed, set in tight dark joints)
 */
export function dForeground(z: number) {
  return smoothstep(-5.5, -7.0, z) * smoothstep(-13, -10.5, z);
}

/**
 * Round 33: the disc field — the spine north of the plaza as cameras B/E (behind Link, y 0.6–0.8:
 * z −4 … −12), C (foreground, z −5 … −3) and D (foreground, z −6.5 … −10.5) all show it: rounded,
 * softly domed 0.8–1.3 m stones (D's 1.5–2.5 m slabs keep their size) set in 9–22 cm gaps of
 * dark earth and grass, not a lattice in hairline seams. Measured on frame 14 s at 3× (our depth
 * for the scale): stones 0.85–1.3 m across behind Link with 0.08–0.2 m gaps, wider earth patches
 * where a stone is missing; frame 56 s: 1–2 m ovals in 0.1–0.3 m grassy gaps. 1 along the spine
 * from z −1.2 to −13, fading over 1.5 m at the south end (camera B's authored bottom row keeps its
 * own lawn-slab style) and 2 m at the north (the plain path beyond, 13–20 m from B).
 */
export function discField(x: number, z: number) {
  const along = smoothstep(-0.4, -1.9, z) * smoothstep(-14.5, -12.5, z);
  // the spine's paved width is ~4.8 m (pathHalfWidth 2.4): fade out beyond ±3 m of its centreline
  const cx = z > -6 ? 0.6 * smoothstep(0, -6, z) : 0.6 + 0.9 * smoothstep(-6, -12, z);
  const across = smoothstep(3.6, 2.6, Math.abs(x - cx));
  return along * across;
}

/**
 * Round 33: the plaza's east-centre, between the spine and the stair foot (x 3.5 … 6.5,
 * z −3 … +2.5), which frame 46 s (camera C, frame x 0.2–0.45 / y 0.6–0.75) shows as dark
 * trodden earth with a few scattered flat stones — and frame 1 s (camera A, the same ground at
 * frame (0.54–0.66, 0.62–0.72), right of Link's head) as the darkest part of its plaza (p50 0.42
 * against 0.48–0.55 around it). Cells here are left as earth by `earthPatch` × the thinning
 * chance (flagstones.ts); the fill under them is the dark trodden earth (joints.ts). 1 inside,
 * fading over 1.6 m; nothing over camera B's authored slabs (z > −2.7 at x < 4.1 is the
 * plaza's north-east lawn paving, kept).
 */
export function earthPatch(x: number, z: number) {
  const box = softBox(x, z, 3.6, 6.6, -3.0, 2.4, 1.6);
  // keep clear of the pathToStairs branch's east end (the stair apron, x > 6.4)
  return box * smoothstep(7.2, 6.2, x);
}

/** 1 inside the box, fading to 0 over `fade` metres straddling each edge (a third inside, two thirds outside) */
function softBox(x: number, z: number, x0: number, x1: number, z0: number, z1: number, fade: number) {
  const fx = smoothstep(x0 - fade * 0.65, x0 + fade * 0.35, x) * smoothstep(x1 + fade * 0.65, x1 - fade * 0.35, x);
  const fz = smoothstep(z0 - fade * 0.65, z0 + fade * 0.35, z) * smoothstep(z1 + fade * 0.65, z1 - fade * 0.35, z);
  return fx * fz;
}

/**
 * The lawn paving (reference B/E foreground, C/D lower thirds): big rounded slabs set in turf,
 * not in soil seams — the spine from the plaza's north edge to the mist hollow's mouth
 * (x −1.5 … 3.5, z −0.5 … −6.5) and the plaza's north-east quadrant out to where the stepping
 * stones to Saria's door leave it (pathToHouse starts at (0.5, −2)). Fades over ≈ 1.5 m into the
 * ordinary paving on every side; the south fade is done by z ≈ +1, well short of camera A's
 * plaza box (z ≈ 2 → 5.5).
 */
export function lawnZone(x: number, z: number) {
  const spine = softBox(x, z, -1.5, 3.5, -6.5, -0.5, 1.5);
  const northEast = softBox(x, z, 0.0, 4.2, -3.0, 0.2, 1.5);
  return Math.max(spine, northEast);
}

/**
 * Camera A's near foreground (reference frame 1 s: 1.1–1.3 m slabs with cracked edges and soft
 * moss seams across the frame bottom): the cell breaking leaves the stones here at the top of
 * the boards' range instead of the 0.6–0.7 m median, and the lattices are thinned (flagstones.ts).
 * Round 33: z 3.4 → 1.2 — unprojected, camera A's bottom quarter (frame y 0.75–1.0) is z 1.5–6.7
 * at x −0.5 … 4.3, not z 4–7; the zone used to cover only its last tenth. Fades over 1.2 m.
 */
export function aForeground(x: number, z: number) {
  return softBox(x, z, -1.5, 4.5, 1.2, 8.5, 1.2);
}

/**
 * Camera B/E's foreground slabs, authored to the reference composition (W37 scores B_house):
 * the centres of the slabs readable in reference frame B (640 × 358) unprojected through
 * camera B onto the terrain — the bottom row (px y ≈ 330: x 60, 200, 360, 450, 570), the pair
 * behind Link (255,283 / 330,258) and the slab left of his boots (245,262). The Voronoi cells
 * around these seeds put our slab edges where the reference has its joints (its bottom-row
 * slabs span 1.5–1.8 m: s2 px 130–300, s3 290–440). Seeds that land off the paving (the slab
 * at 395,252 sits on Saria's grass ramp in our layout) are simply not placed.
 */
export const B_FOREGROUND_SLABS: [number, number][] = [
  [-0.94, -2.54], // px 60,340 — bottom-left corner slab, in the lawn
  [0.45, -2.32], // px 200,332 — big slab left of centre (spans x −0.35 … 1.24)
  [1.9, -1.92], // px 360,330 — the slab under Link's boots (x 1.17 … 2.60)
  [3.4, -2.56], // px 450,298 — right of Link (x 2.78 … 4.01)
  [4.2, -1.4], // px 570,322 — bottom-right slab, plaza north-east
  [1.22, -4.27], // px 255,283 — behind Link's left leg
  [2.94, -5.66], // px 330,258 — behind Link, path centre
  [1.38, -6.08], // px 245,262 — the slab where the path narrows (x 0.57 … 2.19)
  [4.59, -6.07], // px 395,252 — on the grass ramp in our layout: dropped by the paved test
];

/**
 * x of the paving's west edge in reference frame B, by z (px 130,330 / 190,300 / 200,270 /
 * 200,250 unprojected): west of it the reference is lawn — dark green grass and trodden dirt,
 * no slabs (box 0.02–0.28 × 0.68–0.82 of the frame: lum p50 0.28, hue 59°, sat 0.55).
 */
export function lawnPocketEdgeX(z: number) {
  const pts: [number, number][] = [
    [-2.62, -0.35],
    [-3.61, 0.26],
    [-5.45, 0.51],
    [-7.95, 0.68],
  ];
  if (z >= pts[0][0]) return pts[0][1];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [z0, x0] = pts[i];
    const [z1, x1] = pts[i + 1];
    if (z <= z0 && z >= z1) return x0 + ((z - z0) / (z1 - z0)) * (x1 - x0);
  }
  return pts[pts.length - 1][1];
}

/**
 * The slab-free lawn pocket west of that edge, from the plaza's north rim to z ≈ −6.5 (camera
 * D's frame bottom starts at z −6.6 and reference D has slabs there): no lattice seeds, the
 * fill turns to dark lawn, the tufts thicken. 1 inside.
 */
export function lawnPocket(x: number, z: number) {
  const ex = lawnPocketEdgeX(z);
  return smoothstep(ex - 0.05, ex - 0.45, x) * smoothstep(-2.6, -3.1, z) * smoothstep(-6.9, -6.3, z);
}

/** squared distance from (x, z) to the segment a–b (xz of layout points) */
function segDist2(x: number, z: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const l2 = dx * dx + dz * dz || 1e-9;
  let t = ((x - a[0]) * dx + (z - a[2]) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = a[0] + dx * t - x;
  const pz = a[2] + dz * t - z;
  return px * px + pz * pz;
}

/**
 * The trodden strip: the metre down the middle of the spine north of the plaza where feet keep
 * the turf off the seams (reference B: the centre path recedes pale into the mist between the
 * lawn-set slabs on either side). 1 within 0.45 m of the spine's centreline, 0 beyond 1.0 m;
 * nothing south of the plaza's north edge (the lawn owns the plaza's north-east, soil the south).
 */
export function troddenStrip(x: number, z: number) {
  const spine = LAYOUT.pathSpine;
  let d2 = Infinity;
  for (let i = 0; i + 1 < spine.length; i++) {
    if (spine[i][2] > 1 && spine[i + 1][2] > 1) continue;
    d2 = Math.min(d2, segDist2(x, z, spine[i], spine[i + 1]));
  }
  return smoothstep(1.0, 0.45, Math.sqrt(d2)) * smoothstep(0.5, -1.5, z);
}

/**
 * Round 44 (survey-1 #8): the hollow path — the spine from the mouth of the mist hollow down
 * its floor and up the 30 % climb toward the arch (z −15.5 … −33). At player height (survey
 * frames w11–w15) its slabs read as 10 cm tiles standing on flat dirt: the half-tilt seating
 * left the downhill edge of every slab on the grade as a clean vertical wall with a hard
 * shadow. Here the slabs are seated INTO the ground (flagstones.ts: tilted with the grade, rim
 * sunk 2–4 cm under the fill, domed so the top emerges from a soil lip), their edges rolled
 * wider, and the joints carry grit (index.ts). 1 along the stretch, fading over 2 m at each
 * end (camera D reads z −13 … −15 as the plain path) and beyond 3.2 m of the spine's centreline.
 */
export function hollowPath(x: number, z: number) {
  const along = smoothstep(-13.5, -15.5, z) * smoothstep(-35, -33, z);
  if (along <= 0) return 0;
  const spine = LAYOUT.pathSpine;
  let d2 = Infinity;
  for (let i = 0; i + 1 < spine.length; i++) {
    if (spine[i][2] > -8 && spine[i + 1][2] > -8) continue;
    d2 = Math.min(d2, segDist2(x, z, spine[i], spine[i + 1]));
  }
  return along * smoothstep(4.2, 3.2, Math.sqrt(d2));
}

/**
 * Round 44 (survey-1 #8): the arch seam — the ground where the north path passes under the log
 * arch. The arch's structure mask (heightfield.ts `surfaceMask`) is a hard 0/1 band 0.9 R either
 * side of the bent axis, and the paving stops dead at it, so the gravel floor under the log met
 * the slabs along a dead-straight line (survey frame w20-spine-d). `archSeam` is 1 on the band's
 * two edges (within 0.9 m of |lvc| = 0.9 R along the log's width), fading over 0.6 m — the
 * paving is let through it in tongues (flagstones.ts `pavedLevel`) and its joints take the
 * gravel's grit (index.ts). `archInside` is the signed distance (m) from the band's edge, positive
 * inside the band (under the log), computed from `LAYOUT.logArch` exactly as the heightfield does.
 */
const ARCH = (() => {
  const la = LAYOUT.logArch;
  const yaw = (la.yawDeg * Math.PI) / 180;
  return { cx: la.position[0], cz: la.position[2], ax: Math.cos(yaw), az: -Math.sin(yaw), L: la.length, R: la.radius };
})();
export function archInside(x: number, z: number): number {
  const dx = x - ARCH.cx;
  const dz = z - ARCH.cz;
  const lu = dx * ARCH.ax + dz * ARCH.az;
  const lv = -dx * ARCH.az + dz * ARCH.ax;
  const k = Math.min(1, Math.max(0, (-ARCH.L * 0.15 - lu) / (ARCH.L * 0.35)));
  const lvc = lv - 1.8 * k * k;
  // inside along the axis (the mask's end cap) and across it: the smaller signed margin
  const alongIn = ARCH.L / 2 + 0.3 * k - Math.abs(lu);
  const acrossIn = Math.min(lvc + ARCH.R * 0.9, ARCH.R * 0.9 + 0.6 * k - lvc);
  return Math.min(alongIn, acrossIn);
}
export function archSeam(x: number, z: number) {
  const d = archInside(x, z);
  return smoothstep(-1.5, -0.9, d) * smoothstep(1.5, 0.9, d);
}

/**
 * Round 48 (round 47's handoff): the tunnel floor's NORTH seam — the paving just past the log's
 * north lip (z ≈ −57.5 … −59.5 at x 4–8). The south approach's seam is the gravel floor thinning
 * into the paving (`archSeam` above, pale dust); under the north lip the floor is in the log's
 * shade and the ground there is the litter that falls off the log's belly, so the seam is the
 * opposite: dark soil and bark litter washed OUT over the first slabs in tongues. 1 on the
 * paving within a tongue's reach of the lip (0.35 m almost everywhere, 0.9–1.3 m where the
 * along-edge noise peaks, fading over 0.3 m), 0 under the log (`archInside` > 0) and on the
 * south lip. Fixed-seed noise, no stream draws.
 */
const LIP_N = new Noise2D('arch-north-lip');
export function archNorthLip(x: number, z: number): number {
  const dx = x - ARCH.cx;
  const dz = z - ARCH.cz;
  const lu = dx * ARCH.ax + dz * ARCH.az;
  const lv = -dx * ARCH.az + dz * ARCH.ax;
  if (Math.abs(lu) > ARCH.L / 2) return 0;
  const k = Math.min(1, Math.max(0, (-ARCH.L * 0.15 - lu) / (ARCH.L * 0.35)));
  const lvc = lv - 1.8 * k * k;
  // metres out from the north lip's edge (lvc = −0.9 R), positive on the paving side
  const out = -(lvc + ARCH.R * 0.9);
  if (out < -0.3 || out > 1.6) return 0;
  const n = LIP_N.fbm(lu * 0.85 + 2.2, 0.5, 2) * 0.5 + 0.5;
  const reach = 0.35 + 0.95 * smoothstep(0.42, 0.78, n);
  return smoothstep(-0.25, 0.05, out) * smoothstep(reach, reach - 0.3, out);
}

/**
 * How much of the joint fill is bare soil (0 = turf / moss, 1 = packed dirt): the dry plaza core
 * south of the spawn (camera A's foreground — reference A's plaza joints are dark green-brown,
 * board 02's seams dark dirt with moss; round 12 makes the soil itself that damp dark seam soil
 * (joints.ts JOINT_SOIL, a third of round 10's luminance), so the core is 90 % soil again) and
 * the trodden strip; the lawn zone overrides both toward turf.
 */
export function jointSoil(x: number, z: number) {
  // the strip is half soil: reference D's centre joints are a browner shade of the same dark
  // olive as its edge joints, not bare dirt
  // (round 22: 0.9 -> 0.6 - frame 1 s's plaza joints are dark green-brown, ours read bare brown)
  // (round 33: the strip's soil is cut to a fifth inside the disc field - its 9–22 cm gaps would
  // dry out to the pale open dirt, where frames 14 s / 56 s show dark earth and grass between the
  // stones; the earth patch of camera C's plaza is the dark trodden earth, not packed soil)
  const soil = Math.max(0.6 * southPlaza(z), 0.5 * troddenStrip(x, z) * (1 - 0.8 * discField(x, z)));
  return soil * (1 - 0.85 * lawnZone(x, z)) * (1 - lawnPocket(x, z)) * (1 - earthPatch(x, z));
}
