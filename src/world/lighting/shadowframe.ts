import { Matrix4, Vector3 } from 'three';

/** Keep a fixed orthographic shadow map on its own texel lattice as the camera walks.
 * World X/Z rounding does not preserve this lattice when the sun looks diagonally down.
 * The basis matches Three.js LightShadow.updateMatrices / camera.lookAt. Allocate once;
 * the returned operation accepts aliased input/output and allocates nothing per frame.
 */
export function createShadowTargetSnapper(direction: Vector3, cameraUp: Vector3, texelM: number) {
  if (!(texelM > 0 && Number.isFinite(texelM))) throw new Error('Shadow texel size must be positive');
  const basis = new Matrix4().lookAt(direction, new Vector3(), cameraUp);
  const right = new Vector3().setFromMatrixColumn(basis, 0);
  const up = new Vector3().setFromMatrixColumn(basis, 1);
  return (desired: Vector3, out: Vector3): Vector3 => {
    const x = desired.dot(right);
    const y = desired.dot(up);
    return out.copy(desired)
      .addScaledVector(right, Math.round(x / texelM) * texelM - x)
      .addScaledVector(up, Math.round(y / texelM) * texelM - y);
  };
}
