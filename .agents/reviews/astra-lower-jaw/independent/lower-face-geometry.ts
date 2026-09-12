import type { BufferGeometry } from 'three';

/** Narrow the lower jaw without changing the fitted orbits, scalp or head height. */
export function shapeLinkLowerFace(geometry: BufferGeometry, k: number): BufferGeometry {
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    if (y >= -.030 * k) continue;
    const u = Math.min(1, (-y / k - .030) / .080);
    const smooth = u * u * u * (10 + u * (-15 + 6 * u));
    const scale = 1 - .18 * smooth;
    const derivative = u < 1 ? .18 * 30 * u * u * (1 - u) ** 2 / (.080 * k) : 0;
    const nx = normal.getX(i), ny = normal.getY(i), nz = normal.getZ(i);
    // F=(scale(y)*x,y,z). Transport normals with the inverse transpose of dF.
    const tx = nx / scale, ty = ny - x * derivative * tx;
    const length = Math.hypot(tx, ty, nz);
    position.setX(i, x * scale);
    normal.setXYZ(i, tx / length, ty / length, nz / length);
  }
  return geometry;
}
