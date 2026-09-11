/**
 * Seed-pod lanterns: an elongated glowing pod (~0.32 m) wrapped by overlapping green sepals,
 * with plant ribs and tied fibre cords. Every part shares one geometry / one draw call;
 * the existing emissive gradient lights the body while leaves and bindings use its dark row.
 * Each lantern hangs from a pivot at its hook so `update()` can swing it gently.
 */
import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, Float32BufferAttribute, LatheGeometry, Mesh, Object3D, TubeGeometry, Vector2, Vector3 } from 'three';
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
// A small calyx seals the pod beneath the leaf roots, without the old broad acorn rim.
const CALYX_PROFILE: [number, number][] = [
  [0.088, 0.305],
  [0.087, 0.318],
  [0.070, 0.350],
  [0.037, 0.387],
  [0.018, 0.411],
  [0, 0.414],
];
const DARK_V = 0.95;

function remapV(geo: BufferGeometry, v0: number, v1: number) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + (v1 - v0) * uv.getY(i));
}

function setV(geo: BufferGeometry, v: number) {
  const uv = geo.attributes.uv as Float32BufferAttribute;
  // A varying U still selects coarse mips on thin/grazing fibres. Those mips
  // average the glowing body into this dark row, so pin both coordinates.
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, v);
}

function bodyRadius(y: number): number {
  for (let i = 1; i < BODY_PROFILE.length; i++) {
    const [r0, y0] = BODY_PROFILE[i - 1], [r1, y1] = BODY_PROFILE[i];
    if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0));
  }
  return BODY_PROFILE[BODY_PROFILE.length - 1][0];
}

/** Closed tube for original rope fibres and plant veins; both caps reuse the exact end rings. */
function darkTube(points: Vector3[], radius: number, tint: [number, number, number], segments: number, radial = 5): BufferGeometry {
  const curve = new CatmullRomCurve3(points);
  const geo = new TubeGeometry(curve, segments, radius, radial, false);
  const positions = Array.from(geo.attributes.position.array);
  const uvs = Array.from(geo.attributes.uv.array);
  const indices = Array.from(geo.index!.array);
  const a = new Vector3(), b = new Vector3();
  for (const end of [0, 1]) {
    const centre = curve.getPointAt(end);
    const target = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1);
    const ring = end ? segments * (radial + 1) : 0;
    const index = positions.length / 3;
    positions.push(centre.x, centre.y, centre.z); uvs.push(0.5, DARK_V);
    a.fromArray(positions, ring * 3).sub(centre);
    b.fromArray(positions, (ring + 1) * 3).sub(centre);
    const forward = a.cross(b).dot(target) > 0;
    for (let j = 0; j < radial; j++) {
      indices.push(...(forward ? [index, ring + j, ring + j + 1] : [index, ring + j + 1, ring + j]));
    }
  }
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.deleteAttribute('normal'); geo.computeVertexNormals();
  setV(geo, DARK_V); setColorAttribute(geo, tint);
  return geo;
}

/** A cupped sepal surface in unscaled pod coordinates. Six leaves form two overlapping whorls. */
function sepalPoint(t: number, u: number, angle: number, length: number, outer: boolean, offset = 0): Vector3 {
  const bend = Math.sin(Math.PI * t);
  const halfAngle = 0.09 * (1 - t) + 0.65 * Math.pow(bend, 0.9) + 0.003 * t;
  const theta = angle + 0.025 * bend + u * halfAngle;
  const y = 0.406 - length * t - 0.009 * bend + 0.006 * u * u * bend;
  let radius = 0.023 + 0.136 * Math.sin(Math.PI * t / 2) + 0.003 * (1 - u * u) * bend;
  if (y <= 0.315) radius = Math.max(radius, bodyRadius(y) + 0.007);
  radius += (outer ? 0.008 * bend : 0) + offset;
  return new Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
}

