/**
 * Deku-nut pod lanterns: an elongated glowing pod (~0.32 m) with a darker cap and a short
 * stem, hanging from a cord. Body + cap + stem + cord are one geometry / one draw call; the
 * emissive gradient texture makes the bottom glow hottest and leaves caps and cords dark.
 * Each lantern hangs from a pivot at its hook so `update()` can swing it gently.
 */
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Mesh, Object3D, Vector2, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { merge, setColorAttribute } from './geometry';
import { LANTERN_DARK_V, type StructureMaterials } from './materials';

export interface LanternRig {
  /** placed at the hook; rotate this to swing the lantern */
  pivot: Object3D;
  /** world-space position of the glowing pod centre (for point lights / audit) */
  pod: Vector3;
  phase: number;
  amp: number;
  speed: number;
}

const BODY_PROFILE: [number, number][] = [
  [0.012, 0.0],
  [0.055, 0.025],
  [0.1, 0.075],
  [0.135, 0.14],
  [0.148, 0.2],
  [0.14, 0.255],
  [0.115, 0.295],
  [0.08, 0.315],
];
const CAP_PROFILE: [number, number][] = [
  [0.085, 0.3],
  [0.15, 0.285],
  [0.16, 0.315],
  [0.14, 0.35],
  [0.095, 0.385],
  [0.04, 0.405],
  [0.0, 0.41],
];

function remapV(geo: BufferGeometry, v0: number, v1: number) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + (v1 - v0) * uv.getY(i));
}

function setV(geo: BufferGeometry, v: number) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v);
}

export type LanternKind = 'orange' | 'lime';

/** Build one lantern hanging `cordLength` metres below a hook point (world space). */
export function buildLantern(hook: Vector3, cordLength: number, mats: StructureMaterials, rng: Rng, scale = 1, kind: LanternKind = 'orange'): LanternRig {
  const body = new LatheGeometry(
    BODY_PROFILE.map(([x, y]) => new Vector2(x * scale, y * scale)),
    28,
  );
  // LatheGeometry v runs 0→1 from the first profile point (bottom) to the last (top)
  remapV(body, 0.0, LANTERN_DARK_V - 0.06);
  // dark diffuse so sunlight does not wash the emissive gradient to cream
  setColorAttribute(body, kind === 'lime' ? [0.4, 0.52, 0.12] : [0.5, 0.34, 0.12]);

  const cap = new LatheGeometry(
    CAP_PROFILE.map(([x, y]) => new Vector2(x * scale, y * scale)),
    28,
  );
  setV(cap, 0.95);
  const capTint = 0.85 + rng() * 0.3;
  setColorAttribute(cap, [0.28 * capTint, 0.33 * capTint, 0.16 * capTint]);

  const stemH = 0.07 * scale;
  const stem = new CylinderGeometry(0.014 * scale, 0.02 * scale, stemH, 8);
  stem.translate(0, 0.41 * scale + stemH / 2, 0);
  setV(stem, 0.95);
  setColorAttribute(stem, [0.22, 0.17, 0.1]);

  const podTop = 0.41 * scale + stemH;
  const cord = new CylinderGeometry(0.011, 0.011, cordLength, 6);
  cord.translate(0, podTop + cordLength / 2, 0);
  setV(cord, 0.95);
  setColorAttribute(cord, [0.2, 0.14, 0.08]);

  // small hook knot at the top of the cord
  const knot = new CylinderGeometry(0.03, 0.03, 0.05, 8);
  knot.translate(0, podTop + cordLength - 0.02, 0);
  setV(knot, 0.95);
  setColorAttribute(knot, [0.16, 0.11, 0.07]);

  const geo = merge([body, cap, stem, cord, knot]);
  // shift so the hook (top of cord) is at the origin of the pivot
  geo.translate(0, -(podTop + cordLength), 0);
  const mesh = new Mesh(geo, kind === 'lime' ? mats.lanternLime : mats.lantern);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.name = 'pod-lantern';

  const pivot = new Object3D();
  pivot.position.copy(hook);
  pivot.add(mesh);
  const pod = hook.clone().add(new Vector3(0, -(cordLength + 0.2 * scale), 0));
  return {
    pivot,
    pod,
    phase: rng() * Math.PI * 2,
    amp: 0.035 + rng() * 0.03,
    speed: 1.1 + rng() * 0.5,
  };
}

/** Deterministic gentle swing from simulation time. */
export function swingLanterns(rigs: LanternRig[], t: number, windDirX: number, windDirZ: number): void {
  for (const r of rigs) {
    const s = Math.sin(t * r.speed + r.phase);
    const s2 = Math.sin(t * r.speed * 0.63 + r.phase * 1.7);
    // swing mostly along the wind direction, a little across it
    const along = r.amp * s;
    const across = r.amp * 0.45 * s2;
    r.pivot.rotation.set(along * windDirZ + across * windDirX, 0, -along * windDirX + across * windDirZ);
  }
}
