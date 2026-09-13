#!/usr/bin/env node
/**
 * Score a capture against the 50-item rubric.
 *
 *   node gauntlet/scripts/score.mjs --in gauntlet/out/last [--previous gauntlet/out/prev] [--previous-score path/score.json]
 *                                   [--ledger gauntlet/ledger.json] [--agent <id>] [--reviews gauntlet/reviews] [--json]
 *                                   [--md summary.md --artifact-url <url> --title "…"]   (markdown for PR comments / step summary)
 *
 * Reads audit.json, stats.json, compare.json, checks.json and console.log from the capture dir plus
 * the cross-review verdicts, evaluates every rubric check (lib/rubric-eval.mjs), cross-checks the
 * audit against the scene graph (anti-cheat B3) and the placement evidence (B4), computes deltas
 * against the previous take and writes <in>/score.json. Prints a pass/fail/pending table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, LEDGER_PATH, REVIEWS_DIR, readJson, resolveArg, rel, loadRubric } from './lib/paths.mjs';
import { parseArgs, fmtNum, pad } from './lib/cli.mjs';
import { evaluateRubric, resolvePath, countConsoleErrors, improvementDirection } from './lib/rubric-eval.mjs';
import { loadReviews } from './lib/reviews.mjs';
import { loadLedger } from './lib/ledger.mjs';

/** Rule B3: audit claims that must be backed by the scene graph roll-up (`audit.scene.bySystem`). */
export const CROSS_CHECKS = [
  { path: 'systems.vegetation.grassInstances', group: 'vegetation', what: 'grass instances' },
  { path: 'systems.hardscape.flagstones', group: 'hardscape', what: 'flagstones' },
  { path: 'systems.trees.whiteBarkInstances', group: 'trees', what: 'white-bark trees' },
  { path: 'systems.atmosphere.fallingLeaves', group: 'atmosphere', what: 'falling leaves' },
  { path: 'systems.atmosphere.fireflies', group: 'atmosphere', what: 'fireflies' },
  { path: 'systems.rocks.pebbles', group: 'rocks', what: 'pebbles' },
];

/** Rule B4: a system that claims these counts must expose the matching samplePositions. */
export const PLACEMENT_CLAIMS = {
  'systems.vegetation.samplePositions.litter': ['systems.vegetation.litter'],
  'systems.vegetation.samplePositions.grass': ['systems.vegetation.grassInstances'],
  'systems.trees.samplePositions.bases': ['systems.trees.giants', 'systems.trees.whiteBarkInstances'],
  'systems.rocks.samplePositions.boulders': ['systems.rocks.heroBoulders'],
  'systems.structures.samplePositions.bases': ['systems.structures.houses'],
};

export function crossCheckAudit(audit) {
  const results = [];
  for (const cc of CROSS_CHECKS) {
    const claimed = resolvePath(audit, cc.path);
    if (typeof claimed !== 'number' || claimed <= 0) continue;
    const actual = audit?.scene?.bySystem?.[cc.group]?.instances ?? 0;
    const ok = claimed <= actual;
    results.push({ rule: 'B3', path: cc.path, claimed, actual, group: cc.group, ok, message: ok ? `${cc.path}=${claimed} ≤ ${cc.group} instances ${actual}` : `${cc.path}=${claimed} exceeds instances found under scene group "${cc.group}" (${actual})` });
  }
  return results;
}

export function placementClaimCheck(audit, checks, rubric) {
  const results = [];
  const placementPaths = new Set((rubric?.items ?? []).flatMap((it) => (it.checks ?? []).filter((c) => c.type === 'placement').map((c) => c.path)));
  for (const p of placementPaths) {
    const countPaths = PLACEMENT_CLAIMS[p] ?? [];
    const claims = countPaths.map((cp) => [cp, resolvePath(audit, cp)]).filter(([, v]) => typeof v === 'number' && v > 0);
    if (!claims.length) continue;
    const ev = checks?.placements?.[p];
    const samples = Array.isArray(resolvePath(audit, p)) ? resolvePath(audit, p).length : 0;
    if (!ev || ev.missing || samples === 0) {
      results.push({ rule: 'B4', path: p, ok: false, message: `${p} missing while ${claims.map(([k, v]) => `${k}=${v}`).join(', ')} is claimed` });
    } else if (samples < 20 && claims.some(([, v]) => v >= 100)) {
      results.push({ rule: 'B4', path: p, ok: false, message: `${p} has only ${samples} samples for ${claims.map(([k, v]) => `${k}=${v}`).join(', ')} (need ≥ 20)` });
    } else results.push({ rule: 'B4', path: p, ok: true, message: `${p}: ${samples} samples spot-checked (${((ev.passFraction ?? 0) * 100).toFixed(1)} % seated)` });
  }
  return results;
}

