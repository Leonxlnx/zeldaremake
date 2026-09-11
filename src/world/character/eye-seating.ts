/** A fixed convex eye surface over Link's unchanged skull, sampled under the moving lids. */
import { DynamicDrawUsage, Matrix3, Matrix4, Mesh, Vector3, type BufferGeometry } from 'three';
import { LINK_EYE_SURFACE_SEGMENTS, LINK_EYE_WHITE_VERTICES, LINK_EYE_LID_INTERVALS, LINK_EYE_LID_STATIONS, LINK_EYE_VISIBLE_JOIN, createLinkUpperLashPath } from './eye-aperture';
import { createLinkEyeCap } from './eye-cap';
import type { Rig } from './rig';
import { updateLinkEyeSurfaceUV } from './eye-surface';

export const LINK_IRIS_SURFACE_OFFSET = .0006;
export const LINK_PUPIL_SURFACE_OFFSET = .001;

interface ProjectedTriangle {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
  normals: readonly [Vector3, Vector3, Vector3];
  determinant: number;
}

interface EyeSkullField {
  (x: number, y: number): number;
  normal(x: number, y: number, target: Vector3): Vector3;
}

/** Exact piecewise-linear front surface, accelerated in the eye's local XY plane. */
export function createEyeSkullField(skull: BufferGeometry, headToEye: Matrix4, k: number): EyeSkullField {
  const limitX = .043 * k, limitY = .034 * k, divisions = 12;
  const bins = Array.from({ length: divisions * divisions }, () => [] as ProjectedTriangle[]);
  const p = skull.attributes.position, index = skull.index;
  if (!index) throw new Error('Link eye seating requires indexed skull geometry');
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const normalMatrix = new Matrix3().getNormalMatrix(headToEye);
  const cell = (value: number, limit: number) => Math.max(0, Math.min(divisions - 1,
    Math.floor((value / limit + 1) * .5 * divisions)));
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i)).applyMatrix4(headToEye);
    b.fromBufferAttribute(p, index.getX(i + 1)).applyMatrix4(headToEye);
    c.fromBufferAttribute(p, index.getX(i + 2)).applyMatrix4(headToEye);
    const determinant = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    // Positive projected area is an outward front face along the eye's normal.
    if (determinant < 1e-14) continue;
    const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x);
    const minY = Math.min(a.y, b.y, c.y), maxY = Math.max(a.y, b.y, c.y);
    if (maxX < -limitX || minX > limitX || maxY < -limitY || minY > limitY) continue;
    const normals = [0, 1, 2].map(j => new Vector3()
      .fromBufferAttribute(skull.attributes.normal, index.getX(i + j)).applyMatrix3(normalMatrix).normalize()) as
      [Vector3, Vector3, Vector3];
    const triangle = { ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z,
      cx: c.x, cy: c.y, cz: c.z, normals, determinant };
    for (let y = cell(minY, limitY); y <= cell(maxY, limitY); y++)
      for (let x = cell(minX, limitX); x <= cell(maxX, limitX); x++) bins[y * divisions + x].push(triangle);
  }
  const sample = (x: number, y: number, normal?: Vector3): number => {
    if (Math.abs(x) > limitX || Math.abs(y) > limitY) throw new Error('Link eye field queried outside its fitted patch');
    let depth = -Infinity;
    for (const t of bins[cell(y, limitY) * divisions + cell(x, limitX)]) {
      const a = ((t.by - t.cy) * (x - t.cx) + (t.cx - t.bx) * (y - t.cy)) / t.determinant;
      const b = ((t.cy - t.ay) * (x - t.cx) + (t.ax - t.cx) * (y - t.cy)) / t.determinant;
      const c = 1 - a - b;
      if (a >= -1e-9 && b >= -1e-9 && c >= -1e-9) {
        const candidate = a * t.az + b * t.bz + c * t.cz;
        if (candidate > depth) {
          depth = candidate;
          normal?.copy(t.normals[0]).multiplyScalar(a).addScaledVector(t.normals[1], b)
            .addScaledVector(t.normals[2], c).normalize();
        }
      }
    }
    if (!Number.isFinite(depth)) throw new Error('Link eye surface has no skull backing');
    return depth;
  };
  return Object.assign((x: number, y: number) => sample(x, y), {
    normal(x: number, y: number, target: Vector3): Vector3 { sample(x, y, target); return target; },
  });
}

type EyePart = 'eye-white' | 'eyelid' | 'lashes';
interface Binding {
  name: EyePart;
  geometry: BufferGeometry;
  rest: Float32Array;
}

/**
 * Keep the existing eye groups, white aperture and blink timing. Only Link calls this.
 * White UVs track physical pigment coordinates while the parent closes the aperture.
 * Eye meshes are intentionally excluded from static batching, so these bindings remain live.
 * The updater runs after posing, alongside the existing boot geometry synchronization.
 */
