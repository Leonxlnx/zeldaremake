/** Link-only cloth chart density. Run after garment geometry/stitches, before static batching. */
import { Mesh, Vector3, type BufferGeometry } from 'three';
import type { Rig } from './rig';
import { LINK_CLOTH_TILE_METRES, LINK_CLOTH_YARNS } from './cloth-surface';

interface DensitySample { area: number; u: number; v: number }
export interface LinkClothUVReport {
  name: string;
  parent: string;
  scale: [number, number];
  medianYarnSpacingMm: [number, number];
  undefinedUVAreaFraction: number;
  repairedCentre: boolean;
}

function weightedMedian(samples: DensitySample[], axis: 'u' | 'v'): number {
  const sorted = samples.slice().sort((a, b) => a[axis] - b[axis]);
  const half = sorted.reduce((sum, sample) => sum + sample.area, 0) / 2;
  let area = 0;
  for (const sample of sorted) {
    area += sample.area;
    if (area >= half) return sample[axis];
  }
  throw new Error('Link cloth chart needs a non-degenerate UV surface');
}

function repairPlanarCentre(mesh: Mesh, rig: Rig): boolean {
  const geometry = mesh.geometry, position = geometry.attributes.position, uv = geometry.attributes.uv;
  if (mesh.name === 'tunic-front-panel') {
    // The surrounding rings use unsigned X and sole-space Y; keep that existing orientation.
    uv.setXY(0, Math.abs(position.getX(0)) * 5, (position.getY(0) + rig.props.hipY) * 5);
    return true;
  }
  if (mesh.name === 'collar-flap') {
    // Both collars use signed X. A shared(.5,.5) centre folded the negative-side chart.
    uv.setXY(0, position.getX(0) * 10, (position.getY(0) + rig.props.chestY - .78) * 10);
    return true;
  }
  return false;
}

function density(mesh: Mesh, geometry: BufferGeometry): { samples: DensitySample[]; undefinedAreaFraction: number } {
  const position = geometry.attributes.position, uv = geometry.attributes.uv, index = geometry.index;
  if (!uv || !index) throw new Error(`Link cloth ${mesh.name} needs indexed UV geometry`);
  const samples: DensitySample[] = [];
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), e1 = new Vector3(), e2 = new Vector3();
  const du = new Vector3(), dv = new Vector3(), cross = new Vector3();
  let totalArea = 0, undefinedArea = 0;
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2);
    a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
    e1.subVectors(b, a); e2.subVectors(c, a);
    const area = cross.crossVectors(e1, e2).length() / 2;
    totalArea += area;
    const u1 = uv.getX(ib) - uv.getX(ia), v1 = uv.getY(ib) - uv.getY(ia);
    const u2 = uv.getX(ic) - uv.getX(ia), v2 = uv.getY(ic) - uv.getY(ia);
    const determinant = u1 * v2 - u2 * v1;
    if (area < 1e-14 || Math.abs(determinant) < 1e-14) { undefinedArea += area; continue; }
    du.copy(e1).multiplyScalar(v2).addScaledVector(e2, -v1).multiplyScalar(1 / determinant);
    dv.copy(e1).multiplyScalar(-u2).addScaledVector(e2, u1).multiplyScalar(1 / determinant);
    const metricArea = cross.crossVectors(du, dv).length();
    if (metricArea < 1e-14) { undefinedArea += area; continue; }
    samples.push({ area, u: metricArea / dv.length(), v: metricArea / du.length() });
  }
  return { samples, undefinedAreaFraction: totalArea ? undefinedArea / totalArea : 0 };
}

/**
 * Keeps the authored chart direction, fixes the four fan centres, and normalizes each axis
 * by its actual area-weighted surface metric. Circular seams retain an integer tile count.
 * Curvature, poles and existing zero-area UV edge returns still have local density variation.
 * Requires shared cloth textures with repeat(1,1) and the shared yarn count/tile size from cloth-surface.
 */
export function normalizeLinkClothUVs(rig: Rig): LinkClothUVReport[] {
  if (rig.root.userData.linkClothUVsNormalized) return [];
  rig.root.updateMatrixWorld(true);
  const report: LinkClothUVReport[] = [];
  rig.root.traverse(object => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)
      || !object.material.name.startsWith('cloth-')) return;
    const mesh = object, geometry = mesh.geometry, uv = geometry.attributes.uv;
    if (!uv) throw new Error(`Link cloth ${mesh.name} needs UV coordinates`);
    const repairedCentre = repairPlanarCentre(mesh, rig);
    const { samples, undefinedAreaFraction } = density(mesh, geometry);
    const medianU = weightedMedian(samples, 'u'), medianV = weightedMedian(samples, 'v');
    let scaleU = medianU / LINK_CLOTH_TILE_METRES, scaleV = medianV / LINK_CLOTH_TILE_METRES;
    // One existing UV turn closes these rings. At least one complete tile keeps the small
    // brim circumference seamless; it consequently uses a finer~.62mm weave on that axis.
    if (['tunic-upper', 'tunic-skirt', 'sleeve', 'cap-dome', 'cap-brim'].includes(mesh.name))
      scaleU = Math.max(1, Math.round(scaleU));
    if (mesh.name === 'cap-tail' || mesh.name === 'cap-brim')
      scaleV = Math.max(1, Math.round(scaleV));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scaleU, uv.getY(i) * scaleV);
    uv.needsUpdate = true;
    report.push({ name: mesh.name, parent: mesh.parent?.name ?? '', scale: [scaleU, scaleV],
      medianYarnSpacingMm: [medianU / scaleU / LINK_CLOTH_YARNS * 1000, medianV / scaleV / LINK_CLOTH_YARNS * 1000],
      undefinedUVAreaFraction: undefinedAreaFraction, repairedCentre });
  });
  rig.root.userData.linkClothUVsNormalized = true;
  return report;
}
