#!/usr/bin/env node
/**
 * Capture every saved viewpoint of the built world headlessly.
 *
 *   npm run build && npm run capture -- --out gauntlet/out/capture [--viewpoints A_stairs,B_house] [--quality high] [--settle 90] [--dist path/to/dist] [--no-checks]
 *
 * Writes <out>/<viewpoint>.png, audit.json, stats.json, checks.json, console.log, plus
 * <det>.det.png (determinism re-capture) and <det>.motion.png (t + 0.5 s) for the A_stairs shot.
 * The screenshots come from the renderer's own canvas via the __ZR__ API — no hand-made images.
 *
 * checks.json holds the in-page rubric evidence that needs the live scene: depth histograms per
 * hero viewpoint (C3 / W32), terrain probes (W04), placement spot-checks of every system's
 * `samplePositions` (B4), and layout→screen projections (W01).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { ROOT, serveStatic, launchBrowser, openWorld } from './lib/browser.mjs';
import { loadRubric } from './lib/paths.mjs';
import { parseLayout, layoutPoints } from './lib/layout.mjs';
import { resolvePath } from './lib/rubric-eval.mjs';

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

/**
 * Git identity of the tree a build came from. When `distDir` sits inside a checkout other than
 * ROOT (a pinned worktree built for the capture), that checkout is described — including its own
 * `dirty` flag — so the record says what was actually built, not what the orchestrator's working
 * tree looked like while other agents edited it.
 */
