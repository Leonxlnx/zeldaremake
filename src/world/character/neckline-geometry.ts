/** Original central V neckline, cut from the existing Link garment surfaces. */
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3 } from 'three';
import { merge } from './geometry';
interface Vertex {
  p: Vector3;
  n: Vector3;
  uv: Vector2;
  index?: number;
}
interface Cut {
  geometry: BufferGeometry;
  edges: [Vector3[], Vector3[]];
}
export interface LinkNecklineGeometry {
  upper: BufferGeometry;
  collarFlaps: BufferGeometry[];
  insert: BufferGeometry;
}
/**
 * Replace only the central front neckline in chest-local, metre-based geometry.
 * Inputs remain untouched. Existing open neck/hem and outer flap boundaries stay
 * open; each new medial cut receives an overlapping closed fabric return.
 * The insert uses the existing undershirt material supplied by the caller.
 */
export function createLinkNeckline(upper: BufferGeometry, collarFlaps: readonly BufferGeometry[], chestY: number): LinkNecklineGeometry {
  if (!Number.isFinite(chestY) || collarFlaps.length !== 2)
    throw new RangeError('Link neckline needs a finite chest origin and two collar flaps');
  const top = Math.fround(.860 - chestY), bottom = Math.fround(.835 - chestY), half = .032, slope = (top - bottom) / half;
  const material = new MeshBasicMaterial(), ray = new Raycaster();
  const meshFor = (g: BufferGeometry) => { const mesh = new Mesh(g, material); mesh.updateMatrixWorld(true); return mesh; };
  const surface = meshFor(upper);
  const pointOn = (mesh: Mesh, x: number, y: number, fallback?: number): Vector3 => {
    if (Math.abs(x) < 1e-12)
      x = 0;
    ray.set(new Vector3(x, Math.min(y, top - 1e-7), .3), new Vector3(0, 0, -1));
    const hit = ray.intersectObject(mesh, false)[0];
    if (!hit && fallback === undefined)
      throw new Error(`Neckline point must meet original garment x=${x}, y=${y}`);
    return new Vector3(x, y, hit?.point.z ?? fallback!);
  };
  const cut = (source: BufferGeometry): Cut => {
    const position = source.attributes.position, normal = source.attributes.normal, uv = source.attributes.uv, index = source.index;
    if (!normal || !uv || !index)
      throw new Error('Link neckline requires indexed position, normal and UV attributes');
    const positions = Array.from(position.array), normals = Array.from(normal.array), uvs = Array.from(uv.array), indices: number[] = [];
    const read = (i: number): Vertex => ({ p: new Vector3().fromBufferAttribute(position, i), n: new Vector3().fromBufferAttribute(normal, i), uv: new Vector2(uv.getX(i), uv.getY(i)), index: i });
    const distances = [(v: Vertex) => v.p.y - bottom - slope * v.p.x, (v: Vertex) => v.p.y - bottom + slope * v.p.x];
    const interpolate = (a: Vertex, b: Vertex, t: number): Vertex => {
      if (t < 1e-10)
        return a;
      if (t > 1 - 1e-10)
        return b;
      return { p: a.p.clone().lerp(b.p, t), n: a.n.clone().lerp(b.n, t).normalize(), uv: a.uv.clone().lerp(b.uv, t) };
    };
    const clip = (polygon: Vertex[], distance: (v: Vertex) => number, inside: boolean): Vertex[] => {
      const result: Vertex[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b), keepA = inside ? da >= -1e-10 : da <= 1e-10, keepB = inside ? db >= -1e-10 : db <= 1e-10;
        if (keepA)
          result.push(a);
        if (keepA !== keepB)
          result.push(interpolate(a, b, da / (da - db)));
      }
      return result.filter((v, i) => i === 0 || v.p.distanceToSquared(result[i - 1].p) > 1e-20).filter((v, i, all) => i !== all.length - 1 || all.length === 1 || v.p.distanceToSquared(all[0].p) > 1e-20);
    };
    const newVertices = new Map<string, number>();
    const vertexIndex = (v: Vertex): number => {
      if (v.index !== undefined)
        return v.index;
      const key = [...v.p.toArray(), ...v.uv.toArray()].map(v => v.toFixed(9)).join(':');
      const cached = newVertices.get(key);
      if (cached !== undefined)
        return cached;
      const i = positions.length / 3;
      positions.push(...v.p.toArray());
      normals.push(...v.n.toArray());
      uvs.push(...v.uv.toArray());
      newVertices.set(key, i);
      return i;
    };
    const edges: [Vector3[], Vector3[]] = [[], []];
    const append = (polygon: Vertex[]) => {
      for (let i = 1; i < polygon.length - 1; i++) {
        const a = polygon[0], b = polygon[i], c = polygon[i + 1];
        if (b.p.clone().sub(a.p).cross(c.p.clone().sub(a.p)).lengthSq() > 1e-20)
          indices.push(vertexIndex(a), vertexIndex(b), vertexIndex(c));
      }
      if (polygon.length >= 3)
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length];
          for (let side = 0; side < 2; side++)
            if (Math.abs(distances[side](a)) < 1e-8 && Math.abs(distances[side](b)) < 1e-8) {
              const other = distances[1 - side], da = other(a), db = other(b);
              if (da >= -1e-9 && db >= -1e-9)
                edges[side].push(a.p.clone(), b.p.clone());
              else if ((da >= 0) !== (db >= 0)) {
                const middle = interpolate(a, b, da / (da - db));
                edges[side].push((da >= 0 ? a : middle).p.clone(), (db >= 0 ? b : middle).p.clone());
              }
            }
        }
    };
    for (let i = 0; i < index.count; i += 3) {
      const original = [read(index.getX(i)), read(index.getX(i + 1)), read(index.getX(i + 2))];
      if (original.every(v => v.p.z <= 0) || distances.some(d => original.every(v => d(v) <= 1e-10))) {
        indices.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
        continue;
      }
      let remaining = original;
      for (const distance of distances) {
        append(clip(remaining, distance, false));
        remaining = clip(remaining, distance, true);
        if (remaining.length < 3)
          break;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return { geometry, edges };
  };
  const rim = (edges: [Vector3[], Vector3[]], source: BufferGeometry): BufferGeometry => {
    const original = meshFor(source), parts: BufferGeometry[] = [];
    for (let side = 0; side < 2; side++) {
      const points = [...new Map(edges[side].map(p => [p.y.toFixed(8), p])).values()].sort((a, b) => a.y - b.y);
      if (points.length < 2)
        continue;
      // Each edge runs from the V tip upward; reverse the left to keep the section winding.
      if (side === 1)
        points.reverse();
      const outward = new Vector2(side === 0 ? slope : -slope, -1).normalize(), width = .0018, depth = .0016;
      const p: number[] = [], uv: number[] = [], ind: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const edge = points[i], outside = pointOn(original, edge.x + outward.x * width, edge.y + outward.y * width, edge.z);
        for (const v of [edge.clone().add(new Vector3(0, 0, .00025)), outside.clone().add(new Vector3(0, 0, .00025)), outside.clone().add(new Vector3(0, 0, -depth)), edge.clone().add(new Vector3(0, 0, -depth))])
          p.push(...v.toArray());
        uv.push(0, i / (points.length - 1), 1, i / (points.length - 1), 1, i / (points.length - 1), 0, i / (points.length - 1));
        if (i < points.length - 1)
          for (let j = 0; j < 4; j++) {
            const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = a + 4, d = b + 4;
            ind.push(a, b, c, b, d, c);
          }
      }
      ind.push(0, 2, 1, 0, 3, 2);
      const end = p.length / 3 - 4;
      ind.push(end, end + 1, end + 2, end, end + 2, end + 3);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(p, 3));
      geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
      geometry.setIndex(ind);
      geometry.computeVertexNormals();
      parts.push(geometry);
    }
    if (!parts.length)
      throw new Error('Link neckline cut must create an exposed fabric edge');
    return merge(parts);
  };
  const withRim = (source: BufferGeometry): BufferGeometry => { const clipped = cut(source); return merge([clipped.geometry, rim(clipped.edges, source)]); };
  try {
    const changedUpper = withRim(upper), changedCollars = collarFlaps.map(withRim);
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [], rows: number[][] = [];
    const divisions = 12, insertBottom = bottom - .0015, insertHalf = half + .0015;
    for (let row = 0; row <= divisions; row++) {
      const v = row / divisions, y = insertBottom + (top - insertBottom) * v, halfWidth = insertHalf * v, indicesRow: number[] = [];
      for (let col = 0; col <= row; col++) {
        const x = row === 0 ? 0 : -halfWidth + 2 * halfWidth * col / row, p = pointOn(surface, x, y);
        p.z -= .0028;
        indicesRow.push(positions.length / 3);
        positions.push(...p.toArray());
        uvs.push((x / insertHalf + 1) * .5, v);
      }
      rows.push(indicesRow);
    }
    const layerSize = positions.length / 3;
    for (let i = 0; i < layerSize; i++) {
      positions.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2] - .0012);
      uvs.push(uvs[i * 2], uvs[i * 2 + 1]);
    }
    const triangle = (a: number, b: number, c: number) => { indices.push(a, b, c, a + layerSize, c + layerSize, b + layerSize); };
    for (let row = 1; row <= divisions; row++)
      for (let col = 0; col < row; col++) {
        triangle(rows[row - 1][col], rows[row][col + 1], rows[row][col]);
        if (col < row - 1)
          triangle(rows[row - 1][col], rows[row - 1][col + 1], rows[row][col + 1]);
      }
    const edge = [...rows.map(row => row[0]), ...rows[divisions].slice(1), ...rows.slice(1, divisions).reverse().map(row => row.at(-1)!)].reverse();
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i], b = edge[(i + 1) % edge.length];
      indices.push(a, a + layerSize, b, b, a + layerSize, b + layerSize);
    }
    const insert = new BufferGeometry();
    insert.setAttribute('position', new Float32BufferAttribute(positions, 3));
    insert.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    insert.setIndex(indices);
    insert.computeVertexNormals();
    insert.name = 'link-neckline-undershirt-insert';
    changedUpper.name = 'link-tunic-v-neck';
    for (const collar of changedCollars)
      collar.name = 'link-medial-collar-fold';
    for (const g of [changedUpper, ...changedCollars, insert]) {
      g.computeBoundingBox();
      g.computeBoundingSphere();
    }
    return { upper: changedUpper, collarFlaps: changedCollars, insert };
  }
  finally {
    material.dispose();
  }
}
