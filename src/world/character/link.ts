/**
 * Young Link — an original procedural low-poly stylised model (≈ 1.25 m with the cap, big head,
 * short legs) assembled from generated primitives on the shared rig. Colours follow
 * reference/ANALYSIS.md §10: green tunic with a soft collar and pale undershirt, ragged mid-thigh
 * hem, leather belt with a round buckle and two diagonal chest straps, bare legs, brown boots with
 * tan cuffs, long green cap folded back, golden swept fringe, big blue eyes, pointed ears, Deku
 * Shield (orange-red swirl) on the back and the Kokiri Sword in a scabbard, hilt above the right
 * shoulder. No imported assets.
 */
import { BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Group, Material, MathUtils, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { bulgedDisc, merge, ovalLathe, place, sweep, triangleCount } from './geometry';
import { CHAR_COLORS, matte, shieldTexture } from './palette';
import { buildRig, LINK_PROPORTIONS, type Rig } from './rig';

export interface Character {
  kind: 'link' | 'kokiri';
  rig: Rig;
  group: Group;
  triangles: number;
  /** total height incl. hat (m) for screen-box reporting */
  height: number;
}

let tally = 0;

export function part(parent: Object3D, geo: BufferGeometry, material: Material, name: string, shadows = true): Mesh {
  const m = new Mesh(geo, material);
  m.name = name;
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  parent.add(m);
  tally += triangleCount(geo);
  return m;
}

export function beginTally(): void {
  tally = 0;
}
export function endTally(): number {
  return tally;
}

/** Legs + boots shared by Link and the kids (kids get taller, darker boots). */
export function buildLegs(rig: Rig, opts: { skin: MeshStandardMaterial; boot: MeshStandardMaterial; cuff: MeshStandardMaterial | null; shaftTop: number; buckle?: MeshStandardMaterial }): void {
  const p = rig.props;
  const thighLen = p.hipY - p.kneeY;
  const shinLen = p.kneeY - p.ankleY;
  for (const side of [1, -1] as const) {
    const thigh = side > 0 ? rig.thighL : rig.thighR;
    const knee = side > 0 ? rig.kneeL : rig.kneeR;
    const ankle = side > 0 ? rig.ankleL : rig.ankleR;
    part(thigh, place(new CylinderGeometry(0.06, 0.052, thighLen + 0.02, 12), 0, -thighLen / 2 + 0.01, 0), opts.skin, 'thigh');
    part(knee, place(new CylinderGeometry(0.048, 0.04, shinLen, 12), 0, -shinLen / 2, 0), opts.skin, 'shin');
    // knee cap
    part(knee, new SphereGeometry(0.05, 10, 8), opts.skin, 'knee');
    const soleY = rig.sole.y;
    const shaftH = opts.shaftTop - (soleY + 0.02);
    const boot = merge([
      place(new CylinderGeometry(0.062, 0.057, shaftH, 12), 0, soleY + 0.02 + shaftH / 2, 0),
      place(new BoxGeometry(0.105, 0.058, 0.16, 1, 1, 1), 0, soleY + 0.029, 0.03),
      place(new SphereGeometry(0.052, 10, 8), 0, soleY + 0.032, 0.105, undefined, [1, 0.62, 1]),
      place(new SphereGeometry(0.055, 10, 8), 0, soleY + 0.034, -0.02, undefined, [0.95, 0.6, 1]),
    ]);
    part(ankle, boot, opts.boot, 'boot');
    if (opts.cuff) part(ankle, place(new CylinderGeometry(0.072, 0.065, 0.05, 12), 0, opts.shaftTop - 0.025, 0), opts.cuff, 'boot-cuff');
    if (opts.buckle) part(ankle, place(new BoxGeometry(0.018, 0.022, 0.006), side * 0.06, opts.shaftTop - 0.07, 0.01), opts.buckle, 'boot-buckle', false);
  }
}

/** Arms: optional sleeve (tunic) over the upper arm, bare forearm, simple hand. */
export function buildArms(rig: Rig, opts: { skin: MeshStandardMaterial; sleeve: MeshStandardMaterial | null }): void {
  const p = rig.props;
  for (const side of [1, -1] as const) {
    const shoulder = side > 0 ? rig.shoulderL : rig.shoulderR;
    const elbow = side > 0 ? rig.elbowL : rig.elbowR;
    part(shoulder, place(new CylinderGeometry(0.045, 0.039, p.upperArm, 10), 0, -p.upperArm / 2, 0), opts.skin, 'upper-arm');
    if (opts.sleeve) {
      const sleeve = merge([place(new SphereGeometry(0.06, 12, 8), 0, 0.0, 0), place(new CylinderGeometry(0.06, 0.054, 0.1, 12), 0, -0.05, 0)]);
      part(shoulder, sleeve, opts.sleeve, 'sleeve');
    } else {
      part(shoulder, new SphereGeometry(0.05, 12, 8), opts.skin, 'shoulder');
    }
    part(elbow, new SphereGeometry(0.041, 10, 8), opts.skin, 'elbow');
    const forearm = merge([place(new CylinderGeometry(0.039, 0.034, p.forearm, 10), 0, -p.forearm / 2, 0), place(new SphereGeometry(0.04, 10, 8), 0, -p.forearm - 0.02, 0.005, undefined, [0.85, 1.15, 0.6])]);
    part(elbow, forearm, opts.skin, 'forearm');
  }
}

/** Neck column from inside the collar up into the skull (fills the tunic's neck opening). */
export function buildNeck(rig: Rig, skin: MeshStandardMaterial): void {
  const p = rig.props;
  const top = p.headCentreY - p.headRadius * 0.5;
  const bottom = p.neckY - 0.06;
  part(rig.chest, place(new CylinderGeometry(0.042, 0.048, top - bottom, 10), 0, (top + bottom) / 2 - p.chestY, 0), skin, 'neck');
}

export interface FaceOptions {
  skin: MeshStandardMaterial;
  iris: MeshStandardMaterial;
  earLength: number;
}

/** Head: skull, big eyes (blink-able groups), brows, nose, mouth, pointed ears. */
export function buildFace(rig: Rig, opts: FaceOptions): void {
  const r = rig.props.headRadius;
  const head = rig.head;
  // ears: cones pointing outward, slightly up and swept back
  const ear = (side: 1 | -1) => {
    const cone = place(new ConeGeometry(0.022, opts.earLength, 8), 0, 0, 0, [0, 0, side * (-Math.PI / 2 + 0.14)]);
    const dir = new Vector3(side * Math.cos(0.14), Math.sin(0.14), 0).applyAxisAngle(new Vector3(0, 1, 0), side * 0.5);
    const base = new Vector3(side * r * 0.9, 0.015, -0.01);
    const c = base.addScaledVector(dir, opts.earLength * 0.42);
    return place(cone, c.x, c.y, c.z, [0, side * 0.5, 0]);
  };
  const skull = merge([
    place(new SphereGeometry(r, 20, 14), 0, 0, 0, undefined, [1, 1.04, 0.98]),
    // nose
    place(new SphereGeometry(0.013, 8, 6), 0, -0.02 * (r / 0.125), r * 0.98),
    ear(1),
    ear(-1),
  ]);
  part(head, skull, opts.skin, 'skull');
  const white = matte('eyeWhite', { roughness: 0.25 });
  const pupil = matte('pupil', { roughness: 0.2 });
  for (const side of [1, -1] as const) {
    const eye = new Group();
    eye.name = 'eye';
    const k = r / 0.125;
    eye.position.set(side * 0.05 * k, -0.002 * k, r * 0.84);
    head.add(eye);
    part(eye, place(new SphereGeometry(0.032 * k, 12, 8), 0, 0, 0, undefined, [1, 0.92, 0.55]), white, 'eye-white', false);
    part(eye, place(new SphereGeometry(0.021 * k, 10, 8), 0, -0.001, 0.017 * k, undefined, [1, 1, 0.45]), opts.iris, 'iris', false);
    part(eye, place(new SphereGeometry(0.0095 * k, 8, 6), 0, -0.001, 0.0265 * k, undefined, [1, 1, 0.5]), pupil, 'pupil', false);
    rig.eyes.push(eye);
    part(head, place(new BoxGeometry(0.044 * k, 0.007, 0.01), side * 0.052 * k, 0.046 * k, r * 0.87, [0, 0, side * 0.18]), matte('brow'), 'brow', false);
  }
  part(head, place(new BoxGeometry(0.026, 0.005, 0.006), 0, -0.055 * (r / 0.125), r * 0.9), matte('mouth'), 'mouth', false);
}

/** Hair: cap of hair leaving the face open + swept fringe + sideburns. */
export function buildHair(rig: Rig, hair: MeshStandardMaterial, style: 'link' | 'bob'): void {
  const r = rig.props.headRadius;
  const head = rig.head;
  if (style === 'link') {
    const parts = [
      // back/sides of the head, open toward the face (+Z is phi = π/2)
      place(new SphereGeometry(r * 1.06, 18, 10, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.62), 0, 0.005, -0.008),
      // swept fringe across the forehead, thick at the right temple thinning to the left
      sweep(
        [new Vector3(-0.1, 0.05, 0.07), new Vector3(-0.045, 0.066, 0.1), new Vector3(0.03, 0.064, 0.102), new Vector3(0.095, 0.05, 0.078), new Vector3(0.118, 0.025, 0.05)].map((v) => v.multiplyScalar(r / 0.125)),
        [0.024, 0.028, 0.027, 0.02, 0.008],
        { segments: 16, radial: 8, closeTip: true, closeStart: true },
      ),
      // a second lower strand over the left brow
      sweep(
        [new Vector3(-0.02, 0.058, 0.108), new Vector3(0.04, 0.05, 0.108), new Vector3(0.085, 0.038, 0.092)].map((v) => v.multiplyScalar(r / 0.125)),
        [0.012, 0.012, 0.005],
        { segments: 8, radial: 6, closeTip: true },
      ),
      // sideburns in front of the ears
      place(new BoxGeometry(0.02, 0.065, 0.028), 0.105 * (r / 0.125), -0.012, 0.045, [0, 0, 0.1]),
      place(new BoxGeometry(0.02, 0.065, 0.028), -0.105 * (r / 0.125), -0.012, 0.045, [0, 0, -0.1]),
    ];
    part(head, merge(parts), hair, 'hair');
  } else {
    // auburn bob: rounder, longer at the sides/back, straight fringe under the headband
    const parts = [
      place(new SphereGeometry(r * 1.1, 18, 12, Math.PI * 0.72, Math.PI * 1.56, 0, Math.PI * 0.74), 0, 0.0, -0.012),
      // fringe band across the forehead
      place(new SphereGeometry(r * 1.08, 14, 6, Math.PI * 0.28, Math.PI * 0.44, Math.PI * 0.18, Math.PI * 0.2), 0, 0.02, 0.0),
      place(new BoxGeometry(0.03, 0.09, 0.035), 0.1 * (r / 0.125), -0.02, 0.05, [0, 0, 0.06]),
      place(new BoxGeometry(0.03, 0.09, 0.035), -0.1 * (r / 0.125), -0.02, 0.05, [0, 0, -0.06]),
    ];
    part(head, merge(parts), hair, 'hair');
  }
}

function buildTorso(rig: Rig): void {
  const p = rig.props;
  const tunic = matte('tunic');
  const cl = (y: number) => y - p.chestY;
  const hl = (y: number) => y - p.hipY;
  // upper tunic (chest joint): waist → shoulders → neck opening
  const upper = ovalLathe(
    [
      [0.104, cl(0.6)],
      [0.108, cl(0.66)],
      [0.12, cl(0.73)],
      [0.133, cl(0.8)],
      [0.128, cl(0.835)],
      [0.06, cl(0.86)],
    ],
    { segments: 22, scaleZ: 0.74 },
  );
  part(rig.chest, upper, tunic, 'tunic-upper');
  // skirt (hips joint) with the ragged mid-thigh hem
  const skirt = ovalLathe(
    [
      [0.148, hl(0.4)],
      [0.13, hl(0.5)],
      [0.113, hl(0.58)],
      [0.108, hl(0.635)],
    ],
    { segments: 24, scaleZ: 0.8, raggedHem: 0.035, seed: 11 },
  );
  part(rig.hips, skirt, tunic, 'tunic-skirt');
  // pale undershirt at the neck + soft collar
  part(rig.chest, place(new CylinderGeometry(0.054, 0.06, 0.075, 12), 0, cl(0.845), 0), matte('undershirt'), 'undershirt');
  part(rig.chest, place(new TorusGeometry(0.076, 0.014, 8, 20), 0, cl(0.846), 0.004, [Math.PI / 2 - 0.22, 0, 0], [1, 1, 0.82]), matte('tunicCollar'), 'collar');
  // belt + round buckle
  const leather = matte('leather');
  part(rig.hips, place(new TorusGeometry(0.114, 0.019, 8, 26), 0, hl(0.615), 0, [Math.PI / 2, 0, 0], [1, 1, 0.82]), leather, 'belt');
  const buckle = merge([place(new TorusGeometry(0.02, 0.006, 6, 14), 0, hl(0.615), 0.108), place(new BoxGeometry(0.006, 0.03, 0.006), 0, hl(0.615), 0.108)]);
  part(rig.hips, buckle, matte('buckle', { roughness: 0.45, metalness: 0.6 }), 'buckle', false);
  // two diagonal chest straps hugging the torso surface (left shoulder → right hip and mirrored)
  const torsoR = (y: number) => {
    if (y > 0.835) return 0.128;
    if (y > 0.8) return 0.133 - ((y - 0.8) / 0.035) * 0.005;
    if (y > 0.73) return 0.12 + ((y - 0.73) / 0.07) * 0.013;
    if (y > 0.66) return 0.108 + ((y - 0.66) / 0.07) * 0.012;
    return 0.104 + ((y - 0.6) / 0.06) * 0.004;
  };
  const strapPts = (sign: 1 | -1) => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= 8; i++) {
      const s = i / 8;
      const y = 0.84 - 0.23 * s;
      const rx = torsoR(y);
      const rz = rx * 0.74;
      const x = sign * (0.08 - 0.165 * s);
      const zz = Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * rz + 0.007;
      pts.push(new Vector3(x, cl(y), zz));
    }
    // over the shoulder and a little way down the back
    pts.unshift(new Vector3(sign * 0.092, cl(0.85), -0.02), new Vector3(sign * 0.092, cl(0.825), -0.075));
    return pts.reverse();
  };
  for (const sign of [1, -1] as const) {
    part(rig.chest, sweep(strapPts(sign), [0.011, 0.011, 0.011, 0.011], { segments: 14, radial: 6, smooth: true }), leather, 'strap');
  }
}

