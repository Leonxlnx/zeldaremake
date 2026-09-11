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
import { BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Material, MathUtils, Mesh, MeshStandardMaterial, Object3D, Raycaster, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { merge, ovalLathe, place, sweep, triangleCount } from './geometry';
import { CHAR_COLORS, cloth, linkHair, matte } from './palette';
import { buildRig, LINK_PROPORTIONS, type Rig } from './rig';
import { createLinkFaceGeometry, linkMouthHeight } from './face-geometry';
import { addOutfitDetails } from './outfit-details';
import { buildGear } from './gear';
import { linkEyeSurface } from './eye-surface';
import { applyLinkSkinPigment, linkMouthMaterial } from './skin-surface';
import { createLinkEyeWhite, createLinkEyelid, createLinkUpperLashPath } from './eye-aperture';
import { createLinkBoot } from './boot-geometry';
import { createLinkFrontalHair } from './hair-geometry';
import { createLinkFringeLocks } from './fringe-geometry';
import { createLinkSideburnLocks } from './sideburn-geometry';
import { createLinkUnderEarHair } from './under-ear-hair';
import { createLinkScalpAndNape } from './scalp-geometry';
import { createArmArticulation } from './arm-articulation';
import { createBootArticulation } from './boot-articulation';
import { createLinkCapArticulation } from './cap-articulation';
import { createLinkSleeve } from './sleeve-geometry';
import { createLinkSleeveStitches } from './sleeve-stitches';
import { finishLinkSleeveThreadNormals, shapeLinkSleeveDrape } from './sleeve-drape';
import { createLinkNeckline } from './neckline-geometry';
import { createLinkCollarStitches } from './collar-stitches';
import { createLinkLeatherMaterial } from './leather-material';
import { batchStaticLinkParts } from './static-batching';
import { normalizeLinkClothUVs } from './cloth-uv';
import { normalizeLinkHairUVs } from './hair-uv';
import { createLinkCapCrown } from './cap-geometry';
import { createLinkCapBrim } from './cap-brim-geometry';
import { shapeLinkCapTail } from './cap-tail-geometry';
import { createLinkRelaxedHand } from './hand-geometry';
import { createLinkStrapBuckle } from './strap-buckle-geometry';
import { createLinkPouch } from './pouch-geometry';
import { createLinkEyeSeating } from './eye-seating';
import { recessLinkOrbitals } from './orbital-recess';
import { finishLinkLeatherStrap } from './strap-surface';

export interface Character {
  kind: 'link' | 'kokiri';
  rig: Rig;
  group: Group;
  triangles: number;
  /** total height incl. hat (m) for screen-box reporting */
  height: number;
  /** Update articulated outfit geometry after posing and before any render pass. */
  syncGeometry?: () => void;
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
export function buildLegs(rig: Rig, opts: { skin: MeshStandardMaterial; boot: MeshStandardMaterial; cuff: MeshStandardMaterial | null; shaftTop: number; shapedBoots?: boolean; smoothJoints?: boolean; buckle?: MeshStandardMaterial; tights?: MeshStandardMaterial }): void {
  const p = rig.props;
  const thighLen = p.hipY - p.kneeY;
  const shinLen = p.kneeY - p.ankleY;
  const leg = opts.tights ?? opts.skin;
  for (const side of [1, -1] as const) {
    const thigh = side > 0 ? rig.thighL : rig.thighR;
    const knee = side > 0 ? rig.kneeL : rig.kneeR;
    const ankle = side > 0 ? rig.ankleL : rig.ankleR;
    // Link's limb ends approach the joint equator, burying the flat caps and
    // reducing the scalloped normal discontinuity of the coarse sphere joins.
    const radial = opts.smoothJoints ? 32 : 12;
    part(thigh, place(new CylinderGeometry(0.06, opts.smoothJoints ? 0.0556 : 0.052, thighLen + 0.02, radial), 0, -thighLen / 2 + 0.01, 0), leg, 'thigh');
    part(knee, place(new CylinderGeometry(opts.smoothJoints ? 0.0556 : 0.048, 0.04, shinLen, radial), 0, -shinLen / 2, 0), leg, 'shin');
    // knee cap
    part(knee, opts.smoothJoints ? new SphereGeometry(0.056, 48, 32) : opts.shapedBoots ? new SphereGeometry(0.056, 16, 12) : new SphereGeometry(0.05, 10, 8), leg, 'knee');
    const soleY = rig.sole.y;
    if (opts.shapedBoots) {
      const boot = createLinkBoot(soleY, opts.shaftTop);
      part(ankle, boot.upper, opts.boot, 'boot');
      part(ankle, boot.sole, matte('sole'), 'boot-sole');
      if (opts.cuff) part(ankle, boot.cuff, opts.cuff, 'boot-cuff');
      else boot.cuff.dispose();
    } else {
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
    }
    if (opts.buckle) part(ankle, place(new BoxGeometry(0.018, 0.022, 0.006), side * 0.06, opts.shaftTop - 0.075, 0.01), opts.buckle, 'boot-buckle', false);
  }
}

/**
 * Arms: optional tunic sleeve over the shoulder, then either bare skin or the long-sleeved
 * undershirt (`under`) down to a tight cuff at the wrist; skin hand.
 */
export function buildArms(rig: Rig, opts: { skin: MeshStandardMaterial; sleeve: MeshStandardMaterial | null; sleeveRadius?: number; shapedSleeves?: boolean; shapedHands?: boolean; smoothJoints?: boolean; under?: MeshStandardMaterial; cuff?: MeshStandardMaterial }): void {
  const p = rig.props;
  const limb = opts.under ?? opts.skin;
  for (const side of [1, -1] as const) {
    const shoulder = side > 0 ? rig.shoulderL : rig.shoulderR;
    const elbow = side > 0 ? rig.elbowL : rig.elbowR;
    const radial = opts.smoothJoints ? 32 : 10;
    const elbowRadius = opts.smoothJoints ? 0.0407 : 0.039;
    part(shoulder, place(new CylinderGeometry(0.045, elbowRadius, p.upperArm, radial), 0, -p.upperArm / 2, 0), limb, 'upper-arm');
    if (opts.sleeve) {
      const radius = opts.sleeveRadius ?? 0.06;
      const sleeve = opts.shapedSleeves ? createLinkSleeve() : merge([place(new SphereGeometry(radius, 12, 8), 0, 0.0, 0), place(new CylinderGeometry(radius, radius * 0.9, 0.1, 12), 0, -0.05, 0)]);
      part(shoulder, sleeve, opts.sleeve, 'sleeve');
    } else {
      part(shoulder, new SphereGeometry(0.05, 12, 8), limb, 'shoulder');
    }
    part(elbow, new SphereGeometry(0.041, opts.smoothJoints ? 48 : 10, opts.smoothJoints ? 32 : 8), limb, 'elbow');
    part(elbow, place(new CylinderGeometry(elbowRadius, 0.033, p.forearm - 0.02, radial), 0, -(p.forearm - 0.02) / 2, 0), limb, 'forearm');
    if (opts.under) part(elbow, place(new CylinderGeometry(0.036, 0.037, 0.03, 10), 0, -p.forearm + 0.005, 0), opts.cuff ?? opts.under, 'sleeve-cuff');
    if (opts.shapedHands) {
      const hand = createLinkRelaxedHand(p.forearm, side);
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

export type FaceOptions = {
  skin: MeshStandardMaterial;
  earLength: number;
} & ({ softFeatures: true; iris?: never }
  | { softFeatures?: false; iris: MeshStandardMaterial });

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
  const skull = opts.softFeatures ? createLinkFaceGeometry(r) : merge([
    place(new SphereGeometry(r, 24, 18), 0, 0, 0, undefined, [1, 1.04, 0.98]),
    // nose
    place(new SphereGeometry(0.013, 8, 6), 0, -0.02 * (r / 0.125), r * 0.98),
    ear(1),
    ear(-1),
  ]);
  part(head, skull, opts.skin, 'skull');
  const white = matte('eyeWhite', { roughness: 0.6 });
  const pupil = matte('pupil', { roughness: 0.6 });
  for (const side of [1, -1] as const) {
    const eye = new Group();
    eye.name = 'eye';
    const k = r / 0.125;
    const soft = !!opts.softFeatures;
    eye.position.set(side * 0.05 * k, -0.002 * k, r * (soft ? 0.94 : 0.84));
    if (soft) {
      eye.rotation.y = side * 0.4;
      // Recess the whole aperture along its own normal. The rim's outer depth
      // compensates above, keeping its perimeter seated in the existing face.
      eye.translateZ(-0.0025 * k);
    }
    head.add(eye);
    if (soft) {
      eye.updateMatrix();
      part(eye, createLinkEyeWhite(k), linkEyeSurface(), 'eye-white', false);
      part(eye, createLinkEyelid(k, skull, eye.matrix), opts.skin, 'eyelid', false);
      const lid = createLinkUpperLashPath(k);
      part(eye, sweep(lid, [0.0005 * k, 0.0014 * k, 0.0014 * k, 0.0005 * k], { segments: 18, radial: 5 }), matte('brow'), 'lashes', false);
    } else {
      part(eye, place(new SphereGeometry(0.032 * k, 12, 8), 0, 0, 0, undefined, [1, 0.92, 0.55]), white, 'eye-white', false);
      part(eye, place(new SphereGeometry(0.0235 * k, 10, 8), 0, -0.001, 0.016 * k, undefined, [1, 1, 0.45]), opts.iris, 'iris', false);
      part(eye, place(new SphereGeometry(0.013 * k, 8, 6), 0, -0.001, 0.0262 * k, undefined, [1, 1, 0.5]), pupil, 'pupil', false);
      part(eye, place(new TorusGeometry(0.031 * k, 0.0032, 5, 12, Math.PI), 0, 0.002, 0.012 * k, [0.35, 0, 0], [1, 0.95, 1]), pupil, 'lashes', false);
    }
    // Legacy NPC highlight. Link's continuous wet surface reflects scene lighting.
    if (!soft) part(eye, new SphereGeometry(0.0035 * k, 6, 4).translate(side * 0.004 * k, 0.005 * k, 0.031 * k), white, 'eye-highlight', false);
    rig.eyes.push(eye);
    if (soft) {
      const surface = new Mesh(skull, opts.skin);
      const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
      const brow = Array.from({ length: 9 }, (_, i) => {
        const u = i / 8 * 2 - 1, x = (side * 0.052 + u * 0.019) * k;
        const y = (0.029 + 0.006 * (1 - u * u) - side * 0.002 * u) * k;
        ray.ray.origin.set(x, y, 0.3 * k);
        const hit = ray.intersectObject(surface, false)[0];
        if (!hit) throw new Error('Link brow must remain seated on the forehead');
        return new Vector3(x, y, hit.point.z + 0.0013 * k);
      });
      part(head, sweep(brow, [0.0004 * k, 0.0020 * k, 0.0020 * k, 0.0004 * k],
        { segments: 24, radial: 8, closeTip: true, closeStart: true, flatten: 0.35,
          flattenFromRoot: true, surfaceNormal: new Vector3(side * 0.4, 0.2, 1).normalize() }), matte('brow'), 'brow', false);
    } else {
      part(head, place(new BoxGeometry(0.046 * k, 0.008, 0.008), side * 0.052 * k,
        0.047 * k, r * 0.87, [0, 0, side * 0.12]), matte('brow'), 'brow', false);
    }
  }
  if (opts.softFeatures) {
    // Seat a small curved mouth seam on the continuous face instead of a flat box.
    const k = r / 0.125, surface = new Mesh(skull, opts.skin);
    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
    const seam = Array.from({ length: 9 }, (_, i) => {
      const u = i / 8 * 2 - 1, x = u * 0.015 * k;
      const y = linkMouthHeight(x, k);
      ray.ray.origin.set(x, y, 0.3 * k);
      const hit = ray.intersectObject(surface, false)[0];
      if (!hit) throw new Error('Link mouth must remain seated on the face');
      return new Vector3(x, y, hit.point.z + 0.00018 * k);
    });
    part(head, sweep(seam, [0.0002 * k, 0.00042 * k, 0.00042 * k, 0.0002 * k],
      { segments: 20, radial: 6, closeStart: true, closeTip: true }), linkMouthMaterial(), 'mouth', false);
    // Fine facial layers should not cast jagged self-shadows, but must receive
    // the same cap, hair and canopy shade as the skull they sit on.
    head.traverse(object => {
      if (object instanceof Mesh) object.receiveShadow = true;
    });
  } else {
    part(head, place(new BoxGeometry(0.032, 0.005, 0.006), 0, -0.056 * (r / 0.125), r * 0.9), matte('mouth'), 'mouth', false);
  }
}

/** Hair: cap of hair leaving the face open + swept fringe + sideburns. */
export function buildHair(rig: Rig, hair: MeshStandardMaterial, style: 'link' | 'bob'): void {
  const r = rig.props.headRadius;
  const head = rig.head;
  if (style === 'link') {
    const parts = [
      // back/sides of the head, open toward the face (+Z is phi = π/2)
      createLinkScalpAndNape(r),
      createLinkFrontalHair(r),
      createLinkFringeLocks(r),
      // Unequal rounded temple locks replace the old broad side strips.
      createLinkSideburnLocks(r),
      createLinkUnderEarHair(r),
    ];
    const geometry = merge(parts);
    normalizeLinkHairUVs(geometry);
    part(head, geometry, hair, 'hair');
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
function leatherBand(points: Vector3[], width: number, surfaces: Mesh[], shoulderY: number, upperLayer: boolean): BufferGeometry {
  const vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  const tangent = new Vector3(), outward = new Vector3(), side = new Vector3(), vertex = new Vector3();
  const curve = new CatmullRomCurve3(points), ray = new Raycaster();
  const segments = 64, across = 4, ringSize = (across + 1) * 2;
  for (let i = 0; i <= segments; i++) {
    const p = curve.getPoint(i / segments);
    tangent.copy(curve.getTangent(i / segments));
    // An upward normal around the shoulder avoids a frame flip as Z crosses zero.
    outward.set(p.x * 0.25, Math.max(0, p.y - shoulderY + 0.025) * 3, p.z).normalize();
    side.crossVectors(tangent, outward).normalize();
    outward.crossVectors(side, tangent).normalize();
    // Fit both faces to the same actual garment hit. Subdivision across the
    // width keeps the ribbon above curved cloth between its outer edges.
    for (const layer of [1, -1]) for (let j = 0; j <= across; j++) {
      vertex.copy(p).addScaledVector(side, (0.5 - j / across) * width);
      ray.set(vertex.clone().addScaledVector(outward, 0.2), outward.clone().negate());
      const hit = ray.intersectObjects(surfaces, false)[0];
      if (hit) vertex.copy(hit.point);
      const crossingLift = upperLayer && p.z > 0 ? 0.006 * Math.exp(-(((p.y - (shoulderY - 0.105)) / 0.05) ** 4)) : 0;
      vertex.addScaledVector(outward, 0.006 + crossingLift + layer * 0.002);
      vertices.push(vertex.x, vertex.y, vertex.z);
      uvs.push(j / across, i / segments * 4);
    }
    if (i < segments) {
      for (let face = 0; face < 2; face++) for (let j = 0; j < across; j++) {
        const a = i * ringSize + face * (across + 1) + j, b = a + ringSize;
        indices.push(...(face === 0 ? [a, b, a + 1, b, b + 1, a + 1] : [a, a + 1, b, b, a + 1, b + 1]));
      }
      for (const j of [0, across]) {
        const a = i * ringSize + j, b = a + ringSize, c = a + across + 1, d = b + across + 1;
        indices.push(...(j === 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
      }
    }
  }
  // The medial shoulder turn crosses the existing undershirt and tunic rim.
  // Bridge their support edges using nearby fitted heights, preserving the
  // ribbon's thickness; both ends fade back to the unchanged lower route.
  const supported = vertices.slice();
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= across; j++) {
    const v = (i * ringSize + across + 1 + j) * 3;
    const weight = MathUtils.smoothstep(supported[v + 1], shoulderY - 0.020, shoulderY + 0.005)
      * (1 - MathUtils.smoothstep(Math.abs(supported[v + 2]), 0.045, 0.090));
    if (weight === 0) continue;
    let supportedY = supported[v + 1];
    for (let ni = Math.max(0, i - 6); ni <= Math.min(segments, i + 6); ni++) for (let nj = 0; nj <= across; nj++) {
      const q = (ni * ringSize + across + 1 + nj) * 3;
      const distance = Math.hypot(supported[v] - supported[q], supported[v + 2] - supported[q + 2]);
      if (distance < 0.025) supportedY = Math.max(supportedY, supported[q + 1] - distance * 0.35);
    }
    const lift = (supportedY - supported[v + 1]) * weight;
    vertices[v + 1] += lift;
    vertices[v - (across + 1) * 3 + 1] += lift;
  }
  // A fitted vertex may lie beside a collar edge while the triangle between
  // vertices crosses its raised fabric. Bridge a small neighbourhood with a
  // conservative, gently sloping envelope instead of dropping at that edge.
  const fitted = vertices.slice();
  for (let i = 0; i <= segments; i++) for (let j = 0; j <= across; j++) {
    const v = (i * ringSize + across + 1 + j) * 3;
    if (fitted[v + 2] < 0.04) continue;
    const returnSlope = upperLayer ? 0.18 : MathUtils.lerp(0.18, 1.5,
      MathUtils.smoothstep(fitted[v + 1], shoulderY - 0.015, shoulderY + 0.005));
    let supportedZ = fitted[v + 2];
    for (let ni = Math.max(0, i - 6); ni <= Math.min(segments, i + 6); ni++) for (let nj = 0; nj <= across; nj++) {
      const q = (ni * ringSize + across + 1 + nj) * 3;
      const distance = Math.hypot(fitted[v] - fitted[q], fitted[v + 1] - fitted[q + 1]);
      if (distance < 0.025) supportedZ = Math.max(supportedZ, fitted[q + 2] - distance * returnSlope);
    }
    const lift = supportedZ - fitted[v + 2];
    vertices[v + 2] += lift;
    vertices[v - (across + 1) * 3 + 2] += lift;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
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
  const upperMesh = part(rig.chest, upper, tunic, 'tunic-upper');
  // Identity-space copies are only used to fit garment layers at construction.
  const garmentSurfaces = [new Mesh(upper, tunic)];
  const garmentRay = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  // skirt (hips joint): soft scalloped mid-thigh hem with three vertical fold ridges
  const skirt = ovalLathe(
    [
      [0.15, hl(0.4)],
      [0.132, hl(0.5)],
      [0.113, hl(0.58)],
      [0.108, hl(0.635)],
    ],
    { segments: 72, scaleZ: 0.8, scallops: 18, scallopDepth: 0.010, folds: 3, foldDepth: 0.05 },
  );
  part(rig.hips, skirt, tunic, 'tunic-skirt');
  // Rounded satchel stays inside the original two-box pouch envelope.
  const pouch = createLinkPouch();
  const pouchLeather = createLinkLeatherMaterial(matte('packLeather'), [1, 1]);
  const closureLeather = createLinkLeatherMaterial(matte('leather'), [1, 1]);
  part(rig.hips, place(pouch.leather, .105, hl(.6), .03, [0, .55, 0]), pouchLeather, 'pouch');
  part(rig.hips, place(pouch.closure, .105, hl(.6), .03, [0, .55, 0]), closureLeather, 'pouch-closure');
  part(rig.hips, place(pouch.stitches, .105, hl(.6), .03, [0, .55, 0]), matte('leatherStitch'), 'pouch-stitches');
  part(rig.hips, place(pouch.stud, .105, hl(.6), .03, [0, .55, 0]), matte('buckle'), 'pouch-stud');
  // Pale undershirt behind two folded collar flaps, open at the front of the neck.
  const undershirt = part(rig.chest, place(new CylinderGeometry(0.054, 0.06, 0.045, 16), 0, cl(0.8325), 0), matte('undershirt'), 'undershirt');
  garmentSurfaces.push(new Mesh(undershirt.geometry, matte('undershirt')));
  const collarMeshes: Mesh[] = [];
  for (const sign of [1, -1]) {
    const outline = [[0.015, 0.855, 0.056], [0.077, 0.852, 0.064], [0.096, 0.813, 0.083], [0.050, 0.785, 0.101], [0.020, 0.824, 0.098]];
    const centre = new Vector3(sign * 0.047, cl(0.834), 0.094);
    const vertices = [...centre.toArray()];
    const uv = [0.5, 0.5], indices: number[] = [];
    const rings = 8, edgeSteps = 8, segments = outline.length * edgeSteps;
    for (let ring = 1; ring <= rings; ring++) for (let j = 0; j < segments; j++) {
      const edge = Math.floor(j / edgeSteps), t = (j % edgeSteps) / edgeSteps;
      const a = outline[edge], b = outline[(edge + 1) % outline.length];
      const v = new Vector3(sign * MathUtils.lerp(a[0], b[0], t), cl(MathUtils.lerp(a[1], b[1], t)), MathUtils.lerp(a[2], b[2], t)).lerp(centre, 1 - ring / rings);
      garmentRay.ray.origin.set(v.x, v.y, 0.3);
      const hit = garmentRay.intersectObject(garmentSurfaces[0], false)[0];
      if (hit) v.z = Math.max(v.z, hit.point.z + 0.0035);
      vertices.push(v.x, v.y, v.z); uv.push(v.x * 10, (v.y - cl(0.78)) * 10);
      const q = 1 + (ring - 1) * segments + j, next = 1 + (ring - 1) * segments + (j + 1) % segments;
      const faces = ring === 1 ? [0, next, q] : [q - segments, next, q, q - segments, next - segments, next];
      if (sign < 0) for (let k = 0; k < faces.length; k += 3) [faces[k + 1], faces[k + 2]] = [faces[k + 2], faces[k + 1]];
      indices.push(...faces);
    }
    const flap = new BufferGeometry();
    flap.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    flap.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    flap.setIndex(indices); flap.computeVertexNormals();
    const collarMaterial = cloth('tunicCollar');
    collarMeshes.push(part(rig.chest, flap, collarMaterial, 'collar-flap'));
    garmentSurfaces.push(new Mesh(flap, collarMaterial));
  }
  // Fit the collars to the original torso first, then open only the central V.
  // The closed edge returns cover this cut; the existing outer flap boundaries stay open.
  const neckline = createLinkNeckline(upper, collarMeshes.map(mesh => mesh.geometry), p.chestY);
  upperMesh.geometry = neckline.upper;
  garmentSurfaces[0].geometry = neckline.upper;
  collarMeshes.forEach((mesh, i) => {
    const original = mesh.geometry;
    mesh.geometry = neckline.collarFlaps[i];
    garmentSurfaces[i + 2].geometry = neckline.collarFlaps[i];
    original.dispose();
  });
  upper.dispose();
  part(rig.chest, createLinkCollarStitches(neckline.collarFlaps), matte('clothThread'), 'collar-stitches', false);
  part(rig.chest, neckline.insert, matte('undershirt'), 'neckline-insert');
  garmentSurfaces.push(new Mesh(neckline.insert, matte('undershirt')));
  // belt + round buckle
  const leather = matte('leather');
  part(rig.hips, ovalLathe([[0.116, hl(0.596)], [0.120, hl(0.601)], [0.120, hl(0.634)], [0.116, hl(0.639)]], { segments: 36, scaleZ: 0.83 }), createLinkLeatherMaterial(leather, [.696, .096]), 'belt');
  const buckle = merge([place(new TorusGeometry(0.022, 0.0035, 8, 24), 0, hl(0.615), 0.108), place(new BoxGeometry(0.003, 0.034, 0.004), 0, hl(0.615), 0.108)]);
  const hardware = matte('buckle', { roughness: 0.75 }).clone();
  hardware.color.set(0xa69b83); hardware.metalness = 0.25;
  part(rig.hips, buckle, hardware, 'buckle', false);
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
      const upper = MathUtils.smoothstep(y, 0.815, 0.84);
      const x = sign * (0.08 - 0.165 * s - 0.015 * upper);
      const zz = Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * rz + 0.007;
      pts.push(new Vector3(x, cl(y), zz));
    }
    // over the shoulder and a little way down the back
    pts.unshift(new Vector3(sign * 0.065, cl(0.825), -0.075), new Vector3(sign * 0.059, cl(0.865), -0.02));
    return pts.reverse();
  };
  for (const sign of [1, -1] as const) {
    const band = leatherBand(strapPts(sign), sign > 0 ? 0.028 : 0.021, garmentSurfaces, cl(0.835), sign > 0);
    if (sign > 0) {
      const finish = finishLinkLeatherStrap(band, leather);
      part(rig.chest, band, finish.material, 'strap');
      part(rig.chest, createLinkStrapBuckle(band, rig.props.chestY), hardware, 'strap-buckle', false);
      part(rig.chest, finish.stitches, matte('leatherStitch'), 'strap-stitches', false);
    } else part(rig.chest, band, cloth('tunicCollar'), 'strap');
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
  const tailSway = new Group();
  tailSway.name = 'cap-tail-sway';
  cap.add(tailSway);
  rig.capTail = tailSway;
  const capMat = cloth('cap');
  // A low cloth crown follows the skull, then folds into the tail behind the head.
  const R = hairR + 0.008;
  const stretch = 1.12;
  const thetaMax = Math.acos(d / (stretch * R));
  const sinMax = Math.sin(thetaMax);
  const taper = (theta: number) => 1 - 0.18 * Math.pow(Math.max(0, 1 - Math.sin(theta) / sinMax), 1.5);
  const rimR = R * sinMax;
  const dome = createLinkCapCrown(r);
  // sphere pole (+Y) → n is a rotation about X by -tilt; the dome centre is the head centre
  part(cap, place(dome, -centre.x, -centre.y, -centre.z, [-tilt, 0, 0]), capMat, 'cap-dome');
  // Tail: emerges from the back of the peak, folds back and drapes down between the shoulder
  // blades. `b` is "backward" in the brim frame (perpendicular to n).
  const b = new Vector3(0, -Math.sin(tilt), -Math.cos(tilt));
  const domeAt = (theta: number, scale: number) => n.clone().multiplyScalar(-d + scale * R * stretch * Math.cos(theta)).addScaledVector(b, scale * R * Math.sin(theta) * taper(theta));
  // Broad cloth grows out of a buried crown root and folds down over the pack.
  // Keep its thickness backward-facing so the upper drape stays wide, not tubular.
  const pts = [
    // Begin well inside the crown; the section emerges tangentially at the
    // back instead of protruding through its top as a separate raised tube.
    domeAt(0.45, 0.40),
    domeAt(0.90, 0.64),
    domeAt(1.15, 0.86),
    new Vector3(0.006, -0.052, -0.165),
    new Vector3(0.010, -0.105, -0.195),
    new Vector3(-0.010, -0.190, -0.225),
    new Vector3(-0.014, -0.275, -0.244),
    new Vector3(-0.008, -0.325, -0.247),
  ].map((v, i) => (i < 3 ? v : v.multiplyScalar(k)));
  part(tailSway, shapeLinkCapTail(sweep(pts, [0.076, 0.096, 0.099, 0.087, 0.069, 0.046, 0.021, 0.0018].map(v => v * k),
    { segments: 36, radial: 12, closeTip: true, closeStart: true, flatten: 0.22,
      flattenFromRoot: true, crease: 0.10, surfaceNormal: new Vector3(0, 0, -1) }), r), capMat, 'cap-tail');
  // Sewn band retains the original brim plane and fitted circumference.
  const brim = createLinkCapBrim(rimR);
  part(cap, place(brim.band, 0, 0, 0, [Math.PI / 2 - tilt, 0, 0]), cloth('capBrim'), 'cap-brim');
  part(cap, place(brim.stitches, 0, 0, 0, [Math.PI / 2 - tilt, 0, 0]), matte('clothThread'), 'cap-brim-stitches', false);
}


export function createLink(): Character {
  beginTally();
  const rig = buildRig(LINK_PROPORTIONS, 'link');
  const skin = matte('linkSkin', { roughness: .72 });
  // reference frames 1 s / 14 s: bare arms below the puffed tunic sleeves and bare legs between the
  // ragged hem and the boot cuffs (the pale undershirt only shows at the collar)
  // Integer repeats meet across the repaired upper/cuff wrap seams. Their
  // median physical UV scales keep the original pebble grain close to 1.5 mm.
  const bootLeather = createLinkLeatherMaterial(matte('boot'), [.360, .288]);
  const cuffLeather = createLinkLeatherMaterial(matte('linkBootCuff'), [.408, .120]);
  buildLegs(rig, { skin, boot: bootLeather, cuff: cuffLeather, shaftTop: 0.135, shapedBoots: true, smoothJoints: true, buckle: matte('buckle', { roughness: 0.6 }) });
  buildArms(rig, { skin, sleeve: cloth('tunic'), shapedSleeves: true, shapedHands: true, smoothJoints: true });
  for (const shoulder of [rig.shoulderL, rig.shoulderR]) {
    const sleeve = shoulder.getObjectByName('sleeve') as Mesh;
    const stitches = createLinkSleeveStitches(sleeve.geometry);
    const side = shoulder === rig.shoulderL ? 1 : -1;
    shapeLinkSleeveDrape(sleeve.geometry, side);
    shapeLinkSleeveDrape(stitches, side);
    finishLinkSleeveThreadNormals(stitches, side);
    part(shoulder, stitches, matte('clothThread'), 'sleeve-stitches', false);
  }
  buildTorso(rig);
  buildNeck(rig, skin);
  buildFace(rig, { skin, earLength: 0.085, softFeatures: true });
  applyLinkSkinPigment(rig);
  recessLinkOrbitals(rig);
  const syncEyes = createLinkEyeSeating(rig);
  buildHair(rig, linkHair(), 'link');
  buildCap(rig);
  buildGear(rig, part);
  addOutfitDetails(rig, part);
  const syncBoots = createBootArticulation(rig);
  const syncArms = createArmArticulation(rig);
  normalizeLinkClothUVs(rig);
  const syncCap = createLinkCapArticulation(rig);
  const syncGeometry = () => { syncBoots(); syncArms(); syncEyes(); syncCap(); };
  batchStaticLinkParts(rig);
  rig.root.userData.character = 'link';
  // Articulation replaces the boot geometry; count the resulting scene, including its joint.
  let triangles = 0;
  rig.root.traverse(o => { if (o instanceof Mesh) triangles += triangleCount(o.geometry); });
  return { kind: 'link', rig, group: rig.root, triangles, height: 1.25, syncGeometry };
}

export { CHAR_COLORS };
