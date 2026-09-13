#!/usr/bin/env node
/**
 * Anti-cheat — every rule of GAUNTLET.md §4, printed as `✓/✗ <ruleId> <message>` (⚠ = warning).
 *
 *   node gauntlet/scripts/anti-cheat.mjs                         source checks + the take in gauntlet/out/last (if any)
 *   node gauntlet/scripts/anti-cheat.mjs --take gauntlet/out/ci  source checks + a specific capture dir
 *   node gauntlet/scripts/anti-cheat.mjs --skip-capture-checks   source-only mode (CI on pull requests)
 *   node gauntlet/scripts/anti-cheat.mjs --verify-exit           adds D4–D8 / E1–E3 (see gauntlet.mjs --verify-exit)
 *   options: --ledger <path> --agent <id> --json
 *
 * Exit code 1 on any ✗.
 *
 *   A1–A4  rubric integrity (rubric-lock.mjs)            source
 *   B1–B6  evidence integrity                            take dir
 *   C1,C2,C4,C5  content integrity                       source      C2-runtime, C3  take dir
 *   D1–D3, D8  process integrity                         source (ledger, claims, PROJECT_STATE)
 *   D4–D7, E1–E3  exit conditions                        --verify-exit
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { ROOT, LEDGER_PATH, CLAIMS_PATH, LOCK_PATH, BASELINE_PATH, RUBRIC_PATH, REFERENCE_PHASH, LAST_DIR, DIST_DIR, REPORTS_DIR, readJson, resolveArg, rel, loadRubric } from './lib/paths.mjs';
import { parseArgs } from './lib/cli.mjs';
import { rubricHash, compareStrictness, renderMarkdown } from './rubric-lock.mjs';
import { loadLedger, verifyChain } from './lib/ledger.mjs';
import { phash, hamming } from './lib/image.mjs';
import { scoreDir, findPrevious } from './score.mjs';
import { determinismDiff } from './compare.mjs';
import { countConsoleErrors } from './lib/rubric-eval.mjs';

const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.tif', '.tiff']);
const ASSET = new Set([...RASTER, '.glb', '.gltf', '.ktx2', '.hdr', '.exr', '.bin', '.fbx', '.obj', '.mp4', '.webm']);
const TEXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.glsl', '.vert', '.frag', '.wgsl', '.html', '.css', '.json', '.md', '.txt']);
// word boundaries keep `depthTex.compareFunction` / `isVideoTexture` (the detector itself) from matching
export const C2_PATTERN = /(?<!is)VideoTexture|<video|<iframe|\.mp4\b|twimg|\bx\.com\b|from ['"].*reference\/|data:image\/[^"']{50000,}/;
export const C5_PATTERN = /\b(nintendo|zelda|oot)\b|kokiri.*\.(glb|gltf|png)$/i;
export const C1_MAX_HAMMING = 12;
export const RUBRIC_TRAILER = 'Rubric-Change-Approved-By: Leonxlnx';

export class Report {
  constructor() {
    this.results = [];
  }
  pass(rule, message) {
    this.results.push({ rule, level: 'pass', ok: true, message });
  }
  fail(rule, message) {
    this.results.push({ rule, level: 'fail', ok: false, message });
  }
  warn(rule, message) {
    this.results.push({ rule, level: 'warn', ok: true, message });
  }
  get ok() {
    return this.results.every((r) => r.ok);
  }
  get failures() {
    return this.results.filter((r) => !r.ok);
  }
  print(log = console.log) {
    for (const r of this.results) log(`${r.level === 'pass' ? '✓' : r.level === 'warn' ? '⚠' : '✗'} ${r.rule} ${r.message}`);
  }
}

function git(args, opts = {}) {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'], ...opts }).toString();
  } catch {
    return null;
  }
}

function walk(dir, { skipDirs = [], filter = () => true } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const rec = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const r = rel(p).replace(/\\/g, '/');
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.') || skipDirs.some((s) => r === s || r.startsWith(s + '/'))) continue;
        rec(p);
      } else if (filter(p, r)) out.push(p);
    }
  };
  rec(dir);
  return out;
}

const sha256 = (buf) => 'sha256:' + crypto.createHash('sha256').update(buf).digest('hex');

// ---------------------------------------------------------------- A. rubric integrity

export function checkRubric(report) {
  let rubric;
  try {
    rubric = loadRubric();
  } catch (e) {
    report.fail('A1', `rubric.json unreadable: ${e.message}`);
    return null;
  }
  const lock = fs.existsSync(LOCK_PATH) ? fs.readFileSync(LOCK_PATH, 'utf8').trim() : '';
  const hash = rubricHash();
  if (lock !== hash) report.fail('A1', `RUBRIC.lock (${lock.slice(0, 12)}) ≠ sha256(rubric.json) (${hash.slice(0, 12)})`);
  else report.pass('A1', `rubric.json hash-locked (${hash.slice(0, 12)}…, ${rubric.items.length} items)`);
  const md = path.join(path.dirname(RUBRIC_PATH), 'RUBRIC.md');
  if (fs.existsSync(md) && fs.readFileSync(md, 'utf8').trim() !== renderMarkdown(rubric).trim()) report.fail('A1', 'RUBRIC.md is stale relative to rubric.json');
  if (!fs.existsSync(BASELINE_PATH)) report.fail('A2', 'rubric.baseline.json missing');
  else {
    const problems = compareStrictness(readJson(BASELINE_PATH), rubric);
    const a2 = problems.filter((p) => p.startsWith('A2'));
    const a4 = problems.filter((p) => p.startsWith('A4'));
    if (a2.length) for (const p of a2) report.fail('A2', p.replace(/^A2:\s*/, ''));
    else report.pass('A2', 'no threshold is easier than rubric.baseline.json');
    if (a4.length) for (const p of a4) report.fail('A4', p.replace(/^A4:\s*/, ''));
    else report.pass('A4', 'item id set equals the baseline');
    if (rubric.items.length !== 50) report.fail('A4', `rubric has ${rubric.items.length} items, expected 50`);
  }
  // A3: every commit touching rubric.json after its introduction needs the human trailer + lock update
  const dirty = git(['status', '--porcelain', '--', 'gauntlet/rubric.json']);
  if (dirty === null) report.warn('A3', 'git unavailable — cannot check rubric commit trailers');
  else {
    if (dirty.trim()) report.fail('A3', 'gauntlet/rubric.json has uncommitted changes (agents may only propose changes in RUBRIC_PROPOSALS.md)');
    const log = git(['log', '--format=%H%x1f%B%x1e', '--', 'gauntlet/rubric.json']) ?? '';
    const commits = log
      .split('\x1e')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [sha, body] = s.split('\x1f');
        return { sha, body: body ?? '' };
      });
    const later = commits.slice(0, Math.max(0, commits.length - 1)); // oldest = introduction
    const bad = [];
    for (const c of later) {
      const files = git(['show', '--name-only', '--format=', c.sha]) ?? '';
      if (!c.body.includes(RUBRIC_TRAILER)) bad.push(`${c.sha.slice(0, 7)} lacks trailer "${RUBRIC_TRAILER}"`);
      else if (!files.split('\n').includes('gauntlet/RUBRIC.lock')) bad.push(`${c.sha.slice(0, 7)} did not update RUBRIC.lock`);
    }
    if (bad.length) for (const b of bad) report.fail('A3', b);
    else if (!dirty.trim()) report.pass('A3', `${later.length} rubric edit(s) after introduction, all human-approved`);
  }
  return rubric;
}

