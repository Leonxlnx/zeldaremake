/** Original running stitches seated on the existing collar, in chest-local metres. */
import { BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector2, Vector3 } from 'three';
import { merge, sweep } from './geometry';

/** The medial fold is closed; only the original front sheet has an open boundary. */
function border(geometry: BufferGeometry): Vector2[] {
  const index = geometry.index, p = geometry.getAttribute('position');
  if (!index) throw new Error('Collar stitching needs indexed fabric');
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3);
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    const edge = edges.get(key);
    if (edge) edge.count++; else edges.set(key, { a, b, count: 1 });
  }
  const links = new Map<number, number[]>();
  for (const { a, b, count } of edges.values()) if (count === 1) {
    for (const [from, to] of [[a, b], [b, a]]) {
      const list = links.get(from) ?? []; list.push(to); links.set(from, list);
    }
  }
  if (!links.size || [...links.values()].some(list => list.length !== 2))
    throw new Error('Collar front must have one simple boundary');
  const start = Math.min(...links.keys()), result: Vector2[] = [];
  let previous = -1, current = start;
  do {
    result.push(new Vector2(p.getX(current), p.getY(current)));
    const next = links.get(current)!.find(i => i !== previous)!;
    previous = current; current = next;
    if (result.length > links.size) throw new Error('Collar boundary failed to close');
  } while (current !== start);
  if (result.length !== links.size) throw new Error('Unexpected second collar boundary');
  // Clipped triangles subdivide straight outline edges. Tiny Float32 deviations at
  // these redundant points must not become miter corners or reverse the inset path.
  // Retain every real corner; this only removes points within10nm of a straight span.
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      const a = result[(i + result.length - 1) % result.length], b = result[i];
      const c = result[(i + 1) % result.length], span = c.clone().sub(a), length = span.length();
      if (length === 0) continue;
      const along = b.clone().sub(a).dot(span) / (length * length);
      const distance = Math.abs(span.x * (b.y - a.y) - span.y * (b.x - a.x)) / length;
      if (along > 0 && along < 1 && distance < 1e-8) {
        result.splice(i, 1); changed = true; break;
      }
    }
  }
  return result;
}

/** Offset in the collar's XY chart; the actual Z is sampled from its finished surface. */
function inset(points: Vector2[], distance: number): Vector2[] {
  const area = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]; return sum + a.x * b.y - b.x * a.y;
  }, 0);
  const sign = Math.sign(area);
  return points.map((p, i) => {
    const before = p.clone().sub(points[(i + points.length - 1) % points.length]).normalize();
    const after = points[(i + 1) % points.length].clone().sub(p).normalize();
    const a = new Vector2(-before.y * sign, before.x * sign);
    const b = new Vector2(-after.y * sign, after.x * sign);
    const bisector = a.clone().add(b).normalize(), denominator = bisector.dot(a);
    if (denominator < .2) throw new Error('Collar corner is too sharp for the sewn margin');
    return p.clone().addScaledVector(bisector, distance / denominator);
  });
}

export function createLinkCollarStitches(collars: readonly BufferGeometry[]): BufferGeometry {
  const material = new MeshBasicMaterial({ side: DoubleSide }), ray = new Raycaster();
  const parts: BufferGeometry[] = [];
  try {
    for (const collar of collars) {
      const line = inset(border(collar), .0018), surface = new Mesh(collar, material);
      surface.updateMatrixWorld(true);
      const lengths = [0];
      for (let i = 0; i < line.length; i++) lengths.push(lengths[i] + line[i].distanceTo(line[(i + 1) % line.length]));
      const total = lengths.at(-1)!, count = Math.ceil(total / .0065), spacing = total / count;
      const point = (distance: number, lift: number): Vector3 => {
        let i = 0; while (i + 1 < line.length && lengths[i + 1] < distance) i++;
        const v = line[i].clone().lerp(line[(i + 1) % line.length], (distance - lengths[i]) / (lengths[i + 1] - lengths[i]));
        ray.set(new Vector3(v.x, v.y, .3), new Vector3(0, 0, -1));
        const hit = ray.intersectObject(surface, false)[0];
        if (!hit) throw new Error('Collar stitch must meet the existing fabric');
        return hit.point.clone().add(new Vector3(0, 0, lift));
      };
      for (let i = 0; i < count; i++) {
        // Short buried ends read as thread passing through cloth, not a raised wire border.
        const path = [.18, .30, .50, .70, .82].map((f, j) => point((i + f) * spacing,
          j === 0 || j === 4 ? -.00012 : .00035));
        parts.push(sweep(path, [.00030, .00030], { segments: 4, radial: 4, closeStart: true, closeTip: true }));
      }
    }
    const geometry = merge(parts); geometry.name = 'original-link-collar-running-stitches';
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  } finally { material.dispose(); }
}
