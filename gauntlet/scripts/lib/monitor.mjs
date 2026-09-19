/**
 * Director's Monitor data (site/SCHEMA.md) on the orphan git branch `monitor`, checked out in
 * `.monitor/`. The monitor's ledger.json is the canonical hash chain: publishing rebases local-only
 * takes onto it (lib/ledger.mjs mergeLedgers) and regenerates takes.json / agents.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ROOT, MONITOR_DIR, DIST_DIR, AGENTS_DIR, RUBRIC_PATH, REFERENCE_FRAMES, readJson, writeJson, rel } from './paths.mjs';
import { loadLedger, saveLedger, mergeLedgers, entryIdentity } from './ledger.mjs';

/**
 * Layout of the monitor branch: it is the DEPLOYED Director's Monitor — the static site files from
 * `site/` at the root (index.html, app.js, styles.css, js/, assets/) and all data under `data/`
 * (site/SCHEMA.md). That lets raw CDNs and GitHub Pages "deploy from branch" serve it directly.
 */
export const MONITOR_DATA_SUBDIR = 'data';
export const monitorDataDir = (monitorDir = MONITOR_DIR) => path.join(monitorDir, MONITOR_DATA_SUBDIR);

const SITE_DIR = path.join(ROOT, 'site');
const SITE_STATIC = ['index.html', 'app.js', 'styles.css', 'js', 'assets'];

function copyRecursive(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copyRecursive(path.join(src, name), path.join(dst, name));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

/** Refresh the static site files at the monitor root from `site/` (no-op if site/ is absent). */
export function syncSiteFiles(monitorDir = MONITOR_DIR) {
  if (!fs.existsSync(path.join(SITE_DIR, 'index.html'))) return false;
  for (const name of SITE_STATIC) {
    const src = path.join(SITE_DIR, name);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(monitorDir, name);
    if (fs.statSync(src).isDirectory()) fs.rmSync(dst, { recursive: true, force: true });
    copyRecursive(src, dst);
  }
  fs.writeFileSync(path.join(monitorDir, '.nojekyll'), '');
  return true;
}

/**
 * Publish the current world build (`dist/`, as produced by the take's `vite build`) under
 * `play/` on the monitor branch so the live site links to a walkable build of the same commit it
 * scores. Vite's `base: './'` and `import.meta.env.BASE_URL` texture paths keep it relocatable.
 */
export function syncPlayBuild(monitorDir = MONITOR_DIR, distDir = DIST_DIR) {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) return false;
  const dst = path.join(monitorDir, 'play');
  fs.rmSync(dst, { recursive: true, force: true });
  copyRecursive(distDir, dst);
  return true;
}

export const MONITOR_BRANCH = 'monitor';
export const BOT_NAME = 'gauntlet-bot';
export const BOT_EMAIL = 'gauntlet@zeldaremake';
export const METRIC_KEYS = ['ssim', 'phashDistance', 'hueDiffDeg', 'satDiff', 'lumDiff', 'sharpnessRatio', 'skyFraction', 'overexposedFraction', 'purpleFraction'];

function git(args, { cwd = ROOT, quiet = false, env = {} } = {}) {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...env } }).toString();
}

function tryGit(args, opts) {
  try {
    return git(args, opts);
  } catch (e) {
    return { error: e };
  }
}

/**
 * Where the monitor branch lives: MONITOR_REMOTE, else (in GitHub Actions) the repository URL with
 * the job token embedded — the `.monitor/` checkout is a separate repo and does not inherit
 * actions/checkout's credential header — else the working tree's origin URL.
 */
export function monitorRemote(env = process.env) {
  if (env.MONITOR_REMOTE) return env.MONITOR_REMOTE;
  if (env.GITHUB_ACTIONS && env.GITHUB_TOKEN && env.GITHUB_REPOSITORY) {
    const host = new URL(env.GITHUB_SERVER_URL || 'https://github.com').host;
    return `https://x-access-token:${env.GITHUB_TOKEN}@${host}/${env.GITHUB_REPOSITORY}.git`;
  }
  const url = tryGit(['remote', 'get-url', 'origin'], { quiet: true });
  if (typeof url === 'string' && url.trim()) return url.trim();
  throw new Error('no MONITOR_REMOTE and no origin remote — cannot publish');
}

