/** Actual game renderer evidence, driven by live player inputs. Run after npm run build. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser } from './lib/browser.mjs';

const out = path.join(ROOT, 'gauntlet/out/astra-character');
fs.mkdirSync(out, { recursive: true });
const server = await serveStatic(path.join(ROOT, 'dist'));
let browser;
const errors = [], captures = [];
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
async function captureCanvas(page, label) {
  // SwiftShader can expose a cleared buffer immediately after changing cameras.
  // Re-render the exact same state, like the main capture harness; never accept
  // a uniform frame or advance simulation time to get a different pose.
  const canvas = await page.$('canvas');
  for (let attempt = 0; attempt <= 3; attempt++) {
    const png = Buffer.from(await canvas.screenshot({ type: 'png' }));
    const stats = await sharp(png).stats();
    if (Math.max(...stats.channels.slice(0, 3).map(x => x.stdev)) > 2) return { png, retries: attempt };
    assert.ok(attempt < 3, `${label}: blank renderer capture after 3 retries`);
    console.log(`${label}: blank buffer; re-rendering unchanged state (${attempt + 1}/3)`);
    await page.evaluate(() => window.__ZR__.render(2, 0));
  }
}
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${server.url}/?capture=1&motion=1&hud=0&dev=0`, { waitUntil: 'load', timeout: 900000 });
  await page.waitForFunction(() => !!window.__ZR__ && !!window.__ZR_PLAYER__, { timeout: 900000 });
  await page.evaluate(() => window.__ZR__.ready());
  const cases = [
    { name: '01-idle', seconds: 0.5, run: false, move: 0, jump: false },
    { name: '02-walk', seconds: 0.9, run: false, move: 1, jump: false },
    { name: '03-run', seconds: 0.7, run: true, move: 1, jump: false },
    { name: '04-jump', seconds: 0.30, run: false, move: 0, jump: true },
    { name: '05-outfit-back', seconds: 0.5, run: false, move: 0, jump: false, view: 'back' },
    { name: '06-face-detail', seconds: 0.5, run: false, move: 0, jump: false, view: 'face' },
    { name: '07-leaf-lantern', seconds: 0.5, run: false, move: 0, jump: false, view: 'lantern' },
    { name: '08-carved-sign', seconds: 0.5, run: false, move: 0, jump: false, view: 'sign' },
    { name: '09-boot-detail', seconds: 0.5, run: false, move: 0, jump: false, view: 'boots' },
    // Walk into the scene so the spawn-position cap/fairy do not fill this saved camera.
    { name: '10-tree-house', seconds: 1.5, run: false, move: 1, jump: false, viewpoint: 'B_house' },
    { name: '11-stone-stairway', seconds: 0.5, run: false, move: 0, jump: false, viewpoint: 'F_canopy' },
    { name: '12-face-profile', seconds: 0.5, run: false, move: 0, jump: false, view: 'profile' },
    { name: '13-backpack-detail', seconds: 0.5, run: false, move: 0, jump: false, view: 'pack' },
    { name: '14-belt-detail', seconds: 0.5, run: false, move: 0, jump: false, view: 'belt' },
  ];
  for (const c of cases) {
    const state = await page.evaluate(async c => {
      const api = window.__ZR__, player = window.__ZR_PLAYER__;
      player.reset(); api.setTime(12.5);
      player.input({ moveX: 0, moveZ: -c.move, run: c.run, jump: c.jump });
      player.advance(c.seconds);
      const character = api.audit().systems.character;
      const s = character.locomotion;
      const yaw = s.yaw + (c.jump ? 0.8 : 0.3);
      const floor = s.y - (c.jump ? 0.765 : 0);
      const distance = c.jump ? 3.5 : 2.8;
      api.setPose([s.x + Math.sin(yaw) * distance, floor + (c.jump ? 1.5 : 1.28), s.z + Math.cos(yaw) * distance], [s.x, floor + (c.jump ? 1.03 : 0.70), s.z], c.jump ? 42 : 39);
      if (c.view === 'back') {
        const back = s.yaw + Math.PI + 0.25;
        api.setPose([s.x + Math.sin(back) * 2.5, floor + 1.20, s.z + Math.cos(back) * 2.5], [s.x, floor + 0.72, s.z], 39);
      } else if (c.view === 'face') {
        api.setPose([s.x + Math.sin(s.yaw + 0.18) * 1.0, floor + 1.13, s.z + Math.cos(s.yaw + 0.18) * 1.0], [s.x, floor + 1.02, s.z], 32);
      } else if (c.view === 'profile') {
        api.setPose([s.x + Math.sin(s.yaw + 1.20) * 1.15, floor + 1.14,
          s.z + Math.cos(s.yaw + 1.20) * 1.15], [s.x, floor + 1.015, s.z], 32);
      } else if (c.view === 'boots') {
        const front = s.yaw + 0.38;
        api.setPose([s.x + Math.sin(front) * 0.9, floor + 0.30, s.z + Math.cos(front) * 0.9], [s.x, floor + 0.16, s.z], 30);
      } else if (c.view === 'pack') {
        const back = s.yaw + Math.PI + 0.25;
        api.setPose([s.x + Math.sin(back) * 0.90, floor + 0.78, s.z + Math.cos(back) * 0.90], [s.x, floor + 0.64, s.z], 32);
      } else if (c.view === 'belt') {
        const front = s.yaw + 0.18;
        api.setPose([s.x + Math.sin(front) * 0.74, floor + 0.71, s.z + Math.cos(front) * 0.74], [s.x, floor + 0.61, s.z], 32);
      } else if (c.view === 'lantern') {
        const [x, y, z] = api.audit().layout.lanternBranch.mid;
        // Mid-span pod: existing limb radius, cord length and pod offset from its builder.
        const podY = y - 0.29 * 0.9 - 1.2 - 0.2;
        api.setPose([x + 1.0, podY + 0.18, z + 1.2], [x, podY + 0.05, z], 35);
      } else if (c.view === 'sign') {
        // Existing Saria sign from layout.ts; probe the actual rendered terrain for its base.
        const x = 7.0, z = -9.3, y = api.probe(x, z).height;
        api.setPose([x - 0.6 * 2.2, y + 1.42, z + 0.8 * 2.2], [x, y + 1.28, z], 36);
      }
      // Auxiliary world evidence uses the existing authored camera; Link remains
      // in play mode, so these images do not substitute for canonical rubric takes.
      if (c.viewpoint && !api.setViewpoint(c.viewpoint)) throw new Error(`Missing progress viewpoint: ${c.viewpoint}`);
      await api.render(2, 0);
      return { character: api.audit().systems.character, camera: api.cameraPose(), stats: api.stats() };
    }, c);
    assert.equal(state.character.mode, 'play');
    const s = state.character.locomotion;
    if (c.jump) { assert.equal(s.grounded, false); assert.equal(s.jumps, 1); }
    else if (c.move) assert.ok(s.speed > (c.run ? 2 : 1), `${c.name}: player failed to move`);
    const { png, retries } = await captureCanvas(page, c.name);
    fs.writeFileSync(path.join(out, `${c.name}.png`), png);
    await sharp(png).jpeg({ quality: 92 }).toFile(path.join(out, `${c.name}.jpg`));
    captures.push({ ...c, ...state, retries, sha256: crypto.createHash('sha256').update(png).digest('hex') });
    console.log(`${c.name}: ${s.speed.toFixed(3)} m/s, grounded=${s.grounded}, phase=${s.phase.toFixed(3)}`);
  }
  // A short continuous renderer clip exposes foot skating and transition pops that
  // isolated poses cannot. Keep it opt-in so ordinary screenshot updates stay light.
  if (process.env.CAPTURE_SEQUENCE === '1') {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    const frames = path.join(out, 'sequence-frames'); fs.mkdirSync(frames, { recursive: true });
    await page.setViewport({ width: 800, height: 450, deviceScaleFactor: 1 });
    await page.evaluate(() => { window.__ZR_PLAYER__.reset(); window.__ZR__.setTime(12.5); });
    const sequence = [];
    for (let i = 0; i < 42; i++) {
      const state = await page.evaluate(async i => {
        const p = window.__ZR_PLAYER__, api = window.__ZR__;
        p.input({ moveX: 0, moveZ: i < 36 ? -1 : 0, run: i >= 12 && i < 36, jump: i >= 24 && i < 36 });
        p.advance(1 / 12);
        const s = api.audit().systems.character.locomotion;
        // Retreat in front of Link: the rear path passes through the hanging
        // pods at jump height and obscures the exact transition being reviewed.
        api.setPose([s.x + 1.2, s.y + 1.65, s.z - 3.6], [s.x, s.y + 0.70, s.z], 46);
        await api.render(1, 0);
        return s;
      }, i);
      const { png, retries } = await captureCanvas(page, `sequence ${i}`);
      fs.writeFileSync(path.join(frames, `${String(i).padStart(3, '0')}.png`), png);
      sequence.push({ ...state, retries });
      if (i % 6 === 0) console.log(`continuous motion frame ${i + 1}/42`);
    }
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', path.join(frames, '%03d.png'), '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'motion.mp4')]);
    fs.writeFileSync(path.join(out, 'sequence.json'), JSON.stringify({ source, fps: 12, view: 'scripted front three-quarter follow view', states: sequence }, null, 2));
    fs.rmSync(frames, { recursive: true });
  }
  assert.deepEqual(errors, [], 'renderer page errors');
} finally {
  fs.writeFileSync(path.join(out, 'motion.json'), JSON.stringify({ source, capturedAt: new Date().toISOString(), captures, errors }, null, 2));
  if (browser) await browser.close();
  await server.close();
}
