import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { Builder } from '../core/builder';
import type { V3 } from '../core/geom';
import type { ColorKey } from '../core/palette';
import type { BattleDroid } from './types';
import { boxAt, cRing, clamp01, cylAt, emit, lerp, loft, newTally, pivot, rod, type Tally } from './c-kit';

/**
 * B1 battle droid minifig, after the moulded LEGO droid: a curved snout head hung from a hinge on
 * top of a neck post, a shoulder yoke and chest over V struts, a big backpack, clip-on arms with
 * elbows and C-hands, thin legs with knee knuckles and wedge feet. ~5 studs tall, tan. Variants add
 * the rank colour: commander yellow and pilot blue (head crown and chest), security a red torso.
 * The E-5 blaster sits in the right hand. Origin between the feet, y = 0 at the soles, facing +Z.
 * Pivots: legs and torso on the hip axis, head at the base of the neck post, arms on the shoulder
 * axles with the forearm as `<arm>.userData.elbow`, blaster in the right hand.
 */

type Variant = 'standard' | 'commander' | 'pilot' | 'security';
const MARK: Record<Variant, ColorKey | null> = { standard: null, commander: 'yellow', pilot: 'blue', security: 'red' };

const HIP_Y = 2.1, HIP_X = 0.3;
const SHOULDER: V3 = [0.7, 3.49, 0];
const NECK: V3 = [0, 3.8, -0.06];
const HINGE: V3 = [0, 4.73, -0.1];
const UPPER = 0.72;
/** C-hand centre in forearm space (port arm; −X is inward). */
const HAND: V3 = [-0.04, -0.8, 0];

// ---------------------------------------------------------------------------------------------
// head: loft along a spine from the hinge over the crown and down to the snout tip
// rows: [y, z, half width, outer half thickness, inner half thickness]

const SPINE: number[][] = [
  [4.73, -0.1, 0.11, 0.1, 0.1],
  [4.84, -0.02, 0.2, 0.14, 0.14],
  [4.86, 0.1, 0.26, 0.17, 0.19],
  [4.79, 0.23, 0.29, 0.18, 0.2],
  [4.64, 0.33, 0.29, 0.17, 0.19],
  [4.46, 0.41, 0.26, 0.155, 0.16],
  [4.28, 0.48, 0.22, 0.135, 0.13],
  [4.12, 0.54, 0.18, 0.11, 0.1],
  [4.0, 0.58, 0.14, 0.09, 0.08],
];
const RING = 24, SUB = 3;

function spineAt(u: number): number[] {
  const n = SPINE.length;
  const i = Math.min(n - 2, Math.max(0, Math.floor(u)));
  const t = Math.min(1, u - i);
  const p0 = SPINE[Math.max(0, i - 1)], p1 = SPINE[i], p2 = SPINE[i + 1], p3 = SPINE[Math.min(n - 1, i + 2)];
  return p1.map((b, k) => {
    const a = p0[k], c = p2[k], d = p3[k];
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  });
}

/** Spine tangent and outward (crown / face side) normal in the YZ plane, as [ty, tz, ny, nz]. */
function spineFrame(u: number): number[] {
  const e = 0.02, n = SPINE.length - 1;
  const a = spineAt(Math.max(0, u - e)), b = spineAt(Math.min(n, u + e));
  const dy = b[0] - a[0], dz = b[1] - a[1];
  const l = Math.hypot(dy, dz) || 1;
  return [dy / l, dz / l, dz / l, -dy / l];
}

/** Point on the head surface: `a` runs round the section (0 = outer side, π/2 = +X). */
function headPoint(u: number, a: number, lift = 0): V3 {
  const [y, z, hw, to, ti] = spineAt(u);
  const [, , ny, nz] = spineFrame(u);
  const s = Math.sin(a), c = Math.cos(a);
  const pe = c >= 0 ? 2.4 : 3.2;
  const x = hw * Math.sign(s) * Math.pow(Math.abs(s), 2 / pe);
  const n = (c >= 0 ? to : ti) * Math.sign(c) * Math.pow(Math.abs(c), 2 / pe) + lift;
  return [x, y + n * ny, z + n * nz];
}