/** Remote URL safe for logs (credentials stripped). */
export function redactRemote(url) {
  return String(url ?? '').replace(/\/\/[^@/]+@/, '//');
}

const botEnv = { GIT_AUTHOR_NAME: BOT_NAME, GIT_AUTHOR_EMAIL: BOT_EMAIL, GIT_COMMITTER_NAME: BOT_NAME, GIT_COMMITTER_EMAIL: BOT_EMAIL };

/** Ensure `.monitor/` is a checkout of the `monitor` branch at the remote head (creating the orphan branch if missing). */
export function syncMonitor({ dir = MONITOR_DIR, remote = monitorRemote(), log = console.error } = {}) {
  let created = false;
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    git(['init', '-q', '-b', MONITOR_BRANCH], { cwd: dir });
    git(['remote', 'add', 'origin', remote], { cwd: dir });
  } else {
    tryGit(['remote', 'set-url', 'origin', remote], { cwd: dir, quiet: true });
  }
  const fetched = tryGit(['fetch', '-q', 'origin', MONITOR_BRANCH], { cwd: dir, quiet: true });
  if (typeof fetched === 'string') {
    git(['checkout', '-q', '-B', MONITOR_BRANCH, 'FETCH_HEAD'], { cwd: dir });
    git(['reset', '-q', '--hard', 'FETCH_HEAD'], { cwd: dir });
    git(['clean', '-qfd'], { cwd: dir });
  } else {
    // remote branch missing → orphan start
    created = true;
    tryGit(['checkout', '-q', '--orphan', MONITOR_BRANCH], { cwd: dir, quiet: true });
    tryGit(['rm', '-rfq', '--cached', '.'], { cwd: dir, quiet: true });
    for (const f of fs.readdirSync(dir)) if (f !== '.git') fs.rmSync(path.join(dir, f), { recursive: true, force: true });
    log(`monitor: remote has no "${MONITOR_BRANCH}" branch yet — creating it`);
  }
  git(['config', 'user.name', BOT_NAME], { cwd: dir });
  git(['config', 'user.email', BOT_EMAIL], { cwd: dir });
  return { dir, remote, created, head: created ? null : tryGit(['rev-parse', 'HEAD'], { cwd: dir, quiet: true })?.trim?.() ?? null };
}

export function defaultTakes() {
  return { project: 'zeldaremake', updatedAt: null, monitorCadenceMinutes: 60, takes: [] };
}

export function readTakes(dir = MONITOR_DIR) {
  const t = readJson(path.join(monitorDataDir(dir), 'takes.json'), null) ?? defaultTakes();
  t.takes ??= [];
  return t;
}

export function rendererShort(renderer) {
  if (!renderer) return 'unknown';
  if (/swiftshader/i.test(renderer)) return 'SwiftShader';
  if (/llvmpipe/i.test(renderer)) return 'llvmpipe';
  if (/nvidia|geforce|rtx/i.test(renderer)) return 'NVIDIA';
  if (/radeon|amd/i.test(renderer)) return 'AMD';
  if (/intel|iris|uhd/i.test(renderer)) return 'Intel';
  if (/apple/i.test(renderer)) return 'Apple';
  return renderer.slice(0, 24);
}

