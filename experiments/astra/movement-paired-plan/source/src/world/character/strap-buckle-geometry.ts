/** Original open metal frame, aligned and fitted to Link's existing chest strap. */
import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { merge, sweep } from './geometry';

export function createLinkStrapBuckle(strap: BufferGeometry, chestY: number): BufferGeometry {
  const position = strap.attributes.position;
  // leatherBand has 65 rows, each with five front and five rear vertices.
  if (position.count !== 650) throw new Error('Strap buckle requires the fitted Link band');
  const centreAt = (row: number) => new Vector3().fromBufferAttribute(position, row * 10 + 2);
  const aim = new Vector3(0, .728 - chestY, .108);
  let row = 1, best = Infinity;
  for (let i = 1; i < 64; i++) {
    const p = centreAt(i), d = p.distanceToSquared(aim);
    if (p.z > 0 && d < best) { best = d; row = i; }
  }
  const material = new MeshBasicMaterial(), mesh = new Mesh(strap, material);
  mesh.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(aim.x, aim.y, .4), new Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh, false)[0];
  if (!hit?.face) { material.dispose(); throw new Error('Buckle must meet the brown strap'); }
  const normal = hit.face.normal.clone().normalize();
  if (normal.z < 0) normal.negate();
  const along = centreAt(row + 1).sub(centreAt(row - 1));
  along.addScaledVector(normal, -along.dot(normal)).normalize();
  if (along.y < 0) along.negate();
  const across = along.clone().cross(normal).normalize();
  const basis = new Matrix4().makeBasis(across, along, normal);
  const origin = hit.point.clone();

  // Rounded rectangle: 30 mm clear width accepts the unchanged28 mm strap.
  const hx = .0165, hy = .018, corner = .004, tube = .0015;
  const points: Vector3[] = [], normals: Vector3[] = [];
  for (let cornerIndex = 0; cornerIndex < 4; cornerIndex++) {
    const angle0 = cornerIndex * Math.PI / 2;
    const cx = (cornerIndex === 0 || cornerIndex === 3 ? 1 : -1) * (hx - corner);
    const cy = (cornerIndex < 2 ? 1 : -1) * (hy - corner);
    for (let j = 0; j <= 8; j++) {
      const angle = angle0 + j / 8 * Math.PI / 2;
      points.push(new Vector3(cx + corner * Math.cos(angle), cy + corner * Math.sin(angle), 0));
      normals.push(new Vector3(Math.cos(angle), Math.sin(angle), 0));
    }
  }
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let i = 0; i < points.length; i++) for (let j = 0; j <= 8; j++) {
    const angle = j / 8 * Math.PI * 2;
    const p = points[i].clone().addScaledVector(normals[i], tube * Math.cos(angle));
    p.z = tube * Math.sin(angle);
    positions.push(...p.toArray()); uv.push(i / points.length, j / 8);
    if (j < 8) {
      const a = i * 9 + j, b = ((i + 1) % points.length) * 9 + j;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const frame = new BufferGeometry();
  frame.setAttribute('position', new Float32BufferAttribute(positions, 3));
  frame.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  frame.setIndex(indices); frame.computeVertexNormals();
  const bar = sweep([new Vector3(-hx, -.003, 0), new Vector3(hx, -.003, 0)], [.0012, .0012],
    { segments: 1, radial: 8, smooth: false, closeStart: true, closeTip: true });
  const pin = sweep([new Vector3(0, -.004, .0005), new Vector3(0, .007, .0018), new Vector3(0, hy, .0004)], [.0012, .0011, .0008],
    { segments: 10, radial: 8, closeStart: true, closeTip: true });
  const buckle = merge([frame, bar, pin]);
  buckle.applyMatrix4(basis); buckle.translate(origin.x, origin.y, origin.z);
  // Fit the rigid frame as one piece. Its rear clears the actual curved strap;
  // the centre opening remains real geometry, never a painted dark rectangle.
  const p = buckle.attributes.position;
  let lift = .001;
  for (let i = 0; i < p.count; i++) {
    const v = new Vector3().fromBufferAttribute(p, i);
    ray.set(v.clone().addScaledVector(normal, .10), normal.clone().negate());
    const sample = ray.intersectObject(mesh, false)[0];
    if (sample) lift = Math.max(lift, sample.point.clone().sub(v).dot(normal) + .0007);
  }
  buckle.translate(normal.x * lift, normal.y * lift, normal.z * lift);
  buckle.name = 'link-open-strap-buckle';
  material.dispose();
  return buckle;
}
