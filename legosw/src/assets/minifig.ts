import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { Builder } from '../core/builder';
import { cylinder, mergeMD, prism, sweep, transformMD, type MeshData, type V3 } from '../core/geom';
import { mat, plasticRoughnessTexture, swatch, type ColorKey } from '../core/palette';
import { hairMesh, type HairSpec } from './hair';
import { FaceTexture, HEAD_H, legTexture, torsoTexture, type FaceState, type FaceStyle, type TorsoStyle } from './prints';

/**
 * LEGO minifigure. Origin = hip joint (legs rotate about local X there); standing soles at
 * y = −1.25; torso 0.32–1.84; head 1.9–2.98 (+ stud); faces +Z; +X is the figure's left.
 * Shoulder pivots at (±0.8, 1.54, 0). Printed parts (face, torso front, legs) use canvas textures.
 */

export interface MinifigSpec {
  name: string;
  torso: ColorKey;
  arms: ColorKey;
  handL: ColorKey;
  handR: ColorKey;
  hips: ColorKey;
  legs: ColorKey;
  torsoPrint: TorsoStyle;
  legPrint: { base: string; boot: string | null; line: string; top?: number };
  face: FaceStyle;
  hair: HairSpec;
}

export interface MinifigPose {
  /** leg swing (rad, + = forward) */
  legL?: number;
  legR?: number;
  /** arm swing about the shoulder axis (rad, + = forward/up) */
  armL?: number;
  armR?: number;
  /** arm splay outward (rad) */
  splayL?: number;
  splayR?: number;
  /** wrist roll (rad) */
  wristL?: number;
  wristR?: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  torsoYaw?: number;
}

export interface Minifig {
  group: Group;
  hips: Object3D;
  torso: Object3D;
  head: Object3D;
  armL: Object3D;
  armR: Object3D;
  handL: Object3D;
  handR: Object3D;
  legL: Object3D;
  legR: Object3D;
  /** grip points in each hand: X = bar axis through the C */
  gripL: Object3D;
  gripR: Object3D;
  face: FaceTexture;
  setFace(s: FaceState): void;
  pose(p: MinifigPose): void;
  /** convenience: seated pilot pose (legs forward, hands on the yokes) */
  seated(): void;
}

const printedCache = new Map<Texture, Material>();
function printedMat(map: Texture): Material {
  let m = printedCache.get(map);
  if (!m) {
    m = new MeshPhysicalMaterial({ map, roughness: 0.5, roughnessMap: plasticRoughnessTexture(), metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.14 });
    printedCache.set(map, m);
  }
  return m;
}

/** MeshData → BufferGeometry with a planar UV projection (u from x, v from y). */
function planarGeometry(md: MeshData, x0: number, x1: number, y0: number, y1: number): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(md.pos, 3));
  g.setAttribute('normal', new BufferAttribute(md.nrm, 3));
  const n = md.pos.length / 3;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = (md.pos[i * 3] - x0) / (x1 - x0);
    uv[i * 2 + 1] = (md.pos[i * 3 + 1] - y0) / (y1 - y0);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** Head: lathe with a cylindrical UV (u = 0.5 faces +Z) carrying the face print. */
function headGeometry(): BufferGeometry {
  const r = 0.6, h = HEAD_H, rc = 0.13;
  // profile (r, y) from the neck up; the straight side maps v = y / h
  const prof: [number, number][] = [[0.3, -0.04], [0.3, 0.0], [r - rc, 0.0]];
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    prof.push([r - rc + Math.sin(a) * rc, rc - Math.cos(a) * rc]);
  }
  prof.push([r, h - rc]);
  for (let i = 1; i <= 5; i++) {
    const a = (i / 5) * (Math.PI / 2);
    prof.push([r - rc + Math.cos(a) * rc, h - rc + Math.sin(a) * rc]);
  }
  prof.push([0.34, h], [0.3, h + 0.02], [0.3, h + 0.2], [0.26, h + 0.22], [0.0, h + 0.22]);
  const N = 72;
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  // per-vertex normals from the profile tangents
  const pn: [number, number][] = prof.map((p, i) => {
    const a = prof[Math.max(0, i - 1)], b = prof[Math.min(prof.length - 1, i + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l];
  });
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2 - Math.PI;
    const s = Math.sin(th), c = Math.cos(th);
    for (let j = 0; j < prof.length; j++) {
      const [pr, py] = prof[j];
      pos.push(pr * s, py, pr * c);
      nrm.push(pn[j][0] * s, pn[j][1], pn[j][0] * c);
      uv.push(i / N, Math.max(0.002, Math.min(0.998, py / h)));
    }
  }
  const M = prof.length;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j, b = (i + 1) * M + j, c = (i + 1) * M + j + 1, d = i * M + j + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Arm path (left arm; right arm is mirrored) relative to the shoulder pivot. */