/** Parse `.agents/*.md` front-matter + first paragraph of "## Current task". */
export function buildAgentsJson(agentsDir = AGENTS_DIR) {
  const agents = [];
  if (!fs.existsSync(agentsDir)) return { agents };
  for (const f of fs.readdirSync(agentsDir).sort()) {
    if (!f.endsWith('.md') || /^(TEMPLATE|INBOX|README)\.md$/i.test(f)) continue;
    const text = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const fm = /^---\s*\n([\s\S]*?)\n---/.exec(text);
    const meta = {};
    if (fm) {
      for (const line of fm[1].split('\n')) {
        const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
        if (m) meta[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
      }
    }
    if (/<your-stable-id>/.test(meta.agent ?? '')) continue;
    const ct = /^##\s+Current task\s*\n([\s\S]*?)(?=\n##\s|\s*$)/m.exec(text);
    let currentTask = '';
    if (ct) {
      const paras = ct[1]
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      currentTask = paras[0] ?? '';
    }
    agents.push({ agent: meta.agent ?? f.replace(/\.md$/, ''), runtime: meta.runtime ?? null, github: meta.github ?? null, status: meta.status ?? null, branch: meta.branch ?? null, updated: meta.updated ?? null, currentTask, file: `.agents/${f}` });
  }
  return { agents };
}

const DEFAULT_PINS = { composition: [0.55, 0.55], trees: [0.5, 0.22], vegetation: [0.35, 0.78], rocks: [0.2, 0.7], structures: [0.72, 0.42], lighting: [0.3, 0.18], engineering: [0.9, 0.92], character: [0.5, 0.6], ui: [0.1, 0.1] };

/** Auto-callouts for rubric items that flipped pass/fail, pinned at sensible default positions per viewpoint. */
export function autoCallouts(score, rubric) {
  const byViewpoint = {};
  const counts = {};
  for (const [id, it] of Object.entries(score.items ?? {})) {
    if (!it.statusDelta) continue;
    const item = rubric.items.find((r) => r.id === id);
    const vp = item?.reference?.frame ?? it.viewpoint ?? 'A_stairs';
    const [bx, by] = DEFAULT_PINS[item?.group ?? 'composition'] ?? [0.5, 0.5];
    const n = (counts[vp] = (counts[vp] ?? 0) + 1) - 1;
    const x = Math.min(0.95, bx + 0.07 * (n % 3));
    const y = Math.min(0.95, by + 0.06 * Math.floor(n / 3));
    const kind = it.status === 'pass' ? (it.previousStatus === 'fail' ? 'new' : 'improved') : it.status === 'fail' && it.previousStatus === 'pass' ? 'regression' : 'todo';
    const label = `${item?.title ?? id} (${it.statusDelta})`;
    (byViewpoint[vp] ??= []).push({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)), label, item: id, kind, auto: true });
  }
  return byViewpoint;
}

/** Parse `--callout "A_stairs:0.62,0.47:W02:new:label"` strings and/or a callouts JSON file. */
export function parseCallouts({ inline = [], file = null } = {}) {
  const callouts = {};
  const refCallouts = {};
  const push = (target, vp, c) => (target[vp] ??= []).push(c);
  for (const s of inline) {
    const m = /^([A-Za-z0-9_]+):([\d.]+),([\d.]+):([A-Z]\d{2})?:?([a-z]+)?:(.+)$/.exec(String(s).trim());
    if (!m) throw new Error(`bad --callout "${s}" (expected viewpoint:x,y:ITEM:kind:label)`);
    push(callouts, m[1], { x: Number(m[2]), y: Number(m[3]), item: m[4] ?? null, kind: m[5] ?? 'new', label: m[6].trim() });
  }
  if (file) {
    const data = readJson(file);
    const list = Array.isArray(data) ? data : Array.isArray(data.callouts) ? data.callouts : null;
    if (list) for (const c of list) push(callouts, c.viewpoint, { x: c.x, y: c.y, item: c.item ?? null, kind: c.kind ?? 'new', label: c.label });
    else for (const [vp, arr] of Object.entries(data)) if (vp !== 'refCallouts' && Array.isArray(arr)) for (const c of arr) push(callouts, vp, { x: c.x, y: c.y, item: c.item ?? null, kind: c.kind ?? 'new', label: c.label });
    const rc = Array.isArray(data) ? null : data.refCallouts;
    if (rc) for (const [vp, arr] of Object.entries(rc)) for (const c of arr) push(refCallouts, vp, { x: c.x, y: c.y, label: c.label });
  }
  for (const arr of Object.values(callouts)) for (const c of arr) if (!['new', 'improved', 'todo', 'regression', 'reference'].includes(c.kind)) c.kind = 'new';
  return { callouts, refCallouts };
}