function head(b: Builder, mark: ColorKey | null): void {
  const nu = (SPINE.length - 1) * SUB;
  const rings: V3[][] = [];
  for (let i = 0; i <= nu; i++) {
    const ring: V3[] = [];
    for (let j = 0; j < RING; j++) ring.push(headPoint(i / SUB, (j / RING) * Math.PI * 2));
    rings.push(ring);
  }
  const crown = (i: number, j: number) => {
    const u = (i + 0.5) / SUB, a = ((j + 0.5) / RING) * Math.PI * 2;
    return mark && u > 0.6 && u < 3.4 && Math.cos(a) > 0.2 ? 1 : 0;
  };
  const [shell, paint] = loft(rings, { pick: crown, buckets: 2 });
  b.add('tan', shell);
  if (mark) b.add(mark, paint);
  // eye sensors on the brow, the vocabulator lip on the snout tip
  for (const s of [1, -1]) {
    const u = 4.4;
    const p = headPoint(u, s * 0.4);
    const [, , ny, nz] = spineFrame(u);
    cylAt(b, 'tan', p, [s * 0.3, ny, nz], 0.036, 0.05, { radial: 8 });
  }
  const tip = spineAt(SPINE.length - 1);
  const [ty, tz, ny, nz] = spineFrame(SPINE.length - 1);
  boxAt(b, 'tan', [0, tip[0] + ty * 0.02 + ny * 0.01, tip[1] + tz * 0.02 + nz * 0.01], [0, ty, tz], [0, ny, nz], 0.17, 0.09, 0.05, { c: 0.015 });
  // hinge: the post knuckle between two lugs on the back of the crown, pin ends showing
  cylAt(b, 'tan', HINGE, [1, 0, 0], 0.085, 0.14, { radial: 12 });
  for (const s of [1, -1]) {
    cylAt(b, 'tan', [s * 0.105, HINGE[1], HINGE[2]], [1, 0, 0], 0.1, 0.07, { radial: 12 });
    cylAt(b, 'darkTan', [s * 0.142, HINGE[1], HINGE[2]], [1, 0, 0], 0.035, 0.012, { radial: 8 });
  }
  // neck post down into the yoke
  b.box('tan', 0, 4.2, -0.075, 0.15, 0.96, 0.12, { c: 0.03 });
}

// ---------------------------------------------------------------------------------------------
// torso: yoke, chest frame and plate, V struts, backpack, shoulder axles

function torso(b: Builder, mark: ColorKey | null, variant: Variant): void {
  const frameKey: ColorKey = variant === 'security' ? 'red' : 'tan';
  const shade: ColorKey = variant === 'security' ? 'darkRed' : 'darkTan';
  const plate: ColorKey = variant === 'security' ? 'red' : mark ?? 'tan';
  const D = 0.38;
  b.prism(frameKey, [[-0.56, 3.53], [0.56, 3.53], [0.6, 3.62], [0.56, 3.76], [0.44, 3.84], [-0.44, 3.84], [-0.56, 3.76], [-0.6, 3.62]], D, { c: 0.06 });
  for (const s of [1, -1]) {
    b.prism(frameKey, [[0.34, 3.0], [0.46, 2.92], [0.57, 3.08], [0.57, 3.56], [0.36, 3.56]].map(([x, y]) => [s * x, y]), D * 0.9);
    b.prism(frameKey, [[0.08, 2.24], [0.21, 2.24], [0.44, 2.96], [0.3, 2.96]].map(([x, y]) => [s * x, y]), D * 0.7);
  }
  // cross bar under the neck, the chest plate below it (the rank colour on variants)
  b.prism(frameKey, [[-0.38, 3.26], [0.38, 3.26], [0.38, 3.38], [-0.38, 3.38]], D * 0.85);
  b.prism(plate, [[-0.38, 3.24], [0.38, 3.24], [0.33, 2.92], [-0.33, 2.92]], D * 0.8, { zc: 0.01 });
  b.box(shade, 0, 3.08, D * 0.4 + 0.012, 0.36, 0.035, 0.012, { c: 0 });
  b.box(frameKey, 0, 2.3, 0, 0.32, 0.14, 0.26, { c: 0.04 });
  // neck socket, shoulder axles
  b.box(frameKey, 0, 3.87, -0.07, 0.28, 0.08, 0.22, { c: 0.03 });
  for (const s of [1, -1]) cylAt(b, frameKey, [s * 0.68, SHOULDER[1], 0], [1, 0, 0], 0.075, 0.34, { radial: 10 });
  // backpack: rounded box with a raised back panel and vent slots
  b.box(frameKey, 0, 3.28, -0.4, 0.8, 0.92, 0.44, { c: 0.1 });
  b.box(frameKey, 0, 3.3, -0.635, 0.56, 0.62, 0.05, { c: 0.02 });
  for (let k = 0; k < 4; k++) b.box(shade, 0, 3.5 - k * 0.13, -0.665, 0.42, 0.05, 0.015, { c: 0 });
  for (const s of [1, -1]) b.box(frameKey, s * 0.41, 3.28, -0.4, 0.03, 0.6, 0.26, { c: 0.01 });
}

