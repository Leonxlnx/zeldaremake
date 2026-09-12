/** Link-only hair chart scale; geometry and the authored growth directions stay unchanged. */
import { Vector3, type BufferGeometry } from 'three';
import { LINK_HAIR_TILE_METRES } from './hair-surface';

interface Sample { area: number; u: number; v: number }
export interface LinkHairUVReport {
  chart: number;
  vertices: number;
  scale: [number, number];
  undefinedUVAreaFraction: number;
}

function median(samples: Sample[], axis: 'u' | 'v'): number {
  const sorted = samples.slice().sort((a, b) => a[axis] - b[axis]);
  const half = sorted.reduce((sum, sample) => sum + sample.area, 0) / 2;
  let area = 0;
  for (const sample of sorted) {
    area += sample.area;
    if (area >= half) return sample[axis];
  }
  throw new Error('Link hair needs a non-degenerate UV chart');
}

/**
 * Normalize each indexed connected shell/lock independently after merging the hair.
 * Hair is authored in metres at its final scale. U follows growth; V crosses fibres.
 * The oval locks fold V continuously on their back face, so integer repeat rounding
 * or circular unwrapping would distort their existing charts. Thin shell returns and
 * buried root caps retain their inherited degenerate UVs; no topology is changed.
 */
export function normalizeLinkHairUVs(geometry: BufferGeometry): LinkHairUVReport[] {
  if (geometry.userData.linkHairUVsNormalized) return [];
  const position = geometry.attributes.position, uv = geometry.attributes.uv, index = geometry.index;
  if (!position || !uv || !index) throw new Error('Link hair needs indexed UV geometry');
  const parents = Array.from({ length: position.count }, (_, i) => i);
  const root = (i: number): number => {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = root(index.getX(i));
    parents[root(index.getX(i + 1))] = a; parents[root(index.getX(i + 2))] = a;
  }
  const charts = new Map<number, { vertices: number[]; samples: Sample[]; area: number; undefinedArea: number }>();
  for (let i = 0; i < position.count; i++) {
    const id = root(i);
    if (!charts.has(id)) charts.set(id, { vertices: [], samples: [], area: 0, undefinedArea: 0 });
    charts.get(id)!.vertices.push(i);
  }
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), e1 = new Vector3(), e2 = new Vector3();
  const du = new Vector3(), dv = new Vector3(), cross = new Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2), chart = charts.get(root(ia))!;
    a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic);
    e1.subVectors(b, a); e2.subVectors(c, a);
    const area = cross.crossVectors(e1, e2).length() / 2;
    chart.area += area;
    const u1 = uv.getX(ib) - uv.getX(ia), v1 = uv.getY(ib) - uv.getY(ia);
    const u2 = uv.getX(ic) - uv.getX(ia), v2 = uv.getY(ic) - uv.getY(ia), det = u1 * v2 - u2 * v1;
    if (area < 1e-14 || Math.abs(det) < 1e-14) { chart.undefinedArea += area; continue; }
    du.copy(e1).multiplyScalar(v2).addScaledVector(e2, -v1).multiplyScalar(1 / det);
    dv.copy(e1).multiplyScalar(-u2).addScaledVector(e2, u1).multiplyScalar(1 / det);
    const metricArea = cross.crossVectors(du, dv).length();
    if (metricArea < 1e-14) { chart.undefinedArea += area; continue; }
    chart.samples.push({ area, u: metricArea / dv.length(), v: metricArea / du.length() });
  }
  const report: LinkHairUVReport[] = [];
  for (const chart of charts.values()) {
    const scaleU = median(chart.samples, 'u') / LINK_HAIR_TILE_METRES.u;
    const scaleV = median(chart.samples, 'v') / LINK_HAIR_TILE_METRES.v;
    // Different deterministic tile origins avoid duplicating one pigment pattern on every lock.
    const offsetU = report.length * .137 % 1, offsetV = report.length * .271 % 1;
    for (const i of chart.vertices) uv.setXY(i, uv.getX(i) * scaleU + offsetU, uv.getY(i) * scaleV + offsetV);
    report.push({ chart: report.length, vertices: chart.vertices.length, scale: [scaleU, scaleV],
      undefinedUVAreaFraction: chart.area ? chart.undefinedArea / chart.area : 0 });
  }
  uv.needsUpdate = true; geometry.userData.linkHairUVsNormalized = true;
  return report;
}