export function loadEvidence(inDir, { reviewsDir = REVIEWS_DIR, author = null } = {}) {
  const audit = readJson(path.join(inDir, 'audit.json'), null);
  const stats = readJson(path.join(inDir, 'stats.json'), null);
  const compare = readJson(path.join(inDir, 'compare.json'), null);
  const checks = readJson(path.join(inDir, 'checks.json'), null) ?? audit?.checks ?? null;
  const consoleFile = path.join(inDir, 'console.log');
  const consoleErrors = fs.existsSync(consoleFile) ? countConsoleErrors(fs.readFileSync(consoleFile, 'utf8')) : null;
  return { audit, stats, compare, checks, consoleErrors, reviews: loadReviews(reviewsDir), author };
}

function itemsStatusMap(score) {
  if (!score?.items) return null;
  const out = {};
  for (const [id, it] of Object.entries(score.items)) out[id] = typeof it === 'string' ? it : it.status;
  return out;
}

const STATUS_RANK = { fail: 0, pending: 1, pass: 2 };

export function computeDeltas(current, previousScore, previousStatuses) {
  const prevStatuses = itemsStatusMap(previousScore) ?? previousStatuses ?? null;
  const regressions = [];
  const improvements = [];
  for (const [id, it] of Object.entries(current.items)) {
    const prevStatus = prevStatuses?.[id] ?? null;
    const prevItem = previousScore?.items?.[id] && typeof previousScore.items[id] === 'object' ? previousScore.items[id] : null;
    it.previousStatus = prevStatus;
    it.statusDelta = prevStatus && prevStatus !== it.status ? `${prevStatus}→${it.status}` : null;
    it.valueDelta = null;
    it.trend = '';
    const pc = it.primaryCheck != null ? it.checks[it.primaryCheck] : null;
    const prevCheck = pc && prevItem?.checks?.[it.primaryCheck];
    if (pc && prevCheck && prevCheck.type === pc.type && (prevCheck.path ?? prevCheck.metric ?? prevCheck.layout ?? prevCheck.x) === (pc.path ?? pc.metric ?? pc.layout ?? pc.x) && typeof pc.value === 'number' && typeof prevCheck.value === 'number') {
      const d = pc.value - prevCheck.value;
      if (d !== 0) {
        it.valueDelta = Number(d.toFixed(4));
        const dir = improvementDirection(pc);
        if (dir !== 0) it.trend = dir * d > 0 ? '▲' : '▼';
      }
    }
    if (prevStatus && prevStatus !== it.status) {
      it.trend = STATUS_RANK[it.status] > STATUS_RANK[prevStatus] ? '▲' : '▼';
      if (prevStatus === 'pass' && it.status === 'fail') regressions.push(id);
      if (it.status === 'pass') improvements.push(id);
    }
    it.delta = it.statusDelta ?? (it.valueDelta != null ? `${it.valueDelta > 0 ? '+' : ''}${fmtNum(it.valueDelta)}` : null);
  }
  return { regressions, improvements };
}

/**
 * Score a capture directory. `previous` may be { scoreJson, statuses, takeId, sha } (any subset).
 */
export function scoreDir({ inDir, rubric = loadRubric(), previous = {}, author = null, sha = null, reviewsDir = REVIEWS_DIR, write = true } = {}) {
  const ev = loadEvidence(inDir, { reviewsDir, author });
  if (!ev.audit) throw new Error(`no audit.json in ${inDir}`);
  const result = evaluateRubric(rubric, ev);
  const cross = crossCheckAudit(ev.audit);
  const placement = placementClaimCheck(ev.audit, ev.checks, rubric);
  const flags = [];
  for (const cc of cross) {
    if (cc.ok) continue;
    flags.push(`B3 ${cc.message}`);
    for (const it of Object.values(result.items)) {
      if (it.checks.some((c) => c.type === 'audit' && c.path === cc.path)) {
        it.status = 'fail';
        it.flag = `B3 audit mismatch: ${cc.message}`;
      }
    }
  }
  for (const pc of placement) {
    if (pc.ok) continue;
    flags.push(`B4 ${pc.message}`);
    for (const it of Object.values(result.items)) {
      if (it.checks.some((c) => c.type === 'placement' && c.path === pc.path)) {
        it.status = 'fail';
        it.flag ??= `B4 ${pc.message}`;
      }
    }
  }
  // re-count after flags forced failures
  const prefix = rubric.phaseRequired?.[String(result.phase)] ?? 'W';
  result.passed = Object.values(result.items).filter((i) => i.status === 'pass').length;
  result.failed = Object.values(result.items).filter((i) => i.status === 'fail').length;
  result.pending = Object.values(result.items).filter((i) => i.status === 'pending').length;
  result.phasePassed = Object.values(result.items).filter((i) => i.id.startsWith(prefix) && i.status === 'pass').length;

  const { regressions, improvements } = computeDeltas(result, previous.scoreJson ?? null, previous.statuses ?? null);
  const weightTotal = rubric.items.reduce((a, i) => a + (i.weight ?? 1), 0);
  const weightPassed = rubric.items.filter((i) => result.items[i.id].status === 'pass').reduce((a, i) => a + (i.weight ?? 1), 0);
  const score = {
    generatedAt: new Date().toISOString(),
    in: rel(inDir),
    sha: sha ?? ev.stats?.git?.sha ?? null,
    shortSha: (sha ?? ev.stats?.git?.sha ?? '').slice(0, 7) || null,
    agent: author,
    passed: result.passed,
    total: result.total,
    failed: result.failed,
    pending: result.pending,
    phase: result.phase,
    phasePassed: result.phasePassed,
    phaseRequired: result.phaseRequired,
    weightPassed,
    weightTotal,
    consoleErrors: ev.consoleErrors,
    previous: { takeId: previous.takeId ?? null, sha: previous.sha ?? null, passed: previous.scoreJson?.passed ?? previous.passed ?? null, source: previous.source ?? (previous.scoreJson ? 'score.json' : previous.statuses ? 'ledger' : null) },
    regressions,
    improvements,
    flags,
    crossChecks: [...cross, ...placement],
    items: result.items,
  };
  if (write) fs.writeFileSync(path.join(inDir, 'score.json'), JSON.stringify(score, null, 2));
  return score;
}

