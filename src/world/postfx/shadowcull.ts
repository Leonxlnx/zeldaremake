/**
 * Shadow-caster culling against the view frustum swept along the sun (round 38, perf-2).
 *
 * three draws every `castShadow` object inside the sun's orthographic window into the depth map —
 * a 92 m box fitted ahead of the camera (lighting/index.ts), so in a 46° view most of the casters it
 * rasterises stand beside or behind the camera and shade ground nobody sees. A caster can only
 * change a visible pixel if its shadow volume — its bounding sphere swept from the caster along the
 * light's travel direction — reaches the camera frustum: for a frustum plane with outward-pointing
 * inside normal n, a sphere entirely outside the plane (signed distance < −r) that moves along L
 * with n·L ≤ 0 stays outside forever, so one such plane proves the caster irrelevant. The test is
 * conservative: a sphere is inflated by `marginM` so the shadow filter's widest tap (PCSS penumbra
 * 0.45 m + blocker search 0.3 m, shadowfilter.ts) and the god-ray march's samples along rays at the
 * frame's edge still find every occluder they read, and the near plane is not used (the ray march
 * samples the air in front of it). Objects without a bounding sphere, or with `frustumCulled` off,
 * keep casting. The image is unchanged by construction — the six fixed captures are byte-identical
 * — while the shadow pass draws only the casters whose shadows are in frame.
 */
import { Frustum, Matrix4, Object3D, Plane, Sphere, Vector3, type Camera, type InstancedMesh, type Mesh } from 'three';

const _sphere = new Sphere();
const _proj = new Matrix4();
const _frustum = new Frustum();
const _light = new Vector3();

/** the planes to test: right, left, bottom, top, far — never the near plane (index 5) */
const PLANES = [0, 1, 2, 3, 4];

/**
 * true when a sphere swept from `sphere` along `light` (unit; the direction the light travels)
 * cannot reach the frustum — i.e. no shadow it casts lands on anything in view.
 */
export function sweptSphereMissesFrustum(sphere: Sphere, light: Vector3, planes: readonly Plane[]): boolean {
  for (const i of PLANES) {
    const p = planes[i];
    if (!p) continue;
    if (p.distanceToPoint(sphere.center) < -sphere.radius && p.normal.dot(light) <= 0) return true;
  }
  return false;
}

/** the object's world-space bounding sphere the way three's frustum test builds it, or null */
function worldSphere(obj: Object3D, target: Sphere): Sphere | null {
  const m = obj as Mesh & { boundingSphere?: Sphere | null; computeBoundingSphere?: () => void };
  if (m.boundingSphere !== undefined) {
    if (m.boundingSphere === null) (m as InstancedMesh).computeBoundingSphere();
    if (!m.boundingSphere) return null;
    return target.copy(m.boundingSphere).applyMatrix4(obj.matrixWorld);
  }
  const g = m.geometry;
  if (!g) return null;
  if (g.boundingSphere === null) g.computeBoundingSphere();
  if (!g.boundingSphere) return null;
  return target.copy(g.boundingSphere).applyMatrix4(obj.matrixWorld);
}

export interface ShadowCullStats {
  /** casters examined (visible, castShadow, frustumCulled, with a sphere) */
  tested: number;
  /** casters switched off for the frame */
  culled: number;
}

/**
 * Switch off `castShadow` on every caster whose swept sphere misses the camera frustum; call the
 * returned function after the render to restore them. `sunDirection` points toward the sun.
 */
export function cullShadowCasters(root: Object3D, camera: Camera, sunDirection: Vector3, marginM: number, stats?: ShadowCullStats): () => void {
  const light = _light.copy(sunDirection).multiplyScalar(-1).normalize();
  camera.updateMatrixWorld();
  _proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_proj, camera.coordinateSystem, camera.reversedDepth);
  const planes = _frustum.planes;
  const off: Object3D[] = [];
  let tested = 0;
  root.traverseVisible((obj) => {
    const m = obj as Mesh;
    if (!m.castShadow || !(m.isMesh || (m as unknown as { isPoints?: boolean }).isPoints || (m as unknown as { isLine?: boolean }).isLine)) return;
    if (!m.frustumCulled) return;
    const s = worldSphere(m, _sphere);
    if (!s) return;
    tested++;
    s.radius += marginM;
    if (sweptSphereMissesFrustum(s, light, planes)) {
      m.castShadow = false;
      off.push(m);
    }
  });
  if (stats) {
    stats.tested = tested;
    stats.culled = off.length;
  }
  return () => {
    for (const o of off) o.castShadow = true;
  };
}