const ARM_PATH: V3[] = [
  [0.13, 0.2, 0.0],
  [0.2, 0.1, 0.0],
  [0.24, -0.1, 0.0],
  [0.26, -0.36, 0.0],
  [0.26, -0.56, 0.07],
  [0.25, -0.7, 0.2],
  [0.24, -0.8, 0.33],
];
const WRIST = new Vector3(0.24, -0.84, 0.39);

function armMD(): MeshData {
  return sweep(
    ARM_PATH,
    (u) => {
      const cap = u < 0.12 ? Math.sqrt(Math.max(0.05, 1 - Math.pow(1 - u / 0.12, 2))) : 1;
      return (0.235 - 0.055 * u) * cap;
    },
    18,
  );
}

/** C-shaped hand in a canonical frame: forearm along +Z, the bar through the C along X. */
function handMD(): MeshData {
  const pts: V3[] = [];
  const R = 0.19, arc = Math.PI * 1.42;
  const start = -arc / 2;
  for (let i = 0; i <= 28; i++) {
    const a = start + (i / 28) * arc;
    // circle in the YZ plane centred at z = 0.3; the arc wraps the wrist side, the gap faces +Z
    pts.push([0, Math.sin(a) * R, 0.3 - Math.cos(a) * R]);
  }
  const ring = sweep(pts, (u) => 0.085 * Math.min(1, Math.sqrt(Math.min(u, 1 - u) / 0.04 + 0.2)), 14);
  const wrist = cylinder(0.1, 0.16, 0.02, 14);
  const b = new Builder();
  b.add('white', ring);
  b.add('white', wrist, new Matrix4().makeTranslation(0, 0, 0.06).multiply(new Matrix4().makeRotationX(Math.PI / 2)));
  const built = b.build('tmp');
  const mesh = built.group.children[0] as Mesh;
  const g = mesh.geometry;
  return { pos: g.getAttribute('position').array as Float32Array, nrm: g.getAttribute('normal').array as Float32Array };
}

