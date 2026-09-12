/** Original curved eye discs, clipped to Link's existing almond-shaped eyelid opening. */
import { BufferGeometry, Float32BufferAttribute } from 'three';

import { LINK_EYE_OPENING as opening } from './eye-aperture';

// Clip the iris and pupil against the same polygon used by white and lid.
const planes = opening.map(([x, y], i) => {
  const next = opening[(i + 1) % opening.length];
  const nx = next[1] - y, ny = x - next[0];
  return { nx, ny, distance: nx * x + ny * y };
});

/**
 * `scale` is the existing eye scale (headRadius / .125); radius and depth are unscaled metres.
 * The inward-shifted circle follows the white's radial bulge, with `depth` above its surface.
 */
export function createLinkEyeDisc(scale: number, side: 1 | -1, radius: number, depth: number): BufferGeometry {
  if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(radius) || radius <= 0
    || !Number.isFinite(depth) || depth < 0 || (side !== 1 && side !== -1)) {
    throw new RangeError('Link eye disc requires positive scale/radius, nonnegative depth and side ±1');
  }
  const cx = -side * 0.0025, cy = -0.0005;
  const sectors = 64, rings = 6;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const vertex = (x: number, y: number): void => {
    // The maximum half-plane ratio is distance / boundary distance along the ray from (0,0).
    let u = 0;
    for (const p of planes) u = Math.max(u, (p.nx * x + p.ny * y) / p.distance);
    positions.push(x * scale, y * scale, (0.003 * (1 - u * u) + depth) * scale);
    uvs.push(0.5 + (x - cx) / (2 * radius), 0.5 + (y - cy) / (2 * radius));
  };
  const boundary = Array.from({ length: sectors }, (_, i) => {
    const angle = i / sectors * Math.PI * 2, dx = Math.cos(angle), dy = Math.sin(angle);
    let extent = radius;
    for (const p of planes) {
      const direction = p.nx * dx + p.ny * dy;
      if (direction > 0) extent = Math.min(extent, (p.distance - p.nx * cx - p.ny * cy) / direction);
    }
    return [dx * extent, dy * extent];
  });
  vertex(cx, cy);
  for (let ring = 1; ring <= rings; ring++) for (let j = 0; j < sectors; j++) {
    const [x, y] = boundary[j], u = ring / rings;
    vertex(cx + u * x, cy + u * y);
    const q = 1 + (ring - 1) * sectors + j, next = 1 + (ring - 1) * sectors + (j + 1) % sectors;
    if (ring === 1) indices.push(0, q, next);
    else {
      const previous = q - sectors, previousNext = next - sectors;
      indices.push(previous, q, previousNext, q, next, previousNext);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.name = 'original-link-clipped-eye-disc';
  return geometry;
}
