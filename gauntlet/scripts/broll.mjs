#!/usr/bin/env node
/**
 * broll.mjs — render B-roll frames of the world through the capture API at any size.
 *
 *   node gauntlet/scripts/broll.mjs --dist dist --out /tmp/broll --size 3840x2160 --fps 12
 *        [--shots gauntlet/broll/teaser.json] [--character] [--hud] [--time 12.5] [--quality high] [--test] [--settle 3]
 *
 * Frames are f0000.png … plus shots.json (fps + per-shot frame counts). Assemble with ffmpeg, e.g.
 *   ffmpeg -framerate 12 -i f%04d.png -vf "minterpolate=fps=24:mi_mode=mci" -c:v libx264 -crf 17 -pix_fmt yuv420p out.mp4
 *
 * The camera path is a list of shots { name, s (seconds), from: {p, t, fov}, to: {p, t, fov} } eased
 * between the two poses; the default path is the owner's teaser (aerial, the lantern pods, the house,
 * the stairs). --character keeps Link/Navi/the Kokiri visible (hidden by default for B-roll); --hud
 * keeps the HUD. --test renders one frame per shot.
 * --check-timing runs the frame-clock regression without Chrome or output files.
 *
 * SwiftShader (this VM) renders a 3840×2160 frame in minutes; on a real GPU (Astra's laptop,
 * Chrome found via CHROME_PATH or the usual install locations) the same frame takes well under a
 * second, so the native route is the practical one for long 4K clips.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic, launchBrowser, openWorld } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/broll');
const fps = Number(args.fps || 12);
const [width, height] = String(args.size || '1280x720').split('x').map(Number);
const quality = typeof args.quality === 'string' ? args.quality : 'high';
const simTime = Number(args.time ?? 12.5);
const test = !!args.test;
const keepCharacter = !!args.character;
const keepHud = !!args.hud;
/** frames rendered at a shot's first pose before its screenshot (on-demand LOD pools build in ~3 ms chunks per frame; 3 is the old default) */
const settle = Math.max(1, Number(args.settle ?? 3));
if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) throw new Error(`bad --size ${args.size}`);
if (!Number.isFinite(fps) || fps <= 0) throw new Error(`bad --fps ${args.fps}`);

/** the owner's teaser path (world metres; poses = camera p, target t, vertical fov) */
export const TEASER_SHOTS = [
  { name: 'aerial', s: 2.2, from: { p: [2.5, 5.8, 9.5], t: [7, 2.5, -8], fov: 50 }, to: { p: [0.5, 5.2, 4.5], t: [8, 2.6, -9.5], fov: 50 } },
  { name: 'pods', s: 2.4, from: { p: [2.1, 2.15, 3.2], t: [0.55, 1.95, 1.55], fov: 34 }, to: { p: [1.5, 1.95, 2.85], t: [0.7, 1.92, 1.5], fov: 34 } },
  { name: 'house', s: 1.8, from: { p: [3.2, 2.2, -3.5], t: [11.8, 3.6, -11], fov: 42 }, to: { p: [5.2, 2.5, -5.2], t: [12.2, 4.2, -11.5], fov: 42 } },
  { name: 'stairs', s: 1.8, from: { p: [2.8, 1.9, 2.6], t: [12, 3.4, -4], fov: 44 }, to: { p: [5.4, 2.1, 0.6], t: [14, 5, -5.6], fov: 44 } },
];
const shots = typeof args.shots === 'string' ? JSON.parse(fs.readFileSync(path.resolve(args.shots), 'utf8')) : TEASER_SHOTS;

/** Find the world hooks (scene + step) captured in the capture API's closure, to hide the character group. */
async function grabHooks(page) {
  const client = await page.createCDPSession();
  try {
    const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
    const objectId = ev.result?.objectId;
    if (!objectId) return false;
    const { internalProperties } = await client.send('Runtime.getProperties', { objectId, ownProperties: true });
    const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]');
    if (!scopes?.value?.objectId) return false;
    const { result: scopeList } = await client.send('Runtime.getProperties', { objectId: scopes.value.objectId, ownProperties: true });
    for (const s of scopeList) {
      if (!s.value?.objectId) continue;
      const { result: vars } = await client.send('Runtime.getProperties', { objectId: s.value.objectId, ownProperties: true });
      for (const v of vars) {
        if (v.value?.type !== 'object' || !v.value.objectId) continue;
        const r = await client.send('Runtime.callFunctionOn', {
          objectId: v.value.objectId,
          functionDeclaration: 'function(){ if (this && this.scene && this.scene.isScene && typeof this.step === "function") { window.__H = this; return true; } return false; }',
          returnByValue: true,
        });
        if (r.result?.value === true) return true;
      }
    }
    return false;
  } finally {
    await client.detach();
  }
}

