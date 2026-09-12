/** Original Link face, centred on the existing head pivot. No imported assets. */
import { BufferGeometry, Float32BufferAttribute, SphereGeometry } from 'three';
import { merge } from './geometry';
import { createLinkEarGeometry } from './ear-geometry';
import { shapeLinkLowerFace } from './lower-face-geometry';

const gaussian = (value: number, centre: number, width: number): number =>
  Math.exp(-Math.pow((value - centre) / width, 2));
const compact = (value: number, extent: number): number => {
  const u = Math.min(1, Math.abs(value) / extent);
  return (1 - u * u) ** 2;
};

const smooth = (a: number, b: number, value: number): number => {
  const u = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** A restrained cupid's bow shared by the continuous lips and their fitted mouth seam. */
export function linkMouthHeight(x: number, k: number): number {
  const u = x / k;
  return k * (-.057 + .0006 * (u / .015) ** 2
    + .0008 * gaussian(Math.abs(u), .005, .003) - .0003 * gaussian(u, 0, .003));
}

/** The narrow bridge widens below the fitted eye rims, then into the lip plane. */
function midfaceWeight(x: number, y: number, z: number, k: number): number {
  if (z < .08 * k) return 0;
  const height = y / k;
  const halfWidth = (.011 + .021 * smooth(.022, .038, -height)) * k;
  return compact(x, halfWidth) * smooth(-.085, -.075, height) * (1 - smooth(.001, .008, height));
}

function midfaceDepth(x: number, y: number, z: number, k: number): number {
  const weight = midfaceWeight(x, y, z, k);
  if (weight === 0) return 0;
  const px = x / k, py = y / k;
  const bridge = .0023 * gaussian(px, 0, .0057) * gaussian(py, -.003, .019);
  const sidePlanes = -.0010 * gaussian(Math.abs(px), .011, .0035) * gaussian(py, -.014, .015);
  const tip = .0048 * gaussian(px, 0, .0078) * gaussian(py, -.025, .0085);
  const alar = .0024 * gaussian(Math.abs(px), .011, .0042) * gaussian(py, -.034, .0055);
  const underside = -.0018 * gaussian(px, 0, .012) * gaussian(py, -.039, .0030)
    + .0008 * gaussian(px, 0, .003) * gaussian(py, -.036, .005);
  const philtrum = (.0007 * gaussian(Math.abs(px), .0035, .0018)
    - .0003 * gaussian(px, 0, .0018)) * gaussian(py, -.048, .0065);
  const seam = linkMouthHeight(x, k) / k, lipWidth = compact(px, .021);
  const lips = lipWidth * (.0022 * gaussian(py, seam + .0021, .0024)
    + .0027 * gaussian(py, seam - .0038, .0030) - .0004 * gaussian(py, seam, .0008));
  const lowerFold = -.0005 * gaussian(px, 0, .023) * gaussian(py, -.068, .0035);
  return k * weight * (bridge + sidePlanes + tip + alar + underside + philtrum + lips + lowerFold);
}

/**
 * Refine only the centre/lower face. Shared edge bisection and conforming transition
 * triangles avoid cracks; all new rest positions stay on their original triangle planes.
 * The orbital triangles lie outside this compact domain. Preserve their original vertex
 * normals explicitly, so a changed adjacent nose triangle cannot change socket shading.
 */
function sculptMidface(skull: BufferGeometry, k: number): BufferGeometry {
  const source = skull.attributes.position, sourceNormal = skull.attributes.normal, sourceUv = skull.attributes.uv;
  const positions = Array.from(source.array), normals = Array.from(sourceNormal.array), uvs = Array.from(sourceUv.array);
  let triangles = Array.from(skull.index!.array);
  const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
  for (let pass = 0; pass < 3; pass++) {
    const split = new Map<string, number>();
    for (let t = 0; t < triangles.length; t += 3) for (let j = 0; j < 3; j++) {
      const a = triangles[t + j], b = triangles[t + (j + 1) % 3], edge = key(a, b);
      if (split.has(edge)) continue;
      const x = (positions[a * 3] + positions[b * 3]) / 2;
      const y = (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2;
      const z = (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2;
      const length = Math.hypot(positions[a * 3] - positions[b * 3],
        positions[a * 3 + 1] - positions[b * 3 + 1], positions[a * 3 + 2] - positions[b * 3 + 2]);
      if (midfaceWeight(x, y, z, k) === 0 || length <= .0028 * k) continue;
      const vertex = positions.length / 3;
      positions.push(x, y, z);
      const nx = normals[a * 3] + normals[b * 3], ny = normals[a * 3 + 1] + normals[b * 3 + 1];
      const nz = normals[a * 3 + 2] + normals[b * 3 + 2], n = Math.hypot(nx, ny, nz);
      normals.push(nx / n, ny / n, nz / n);
      uvs.push((uvs[a * 2] + uvs[b * 2]) / 2, (uvs[a * 2 + 1] + uvs[b * 2 + 1]) / 2);
      split.set(edge, vertex);
    }
    if (split.size === 0) break;
    const next: number[] = [];
    for (let t = 0; t < triangles.length; t += 3) {
      const a = triangles[t], b = triangles[t + 1], c = triangles[t + 2];
      const ab = split.get(key(a, b)), bc = split.get(key(b, c)), ca = split.get(key(c, a));
      const count = Number(ab !== undefined) + Number(bc !== undefined) + Number(ca !== undefined);
      if (count === 0) next.push(a, b, c);
      else if (count === 3) next.push(a, ab!, ca!, ab!, b, bc!, ca!, bc!, c, ab!, bc!, ca!);
      else if (count === 1) {
        if (ab !== undefined) next.push(a, ab, c, ab, b, c);
        else if (bc !== undefined) next.push(b, bc, a, bc, c, a);
        else next.push(c, ca!, b, ca!, a, b);
      } else {
        // Rotate the triangle so the two split edges meet at the middle vertex.
        let x: number, y: number, z: number, xy: number, yz: number;
        if (ca === undefined) { x = a; y = b; z = c; xy = ab!; yz = bc!; }
        else if (ab === undefined) { x = b; y = c; z = a; xy = bc!; yz = ca; }
        else { x = c; y = a; z = b; xy = ca; yz = ab; }
        next.push(xy, y, yz, x, xy, yz, x, yz, z);
      }
    }
    triangles = next;
  }
  const displacements: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    const depth = midfaceDepth(positions[i], positions[i + 1], positions[i + 2], k);
    positions[i + 2] += depth; displacements.push(depth);
  }
  const result = new BufferGeometry();
  result.setAttribute('position', new Float32BufferAttribute(positions, 3));
  result.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  result.setIndex(triangles); result.computeVertexNormals();
  const normal = result.attributes.normal;
  const epsilon = .00001 * k;
  for (let i = 0; i < normal.count; i++) {
    const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
    if (displacements[i] === 0) { normal.setXYZ(i, nx, ny, nz); continue; }
    // Preserve the original smooth skull curvature through local refinement.
    // For z += d(x,y), inverse-transpose sends N to (Nx - dX*Nz, Ny - dY*Nz, Nz).
    const x = positions[i * 3], y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2] - displacements[i];
    const dx = (midfaceDepth(x + epsilon, y, z, k) - midfaceDepth(x - epsilon, y, z, k)) / (2 * epsilon);
    const dy = (midfaceDepth(x, y + epsilon, z, k) - midfaceDepth(x, y - epsilon, z, k)) / (2 * epsilon);
    const tx = nx - dx * nz, ty = ny - dy * nz, length = Math.hypot(tx, ty, nz);
    normal.setXYZ(i, tx / length, ty / length, nz / length);
  }
  skull.dispose();
  return result;
}

/**
 * Skull, cheeks, jaw, continuous nose and pointed ears for Link's softFeatures path only.
 * The scalp retains the existing radius and ±1.04r height. Existing eyes, brows and mouth
 * remain separate meshes at their current anchors. Positive Z faces the viewer.
 * Hair fitters use the unchanged carrier by default; the visible Link face opts into the jaw.
 */
export function createLinkFaceGeometry(radius: number, lowerJaw = false): BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Link face radius must be positive and finite');
  const k = radius / 0.125;
  // Extra samples resolve the nose bridge directly in the skull, without a pasted-on sphere.
  const skull = new SphereGeometry(radius, 64, 48);
  const position = skull.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const originalX = position.getX(i), originalY = position.getY(i), originalZ = position.getZ(i);
    const ny = originalY / radius;
    const jaw = Math.max(0, -ny);
    // Keep the fitted orbital region exact; soften only the lower cheek/chin taper.
    const lower = Math.min(1, Math.max(0, (jaw - 0.22) / 0.36));
    const taper = 0.22 - 0.06 * lower * lower * (3 - 2 * lower);
    const x = originalX * (1 - taper * Math.pow(jaw, 1.4));
    const y = originalY * 1.04;
    let z = originalZ * 0.98;
    if (originalZ > 0) {
      const front = Math.pow(originalZ / radius, 4);
      // Shallow cheek planes and a small muzzle pad soften the tapered jaw. Their vertical
      // falloff keeps the eye sockets at the established surface depth.
      z += front * (0.015 * radius * gaussian(Math.abs(x) / radius, 0.43, 0.20)
        * gaussian(ny, -0.36, 0.20)
        + 0.003 * k * gaussian(x, 0, 0.036 * k) * gaussian(y, -0.054 * k, 0.022 * k));
      // A shallow orbital shelf brings the cheek into the existing eye planes without moving
      // those planes or covering their almond corners. The falloff also forms the upper cheek.
      z += front * 0.0035 * k * (gaussian(x, -0.050 * k, 0.045 * k)
        + gaussian(x, 0.050 * k, 0.045 * k)) * gaussian(y, -0.004 * k, 0.034 * k);
      // A narrow bridge, defined tip and two tiny alar wings are continuous with the face.
      const bridge = 0.006 * k * gaussian(x, 0, 0.008 * k) * gaussian(y, 0.004 * k, 0.031 * k);
      const tip = 0.0125 * k * gaussian(x, 0, 0.0105 * k) * gaussian(y, -0.027 * k, 0.015 * k);
      const wings = 0.0035 * k * (gaussian(x, -0.013 * k, 0.006 * k)
        + gaussian(x, 0.013 * k, 0.006 * k)) * gaussian(y, -0.034 * k, 0.009 * k);
      z += front * (bridge + tip + wings);
      // A compact button tip and shallow lower lip resolve the profile without changing
      // the fitted orbital shelf or scalp. Both additions fade to zero inside the face.
      z += front * 0.004 * k * gaussian(x, 0, 0.012 * k) * gaussian(y, -0.030 * k, 0.012 * k)
        * compact(x, 0.027 * k) * compact(y + 0.031 * k, 0.022 * k);
      z += front * 0.0012 * k * gaussian(x, 0, 0.020 * k) * gaussian(y, -0.062 * k, 0.005 * k)
        * compact(x, 0.032 * k) * compact(y + 0.062 * k, 0.010 * k);
      // Support the lower-front jaw as a broad continuous chin plane. This compact
      // displacement leaves the lip/orbits, head height and rear neck fit unchanged.
      const chinFront = originalZ / Math.hypot(originalX, originalZ);
      z += 0.012 * k * compact(y + 0.100 * k, 0.030 * k)
        * compact(x, 0.065 * k) * chinFront * chinFront;
    }
    position.setXYZ(i, x, y, z);
  }
  skull.computeVertexNormals();
  // SphereGeometry keeps unused seam vertices at its poles. Give those the pole normal too,
  // so every normal in the returned buffer is valid, including vertices outside the index.
  const normal = skull.attributes.normal;
  for (let i = 0; i < normal.count; i++) {
    if (normal.getX(i) ** 2 + normal.getY(i) ** 2 + normal.getZ(i) ** 2 < 1e-12) {
      normal.setXYZ(i, 0, Math.sign(position.getY(i)), 0);
    }
  }
  const geometry = merge([lowerJaw ? shapeLinkLowerFace(sculptMidface(skull, k), k) : sculptMidface(skull, k), createLinkEarGeometry(radius, 1), createLinkEarGeometry(radius, -1)]);
  geometry.name = 'original-link-shaped-face';
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
