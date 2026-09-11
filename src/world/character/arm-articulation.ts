/** Original continuous Link skin across the existing two-joint arm. */
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Mesh, Quaternion, Vector3 } from 'three';
import type { Rig } from './rig';

/** Set up once after body construction; all deformation follows the existing elbow rotation. */
export function createArmArticulation(rig: Rig): () => void {
  const updates: (() => void)[] = [];
  for (const [shoulder, elbow] of [[rig.shoulderL, rig.elbowL], [rig.shoulderR, rig.elbowR]]) {
    const oldUpper = shoulder.getObjectByName('upper-arm') as Mesh;
    const oldElbow = elbow.getObjectByName('elbow') as Mesh;
    const oldForearm = elbow.getObjectByName('forearm') as Mesh;
    if (!oldUpper?.isMesh || !oldElbow?.isMesh || !oldForearm?.isMesh) throw new Error('Continuous arm requires the original Link skin parts');
    const upper = rig.props.upperArm, lower = rig.props.forearm - .02;
    const radial = 32, rows = 32, rowSize = radial + 1, length = upper + lower;
    const elbowRadius = .038;
    const upperSlope = (elbowRadius - .045) / upper, lowerSlope = (.033 - elbowRadius) / lower;
    const rest: { point: Vector3; theta: Vector3; along: Vector3; weight: number; derivative: number; cap: number }[] = [];
    const uv: number[] = [], indices: number[] = [];
    // Spread the bend over160mm: a100mm blend pinches the inner run elbow into a near-cusp.
    const blendLength = .16;
    const sample = (distance: number) => {
      const u = Math.max(0, Math.min(1, (distance - upper + blendLength / 2) / blendLength));
      const weight = u * u * (3 - 2 * u), derivative = u > 0 && u < 1 ? 6 * u * (1 - u) / blendLength : 0;
      const ru = .045 + upperSlope * distance, rl = elbowRadius + lowerSlope * (distance - upper);
      return { weight, derivative, radius: ru * (1 - weight) + rl * weight,
        slope: upperSlope * (1 - weight) + lowerSlope * weight + derivative * (rl - ru) };
    };
    for (let row = 0; row <= rows; row++) {
      const distance = length * row / rows, s = sample(distance);
      for (let j = 0; j <= radial; j++) {
        const angle = (j % radial) / radial * Math.PI * 2, ca = Math.cos(angle), sa = Math.sin(angle);
        rest.push({ point: new Vector3(s.radius * ca, -distance, s.radius * sa),
          theta: new Vector3(-s.radius * sa, 0, s.radius * ca),
          along: new Vector3(s.slope * ca, -1, s.slope * sa),
          weight: s.weight, derivative: s.derivative, cap: 0 });
        uv.push(j / radial, distance / length);
        if (row < rows && j < radial) {
          const a = row * rowSize + j, b = a + rowSize;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    for (const end of [0, 1]) {
      const start = rest.length, source = end * rows * rowSize;
      for (let j = 0; j <= radial; j++) {
        const s = rest[source + j]; rest.push({ ...s, point: s.point.clone(), cap: end ? -1 : 1 });
        uv.push(j / radial, end);
      }
      const centre = rest.length;
      rest.push({ point: new Vector3(0, -end * length, 0), theta: new Vector3(), along: new Vector3(), weight: end, derivative: 0, cap: end ? -1 : 1 });
      uv.push(.5, end);
      for (let j = 0; j < radial; j++) indices.push(...(end ? [start + j, start + j + 1, centre] : [start + j + 1, start + j, centre]));
    }
    const geometry = new BufferGeometry();
    const positions = new Float32BufferAttribute(new Float32Array(rest.length * 3), 3).setUsage(DynamicDrawUsage);
    const normals = new Float32BufferAttribute(new Float32Array(rest.length * 3), 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', positions); geometry.setAttribute('normal', normals);
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
    geometry.name = 'link-continuous-arm-skin';
    const skin = new Mesh(geometry, oldUpper.material);
    skin.name = 'arm-skin'; skin.castShadow = oldUpper.castShadow; skin.receiveShadow = oldUpper.receiveShadow;
    skin.userData.dynamicLinkArm = true;
    shoulder.add(skin);
    for (const original of [oldUpper, oldElbow, oldForearm]) { original.removeFromParent(); original.geometry.dispose(); }
    const q = new Quaternion(), last = new Quaternion(); let initial = true;
    const moved = new Vector3(), value = new Vector3(), theta = new Vector3(), along = new Vector3(), normal = new Vector3();
    const update = () => {
      q.copy(elbow.quaternion);
      if (!initial && q.equals(last)) return;
      initial = false; last.copy(q);
      for (let i = 0; i < rest.length; i++) {
        const s = rest[i];
        moved.copy(s.point); moved.y += upper; moved.applyQuaternion(q).add(elbow.position);
        value.copy(s.point).lerp(moved, s.weight);
        if (s.cap) { normal.set(0, s.cap, 0); if (s.weight) normal.applyQuaternion(q); }
        else {
          theta.copy(s.theta).applyQuaternion(q).multiplyScalar(s.weight).addScaledVector(s.theta, 1 - s.weight);
          along.copy(s.along).applyQuaternion(q).multiplyScalar(s.weight).addScaledVector(s.along, 1 - s.weight)
            .addScaledVector(moved.sub(s.point), s.derivative);
          normal.crossVectors(theta, along).normalize();
        }
        positions.setXYZ(i, value.x, value.y, value.z); normals.setXYZ(i, normal.x, normal.y, normal.z);
      }
      positions.needsUpdate = normals.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    };
    updates.push(update); update();
  }
  rig.root.userData.linkContinuousArms = true;
  return () => { for (const update of updates) update(); };
}
