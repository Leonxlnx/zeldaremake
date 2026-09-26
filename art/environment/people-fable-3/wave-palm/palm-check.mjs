import { Object3D, Vector3 } from 'three';
// the right arm at the wave's mid-swing: shoulder (-2.6, 0, -0.65), elbow (-0.7, twist, 0); the kid faces +z
for (const twist of [0, Math.PI / 2, -Math.PI / 2, 1.2, -1.2]) {
  const root = new Object3D(); const sh = new Object3D(); const el = new Object3D(); root.add(sh); sh.add(el);
  sh.rotation.set(-2.6, 0, -0.65); el.rotation.set(-0.7, twist, 0);
  root.updateMatrixWorld(true);
  const palm = new Vector3(1, 0, 0).transformDirection(el.matrixWorld);  // right hand: the palm (thumb side) is local +x
  const tips = new Vector3(0, -1, 0).transformDirection(el.matrixWorld); // fingers point along local -y
  console.log(`twist ${twist.toFixed(2).padStart(5)}: palm normal → (${palm.toArray().map((v) => v.toFixed(2)).join(', ')})  fingertips → (${tips.toArray().map((v) => v.toFixed(2)).join(', ')})`);
}
