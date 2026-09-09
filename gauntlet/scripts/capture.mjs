#!/usr/bin/env node
/**
 * Capture every saved viewpoint of the built world headlessly.
 *
 *   npm run build && npm run capture -- --out gauntlet/out/capture [--viewpoints A_stairs,B_house] [--quality high] [--settle 90] [--dist path/to/dist]
 *
 * Writes <out>/<viewpoint>.png, <out>/audit.json, <out>/stats.json, <out>/console.log.
 * The screenshots come from the renderer's own canvas via the __ZR__ API — no hand-made images.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT, serveStatic, launchBrowser, openWorld } from './lib/browser.mjs';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

export function gitInfo() {
  const run = (c) => {
    try {
      return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  };
  return {
    sha: run('git rev-parse HEAD'),
    shortSha: run('git rev-parse --short HEAD'),
    branch: run('git rev-parse --abbrev-ref HEAD'),
    subject: run('git log -1 --pretty=%s'),
    author: run('git log -1 --pretty=%an'),
    committedAt: run('git log -1 --pretty=%cI'),
    dirty: run('git status --porcelain') !== '',
  };
}

export async function captureAll({ out, viewpoints, quality = 'high', settleFrames = 90, width = 1280, height = 720, distDir, log = console.error }) {
  distDir = distDir || path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error(`No build at ${distDir}. Run \`npm run build\` first.`);
  fs.mkdirSync(out, { recursive: true });
  const server = await serveStatic(distDir);
  const browser = await launchBrowser({ width, height });
  const t0 = Date.now();
  try {
    const { page, consoleLines } = await openWorld(browser, server.url, { width, height, quality, log });
    const available = await page.evaluate(() => window.__ZR__.viewpoints());
    const wanted = viewpoints?.length ? available.filter((v) => viewpoints.includes(v.id)) : available;
    const results = [];
    for (const vp of wanted) {
      const tv = Date.now();
      await page.evaluate((id) => window.__ZR__.setViewpoint(id), vp.id);
      // deterministic simulation time per viewpoint so wind/particles are in the same phase every run
      await page.evaluate((t) => window.__ZR__.setTime(t), 12.5);
      await page.evaluate((n) => window.__ZR__.render(n, 1 / 60), settleFrames);
      const file = path.join(out, `${vp.id}.png`);
      const canvas = await page.$('canvas');
      await canvas.screenshot({ path: file, type: 'png' });
      const stats = await page.evaluate(() => window.__ZR__.stats());
      results.push({ id: vp.id, label: vp.label, refSeconds: vp.refSeconds, file: path.basename(file), stats, ms: Date.now() - tv });
      log(`captured ${vp.id} (${vp.label}) in ${((Date.now() - tv) / 1000).toFixed(1)}s — ${stats.drawCalls} draws, ${(stats.triangles / 1e6).toFixed(2)}M tris`);
    }
    const audit = await page.evaluate(() => window.__ZR__.audit());
    const meta = {
      capturedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      width,
      height,
      quality,
      settleFrames,
      git: gitInfo(),
      viewpoints: results,
      renderer: await page.evaluate(() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2');
        const d = gl?.getExtension('WEBGL_debug_renderer_info');
        return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
      }),
    };
    fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(audit, null, 2));
    fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(out, 'console.log'), consoleLines.join('\n'));
    return { meta, audit };
  } finally {
    await browser.close();
    await server.close();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(ROOT, args.out || 'gauntlet/out/capture');
  const viewpoints = typeof args.viewpoints === 'string' ? args.viewpoints.split(',') : undefined;
  captureAll({ out, viewpoints, quality: args.quality || 'high', settleFrames: Number(args.settle || 90), distDir: args.dist ? path.resolve(ROOT, args.dist) : undefined })
    .then(({ meta }) => {
      console.log(JSON.stringify({ out, viewpoints: meta.viewpoints.map((v) => v.id), durationMs: meta.durationMs, sha: meta.git.shortSha }, null, 2));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
