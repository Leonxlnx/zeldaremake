import { Object3D, Vector3 } from 'three';
const P = { hipY: 0.47, hipHalfWidth: 0.058, chestY: 0.6, shoulderY: 0.77, shoulderHalfWidth: 0.118, upperArm: 0.145, forearm: 0.13 };
const root = new Object3D(); const chest = new Object3D(); chest.position.set(0, P.chestY, 0); root.add(chest);
const mk = (side) => { const sh = new Object3D(); sh.position.set(side * P.shoulderHalfWidth, P.shoulderY - P.chestY, 0); chest.add(sh); const el = new Object3D(); el.position.set(0, -P.upperArm, 0); sh.add(el); return { sh, el }; };
const arms = { 1: mk(1), [-1]: mk(-1) };
const STYLES = { behind: { sh: [0.65, -1.4, 0.2], el: -1.05 }, akimbo: { sh: [0.6, -0.65, 0.45], el: -1.08 } };
for (const [name, st] of Object.entries(STYLES)) {
  const hands = {};
  for (const side of [1, -1]) { const { sh, el } = arms[side]; sh.rotation.set(st.sh[0], side * st.sh[1], side * st.sh[2]); el.rotation.set(st.el, 0, 0); root.updateMatrixWorld(true); const h = new Vector3(0, -P.forearm - 0.02, 0.005); el.localToWorld(h); const e = new Vector3(); el.localToWorld(e); hands[side] = { h: h.toArray().map((v) => +v.toFixed(3)), e: e.toArray().map((v) => +v.toFixed(3)) }; }
  const gap = Math.hypot(...[0, 1, 2].map((i) => hands[1].h[i] - hands[-1].h[i]));
  console.log(name, 'L hand', JSON.stringify(hands[1].h), 'R hand', JSON.stringify(hands[-1].h), 'hands apart', (gap * 100).toFixed(1), 'cm; elbows', JSON.stringify(hands[1].e), JSON.stringify(hands[-1].e));
}
console.log('hip side x for akimbo target: ±', (P.hipHalfWidth + 0.055).toFixed(3), 'at y', (P.hipY + 0.05).toFixed(3), '; lumbar y', (P.hipY + 0.08).toFixed(3), 'back z ≈ -0.075');