function pickMetrics(m) {
  const out = {};
  for (const k of METRIC_KEYS) out[k] = typeof m?.[k] === 'number' ? m[k] : null;
  if (typeof m?.determinismDiff === 'number') out.determinismDiff = m.determinismDiff;
  if (typeof m?.motionRegionsMoving === 'number') out.motionRegionsMoving = m.motionRegionsMoving;
  return out;
}

function deltas(cur, prev) {
  if (!prev) return {};
  const d = {};
  for (const k of Object.keys(cur)) if (typeof cur[k] === 'number' && typeof prev[k] === 'number' && cur[k] !== prev[k]) d[k] = Number((cur[k] - prev[k]).toFixed(4));
  return d;
}

/**
 * Build the takes.json record for a take. `entry` is the ledger entry, `takeDir` the capture dir
 * (score.json, compare.json, stats.json inside), `previous` the previous take record (or null).
 */
export function buildTakeRecord({ entry, takeDir, rubric, previous = null, callouts = {}, refCallouts = {}, phase = 1 }) {
  const stats = readJson(path.join(takeDir, 'stats.json'), {});
  const compare = readJson(path.join(takeDir, 'compare.json'), { viewpoints: {} });
  const score = readJson(path.join(takeDir, 'score.json'), { items: {} });
  const auto = autoCallouts(score, rubric);
  const primaryItem = rubric.items.find((i) => i.id === (entry.items ?? [])[0]);
  const sceneVp = primaryItem?.reference?.frame ?? 'A_stairs';
  const sceneMeta = (stats.viewpoints ?? []).find((v) => v.id === sceneVp);
  const hero = (stats.viewpoints ?? []).filter((v) => (rubric.heroViewpoints ?? []).includes(v.id));
  const maxOf = (k) => (hero.length ? Math.max(...hero.map((v) => v.stats?.[k] ?? 0)) : null);
  const shots = (stats.viewpoints ?? []).map((v) => {
    const m = compare.viewpoints?.[v.id] ?? {};
    const metrics = pickMetrics(m);
    const prevShot = previous?.shots?.find((s) => s.viewpoint === v.id) ?? null;
    return {
      viewpoint: v.id,
      label: v.label,
      refSeconds: v.refSeconds ?? null,
      image: `takes/${entry.id}/${v.id}.jpg`,
      compare: fs.existsSync(path.join(takeDir, `${v.id}.compare.png`)) ? `takes/${entry.id}/${v.id}.compare.jpg` : null,
      reference: `reference/frames/${v.id}.jpg`,
      previous: prevShot?.image ?? null,
      sha256: entry.images?.[v.id] ?? v.sha256 ?? null,
      metrics,
      deltas: deltas(metrics, prevShot?.metrics ?? null),
      callouts: [...(callouts[v.id] ?? []), ...(auto[v.id] ?? [])],
      refCallouts: refCallouts[v.id] ?? [],
      depth: m.depth ?? null,
      captureMs: v.captureMs ?? v.ms ?? null,
    };
  });
  const items = {};
  for (const [id, it] of Object.entries(score.items ?? {})) items[id] = { status: it.status, value: it.value ?? null, threshold: it.threshold ?? null, delta: it.delta ?? null, verify: it.verify, autoStatus: it.autoStatus ?? null };
  return {
    id: entry.id,
    number: entry.number,
    at: entry.at,
    // capture/record time when a concurrent publish resequenced the ordering time (else = at)
    capturedAt: entry.capturedAt ?? entry.at,
    resequenced: entry.resequenced ?? false,
    agent: entry.agent,
    sha: entry.sha,
    shortSha: entry.shortSha,
    branch: entry.branch,
    subject: entry.subject,
    phase,
    items: entry.items,
    note: entry.note,
    slate: { scene: sceneVp.charAt(0), sceneTitle: sceneMeta?.label ?? sceneVp, take: entry.number, director: entry.agent, camera: `${rendererShort(stats.renderer)} · ${stats.width ?? 1280}×${stats.height ?? 720}`, roll: `phase-${phase}` },
    shots,
    score: { passed: score.passed, total: score.total, phaseRequired: score.phaseRequired, phasePassed: score.phasePassed, items },
    stats: { drawCalls: maxOf('drawCalls'), triangles: maxOf('triangles'), captureMs: stats.durationMs ?? null, renderer: rendererShort(stats.renderer) },
    attestation: entry.attestation,
    valid: entry.valid !== false,
    invalid: entry.invalid ?? null,
    regressed: entry.regressed ?? [],
    flags: entry.flags ?? [],
    unclaimed: entry.unclaimed ?? false,
    imported: entry.imported ?? null,
  };
}

