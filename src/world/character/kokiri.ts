/**
 * Kokiri kids (~1.16 m with the cap) — an original procedural low-poly child on the shared rig,
 * reworked for the owner review of 2026-09-19 (items 7–8, until Astra's model lands): child
 * proportions (head ≈ ¼ of the height), a green tunic with puffed short sleeves, a leather belt
 * with a buckle and a four-flap skirt, brown boots with a fold-over cuff, an auburn bob with a
 * bang fringe under a soft pointed cap that flops back, and a drawn face — the eyes (blinkable,
 * squashed in Y like every rig's `eyes`) and the mouth are canvas decals on the skull instead of
 * stacked spheres, which reads as a face at 2 m and costs 2 meshes where the sphere eyes cost 8.
 *
 * `variant` 0 = the girl who wanders the plaza (kokiri-a), 1 = the girl who sits on the steps
 * (kokiri-b, darker tunic, lighter hair), 2 = the boy at Saria's door (headband, sleeveless,
 * Deku Stick — the round-1 look). Every material is cached per variant so the per-joint merge
 * (consolidate.ts) keeps a kid at ~21 meshes.
 */
import { BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, Group, MathUtils, MeshStandardMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three';
import { merge, ovalLathe, place, sweep } from './geometry';
import { CHAR_COLORS, matte } from './palette';
import { beginTally, buildArms, buildFace, buildHair, buildLegs, buildNeck, endTally, part, type Character } from './link';
import { buildRig, type Proportions, type Rig } from './rig';

/**
 * A Kokiri child: 1.06 m to the skull top (1.16 with the cap), head 0.26 m across — a quarter of
 * the height — short legs, arms reaching the hips. Same rig conventions as rig.ts (root at the
 * sole, +Z forward).
 */
export const KOKIRI_CHILD_PROPORTIONS: Proportions = {
  height: 1.06,
  ankleY: 0.06,
  kneeY: 0.26,
  hipY: 0.47,
  hipHalfWidth: 0.058,
  chestY: 0.6,
  shoulderY: 0.77,
  shoulderHalfWidth: 0.118,
  upperArm: 0.145,
  forearm: 0.13,
  neckY: 0.8,
  headCentreY: 0.94,
  headRadius: 0.13,
  sole: [0, -0.06, 0.025],
};

/** kid palette (albedo, ≈ 1.3× the hazed display values like palette.ts): the girls' moss-green tunic, leather, brown boots */
const KID = {
  tunic: [0x44602f, 0x3a5230, 0x2f3a1e],
  cap: [0x51703a, 0x466238],
  belt: 0x5a4028,
  buckle: 0xb8963f,
  boot: 0x5e4229,
  hair: [0x8a5a36, 0x6b4a30, 0x9a6a3a],
  skin: [0xb8845c, 0xb07e58, 0xb28058],
  mouth: '#6b3a30',
  iris: ['#5a3a22', '#4a3320', '#3b5a2c'],
} as const;

const mats = new Map<string, MeshStandardMaterial>();
function kidMat(key: string, color: number, roughness = 0.9): MeshStandardMaterial {
  const id = `${key}:${color}:${roughness}`;
  let m = mats.get(id);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(color), roughness, metalness: 0 });
    m.name = `char-kid-${key}`;
    mats.set(id, m);
  }
  return m;
}

/** the round-1 variant tint helper (the boy keeps the palette's kid colours) */
function tinted(key: 'kidHair' | 'kidSkin' | 'kidHeadband' | 'kidTunic', variant: number, hueShift: number, lightScale: number): MeshStandardMaterial {
  const c = new Color(CHAR_COLORS[key]);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + hueShift + 1) % 1, hsl.s, Math.min(1, hsl.l * lightScale));
  return kidMat(`${key}-${variant}`, c.getHex());
}

// ---- face decals (drawn once per iris colour, shared by the kids that use it) ----

const decalCache = new Map<string, { eyes: MeshStandardMaterial; mouth: MeshStandardMaterial }>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function decalMaterial(tex: CanvasTexture, name: string): MeshStandardMaterial {
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  const m = new MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.55, metalness: 0 });
  m.name = name;
  return m;
}

/**
 * Two big stylised eyes with brows on a transparent 256×128 canvas (u 0 = her right, the viewer's
 * left): almond sclera, an iris of the given colour with a darker rim, a pupil, a catch-light
 * high on the outer side, a thick upper lash line with a small outer flick, and an arched brow.
 * The mouth is a separate 128×64 decal so the blink (Y squash of the eye patch) leaves it alone.
 */