function hips(b: Builder): void {
  cylAt(b, 'tan', [0, HIP_Y, 0], [1, 0, 0], 0.16, 0.36, { radial: 14 });
}

// ---------------------------------------------------------------------------------------------
// limbs (port side; the starboard parts are built mirrored)

/** Leg in hip space (hip axis at the origin, sole at y = −HIP_Y). */
function leg(b: Builder): void {
  const y0 = -HIP_Y;
  cylAt(b, 'tan', [0, 0, 0], [1, 0, 0], 0.16, 0.2, { radial: 14 });
  b.push();
  // side-view outlines [z, y], extruded across X
  b.rotateY(Math.PI / 2);
  const side = (pts: number[][], w: number) => b.prism('tan', pts.map(([z, y]) => [-z, y]), w);
  side([[-0.1, -0.02], [0.1, -0.02], [0.085, -0.84], [-0.085, -0.84]], 0.22);
  side([[-0.085, -0.95], [0.085, -0.95], [0.07, -1.68], [-0.07, -1.68]], 0.18);
  // wedge foot: thick at the heel, thin at the toe, set a little outboard
  b.prism('tan', [[-0.26, y0], [0.6, y0], [0.62, y0 + 0.1], [0.52, y0 + 0.16], [0.08, y0 + 0.3], [-0.2, y0 + 0.36], [-0.26, y0 + 0.3]].map(([z, y]) => [-z, y]), 0.5, { c: 0.045, zc: 0.04 });
  b.pop();
  b.box('tan', 0, -0.45, 0.095, 0.13, 0.5, 0.03, { c: 0.01 });
  cylAt(b, 'tan', [0, -0.9, 0], [1, 0, 0], 0.13, 0.24, { radial: 12 });
  b.box('tan', 0, -1.3, 0.075, 0.11, 0.42, 0.04, { c: 0.015 });
  b.box('tan', 0, -1.74, -0.01, 0.16, 0.14, 0.17, { c: 0.03 });
}

/** Upper arm in shoulder space (hangs along −Y): the clip round the axle, the bar, the elbow. */
function upperArm(b: Builder): void {
  b.box('tan', 0, -0.02, 0, 0.24, 0.6, 0.3, { c: 0.07 });
  cylAt(b, 'tan', [0.125, 0, 0], [1, 0, 0], 0.11, 0.03, { radial: 14 });
  b.box('tan', 0, -0.5, 0, 0.13, 0.4, 0.15, { c: 0.035 });
  cylAt(b, 'tan', [0, -UPPER, 0], [1, 0, 0], 0.11, 0.18, { radial: 12 });
}

/** Forearm and C-hand in elbow space; the hand's gap faces up and inward, its bore along Z. */
function foreArm(b: Builder): void {
  b.box('tan', 0, -0.33, 0, 0.12, 0.5, 0.13, { c: 0.03 });
  b.box('tan', -0.01, -0.58, 0, 0.14, 0.1, 0.15, { c: 0.03 });
  const gap = 1.5;
  const at = new Matrix4().makeTranslation(HAND[0], HAND[1], HAND[2]).multiply(new Matrix4().makeRotationX(Math.PI / 2));
  b.add('tan', cRing(0.27, 0.15, 0.14, (5 * Math.PI) / 4 + gap / 2, Math.PI * 2 - gap, 16, 0.03), at);
}

/** E-5 blaster, canonical frame: grip through the origin along +Y, barrel +Z, top +Y. */
function blasterGeo(b: Builder): void {
  b.box('black', 0, -0.03, 0, 0.1, 0.32, 0.12, { c: 0.02 });
  b.box('black', 0, 0.24, 0.12, 0.2, 0.25, 0.96, { c: 0.03 });
  b.box('dbg', 0, 0.11, 0.1, 0.06, 0.05, 0.26, { c: 0.01 });
  rod(b, 'black', [0, 0.26, 0.6], [0, 0.26, 1.34], 0.055, { radial: 8 });
  rod(b, 'dbg', [0, 0.26, 1.26], [0, 0.26, 1.42], 0.075, { radial: 10 });
  rod(b, 'black', [0, 0.17, 0.6], [0, 0.17, 1.0], 0.03, { radial: 6 });
  rod(b, 'black', [0, 0.47, -0.05], [0, 0.47, 0.45], 0.06, { radial: 10 });
  for (const z of [0.03, 0.34]) b.box('black', 0, 0.41, z, 0.05, 0.06, 0.05, { c: 0.01 });
  cylAt(b, 'dbg', [0, 0.47, 0.47], [0, 0, 1], 0.07, 0.04, { radial: 10 });
  boxAt(b, 'black', [0, 0.17, -0.62], [0, -0.12, -1], [0, 1, 0], 0.13, 0.22, 0.5, { c: 0.03 });
  cylAt(b, 'dbg', [0.12, 0.25, 0.28], [0, 0, 1], 0.065, 0.3, { radial: 10 });
}

