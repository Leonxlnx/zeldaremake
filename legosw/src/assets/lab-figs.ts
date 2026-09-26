import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3, type Object3D, type Texture } from 'three';
import { mat } from '../core/palette';
import { ANAKIN_HAIR, OBIWAN_HAIR } from './hair';
import { ANAKIN_SPEC, OBIWAN_SPEC, minifig, type Minifig } from './minifig';
import type { FaceState, Mouth } from './prints';

export function anakin(): Minifig {
  return minifig(ANAKIN_SPEC(ANAKIN_HAIR));
}
export function obiwan(): Minifig {
  return minifig(OBIWAN_SPEC(OBIWAN_HAIR));
}

function standing(f: Minifig): Object3D {
  const g = new Group();
  f.group.position.y = 1.25;
  f.pose({ armL: 0.15, armR: 0.35, splayL: 0.05, splayR: 0.05, headYaw: 0.15 });
  g.add(f.group);
  return g;
}

/** Just the head (with its hair), framed tight: for close looks at the sculpt and the print. */
function headOnly(f: Minifig, face?: Partial<FaceState>): Object3D {
  if (face) f.setFace({ mouth: 'smirk', brows: 0, lookX: 0, lookY: 0, blink: 0, squint: 0, ...face });
  const g = new Group();
  f.head.removeFromParent();
  f.head.position.set(0, 0, 0);
  f.head.rotation.set(0, 0, 0);
  g.add(f.head);
  g.userData.frame = { center: [0, 0.74, 0], radius: 0.95 };
  return g;
}

/** The head turned 0 / 90 / 180 / 270° in a row, so one frontal still shows every side lit. */
function turnaround(make: () => Minifig, face: Partial<FaceState>): Object3D {
  const g = new Group();
  for (let i = 0; i < 4; i++) {
    const f = make();
    f.setFace({ mouth: 'smirk', brows: 0, lookX: 0, lookY: 0, blink: 0, squint: 0, ...face });
    f.head.removeFromParent();
    f.head.position.set((i - 1.5) * 1.75, 0, 0);
    f.head.rotation.set(0, (i * Math.PI) / 2 + 0.35, 0);
    g.add(f.head);
  }
  g.userData.frame = { center: [0, 0.72, 0], radius: 2.1 };
  return g;
}

const MOUTHS: Mouth[] = ['smile', 'smirk', 'grin', 'talk', 'open', 'o', 'grit', 'shout', 'frown', 'flat', 'worry', 'yell'];
/** brow / squint that the film pairs with each mouth */
const MOOD: Record<Mouth, Partial<FaceState>> = {
  smile: { brows: 0.1 },
  smirk: { brows: -0.3, squint: 0.1 },
  grin: { brows: -0.4 },
  talk: { brows: 0.3 },
  open: { brows: 0.5 },
  o: { brows: 0.9 },
  grit: { brows: -0.9, squint: 0.25 },
  shout: { brows: 0.9 },
  frown: { brows: 0.85 },
  flat: { brows: 0 },
  worry: { brows: 1 },
  yell: { brows: 0.8, squint: 0.18 },
};

/** Every mouth shape at close range: two rows of heads. */
function mouthSheet(make: () => Minifig): Object3D {
  const g = new Group();
  MOUTHS.forEach((m, i) => {
    const f = make();
    f.setFace({ mouth: m, brows: 0, lookX: 0, lookY: 0, blink: 0, squint: 0, ...MOOD[m] });
    f.head.removeFromParent();
    f.head.position.set(((i % 5) - 2) * 1.8, i < 5 ? 1.75 : 0, 0);
    g.add(f.head);
  });
  g.userData.frame = { center: [0, 1.45, 0], radius: 4.2 };
  return g;
}