function meshFrom(key: ColorKey, md: MeshData, plain = true): Mesh {
  const b = new Builder({ tint: 0 });
  b.add(key, md);
  const built = b.build('p');
  const m = built.group.children[0] as Mesh;
  if (plain) m.material = mat(key);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function minifig(spec: MinifigSpec): Minifig {
  const group = new Group();
  group.name = `minifig-${spec.name}`;
  const hips = new Object3D();
  hips.name = 'hips';
  group.add(hips);

  // hips block
  const hb = new Builder({ seed: 11 });
  hb.box(spec.hips, 0, 0.16, 0, 1.95, 0.32, 0.9, { c: 0.04 });
  hb.box(spec.hips, 0, -0.1, 0.12, 0.3, 0.3, 0.6, { c: 0.04 });
  hips.add(hb.build('hips').group);

  // legs: shin block with rounded top + foot, printed from the front (boots)
  const legTex = legTexture(spec.legPrint.base, spec.legPrint.boot, spec.legPrint.line, spec.legPrint.top ?? 0.55);
  const mkLeg = (side: 1 | -1) => {
    const pivot = new Object3D();
    pivot.position.set(side * 0.49, 0, 0);
    const legProf: number[][] = [[-0.45, -0.8], [0.45, -0.8], [0.45, 0.02]];
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      legProf.push([Math.cos(a) * 0.45, 0.02 + Math.sin(a) * 0.2]);
    }
    legProf.push([-0.45, 0.02]);
    // profile is in (z, y); prism extrudes along its local Z = our X
    const shin = prism(legProf.map(([z, y]) => [z, y]), 0.93, 0.035);
    const foot = prism(
      [
        [-0.45, -1.25],
        [0.64, -1.25],
        [0.64, -1.04],
        [0.5, -0.8],
        [-0.45, -0.8],
      ],
      0.93,
      0.035,
    );
    // rotY(−90°): profile x (depth) → world +Z (toe forward), extrusion → world X
    const md = transformMD(mergeMD([shin, foot]), new Matrix4().makeRotationY(-Math.PI / 2));
    const geo = planarGeometry(md, -0.47, 0.47, -1.25, 0.22);
    const m = new Mesh(geo, printedMat(legTex));
    m.castShadow = true;
    m.receiveShadow = true;
    pivot.add(m);
    hips.add(pivot);
    return pivot;
  };
  const legL = mkLeg(1);
  const legR = mkLeg(-1);

  // torso
  const torso = new Object3D();
  torso.name = 'torso';
  torso.position.set(0, 0.32, 0);
  hips.add(torso);
  const tb = new Builder({ seed: 12 });
  const tpoly = [
    [-0.975, 0],
    [0.975, 0],
    [0.75, 1.52],
    [-0.75, 1.52],
  ];
  tb.prism(spec.torso, tpoly, 0.95, { c: 0.04 });
  tb.cyl(spec.torso === 'black' ? 'black' : spec.torso, 0, 1.58, 0, 0.27, 0.14, { radial: 20 });
  torso.add(tb.build('torso').group);
  // printed front + back decals (planar mapped over the full trapezoid box)
  const front = new BufferGeometry();
  {
    const inset = 0.036;
    const pts = [
      [-0.975 + inset * 1.2, inset],
      [0.975 - inset * 1.2, inset],
      [0.75 - inset * 1.2, 1.52 - inset],
      [-0.75 + inset * 1.2, 1.52 - inset],
    ];
    const pos = new Float32Array([...pts[0], 0, ...pts[1], 0, ...pts[2], 0, ...pts[0], 0, ...pts[2], 0, ...pts[3], 0]);
    for (let i = 0; i < 6; i++) pos[i * 3 + 2] = 0.477;
    front.setAttribute('position', new BufferAttribute(pos, 3));
    const nrm = new Float32Array(18);
    for (let i = 0; i < 6; i++) nrm[i * 3 + 2] = 1;
    front.setAttribute('normal', new BufferAttribute(nrm, 3));
    const uv = new Float32Array(12);
    for (let i = 0; i < 6; i++) {
      uv[i * 2] = (pos[i * 3] + 0.975) / 1.95;
      uv[i * 2 + 1] = pos[i * 3 + 1] / 1.52;
    }
    front.setAttribute('uv', new BufferAttribute(uv, 2));
  }
  const frontMesh = new Mesh(front, printedMat(torsoTexture(spec.torsoPrint)));
  frontMesh.receiveShadow = true;
  torso.add(frontMesh);
  const back = front.clone();
  back.rotateY(Math.PI);
  const backMesh = new Mesh(back, printedMat(torsoTexture(spec.torsoPrint, true)));
  backMesh.receiveShadow = true;
  torso.add(backMesh);

  // arms + hands
  const aMD = armMD();
  const hMD = handMD();
  const forearm = new Vector3(0.24 - 0.25, -0.8 + 0.7, 0.33 - 0.2).normalize();
  const mkArm = (side: 1 | -1, key: ColorKey, handKey: ColorKey) => {
    const pivot = new Object3D();
    pivot.name = side > 0 ? 'armL' : 'armR';
    pivot.position.set(side * 0.8, 1.22, 0);
    torso.add(pivot);
    const m = meshFrom(key, aMD);
    if (side < 0) {
      m.scale.x = -1;
    }
    pivot.add(m);
    const wrist = new Object3D();
    wrist.position.set(WRIST.x * side, WRIST.y, WRIST.z);
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(forearm.x * side, forearm.y, forearm.z));
    wrist.quaternion.copy(q);
    pivot.add(wrist);
    const hand = new Object3D();
    hand.name = side > 0 ? 'handL' : 'handR';
    wrist.add(hand);
    const hm = meshFrom(handKey, hMD);
    hand.add(hm);
    const grip = new Object3D();
    grip.position.set(0, 0, 0.3);
    hand.add(grip);
    return { pivot, hand, grip };
  };
  const L = mkArm(1, spec.arms, spec.handL);
  const R = mkArm(-1, spec.arms, spec.handR);

  // head + hair
  const head = new Object3D();
  head.name = 'head';
  head.position.set(0, 1.58, 0);
  torso.add(head);
  const face = new FaceTexture(spec.face);
  const headMat = new MeshPhysicalMaterial({ map: face.texture, roughness: 0.5, roughnessMap: plasticRoughnessTexture(), metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.12 });
  const headMesh = new Mesh(headGeometry(), headMat);
  headMesh.position.y = 0.0;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  head.add(headMesh);
  head.add(hairMesh(spec.hair));
  void swatch;

  const fig: Minifig = {
    group,
    hips,
    torso,
    head,
    armL: L.pivot,
    armR: R.pivot,
    handL: L.hand,
    handR: R.hand,
    legL,
    legR,
    gripL: L.grip,
    gripR: R.grip,
    face,
    setFace: (s) => face.set(s),
    pose(p) {
      legL.rotation.x = -(p.legL ?? 0);
      legR.rotation.x = -(p.legR ?? 0);
      L.pivot.rotation.set(-(p.armL ?? 0), 0, p.splayL ?? 0);
      R.pivot.rotation.set(-(p.armR ?? 0), 0, -(p.splayR ?? 0));
      L.hand.rotation.z = p.wristL ?? 0;
      R.hand.rotation.z = p.wristR ?? 0;
      head.rotation.set(p.headPitch ?? 0, p.headYaw ?? 0, p.headRoll ?? 0, 'YXZ');
      torso.rotation.y = p.torsoYaw ?? 0;
    },
    seated() {
      fig.pose({ legL: Math.PI / 2, legR: Math.PI / 2, armL: 0.95, armR: 0.95, splayL: 0.08, splayR: 0.08 });
    },
  };
  return fig;
}