// ---------------------------------------------------------------------------------------------

export function battleDroid(o: { variant?: Variant; seed?: number } = {}): BattleDroid {
  const variant = o.variant ?? 'standard';
  const seed = o.seed ?? 1;
  const mark = MARK[variant];
  const group = new Group();
  group.name = `b1-${variant}`;
  const tally: Tally = newTally();
  const mk = (k: number) => new Builder({ seed: seed * 31 + k, studSegments: 10 });
  const limb = (name: string, parent: Object3D, at: V3, mirror: boolean, fn: (b: Builder) => void, k: number): Object3D => {
    const pv = pivot(name, parent, at[0], at[1], at[2]);
    const b = mk(k);
    if (mirror) b.mirrorX();
    fn(b);
    emit(b, name, pv, tally);
    return pv;
  };

  const hipsG = limb('b1:hips', group, [0, 0, 0], false, hips, 0);
  const legL = limb('b1:legL', group, [HIP_X, HIP_Y, 0], false, leg, 1);
  const legR = limb('b1:legR', group, [-HIP_X, HIP_Y, 0], true, leg, 2);
  const torsoP = limb('b1:torso', group, [0, HIP_Y, 0], false, (b) => {
    b.translate(0, -HIP_Y, 0);
    torso(b, mark, variant);
  }, 3);
  const headP = limb('b1:head', torsoP, [NECK[0], NECK[1] - HIP_Y, NECK[2]], false, (b) => {
    b.translate(-NECK[0], -NECK[1], -NECK[2]);
    head(b, variant === 'security' ? null : mark);
  }, 4);
  const arm = (side: 1 | -1) => {
    const n = side > 0 ? 'L' : 'R';
    const sh = limb(`b1:arm${n}`, torsoP, [side * SHOULDER[0], SHOULDER[1] - HIP_Y, SHOULDER[2]], side < 0, upperArm, 6 + side);
    const el = limb(`b1:forearm${n}`, sh, [0, -UPPER, 0], side < 0, foreArm, 9 + side);
    sh.userData.elbow = el;
    return { sh, el };
  };
  const L = arm(1);
  const R = arm(-1);
  const blaster = limb('b1:blaster', R.el, [-HAND[0], HAND[1], HAND[2]], false, blasterGeo, 12);
  blaster.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  const muzzle = pivot('muzzle', blaster, 0, 0.26, 1.44);

  group.userData.triangles = tally.tris;
  group.userData.drawCalls = tally.calls;
  group.userData.muzzle = muzzle;
  group.userData.height = 5.0;

  const pose = (p: { aim?: number; walk?: number; headTilt?: number; lookYaw?: number }) => {
    const a = clamp01(p.aim ?? 0);
    const w = p.walk;
    const sw = w === undefined ? 0 : Math.sin(w);
    const bob = w === undefined ? 0 : Math.abs(Math.cos(w)) * 0.05 - 0.03;
    // stiff minifig legs swing from the hip axis
    legL.rotation.set(-sw * 0.42, 0, 0);
    legR.rotation.set(sw * 0.42, 0, 0);
    hipsG.position.y = bob;
    legL.position.y = legR.position.y = torsoP.position.y = HIP_Y + bob;
    // aiming turns the chest a little, left shoulder forward; head and blaster stay on target
    const twist = lerp(0, -0.16, a);
    torsoP.rotation.set(0, twist + sw * 0.05 * (1 - a), 0);
    R.sh.rotation.set(lerp(-0.22 + sw * 0.12, -1.22, a), -twist, lerp(-0.06, 0, a), 'YXZ');
    R.el.rotation.set(lerp(-0.62, -0.35, a), 0, 0);
    L.sh.rotation.set(lerp(-0.06 - sw * 0.3, -0.3, a), 0, lerp(0.09, 0.05, a), 'YXZ');
    L.el.rotation.set(lerp(-0.18, -0.55, a), 0, 0);
    headP.rotation.set(lerp(0, 0.08, a), (p.lookYaw ?? 0) - twist, p.headTilt ?? 0, 'YXZ');
  };
  pose({});

  return {
    group,
    head: headP,
    torso: torsoP,
    armL: L.sh,
    armR: R.sh,
    legL,
    legR,
    blaster,
    pose,
    parts: [headP, L.sh, R.sh, blaster, torsoP, legL, legR, hipsG],
  };
}