/** Eye states in a row: open, half blink, nearly shut, shut, squint, looking aside. */
function eyeSheet(make: () => Minifig): Object3D {
  const g = new Group();
  const states: Partial<FaceState>[] = [{}, { blink: 0.45 }, { blink: 0.75 }, { blink: 1 }, { squint: 0.4, brows: -0.6 }, { lookX: 0.03, lookY: 0.01 }];
  states.forEach((s, i) => {
    const f = make();
    f.setFace({ mouth: 'smile', brows: 0, lookX: 0, lookY: 0, blink: 0, squint: 0, ...s });
    f.head.removeFromParent();
    f.head.position.set((i - 2.5) * 1.45, 0, 0);
    g.add(f.head);
  });
  g.userData.frame = { center: [0, 0.62, 0], radius: 3.0 };
  return g;
}

/** A standing figure framed on its torso print. */
function torsoView(f: Minifig): Object3D {
  const g = standing(f);
  f.pose({ armL: 0.1, armR: 0.1, splayL: 0.12, splayR: 0.12 });
  g.userData.frame = { center: [0, 2.2, 0], radius: 1.9 };
  return g;
}

/** Both figures side by side; `backs` turns them round (into the lab's key light) to show the back prints. */
function pair(backs = false): Object3D {
  const g = new Group();
  const a = anakin(), o = obiwan();
  a.setFace({ mouth: 'smirk', brows: -0.3, lookX: 0.02, lookY: 0, blink: 0, squint: 0.1 });
  o.setFace({ mouth: 'smile', brows: 0.1, lookX: -0.02, lookY: 0, blink: 0, squint: 0 });
  for (const [f, x, yaw] of [[a, -1.5, 0.25], [o, 1.5, -0.25]] as const) {
    f.group.position.set(backs ? -x : x, 1.25, 0);
    f.group.rotation.y = backs ? Math.PI + 0.3 : yaw;
    f.pose({ armL: 0.15, armR: 0.3, splayL: 0.06, splayR: 0.06 });
    g.add(f.group);
  }
  g.userData.frame = { center: [0, 2.1, 0], radius: 4.8 };
  return g;
}

/** Hands gripping a 0.13-radius bar (a lightsaber hilt's size): checks the C's fit and heft. */
function handGrip(): Object3D {
  const f = anakin();
  f.setFace({ mouth: 'grit', brows: -0.8, lookX: 0, lookY: 0, blink: 0, squint: 0.2 });
  const g = standing(f);
  f.pose({ armL: 0.95, armR: 0.95, splayL: 0.02, splayR: 0.02, wristL: 0.2, wristR: -0.2 });
  for (const grip of [f.gripL, f.gripR]) {
    const bar = new Mesh(new CylinderGeometry(0.13, 0.13, 0.8, 24), mat('lbg', { plain: true }));
    bar.rotation.z = Math.PI / 2;
    grip.add(bar);
  }
  g.updateMatrixWorld(true);
  const p = f.gripR.getWorldPosition(new Vector3()).lerp(f.gripL.getWorldPosition(new Vector3()), 0.5);
  g.userData.frame = { center: [p.x, p.y, p.z], radius: 1.1 };
  return g;
}

/** The flat print artwork, unlit: torso front / back and leg for each figure. */
function printSheet(): Object3D {
  const g = new Group();
  const maps = (f: Minifig): [Texture, number, number][] => {
    const out: [Texture, number, number][] = [];
    f.group.traverse((o) => {
      const m = (o as Mesh).material as { map?: Texture | null } | undefined;
      if (!(o as Mesh).isMesh || !m?.map || o.parent === f.head) return;
      const img = m.map.image as HTMLCanvasElement;
      if (!out.some(([t]) => t === m.map)) out.push([m.map, img.width, img.height]);
    });
    return out;
  };
  [anakin(), obiwan()].forEach((f, row) => {
    maps(f).forEach(([map, w, h], i) => {
      const s = 1.8 / Math.max(w, h);
      const p = new Mesh(new PlaneGeometry(w * s, h * s), new MeshBasicMaterial({ map, toneMapped: false }));
      p.position.set((i - 1) * 2.1, (0.5 - row) * 2.1, 0);
      g.add(p);
    });
  });
  g.userData.frame = { center: [0, 0, 0], radius: 3.1 };
  return g;
}

