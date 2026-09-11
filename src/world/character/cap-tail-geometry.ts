/** Original cloth-tail shaping; keep the fitted sweep and its seam vertex contract. */
import { BufferGeometry, Float32BufferAttribute, MathUtils, Vector3 } from 'three';

export function shapeLinkCapTail(fitted: BufferGeometry, headRadius: number): BufferGeometry {
  const position = fitted.getAttribute('position'), uv = fitted.getAttribute('uv');
  const oldNormals = fitted.getAttribute('normal');
  if (position.count !== 483 || fitted.index?.count !== 2664) throw new Error('Unexpected fitted cap-tail topology');
  const ringSize = 13, segments = 36, radial = 12, k = headRadius / .125;
  const positions = Array.from(position.array), uvs = Array.from(uv.array), indices: number[] = [];
  const smooth = (lo: number, hi: number, value: number): number => {
    const t = MathUtils.clamp((value - lo) / (hi - lo), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const original = (i: number) => new Vector3().fromBufferAttribute(position, i);
  const midpointIndex = (ring: number, edge: number) => 483 + ring * radial + edge;
  const shaped = (point: Vector3, centre: Vector3, width: number, backDepth: number, u: number): Vector3 => {
    const envelope = smooth(8 / segments, .42, u) * (1 - smooth(.72, 1, u));
    const q = (point.x - centre.x) / width;
    // Fullness grows sideways only: front-facing Y/Z and the fitted centreline stay fixed.
    point.x = centre.x + (point.x - centre.x) * (1 + .24 * envelope);
    const rear = MathUtils.clamp((centre.z - point.z) / backDepth, 0, 1);
    // Three rounded, slightly unequal longitudinal folds. Add volume only toward the back;
    // a fitted centre seam follows this surface. Ends gather into the old fit.
    const left = -.60 - .035 * Math.sin(Math.PI * u);
    const right = .61 - .025 * Math.sin(Math.PI * u);
    const folds = .008 * Math.exp(-((q / .19) ** 2))
      + .012 * Math.exp(-(((q - left) / .16) ** 2))
      + .011 * Math.exp(-(((q - right) / .17) ** 2));
    point.z -= k * envelope * rear * folds;
    return point;
  };
  for (let ring = 0; ring <= segments; ring++) {
    const start = ring * ringSize, centre = original(start).add(original(start + 6)).multiplyScalar(.5);
    const width = Math.abs(position.getX(start) - position.getX(start + 6)) * .5;
    let backDepth = 0;
    for (let j = 0; j < radial; j++) backDepth = Math.max(backDepth, centre.z - position.getZ(start + j));
    for (let j = 0; j <= radial; j++) {
      const p = shaped(original(start + j), centre, width, backDepth, ring / segments);
      positions.splice((start + j) * 3, 3, p.x, p.y, p.z);
    }
    // Append samples, rather than reordering original rings: outfit-details uses their
    // 13-vertex stride for the authored stitch path. At the protected root these are exact
    // linear edge midpoints, so subdivision leaves the original fitted surface unchanged.
    for (let j = 0; j < radial; j++) {
      const p = shaped(original(start + j).lerp(original(start + j + 1), .5), centre, width, backDepth, ring / segments);
      positions.push(p.x, p.y, p.z);
      uvs.push(ring / segments, (j + .5) / radial);
    }
  }
  const at = (ring: number, sample: number) => sample % 2 === 0
    ? ring * ringSize + sample / 2 : midpointIndex(ring, Math.floor(sample / 2));
  for (let ring = 0; ring < 8; ring++) for (let j = 0; j < radial; j++) {
    const a = at(ring, j * 2), c = at(ring, j * 2 + 2), b = at(ring + 1, j * 2), d = at(ring + 1, j * 2 + 2);
    const m = midpointIndex(ring, j), n = midpointIndex(ring + 1, j);
    // Retain each original diagonal: these triangles split the old faces exactly.
    indices.push(a, m, b, m, c, b, b, c, n, n, c, d);
  }
  for (let ring = 8; ring < segments; ring++) for (let j = 0; j < radial * 2; j++) {
    const a = at(ring, j), b = at(ring + 1, j), c = at(ring, j + 1), d = at(ring + 1, j + 1);
    indices.push(a, c, b, b, c, d);
  }
  for (let j = 0; j < radial * 2; j++) {
    indices.push(at(segments, j), at(segments, j + 1), 481);
    indices.push(at(0, j), 482, at(0, j + 1));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let ring = 0; ring <= segments; ring++) {
    if (ring <= 8 || ring === segments) {
      for (let j = 0; j <= radial; j++) {
        const i = ring * ringSize + j;
        normals.setXYZ(i, oldNormals.getX(i), oldNormals.getY(i), oldNormals.getZ(i));
      }
      for (let j = 0; j < radial; j++) {
        const a = ring * ringSize + j;
        const n = new Vector3().fromBufferAttribute(oldNormals, a)
          .add(new Vector3().fromBufferAttribute(oldNormals, a + 1)).normalize();
        normals.setXYZ(midpointIndex(ring, j), n.x, n.y, n.z);
      }
    } else {
      const a = ring * ringSize, b = a + radial;
      const n = new Vector3().fromBufferAttribute(normals, a)
        .add(new Vector3().fromBufferAttribute(normals, b)).normalize();
      normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z);
    }
  }
  for (const i of [481, 482]) normals.setXYZ(i, oldNormals.getX(i), oldNormals.getY(i), oldNormals.getZ(i));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.name = 'link-folded-cloth-cap-tail';
  fitted.dispose();
  return geometry;
}