export function createLinkEyeSeating(rig: Rig): () => void {
  const skull = rig.head.getObjectByName('skull');
  if (!(skull instanceof Mesh)) throw new Error('Link eye seating requires its actual skull');
  const k = rig.props.headRadius / .125;
  const lashPlane = createLinkUpperLashPath(k)[0].z;
  const updates = rig.eyes.map(eye => {
    eye.updateMatrix();
    const headToEye = eye.matrix.clone().invert();
    const skin = createEyeSkullField(skull.geometry, headToEye, k);
    const cap = createLinkEyeCap(skull.geometry, headToEye, k, skin);
    const normal = new Vector3();
    const names: EyePart[] = ['eye-white', 'eyelid', 'lashes'];
    const bindings: Binding[] = names.map(name => {
      const mesh = eye.getObjectByName(name);
      if (!(mesh instanceof Mesh)) throw new Error(`Link eye is missing ${name}`);
      const geometry = mesh.geometry, position = geometry.attributes.position;
      const rest = new Float32Array(position.array);
      if (name === 'eye-white' && position.count !== LINK_EYE_WHITE_VERTICES)
        throw new Error('Link white aperture topology changed');
      if (name === 'eyelid' && position.count !== (LINK_EYE_LID_INTERVALS + 1) * LINK_EYE_SURFACE_SEGMENTS)
        throw new Error('Link eyelid topology changed');
      position.setUsage(DynamicDrawUsage); geometry.attributes.normal.setUsage(DynamicDrawUsage);
      return { name, geometry, rest };
    });
    const white = bindings[0].geometry.attributes.position;
    const lidRest = bindings[1].rest;
    const outerSkin = Array.from({ length: LINK_EYE_SURFACE_SEGMENTS }, (_, j) => {
      const i = (LINK_EYE_LID_INTERVALS * LINK_EYE_SURFACE_SEGMENTS + j) * 3;
      const x = lidRest[i], y = lidRest[i + 1];
      return { residual: lidRest[i + 2] - skin(x, y), normal: skin.normal(x, y, new Vector3()) };
    });
    const fixedSkinNormals = Array.from({ length: lidRest.length / 3 }, (_, i) =>
      LINK_EYE_LID_STATIONS[Math.floor(i / LINK_EYE_SURFACE_SEGMENTS)] >= LINK_EYE_VISIBLE_JOIN
        ? skin.normal(lidRest[i * 3], lidRest[i * 3 + 1], new Vector3()) : null);
    // Zero first and second endpoint derivatives separate the visible seam from burial.
    const ease = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
    let previous = NaN;
    return () => {
      const blinkScale = eye.scale.y;
      if (blinkScale === previous) return;
      if (!Number.isFinite(blinkScale) || blinkScale < .079 || blinkScale > 1.001)
        throw new Error('Link eye seating received an unsupported blink scale');
      previous = blinkScale;
      for (const binding of bindings) {
        const position = binding.geometry.attributes.position, rest = binding.rest;
        for (let i = 0; i < position.count; i++) {
          const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
          let localY = y, depth: number;
          if (binding.name === 'eyelid') {
            const u = LINK_EYE_LID_STATIONS[Math.floor(i / LINK_EYE_SURFACE_SEGMENTS)];
            const visible = Math.min(1, u / LINK_EYE_VISIBLE_JOIN);
            const actualY = y * (blinkScale + (1 - blinkScale) * ease(visible));
            localY = actualY / blinkScale;
            if (u === 1) depth = z; // The outer seam keeps the exact original skull fit.
            else if (u === 0) {
              const shared = white.count - LINK_EYE_SURFACE_SEGMENTS + i;
              position.setXYZ(i, white.getX(shared), white.getY(shared), white.getZ(shared));
              continue;
            } else {
              const roll = y > 0 ? .0009 : .00045;
              const shared = white.count - LINK_EYE_SURFACE_SEGMENTS + i % LINK_EYE_SURFACE_SEGMENTS;
              const innerX = white.getX(shared), innerY = white.getY(shared) * blinkScale;
              const innerOffset = cap.height(innerX, innerY) - skin(innerX, innerY);
              // The visible profile first meets skin with zero residual slope.
              // Its separate hidden return then reaches the original buried anchor.
              const residual = u <= LINK_EYE_VISIBLE_JOIN
                ? (1 - ease(visible)) * innerOffset
                  + k * roll * 64 * visible ** 3 * (1 - visible) ** 3
                : ease((u - LINK_EYE_VISIBLE_JOIN) / (1 - LINK_EYE_VISIBLE_JOIN))
                  * outerSkin[i % LINK_EYE_SURFACE_SEGMENTS].residual;
              depth = skin(x, actualY) + residual;
            }
          } else if (binding.name === 'lashes') {
            // A partly seated tube follows the actual upper margin, not a separate plane.
            depth = cap.height(x, y * blinkScale) + z - lashPlane;
          } else {
            depth = cap.height(x, y * blinkScale);
          }
          position.setXYZ(i, x, localY, depth);
        }
        if (binding.name === 'eye-white')
          updateLinkEyeSurfaceUV(binding.geometry, k, Math.sign(eye.position.x) as 1 | -1, blinkScale);
        position.needsUpdate = true;
        if (binding.name === 'eye-white') {
          const normals = binding.geometry.attributes.normal;
          for (let i = 0; i < position.count; i++) {
            cap.normal(position.getX(i), position.getY(i) * blinkScale, blinkScale, normal);
            normals.setXYZ(i, normal.x, normal.y, normal.z);
          }
          normals.needsUpdate = true;
        } else {
          binding.geometry.computeVertexNormals();
          if (binding.name === 'eyelid') {
            const normals = binding.geometry.attributes.normal;
            for (let i = 0; i < fixedSkinNormals.length; i++) {
              const fitted = fixedSkinNormals[i];
              if (!fitted) continue;
              // The parent normal matrix divides Y by blinkScale. Store its
              // inverse here so the final shading normal meets the actual skull.
              normal.copy(fitted); normal.y *= blinkScale; normal.normalize();
              normals.setXYZ(i, normal.x, normal.y, normal.z);
            }
            normals.needsUpdate = true;
          }
        }
        binding.geometry.computeBoundingBox(); binding.geometry.computeBoundingSphere();
      }
    };
  });
  const update = () => { for (const sync of updates) sync(); };
  update();
  return update;
}
