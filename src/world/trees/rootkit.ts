/**
 * Astra's root-base kit prototype (public/models/trees/root-base-a-prototype.glb, see SOURCE.md)
 * fitted onto a procedural bole — the round-39 integration TEST, not a world feature: it builds
 * only when the bundle is made with `VITE_ROOT_KIT=1` (index.ts ROOT_KIT), on the two boles named
 * there, and the trees system reports the fit through its audit.
 *
 * The kit is Y-up, nominal bole radius 1 m, open collar at y 2.365 m, root tips beyond r 1, its
 * ground ring a little below y 0. The adapter maps every vertex through the bole it is put on:
 *
 * - height: local y × the bole's nominal radius R (the kit scales with the bole, so the collar
 *   lands at 2.365 R and a root is as tall relative to the bole as Astra built it);
 * - radius: local r × radiusAt(h) — the kit's unit collar meets the plain sweep's nominal radius
 *   at that height, and a root tip at r 2.4 stays 2.4× the bole (the protrusion is preserved);
 * - gnarl: the plain sweep is not round (giant.ts gnarlBump, ±16 %): the bole part of the kit
 *   (r ≤ 1.05) is corrected per angle to the sweep's actual ring radius (GiantAsset.boleRings),
 *   fading to nominal by r 1.6 so the roots keep their shape. The uncorrected collar fit — what
 *   the kit would do on radiusAt alone — is measured and reported too;
 * - axis: the ring centre follows axisAt(h) (lean);
 * - ground: below 0.7 R the vertex follows the terrain under it (heightfield), fully at the ground
 *   ring, so root tips seat on a slope instead of hovering or drowning; the ring sinks 4 cm.
 *
 * Normals are recomputed after the warp; the GLB's tangents (if any) are dropped so the tangent
 * normal map uses the derivative frame. The kit's own material (baked colour / normal / roughness)
 * is kept as delivered — no wind, no shade floor — so what is judged is Astra's asset.
 */
import { BufferGeometry, Mesh, MeshStandardMaterial, Vector3, type Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ROOT_KIT_URL = 'models/trees/root-base-a-prototype.glb';
/** the kit's collar height and nominal radius (SOURCE.md) */
export const ROOT_KIT_COLLAR_Y = 2.365;

export interface RootKitSource {
  geometry: BufferGeometry;
  material: MeshStandardMaterial;
  triangles: number;
  vertices: number;
  textures: { slot: string; size: string }[];
}

export interface RootKitBole {
  id: string;
  /** nominal bole radius (layout trunkRadius) */
  R: number;
  /** world position of the bole's base */
  origin: Vector3;
  /** nominal bole radius at local height h */
  radiusAt(h: number): number;
  /** local-space axis centre at height h */
  axisAt(h: number, out: Vector3): Vector3;
  /** world terrain height */
  groundAt(x: number, z: number): number;
  /** the plain sweep's rings (local space) */
  boleRings: Vector3[][];
}

export interface RootKitFit {
  mesh: Mesh;
  audit: {
    id: string;
    R: number;
    scaleH: number;
    collarY: number;
    triangles: number;
    /** collar fit against the sweep's actual surface (cm; + = gap outside the bark, − = inside) */
    collar: { mean: number; min: number; max: number; samples: number };
    /** the same for the kit on radiusAt alone (no gnarl correction) */
    collarNominal: { mean: number; min: number; max: number };
    /** root tips: their seat against the terrain (cm; + = above ground) */
    tips: { count: number; meanAbove: number; maxAbove: number; minAbove: number; reach: number };
  };
}

export async function loadRootKit(url: string): Promise<RootKitSource> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let found: Mesh | null = null;
  gltf.scene.traverse((o) => {
    if (!found && (o as Mesh).isMesh) found = o as Mesh;
  });
  if (!found) throw new Error('root kit: no mesh in the GLB');
  const mesh = found as Mesh;
  const geometry = (mesh.geometry as BufferGeometry).clone();
  mesh.updateWorldMatrix(true, false);
  geometry.applyMatrix4(mesh.matrixWorld);
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
  const textures: { slot: string; size: string }[] = [];
  for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'] as const) {
    const t = material[slot] as Texture | null | undefined;
    if (t?.image) textures.push({ slot, size: `${(t.image as { width?: number }).width ?? '?'}×${(t.image as { height?: number }).height ?? '?'}` });
  }
  const count = geometry.index ? geometry.index.count : geometry.getAttribute('position').count;
  return { geometry, material, triangles: count / 3, vertices: geometry.getAttribute('position').count, textures };
}

