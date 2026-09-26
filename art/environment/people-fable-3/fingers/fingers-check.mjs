import { CapsuleGeometry, SphereGeometry, Matrix4, Box3, Vector3 } from 'three';
const place = (geo, x, y, z, rot) => { const m = new Matrix4(); if (rot) { geo.applyMatrix4(m.makeRotationX(rot[0])); geo.applyMatrix4(m.makeRotationY(rot[1])); geo.applyMatrix4(m.makeRotationZ(rot[2])); } geo.applyMatrix4(m.makeTranslation(x, y, z)); return geo; };
const FINGERS = [[-0.016, 0.03], [-0.005, 0.034], [0.006, 0.032], [0.017, 0.026]];
const forearm = 0.14, ballY = -forearm - 0.02;
const ball = new SphereGeometry(0.04, 10, 8); ball.applyMatrix4(new Matrix4().makeScale(0.85, 1.15, 0.6)); ball.applyMatrix4(new Matrix4().makeTranslation(0, ballY, 0.005));
const bb = new Box3().setFromBufferAttribute(ball.attributes.position);
console.log('ball y', bb.min.y.toFixed(4), '..', bb.max.y.toFixed(4), 'z', bb.min.z.toFixed(4), '..', bb.max.z.toFixed(4), 'x ±', bb.max.x.toFixed(4));
let tris = 0;
for (const side of [1, -1]) for (const [x, len] of FINGERS) {
  const g = place(new CapsuleGeometry(0.0072, len, 2, 6), side * x, ballY - 0.03 - len / 2, 0.006, [-0.22, 0, (side * x) / 0.017 * 0.07]);
  tris += g.index.count / 3;
  const fb = new Box3().setFromBufferAttribute(g.attributes.position);
  // root = topmost vertex, tip = lowest
  const pos = g.attributes.position; let top = new Vector3(0, -9, 0), tip = new Vector3(0, 9, 0);
  for (let i = 0; i < pos.count; i++) { const v = new Vector3().fromBufferAttribute(pos, i); if (v.y > top.y) top = v; if (v.y < tip.y) tip = v; }
  // inside the ball? ellipsoid test at the root
  const e = ((top.x) / 0.034) ** 2 + ((top.y - ballY) / 0.046) ** 2 + ((top.z - 0.005) / 0.024) ** 2;
  if (side > 0) console.log(`finger x=${x}: root y ${top.y.toFixed(4)} z ${top.z.toFixed(4)} inside-ball ${e < 1 ? 'yes' : 'NO (' + e.toFixed(2) + ')'}; tip y ${tip.y.toFixed(4)} (${((bb.min.y - tip.y) * 100).toFixed(1)} cm below the ball) z ${tip.z.toFixed(4)} x ${tip.x.toFixed(4)}`);
}
console.log('triangles per kid (8 fingers):', tris);
