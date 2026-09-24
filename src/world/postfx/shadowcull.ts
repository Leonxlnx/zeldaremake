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
 *
 * An optional `ShadowDistanceRule` also switches off small casters far from the camera — a shadow
 * distance by caster size, which does change the image; the composer passes one only where a
 * locality asks for it (util/farBankLocality.ts). `hideSmallFar` is the same idea for drawing: a
 * draw distance by size, for the frame, again only where a locality asks for it.
 */
import { Frustum, Matrix4, Object3D, Plane, Sphere, Vector3, type Camera, type InstancedMesh, type Mesh } from 'three';

const _sphere = new Sphere();
const _proj = new Matrix4();
const _frustum = new Frustum();
const _light = new Vector3();
const _eye = new Vector3();

/**
 * Casters whose world bounding sphere (before the margin) has a radius of at most `maxRadiusM` and
 * lies farther than `minDistanceM` from the camera (centre distance minus radius) cast nothing.
 */
export interface ShadowDistanceRule {
  maxRadiusM: number;
  minDistanceM: number;
}

/**
 * Drawables whose world bounding sphere has a radius of at most `maxRadiusM` and lies farther than
 * `minDistanceM` from the camera are not drawn. An instanced mesh counts by its whole batch.
 */
export interface DrawDistanceRule {
  maxRadiusM: number;
  minDistanceM: number;
}

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
  /** of `culled`, those the distance rule switched off (0 without one) */
  small?: number;
}

/**
 * Switch off `castShadow` on every caster whose swept sphere misses the camera frustum, and with a
 * `rule` on every small caster beyond its distance; call the returned function after the render to
 * restore them. `sunDirection` points toward the sun.
 */
export function cullShadowCasters(root: Object3D, camera: Camera, sunDirection: Vector3, marginM: number, stats?: ShadowCullStats, rule?: ShadowDistanceRule): () => void {
  const light = _light.copy(sunDirection).multiplyScalar(-1).normalize();
  camera.updateMatrixWorld();
  _proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_proj, camera.coordinateSystem, camera.reversedDepth);
  _eye.setFromMatrixPosition(camera.matrixWorld);
  const planes = _frustum.planes;
  const off: Object3D[] = [];
  let tested = 0;
  let small = 0;
  root.traverseVisible((obj) => {
    const m = obj as Mesh;
    if (!m.castShadow || !(m.isMesh || (m as unknown as { isPoints?: boolean }).isPoints || (m as unknown as { isLine?: boolean }).isLine)) return;
    if (!m.frustumCulled) return;
    const s = worldSphere(m, _sphere);
    if (!s) return;
    tested++;
    if (rule && s.radius <= rule.maxRadiusM && s.center.distanceTo(_eye) - s.radius > rule.minDistanceM) {
      m.castShadow = false;
      off.push(m);
      small++;
      return;
    }
    s.radius += marginM;
    if (sweptSphereMissesFrustum(s, light, planes)) {
      m.castShadow = false;
      off.push(m);
    }
  });
  if (stats) {
    stats.tested = tested;
    stats.culled = off.length;
    stats.small = small;
  }
  return () => {
    for (const o of off) o.castShadow = true;
  };
}

export interface DrawDistanceStats {
  /** drawables examined (visible leaf meshes, points, lines and sprites, frustum-culled, with a sphere) */
  tested: number;
  /** drawables hidden for the frame */
  hidden: number;
}

/**
 * Hide every visible leaf drawable (mesh, points, line or sprite without children, frustum-culled)
 * that `rule` finds small and far; call the returned function after the render to show them again.
 * Run it before `cullShadowCasters`: a hidden object neither draws nor casts.
 */
export function hideSmallFar(root: Object3D, camera: Camera, rule: DrawDistanceRule, stats?: DrawDistanceStats): () => void {
  camera.updateMatrixWorld();
  _eye.setFromMatrixPosition(camera.matrixWorld);
  const off: Object3D[] = [];
  let tested = 0;
  root.traverseVisible((obj) => {
    const o = obj as Mesh & { isPoints?: boolean; isLine?: boolean; isSprite?: boolean };
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.frustumCulled || o.children.length > 0) return;
    const s = worldSphere(o, _sphere);
    if (!s) return;
    tested++;
    if (s.radius <= rule.maxRadiusM && s.center.distanceTo(_eye) - s.radius > rule.minDistanceM) off.push(o);
  });
  for (const o of off) o.visible = false;
  if (stats) {
    stats.tested = tested;
    stats.hidden = off.length;
  }
  return () => {
    for (const o of off) o.visible = true;
  };
}