function faceDecals(iris: string): { eyes: MeshStandardMaterial; mouth: MeshStandardMaterial } {
  let d = decalCache.get(iris);
  if (d) return d;
  const [ec, g] = canvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  for (const side of [-1, 1] as const) {
    const cx = 128 + side * 52;
    const cy = 70;
    // sclera: almond, slightly tilted up at the outer corner
    g.save();
    g.translate(cx, cy);
    g.rotate(side * -0.12);
    g.fillStyle = '#f4f1ea';
    g.beginPath();
    g.ellipse(0, 0, 30, 21, 0, 0, Math.PI * 2);
    g.fill();
    // iris + rim, pupil, catch-light
    const ir = g.createRadialGradient(-2, -2, 2, 0, 0, 16);
    ir.addColorStop(0, iris);
    ir.addColorStop(0.75, iris);
    ir.addColorStop(1, '#1e150c');
    g.fillStyle = ir;
    g.beginPath();
    g.ellipse(side * 3, 1, 15.5, 16.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0f0d0c';
    g.beginPath();
    g.ellipse(side * 3, 1.5, 7.5, 8.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.ellipse(side * -3, -6, 4.2, 3.4, 0, 0, Math.PI * 2);
    g.fill();
    // upper lash line hugging the top of the almond, thicker outward, with a flick
    g.strokeStyle = '#2a1a12';
    g.lineCap = 'round';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(0, 0, 31, 22, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(side * 27, -10);
    g.lineTo(side * 36, -17);
    g.stroke();
    // lower lid: a faint line under the outer half
    g.strokeStyle = 'rgba(90,60,40,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, 0, 30, 21, 0, Math.PI * 0.1, Math.PI * 0.5);
    g.stroke();
    g.restore();
    // brow: an arch above the eye, thicker at the inner end
    g.strokeStyle = '#5a3a22';
    g.lineCap = 'round';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(cx - side * 30, cy - 34);
    g.quadraticCurveTo(cx + side * 6, cy - 50, cx + side * 34, cy - 40);
    g.stroke();
  }
  const eyes = decalMaterial(new CanvasTexture(ec), 'char-kid-face-eyes');
  const [mc, m] = canvas(128, 64);
  m.clearRect(0, 0, 128, 64);
  // a small closed smile with a soft lower-lip tint
  m.strokeStyle = KID.mouth;
  m.lineCap = 'round';
  m.lineWidth = 4;
  m.beginPath();
  m.moveTo(44, 30);
  m.quadraticCurveTo(64, 42, 84, 30);
  m.stroke();
  m.fillStyle = 'rgba(160,90,80,0.55)';
  m.beginPath();
  m.moveTo(48, 33);
  m.quadraticCurveTo(64, 46, 80, 33);
  m.quadraticCurveTo(64, 39, 48, 33);
  m.fill();
  const mouth = decalMaterial(new CanvasTexture(mc), 'char-kid-face-mouth');
  d = { eyes, mouth };
  decalCache.set(iris, d);
  return d;
}

/**
 * The girl's head: skull with nose and pointed ears (skin), the eye decal on its own blinkable
 * group and the mouth decal — both spherical patches hugging the skull 1.5 mm out.
 */
function buildGirlFace(rig: Rig, skin: MeshStandardMaterial, iris: string): void {
  const r = rig.props.headRadius;
  const head = rig.head;
  const ear = (side: 1 | -1) => {
    const cone = place(new ConeGeometry(0.02, 0.065, 8), 0, 0, 0, [0, 0, side * (-Math.PI / 2 + 0.14)]);
    const dir = new Vector3(side * Math.cos(0.14), Math.sin(0.14), 0).applyAxisAngle(new Vector3(0, 1, 0), side * 0.5);
    const base = new Vector3(side * r * 0.9, 0.01, -0.01);
    const c = base.addScaledVector(dir, 0.065 * 0.42);
    return place(cone, c.x, c.y, c.z, [0, side * 0.5, 0]);
  };
  const skull = merge([
    // a child's skull: a little wider than tall at the cheeks, a soft chin
    place(new SphereGeometry(r, 22, 16), 0, 0, 0, undefined, [1, 1.02, 0.98]),
    place(new SphereGeometry(r * 0.62, 12, 8), 0, -r * 0.52, r * 0.18, undefined, [1.1, 0.8, 1]),
    place(new SphereGeometry(0.012, 8, 6), 0, -0.012, r * 0.985),
    ear(1),
    ear(-1),
  ]);
  part(head, skull, skin, 'skull');
  const decals = faceDecals(iris);
  // the decal patches follow the skull's [1, 1.02, 0.98] scale 1.2 % out (≈ 1.6 mm), so they hug it everywhere
  const patch = (phi0: number, phiLen: number, theta0: number, thetaLen: number, w: number, h: number) => place(new SphereGeometry(r * 1.012, w, h, phi0, phiLen, theta0, thetaLen), 0, 0, 0, undefined, [1, 1.02, 0.98]);
  // the eye patch: ±38° around the front, from the brow line to the cheek, its eye line at the head centre
  const eyes = new Group();
  eyes.name = 'eye';
  head.add(eyes);
  part(eyes, patch(Math.PI / 2 - 0.66, 1.32, Math.PI / 2 - 0.28, 0.5, 18, 10), decals.eyes, 'face-eyes', false);
  rig.eyes.push(eyes);
  part(head, patch(Math.PI / 2 - 0.3, 0.6, Math.PI / 2 + 0.26, 0.3, 12, 6), decals.mouth, 'face-mouth', false);
}

/** auburn bob with a straight bang fringe under the cap brim, two front locks framing the face and a nape */
function buildGirlHair(rig: Rig, hair: MeshStandardMaterial): void {
  const r = rig.props.headRadius;
  const k = r / 0.125;
  const clump = (from: [number, number, number], mid: [number, number, number], to: [number, number, number], r0: number, r1: number, tip = 0.004) =>
    sweep([new Vector3(...from).multiplyScalar(k), new Vector3(...mid).multiplyScalar(k), new Vector3(...to).multiplyScalar(k)], [r0 * k, r1 * k, tip * k], { segments: 8, radial: 7, closeTip: true, closeStart: true });
  const parts = [
    // the bob: back and sides down to the jaw, open at the face
    place(new SphereGeometry(r * 1.09, 20, 12, Math.PI * 0.7, Math.PI * 1.6, 0, Math.PI * 0.72), 0, -0.002, -0.014),
    // bangs: five clumps hanging from under the brim across the forehead to the brows
    clump([-0.078, 0.07, 0.085], [-0.086, 0.045, 0.112], [-0.09, 0.02, 0.108], 0.024, 0.022, 0.01),
    clump([-0.04, 0.074, 0.092], [-0.044, 0.048, 0.12], [-0.05, 0.026, 0.118], 0.025, 0.024, 0.011),
    clump([0.0, 0.075, 0.094], [0.0, 0.048, 0.122], [0.004, 0.028, 0.12], 0.025, 0.024, 0.011),
    clump([0.04, 0.074, 0.092], [0.044, 0.048, 0.12], [0.05, 0.026, 0.118], 0.025, 0.024, 0.011),
    clump([0.078, 0.07, 0.085], [0.086, 0.045, 0.112], [0.09, 0.02, 0.108], 0.024, 0.022, 0.01),
    // front locks in front of the ears, to the jaw
    clump([0.1, 0.04, 0.055], [0.112, -0.03, 0.06], [0.108, -0.1, 0.05], 0.022, 0.018),
    clump([-0.1, 0.04, 0.055], [-0.112, -0.03, 0.06], [-0.108, -0.1, 0.05], 0.022, 0.018),
  ];
  part(rig.head, merge(parts), hair, 'hair');
}

/**
 * A soft pointed cap: a stretched dome just outside the hair, a rolled brim, and a tail that
 * rises from the crown and flops back and down behind the head to a point. Pivoted on `rig.cap`
 * so the animation can nudge it.
 */
function buildGirlCap(rig: Rig, capMat: MeshStandardMaterial): void {
  const head = rig.head;
  const r = rig.props.headRadius;
  const k = r / 0.125;
  const cap = new Group();
  cap.name = 'cap';
  const hairR = r * 1.09;
  const tilt = 0.3;
  const d = 0.05 * k;
  const n = new Vector3(0, Math.cos(tilt), -Math.sin(tilt));
  const centre = n.clone().multiplyScalar(d);
  cap.position.copy(centre);
  head.add(cap);
  rig.cap = cap;
  const R = hairR + 0.007;
  const stretch = 1.22;
  const thetaMax = Math.acos(d / (stretch * R));
  const sinMax = Math.sin(thetaMax);
  const taper = (theta: number) => 1 - 0.32 * Math.pow(Math.max(0, 1 - Math.sin(theta) / sinMax), 1.5);
  const dome = new SphereGeometry(R, 22, 12, 0, Math.PI * 2, 0, thetaMax);
  const pos = dome.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const theta = Math.acos(MathUtils.clamp(pos.getY(i) / R, -1, 1));
    const f = taper(theta);
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * stretch, pos.getZ(i) * f);
  }
  dome.computeVertexNormals();
  const b = new Vector3(0, -Math.sin(tilt), -Math.cos(tilt));
  const domeAt = (theta: number, scale: number) => n.clone().multiplyScalar(-d + scale * R * stretch * Math.cos(theta)).addScaledVector(b, scale * R * Math.sin(theta) * taper(theta));
  const tail = [
    domeAt(0.2, 0.7),
    domeAt(0.45, 1.0),
    new Vector3(0.008, 0.1, -0.135).multiplyScalar(k),
    new Vector3(0.02, 0.04, -0.185).multiplyScalar(k),
    new Vector3(0.03, -0.05, -0.205).multiplyScalar(k),
    new Vector3(0.024, -0.14, -0.2).multiplyScalar(k),
  ];
  const geo = merge([
    place(dome, -centre.x, -centre.y, -centre.z, [-tilt, 0, 0]),
    sweep(tail, [0.056 * k, 0.052 * k, 0.045 * k, 0.034 * k, 0.02 * k, 0.004], { segments: 22, radial: 10, closeTip: true, closeStart: true, flatten: 0.7, crease: 0.25 }),
    place(new TorusGeometry(R * sinMax, 0.016, 8, 26), 0, 0, 0, [Math.PI / 2 - tilt, 0, 0]),
  ]);
  part(cap, geo, capMat, 'cap');
}

/** green tunic with puffed short sleeves (buildArms), a soft collar, a leather belt with a buckle and a four-flap skirt */
function buildGirlTunic(rig: Rig, tunic: MeshStandardMaterial): void {
  const p = rig.props;
  const hl = (y: number) => y - p.hipY;
  const cl = (y: number) => y - p.chestY;
  // upper: waist → chest → shoulders → neck opening, a little barrel-chested like a child
  part(
    rig.chest,
    merge([
      ovalLathe(
        [
          [0.096, cl(0.55)],
          [0.1, cl(0.62)],
          [0.108, cl(0.7)],
          [0.114, cl(0.76)],
          [0.106, cl(0.79)],
          [0.055, cl(0.805)],
        ],
        { segments: 22, scaleZ: 0.76 },
      ),
      // soft collar
      place(new TorusGeometry(0.066, 0.012, 8, 20), 0, cl(0.8), 0.004, [Math.PI / 2 - 0.2, 0, 0], [1, 1, 0.82]),
    ]),
    tunic,
    'kid-tunic-upper',
  );
  // skirt: flares from the waist to mid-thigh; four folds and four scallops read as hanging flaps
  part(
    rig.hips,
    ovalLathe(
      [
        [0.15, hl(0.33)],
        [0.128, hl(0.42)],
        [0.108, hl(0.5)],
        [0.098, hl(0.56)],
        [0.097, hl(0.6)],
      ],
      { segments: 32, scaleZ: 0.8, scallops: 4, scallopDepth: 0.045, folds: 4, foldDepth: 0.06, raggedHem: 0.012, seed: 31 },
    ),
    tunic,
    'kid-tunic-skirt',
  );
  // leather belt at the waist with a small square buckle at the front
  const y = hl(0.555);
  part(rig.hips, place(new TorusGeometry(0.104, 0.015, 8, 26), 0, y, 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]), kidMat('belt', KID.belt), 'kid-belt');
  part(rig.hips, merge([place(new BoxGeometry(0.036, 0.03, 0.008), 0, y, 0.088), place(new BoxGeometry(0.006, 0.03, 0.01), 0, y, 0.09)]), kidMat('buckle', KID.buckle, 0.6), 'kid-buckle', false);
}

