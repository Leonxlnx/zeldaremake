/** Original running stitches on the finished short sleeve, in shoulder-local metres. */
import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { merge, sweep } from './geometry';

/** The sleeve is rigid in its shoulder frame; its thread shares that exact frame. */
export function createLinkSleeveStitches(sleeve: BufferGeometry): BufferGeometry {
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const surface = new Mesh(sleeve, material), ray = new Raycaster();
  const radial = new Vector3(), parts: BufferGeometry[] = [];
  // Above the turned lip, with enough fabric on either side of the sewn line.
  const seamY = -.091;
  const point = (angle: number, lift = 0): Vector3 => {
    radial.set(Math.sin(angle), 0, Math.cos(angle));
    ray.set(radial.clone().multiplyScalar(.2).setY(seamY), radial.clone().negate());
    const hit = ray.intersectObject(surface, false)[0];
    if (!hit) throw new Error('Sleeve stitch must meet the finished outer fabric');
    return hit.point.clone().addScaledVector(radial, lift);
  };
  try {
    const samples = Array.from({ length: 65 }, (_, i) => point(i / 64 * Math.PI * 2));
    const length = samples.slice(1).reduce((sum, p, i) => sum + p.distanceTo(samples[i]), 0);
    const count = Math.ceil(length / .0072);
    for (let i = 0; i < count; i++) {
      // Buried ends and a shallow middle let thread pass through the real cloth.
      const path = [.18, .30, .50, .70, .82].map((f, j) => point((i + f) / count * Math.PI * 2,
        j === 0 || j === 4 ? -.00012 : .00030));
      parts.push(sweep(path, [.00025, .00025], {
        segments: 4, radial: 4, closeStart: true, closeTip: true,
      }));
    }
    const geometry = merge(parts);
    geometry.name = 'original-link-sleeve-hem-running-stitches';
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  } finally { material.dispose(); }
}
