/** Actual game renderer evidence, driven by live player inputs. Run after npm run build. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser } from '../../../gauntlet/scripts/lib/browser.mjs';

const out = path.join(ROOT, 'gauntlet/out/astra-character');
fs.mkdirSync(out, { recursive: true });
const server = await serveStatic(path.join(ROOT, 'dist'));
let browser;
const errors = [], captures = [];
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
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
      await api.render(2, 0);
      return { character: api.audit().systems.character, camera: api.cameraPose(), stats: api.stats() };
    }, c);
    assert.equal(state.character.mode, 'play');
    const s = state.character.locomotion;
    if (c.jump) { assert.equal(s.grounded, false); assert.equal(s.jumps, 1); }
    else if (c.move) assert.ok(s.speed > (c.run ? 2 : 1), `${c.name}: player failed to move`);
    const canvas = await page.$('canvas');
    const png = Buffer.from(await canvas.screenshot({ type: 'png' }));
    const stats = await sharp(png).stats();
    assert.ok(Math.max(...stats.channels.slice(0, 3).map(x => x.stdev)) > 2, 'blank renderer capture');
    fs.writeFileSync(path.join(out, `${c.name}.png`), png);
    await sharp(png).jpeg({ quality: 92 }).toFile(path.join(out, `${c.name}.jpg`));
    captures.push({ ...c, ...state, sha256: crypto.createHash('sha256').update(png).digest('hex') });
    console.log(`${c.name}: ${s.speed.toFixed(3)} m/s, grounded=${s.grounded}, phase=${s.phase.toFixed(3)}`);
  }
  assert.deepEqual(errors, [], 'renderer page errors');
} finally {
  fs.writeFileSync(path.join(out, 'motion.json'), JSON.stringify({ source, capturedAt: new Date().toISOString(), captures, errors }, null, 2));
  if (browser) await browser.close();
  await server.close();
}
