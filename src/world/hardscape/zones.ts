/**
 * Where on the paving each treatment applies — shared by the flagstone lattice (slab size and
 * joint width), the joint fill (turf / moss / soil) and the joint flora. All soft weights 0..1;
 * world axes: north = −z, east = +x.
 */
import { LAYOUT } from '../layout';
import { smoothstep } from '../util/noise';

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
 * Camera A's near foreground (reference frame 1 s: five or six ~1 m slabs with cracked edges and
 * dark seams across the 5.7 m frame bottom, z ≈ 4 → 7): the cell breaking leaves the stones here
 * at the top of the boards' range instead of the 0.6–0.7 m median. Fades over 1.2 m.
 */
export function aForeground(x: number, z: number) {
  return softBox(x, z, -1.5, 4.5, 3.4, 8.5, 1.2);
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
 * How much of the joint fill is bare soil (0 = turf / moss, 1 = packed dirt): the dry plaza core
 * south of the spawn (camera A's foreground — reference A's plaza joints are dark green-brown,
 * board 02's seams dark dirt with moss; round 12 makes the soil itself that damp dark seam soil
 * (joints.ts JOINT_SOIL, a third of round 10's luminance), so the core is 90 % soil again) and
 * the trodden strip; the lawn zone overrides both toward turf.
 */
export function jointSoil(x: number, z: number) {
  // the strip is half soil: reference D's centre joints are a browner shade of the same dark
  // olive as its edge joints, not bare dirt
  const soil = Math.max(0.9 * southPlaza(z), 0.5 * troddenStrip(x, z));
  return soil * (1 - 0.85 * lawnZone(x, z)) * (1 - lawnPocket(x, z));
}