/** A solid leaf blade: front, darker back and closed perimeter, all on non-emissive UVs. */
function sepal(angle: number, length: number, outer: boolean, tint: number, scale: number): BufferGeometry {
  const rows = 12, cols = 8, layerSize = (rows + 1) * (cols + 1);
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  for (const layer of [1, -1]) for (let i = 0; i <= rows; i++) for (let j = 0; j <= cols; j++) {
    const t = i / rows, u = j / cols * 2 - 1;
    const p = sepalPoint(t, u, angle, length, outer, layer * 0.0015).multiplyScalar(scale);
    positions.push(p.x, p.y, p.z); uvs.push(0.5, DARK_V);
    const rib = Math.exp(-u * u / 0.018) * Math.sin(Math.PI * t);
    const shade = tint * (layer > 0 ? 1 : 0.76) * (0.94 + 0.06 * Math.sin(Math.PI * t));
    colors.push((0.23 + 0.025 * rib) * shade, (0.32 + 0.04 * rib) * shade, (0.095 + 0.01 * rib) * shade);
  }
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = layer * layerSize + i * (cols + 1) + j, b = a + 1, c = a + cols + 1, d = c + 1;
    indices.push(...(layer === 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
  }
  for (let i = 0; i < rows; i++) for (const edge of [0, cols]) {
    const a = i * (cols + 1) + edge, b = a + cols + 1, c = a + layerSize, d = b + layerSize;
    indices.push(...(edge === 0 ? [a, b, c, b, d, c] : [a, c, b, b, c, d]));
  }
  for (const end of [0, rows]) for (let j = 0; j < cols; j++) {
    const a = end * (cols + 1) + j, b = a + 1, c = a + layerSize, d = b + layerSize;
    indices.push(...(end === 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
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
    CALYX_PROFILE.map(([x, y]) => new Vector2(x * scale, y * scale)),
    28,
  );
  setV(cap, DARK_V);
  const capTint = 0.85 + rng() * 0.3;
  // Preserve the original four RNG calls and their order. Shape variation reuses the swing phase.
  const phase = rng() * Math.PI * 2;
  const amp = 0.035 + rng() * 0.03;
  const speed = 1.1 + rng() * 0.5;
  setColorAttribute(cap, [0.22 * capTint, 0.29 * capTint, 0.09 * capTint]);

  const detail: BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = phase + i / 6 * Math.PI * 2;
    const length = 0.206 + 0.007 * Math.sin(phase + i * 2.1);
    const outer = i % 2 === 0;
    detail.push(sepal(angle, length, outer, capTint * (0.96 + 0.05 * Math.sin(phase + i)), scale));
    const veinPoint = (t: number, u: number, offset: number) => sepalPoint(t, u, angle, length, outer, 0.0015 + offset).multiplyScalar(scale);
    const midrib = Array.from({ length: 13 }, (_, j) => veinPoint(0.06 + j / 12 * 0.90, 0, 0.001));
    detail.push(darkTube(midrib, 0.0015 * scale, [0.28 * capTint, 0.36 * capTint, 0.10 * capTint], 18));
    for (const t of [0.28, 0.48, 0.67]) for (const side of [-1, 1]) {
      detail.push(darkTube([veinPoint(t, 0, 0.0005), veinPoint(t + 0.05, side * 0.42, 0.0005),
        veinPoint(t + 0.11, side * 0.82, 0.0005)], 0.0008 * scale,
      [0.26 * capTint, 0.33 * capTint, 0.085 * capTint], 6, 4));
    }
    // Fine supporting ribs follow the amber shell and disappear beneath the sepals.
    const rib = Array.from({ length: 18 }, (_, j) => {
      const y = 0.008 + j / 17 * 0.307, r = bodyRadius(y) + 0.0025;
      const a = angle + 0.035 * Math.sin(Math.PI * j / 17);
      return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(scale);
    });
    detail.push(darkTube(rib, 0.0017 * scale, [0.33, 0.205, 0.065], 24));
  }

  const stemH = 0.07 * scale;
  const stem = new CylinderGeometry(0.014 * scale, 0.02 * scale, stemH, 8);
  stem.translate(0, 0.41 * scale + stemH / 2, 0);
  setV(stem, DARK_V);
  setColorAttribute(stem, [0.22, 0.17, 0.1]);

  const podTop = 0.41 * scale + stemH;
  const cord = new CylinderGeometry(0.011, 0.011, cordLength, 6);
  cord.translate(0, podTop + cordLength / 2, 0);
  setV(cord, DARK_V);
  setColorAttribute(cord, [0.2, 0.14, 0.08]);

  // Two subtle fibres retain the original cord centre and length; cap long-cord detail.
  const turns = Math.min(14, Math.max(2, Math.ceil(cordLength / 0.055)));
  for (let strand = 0; strand < 2; strand++) {
    const points = Array.from({ length: turns * 8 + 1 }, (_, j) => {
      const t = j / (turns * 8), a = phase + strand * Math.PI + t * turns * Math.PI * 2;
      return new Vector3(Math.cos(a) * 0.010, podTop + t * cordLength, Math.sin(a) * 0.010);
    });
    detail.push(darkTube(points, 0.0027, strand ? [0.24, 0.17, 0.085] : [0.29, 0.21, 0.11], turns * 8, 4));
  }
  const binding = (y0: number, y1: number, radius: number, thickness: number, tint: [number, number, number]) => {
    const points = Array.from({ length: 49 }, (_, j) => {
      const t = j / 48, a = phase + t * Math.PI * 6;
      return new Vector3(Math.cos(a) * radius, y0 + (y1 - y0) * t, Math.sin(a) * radius);
    });
    detail.push(darkTube(points, thickness, tint, 60, 6));
  };
  binding(0.404 * scale, 0.463 * scale, 0.022 * scale, 0.0045 * scale, [0.28, 0.20, 0.095]);
  binding(podTop + cordLength - 0.041, podTop + cordLength - 0.003, 0.017, 0.006, [0.27, 0.19, 0.09]);
  detail.push(darkTube([new Vector3(0.023, 0.454, 0.006), new Vector3(0.033, 0.429, 0.015),
    new Vector3(0.028, 0.405, 0.029)].map(v => v.multiplyScalar(scale)), 0.0035 * scale, [0.26, 0.18, 0.085], 12));

  const geo = merge([body, cap, stem, cord, ...detail]);
  // shift so the hook (top of cord) is at the origin of the pivot
  geo.translate(0, -(podTop + cordLength), 0);
  const mesh = new Mesh(geo, kind === 'lime' ? mats.lanternLime : mats.lantern);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'pod-lantern';

  const pivot = new Object3D();
  pivot.position.copy(hook);
  pivot.add(mesh);
  const pod = hook.clone().add(new Vector3(0, -(cordLength + 0.2 * scale), 0));
  return {
    pivot,
    pod,
    phase,
    amp,
    speed,
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
