// Grid-search shoulder / elbow Euler angles (three's XYZ, the rig's own chain) that put a Kokiri hand
// at a target, for three idle arm styles. Model space: the kid faces +z, her right side is −x.
import { Object3D, Vector3 } from 'three';
const P = { hipY: 0.485, hipHalfWidth: 0.06, chestY: 0.615, shoulderY: 0.8, shoulderHalfWidth: 0.125, upperArm: 0.155, forearm: 0.14 };
const root = new Object3D();
const chest = new Object3D(); chest.position.set(0, P.chestY, 0); root.add(chest);
const mk = (side) => { const sh = new Object3D(); sh.position.set(side * P.shoulderHalfWidth, P.shoulderY - P.chestY, 0); chest.add(sh); const el = new Object3D(); el.position.set(0, -P.upperArm, 0); sh.add(el); return { sh, el }; };
const arms = { 1: mk(1), [-1]: mk(-1) };
const hand = new Vector3(), elbowP = new Vector3();
function solve(side, target, opts = {}) {
  const { sh, el } = arms[side];
  let best = null;
  for (let sx = -1.6; sx <= 1.2; sx += 0.05) for (let sy = -1.6; sy <= 1.6; sy += 0.1) for (let sz = -1.4; sz <= 1.4; sz += 0.05) for (let ex = -2.5; ex <= 0; ex += 0.05) {
    sh.rotation.set(sx, sy, sz); el.rotation.set(ex, 0, 0);
    root.updateMatrixWorld(true);
    hand.set(0, -P.forearm - 0.02, 0.005); el.localToWorld(hand);
    elbowP.set(0, 0, 0); el.localToWorld(elbowP);
    // the arm must not pass through the torso: elbow outside the chest's box, hand not inside the torso
    const torsoR = 0.095;
    const inTorso = (p) => Math.abs(p.x) < torsoR && p.z > -0.075 && p.z < 0.055 && p.y > P.hipY - 0.05 && p.y < P.shoulderY + 0.02;
    if (inTorso(hand) && !opts.allowHandNearTorso) continue;
    if (inTorso(elbowP)) continue;
    const d = hand.distanceTo(target);
    const cost = d + 0.02 * Math.abs(sy) + 0.01 * Math.abs(sz) + (opts.cost ? opts.cost(sh.rotation, el.rotation, hand, elbowP) : 0);
    if (!best || cost < best.cost) best = { cost, d, sx, sy, sz, ex, hand: hand.toArray().map((v) => +v.toFixed(3)), elbow: elbowP.toArray().map((v) => +v.toFixed(3)) };
  }
  return best;
}
const styles = {
  // hands clasped at the lower back: each hand a little across the midline behind the lumbar
  behind: (side) => new Vector3(-side * 0.03, P.hipY + 0.08, -0.085),
  // hands on the hips: on the hip's side, thumbs back, elbows out
  akimbo: (side) => new Vector3(side * (P.hipHalfWidth + 0.055), P.hipY + 0.05, 0.03),
  // arms folded across the chest: each hand on the other upper arm, the right forearm over the left
  crossed: (side) => new Vector3(-side * 0.10, P.shoulderY - 0.13 - (side > 0 ? 0.03 : 0), side > 0 ? 0.105 : 0.14),
};
for (const [name, target] of Object.entries(styles)) {
  for (const side of [1, -1]) {
    const t = target(side);
    const b = solve(side, t, { allowHandNearTorso: name !== 'behind' ? false : false, cost: name === 'akimbo' ? (s) => (s.z * side < 0.4 ? 0.05 : 0) : name === 'behind' ? (s, e, h, el) => (s.x < 0 ? 0.05 : 0) + (Math.abs(el.x) < 0.13 ? 0.06 : 0) : (s, e, h, el) => (el.z < 0.06 ? 0.04 : 0) });
    console.log(`${name.padEnd(7)} side ${side > 0 ? 'L' : 'R'}: sh (${b.sx.toFixed(2)}, ${b.sy.toFixed(2)}, ${b.sz.toFixed(2)}) el ${b.ex.toFixed(2)}  hand ${JSON.stringify(b.hand)} (target ${t.toArray().map((v) => v.toFixed(3)).join(',')}, miss ${(b.d * 100).toFixed(1)} cm) elbow ${JSON.stringify(b.elbow)}`);
  }
}