async function toJpeg(src, dst, { width = 1280, quality = 82 } = {}) {
  await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toFile(dst);
}

/**
 * Apply the local ledger + one new take to the monitor checkout: reconcile ledgers, write take
 * assets, regenerate takes.json / agents.json, copy rubric + reference frames. Returns { takeId, record }.
 */
export async function applyToMonitor({ monitorDir = MONITOR_DIR, localLedgerPath, entry, takeDir, rubric, callouts, refCallouts, phase = 1, distDir = DIST_DIR, log = console.error }) {
  const dataDir = monitorDataDir(monitorDir);
  fs.mkdirSync(dataDir, { recursive: true });
  const local = loadLedger(localLedgerPath);
  const monitorLedgerPath = path.join(dataDir, 'ledger.json');
  const remote = fs.existsSync(monitorLedgerPath) ? loadLedger(monitorLedgerPath) : { ...local, entries: [] };
  const { ledger: merged, rebased } = mergeLedgers(remote, local);
  if (rebased.length) log(`monitor: rebased ${rebased.length} local take(s) onto the monitor ledger (${rebased.join(', ')})`);
  saveLedger(monitorLedgerPath, merged);
  saveLedger(localLedgerPath, merged);
  const idty = entryIdentity(entry);
  const sealed = merged.entries.find((e) => entryIdentity(e) === idty);
  if (!sealed) throw new Error('new take entry not found in merged ledger');
  const takeId = sealed.id;

  const takes = readTakes(monitorDir);
  takes.takes = takes.takes.filter((t) => t.id !== takeId);
  const previous = takes.takes.length ? takes.takes[takes.takes.length - 1] : null;
  const record = buildTakeRecord({ entry: sealed, takeDir, rubric, previous, callouts, refCallouts, phase });
  const dest = path.join(dataDir, 'takes', takeId);
  fs.mkdirSync(dest, { recursive: true });
  for (const shot of record.shots) {
    await toJpeg(path.join(takeDir, `${shot.viewpoint}.png`), path.join(dest, `${shot.viewpoint}.jpg`));
    if (shot.compare) await toJpeg(path.join(takeDir, `${shot.viewpoint}.compare.png`), path.join(dest, `${shot.viewpoint}.compare.jpg`), { width: 1920, quality: 80 });
  }
  for (const f of ['score.json', 'audit.json', 'checks.json', 'compare.json', 'stats.json']) {
    const src = path.join(takeDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, f));
  }
  takes.takes.push(record);
  takes.takes.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  takes.updatedAt = new Date().toISOString();
  takes.monitorCadenceMinutes ??= 60;
  takes.project ??= 'zeldaremake';
  writeJson(path.join(dataDir, 'takes.json'), takes);
  writeJson(path.join(dataDir, 'agents.json'), buildAgentsJson());
  fs.copyFileSync(RUBRIC_PATH, path.join(dataDir, 'rubric.json'));
  const refOut = path.join(dataDir, 'reference/frames');
  fs.mkdirSync(refOut, { recursive: true });
  if (fs.existsSync(REFERENCE_FRAMES)) for (const f of fs.readdirSync(REFERENCE_FRAMES)) if (/\.jpg$/i.test(f)) fs.copyFileSync(path.join(REFERENCE_FRAMES, f), path.join(refOut, f));
  const tl = path.join(REFERENCE_FRAMES, 'timeline');
  if (fs.existsSync(tl)) {
    const tlOut = path.join(refOut, 'timeline');
    fs.mkdirSync(tlOut, { recursive: true });
    const frames = [];
    for (const f of fs.readdirSync(tl).sort()) if (/\.jpg$/i.test(f)) {
      fs.copyFileSync(path.join(tl, f), path.join(tlOut, f));
      const n = parseInt(f.replace(/\D/g, ''), 10);
      frames.push({ file: f, seconds: Number.isFinite(n) ? (n - 0.5) * 2 : null });
    }
    writeJson(path.join(tlOut, 'index.json'), { frames });
  }
  fs.writeFileSync(path.join(monitorDir, 'README.txt'), `Director's Monitor — deployed site (root) + data (data/). Written only by gauntlet/scripts/take.mjs --publish and CI. See site/SCHEMA.md on the code branch. Do not edit by hand.\n`);
  syncSiteFiles(monitorDir);
  // the walkable build under play/ must be the build that was captured: callers pass the dist
  // they captured from (take.mjs verifies its hash against stats.distHash first)
  syncPlayBuild(monitorDir, distDir);
  return { takeId, record, takes };
}

