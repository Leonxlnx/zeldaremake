/**
 * Young Link — an original procedural low-poly stylised model (≈ 1.25 m with the cap, big head,
 * short legs) assembled from generated primitives on the shared rig. Colours follow
 * reference/ANALYSIS.md §10: green tunic with a soft collar and pale undershirt at the neck, puffed
 * short sleeves over bare arms, ragged mid-thigh hem, leather belt with a round buckle and two
 * diagonal chest straps, bare legs, brown boots with
 * tan cuffs, long green cap folded back, golden swept fringe, big blue eyes, pointed ears, Deku
 * Shield (orange-red swirl) on the back and the Kokiri Sword in a scabbard, hilt above the right
 * shoulder. No imported assets.
 */
import { BoxGeometry, BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Material, MathUtils, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { bulgedDisc, merge, ovalLathe, place, sweep, triangleCount } from './geometry';
import { CHAR_COLORS, cloth, matte, shieldTexture } from './palette';
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
export function buildLegs(rig: Rig, opts: { skin: MeshStandardMaterial; boot: MeshStandardMaterial; cuff: MeshStandardMaterial | null; shaftTop: number; buckle?: MeshStandardMaterial; tights?: MeshStandardMaterial }): void {
  const p = rig.props;
  const thighLen = p.hipY - p.kneeY;
  const shinLen = p.kneeY - p.ankleY;
  const leg = opts.tights ?? opts.skin;
  for (const side of [1, -1] as const) {
    const thigh = side > 0 ? rig.thighL : rig.thighR;
    const knee = side > 0 ? rig.kneeL : rig.kneeR;
    const ankle = side > 0 ? rig.ankleL : rig.ankleR;
    part(thigh, place(new CylinderGeometry(0.06, 0.052, thighLen + 0.02, 12), 0, -thighLen / 2 + 0.01, 0), leg, 'thigh');
    part(knee, place(new CylinderGeometry(0.048, 0.04, shinLen, 12), 0, -shinLen / 2, 0), leg, 'shin');
    // knee cap
    part(knee, new SphereGeometry(0.05, 10, 8), leg, 'knee');
    const soleY = rig.sole.y;
    const shaftH = opts.shaftTop - (soleY + 0.02);
    const boot = merge([
      place(new CylinderGeometry(0.062, 0.057, shaftH, 12), 0, soleY + 0.02 + shaftH / 2, 0),
      place(new BoxGeometry(0.105, 0.058, 0.16, 1, 1, 1), 0, soleY + 0.029, 0.03),
      place(new SphereGeometry(0.052, 10, 8), 0, soleY + 0.032, 0.105, undefined, [1, 0.62, 1]),
      place(new SphereGeometry(0.055, 10, 8), 0, soleY + 0.034, -0.02, undefined, [0.95, 0.6, 1]),
    ]);
    part(ankle, boot, opts.boot, 'boot');
    // dark sole slab under the boot
    part(ankle, place(new BoxGeometry(0.108, 0.018, 0.172), 0, soleY + 0.009, 0.03), matte('sole'), 'boot-sole');
    // fold-over cuff: flares outward at the top of the shaft
    if (opts.cuff) part(ankle, place(new CylinderGeometry(0.078, 0.066, 0.055, 12), 0, opts.shaftTop - 0.0275, 0), opts.cuff, 'boot-cuff');
    if (opts.buckle) part(ankle, place(new BoxGeometry(0.018, 0.022, 0.006), side * 0.06, opts.shaftTop - 0.075, 0.01), opts.buckle, 'boot-buckle', false);
  }
}

/**
 * Arms: optional tunic sleeve over the shoulder, then either bare skin or the long-sleeved
 * undershirt (`under`) down to a tight cuff at the wrist; skin hand.
 */
export function buildArms(rig: Rig, opts: { skin: MeshStandardMaterial; sleeve: MeshStandardMaterial | null; sleeveRadius?: number; shapedHands?: boolean; under?: MeshStandardMaterial; cuff?: MeshStandardMaterial }): void {
  const p = rig.props;
  const limb = opts.under ?? opts.skin;
  for (const side of [1, -1] as const) {
    const shoulder = side > 0 ? rig.shoulderL : rig.shoulderR;
    const elbow = side > 0 ? rig.elbowL : rig.elbowR;
    part(shoulder, place(new CylinderGeometry(0.045, 0.039, p.upperArm, 10), 0, -p.upperArm / 2, 0), limb, 'upper-arm');
    if (opts.sleeve) {
      const radius = opts.sleeveRadius ?? 0.06;
      const sleeve = merge([place(new SphereGeometry(radius, 12, 8), 0, 0.0, 0), place(new CylinderGeometry(radius, radius * 0.9, 0.1, 12), 0, -0.05, 0)]);
      part(shoulder, sleeve, opts.sleeve, 'sleeve');
    } else {
      part(shoulder, new SphereGeometry(0.05, 12, 8), limb, 'shoulder');
    }
    part(elbow, new SphereGeometry(0.041, 10, 8), limb, 'elbow');
    part(elbow, place(new CylinderGeometry(0.039, 0.033, p.forearm - 0.02, 10), 0, -(p.forearm - 0.02) / 2, 0), limb, 'forearm');
    if (opts.under) part(elbow, place(new CylinderGeometry(0.036, 0.037, 0.03, 10), 0, -p.forearm + 0.005, 0), opts.cuff ?? opts.under, 'sleeve-cuff');
    if (opts.shapedHands) {
      const hand = merge([
        place(new SphereGeometry(0.035, 12, 10), 0, -p.forearm - 0.021, 0.008, undefined, [0.84, 1.1, 0.64]),
        place(new SphereGeometry(0.027, 12, 8), 0, -p.forearm - 0.043, 0.015, undefined, [1.03, 0.68, 0.8]),
        sweep([new Vector3(side * 0.023, -p.forearm - 0.012, 0.012), new Vector3(side * 0.026, -p.forearm - 0.022, 0.031), new Vector3(side * 0.017, -p.forearm - 0.037, 0.033)], [0.012, 0.012, 0.009], { segments: 8, radial: 8, closeTip: true, closeStart: true }),
      ]);
      part(elbow, hand, opts.skin, 'hand');
    } else part(elbow, place(new SphereGeometry(0.04, 10, 8), 0, -p.forearm - 0.02, 0.005, undefined, [0.85, 1.15, 0.6]), opts.skin, 'hand');
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
  softFeatures?: boolean;
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
  const skullBase = new SphereGeometry(r, 24, 18);
  if (opts.softFeatures) {
    const vertices = skullBase.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const jaw = MathUtils.clamp(-vertices.getY(i) / r, 0, 1);
      vertices.setX(i, vertices.getX(i) * (1 - 0.16 * jaw * jaw));
    }
    skullBase.computeVertexNormals();
  }
  const skull = merge([
    place(skullBase, 0, 0, 0, undefined, [1, 1.04, 0.98]),
    // nose
    place(new SphereGeometry(0.013, 8, 6), 0, -0.02 * (r / 0.125), r * 0.98),
    ear(1),
    ear(-1),
  ]);
  part(head, skull, opts.skin, 'skull');
  const white = matte('eyeWhite', { roughness: 0.6 });
  const pupil = matte('pupil', { roughness: 0.6 });
  const almond = (k: number) => {
    const vertices: number[] = [], indices: number[] = [];
    const segments = 28, rings = 4;
    for (let ring = 0; ring <= rings; ring++) for (let j = 0; j <= segments; j++) {
      const u = ring / rings, a = j / segments * Math.PI * 2;
      vertices.push(0.025 * k * u * Math.cos(a), 0.0145 * k * u * Math.sin(a) * (0.82 + 0.18 * Math.abs(Math.sin(a))), 0.003 * k * (1 - u * u));
      if (ring < rings && j < segments) {
        const p = ring * (segments + 1) + j, q = p + segments + 1;
        indices.push(p, q, p + 1, q, q + 1, p + 1);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    return geo;
  };
  for (const side of [1, -1] as const) {
    const eye = new Group();
    eye.name = 'eye';
    const k = r / 0.125;
    const soft = !!opts.softFeatures;
    eye.position.set(side * 0.05 * k, -0.002 * k, r * (soft ? 0.94 : 0.84));
    if (soft) eye.rotation.y = side * 0.4;
    head.add(eye);
    if (soft) {
      part(eye, almond(k), white, 'eye-white', false);
      part(eye, new CircleGeometry(0.012 * k, 24).translate(0, -0.0005, 0.004 * k), opts.iris, 'iris', false);
      part(eye, new CircleGeometry(0.0058 * k, 20).translate(0, -0.0005, 0.0045 * k), pupil, 'pupil', false);
      const lid = [-1, -0.7, -0.35, 0, 0.35, 0.7, 1].map(x => new Vector3(x * 0.025 * k, 0.0145 * k * Math.sqrt(1 - x * x) * (0.82 + 0.18 * Math.sqrt(1 - x * x)), 0.001 * k));
      part(eye, sweep(lid, [0.0005 * k, 0.0014 * k, 0.0014 * k, 0.0005 * k], { segments: 18, radial: 5 }), matte('brow'), 'lashes', false);
    } else {
      part(eye, place(new SphereGeometry(0.032 * k, 12, 8), 0, 0, 0, undefined, [1, 0.92, 0.55]), white, 'eye-white', false);
      part(eye, place(new SphereGeometry(0.0235 * k, 10, 8), 0, -0.001, 0.016 * k, undefined, [1, 1, 0.45]), opts.iris, 'iris', false);
      part(eye, place(new SphereGeometry(0.013 * k, 8, 6), 0, -0.001, 0.0262 * k, undefined, [1, 1, 0.5]), pupil, 'pupil', false);
      part(eye, place(new TorusGeometry(0.031 * k, 0.0032, 5, 12, Math.PI), 0, 0.002, 0.012 * k, [0.35, 0, 0], [1, 0.95, 1]), pupil, 'lashes', false);
    }
    // catch-light on the upper-outer iris
    part(eye, new SphereGeometry((soft ? 0.0015 : 0.0035) * k, 6, 4).translate(side * 0.004 * k, 0.005 * k, (soft ? 0.005 : 0.031) * k), white, 'eye-highlight', false);
    rig.eyes.push(eye);
    part(head, place(new BoxGeometry((soft ? 0.038 : 0.046) * k, soft ? 0.005 : 0.008, 0.008), side * 0.052 * k, (soft ? 0.034 : 0.047) * k, r * (soft ? 0.94 : 0.87), [0, side * (soft ? 0.3 : 0), side * 0.12]), matte('brow'), 'brow', false);
  }
  part(head, place(new BoxGeometry(0.032, 0.005, 0.006), 0, -0.056 * (r / 0.125), r * 0.9), matte('mouth'), 'mouth', false);
}

/** Hair: cap of hair leaving the face open + swept fringe + sideburns. */
export function buildHair(rig: Rig, hair: MeshStandardMaterial, style: 'link' | 'bob'): void {
  const r = rig.props.headRadius;
  const head = rig.head;
  if (style === 'link') {
    const k = r / 0.125;
    // a clump of hair: a tapered strand from `from` (under the cap) to `to` (pointed tip)
    const clump = (from: [number, number, number], mid: [number, number, number], to: [number, number, number], r0: number, r1: number, tip = 0.004) =>
      sweep([new Vector3(from[0], Math.min(from[1], 0.058), from[2]).multiplyScalar(k), new Vector3(...mid).multiplyScalar(k), new Vector3(...to).multiplyScalar(k)], [r0 * k, r1 * k, tip * k], { segments: 12, radial: 9, closeTip: true, closeStart: true, flatten: 0.38, crease: 0.12 });
    const parts = [
      // back/sides of the head, open toward the face (+Z is phi = π/2)
      place(new SphereGeometry(r * 1.06, 18, 10, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.62), 0, 0.005, -0.008),
      // bushy fringe: four thick clumps hanging from under the brim (front brim ≈ y 0.088 k, tube
      // bottom ≈ 0.071 k) over the forehead to the brows (y 0.047 k), swept toward Link's right
      // (−X); the thick section sits BELOW the brim and well in front of the skull (z ≈ 0.11 k) so
      // the fringe reads as a blond band at 4–5 m from above and below eye level alike
      clump([-0.085, 0.076, 0.08], [-0.098, 0.05, 0.112], [-0.112, 0.018, 0.105], 0.026, 0.026, 0.004),
      clump([-0.035, 0.078, 0.088], [-0.045, 0.052, 0.122], [-0.06, 0.024, 0.122], 0.028, 0.028, 0.004),
      clump([0.02, 0.078, 0.09], [0.015, 0.052, 0.124], [-0.002, 0.028, 0.124], 0.028, 0.028, 0.004),
      clump([0.072, 0.076, 0.082], [0.076, 0.052, 0.114], [0.066, 0.024, 0.11], 0.026, 0.025, 0.004),
      // a thin stray lock over the left brow
      clump([0.045, 0.06, 0.11], [0.05, 0.04, 0.12], [0.06, 0.018, 0.115], 0.011, 0.009),
      // sideburn clumps in front of the ears, hanging to the jaw
      clump([0.108, 0.04, 0.045], [0.115, -0.02, 0.05], [0.108, -0.075, 0.045], 0.02, 0.016),
      clump([-0.108, 0.04, 0.045], [-0.115, -0.02, 0.05], [-0.108, -0.075, 0.045], 0.02, 0.016),
      // tufts at the nape below the cap brim
      clump([0.05, -0.02, -0.105], [0.06, -0.06, -0.1], [0.05, -0.095, -0.085], 0.024, 0.016),
      clump([-0.05, -0.02, -0.105], [-0.06, -0.06, -0.1], [-0.05, -0.095, -0.085], 0.024, 0.016),
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

/** Thin leather strap with a rectangular section, following the existing torso path. */
function leatherBand(points: Vector3[], width: number): BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  const tangent = new Vector3(), outward = new Vector3(), side = new Vector3(), vertex = new Vector3();
  points.forEach((p, i) => {
    tangent.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(0, i - 1)]).normalize();
    outward.set(p.x * 0.6, 0, p.z).normalize();
    side.crossVectors(tangent, outward).normalize();
    outward.crossVectors(side, tangent).normalize();
    for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
      vertex.copy(p).addScaledVector(side, sx * width / 2).addScaledVector(outward, sy * 0.002);
      vertices.push(vertex.x, vertex.y, vertex.z);
    }
    if (i < points.length - 1) for (let edge = 0; edge < 4; edge++) {
      const a = i * 4 + edge, b = (i + 1) * 4 + edge, c = i * 4 + (edge + 1) % 4, d = (i + 1) * 4 + (edge + 1) % 4;
      indices.push(a, b, c, b, d, c);
    }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

function buildTorso(rig: Rig): void {
  const p = rig.props;
  const tunic = cloth('tunic');
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
    { segments: 32, scaleZ: 0.74, folds: 5, foldDepth: 0.035 },
  );
  part(rig.chest, upper, tunic, 'tunic-upper');
  // skirt (hips joint): soft scalloped mid-thigh hem with three vertical fold ridges
  const skirt = ovalLathe(
    [
      [0.15, hl(0.4)],
      [0.132, hl(0.5)],
      [0.113, hl(0.58)],
      [0.108, hl(0.635)],
    ],
    { segments: 36, scaleZ: 0.8, scallops: 7, scallopDepth: 0.028, folds: 3, foldDepth: 0.05 },
  );
  part(rig.hips, skirt, tunic, 'tunic-skirt');
  // belt pouch on the left hip with a flap
  const pouch = merge([
    place(new BoxGeometry(0.07, 0.06, 0.04), 0, -0.03, 0),
    place(new BoxGeometry(0.074, 0.028, 0.046), 0, 0.005, 0.002),
  ]);
  part(rig.hips, place(pouch, 0.105, hl(0.6), 0.03, [0, 0.55, 0]), matte('leatherDark'), 'pouch');
  // Pale undershirt behind two folded collar flaps, open at the front of the neck.
  part(rig.chest, place(new CylinderGeometry(0.054, 0.06, 0.075, 12), 0, cl(0.845), 0), matte('undershirt'), 'undershirt');
  for (const sign of [1, -1]) {
    const outline = [[0.015, 0.855, 0.056], [0.077, 0.852, 0.064], [0.096, 0.813, 0.083], [0.050, 0.785, 0.101], [0.020, 0.824, 0.098]];
    const vertices = [sign * 0.047, cl(0.834), 0.094];
    const uv = [0.5, 0.5], indices: number[] = [];
    outline.forEach(([x, y, z], i) => {
      vertices.push(sign * x, cl(y), z); uv.push(x * 10, (y - 0.78) * 10);
      const a = i + 1, b = (i + 1) % outline.length + 1;
      indices.push(...(sign > 0 ? [0, b, a] : [0, a, b]));
    });
    const flap = new BufferGeometry();
    flap.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    flap.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    flap.setIndex(indices); flap.computeVertexNormals();
    part(rig.chest, flap, matte('tunicCollar'), 'collar-flap');
  }
  // belt + round buckle
  const leather = matte('leather');
  part(rig.hips, ovalLathe([[0.116, hl(0.596)], [0.120, hl(0.601)], [0.120, hl(0.634)], [0.116, hl(0.639)]], { segments: 36, scaleZ: 0.83 }), leather, 'belt');
  const buckle = merge([place(new TorusGeometry(0.022, 0.007, 6, 14), 0, hl(0.615), 0.108), place(new BoxGeometry(0.006, 0.034, 0.006), 0, hl(0.615), 0.108)]);
  part(rig.hips, buckle, matte('buckle', { roughness: 0.6 }), 'buckle', false);
  // small buckle where the straps cross on the chest
  part(rig.chest, place(new BoxGeometry(0.024, 0.024, 0.008), 0, cl(0.728), 0.1), matte('buckle', { roughness: 0.6 }), 'strap-buckle', false);
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
    pts.unshift(new Vector3(sign * 0.092, cl(0.825), -0.075), new Vector3(sign * 0.092, cl(0.865), -0.02));
    return pts.reverse();
  };
  for (const sign of [1, -1] as const) {
    part(rig.chest, leatherBand(strapPts(sign), 0.030), leather, 'strap');
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
  const tilt = 0.36;
  const d = 0.044 * k;
  const n = new Vector3(0, Math.cos(tilt), -Math.sin(tilt));
  const centre = n.clone().multiplyScalar(d);
  cap.position.copy(centre);
  head.add(cap);
  rig.cap = cap;
  const capMat = cloth('cap');
  // A low cloth crown follows the skull, then folds into the tail behind the head.
  const R = hairR + 0.008;
  const stretch = 1.12;
  const thetaMax = Math.acos(d / (stretch * R));
  const sinMax = Math.sin(thetaMax);
  const taper = (theta: number) => 1 - 0.18 * Math.pow(Math.max(0, 1 - Math.sin(theta) / sinMax), 1.5);
  const rimR = R * sinMax;
  const dome = new SphereGeometry(R, 22, 14, 0, Math.PI * 2, 0, thetaMax);
  const pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const theta = Math.acos(MathUtils.clamp(pos.getY(i) / R, -1, 1));
    const f = taper(theta);
    const x = pos.getX(i) * f, z = pos.getZ(i) * f;
    const fold = 0.010 * Math.exp(-(((x - 0.025) / 0.055) ** 2) - ((z + 0.075) / 0.040) ** 2);
    pos.setXYZ(i, x, pos.getY(i) * stretch - fold, z);
  }
  dome.computeVertexNormals();
  // sphere pole (+Y) → n is a rotation about X by -tilt; the dome centre is the head centre
  part(cap, place(dome, -centre.x, -centre.y, -centre.z, [-tilt, 0, 0]), capMat, 'cap-dome');
  // Tail: emerges from the back of the peak, folds back and drapes down between the shoulder
  // blades. `b` is "backward" in the brim frame (perpendicular to n).
  const b = new Vector3(0, -Math.sin(tilt), -Math.cos(tilt));
  const domeAt = (theta: number, scale: number) => n.clone().multiplyScalar(-d + scale * R * stretch * Math.cos(theta)).addScaledVector(b, scale * R * Math.sin(theta) * taper(theta));
  // The tail is a flattened, creased tube (cloth lying on the back) with a gentle S-bend, reaching
  // mid-back (≈ 0.42 m below the brim).
  const pts = [
    domeAt(0.25, 0.72),
    domeAt(0.5, 1.0),
    new Vector3(0.014, 0.085, -0.145),
    new Vector3(0.03, 0.015, -0.185),
    new Vector3(0.012, -0.09, -0.2),
    new Vector3(-0.014, -0.2, -0.21),
    new Vector3(-0.006, -0.3, -0.215),
    new Vector3(0.012, -0.375, -0.22),
  ].map((v, i) => (i < 2 ? v : v.multiplyScalar(k)));
  part(cap, sweep(pts, [0.065 * k, 0.067 * k, 0.06 * k, 0.056 * k, 0.046 * k, 0.034 * k, 0.02 * k, 0.005], { segments: 30, radial: 12, closeTip: true, closeStart: true, flatten: 0.48, crease: 0.2 }), capMat, 'cap-tail');
  // rolled brim in the brim plane: torus XY plane → horizontal (+π/2) → tilted back by `tilt`
  part(cap, place(new TorusGeometry(rimR + 0.002, 0.014, 8, 32), 0, 0, 0, [Math.PI / 2 - tilt, 0, 0]), cloth('capBrim'), 'cap-brim');
}

function buildGear(rig: Rig): void {
  const p = rig.props;
  const cl = (y: number) => y - p.chestY;
  // Deku Shield: bulged oval disc with the swirl texture + wooden rim, on the back
  const shieldMat = new MeshStandardMaterial({ map: shieldTexture(), color: 0xffffff, roughness: 0.9, metalness: 0 });
  shieldMat.name = 'char-shield';
  const shield = new Group();
  shield.name = 'deku-shield';
  shield.position.set(0.0, cl(0.7), -0.15);
  shield.rotation.set(-0.12, Math.PI, 0.06);
  rig.chest.add(shield);
  const SR = 0.215;
  part(shield, bulgedDisc(SR, 0.048, { segments: 30, rings: 5, sx: 0.92, sy: 1.08 }), shieldMat, 'shield-face');
  part(shield, place(new TorusGeometry(SR, 0.013, 8, 30), 0, 0, 0.002, undefined, [0.92, 1.08, 1]), matte('shieldRim'), 'shield-rim');
  // back plate so the shield is not paper-thin from the side
  part(shield, place(new CylinderGeometry(SR, SR, 0.012, 30), 0, 0, -0.006, [Math.PI / 2, 0, 0], [0.92, 1, 1.08]), matte('shieldRim'), 'shield-back');
  // Kokiri Sword in its scabbard: from the left hip up past the right shoulder
  // the hilt clears the head beside the right ear so it reads from behind (reference A/D)
  const bottom = new Vector3(0.09, 0.52, -0.105);
  const top = new Vector3(-0.15, 0.905, -0.1);
  const axis = top.clone().sub(bottom);
  const len = axis.length();
  const dir = axis.clone().normalize();
  const roll = Math.atan2(-dir.x, dir.y);
  const mid = bottom.clone().lerp(top, 0.5);
  part(rig.chest, place(new BoxGeometry(0.046, len, 0.03), mid.x, cl(mid.y), mid.z, [0, 0, roll]), matte('scabbard'), 'scabbard');
  const guardPos = top.clone().addScaledVector(dir, 0.01);
  part(rig.chest, place(new BoxGeometry(0.09, 0.016, 0.028), guardPos.x, cl(guardPos.y), guardPos.z, [0, 0, roll]), matte('swordGuard', { roughness: 0.6 }), 'sword-guard', false);
  const gripPos = top.clone().addScaledVector(dir, 0.06);
  part(rig.chest, place(new CylinderGeometry(0.012, 0.013, 0.095, 8), gripPos.x, cl(gripPos.y), gripPos.z, [0, 0, roll]), matte('swordGrip'), 'sword-grip', false);
  const pommel = top.clone().addScaledVector(dir, 0.115);
  part(rig.chest, place(new SphereGeometry(0.019, 8, 6), pommel.x, cl(pommel.y), pommel.z), matte('steel', { roughness: 0.6 }), 'sword-pommel', false);
}

export function createLink(): Character {
  beginTally();
  const rig = buildRig(LINK_PROPORTIONS, 'link');
  const skin = matte('skin');
  // reference frames 1 s / 14 s: bare arms below the puffed tunic sleeves and bare legs between the
  // ragged hem and the boot cuffs (the pale undershirt only shows at the collar)
  buildLegs(rig, { skin, boot: matte('boot'), cuff: matte('bootCuff'), shaftTop: 0.135, buckle: matte('buckle', { roughness: 0.6 }) });
  buildArms(rig, { skin, sleeve: cloth('tunic'), sleeveRadius: 0.055, shapedHands: true });
  buildTorso(rig);
  buildNeck(rig, skin);
  buildFace(rig, { skin, iris: matte('iris', { roughness: 0.6 }), earLength: 0.085, softFeatures: true });
  buildHair(rig, matte('hair'), 'link');
  buildCap(rig);
  buildGear(rig);
  rig.root.userData.character = 'link';
  return { kind: 'link', rig, group: rig.root, triangles: endTally(), height: 1.25 };
}

export { CHAR_COLORS };