function buildCap(rig: Rig): void {
  const head = rig.head;
  const cap = new Group();
  cap.name = 'cap';
  const r = rig.props.headRadius;
  const k = r / 0.125;
  // The brim is the circle where a plane tilted back by `tilt` cuts the hair sphere (radius hairR)
  // at distance d from the head centre: high above the fringe in front, low at the nape behind,
  // so the cap sits pushed back on the head the way the reference wears it.
  const hairR = r * 1.06;
  const tilt = 0.4;
  const d = 0.041 * k;
  const n = new Vector3(0, Math.cos(tilt), -Math.sin(tilt));
  const centre = n.clone().multiplyScalar(d);
  cap.position.copy(centre);
  head.add(cap);
  rig.cap = cap;
  const capMat = matte('cap');
  // Dome: a shell just outside the hair, stretched along the brim normal into a tall peak that
  // tapers toward the tip, clipped where it meets the brim plane (polar angle thetaMax).
  const R = hairR + 0.008;
  const stretch = 1.32;
  const thetaMax = Math.acos(d / (stretch * R));
  const sinMax = Math.sin(thetaMax);
  const taper = (theta: number) => 1 - 0.4 * Math.pow(Math.max(0, 1 - Math.sin(theta) / sinMax), 1.5);
  const rimR = R * sinMax;
  const dome = new SphereGeometry(R, 22, 14, 0, Math.PI * 2, 0, thetaMax);
  const pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const theta = Math.acos(MathUtils.clamp(pos.getY(i) / R, -1, 1));
    const f = taper(theta);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * stretch, pos.getZ(i) * f);
  }
  dome.computeVertexNormals();
  // sphere pole (+Y) → n is a rotation about X by -tilt; the dome centre is the head centre
  part(cap, place(dome, -centre.x, -centre.y, -centre.z, [-tilt, 0, 0]), capMat, 'cap-dome');
  // Tail: emerges from the back of the peak, folds back and drapes down between the shoulder
  // blades. `b` is "backward" in the brim frame (perpendicular to n).
  const b = new Vector3(0, -Math.sin(tilt), -Math.cos(tilt));
  const domeAt = (theta: number, scale: number) => n.clone().multiplyScalar(-d + scale * R * stretch * Math.cos(theta)).addScaledVector(b, scale * R * Math.sin(theta) * taper(theta));
  const pts = [domeAt(0.55, 0.88), domeAt(0.7, 1.05), new Vector3(0.004, 0.09, -0.14), new Vector3(0.01, 0.03, -0.18), new Vector3(0.018, -0.08, -0.195), new Vector3(0.026, -0.2, -0.205), new Vector3(0.032, -0.3, -0.21)].map((v, i) => (i < 2 ? v : v.multiplyScalar(k)));
  part(cap, sweep(pts, [0.058 * k, 0.056 * k, 0.05 * k, 0.042 * k, 0.032 * k, 0.022 * k, 0.008], { segments: 28, radial: 12, closeTip: true, closeStart: true }), capMat, 'cap-tail');
  // rolled brim in the brim plane: torus XY plane → horizontal (+π/2) → tilted back by `tilt`
  part(cap, place(new TorusGeometry(rimR, 0.02, 8, 26), 0, 0, 0, [Math.PI / 2 - tilt, 0, 0]), matte('capBrim'), 'cap-brim');
}

