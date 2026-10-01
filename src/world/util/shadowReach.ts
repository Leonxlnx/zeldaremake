import { Camera, Frustum, Matrix4, Object3D, Sphere, Vector3 } from 'three';

/**
 * Does a caster's shade reach the frame? Lifted out of `trees/index.ts` (2026-09-27, lane 2) because
 * the same question is worth asking of every system that casts: `sceneshade/` measured structures
 * spending 719 K depth triangles for 0.49 % of camera A's pixels and terrain 317 K for 0.08 %, while
 * the trees' 1.20 M buys 55 % — a caster whose shadow volume never enters the view frustum is pure
 * cost, and dropping it cannot move a pixel.
 *
 * The test bounds the shadow volume with a capsule — the caster's padded sphere swept down-sun — and
 * rejects only when the whole bound lies outside the frustum. Three things make that bound tight
 * enough to fire often:
 *
 *  • the sweep ends where the GROUND stops it (`groundAt`), not at a world floor constant: the world's
 *    lowest ground is −9.6 m while most of it is 1–26 m, so a capsule swept to a constant runs tens of
 *    metres past anywhere its caster could shade;
 *  • the capsule is WALKED with covering spheres, because the plane test alone only rejects a capsule
 *    that lies outside one single plane and a sweep that slips past a frustum corner is outside none;
 *  • a caster whose own sphere meets the frustum answers itself, so the march and the walk are only
 *    paid off screen.
 *
 * Coarse sampling can only make the bound larger, never smaller, so the result stays conservative:
 * every frame is identical to the untrimmed one, and what changes is the triangle count.
 */
export interface ShadowReach {
  /** call once per frame, before `reaches`: the camera whose frame matters and the sun direction */
  prepare(camera: Camera, sunUp: Vector3): void;
  /** the sphere's shadow volume meets the prepared frustum (padded spheres in, world space) */
  reaches(sphere: Sphere): boolean;
  /**
   * Arm every mesh under `root` from what its build armed (`userData.staticCasts`, recorded on the
   * first pass) and leave casting only where the shade reaches the frame. Returns how many of the
   * meshes it looked at still cast, so a caller can audit it.
   */
  cull(root: Object3D): { casters: number; casting: number };
}

export interface ShadowReachOptions {
  /** ground height under (x, z): the sweep ends where this stops it */
  groundAt: (x: number, z: number) => number;
  /** lowest world height a receiver can have — the outer bound when the ground never stops the sweep */
  floorY: number;
  /** metres added to a caster's sphere for wind sway and the shadow filter's reach */
  padM?: number;
  /** steps the sweep marches against the ground (6 is what the trees use) */
  steps?: number;
}

export function createShadowReach({ groundAt, floorY, padM = 4, steps = 6 }: ShadowReachOptions): ShadowReach {
  const frustum = new Frustum();
  const viewProj = new Matrix4();
  const sun = new Vector3(0, 1, 0);
  const marchAt = new Vector3();
  const marchSphere = new Sphere();
  const shadowEnd = new Vector3();
  const worldSphere = new Sphere();

  const reaches = (s: Sphere) => {
    // a caster whose own sphere meets the frame is its own answer — the capsule starts there
    if (frustum.intersectsSphere(s)) return true;
    const fall = Math.max(0.05, sun.y);
    const full = Math.max(0, (s.center.y + s.radius - floorY) / fall);
    let span = full;
    const step = full / steps;
    for (let k = 1; k <= steps; k++) {
      const t = step * k;
      marchAt.copy(s.center).addScaledVector(sun, -t);
      if (marchAt.y + s.radius <= groundAt(marchAt.x, marchAt.z)) {
        span = t;
        break;
      }
    }
    shadowEnd.copy(s.center).addScaledVector(sun, -span);
    for (const plane of frustum.planes) {
      if (plane.distanceToPoint(s.center) < -s.radius && plane.distanceToPoint(shadowEnd) < -s.radius) return false;
    }
    const stepM = Math.max(2 * s.radius, 2);
    const n = Math.max(1, Math.ceil(span / stepM));
    const d = span / n;
    marchSphere.radius = s.radius + d / 2;
    for (let k = 0; k <= n; k++) {
      marchSphere.center.copy(s.center).addScaledVector(sun, -d * k);
      if (frustum.intersectsSphere(marchSphere)) return true;
    }
    return false;
  };

  return {
    prepare(camera, sunUp) {
      camera.updateMatrixWorld();
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(viewProj);
      if (sunUp.lengthSq() > 1e-6) sun.copy(sunUp).normalize();
    },
    reaches,
    cull(root) {
      let casters = 0;
      let casting = 0;
      root.traverse((o) => {
        const mesh = o as Object3D & { isMesh?: boolean; castShadow: boolean; geometry?: { boundingSphere: Sphere | null; computeBoundingSphere(): void } };
        if (!mesh.isMesh || !mesh.visible) return;
        const armed = mesh.userData.staticCasts;
        if (armed === undefined) {
          mesh.userData.staticCasts = mesh.castShadow;
          if (!mesh.castShadow) return;
        } else if (armed !== true) return;
        casters++;
        const g = mesh.geometry;
        if (!g) return;
        if (!g.boundingSphere) g.computeBoundingSphere();
        if (!g.boundingSphere) return;
        mesh.updateMatrixWorld();
        worldSphere.copy(g.boundingSphere).applyMatrix4(mesh.matrixWorld);
        worldSphere.radius += padM;
        mesh.castShadow = reaches(worldSphere);
        if (mesh.castShadow) casting++;
      });
      return { casters, casting };
    },
  };
}
