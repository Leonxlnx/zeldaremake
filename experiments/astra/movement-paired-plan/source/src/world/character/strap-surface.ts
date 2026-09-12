/** Physical leather coordinates and fitted stitching for Link's original brown band. */
import { BufferGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, Vector3 } from 'three';
import { merge, sweep } from './geometry';
import { createLinkLeatherMaterial, LINK_LEATHER_TILE_METRES } from './leather-material';

export function finishLinkLeatherStrap(geometry: BufferGeometry, base: MeshStandardMaterial): {
  material: MeshStandardMaterial; stitches: BufferGeometry;
} {
  const p = geometry.attributes.position, uv = geometry.attributes.uv;
  if (p.count !== 650 || !uv) throw new Error('Leather finish requires the fitted65-row Link band');
  const point = (row: number, col: number, layer = 0) => new Vector3().fromBufferAttribute(p, row * 10 + layer * 5 + col);
  const length = [0];
  for (let row = 1; row <= 64; row++) length.push(length[row - 1] + point(row, 2).distanceTo(point(row - 1, 2)));
  // Both faces follow measured centreline travel, with measured across-band distance.
  // The four millimetre return uses the existing edge vertices; no geometry changes.
  for (let row = 0; row <= 64; row++) for (let layer = 0; layer < 2; layer++) {
    let width = 0;
    for (let col = 0; col < 5; col++) {
      if (col) width += point(row, col, layer).distanceTo(point(row, col - 1, layer));
      uv.setXY(row * 10 + layer * 5 + col, width / LINK_LEATHER_TILE_METRES, length[row] / LINK_LEATHER_TILE_METRES);
    }
  }
  uv.needsUpdate = true;
  const leather = base.clone();
  leather.color.set(0x715137);
  const material = createLinkLeatherMaterial(leather, [LINK_LEATHER_TILE_METRES, LINK_LEATHER_TILE_METRES]);
  material.name = 'link-fitted-strap-leather';
  leather.dispose();

  const fittingMaterial = new MeshBasicMaterial(), fittingMesh = new Mesh(geometry, fittingMaterial);
  fittingMesh.updateMatrixWorld(true);
  const ray = new Raycaster();
  const surfacePoint = (distance: number, across: number): Vector3 => {
    let row = 0;
    while (row < 63 && length[row + 1] < distance) row++;
    const fraction = (distance - length[row]) / (length[row + 1] - length[row]);
    const col = Math.floor(across), u = across - col;
    const sample = (r: number, layer: number) => point(r, col, layer).lerp(point(r, col + 1, layer), u);
    const front = sample(row, 0).lerp(sample(row + 1, 0), fraction);
    const back = sample(row, 1).lerp(sample(row + 1, 1), fraction);
    // Refit onto the actual triangle; bilinear row interpolation can pass below
    // the creased shoulder where the band is not a planar quad.
    const normal = front.clone().sub(back).normalize();
    ray.set(front.clone().addScaledVector(normal, .02), normal.clone().negate());
    const hit = ray.intersectObject(fittingMesh, false)[0];
    if (!hit) throw new Error('Strap stitch must meet its leather surface');
    return hit.point.addScaledVector(normal, .0014);
  };
  const parts: BufferGeometry[] = [];
  for (const across of [.45, 3.55]) for (let distance = .004; distance + .008 < length[64]; distance += .009) {
    const points = Array.from({ length: 5 }, (_, i) => surfacePoint(distance + .0048 * i / 4, across));
    parts.push(sweep(points, [.00055, .00055], { segments: 4, radial: 5, smooth: false, closeStart: true, closeTip: true }));
  }
  const stitches = merge(parts); stitches.name = 'link-strap-inset-stitches';
  fittingMaterial.dispose();
  return { material, stitches };
}