export function gitInfo(distDir = null) {
  let cwd = ROOT;
  if (distDir) {
    let d = path.resolve(distDir);
    for (let i = 0; i < 4 && d !== path.dirname(d); i++) {
      d = path.dirname(d);
      if (fs.existsSync(path.join(d, '.git'))) {
        cwd = d;
        break;
      }
    }
  }
  const run = (c) => {
    try {
      return execSync(c, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  };
  return {
    source: cwd === ROOT ? 'workspace' : 'worktree',
    sha: run('git rev-parse HEAD'),
    shortSha: run('git rev-parse --short HEAD'),
    branch: run('git rev-parse --abbrev-ref HEAD'),
    subject: run('git log -1 --pretty=%s'),
    author: run('git log -1 --pretty=%an'),
    committedAt: run('git log -1 --pretty=%cI'),
    dirty: run('git status --porcelain') !== '',
  };
}

export const sha256 = (buf) => 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');

/** sha256 over every file of a directory (sorted relative path + content hash). */
export function hashDir(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  files.sort();
  const h = crypto.createHash('sha256');
  for (const f of files) h.update(path.relative(dir, f) + '\0' + crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') + '\n');
  return 'sha256:' + h.digest('hex');
}

/** Max per-channel standard deviation (0..255) — a (near-)uniform frame means the GPU had not drawn yet. */
export async function frameStdDev(pngBuffer) {
  const st = await sharp(pngBuffer).stats();
  return Math.max(...st.channels.slice(0, 3).map((c) => c.stdev));
}

const DEFAULT_SIM_TIME = 12.5;
const MOTION_DT = 0.5;
const UNIFORM_STDDEV = 2; // /255

/** Frames per CDP call — keeps every call well under puppeteer's protocolTimeout on slow SwiftShader boxes. */
const RENDER_CHUNK = 15;

async function renderAt(page, viewpointId, simTime, frames, log = null) {
  const ok = await page.evaluate((id) => window.__ZR__.setViewpoint(id), viewpointId);
  if (!ok) throw new Error(`viewpoint ${viewpointId} not found`);
  await page.evaluate((t) => window.__ZR__.setTime(t), simTime);
  const t0 = Date.now();
  let done = 0;
  let reported = false;
  for (let left = frames; left > 0; left -= RENDER_CHUNK) {
    const n = Math.min(RENDER_CHUNK, left);
    await page.evaluate((k) => window.__ZR__.render(k, 1 / 60), n);
    done += n;
    const perFrame = (Date.now() - t0) / done / 1000;
    // slow SwiftShader boxes: show progress once it is clear the viewpoint will take a while
    if (log && !reported && done < frames && perFrame * frames > 30) {
      reported = true;
      log(`  ${viewpointId}: ${perFrame.toFixed(2)} s/frame — ${frames} settle frames ≈ ${(perFrame * frames).toFixed(0)} s`);
    }
  }
}

/** Screenshot the canvas; if the frame is (near-)uniform re-render and retry up to `retries` times. */
async function shoot(page, file, { viewpointId, simTime, frames, retries = 2, log }) {
  const canvas = await page.$('canvas');
  let attempt = 0;
  let buf;
  let stdev = 0;
  for (;;) {
    buf = Buffer.from(await canvas.screenshot({ type: 'png' }));
    stdev = await frameStdDev(buf);
    if (stdev >= UNIFORM_STDDEV || attempt >= retries) break;
    attempt++;
    log(`  ${path.basename(file)}: near-uniform frame (σ=${stdev.toFixed(2)}) — re-rendering (retry ${attempt}/${retries})`);
    await renderAt(page, viewpointId, simTime, frames);
  }
  fs.writeFileSync(file, buf);
  return { sha256: sha256(buf), bytes: buf.length, stdev: Number(stdev.toFixed(2)), retries: attempt, uniform: stdev < UNIFORM_STDDEV };
}

function toXYZ(sample) {
  if (Array.isArray(sample)) return { x: Number(sample[0]), y: sample.length >= 3 ? Number(sample[1]) : undefined, z: Number(sample[sample.length >= 3 ? 2 : 1]) };
  if (sample && typeof sample === 'object') return { x: Number(sample.x), y: sample.y === undefined ? undefined : Number(sample.y), z: Number(sample.z) };
  return null;
}

/** Placement spot-check (rule B4): sample positions vs terrain height / mask, evaluated in-page. */
async function evaluatePlacement(page, check, audit, { maxSamples = 1500 } = {}) {
  const raw = resolvePath(audit, check.path);
  const result = { path: check.path, maxGap: check.maxGap ?? null, maskMax: check.maskMax ?? null, minPass: check.minPass, missing: false, samples: 0, evaluated: 0, passed: 0, passFraction: null, maxGap_seen: null };
  if (!Array.isArray(raw)) {
    result.missing = true;
    result.detail = raw === undefined ? 'samplePositions path missing from audit' : 'samplePositions is not an array';
    return result;
  }
  result.samples = raw.length;
  if (!raw.length) {
    result.passFraction = 0;
    result.detail = 'empty samplePositions';
    return result;
  }
  const stride = Math.max(1, Math.ceil(raw.length / maxSamples));
  const pts = [];
  for (let i = 0; i < raw.length; i += stride) {
    const p = toXYZ(raw[i]);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) pts.push([p.x, p.y ?? null, p.z]);
  }
  const r = await page.evaluate(
    ({ pts, maxGap, maskMax }) => {
      let passed = 0;
      let maxGapSeen = 0;
      let noY = 0;
      const maskFails = {};
      for (const [x, y, z] of pts) {
        const pr = window.__ZR__.probe(x, z);
        let ok = true;
        if (maxGap !== null) {
          if (typeof y !== 'number') {
            ok = false;
            noY++;
          } else {
            const gap = Math.abs(y - pr.height);
            if (gap > maxGapSeen) maxGapSeen = gap;
            if (gap > maxGap) ok = false;
          }
        }
        if (maskMax) {
          for (const k of Object.keys(maskMax)) {
            const mv = pr.mask?.[k] ?? 0;
            if (mv > maskMax[k]) {
              ok = false;
              maskFails[k] = (maskFails[k] ?? 0) + 1;
            }
          }
        }
        if (ok) passed++;
      }
      return { passed, maxGapSeen, noY, maskFails };
    },
    { pts, maxGap: check.maxGap ?? null, maskMax: check.maskMax ?? null },
  );
  result.evaluated = pts.length;
  result.passed = r.passed;
  result.passFraction = pts.length ? r.passed / pts.length : 0;
  result.maxGap_seen = Number(r.maxGapSeen.toFixed(4));
  result.maskFailures = r.maskFails;
  if (r.noY) result.detail = `${r.noY} samples had no y (need [x,y,z])`;
  return result;
}

async function evaluateProjection(page, check, layout) {
  const points = layoutPoints(check.layout, layout);
  const key = `${check.viewpoint}:${check.layout}`;
  if (!points) return { key, viewpoint: check.viewpoint, layout: check.layout, insideFraction: null, detail: `unknown layout key ${check.layout}` };
  const projected = await page.evaluate((pts) => window.__ZR__.project(pts), points);
  const r = check.region;
  let inside = 0;
  const detail = projected.map((p, i) => {
    const ok = !!p && p[0] >= r.xMin && p[0] <= r.xMax && p[1] >= r.yMin && p[1] <= r.yMax;
    if (ok) inside++;
    return { world: points[i], screen: p ? [Number(p[0].toFixed(3)), Number(p[1].toFixed(3))] : null, inside: ok };
  });
  return { key, viewpoint: check.viewpoint, layout: check.layout, region: r, minInside: check.minInside, inside, total: points.length, insideFraction: inside / points.length, points: detail };
}

export async function captureAll({
  out,
  viewpoints,
  quality = 'high',
  settleFrames = 90,
  width = 1280,
  height = 720,
  distDir,
  log = console.error,
  rubric,
  checks = true,
  determinismViewpoint = 'A_stairs',
} = {}) {
  distDir = distDir || path.join(ROOT, 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) throw new Error(`No build at ${distDir}. Run \`npm run build\` first.`);
  fs.mkdirSync(out, { recursive: true });
  rubric ??= safeLoadRubric();
  const heroViewpoints = rubric?.heroViewpoints ?? ['A_stairs', 'B_house', 'C_lookback', 'D_log'];
  const rubricChecks = checks && rubric ? rubric.items.flatMap((it) => (it.checks ?? []).map((c) => ({ ...c, item: it.id }))) : [];
  const layout = checks ? parseLayout(undefined, (w) => log(`warning: ${w}`)) : null;
  const server = await serveStatic(distDir);
  const browser = await launchBrowser({ width, height });
  const t0 = Date.now();
  const checksOut = { generatedAt: null, heroViewpoints, simTime: DEFAULT_SIM_TIME, settleFrames, depth: {}, probes: [], placements: {}, projections: {}, determinism: null, motion: null, layout: layout ? { stairs: layout.stairs, lanternBranch: layout.lanternBranch } : null, warnings: [...(layout?.warnings ?? [])] };
  try {
    const { page, consoleLines } = await openWorld(browser, server.url, { width, height, quality, log });
    const renderer = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      const d = gl?.getExtension('WEBGL_debug_renderer_info');
      return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown';
    });
    const available = await page.evaluate(() => window.__ZR__.viewpoints());
    const wanted = viewpoints?.length ? available.filter((v) => viewpoints.includes(v.id)) : available;
    if (!wanted.length) throw new Error(`none of the requested viewpoints exist (${viewpoints?.join(',')})`);
    const results = [];

    // 1. one screenshot per viewpoint (+ projection checks while the camera is there)
    for (const vp of wanted) {
      const tv = Date.now();
      await renderAt(page, vp.id, DEFAULT_SIM_TIME, settleFrames, log);
      const file = path.join(out, `${vp.id}.png`);
      const shot = await shoot(page, file, { viewpointId: vp.id, simTime: DEFAULT_SIM_TIME, frames: settleFrames, log });
      const stats = await page.evaluate(() => window.__ZR__.stats());
      const pose = await page.evaluate(() => window.__ZR__.cameraPose());
      for (const c of rubricChecks.filter((c) => c.type === 'projection' && c.viewpoint === vp.id)) {
        const r = await evaluateProjection(page, c, layout);
        checksOut.projections[r.key] = { ...r, item: c.item };
      }
      const captureMs = Date.now() - tv;
      results.push({ id: vp.id, label: vp.label, refSeconds: vp.refSeconds, file: path.basename(file), sha256: shot.sha256, bytes: shot.bytes, stdev: shot.stdev, retries: shot.retries, stats, pose, renderer, captureMs, ms: captureMs });
      log(`captured ${vp.id} (${vp.label}) in ${(captureMs / 1000).toFixed(1)}s — ${stats.drawCalls} draws, ${(stats.triangles / 1e6).toFixed(2)}M tris${shot.retries ? ` (${shot.retries} retries)` : ''}`);
    }

    // 2. determinism re-capture + motion pair for the determinism viewpoint
    const det = wanted.find((v) => v.id === determinismViewpoint);
    if (det) {
      let tv = Date.now();
      await renderAt(page, det.id, DEFAULT_SIM_TIME, settleFrames, log);
      const detShot = await shoot(page, path.join(out, `${det.id}.det.png`), { viewpointId: det.id, simTime: DEFAULT_SIM_TIME, frames: settleFrames, log });
      checksOut.determinism = { viewpoint: det.id, file: `${det.id}.det.png`, sha256: detShot.sha256, simTime: DEFAULT_SIM_TIME, captureMs: Date.now() - tv };
      log(`captured ${det.id}.det (determinism) in ${((Date.now() - tv) / 1000).toFixed(1)}s`);
      tv = Date.now();
      await renderAt(page, det.id, DEFAULT_SIM_TIME + MOTION_DT, settleFrames, log);
      const motShot = await shoot(page, path.join(out, `${det.id}.motion.png`), { viewpointId: det.id, simTime: DEFAULT_SIM_TIME + MOTION_DT, frames: settleFrames, log });
      checksOut.motion = { viewpoint: det.id, file: `${det.id}.motion.png`, sha256: motShot.sha256, t0: DEFAULT_SIM_TIME, t1: DEFAULT_SIM_TIME + MOTION_DT, captureMs: Date.now() - tv };
      log(`captured ${det.id}.motion (t+${MOTION_DT}s) in ${((Date.now() - tv) / 1000).toFixed(1)}s`);
    }

    // 3. depth histograms per hero viewpoint (after all screenshots: the depth pass changes GL state)
    if (checks) {
      for (const vp of wanted.filter((v) => heroViewpoints.includes(v.id))) {
        const tv = Date.now();
        await renderAt(page, vp.id, DEFAULT_SIM_TIME, 2);
        const d = await page.evaluate(() => window.__ZR__.depthHistogram(250));
        checksOut.depth[vp.id] = { ...d, buckets: d.buckets.map((b) => Number(b.toFixed(5))), maxDepth: 250, ms: Date.now() - tv };
        log(`depth ${vp.id}: sky ${(d.skyFraction * 100).toFixed(1)} %, ${d.farLayerCount} far layers, max bucket >20 m ${(d.maxBucketBeyond20m * 100).toFixed(1)} %`);
      }
    }

    // 4. audit + camera-independent checks (probes, placements)
    const audit = await page.evaluate(() => window.__ZR__.audit());
    if (checks) {
      for (const c of rubricChecks.filter((c) => c.type === 'probe')) {
        const p = await page.evaluate(({ x, z }) => window.__ZR__.probe(x, z), { x: c.x, z: c.z });
        checksOut.probes.push({ item: c.item, x: c.x, z: c.z, expected: c.height, tolerance: c.tolerance, height: Number(p.height.toFixed(4)), slope: Number(p.slope.toFixed(4)), mask: p.mask, gap: Number(Math.abs(p.height - c.height).toFixed(4)) });
      }
      for (const c of rubricChecks.filter((c) => c.type === 'placement')) {
        if (checksOut.placements[c.path]) continue;
        checksOut.placements[c.path] = { item: c.item, ...(await evaluatePlacement(page, c, audit)) };
        const r = checksOut.placements[c.path];
        log(`placement ${c.path}: ${r.missing ? 'MISSING' : `${r.passed}/${r.evaluated} ok (${(r.passFraction * 100).toFixed(1)} %)`}`);
      }
      for (const [k, p] of Object.entries(checksOut.projections)) log(`projection ${k}: ${p.inside}/${p.total} inside`);
    }
    checksOut.generatedAt = new Date().toISOString();

    const meta = {
      capturedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      width,
      height,
      quality,
      settleFrames,
      simTime: DEFAULT_SIM_TIME,
      git: gitInfo(distDir),
      distHash: hashDir(distDir),
      viewpoints: results,
      renderer,
      extra: { determinism: checksOut.determinism ? path.basename(checksOut.determinism.file) : null, motion: checksOut.motion ? path.basename(checksOut.motion.file) : null },
    };
    audit.checks = checksOut;
    fs.writeFileSync(path.join(out, 'audit.json'), JSON.stringify(audit, null, 2));
    fs.writeFileSync(path.join(out, 'stats.json'), JSON.stringify(meta, null, 2));
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(checksOut, null, 2));
    fs.writeFileSync(path.join(out, 'console.log'), consoleLines.join('\n'));
    return { meta, audit, checks: checksOut };
  } finally {
    await browser.close();
    await server.close();
  }
}

function safeLoadRubric() {
  try {
    return loadRubric();
  } catch {
    return null;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(ROOT, args.out || 'gauntlet/out/capture');
  const viewpoints = typeof args.viewpoints === 'string' ? args.viewpoints.split(',') : undefined;
  captureAll({
    out,
    viewpoints,
    quality: args.quality || 'high',
    settleFrames: Number(args.settle || 90),
    distDir: args.dist ? path.resolve(ROOT, args.dist) : undefined,
    checks: !args['no-checks'],
  })
    .then(({ meta }) => {
      console.log(JSON.stringify({ out, viewpoints: meta.viewpoints.map((v) => v.id), durationMs: meta.durationMs, sha: meta.git.shortSha }, null, 2));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