const SYMBOL = { pass: '✓ pass', fail: '✗ fail', pending: '… pend' };

export function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return fmtNum(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v.length > 20 ? v.slice(0, 19) + '…' : v;
  if (Array.isArray(v)) return `[${v.length}]`;
  return JSON.stringify(v).slice(0, 20);
}

export function renderTable(score, { showAll = true } = {}) {
  const lines = [];
  const head = `${pad('ID', 4)} ${pad('status', 7)} ${pad('value', 20)} ${pad('threshold', 22)} ${pad('Δ prev', 14)} ${pad('vp', 10)} title`;
  lines.push(head);
  lines.push('─'.repeat(head.length + 20));
  let lastGroup = null;
  for (const it of Object.values(score.items)) {
    if (!showAll && it.status === 'pass' && !it.statusDelta) continue;
    if (it.group !== lastGroup) {
      lines.push(`  · ${it.group}`);
      lastGroup = it.group;
    }
    const auto = it.verify === 'both' && it.autoStatus ? ` (auto ${it.autoStatus})` : '';
    const delta = it.delta ? `${it.trend} ${it.delta}`.trim() : '';
    lines.push(`${pad(it.id, 4)} ${pad(SYMBOL[it.status] ?? it.status, 7)} ${pad(formatValue(it.value), 20, true)} ${pad(it.threshold ?? '', 22)} ${pad(delta, 14)} ${pad(it.viewpoint ?? '', 10)} ${it.title}${auto}${it.flag ? `  ⚑ ${it.flag}` : ''}`);
  }
  lines.push('─'.repeat(head.length + 20));
  const prev = score.previous?.passed != null ? ` (prev ${score.previous.passed}${score.previous.takeId ? ` @${score.previous.takeId}` : ''})` : '';
  lines.push(`passed ${score.passed}/${score.total}${prev} · phase ${score.phase}: ${score.phasePassed}/${score.phaseRequired} · failed ${score.failed} · pending ${score.pending} · weight ${score.weightPassed}/${score.weightTotal}`);
  if (score.improvements?.length) lines.push(`▲ improved: ${score.improvements.join(', ')}`);
  if (score.regressions?.length) lines.push(`▼ REGRESSED: ${score.regressions.join(', ')}`);
  for (const f of score.flags ?? []) lines.push(`⚑ FLAG ${f}`);
  return lines.join('\n');
}

const MD_SYMBOL = { pass: '✅', fail: '❌', pending: '⏳' };

/**
 * GitHub-flavoured markdown summary (PR comment / step summary). `compare` adds a per-viewpoint
 * metrics table; `artifactUrl` turns the viewpoint names into links to the run's artifact.
 */
