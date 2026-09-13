/**
 * Deku-nut pod lanterns: an elongated glowing pod (~0.32 m) with a darker cap and a short
 * stem, hanging from a cord. Body + cap + stem + cord are one geometry / one draw call; the
 * emissive gradient texture makes the bottom glow hottest and leaves caps and cords dark.
 * Each lantern hangs from a pivot at its hook so `update()` can swing it gently.
 *
 * Round 21: the pod is a fruit in a woven LEAF HUSK, as reference B's three pods over the door
 * read at 2× (a lit yellow-orange body under a green calyx whose sepals hang down its sides) and
 * as the distant huts' pods were already built (distantHouse.ts): five dark sepal fins curl from
 * under the cap's brim down to a third of the body, standing 1.5 cm off it and flaring out at
 * their tips, and a calyx collar sits where the stem meets the cap. The fins ride in the same
 * geometry on the gradient's dark rows (no glow), so the pod is still one draw. The lit body,
 * the cap, the cord, the pod centre and the swing draws are unchanged.
 */
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Mesh, Object3D, Vector2, Vector3 } from 'three';
import type { Rng } from '../util/prng';
import { clamp, lerp } from '../util/noise';
import { TAU, faceTowards, gridSurface, merge, setColorAttribute } from './geometry';
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

/** the lit body's radius at height y (scale 1), for the sepals to ride on */
function bodyRadius(y: number): number {
  for (let i = 0; i + 1 < BODY_PROFILE.length; i++) {
    const [r0, y0] = BODY_PROFILE[i];
    const [r1, y1] = BODY_PROFILE[i + 1];
    if (y <= y1) return lerp(r0, r1, clamp((y - y0) / (y1 - y0), 0, 1));
  }
  return BODY_PROFILE[BODY_PROFILE.length - 1][0];
}

/** number of sepal fins round a pod's husk */
export const SEPALS = 5;

/**
 * The husk (round 21): `SEPALS` sepal fins from under the cap's brim (y 0.29) down to 0.08–0.12 of
 * the body, 1.5 cm off it, tapering to a point and curling outward toward the tip; a calyx collar
 * round the stem's foot. Own rng (forked from the pod's hook, so no draw of the pods' stream moves).
 */
function husk(scale: number, rng: Rng, tint: number): BufferGeometry[] {
  const parts: BufferGeometry[] = [];
  // (dark: the fins sit in the pods' own point light, so a mid tint rendered pale grey-green)
  const sepal: [number, number, number] = [0.12 * tint, 0.18 * tint, 0.06 * tint];
  const phase = rng() * TAU;
  for (let f = 0; f < SEPALS; f++) {
    const phi0 = phase + (f / SEPALS) * TAU + (rng() - 0.5) * 0.3;
    const yTop = 0.29;
    const yTip = 0.08 + rng() * 0.04;
    const width = 0.1 * (0.85 + rng() * 0.25);
    const curl = 0.02 + rng() * 0.02;
    const fin = gridSurface(
      (u, v, out) => {
        const y = lerp(yTop, yTip, u);
        // off the body, flaring out toward the tip (the sepal's tip curls away from the fruit)
        const r = bodyRadius(y) + 0.015 + curl * u * u;
        const w = width * Math.pow(1 - u, 0.7);
        const phi = phi0 + ((v - 0.5) * w) / Math.max(r, 0.02);
        out.position.set(Math.cos(phi) * r * scale, y * scale, Math.sin(phi) * r * scale);
        out.uv = [v, 0.95];
        // a darker mid-rib, lighter edges
        const k = 0.8 + 0.4 * Math.abs(v - 0.5) * 2;
        out.color = [sepal[0] * k, sepal[1] * k, sepal[2] * k];
      },
      { cols: 3, rows: 7 },
    );
    faceTowards(fin, (p, o) => o.set(p.x * 4, p.y, p.z * 4));
    parts.push(fin);
  }
  // calyx collar at the stem's foot
  const collar = new CylinderGeometry(0.03 * scale, 0.055 * scale, 0.035 * scale, 10);
  collar.translate(0, 0.415 * scale, 0);
  setV(collar, 0.95);
  setColorAttribute(collar, [0.11 * tint, 0.16 * tint, 0.06 * tint]);
  parts.push(collar);
  return parts;
}

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

  // round 21: the leaf husk — sepals and calyx collar, forked from the hook so the pods' stream
  // (cap tint, swing phase / amplitude / speed) keeps its draws
  const huskParts = husk(scale, rng.fork(`husk/${hook.x.toFixed(3)}/${hook.y.toFixed(3)}/${hook.z.toFixed(3)}`), capTint);
  const geo = merge([body, cap, stem, cord, knot, ...huskParts]);
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