// ---------------------------------------------------------------- C. content integrity (source)

export async function checkContent(report, { distDir = DIST_DIR } = {}) {
  // C1 — no reference frame anywhere near a texture
  const refHashes = readJson(REFERENCE_PHASH, null)?.hashes ?? null;
  if (!refHashes) report.warn('C1', 'reference/phash.json missing — cannot compare textures with reference frames');
  else {
    const files = [
      ...walk(path.join(ROOT, 'public'), { filter: (p) => RASTER.has(path.extname(p).toLowerCase()) }),
      ...walk(path.join(ROOT, 'src'), { filter: (p) => RASTER.has(path.extname(p).toLowerCase()) }),
      ...walk(distDir, { filter: (p) => RASTER.has(path.extname(p).toLowerCase()) }),
      ...walk(path.join(ROOT, 'site'), { filter: (p, r) => RASTER.has(path.extname(p).toLowerCase()) && !/(^|\/)data\/reference\//.test(r) && !/^site\/dist\/data\//.test(r) }),
    ];
    const hits = [];
    let scanned = 0;
    for (const f of files) {
      let h;
      try {
        h = await phash(f);
      } catch {
        continue;
      }
      scanned++;
      for (const [refFile, refHash] of Object.entries(refHashes)) {
        const d = hamming(h, refHash);
        if (d <= C1_MAX_HAMMING) hits.push(`${rel(f)} ≈ ${refFile} (Hamming ${d})`);
      }
    }
    if (hits.length) for (const h of hits) report.fail('C1', h);
    else report.pass('C1', `${scanned} raster(s) under public/, src/, dist/, site/ — none within Hamming ${C1_MAX_HAMMING} of a reference frame`);
  }

  // C2 — static scan of src/ (+ index.html)
  const textFiles = [...walk(path.join(ROOT, 'src'), { filter: (p) => TEXT.has(path.extname(p).toLowerCase()) })];
  if (fs.existsSync(path.join(ROOT, 'index.html'))) textFiles.push(path.join(ROOT, 'index.html'));
  const c2 = [];
  for (const f of textFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const m = C2_PATTERN.exec(line);
      if (m) c2.push(`${rel(f)}:${i + 1} matches /${m[0].slice(0, 40)}/`);
    });
    if (/data:image\/[^"']{50000,}/.test(text) && !c2.some((x) => x.startsWith(rel(f)))) c2.push(`${rel(f)} embeds a data-URI image > 50 KB`);
  }
  if (c2.length) for (const x of c2) report.fail('C2', x);
  else report.pass('C2', `${textFiles.length} source file(s) free of video/iframe/reference imports`);

  // C4 — texture credits
  const texRoot = path.join(ROOT, 'public/textures');
  const creditsFile = path.join(texRoot, 'CREDITS.md');
  const credits = fs.existsSync(creditsFile) ? fs.readFileSync(creditsFile, 'utf8') : '';
  const texFiles = walk(texRoot, { filter: (p) => !/^(credits\.md|license(\.txt|\.md)?|readme\.md)$/i.test(path.basename(p)) });
  const uncredited = [];
  for (const f of texFiles) {
    const r = rel(f).replace(/\\/g, '/');
    const set = path.relative(texRoot, path.dirname(f)).split(path.sep)[0] || null;
    const base = path.basename(f);
    let credited = credits.includes(r) || credits.includes(r.replace(/^public\/textures\//, '')) || (set && new RegExp(`(^|[^\\w-])${escapeRe(set)}([^\\w-]|$)`, 'm').test(credits)) || (credits.includes(base) && set && credits.includes(set));
    if (!credited) {
      let d = path.dirname(f);
      while (d.startsWith(texRoot)) {
        if (fs.readdirSync(d).some((n) => /^license(\.txt|\.md)?$/i.test(n))) {
          credited = true;
          break;
        }
        if (d === texRoot) break;
        d = path.dirname(d);
      }
    }
    if (!credited) uncredited.push(r);
  }
  if (uncredited.length) for (const u of uncredited) report.fail('C4', `${u} is not credited in public/textures/CREDITS.md and has no LICENSE.txt`);
  else report.pass('C4', `${texFiles.length} texture file(s) credited`);

  // C5 — no Nintendo assets by name/metadata
  const assetFiles = [
    ...walk(path.join(ROOT, 'public'), { filter: (p) => ASSET.has(path.extname(p).toLowerCase()) }),
    ...walk(path.join(ROOT, 'src'), { filter: (p) => ASSET.has(path.extname(p).toLowerCase()) }),
    ...walk(distDir, { filter: (p) => ASSET.has(path.extname(p).toLowerCase()) }),
  ];
  const c5 = [];
  for (const f of assetFiles) {
    const r = rel(f).replace(/\\/g, '/');
    const reasons = [];
    if (C5_PATTERN.test(r)) reasons.push('filename');
    const ext = path.extname(f).toLowerCase();
    if (['.glb', '.gltf', '.fbx', '.obj'].includes(ext)) {
      const buf = fs.readFileSync(f);
      const text = buf.toString('latin1');
      if (/nintendo|zelda/i.test(text)) reasons.push('embedded metadata');
    }
    if (reasons.length) {
      const line = credits.split('\n').find((l) => l.includes(path.basename(f)) && /original/i.test(l));
      if (!line) c5.push(`${r} (${reasons.join(', ')}) — add a CREDITS.md line proving original authorship`);
    }
  }
  if (c5.length) for (const x of c5) report.fail('C5', x);
  else report.pass('C5', `${assetFiles.length} asset file(s) — no nintendo|zelda|oot|kokiri asset names or metadata`);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------- D. process integrity (source)

export function checkLedger(report, { ledgerPath = LEDGER_PATH, claimsPath = CLAIMS_PATH } = {}) {
  const ledger = loadLedger(ledgerPath);
  const chain = verifyChain(ledger);
  if (!chain.ok) for (const p of chain.problems) report.fail('D1', p);
  else report.pass('D1', `ledger chain intact (${chain.length} entries, ${rel(ledgerPath)})`);

  // D2 — regression tagging must be consistent with the entries' own item statuses
  let prevValid = null;
  const d2 = [];
  for (const e of ledger.entries) {
    const items = e.score?.items;
    if (items && prevValid?.score?.items) {
      const regs = Object.keys(items).filter((id) => prevValid.score.items[id] === 'pass' && items[id] === 'fail');
      const tagged = Array.isArray(e.regressed) ? e.regressed : [];
      const missing = regs.filter((id) => !tagged.includes(id));
      if (missing.length) d2.push(`${e.id} flipped ${missing.join(', ')} pass→fail vs ${prevValid.id} but is not tagged regressed`);
      if (regs.length && e.valid !== false) d2.push(`${e.id} regressed (${regs.join(', ')}) yet is marked valid`);
    }
    if (e.valid !== false) prevValid = e;
  }
  if (d2.length) for (const x of d2) report.fail('D2', x);
  else report.pass('D2', `regression tags consistent (${ledger.entries.filter((e) => e.regressed?.length).length} regressed take(s))`);

  // D3 — claims predate takes
  const claims = readJson(claimsPath, { claims: [] }).claims ?? [];
  const d3fail = [];
  const d3warn = [];
  for (const e of ledger.entries) {
    if (e.agent === 'ci-monitor') continue;
    // claims are judged at the capture/record time, which a concurrent-publish resequence preserves
    const missing = (e.items ?? []).filter((it) => !claimCovers(claims, e.agent, it, e.capturedAt ?? e.at));
    if (!missing.length) continue;
    if (e.unclaimed) d3warn.push(`${e.id} (${e.agent}) targeted unclaimed item(s) ${missing.join(', ')}`);
    else d3fail.push(`${e.id} (${e.agent}) has no live claim for ${missing.join(', ')} at ${e.at}`);
  }
  for (const x of d3fail) report.fail('D3', x);
  for (const x of d3warn) report.warn('D3', x);
  if (!d3fail.length && !d3warn.length) report.pass('D3', `claims predate every take (${claims.length} claim(s) on file)`);

  return { ledger, chain };
}

export function claimCovers(claims, agent, item, at) {
  const t = Date.parse(at);
  return claims.some((c) => {
    if (c.agent !== agent || !Array.isArray(c.items) || !c.items.includes(item)) return false;
    const start = Date.parse(c.at);
    const hours = Number(c.expiresHours ?? 3);
    return Number.isFinite(start) && start <= t && t <= start + hours * 3600_000;
  });
}

export function checkProjectState(report) {
  const file = path.join(ROOT, 'PROJECT_STATE.md');
  if (!fs.existsSync(file)) {
    report.warn('D8', 'PROJECT_STATE.md missing');
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const claim = sentences.find((s) => /phase\s*1/i.test(s) && /\b(complete|completed|done|finished)\b/i.test(s) && !/\b(not|isn't|is not|until|incomplete|only|never|before|unless|declared only|when)\b/i.test(s));
  if (!claim) {
    report.pass('D8', 'PROJECT_STATE.md does not declare Phase 1 complete');
    return;
  }
  const reportFile = path.join(REPORTS_DIR, 'verify-exit.json');
  const rep = readJson(reportFile, null);
  if (rep && rep.pass === true && rep.attestation?.source === 'ci') report.pass('D8', 'Phase 1 completion statement is backed by a CI-attested verify-exit report');
  else report.fail('D8', `PROJECT_STATE.md says "${claim.trim().slice(0, 80)}" but ${rep ? 'gauntlet/reports/verify-exit.json is not a passing CI-attested report' : 'gauntlet/reports/verify-exit.json does not exist'}`);
}

// ---------------------------------------------------------------- B + C runtime (take dir)

export async function checkTake(report, { takeDir, ledgerPath = LEDGER_PATH, rubric = loadRubric(), agent = null } = {}) {
  if (!takeDir || !fs.existsSync(path.join(takeDir, 'audit.json'))) {
    report.fail('B1', `no capture at ${takeDir ? rel(takeDir) : '(none)'} — run npm run capture first`);
    return null;
  }
  const stats = readJson(path.join(takeDir, 'stats.json'), null);
  const audit = readJson(path.join(takeDir, 'audit.json'), {});
  const checks = readJson(path.join(takeDir, 'checks.json'), null) ?? audit.checks ?? null;
  const compare = readJson(path.join(takeDir, 'compare.json'), null);
  const takeMeta = readJson(path.join(takeDir, 'take.json'), null);
  const ledger = loadLedger(ledgerPath);

  // B1 — screenshots come from the renderer: hashes recorded at capture time must match the files
  const b1 = [];
  let checked = 0;
  for (const vp of stats?.viewpoints ?? []) {
    const file = path.join(takeDir, vp.file ?? `${vp.id}.png`);
    if (!fs.existsSync(file)) {
      b1.push(`${vp.id}: ${path.basename(file)} missing`);
      continue;
    }
    const buf = fs.readFileSync(file);
    const h = sha256(buf);
    if (vp.sha256 && vp.sha256 !== h) b1.push(`${vp.id}: file hash ${h.slice(7, 19)} ≠ recorded ${vp.sha256.slice(7, 19)} (image replaced after capture)`);
    try {
      const meta = await sharp(buf).metadata();
      if (stats?.width && stats?.height && (meta.width !== stats.width || meta.height !== stats.height)) b1.push(`${vp.id}: ${meta.width}×${meta.height} ≠ capture size ${stats.width}×${stats.height}`);
    } catch (e) {
      b1.push(`${vp.id}: not a decodable image (${e.message})`);
    }
    if (takeMeta?.images?.[vp.id] && takeMeta.images[vp.id] !== h) b1.push(`${vp.id}: hash differs from the take's ledger record`);
    checked++;
  }
  if (takeMeta?.id) {
    const entry = ledger.entries.find((e) => e.id === takeMeta.id);
    if (!entry) b1.push(`take.json refers to ${takeMeta.id} which is not in ${rel(ledgerPath)}`);
    else for (const [vp, h] of Object.entries(entry.images ?? {})) if (takeMeta.images?.[vp] && takeMeta.images[vp] !== h) b1.push(`${vp}: ledger hash ≠ take.json hash`);
  }
  if (!stats) b1.push('stats.json missing');
  if (b1.length) for (const x of b1) report.fail('B1', x);
  else if (stats?.viewpoints?.some((v) => !v.sha256)) report.warn('B1', `${checked} screenshot(s) verified by size only — stats.json predates hash recording`);
  else report.pass('B1', `${checked} screenshot(s) match the hashes recorded by capture.mjs${takeMeta?.id ? ` and ledger ${takeMeta.id}` : ''}`);

  // B2 — attestation
  const att = takeMeta?.attestation ?? null;
  if (!att) report.pass('B2', `capture not yet in the ledger (attestation assigned by take.mjs; this run is ${process.env.GITHUB_ACTIONS ? 'ci' : 'local'})`);
  else if (!['ci', 'local'].includes(att.source)) report.fail('B2', `attestation.source "${att.source}" is not ci|local`);
  else if (att.source === 'ci' && (!att.runId || !att.url)) report.fail('B2', 'attestation claims ci without runId/url');
  else report.pass('B2', `attestation ${att.source}${att.runId ? ` run ${att.runId}` : ''}${att.source === 'local' ? ' (does not count toward verify-exit)' : ''}`);

  // B3/B4 — via score (flags)
  let score = null;
  try {
    const previous = findPrevious({ ledgerPath, excludeSha: stats?.git?.sha ?? null });
    score = scoreDir({ inDir: takeDir, rubric, previous, author: agent ?? takeMeta?.agent ?? null, write: false });
  } catch (e) {
    report.fail('B3', `score failed: ${e.message}`);
  }
  if (score) {
    const b3 = score.flags.filter((f) => f.startsWith('B3'));
    const b4 = score.flags.filter((f) => f.startsWith('B4'));
    if (b3.length) for (const f of b3) report.fail('B3', f.replace(/^B3\s*/, ''));
    else report.pass('B3', `${score.crossChecks.filter((c) => c.rule === 'B3').length} audit claim(s) cross-checked against the scene graph`);
    if (b4.length) for (const f of b4) report.fail('B4', f.replace(/^B4\s*/, ''));
    else report.pass('B4', `${score.crossChecks.filter((c) => c.rule === 'B4').length} placement sample set(s) spot-checked`);
  }

  // B5 — determinism
  const detVp = checks?.determinism?.viewpoint ?? 'A_stairs';
  let det = compare?.viewpoints?.[detVp]?.determinismDiff;
  if (typeof det !== 'number') {
    const a = path.join(takeDir, `${detVp}.png`);
    const b = path.join(takeDir, `${detVp}.det.png`);
    if (fs.existsSync(a) && fs.existsSync(b)) det = await determinismDiff(a, b);
  }
  if (typeof det !== 'number') report.warn('B5', `no determinism re-capture (${detVp}.det.png) in this take`);
  else if (det > 0.005) report.fail('B5', `${detVp} re-capture differs in ${(det * 100).toFixed(2)} % of pixels (limit 0.5 %)`);
  else report.pass('B5', `${detVp} re-capture differs in ${(det * 100).toFixed(3)} % of pixels`);

  // B6 — console
  const consoleFile = path.join(takeDir, 'console.log');
  const errors = fs.existsSync(consoleFile) ? countConsoleErrors(fs.readFileSync(consoleFile, 'utf8')) : null;
  if (errors === null) report.fail('B6', 'console.log missing');
  else if (errors > 0) report.fail('B6', `${errors} console/page error(s) during capture`);
  else report.pass('B6', 'console clean during capture');

  // C2 runtime — forbidden textures in the live scene
  const forbidden = audit?.scene?.forbidden ?? [];
  if (forbidden.length) for (const f of forbidden) report.fail('C2', `runtime: ${f}`);
  else report.pass('C2', 'runtime scene has no video/reference textures');

  // C3 — depth histogram: no flat backdrop
  const hero = rubric.heroViewpoints ?? [];
  const c3 = [];
  let c3n = 0;
  for (const vp of hero) {
    const d = checks?.depth?.[vp];
    if (!d) continue;
    c3n++;
    if (d.maxBucketBeyond20m > 0.35) c3.push(`${vp}: one 1 % depth bucket beyond 20 m holds ${(d.maxBucketBeyond20m * 100).toFixed(1)} % of pixels (limit 35 %)`);
  }
  if (c3.length) for (const x of c3) report.fail('C3', x);
  else if (!c3n) report.warn('C3', 'no depth histograms in this capture');
  else report.pass('C3', `${c3n} hero viewpoint(s) have layered depth (max bucket beyond 20 m ≤ 35 %)`);

  return { score, stats, audit, checks, compare, takeMeta };
}

// ---------------------------------------------------------------- driver

export async function runAntiCheat({ takeDir = null, skipCapture = false, ledgerPath = LEDGER_PATH, claimsPath = CLAIMS_PATH, reviewsDir = undefined, reportPath = undefined, agent = null, verifyExit = false, log = console.log } = {}) {
  const report = new Report();
  const rubric = checkRubric(report);
  await checkContent(report);
  checkLedger(report, { ledgerPath, claimsPath });
  checkProjectState(report);
  let take = null;
  if (!skipCapture) {
    const dir = takeDir ?? (fs.existsSync(path.join(LAST_DIR, 'audit.json')) ? LAST_DIR : null);
    if (!dir) report.warn('B1', 'no capture found (gauntlet/out/last) — capture checks skipped; run npm run capture');
    else if (rubric) take = await checkTake(report, { takeDir: dir, ledgerPath, rubric, agent });
  }
  let exit = null;
  if (verifyExit) {
    const { verifyExit: run } = await import('./lib/exit.mjs');
    exit = await run({ ledgerPath, report, ...(reviewsDir ? { reviewsDir } : {}), ...(reportPath ? { reportPath } : {}) });
  }
  return { report, take, exit };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  runAntiCheat({
    takeDir: args.take ? resolveArg(args.take) : null,
    skipCapture: !!args['skip-capture-checks'],
    ledgerPath: resolveArg(args.ledger, LEDGER_PATH),
    claimsPath: resolveArg(args.claims, CLAIMS_PATH),
    reviewsDir: typeof args.reviews === 'string' ? resolveArg(args.reviews) : undefined,
    reportPath: typeof args.report === 'string' ? resolveArg(args.report) : undefined,
    agent: typeof args.agent === 'string' ? args.agent : null,
    verifyExit: !!args['verify-exit'],
  })
    .then(({ report }) => {
      if (args.json) console.log(JSON.stringify(report.results, null, 2));
      else {
        report.print();
        console.log(report.ok ? `✓ anti-cheat green (${report.results.length} checks, ${report.results.filter((r) => r.level === 'warn').length} warnings)` : `✗ anti-cheat: ${report.failures.length} failure(s): ${[...new Set(report.failures.map((f) => f.rule))].join(', ')}`);
      }
      process.exit(report.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