/** true when the PNG's central world box has (almost) no variance — a frame that was not drawn */
async function isUniform(png) {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(png).metadata();
  const box = { left: Math.floor(meta.width * 0.15), top: Math.floor(meta.height * 0.15), width: Math.floor(meta.width * 0.7), height: Math.floor(meta.height * 0.7) };
  const st = await sharp(png).extract(box).greyscale().stats();
  return st.channels[0].stdev < 2;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const ease = (t) => t * t * (3 - 2 * t);

async function captureFrame(page, canvas, warmFrames, dt, name) {
  // Warm LOD pools in bounded batches without consuming unrecorded simulation time.
  for (let left = warmFrames; left > 0; left -= 4) await page.evaluate(async ([n]) => { await window.__ZR__.render(n, 0); }, [Math.min(4, left)]);
  await page.evaluate(async (dt) => { await window.__ZR__.render(1, dt); }, dt);
  let buf = await canvas.screenshot({ type: 'png' });
  let uniform = await isUniform(buf);
  for (let retry = 0; retry < 3 && uniform; retry++) {
    console.error(`broll: uniform frame at ${name} — re-rendering (${retry + 1}/3)`);
    await page.evaluate(async () => { await window.__ZR__.render(2, 0); });
    buf = await canvas.screenshot({ type: 'png' });
    uniform = await isUniform(buf);
  }
  if (uniform) throw new Error(`broll: uniform frame at ${name} after 3 retries`);
  return buf;
}

async function checkTiming() {
  const { default: assert } = await import('node:assert/strict');
  const { runInNewContext } = await import('node:vm');
  const { default: sharp } = await import('sharp');
  const blank = await sharp(Buffer.alloc(256), { raw: { width: 16, height: 16, channels: 1 } }).png().toBuffer();
  const drawn = await sharp(Buffer.from(Array.from({ length: 256 }, (_, i) => i % 2 * 255)), { raw: { width: 16, height: 16, channels: 1 } }).png().toBuffer();
  let time = 12.5;
  const calls = [];
  const window = { __ZR__: { render: async (n, dt) => { calls.push([n, dt]); time += n * dt; } } };
  const page = { evaluate: (fn, arg) => runInNewContext(`(${fn})(arg)`, { window, arg }) };
  for (const [warm, retries] of [[11, 0], [0, 2], [2, 3], [0, 0]]) {
    const before = time, callStart = calls.length;
    const captureTimes = [];
    let screenshots = 0;
    const canvas = { screenshot: async () => { captureTimes.push(time); return screenshots++ < retries ? blank : drawn; } };
    assert.deepEqual(await captureFrame(page, canvas, warm, 1 / 30, 'timing-check'), drawn);
    assert.equal(screenshots, retries + 1);
    assert.deepEqual(captureTimes, Array(retries + 1).fill(before + 1 / 30));
    assert.ok(Math.abs(time - before - 1 / 30) < 1e-12);
    assert.deepEqual(calls.slice(callStart).filter(([, dt]) => dt !== 0), [[1, 1 / 30]]);
    assert.equal(calls.slice(callStart).reduce((sum, [n]) => sum + n, 0), warm + 1 + 2 * retries);
  }
  const before = time, callStart = calls.length;
  let screenshots = 0;
  const canvas = { screenshot: async () => { screenshots++; assert.equal(time, before + 1 / 30); return blank; } };
  await assert.rejects(captureFrame(page, canvas, 11, 1 / 30, 'always-blank'), /uniform frame at always-blank after 3 retries/);
  assert.equal(screenshots, 4);
  assert.deepEqual(calls.slice(callStart).filter(([, dt]) => dt !== 0), [[1, 1 / 30]]);
  assert.ok(Math.abs(time - before - 1 / 30) < 1e-12);
  console.log('broll timing: warm-up/retries preserve each output tick; persistent blank frames fail without extra time');
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  try {
    const { page } = await openWorld(browser, server.url, { width, height, quality, log: console.error });
    if (!keepCharacter && !(await grabHooks(page))) console.error('broll: world hooks not found — the character stays visible');
    await page.evaluate(([keepHud, keepCharacter, simTime]) => {
      if (!keepHud) for (const sel of ['.zr-hud', '.zr-equip']) { const el = document.querySelector(sel); if (el) el.style.display = 'none'; }
      if (!keepCharacter && window.__H) { const ch = window.__H.scene.getObjectByName('character'); if (ch) ch.visible = false; }
      window.__ZR__.setTime(simTime);
    }, [keepHud, keepCharacter, simTime]);
    const canvas = await page.$('canvas');
    let frame = 0;
    const total = test ? shots.length : shots.reduce((a, s) => a + Math.round(s.s * fps), 0);
    const t0 = Date.now();
    for (const shot of shots) {
      const n = test ? 1 : Math.round(shot.s * fps);
      for (let i = 0; i < n; i++) {
        const u = ease(n > 1 ? i / (n - 1) : 0);
        const p = lerp3(shot.from.p, shot.to.p, u), tg = lerp3(shot.from.t, shot.to.t, u), fov = lerp(shot.from.fov, shot.to.fov, u);
        await page.evaluate(([p, tg, fov]) => { window.__ZR__.setPose(p, tg, fov); }, [p, tg, fov]);
        // The last settle render is the output tick; all earlier renders and retries hold time.
        const buf = await captureFrame(page, canvas, i === 0 ? settle - 1 : 0, 1 / fps, shot.name);
        fs.writeFileSync(path.join(out, `f${String(frame).padStart(4, '0')}.png`), buf);
        frame++;
        console.error(`${shot.name} ${i + 1}/${n} — frame ${frame}/${total} — ${((Date.now() - t0) / frame / 1000).toFixed(1)} s/frame`);
      }
    }
    fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ fps, width, height, quality, shots: shots.map((s) => ({ name: s.name, frames: test ? 1 : Math.round(s.s * fps) })) }, null, 2));
    console.error(`done: ${frame} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) (args['check-timing'] ? checkTiming() : main()).catch((e) => { console.error(e); process.exit(1); });
