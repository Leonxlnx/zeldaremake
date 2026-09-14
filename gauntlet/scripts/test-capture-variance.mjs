import assert from 'node:assert/strict';
import sharp from 'sharp';
import { frameStdDev } from './capture.mjs';

// A delayed world frame can still contain a fully rendered HUD (CI run34790878486).
const background = { create: { width: 1280, height: 720, channels: 3, background: '#0c100b' } };
const hud = Buffer.from('<svg width="1280" height="720"><rect x="60" y="35" width="80" height="25" fill="red"/><rect x="1140" y="25" width="100" height="110" fill="white"/><rect x="985" y="555" width="260" height="150" fill="olive"/></svg>');
const blankWithHud = await sharp(background).composite([{ input: hud }]).png().toBuffer();
const originalStats = await sharp(blankWithHud).stats();
assert.ok(Math.max(...originalStats.channels.map(c => c.stdev)) > 2, 'The old full-frame probe falsely accepts this HUD-only frame');
assert.ok(await frameStdDev(blankWithHud) < 2, 'A HUD must not hide a blank world frame');

const world = Buffer.from('<svg width="1280" height="720"><rect x="350" y="200" width="250" height="300" fill="#819148"/><rect x="600" y="200" width="280" height="300" fill="#314322"/></svg>');
const rendered = await sharp(background).composite([{ input: world }, { input: hud }]).png().toBuffer();
assert.ok(await frameStdDev(rendered) > 2, 'World content must still pass the retry probe');
assert.equal(await frameStdDev(await sharp(background).png().toBuffer()), 0);
console.log('Capture variance: HUD-only, rendered world, and uniform frame checks passed.');