/** Touch takes.json.updatedAt (heartbeat) without a new take. */
export function heartbeat({ monitorDir = MONITOR_DIR, reason = 'heartbeat' } = {}) {
  const takes = readTakes(monitorDir);
  takes.updatedAt = new Date().toISOString();
  takes.heartbeat = { at: takes.updatedAt, reason };
  const dataDir = monitorDataDir(monitorDir);
  fs.mkdirSync(dataDir, { recursive: true });
  writeJson(path.join(dataDir, 'takes.json'), takes);
  writeJson(path.join(dataDir, 'agents.json'), buildAgentsJson());
  syncSiteFiles(monitorDir);
  return takes;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Commit everything in the monitor checkout and push with retries. On a rejected push the remote
 * head is fetched and either `onRetry()` regenerates the data on top of it (preferred — takes.json
 * is not mergeable text) or a `git pull --rebase` is attempted.
 */
export async function commitAndPush({ monitorDir = MONITOR_DIR, message, attempts = 4, log = console.error, onRetry = null } = {}) {
  const commit = () => {
    git(['add', '-A'], { cwd: monitorDir });
    if (!git(['status', '--porcelain'], { cwd: monitorDir }).trim()) return false;
    git(['commit', '-q', '-m', message, `--author=${BOT_NAME} <${BOT_EMAIL}>`], { cwd: monitorDir, env: botEnv });
    return true;
  };
  if (!commit()) {
    log('monitor: nothing to commit');
    return { pushed: false, reason: 'nothing to commit' };
  }
  let lastErr = null;
  for (let i = 1; i <= attempts; i++) {
    const r = tryGit(['push', '-q', 'origin', `${MONITOR_BRANCH}:${MONITOR_BRANCH}`], { cwd: monitorDir, quiet: true });
    if (typeof r === 'string') return { pushed: true, attempts: i, head: git(['rev-parse', 'HEAD'], { cwd: monitorDir }).trim() };
    lastErr = r.error;
    log(`monitor: push rejected (attempt ${i}/${attempts}) — ${String(lastErr?.message ?? lastErr).split('\n')[0]}`);
    if (i === attempts) break;
    await sleep(1000 * 2 ** i);
    const fetched = tryGit(['fetch', '-q', 'origin', MONITOR_BRANCH], { cwd: monitorDir, quiet: true });
    if (typeof fetched !== 'string') continue;
    if (onRetry) {
      git(['reset', '-q', '--hard', 'FETCH_HEAD'], { cwd: monitorDir });
      git(['clean', '-qfd'], { cwd: monitorDir });
      await onRetry();
      commit();
    } else {
      const rb = tryGit(['pull', '-q', '--rebase', '-X', 'theirs', 'origin', MONITOR_BRANCH], { cwd: monitorDir, quiet: true, env: botEnv });
      if (typeof rb !== 'string') {
        tryGit(['rebase', '--abort'], { cwd: monitorDir, quiet: true });
        git(['reset', '-q', '--hard', 'FETCH_HEAD'], { cwd: monitorDir });
      }
    }
  }
  throw new Error(`monitor: push failed after ${attempts} attempts: ${lastErr?.message ?? lastErr}`);
}