/** Lab entries for the minifigures. */
export const LAB_FIGS: Record<string, () => Object3D> = {
  'print-sheet': printSheet,
  'torso-anakin': () => torsoView(anakin()),
  'torso-obiwan': () => torsoView(obiwan()),
  'figs-pair': () => pair(),
  'figs-backs': () => pair(true),
  'legs-pair': () => {
    const g = pair();
    g.userData.frame = { center: [0, 0.55, 0], radius: 1.9 };
    return g;
  },
  'hand-grip': handGrip,
  anakin: () => {
    const f = anakin();
    f.setFace({ mouth: 'smirk', brows: -0.3, lookX: 0.02, lookY: 0, blink: 0, squint: 0.1 });
    return standing(f);
  },
  obiwan: () => {
    const f = obiwan();
    f.setFace({ mouth: 'grin', brows: 0.2, lookX: -0.02, lookY: 0, blink: 0, squint: 0 });
    return standing(f);
  },
  'faces-anakin': () => {
    const g = new Group();
    const mouths: Mouth[] = ['smirk', 'grit', 'open', 'frown'];
    mouths.forEach((m, i) => {
      const f = anakin();
      f.setFace({ mouth: m, brows: [-0.3, -1, 0.3, 0.8][i], lookX: 0, lookY: 0, blink: 0, squint: [0.1, 0.3, 0, 0][i] });
      f.group.position.set((i - 1.5) * 2.6, 1.25, 0);
      f.pose({ armL: 0.2, armR: 0.2 });
      g.add(f.group);
    });
    return g;
  },
  'faces-obiwan': () => {
    const g = new Group();
    const mouths: Mouth[] = ['smile', 'frown', 'shout', 'talk'];
    mouths.forEach((m, i) => {
      const f = obiwan();
      f.setFace({ mouth: m, brows: [0, 0.9, -0.6, 0.3][i], lookX: 0, lookY: 0, blink: 0, squint: 0 });
      f.group.position.set((i - 1.5) * 2.6, 1.25, 0);
      f.pose({ armL: 0.2, armR: 0.2 });
      g.add(f.group);
    });
    return g;
  },
  'anakin-head': () => {
    const f = anakin();
    f.setFace({ mouth: 'smirk', brows: -0.3, lookX: 0.0, lookY: 0, blink: 0, squint: 0.1 });
    const g = standing(f);
    g.userData.frame = { center: [0, 3.75, 0], radius: 1.1 };
    return g;
  },
  'obiwan-head': () => {
    const f = obiwan();
    f.setFace({ mouth: 'frown', brows: 0.8, lookX: 0.0, lookY: 0, blink: 0, squint: 0 });
    const g = standing(f);
    g.userData.frame = { center: [0, 3.75, 0], radius: 1.1 };
    return g;
  },
  'anakin-seated': () => {
    const f = anakin();
    f.seated();
    f.setFace({ mouth: 'grit', brows: -0.8, lookX: 0, lookY: 0, blink: 0, squint: 0.2 });
    const g = new Group();
    g.add(f.group);
    return g;
  },
  'hair-anakin': () => headOnly(anakin(), { mouth: 'smirk', brows: -0.3, squint: 0.1 }),
  'hair-obiwan': () => headOnly(obiwan(), { mouth: 'smile', brows: 0.1 }),
  'turn-anakin': () => turnaround(anakin, { mouth: 'smirk', brows: -0.3, squint: 0.1 }),
  'turn-obiwan': () => turnaround(obiwan, { mouth: 'smile', brows: 0.1 }),
  'mouths-anakin': () => mouthSheet(anakin),
  'mouths-obiwan': () => mouthSheet(obiwan),
  'eyes-anakin': () => eyeSheet(anakin),
};
// one close-up head per mouth: face-anakin-smirk, face-obiwan-shout, …
for (const m of MOUTHS) {
  LAB_FIGS[`face-anakin-${m}`] = () => headOnly(anakin(), { mouth: m, ...MOOD[m] });
  LAB_FIGS[`face-obiwan-${m}`] = () => headOnly(obiwan(), { mouth: m, ...MOOD[m] });
}