function buildGear(rig: Rig): void {
  const p = rig.props;
  const cl = (y: number) => y - p.chestY;
  // Deku Shield: bulged oval disc with the swirl texture + wooden rim, on the back
  const shieldMat = new MeshStandardMaterial({ map: shieldTexture(), color: 0xffffff, roughness: 0.75, metalness: 0 });
  shieldMat.name = 'char-shield';
  const shield = new Group();
  shield.name = 'deku-shield';
  shield.position.set(0.02, cl(0.71), -0.15);
  shield.rotation.set(-0.12, Math.PI, 0.08);
  rig.chest.add(shield);
  const SR = 0.215;
  part(shield, bulgedDisc(SR, 0.048, { segments: 30, rings: 5, sx: 0.92, sy: 1.08 }), shieldMat, 'shield-face');
  part(shield, place(new TorusGeometry(SR, 0.013, 8, 30), 0, 0, 0.002, undefined, [0.92, 1.08, 1]), matte('shieldRim'), 'shield-rim');
  // back plate so the shield is not paper-thin from the side
  part(shield, place(new CylinderGeometry(SR, SR, 0.012, 30), 0, 0, -0.006, [Math.PI / 2, 0, 0], [0.92, 1, 1.08]), matte('shieldRim'), 'shield-back');
  // Kokiri Sword in its scabbard: from the left hip up past the right shoulder
  const bottom = new Vector3(0.09, 0.52, -0.105);
  const top = new Vector3(-0.11, 0.9, -0.1);
  const axis = top.clone().sub(bottom);
  const len = axis.length();
  const dir = axis.clone().normalize();
  const roll = Math.atan2(-dir.x, dir.y);
  const mid = bottom.clone().lerp(top, 0.5);
  part(rig.chest, place(new BoxGeometry(0.046, len, 0.03), mid.x, cl(mid.y), mid.z, [0, 0, roll]), matte('scabbard'), 'scabbard');
  const guardPos = top.clone().addScaledVector(dir, 0.01);
  part(rig.chest, place(new BoxGeometry(0.08, 0.014, 0.026), guardPos.x, cl(guardPos.y), guardPos.z, [0, 0, roll]), matte('swordGuard', { roughness: 0.4, metalness: 0.6 }), 'sword-guard', false);
  const gripPos = top.clone().addScaledVector(dir, 0.055);
  part(rig.chest, place(new CylinderGeometry(0.011, 0.012, 0.085, 8), gripPos.x, cl(gripPos.y), gripPos.z, [0, 0, roll]), matte('swordGrip'), 'sword-grip', false);
  const pommel = top.clone().addScaledVector(dir, 0.105);
  part(rig.chest, place(new SphereGeometry(0.016, 8, 6), pommel.x, cl(pommel.y), pommel.z), matte('steel', { roughness: 0.35, metalness: 0.7 }), 'sword-pommel', false);
}

export function createLink(): Character {
  beginTally();
  const rig = buildRig(LINK_PROPORTIONS, 'link');
  const skin = matte('skin', { roughness: 0.7 });
  buildLegs(rig, { skin, boot: matte('boot'), cuff: matte('bootCuff'), shaftTop: 0.135, buckle: matte('buckle', { roughness: 0.45, metalness: 0.6 }) });
  buildArms(rig, { skin, sleeve: matte('tunic') });
  buildTorso(rig);
  buildNeck(rig, skin);
  buildFace(rig, { skin, iris: matte('iris', { roughness: 0.3 }), earLength: 0.085 });
  buildHair(rig, matte('hair'), 'link');
  buildCap(rig);
  buildGear(rig);
  rig.root.userData.character = 'link';
  return { kind: 'link', rig, group: rig.root, triangles: endTally(), height: 1.25 };
}

export { CHAR_COLORS };
