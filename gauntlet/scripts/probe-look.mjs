#!/usr/bin/env node
/**
 * probe-look.mjs — one world load, many look variants: render fixed poses under runtime material
 * overrides so a tone can be chosen from side-by-side frames instead of one rebuild per guess.
 *
 *   node gauntlet/scripts/probe-look.mjs --dist dist --out /tmp/probe --size 640x360 \
 *        --shots art/environment/owner-2026-09-23/shots.json --only s2-owner,s2-approach \
 *        --variants '[{"name":"base"},{"name":"dark","material":"stair-timber","color":[0.9,1,1.4]}]'
 *
 * A variant sets `color` / `emissive` (linear RGB) / `emissiveIntensity` / `roughness` on every
 * material whose name matches `material` (exact), `visible` on objects named `object`, or moves the
 * sun (`sun: { dir: [x, y, z], intensity }` — the shadow-casting directional light, same distance
 * from its target), or blits one composer buffer (`atmoDebug`: 'rays' | 'ao' | 'mist' | 'bloom');
 * each variant starts from the loaded values. Frames are <variant>-<shot>.png. `--audit <file>`
 * also writes the loaded world's `__ZR__.audit()`.
 * The character is hidden.
 */
import fs from 'node:fs';
import path from 'node:path';
import { serveStatic, launchBrowser, openWorld } from './lib/browser.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : [])).filter(Boolean),
);
const dist = path.resolve(args.dist || 'dist');
const out = path.resolve(args.out || '/tmp/probe-look');
const [width, height] = String(args.size || '640x360').split('x').map(Number);
const settle = Math.max(1, Number(args.settle ?? 4));
const shots = JSON.parse(fs.readFileSync(path.resolve(args.shots), 'utf8'));
const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
const variants = JSON.parse(typeof args.variants === 'string' && args.variants.trim().startsWith('[') ? args.variants : fs.readFileSync(path.resolve(args.variants), 'utf8'));
fs.mkdirSync(out, { recursive: true });

async function grabHooks(page) {
  const client = await page.createCDPSession();
  try {
    const ev = await client.send('Runtime.evaluate', { expression: 'window.__ZR__.render' });
    const { internalProperties } = await client.send('Runtime.getProperties', { objectId: ev.result.objectId, ownProperties: true });
    const scopes = internalProperties?.find((p) => p.name === '[[Scopes]]');
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

async function main() {
  const server = await serveStatic(dist);
  const browser = await launchBrowser({ width, height });
  try {
    const { page } = await openWorld(browser, server.url, { width, height, log: console.error });
    if (!(await grabHooks(page))) throw new Error('world hooks not found');
    // --audit <file>: the loaded world's audit (every system's registered facts) as JSON
    if (typeof args.audit === 'string') fs.writeFileSync(path.resolve(args.audit), JSON.stringify(await page.evaluate(() => window.__ZR__.audit()), null, 1));
    await page.evaluate(() => {
      for (const sel of ['.zr-hud', '.zr-equip']) {
        const el = document.querySelector(sel);
        if (el) el.style.display = 'none';
      }
      const ch = window.__H.scene.getObjectByName('character');
      if (ch) ch.visible = false;
      window.__ZR__.setTime(12.5);
      // the sun (the shadow-casting directional light) and its loaded placement
      window.__H.scene.traverse((o) => {
        if (o.isDirectionalLight && o.castShadow && !window.__PROBE_SUN__) window.__PROBE_SUN__ = { light: o, dir0: o.userData.sunDir?.clone() ?? null, intensity: o.intensity };
      });
      // remember every material's loaded values once
      window.__PROBE_ORIG__ = new Map();
      window.__H.scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          if (window.__PROBE_ORIG__.has(m)) continue;
          window.__PROBE_ORIG__.set(m, { color: m.color?.clone(), emissive: m.emissive?.clone(), emissiveIntensity: m.emissiveIntensity, roughness: m.roughness });
        }
      });
    });
    const canvas = await page.$('canvas');
    for (const v of variants) {
      const applied = await page.evaluate((v) => {
        let n = 0;
        for (const [m, o] of window.__PROBE_ORIG__) {
          if (o.color) m.color.copy(o.color);
          if (o.emissive) m.emissive.copy(o.emissive);
          if (o.emissiveIntensity !== undefined) m.emissiveIntensity = o.emissiveIntensity;
          if (o.roughness !== undefined) m.roughness = o.roughness;
          if (v.material && m.name === v.material) {
            if (v.color) m.color.setRGB(...v.color);
            if (v.emissive) m.emissive.setRGB(...v.emissive);
            if (v.emissiveIntensity !== undefined) m.emissiveIntensity = v.emissiveIntensity;
            if (v.roughness !== undefined) m.roughness = v.roughness;
            n++;
          }
        }
        // objects a previous variant hid or showed go back first
        for (const [o, vis] of window.__PROBE_VIS__ ?? []) o.visible = vis;
        window.__PROBE_VIS__ = [];
        if (v.object) window.__H.scene.traverse((o) => { if (o.name === v.object) { window.__PROBE_VIS__.push([o, o.visible]); o.visible = v.visible !== false; n++; } });
        // `sun`: { dir: [x, y, z] toward the sun, intensity } — a different light on the same frame
        // (the lighting system re-places the sun along userData.sunDir every frame)
        const S = window.__PROBE_SUN__;
        if (S && S.dir0) {
          const d = S.light.userData.sunDir;
          if (v.sun?.dir) d.set(v.sun.dir[0], v.sun.dir[1], v.sun.dir[2]).normalize();
          else d.copy(S.dir0);
          S.light.intensity = v.sun?.intensity ?? S.intensity;
        }
        // `atmoDebug`: 'rays' | 'ao' | 'mist' | 'bloom' blits that composer buffer (postfx/composer.ts)
        globalThis.__ATMO_DEBUG__ = v.atmoDebug ?? undefined;
        return n;
      }, v);
      for (const shot of shots) {
        if (only && !only.has(shot.name)) continue;
        await page.evaluate(([p, t, fov]) => window.__ZR__.setPose(p, t, fov), [shot.from.p, shot.from.t, shot.from.fov]);
        for (let left = settle; left > 0; left -= 4) await page.evaluate(async (n) => { await window.__ZR__.render(n, 1 / 30); }, Math.min(4, left));
        const file = path.join(out, `${v.name}-${shot.name}.png`);
        await canvas.screenshot({ path: file, type: 'png' });
        console.error(`probe: ${v.name} (${applied} material(s)) · ${shot.name} → ${file}`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
