// Pinhole projection of layout landmarks into broll poses (16:9). usage: node proj.mjs shots.json [which=from|to]
import fs from 'node:fs';
const L = {
  door: [10.3, 2.0, -9.2], houseTop: [12.5, 7.5, -11.5], houseBase: [12.5, 1.05, -11.5], upperHouse: [13.5, 8.5, -17.5],
  stairFoot: [7.3, 0, -0.1], stairMid: [11.56, 2.7, -3.42], stairTop: [15.82, 5.4, -6.74], footPod: [9.3, 2.3, 1.6], forkPod: [-2.6, 2.2, -4.6],
  branchPodL: [-0.6, 1.9, 1.5], branchPodR: [0.8, 1.9, 1.5], sign: [7, 1.8, -9.3], shaftA: [1.3, 6.6, -9.4], shaftB: [-3, 8, -14.5], shaftC: [5, 7, -17],
  shaftStair: [9.6, 6.9, -6.6], lanternTree: [-11.5, 6, -7.2], nwNear: [-6, 5, -12.8], stairBankGiant: [10.6, 5, 9.15], plazaSouth: [4.4, 5, 20.5],
  plateauOak: [19, 10, -21], logArch: [9.75, 6, -54], fenceW: [21.6, 6, -0.6], plaza: [0, 0, 0],
  groveFlight: [0.5, 6.8, -81.6], groveHouse: [-3.9, 12.5, -101.4], groveHouseDoor: [-2.4, 11.2, -99.8], stilt: [12, 13, -91.5], treeHut: [16.8, 12.6, -85.2], ropeMid: [14.4, 11.5, -88.3], nest: [16.8, 16.8, -85.2], shelf: [-0.5, 10, -99.2], groveLantern: [3.55, 12.2, -94.4],
};
const shots = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const which = process.argv[3] || 'from';
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
const sunAz = -128 * Math.PI / 180, sunEl = 38 * Math.PI / 180;
const sun = [Math.sin(sunAz) * Math.cos(sunEl), Math.sin(sunEl), Math.cos(sunAz) * Math.cos(sunEl)];
for (const s of shots) {
  const P = s[which].p, T = s[which].t, fov = s[which].fov;
  const f = norm(sub(T, P)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
  const th = Math.tan(fov * Math.PI / 360), tw = th * 16 / 9;
  const vis = [];
  for (const [k, w] of Object.entries(L)) {
    const d = sub(w, P), z = dot(d, f); if (z <= 0.1) continue;
    const x = 0.5 + dot(d, r) / z / tw / 2, y = 0.5 - dot(d, u) / z / th / 2;
    if (x > -0.05 && x < 1.05 && y > -0.05 && y < 1.05) vis.push(`${k}(${x.toFixed(2)},${y.toFixed(2)} ${z.toFixed(0)}m)`);
  }
  const pitch = Math.asin(f[1]) * 180 / Math.PI;
  console.log(`${s.name}: pitch ${pitch.toFixed(1)} sunAngle ${(Math.acos(dot(f, sun)) * 180 / Math.PI).toFixed(0)}deg\n   ${vis.join(' ')}`);
}
