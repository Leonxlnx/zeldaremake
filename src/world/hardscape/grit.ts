/**
 * Seam grit: the small stones (1.5–4 cm) packed into the dirt joints between the flagstones and
 * scattered at the stair feet (concept sheet 02 'Stone path': packed brown dirt seams with small
 * stones and a few grass blades). One flattened, noise-displaced icosahedron, GPU instanced with
 * per-instance squash / yaw / tint so no two read alike; the shader collapses instances beyond
 * GRIT_LOD_FAR onto their base point (a LOD cull with no extra draw calls).
 */
import { Color, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type WebGLProgramParametersWithUniforms } from 'three';
import type { Rng } from '../util/prng';

export interface GritSpot {
  x: number;
  y: number;
  z: number;
  /** radius (m) */
  size: number;
}

/** grit collapses to its base point beyond this camera distance */
export const GRIT_LOD_FAR = 20;

function buildGritGeometry(rng: Rng): BufferGeometry {
  // detail 0: 20 triangles — a 2–4 cm pebble is a handful of pixels even from camera E
  const g = new IcosahedronGeometry(1, 0);
  const pos = g.attributes.position;
  // welded displacement per unique direction, then a squash so the pebble lies flat
  const disp = new Map<string, number>();
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let d = disp.get(key);
    if (d === undefined) {
      d = rng.range(0.82, 1.14);
      disp.set(key, d);
    }
    v.multiplyScalar(d);
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  // smooth normals: the displaced shape is still star-convex around its centre
  const nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.set(v.x, v.y / 0.62, v.z).normalize();
    nrm.setXYZ(i, v.x, v.y, v.z);
  }
  nrm.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

export function createGritMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, color: new Color(1, 1, 1) });
  mat.name = 'seam-grit';
  mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uGritLodFar = { value: GRIT_LOD_FAR };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uGritLodFar;').replace(
      '#include <project_vertex>',
      /* glsl */ `
        vec3 gritBase = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float gritLod = 1.0 - smoothstep(uGritLodFar - 4.0, uGritLodFar, distance(gritBase, cameraPosition));
        vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(transformed * gritLod, 1.0);
        gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  mat.customProgramCacheKey = () => 'seam-grit-v1-lod';
  return mat;
}

export function buildGritMesh(spots: GritSpot[], rng: Rng, material: MeshStandardMaterial): { mesh: InstancedMesh; count: number; triangles: number } {
  const geo = buildGritGeometry(rng.fork('grit-geo'));
  const im = new InstancedMesh(geo, material, Math.max(1, spots.length));
  const m = new Matrix4();
  const p = new Vector3();
  const q = new Quaternion();
  const sc = new Vector3();
  const axis = new Vector3();
  const c = new Color();
  spots.forEach((s, i) => {
    // the pebble sits in the dirt: its centre a little below the fill so only the crown shows
    p.set(s.x, s.y - s.size * 0.12, s.z);
    axis.set(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)).normalize();
    q.setFromAxisAngle(axis, rng.range(0, Math.PI * 2));
    sc.set(s.size * rng.range(0.8, 1.25), s.size * rng.range(0.7, 1.05), s.size * rng.range(0.8, 1.25));
    im.setMatrixAt(i, m.compose(p, q, sc));
    // grey-beige stone (linear albedo 0.26–0.5 ≈ sRGB 0.55–0.75, the sheet's pale grit), a
    // fifth of them darker; the odd warmer one
    const l = rng.chance(0.2) ? rng.range(0.13, 0.22) : rng.range(0.26, 0.5);
    const w = rng.range(-0.04, 0.08);
    c.setRGB(l * (1 + w), l, l * (1 - w * 1.4));
    im.setColorAt(i, c);
  });
  if (!spots.length) im.count = 0;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = false;
  im.receiveShadow = true;
  im.name = 'seam-grit';
  im.computeBoundingSphere();
  return { mesh: im, count: spots.length, triangles: (geo.attributes.position.count / 3) * spots.length };
}
