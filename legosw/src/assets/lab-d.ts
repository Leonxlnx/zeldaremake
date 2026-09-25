import { Color, DirectionalLight, Group, HemisphereLight, PointLight, Vector3, type Object3D } from 'three';
import { munificent } from './munificent';
import { invisibleHand } from './invisibleHand';
import { hangarInterior } from './hangar';

/** Lab entries for the Separatist capital ships and the hangar (owner: asset agent D). */

function stats(name: string, g: Object3D): void {
  let meshes = 0;
  g.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh && o.visible) meshes++;
  });
  const parts = (g.userData.parts as Record<string, number> | undefined) ?? {};
  const pl = Object.entries(parts).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}k`).join(', ');
  console.error(`[lab-d] ${name}: ${(((g.userData.triangles as number) ?? 0) / 1000).toFixed(1)}k built tris, ${meshes} meshes | ${pl}`);
}

/** Wrap a model so the lab frames a sub-region (centre in model units, radius R). */
function focus(obj: Object3D, center: [number, number, number], R: number): Group {
  const g = new Group();
  g.name = `${obj.name}-focus`;
  g.add(obj);
  g.userData.frame = { center, radius: R };
  const anim = obj.userData.animate as ((t: number) => void) | undefined;
  if (anim) g.userData.animate = anim;
  return g;
}

function frigate(lod: 0 | 1 | 2, seed = 1): Object3D {
  const m = munificent({ lod, seed });
  stats(`munificent lod${lod}`, m.group);
  return m.group;
}

function hand(lod: 0 | 1): Object3D {
  const h = invisibleHand({ lod });
  stats(`invisible-hand lod${lod}`, h.group);
  return h.group;
}

function handMouth(R: number, dx: number): Object3D {
  const h = invisibleHand({ lod: 0 });
  stats('invisible-hand lod0', h.group);
  const p = h.anchors.hangar.position;
  return focus(h.group, [p.x + dx, p.y, p.z], R);
}

/**
 * Hangar preview lit like the film's interior (film/world.ts: four point lights, key light dimmed
 * to 1.2 and coming from overhead). Lab-only: the lights live in this wrapper.
 */
function hangarLab(center: [number, number, number] | null, R: number, shield = 1): Object3D {
  const h = hangarInterior();
  h.setShield(shield);
  stats('hangar', h.group);
  const g = center ? focus(h.group, center, R) : (() => {
    const w = new Group();
    w.add(h.group);
    return w;
  })();
  const pt = (c: number, i: number, x: number, y: number, z: number, d = 160) => {
    const p = new PointLight(c, i, d, 1.6);
    p.position.set(x, y, z);
    p.layers.enableAll();
    g.add(p);
  };
  pt(0xfff0d8, 900, -40, 34, -20);
  pt(0xfff0d8, 900, 40, 34, -20);
  pt(0x5aa8ff, 700, 0, 18, 58, 140);
  pt(0xff6a3a, 260, -80, 10, -40, 90);
  const anim = h.group.userData.animate as ((t: number) => void) | undefined;
  const sunDir = new Vector3(0.2, 1, 0.3).normalize();
  g.userData.animate = (t: number) => {
    anim?.(t);
    let root: Object3D = g;
    while (root.parent) root = root.parent;
    root.traverse((o) => {
      const l = o as DirectionalLight;
      if (l.isDirectionalLight) {
        l.intensity = 1.2;
        l.color.set(0xffe2c0);
        l.position.copy(l.target.position).addScaledVector(sunDir, R * 4);
      }
      const hm = o as HemisphereLight;
      if (hm.isHemisphereLight) {
        hm.intensity = 0.35;
        hm.color = new Color(0x6d6258);
        hm.groundColor = new Color(0x2a2622);
      }
    });
  };
  return g;
}

export const LAB_D: Record<string, () => Object3D> = {
  munificent: () => frigate(0),
  'munificent-lod1': () => frigate(1),
  'munificent-lod2': () => frigate(2),
  // frigate close-ups (world units = studs × 8)
  'mun-bridge': () => focus(frigate(0), [0, 176, 704], 320),
  'mun-aft': () => focus(frigate(0), [0, 48, -800], 480),
  'mun-bow': () => focus(frigate(0), [0, 40, 1000], 300),
  'mun-mid': () => focus(frigate(0), [0, 0, -240], 380),
  'invisible-hand': () => hand(0),
  'invisible-hand-lod1': () => hand(1),
  'ih-mouth': () => handMouth(70, 10),
  'ih-mouth-wide': () => handMouth(260, 40),
  hangar: () => hangarLab([0, 12, 0], 70),
  // centre / radius chosen so view "214,-4" puts the camera where the film's landing shot stands
  'hangar-mouth': () => hangarLab([-8, 8, 30], 28),
  'hangar-open': () => hangarLab([-8, 8, 30], 28, 0),
  // view "-3,6.5" = the film's wide reverse on the droid line
  'hangar-back': () => hangarLab([0, 2.4, -10], 12.1, 0),
};
