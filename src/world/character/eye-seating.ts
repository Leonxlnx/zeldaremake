/** A shared shallow eye surface over Link's unchanged skull, including blink seating. */
import { DynamicDrawUsage, Matrix4, Mesh, Vector3, type BufferGeometry } from 'three';
import { LINK_EYE_OPENING, LINK_EYE_SEGMENTS, createLinkUpperLashPath } from './eye-aperture';
import type { Rig } from './rig';
import { updateLinkEyeSurfaceUV } from './eye-surface';

export const LINK_IRIS_SURFACE_OFFSET = .0006;
export const LINK_PUPIL_SURFACE_OFFSET = .001;

interface ProjectedTriangle {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  cx: number; cy: number; cz: number;
  determinant: number;
}

/** Exact piecewise-linear front surface, accelerated in the eye's local XY plane. */
export function createEyeSkullField(skull: BufferGeometry, headToEye: Matrix4, k: number): (x: number, y: number) => number {
  const limitX = .043 * k, limitY = .034 * k, divisions = 12;
  const bins = Array.from({ length: divisions * divisions }, () => [] as ProjectedTriangle[]);
  const p = skull.attributes.position, index = skull.index;
  if (!index) throw new Error('Link eye seating requires indexed skull geometry');
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
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
    const triangle = { ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z,
      cx: c.x, cy: c.y, cz: c.z, determinant };
    for (let y = cell(minY, limitY); y <= cell(maxY, limitY); y++)
      for (let x = cell(minX, limitX); x <= cell(maxX, limitX); x++) bins[y * divisions + x].push(triangle);
  }
  return (x, y) => {
    if (Math.abs(x) > limitX || Math.abs(y) > limitY) throw new Error('Link eye field queried outside its fitted patch');
    let depth = -Infinity;
    for (const t of bins[cell(y, limitY) * divisions + cell(x, limitX)]) {
      const a = ((t.by - t.cy) * (x - t.cx) + (t.cx - t.bx) * (y - t.cy)) / t.determinant;
      const b = ((t.cy - t.ay) * (x - t.cx) + (t.ax - t.cx) * (y - t.cy)) / t.determinant;
      const c = 1 - a - b;
      if (a >= -1e-9 && b >= -1e-9 && c >= -1e-9) depth = Math.max(depth, a * t.az + b * t.bz + c * t.cz);
    }
    if (!Number.isFinite(depth)) throw new Error('Link eye surface has no skull backing');
    return depth;
  };
}

type EyePart = 'eye-white' | 'eyelid' | 'lashes';
interface Binding {
  name: EyePart;
  geometry: BufferGeometry;
  rest: Float32Array;
  radial: Float64Array;
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
  const planes = LINK_EYE_OPENING.map(([x, y], i) => {
    const next = LINK_EYE_OPENING[(i + 1) % LINK_EYE_SEGMENTS], nx = next[1] - y, ny = x - next[0];
    return { nx, ny, distance: (nx * x + ny * y) * k };
  });
  const radial = (x: number, y: number) => {
    let u = 0;
    for (const p of planes) u = Math.max(u, (p.nx * x + p.ny * y) / p.distance);
    return u;
  };
  const lashPlane = createLinkUpperLashPath(k)[0].z;
  const updates = rig.eyes.map(eye => {
    eye.updateMatrix();
    const skin = createEyeSkullField(skull.geometry, eye.matrix.clone().invert(), k);
    const names: EyePart[] = ['eye-white', 'eyelid', 'lashes'];
    const bindings: Binding[] = names.map(name => {
      const mesh = eye.getObjectByName(name);
      if (!(mesh instanceof Mesh)) throw new Error(`Link eye is missing ${name}`);
      const geometry = mesh.geometry, position = geometry.attributes.position;
      const rest = new Float32Array(position.array), radii = new Float64Array(position.count);
      for (let i = 0; i < position.count; i++) radii[i] = radial(position.getX(i), position.getY(i));
      if (name === 'eye-white') {
        if (position.count !== 1 + 4 * LINK_EYE_SEGMENTS) throw new Error('Link white aperture topology changed');
        // These vertices are the same boundary used by the skin rim, without a Z gap.
        for (let i = position.count - LINK_EYE_SEGMENTS; i < position.count; i++) radii[i] = 1;
      }
      if (name === 'eyelid' && position.count !== 5 * LINK_EYE_SEGMENTS)
        throw new Error('Link eyelid topology changed');
      position.setUsage(DynamicDrawUsage); geometry.attributes.normal.setUsage(DynamicDrawUsage);
      return { name, geometry, rest, radial: radii };
    });
    const whiteHeight = (x: number, y: number, u: number) => skin(x, y) + k * (.0006 + .0008 * (1 - u * u));
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
            const u = Math.floor(i / LINK_EYE_SEGMENTS) / 4;
            const actualY = y * (blinkScale + (1 - blinkScale) * u);
            localY = actualY / blinkScale;
            if (u === 1) depth = z; // The outer seam keeps the exact original skull fit.
            else if (u === 0) depth = whiteHeight(x, actualY, 1);
            else {
              const roll = y > 0 ? .0009 : .00045;
              depth = skin(x, actualY) + k * (.0006 * (1 - u) - .0004 * u + roll * Math.sin(Math.PI * u));
            }
          } else if (binding.name === 'lashes') {
            // A partly seated tube follows the actual upper margin, not a separate plane.
            depth = skin(x, y * blinkScale) + .0006 * k + z - lashPlane;
          } else {
            depth = whiteHeight(x, y * blinkScale, binding.radial[i]);
          }
          position.setXYZ(i, x, localY, depth);
        }
        if (binding.name === 'eye-white')
          updateLinkEyeSurfaceUV(binding.geometry, k, Math.sign(eye.position.x) as 1 | -1, blinkScale);
        position.needsUpdate = true;
        binding.geometry.computeVertexNormals();
        binding.geometry.computeBoundingBox(); binding.geometry.computeBoundingSphere();
      }
    };
  });
  const update = () => { for (const sync of updates) sync(); };
  update();
  return update;
}