/** the round-1 boy: near-black sleeveless tunic, rope belt, headband, bob, pouch, Deku Stick */
function buildBoy(rig: Rig, variant: number, skin: MeshStandardMaterial): void {
  const p = rig.props;
  const tunic = tinted('kidTunic', variant, 0.01 * (variant % 2), 1 + 0.12 * (variant % 2));
  const hair = tinted('kidHair', variant, -0.01 * (variant % 3), 1 - 0.1 * (variant % 2));
  buildArms(rig, { skin, sleeve: null });
  const hl = (y: number) => y - p.hipY;
  const cl = (y: number) => y - p.chestY;
  part(
    rig.hips,
    ovalLathe(
      [
        [0.13, hl(0.37)],
        [0.115, hl(0.46)],
        [0.102, hl(0.54)],
        [0.1, hl(0.6)],
      ],
      { segments: 22, scaleZ: 0.78, raggedHem: 0.025, seed: 21 + variant },
    ),
    tunic,
    'kid-tunic-skirt',
  );
  part(
    rig.chest,
    ovalLathe(
      [
        [0.098, cl(0.56)],
        [0.104, cl(0.65)],
        [0.115, cl(0.72)],
        [0.112, cl(0.77)],
        [0.07, cl(0.79)],
        [0.05, cl(0.805)],
      ],
      { segments: 22, scaleZ: 0.74 },
    ),
    tunic,
    'kid-tunic-upper',
  );
  const rope = merge([
    place(new TorusGeometry(0.106, 0.009, 6, 26), 0, hl(0.565), 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]),
    place(new TorusGeometry(0.106, 0.007, 6, 26), 0, hl(0.58), 0, [Math.PI / 2, 0, 0], [1, 1, 0.8]),
    place(new CylinderGeometry(0.008, 0.008, 0.07, 6), 0.02, hl(0.535), 0.088, [0.2, 0, 0.15]),
    place(new CylinderGeometry(0.008, 0.008, 0.06, 6), -0.015, hl(0.54), 0.09, [0.2, 0, -0.1]),
  ]);
  part(rig.hips, rope, matte('kidRope'), 'kid-rope-belt', false);
  buildFace(rig, { skin, iris: matte('irisKid', { roughness: 0.3 }), earLength: 0.07 });
  buildHair(rig, hair, 'bob');
  const band = tinted('kidHeadband', variant, 0.03 * (variant % 3), 1);
  part(rig.head, place(new TorusGeometry(p.headRadius * 1.1, 0.011, 6, 26), 0, 0.032, 0.004, [Math.PI / 2 - 0.12, 0, 0], [1, 1, 0.98]), band, 'kid-headband', false);
  part(rig.hips, place(new BoxGeometry(0.05, 0.05, 0.03), -0.09, hl(0.52), 0.04, [0, 0.4, 0]), matte('leatherDark'), 'kid-pouch', false);
  // a Deku Stick held in the right hand like a staff (butt near the ground)
  const handY = -p.forearm - 0.02;
  const stick = merge([place(new CylinderGeometry(0.011, 0.014, 0.95, 7), 0, handY - 0.02, 0.03), place(new CylinderGeometry(0.017, 0.011, 0.05, 7), 0, handY + 0.44, 0.03)]);
  part(rig.elbowR, place(stick, 0, 0, 0, [0.1, 0, 0.05]), matte('stick'), 'deku-stick');
}