/* ---------------------------------------------------------------- the cast */

export const ANAKIN_SPEC = (hair: HairSpec): MinifigSpec => ({
  name: 'anakin',
  torso: 'reddishBrown',
  arms: 'reddishBrown',
  handL: 'lightNougat',
  handR: 'black',
  hips: 'reddishBrown',
  legs: 'reddishBrown',
  torsoPrint: { base: '#5c2b14', robe: '#4a2210', robeDark: '#2c1409', inner: '#1f1a17', belt: '#1a1512', buckle: '#9fa2a6', skin: '#f6d7b3', line: '#140d09', tabard: '#1e1916' },
  legPrint: { base: '#5c2b14', boot: '#15110e', line: '#0c0907', top: 0.45 },
  face: { skin: '#f6d7b3', brow: '#4b2412', line: '#a8745a', scar: true, cheekLines: true },
  hair,
});

export const OBIWAN_SPEC = (hair: HairSpec): MinifigSpec => ({
  name: 'obiwan',
  torso: 'tan',
  arms: 'tan',
  handL: 'lightNougat',
  handR: 'lightNougat',
  hips: 'tan',
  legs: 'tan',
  torsoPrint: { base: '#e0c796', robe: '#cdb07a', robeDark: '#9c8358', inner: '#f0e2c2', belt: '#5c2b14', buckle: '#a9abae', skin: '#f6d7b3', line: '#3a2a18' },
  legPrint: { base: '#e0c796', boot: '#5c2b14', line: '#2b1a0e', top: 0.5 },
  face: { skin: '#f6d7b3', brow: '#6e3814', line: '#b07c62', beard: { color: '#8e4a1c', dark: '#5c2c0e', light: '#b8733a' }, cheekLines: false },
  hair,
});