export function renderMarkdown(score, { compare = null, artifactUrl = null, title = 'Gauntlet score' } = {}) {
  const md = [];
  const prev = score.previous?.passed != null ? ` (prev ${score.previous.passed}${score.previous.takeId ? ` @ ${score.previous.takeId}` : ''})` : '';
  md.push(`### ${title}: ${score.passed}/${score.total} pass${prev} · phase ${score.phase} ${score.phasePassed}/${score.phaseRequired} · ${score.failed} fail · ${score.pending} pending`);
  if (score.shortSha) md.push(`\nCommit \`${score.shortSha}\`${score.consoleErrors != null ? ` · console errors: ${score.consoleErrors}` : ''}`);
  if (score.improvements?.length) md.push(`\n▲ improved: ${score.improvements.join(', ')}`);
  if (score.regressions?.length) md.push(`\n▼ **REGRESSED**: ${score.regressions.join(', ')}`);
  for (const f of score.flags ?? []) md.push(`\n⚑ **FLAG** ${f}`);
  if (compare?.viewpoints) {
    md.push('\n| viewpoint | SSIM | pHash | hue Δ° | sat Δ | lum Δ | sharp × | sky | over-exp | det | motion |');
    md.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [vp, m] of Object.entries(compare.viewpoints)) {
      const name = artifactUrl ? `[${vp}](${artifactUrl})` : vp;
      const f = (v, d = 3) => (typeof v === 'number' ? fmtNum(v, d) : '—');
      md.push(`| ${name} | ${f(m.ssim)} | ${f(m.phashDistance, 0)} | ${f(m.hueDiffDeg, 1)} | ${f(m.satDiff)} | ${f(m.lumDiff)} | ${f(m.sharpnessRatio, 2)} | ${f(m.skyFraction, 2)} | ${f(m.overexposedFraction, 3)} | ${f(m.determinismDiff, 4)} | ${typeof m.motionRegionsMoving === 'number' ? `${m.motionRegionsMoving}/16` : '—'} |`);
    }
    if (artifactUrl) md.push(`\nScreenshots and \`*.compare.png\` strips are in the [run artifact](${artifactUrl}).`);
  }
  md.push('\n<details><summary>Rubric items</summary>\n');
  md.push('| id | status | value | threshold | Δ prev | vp | title |');
  md.push('|---|---|---|---|---|---|---|');
  for (const it of Object.values(score.items)) {
    const auto = it.verify === 'both' && it.autoStatus ? ` (auto ${it.autoStatus})` : '';
    const delta = it.delta ? `${it.trend ?? ''} ${it.delta}`.trim() : '';
    const esc = (s) => String(s ?? '').replace(/\|/g, '\\|');
    md.push(`| ${it.id} | ${MD_SYMBOL[it.status] ?? it.status} ${it.status} | ${esc(formatValue(it.value))} | ${esc(it.threshold ?? '')} | ${esc(delta)} | ${it.viewpoint ?? ''} | ${esc(it.title)}${auto}${it.flag ? ` ⚑ ${esc(it.flag)}` : ''} |`);
  }
  md.push('\n</details>');
  return md.join('\n');
}

/** Find the previous take's score for deltas: explicit dir/file, else the ledger's last valid entry. */
export function findPrevious({ previousDir, previousScore, ledgerPath = LEDGER_PATH, excludeSha = null } = {}) {
  if (previousScore && fs.existsSync(previousScore)) return { scoreJson: readJson(previousScore), source: rel(previousScore) };
  if (previousDir && fs.existsSync(path.join(previousDir, 'score.json'))) {
    const sj = readJson(path.join(previousDir, 'score.json'));
    return { scoreJson: sj, sha: sj.sha, source: rel(previousDir) };
  }
  const ledger = loadLedger(ledgerPath);
  const entries = ledger.entries.filter((e) => e.valid !== false && (!excludeSha || e.sha !== excludeSha));
  const last = entries.length ? entries[entries.length - 1] : null;
  if (last?.score?.items) return { statuses: last.score.items, takeId: last.id, sha: last.sha, passed: last.score.passed, source: 'ledger' };
  return {};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const inDir = resolveArg(args.in, 'gauntlet/out/last');
  const previousDir = args.previous ? resolveArg(args.previous) : inDir === path.join(ROOT, 'gauntlet/out/last') ? path.join(ROOT, 'gauntlet/out/prev') : null;
  try {
    const previous = findPrevious({ previousDir, previousScore: args['previous-score'] ? resolveArg(args['previous-score']) : null, ledgerPath: resolveArg(args.ledger, LEDGER_PATH) });
    const score = scoreDir({ inDir, previous, author: typeof args.agent === 'string' ? args.agent : null, reviewsDir: resolveArg(args.reviews, REVIEWS_DIR) });
    if (typeof args.md === 'string') {
      const compare = readJson(path.join(inDir, 'compare.json'), null);
      fs.writeFileSync(resolveArg(args.md), renderMarkdown(score, { compare, artifactUrl: typeof args['artifact-url'] === 'string' ? args['artifact-url'] : null, title: typeof args.title === 'string' ? args.title : 'Gauntlet score' }) + '\n');
    }
    if (args.json) console.log(JSON.stringify(score, null, 2));
    else {
      console.log(renderTable(score, { showAll: !args.short }));
      console.log(`wrote ${rel(path.join(inDir, 'score.json'))}${typeof args.md === 'string' ? ` and ${rel(resolveArg(args.md))}` : ''}`);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