export function createKokiri(variant: number): Character {
  beginTally();
  const rig = buildRig(KOKIRI_CHILD_PROPORTIONS, `kokiri-${variant}`);
  const p = rig.props;
  const girl = variant !== 2;
  const skin = kidMat(`skin-${variant}`, KID.skin[variant % 3]);
  const boot = kidMat('boot', girl ? KID.boot : CHAR_COLORS.kidBoot);
  // boots to just under the knee; the girls' fold-over cuff is the boot's own leather (one mesh per ankle)
  buildLegs(rig, { skin, boot, cuff: girl ? boot : null, shaftTop: p.kneeY - p.ankleY - 0.03 });
  buildNeck(rig, skin);
  if (girl) {
    const v = variant % 2;
    const tunic = kidMat(`tunic-${v}`, KID.tunic[v]);
    buildArms(rig, { skin, sleeve: tunic });
    buildGirlTunic(rig, tunic);
    buildGirlFace(rig, skin, KID.iris[v]);
    buildGirlHair(rig, kidMat(`hair-${v}`, KID.hair[v]));
    buildGirlCap(rig, kidMat(`cap-${v}`, KID.cap[v]));
  } else buildBoy(rig, variant, skin);
  rig.root.userData.character = 'kokiri';
  return { kind: 'kokiri', rig, group: rig.root, triangles: endTally(), height: girl ? 1.16 : 1.1 };
}
