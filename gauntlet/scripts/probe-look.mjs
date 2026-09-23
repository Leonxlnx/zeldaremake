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
 * from its target), or blits one composer buffer (`atmoDebug`: 'rays' | 'ao' | 'mist' | 'bloom'),
 * or scales the point lights whose name matches (`lights: { match: 'lantern', scale: 0 }`), or
 * sets the simulation clock (`time`, s; default 12.5), or overrides composer settings for the frame
 * (`settings: { rayIntensity: 0 }`) or hides named objects for it (`hide: ['mist-volume']`); each
 * variant starts from the loaded values. Build-time atmosphere constants (the height fog) take
 * `ZR_INIT_GLOBALS='{"__ATMO_FOG__":{…}}'` (a separate load, lib/browser.mjs). Frames are <variant>-<shot>.png. `--audit <file>`
 * also writes the loaded world's `__ZR__.audit()`; `--pick "x,y;x,y"` (frame fractions, y down)
 * names the meshes under those pixels on the first variant's frames (pick-<shot>.json).
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
/** --pick "x,y;x,y" (or x,y/x,y — no shell quoting needed): frame fractions (0..1, y down) identified on the first variant's frame */
const picks = typeof args.pick === 'string' ? args.pick.split(/[;/]/).map((s) => s.split(',').map(Number)) : [];

/**
 * In the page: the world point under each pick (the frame's own depth, Euclidean metres, along the
 * pixel's ray from the camera pose) and the visible meshes — instances for an InstancedMesh —
 * whose world bounds hold it (0.3 m slack), smallest box first.
 */
function pickScript(picks) {
  const pose = window.__ZR__.cameraPose();
  const canvas = document.querySelector('canvas');
  const W = 320;
  const H = Math.round((W * canvas.height) / canvas.width);
  const depth = window.__ZR__.depthImage(null, W, H);
  const d = pose.direction;
  const len = Math.hypot(d[0], d[1], d[2]);
  const f = [d[0] / len, d[1] / len, d[2] / len];
  // right = forward × world up (setPose looks at its target with +Y up), up = right × forward
  let r = [-f[2], 0, f[0]];
  const rl = Math.hypot(r[0], r[2]) || 1;
  r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const t = Math.tan(((pose.fov * Math.PI) / 180) / 2);
  const aspect = canvas.width / canvas.height;
  const results = [];
  for (const [px, py] of picks) {
    const x = Math.min(W - 1, Math.floor(px * W));
    const y = Math.min(H - 1, Math.floor(py * H));
    const dist = depth.data[y * W + x];
    const nx = (2 * px - 1) * t * aspect;
    const ny = (1 - 2 * py) * t;
    const ray = [f[0] + r[0] * nx + u[0] * ny, f[1] + r[1] * nx + u[1] * ny, f[2] + r[2] * nx + u[2] * ny];
    const rlen = Math.hypot(ray[0], ray[1], ray[2]);
    if (!Number.isFinite(dist)) {
      results.push({ pick: [px, py], sky: true });
      continue;
    }
    const P = pose.position.map((c, i) => c + (ray[i] / rlen) * dist);
    const hits = [];
    window.__H.scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      let vis = true;
      for (let q = o; q; q = q.parent) if (!q.visible) vis = false;
      if (!vis) return;
      const g = o.geometry;
      // merged meshes release their CPU arrays after upload (bounds computed first); skip any without
      if (!g.boundingBox) {
        try {
          g.computeBoundingBox();
        } catch {
          return;
        }
      }
      const bb = g.boundingBox;
      if (!bb) return;
      const test = (m) => {
        // the box's eight corners through m, their world AABB
        let lo = [Infinity, Infinity, Infinity];
        let hi = [-Infinity, -Infinity, -Infinity];
        const e = m.elements;
        for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) {
          const w = [e[0] * cx + e[4] * cy + e[8] * cz + e[12], e[1] * cx + e[5] * cy + e[9] * cz + e[13], e[2] * cx + e[6] * cy + e[10] * cz + e[14]];
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], w[k]);
            hi[k] = Math.max(hi[k], w[k]);
          }
        }
        const inside = P.every((c, k) => c >= lo[k] - 0.3 && c <= hi[k] + 0.3);
        return inside ? (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]) : null;
      };
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name || m?.type);
      if (o.isInstancedMesh) {
        const im = o.instanceMatrix.array;
        const M = o.matrixWorld.clone();
        for (let i = 0; i < o.count; i++) {
          const Mi = M.clone().multiply(M.clone().fromArray(im, i * 16));
          const vol = test(Mi);
          if (vol !== null) hits.push({ name: o.name, instance: i, materials: mats, volume: +vol.toFixed(1) });
        }
      } else {
        const vol = test(o.matrixWorld);
        if (vol !== null) hits.push({ name: o.name, materials: mats, volume: +vol.toFixed(1) });
      }
    });
    hits.sort((a, b) => a.volume - b.volume);
    results.push({ pick: [px, py], distance: +dist.toFixed(2), world: P.map((v) => +v.toFixed(2)), hits: hits.slice(0, 12) });
  }
  return results;
}

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
      // every point light's loaded intensity (a `lights` variant scales the ones it names)
      window.__PROBE_LIGHTS__ = [];
      window.__H.scene.traverse((o) => {
        if (o.isPointLight) window.__PROBE_LIGHTS__.push([o, o.intensity]);
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
        // `settings`: composer overrides for the frame (e.g. { rayIntensity: 0 }); `hide`: scene
        // object names hidden for the frame (postfx/composer.ts __ATMO_SETTINGS__ / __ATMO_HIDE__)
        globalThis.__ATMO_SETTINGS__ = v.settings ?? undefined;
        globalThis.__ATMO_HIDE__ = v.hide ?? undefined;
        // `time`: the simulation clock for this variant's frames (wind, swinging pods; default 12.5)
        window.__ZR__.setTime(v.time ?? 12.5);
        // `lights`: { match: <regexp on the light's name>, scale } — 0 switches them off without
        // changing the light count (no program recompiles between variants)
        const lightRe = v.lights ? new RegExp(v.lights.match) : null;
        for (const [l, i0] of window.__PROBE_LIGHTS__ ?? []) {
          const hit = !!lightRe && lightRe.test(l.name);
          l.intensity = hit ? i0 * (v.lights.scale ?? 0) : i0;
          if (hit) n++;
        }
        return n;
      }, v);
      for (const shot of shots) {
        if (only && !only.has(shot.name)) continue;
        await page.evaluate(([p, t, fov]) => window.__ZR__.setPose(p, t, fov), [shot.from.p, shot.from.t, shot.from.fov]);
        for (let left = settle; left > 0; left -= 4) await page.evaluate(async (n) => { await window.__ZR__.render(n, 1 / 30); }, Math.min(4, left));
        const file = path.join(out, `${v.name}-${shot.name}.png`);
        await canvas.screenshot({ path: file, type: 'png' });
        console.error(`probe: ${v.name} (${applied} material(s)) · ${shot.name} → ${file}`);
        if (picks.length && v === variants[0]) {
          const found = await page.evaluate(pickScript, picks);
          fs.writeFileSync(path.join(out, `pick-${shot.name}.json`), JSON.stringify(found, null, 1));
          console.error(`probe: picks at ${shot.name} → pick-${shot.name}.json`);
        }
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