/** the sweep's actual radius at local height y and world-plane angle a (atan2(z, x) about the ring centre) */
function ringRadius(rings: Vector3[][], y: number, a: number): { r: number; nominalCentre: Vector3 } | null {
  if (!rings.length) return null;
  let lo = 0;
  for (let i = 0; i < rings.length; i++) if (rings[i][0].y <= y) lo = i;
  const hi = Math.min(rings.length - 1, lo + 1);
  const sampleRing = (ring: Vector3[]) => {
    const c = new Vector3();
    for (const p of ring) c.add(p);
    c.multiplyScalar(1 / ring.length);
    // nearest two points by angle
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const pa = Math.atan2(ring[i].z - c.z, ring[i].x - c.x);
      let d = Math.abs(pa - a);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const p = ring[best];
    return { r: Math.hypot(p.x - c.x, p.z - c.z), c };
  };
  const A = sampleRing(rings[lo]);
  const B = sampleRing(rings[hi]);
  const span = rings[hi][0].y - rings[lo][0].y;
  const t = span > 1e-6 ? Math.min(1, Math.max(0, (y - rings[lo][0].y) / span)) : 0;
  return { r: A.r + (B.r - A.r) * t, nominalCentre: A.c.lerp(B.c, t) };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function fitRootKit(src: RootKitSource, bole: RootKitBole): RootKitFit {
  const g = src.geometry.clone();
  if (g.getAttribute('tangent')) g.deleteAttribute('tangent');
  const pos = g.getAttribute('position');
  const scaleH = bole.R;
  const axis = new Vector3();
  const collar = { sum: 0, min: Infinity, max: -Infinity, n: 0 };
  const collarNominal = { sum: 0, min: Infinity, max: -Infinity, n: 0 };
  const tips = { n: 0, sum: 0, max: -Infinity, min: Infinity, reach: 0 };
  const baseGround = bole.groundAt(bole.origin.x, bole.origin.z);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rLocal = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const h = Math.max(0, y) * scaleH;
    const nominal = bole.radiusAt(h);
    const actual = ringRadius(bole.boleRings, h, a);
    // the gnarl correction: full on the bole part, none past r 1.6
    const gnarl = actual ? actual.r / Math.max(1e-3, nominal) : 1;
    const correction = 1 + (gnarl - 1) * (1 - smoothstep(1.05, 1.6, rLocal));
    const rWorld = rLocal * nominal * correction;
    bole.axisAt(h, axis);
    let wx = axis.x + Math.cos(a) * rWorld;
    let wz = axis.z + Math.sin(a) * rWorld;
    // the ground ring and the roots' undersides follow the terrain under them
    const worldGround = bole.groundAt(bole.origin.x + wx, bole.origin.z + wz);
    const follow = 1 - smoothstep(0, 0.7 * bole.R, h);
    let wy = y * scaleH + (worldGround - baseGround) * follow - 0.04 * follow;
    pos.setXYZ(i, wx, wy, wz);
    // the collar: the kit's open top ring (y within 2 cm of 2.365, r ≈ 1)
    if (Math.abs(y - ROOT_KIT_COLLAR_Y) < 0.02 && rLocal > 0.9 && rLocal < 1.1 && actual) {
      const gapCm = (rWorld - actual.r) * 100;
      collar.sum += gapCm;
      collar.min = Math.min(collar.min, gapCm);
      collar.max = Math.max(collar.max, gapCm);
      collar.n++;
      const gapNominalCm = (rLocal * nominal - actual.r) * 100;
      collarNominal.sum += gapNominalCm;
      collarNominal.min = Math.min(collarNominal.min, gapNominalCm);
      collarNominal.max = Math.max(collarNominal.max, gapNominalCm);
      collarNominal.n++;
    }
    // root tips: the outermost 15 % of the kit's reach, near the ground
    if (rLocal > 1.8 && y < 0.35) {
      const aboveCm = (bole.origin.y + wy - worldGround) * 100;
      tips.n++;
      tips.sum += aboveCm;
      tips.max = Math.max(tips.max, aboveCm);
      tips.min = Math.min(tips.min, aboveCm);
      tips.reach = Math.max(tips.reach, rWorld);
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  const mesh = new Mesh(g, src.material);
  mesh.name = `root-kit-${bole.id}`;
  mesh.position.copy(bole.origin);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = 'root-kit';
  mesh.userData.giants = [bole.id];
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    mesh,
    audit: {
      id: bole.id,
      R: bole.R,
      scaleH,
      collarY: round(ROOT_KIT_COLLAR_Y * scaleH * 100) / 100,
      triangles: src.triangles,
      collar: { mean: round(collar.n ? collar.sum / collar.n : 0), min: round(collar.n ? collar.min : 0), max: round(collar.n ? collar.max : 0), samples: collar.n },
      collarNominal: { mean: round(collarNominal.n ? collarNominal.sum / collarNominal.n : 0), min: round(collarNominal.n ? collarNominal.min : 0), max: round(collarNominal.n ? collarNominal.max : 0) },
      tips: { count: tips.n, meanAbove: round(tips.n ? tips.sum / tips.n : 0), maxAbove: round(tips.n ? tips.max : 0), minAbove: round(tips.n ? tips.min : 0), reach: round(tips.reach * 100) / 100 },
    },
  };
}
