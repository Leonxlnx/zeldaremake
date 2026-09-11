/** Original shallow patch pockets fitted to the existing front-panel triangles. */
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { merge } from './geometry';

type Surface = (u: number, v: number) => Vector3;

const THICKNESS = 0.0012;
const COLUMNS = 20;
const ROWS = 16;

function smooth(a: number, b: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A closed cloth slab; only the cavity between this slab and the tunic is open. */
function clothPatch(surface: Surface): BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const front: Vector3[] = [];
  for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLUMNS; col++) {
    front.push(surface(col / COLUMNS * 2 - 1, row / ROWS));
  }
  for (const depth of [0, THICKNESS]) for (const point of front) {
    positions.push(point.x, point.y, point.z - depth);
    // Metre-based charts keep the cloth warp vertical on front and lining.
    uvs.push(point.x, point.y);
  }
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLUMNS; col++) {
    const a = row * (COLUMNS + 1) + col, b = a + 1, c = a + COLUMNS + 1, d = c + 1;
    indices.push(a, c, b, b, c, d);
    const n = front.length;
    indices.push(n + a, n + b, n + c, n + b, n + d, n + c);
  }
  // Clockwise from above-left when viewed from the front. Separate return
  // charts prevent collapsed UV triangles along the 1.2 mm cloth edges.
  const border: number[] = [];
  for (let col = 0; col <= COLUMNS; col++) border.push(col);
  for (let row = 1; row <= ROWS; row++) border.push(row * (COLUMNS + 1) + COLUMNS);
  for (let col = COLUMNS - 1; col >= 0; col--) border.push(ROWS * (COLUMNS + 1) + col);
  for (let row = ROWS - 1; row > 0; row--) border.push(row * (COLUMNS + 1));
  let arc = 0;
  for (let i = 0; i < border.length; i++) {
    const a = front[border[i]], b = front[border[(i + 1) % border.length]];
    const nextArc = arc + a.distanceTo(b), first = positions.length / 3;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, a.x, a.y, a.z - THICKNESS, b.x, b.y, b.z - THICKNESS);
    uvs.push(arc, 0, nextArc, 0, arc, THICKNESS, nextArc, THICKNESS);
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
    arc = nextArc;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function seam(surface: Surface, inset: number): Vector3[] {
  const points: Vector3[] = [];
  const add = (u: number, v: number) => points.push(surface(u, v).add(new Vector3(0, 0, 0.00045)));
  const edge = 1 - inset;
  // Side/bottom stitching leaves the mouth open. The flap uses the same
  // restrained U seam rather than an ornamental border across its fold.
  for (let i = 0; i <= 8; i++) add(-edge, inset + (1 - 2 * inset) * i / 8);
  for (let i = 1; i <= 8; i++) add(-edge + 2 * edge * i / 8, 1 - inset);
  for (let i = 1; i <= 8; i++) add(edge, 1 - inset - (1 - 2 * inset) * i / 8);
  return points;
}

export function createLinkTunicPockets(panels: readonly BufferGeometry[], hipY: number): {
  cloth: BufferGeometry;
  stitchPaths: Vector3[][];
} {
  if (panels.length !== 2) throw new Error('Link pockets require the two original front panels');
  const parts: BufferGeometry[] = [], stitchPaths: Vector3[][] = [];
  const material = new MeshBasicMaterial();
  const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  try {
    for (let side = 0; side < panels.length; side++) {
      // Keep the complete pocket inboard of the existing belt satchel.
      const panel = new Mesh(panels[side], material), centreX = (side === 0 ? -1 : 1) * 0.062;
      const fitted = (x: number, y: number, offset: number) => {
        ray.ray.origin.set(x, y - hipY, 0.3);
        const hit = ray.intersectObject(panel, false)[0];
        if (!hit) throw new Error('Pocket must remain within its original tunic panel');
        return new Vector3(x, y - hipY, hit.point.z + offset);
      };
      const body: Surface = (u, v) => {
        const width = 0.026 * (1 - 0.04 * smooth(0.7, 1, v));
        const y = 0.560 - 0.078 * v + 0.0045 * Math.pow(Math.abs(u), 4) * smooth(0.7, 1, v);
        const fullness = Math.pow(Math.max(0, 1 - u * u), 0.6) * smooth(0, 0.22, 1 - v);
        const offset = 0.0008 + 0.0068 * fullness * (0.72 + 0.28 * Math.cos(v * Math.PI * 0.5));
        return fitted(centreX + u * width, y, offset);
      };
      const flap: Surface = (u, v) => {
        const y = 0.575 - 0.031 * v + 0.003 * Math.pow(Math.abs(u), 4) * smooth(0.6, 1, v);
        const offset = 0.0008 + 0.0101 * smooth(0, 0.32, v) - 0.0018 * smooth(0.42, 1, v);
        return fitted(centreX + u * 0.028, y, offset);
      };
      parts.push(clothPatch(body), clothPatch(flap));
      stitchPaths.push(seam(body, 0.075), seam(flap, 0.075));
    }
  } finally {
    material.dispose();
  }
  return { cloth: merge(parts), stitchPaths };
}
