/**
 * Draws the owner's stair shake before and after, from the real follow camera on both sides.
 *
 *   git show <pre-fix sha>:src/camera/follow.ts > /tmp/before-cam/follow.ts
 *   cp src/camera/collision.ts /tmp/before-cam/collision.ts
 *   node art/environment/owner-2026-09-23/pass5/stair-chart.mjs /opt/cursor/artifacts/stairs.png
 *
 * Two panels — walking up a flight and walking down it — each plotting the camera's vertical
 * speed frame by frame. A camera that glides draws a flat line; one that steps on every tread
 * draws the saw-tooth he is seeing.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = path.resolve(here, '../../../../src/camera');
const WAS = '/tmp/before-cam';

const listeners = () => {
  const map = new Map();
  return { addEventListener: (t, f) => map.set(t, [...(map.get(t) ?? []), f]), removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }), style: {}, ownerDocument: { exitPointerLock() {} }, requestPointerLock() {} };
};
globalThis.window = listeners();
globalThis.document = { pointerLockElement: null };
Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [null] }, configurable: true });

function loadFollow(dir) {
  const modules = new Map();
  const load = (file) => {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} };
    modules.set(file, module);
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', source)(
      (name) => {
        if (name === 'three') return THREE;
        if (name.startsWith('.')) {
          const target = path.resolve(path.dirname(file), name);
          for (const c of [target, target + '.ts', path.join(target, 'index.ts')]) if (c.endsWith('.ts') && existsSync(c)) return load(c);
        }
        throw new Error(`unexpected dependency: ${name}`);
      },
      module,
      module.exports,
    );
    return module.exports;
  };
  return load(path.join(dir, 'follow.ts')).createFollowCam;
}

const TREAD = 0.3;
const RISER = 0.17;
const STEPS = 22;
const groundAt = (x, z) => {
  const u = -z;
  return u <= 0 ? 0 : Math.min(STEPS, Math.floor(u / TREAD)) * RISER;
};

function run(createFollowCam, down) {
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.08, 900);
  const player = { position: new THREE.Vector3(0, 0, 0), heading: () => (down ? 0 : Math.PI), airHeight: () => 0, groundHeight: groundAt, surfaceHeight: groundAt, setInput() {}, setPlayMode() {}, playMode: () => true, place() {} };
  const cam = createFollowCam(listeners(), { height: groundAt }, camera, player, { shared: {} });
  cam.enabled = true;
  const dt = 1 / 60;
  const start = down ? -(STEPS * TREAD) : 0;
  player.position.set(0, groundAt(0, start), start);
  cam.snap();
  const ys = [];
  const pitches = [];
  for (let i = 0; i < 260; i++) {
    const z = start + (down ? 1 : -1) * 3.4 * dt * i;
    player.position.set(0, groundAt(0, z), z);
    cam.update(dt);
    const u = -z;
    if (u < TREAD * 2 || u > (STEPS - 2) * TREAD) continue;
    ys.push(camera.position.y);
    const d = camera.getWorldDirection(new THREE.Vector3());
    pitches.push((Math.asin(d.y) * 180) / Math.PI);
  }
  const ps = pitches;
  return { rate: ys.slice(1).map((v, i) => (v - ys[i]) * 60), pitch: ps.slice(1).map((v, i) => (v - ps[i]) * 60) };
}

const wasCam = loadFollow(WAS);
const nowCam = loadFollow(NOW);
const upWas = run(wasCam, false);
const upNow = run(nowCam, false);
const dnWas = run(wasCam, true);
const dnNow = run(nowCam, true);
const series = [
  { title: 'Walking UP — how fast the camera is rising (m/s)', was: upWas.rate, now: upNow.rate },
  { title: 'Walking UP — how fast the view is tilting (deg/s)', was: upWas.pitch, now: upNow.pitch },
  { title: 'Walking DOWN — how fast the camera is falling (m/s)', was: dnWas.rate, now: dnNow.rate },
  { title: 'Walking DOWN — how fast the view is tilting (deg/s)', was: dnWas.pitch, now: dnNow.pitch },
];

const W = 1180;
const PH = 208;
const PAD = { l: 78, r: 24, t: 76, b: 30 };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const panels = series
  .map((s, pi) => {
    const y0 = PAD.t + pi * (PH + 34);
    const all = [...s.was, ...s.now];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo) * 0.12 || 1;
    const mapY = (v) => y0 + (PH - PAD.t - PAD.b) * (1 - (v - (lo - pad)) / (hi - lo + 2 * pad)) + PAD.t * 0.2;
    const mapX = (i, n) => PAD.l + ((W - PAD.l - PAD.r) * i) / (n - 1);
    const line = (arr, colour, width) => `<polyline fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round" points="${arr.map((v, i) => `${mapX(i, arr.length).toFixed(1)},${mapY(v).toFixed(1)}`).join(' ')}"/>`;
    const zero = mapY(0);
    return `
      <text x="${PAD.l}" y="${y0 + 14}" font-family="Helvetica,Arial" font-size="21" font-weight="600" fill="#e9e9ea">${esc(s.title)}</text>
      <line x1="${PAD.l}" y1="${zero.toFixed(1)}" x2="${W - PAD.r}" y2="${zero.toFixed(1)}" stroke="#4a4a50" stroke-width="1" stroke-dasharray="4 5"/>
      ${line(s.was, '#ff5f56', 2.1)}
      ${line(s.now, '#35d07f', 2.4)}
      <text x="${PAD.l - 10}" y="${zero.toFixed(1)}" text-anchor="end" font-family="Helvetica,Arial" font-size="13" fill="#8a8a92">0</text>
  `;
  })
  .join('');

const H = PAD.t + series.length * (PH + 34) + 26;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#161619"/>
  <text x="${PAD.l}" y="32" font-family="Helvetica,Arial" font-size="24" font-weight="700" fill="#f2f2f4">"It glitches the frames up and forth every each step"</text>
  <text x="${PAD.l}" y="56" font-family="Helvetica,Arial" font-size="16" fill="#a5a5ad">frame by frame down a 22-step flight (0.3 m treads, 0.17 m risers) at run speed</text>
  <rect x="${W - 300}" y="18" width="14" height="14" fill="#ff5f56"/><text x="${W - 278}" y="31" font-family="Helvetica,Arial" font-size="15" fill="#e9e9ea">before — a jolt every tread</text>
  <rect x="${W - 300}" y="40" width="14" height="14" fill="#35d07f"/><text x="${W - 278}" y="53" font-family="Helvetica,Arial" font-size="15" fill="#e9e9ea">after — a glide</text>
  ${panels}
</svg>`;

const out = process.argv[2] ?? '/tmp/stairs.png';
await sharp(Buffer.from(svg)).png().toFile(out);
console.log('wrote', out);
