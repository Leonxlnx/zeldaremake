#!/usr/bin/env node
/**
 * take.mjs — one iteration of the gauntlet loop (GAUNTLET.md §1 step 4, §5).
 *
 *   npm run take -- --agent <id> --items W02,W15 --note "…≥200 chars…" [--publish]
 *        [--callouts file.json] [--callout "A_stairs:0.62,0.47:W02:new:label"]…
 *        [--no-build] [--out gauntlet/out/last] [--previous <dir>] [--ledger gauntlet/ledger.json]
 *        [--settle 90] [--quality high]                        capture options (see capture.mjs)
 *        [--import <captureDir> --sha <sha> --at <iso>]      backfill a historical capture
 *        [--dist <dir>]                                     the captured build to publish under play/ (hash must match stats.distHash)
 *        [--auto-note] [--force] [--strict]                  monitor mode (see .github/workflows/monitor.yml)
 *
 * Steps: build → capture (or import) → compare vs reference + previous take → score → anti-cheat →
 * ledger entry (hash chain, note validation D6, claims D3, regressions D2) → rotate out/last→out/prev
 * → (--publish) push images + takes.json + ledger to the orphan `monitor` branch.
 *
 * Exit codes: 0 take recorded (even if tagged invalid — see summary), 1 hard error / note rejected,
 * with --strict also 1 when the take is invalid.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { ROOT, LEDGER_PATH, CLAIMS_PATH, OUT_DIR, LAST_DIR, PREV_DIR, MONITOR_DIR, DIST_DIR, readJson, writeJson, resolveArg, rel, loadRubric } from './lib/paths.mjs';
import { parseArgs, listArg } from './lib/cli.mjs';
import { loadLedger, saveLedger, appendEntry, lastEntry, nextId, validateNote, mergeLedgers } from './lib/ledger.mjs';
import { attestation } from './lib/attest.mjs';
import { captureAll, gitInfo, hashDir } from './capture.mjs';
import { compareDir, deltaSummary } from './compare.mjs';
import { scoreDir, renderTable } from './score.mjs';
import { runAntiCheat, claimCovers } from './anti-cheat.mjs';

/** Union local claims with the monitor checkout's data/claims.json and write both (idempotent). */
function syncClaims(log = () => {}) {
  const monitorClaimsPath = path.join(monitorDataDir(MONITOR_DIR), 'claims.json');
  const union = mergeClaims(readJson(CLAIMS_PATH, { claims: [] }), readJson(monitorClaimsPath, { claims: [] }));
  if (union.added.local) log(`claims: ${union.added.local} claim(s) from other agents pulled from the monitor`);
  writeJson(CLAIMS_PATH, union.claims);
  fs.mkdirSync(path.dirname(monitorClaimsPath), { recursive: true });
  writeJson(monitorClaimsPath, union.claims);
}

/** Union of two claims files by (agent, at); returns the merged file and how many each side gained. */
function mergeClaims(local, remote) {
  const key = (c) => `${c.agent}|${c.at}`;
  const have = new Set((local.claims ?? []).map(key));
  const theirs = new Set((remote.claims ?? []).map(key));
  const claims = [...(local.claims ?? [])];
  let addedLocal = 0;
  for (const c of remote.claims ?? []) if (!have.has(key(c))) { claims.push(c); addedLocal++; }
  let addedRemote = 0;
  for (const c of local.claims ?? []) if (!theirs.has(key(c))) addedRemote++;
  claims.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return { claims: { ...local, claims }, added: { local: addedLocal, remote: addedRemote } };
}
import { syncMonitor, applyToMonitor, commitAndPush, heartbeat, parseCallouts, readTakes, rendererShort, redactRemote, monitorDataDir } from './lib/monitor.mjs';

const log = (...a) => console.error(...a);

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

function fail(msg, code = 1) {
  console.error(`✗ take: ${msg}`);
  process.exit(code);
}

/** Derived outputs of an earlier take/compare/score run are regenerated, never imported. */
const REGENERATED = /^(take|score|compare)\.json$|\.compare\.png$/;

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory() || REGENERATED.test(e.name)) continue;
    fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
}

/**
 * Previous take = last valid ledger entry before `at` (regression baseline, rule D2); if none is
 * valid, the last entry before `at` is used for deltas only. Files come from the monitor checkout
 * or gauntlet/out/last (pre-rotation).
 */
function findPreviousTake({ ledger, at, monitorDir, rotateFrom, explicitDir }) {
  // "previous" means captured earlier: a concurrent-publish resequence moves `at`, not capturedAt
  const tOf = (e) => e.capturedAt ?? e.at;
  const before = ledger.entries.filter((e) => !at || !tOf(e) || tOf(e) <= at);
  // the baseline is the LATEST-CAPTURED eligible entry, not the last appended: a resequenced entry
  // can sit at the chain's head with an older capture time. Ties fall to the later chain position.
  const latest = (list) => list.reduce((best, e) => (!best || (tOf(e) ?? '') >= (tOf(best) ?? '') ? e : best), null);
  const valid = before.filter((e) => e.valid !== false);
  const entry = valid.length ? latest(valid) : before.length ? latest(before) : null;
  const validBaseline = !!valid.length;
  let dir = null;
  let metrics = null;
  let scoreJson = null;
  if (explicitDir && fs.existsSync(explicitDir)) dir = explicitDir;
  else if (entry && monitorDir && fs.existsSync(path.join(monitorDataDir(monitorDir), 'takes', entry.id))) {
    dir = path.join(monitorDataDir(monitorDir), 'takes', entry.id);
    const rec = readTakes(monitorDir).takes.find((t) => t.id === entry.id);
    if (rec) metrics = Object.fromEntries(rec.shots.map((s) => [s.viewpoint, s.metrics]));
  } else if (rotateFrom && fs.existsSync(path.join(rotateFrom, 'score.json'))) dir = rotateFrom;
  if (dir && fs.existsSync(path.join(dir, 'score.json')) && (!entry || readJson(path.join(dir, 'score.json'), {})?.sha === entry.sha || !readJson(path.join(dir, 'score.json'), {})?.sha)) scoreJson = readJson(path.join(dir, 'score.json'), null);
  else dir = explicitDir && fs.existsSync(explicitDir) ? explicitDir : null;
  return { entry, dir, metrics, scoreJson, validBaseline };
}

export function generateAutoNote({ git: g, at, agent, score, compare, prevEntry, prevSha }) {
  const heroDeltas = [];
  const scale = { ssim: 1, phashDistance: 64, hueDiffDeg: 180, satDiff: 1, lumDiff: 1, sharpnessRatio: 1, overexposedFraction: 1, skyFraction: 1 };
  const better = { ssim: 1, phashDistance: -1, hueDiffDeg: -1, satDiff: -1, lumDiff: -1, sharpnessRatio: 1, overexposedFraction: -1 };
  for (const [vp, m] of Object.entries(compare?.viewpoints ?? {})) {
    for (const [k, d] of Object.entries(m.deltas ?? {})) {
      if (!scale[k] || !d) continue;
      heroDeltas.push({ vp, k, d, cur: m[k], prev: Number((m[k] - d).toFixed(4)), norm: Math.abs(d) / scale[k], good: better[k] ? better[k] * d > 0 : null });
    }
  }
  heroDeltas.sort((a, b) => b.norm - a.norm);
  const top = heroDeltas.slice(0, 3).map((x) => `${x.vp} ${x.k} ${x.prev}→${x.cur} (${x.d > 0 ? '+' : ''}${x.d}${x.good === null ? '' : x.good ? ' ▲' : ' ▼'})`);
  const changed = prevSha && g.sha ? git(['diff', '--name-only', prevSha, g.sha, '--', 'src', 'public']).split('\n').filter(Boolean) : [];
  const lines = [];
  lines.push(`Automated hourly monitor take of ${g.shortSha || g.sha} ("${g.subject || 'no subject'}", branch ${g.branch || '?'}) at ${at} by ${agent}.`);
  if (prevEntry) lines.push(`Compared with the previous take ${prevEntry.id} (${prevEntry.sha?.slice(0, 7) ?? '?'}, ${prevEntry.score?.passed ?? '?'}/${prevEntry.score?.total ?? 50} passing): ${top.length ? `top metric deltas — ${top.join('; ')}.` : 'no metric changed on any viewpoint.'}`);
  else lines.push('No previous take in the ledger — this is the first monitor take, so no deltas can be reported yet.');
  lines.push(`Score ${score.passed}/${score.total} (phase 1: ${score.phasePassed}/${score.phaseRequired})${score.regressions?.length ? `, REGRESSIONS: ${score.regressions.join(', ')}` : ', no regressions'}${score.improvements?.length ? `, improved: ${score.improvements.join(', ')}` : ''}.`);
  if (changed.length) lines.push(`Changed since the previous take under src/ or public/: ${changed.length} file(s) — ${changed.slice(0, 8).join(', ')}${changed.length > 8 ? ', …' : ''}.`);
  const per = Object.entries(compare?.viewpoints ?? {})
    .map(([vp, m]) => `${vp} ssim ${m.ssim ?? '—'} pHash ${m.phashDistance ?? '—'} hueΔ ${m.hueDiffDeg ?? '—'}°`)
    .join('; ');
  lines.push(`Per-viewpoint reference match: ${per}.`);
  lines.push('This note is machine-generated so the ledger records the state of main at this hour for the monitor freshness rule (E3).');
  return lines.join(' ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), { multi: ['callout'] });
  const agent = typeof args.agent === 'string' ? args.agent : null;
  if (!agent) fail('--agent <id> is required');
  const rubric = loadRubric();
  const items = listArg(args.items);
  if (!items.length) fail('--items W02,W15 is required (rubric items this take targets)');
  const validIds = new Set(rubric.items.map((i) => i.id));
  const badItems = items.filter((i) => !validIds.has(i));
  if (badItems.length) fail(`unknown rubric item(s): ${badItems.join(', ')}`);
  const ledgerPath = resolveArg(args.ledger, LEDGER_PATH);
  const outDir = resolveArg(args.out, LAST_DIR);
  const rotate = outDir === LAST_DIR;
  const publish = !!args.publish;
  const importDir = args.import ? resolveArg(args.import) : null;
  const noBuild = !!args['no-build'] || !!importDir;
  const autoNote = !!args['auto-note'];
  const strict = !!args.strict;
  const phase = 1;
  const { callouts, refCallouts } = parseCallouts({ inline: args.callout ?? [], file: args.callouts ? resolveArg(args.callouts) : null });
  if (!autoNote && typeof args.note !== 'string') fail('--note "…" (≥ 200 chars) is required, or --auto-note');
  if (importDir && !fs.existsSync(path.join(importDir, 'audit.json'))) fail(`--import ${importDir} has no audit.json`);

  const t0 = Date.now();
  let ledger = loadLedger(ledgerPath);

  // 0. monitor sync (canonical ledger) -------------------------------------------------------
  let monitor = null;
  if (publish) {
    monitor = syncMonitor({ log });
    const monitorLedgerPath = path.join(monitorDataDir(MONITOR_DIR), 'ledger.json');
    if (fs.existsSync(monitorLedgerPath)) {
      const { ledger: merged, rebased } = mergeLedgers(loadLedger(monitorLedgerPath), ledger);
      if (rebased.length) log(`take: ${rebased.length} local take(s) rebased onto the monitor ledger`);
      ledger = merged;
      saveLedger(ledgerPath, ledger);
    }
    // Claims are per code branch, but D3 judges every agent's takes: keep the union on the monitor
    // (data/claims.json) and pull it back so another agent's CLI claims count here too.
    syncClaims(log);
    log(`monitor: ${monitor.created ? 'new orphan branch' : `synced ${monitor.head?.slice(0, 7)}`} → ${rel(MONITOR_DIR)}`);
  }

  // identity of this take
  const gitNow = gitInfo();
  let sha = gitNow.sha;
  let shortSha = gitNow.shortSha;
  let subject = gitNow.subject;
  let at = new Date().toISOString();
  let imported = null;
  if (importDir) {
    const want = typeof args.sha === 'string' ? args.sha : readJson(path.join(importDir, 'stats.json'), {})?.git?.sha;
    if (!want) fail('--import needs --sha <commit> (stats.json has no git.sha)');
    sha = git(['rev-parse', '--verify', `${want}^{commit}`]) || want;
    shortSha = sha.slice(0, 7);
    subject = git(['log', '-1', '--pretty=%s', sha]) || readJson(path.join(importDir, 'stats.json'), {})?.git?.subject || '';
    at = typeof args.at === 'string' ? new Date(args.at).toISOString() : readJson(path.join(importDir, 'stats.json'), {})?.capturedAt ?? at;
    if (Number.isNaN(Date.parse(at))) fail(`--at "${args.at}" is not a date`);
    imported = { from: rel(importDir), importedAt: new Date().toISOString(), by: agent };
  }

  // heartbeat: monitor mode with an unchanged sha → refresh updatedAt only
  const last = lastEntry(ledger);
  if (publish && autoNote && !args.force && last && last.sha === sha && last.agent === agent) {
    heartbeat({ reason: `sha ${shortSha} unchanged since ${last.id}` });
    const r = await commitAndPush({ message: `monitor: heartbeat ${new Date().toISOString()} (sha ${shortSha} unchanged since ${last.id})`, log });
    console.log(`♥ heartbeat: ${shortSha} unchanged since ${last.id} — takes.json.updatedAt refreshed${r.pushed ? ` and pushed (${r.head.slice(0, 7)})` : ''}`);
    return;
  }

  // a. build ----------------------------------------------------------------------------------
  if (!noBuild) {
    log('take: npm run build');
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    if (b.status !== 0) fail(`build failed (exit ${b.status})`);
  }

  // b. capture / import -----------------------------------------------------------------------
  const workDir = rotate ? path.join(OUT_DIR, `.take-${Date.now()}`) : outDir;
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });
  if (importDir) {
    copyDir(importDir, workDir);
    log(`take: imported ${rel(importDir)} (${sha.slice(0, 7)} @ ${at})`);
  } else {
    const captureOpts = { out: workDir, rubric, log };
    if (args.settle) captureOpts.settleFrames = Number(args.settle);
    if (typeof args.quality === 'string') captureOpts.quality = args.quality;
    await captureAll(captureOpts);
  }
  const stats = readJson(path.join(workDir, 'stats.json'), {});
  if (!importDir && stats.git?.sha && stats.git.sha !== sha) log(`⚠ take: HEAD moved during the capture (${shortSha} → ${stats.git.shortSha}); the take is recorded against ${shortSha}, which is what was built`);

  // c. compare --------------------------------------------------------------------------------
  const prev = findPreviousTake({ ledger, at, monitorDir: monitor ? MONITOR_DIR : null, rotateFrom: rotate ? LAST_DIR : null, explicitDir: args.previous ? resolveArg(args.previous) : null });
  const compare = await compareDir({ inDir: workDir, previousDir: prev.dir, previousMetrics: prev.metrics, previousSha: prev.entry?.sha ?? null, sha, rubric, log });

  // d. score ----------------------------------------------------------------------------------
  const score = scoreDir({
    inDir: workDir,
    rubric,
    previous: { scoreJson: prev.scoreJson, statuses: prev.entry?.score?.items ?? null, takeId: prev.entry?.id ?? null, sha: prev.entry?.sha ?? null, passed: prev.entry?.score?.passed ?? null, source: prev.dir ? rel(prev.dir) : prev.entry ? 'ledger' : null },
    author: agent,
    sha,
  });
  if (!prev.validBaseline && score.regressions.length) {
    log(`take: previous take ${prev.entry?.id} is itself invalid — not counting ${score.regressions.join(', ')} as regressions (no valid baseline)`);
    score.regressions = [];
  }
  console.log(renderTable(score, { showAll: true }));

  // e. anti-cheat -----------------------------------------------------------------------------
  const { report } = await runAntiCheat({ takeDir: workDir, ledgerPath, agent, log });
  for (const r of report.results) if (r.level !== 'pass') console.log(`${r.level === 'warn' ? '⚠' : '✗'} ${r.rule} ${r.message}`);
  console.log(report.ok ? `✓ anti-cheat green (${report.results.length} checks)` : `✗ anti-cheat: ${report.failures.length} failure(s)`);

  // f. ledger entry ---------------------------------------------------------------------------
  const note = autoNote ? generateAutoNote({ git: { sha, shortSha, subject, branch: gitNow.branch }, at, agent, score, compare, prevEntry: prev.entry, prevSha: prev.entry?.sha ?? null }) : String(args.note);
  const nv = validateNote(note, ledger.entries.map((e) => e.note ?? ''));
  if (!nv.ok) {
    if (autoNote) log(`take: auto-note failed validation (${nv.problems.join('; ')}) — appending run context`);
    else fail(nv.problems.join('; '));
  }
  const finalNote = nv.ok ? note : `${note} Run context: ${JSON.stringify(attestation())} at ${new Date().toISOString()} (${Math.random().toString(36).slice(2, 8)}).`;
  const claims = readJson(CLAIMS_PATH, { claims: [] }).claims ?? [];
  const unclaimedItems = items.filter((it) => !claimCovers(claims, agent, it, at));
  if (unclaimedItems.length && agent !== 'ci-monitor') log(`⚠ D3: no live claim by ${agent} for ${unclaimedItems.join(', ')} — recording unclaimed: true (claim first: npm run gauntlet -- --claim ${unclaimedItems.join(',')} --agent ${agent})`);

  const invalidReasons = [];
  for (const f of report.failures) invalidReasons.push(`${f.rule} ${f.message}`);
  for (const f of score.flags) if (!invalidReasons.some((r) => r.startsWith(f.slice(0, 2)))) invalidReasons.push(f);
  if (score.regressions.length) invalidReasons.unshift(`D2 regression: ${score.regressions.join(', ')} (vs ${prev.entry?.id ?? 'previous'})`);
  const hero = (stats.viewpoints ?? []).filter((v) => (rubric.heroViewpoints ?? []).includes(v.id));
  const { id, number } = nextId(ledger);
  const entry = {
    id,
    number,
    at,
    sha,
    shortSha,
    branch: gitNow.branch,
    subject,
    agent,
    items,
    note: finalNote,
    score: { passed: score.passed, total: score.total, phasePassed: score.phasePassed, phaseRequired: score.phaseRequired, items: Object.fromEntries(Object.entries(score.items).map(([k, v]) => [k, v.status])) },
    images: Object.fromEntries((stats.viewpoints ?? []).map((v) => [v.id, v.sha256 ?? null])),
    distHash: stats.distHash ?? null,
    stats: { drawCalls: hero.length ? Math.max(...hero.map((v) => v.stats?.drawCalls ?? 0)) : null, triangles: hero.length ? Math.max(...hero.map((v) => v.stats?.triangles ?? 0)) : null, captureMs: stats.durationMs ?? null, renderer: rendererShort(stats.renderer) },
    attestation: attestation(),
    regressed: score.regressions,
    flags: score.flags,
    valid: invalidReasons.length === 0,
    invalid: invalidReasons.length ? invalidReasons[0] : null,
    invalidAll: invalidReasons.length > 1 ? invalidReasons : undefined,
    unclaimed: unclaimedItems.length ? true : undefined,
    unclaimedItems: unclaimedItems.length ? unclaimedItems : undefined,
    imported: imported ?? undefined,
    dirty: gitNow.dirty && !importDir ? true : undefined,
  };
  const sealed = appendEntry(ledger, entry);
  saveLedger(ledgerPath, ledger);
  writeJson(path.join(workDir, 'take.json'), { ...sealed, takeDir: rel(workDir) });
  log(`take: ${sealed.id} appended to ${rel(ledgerPath)} (${sealed.hash.slice(7, 19)}…)`);

  // g. rotate ---------------------------------------------------------------------------------
  let finalDir = workDir;
  if (rotate) {
    fs.rmSync(PREV_DIR, { recursive: true, force: true });
    if (fs.existsSync(LAST_DIR)) fs.renameSync(LAST_DIR, PREV_DIR);
    fs.renameSync(workDir, LAST_DIR);
    finalDir = LAST_DIR;
    writeJson(path.join(finalDir, 'take.json'), { ...sealed, takeDir: rel(finalDir) });
  }

  // h. publish --------------------------------------------------------------------------------
  // the play build published under monitor/play must be the captured build: with --dist <dir> the
  // captured dist is used and its hash must equal stats.distHash; without it the default dist is
  // hashed against stats.distHash and publishing refuses on a mismatch (no stale builds go live)
  let playDist = DIST_DIR;
  if (publish) {
    if (typeof args.dist === 'string') playDist = resolveArg(args.dist);
    const want = stats.distHash ?? null;
    const have = hashDir(playDist);
    if (want && have && want !== have) fail(`play build ${rel(playDist)} (${have.slice(7, 19)}) is not the captured build (${want.slice(7, 19)}) — pass --dist <captured dist> or rebuild it`);
    if (want && !have) fail(`play build ${rel(playDist)} missing — pass --dist <captured dist>`);
  }
  let published = null;
  if (publish) {
    let applied = null;
    const apply = async () => {
      // a retry resets the monitor checkout to the fetched head: re-union the claims onto it so an
      // incoming grant published meanwhile is never dropped, then re-apply the take
      syncClaims();
      applied = await applyToMonitor({ localLedgerPath: ledgerPath, entry: sealed, takeDir: finalDir, rubric, callouts, refCallouts, phase, distDir: playDist, log });
      if (applied.takeId !== sealed.id) log(`monitor: take renumbered ${sealed.id} → ${applied.takeId} (concurrent publish)`);
      // the canonical (merged) entry may carry a new id/number, a resequenced `at`, capturedAt and
      // new prevHash/hash: mirror the whole sealed record, not just the id
      const canonical = loadLedger(ledgerPath).entries.find((e) => e.id === applied.takeId) ?? null;
      writeJson(path.join(finalDir, 'take.json'), { ...readJson(path.join(finalDir, 'take.json')), ...(canonical ?? { id: applied.takeId }), takeDir: rel(finalDir) });
    };
    await apply();
    const msg = `take ${applied.takeId}: ${agent} → ${items.join(',')} (${score.passed}/${score.total}${score.regressions.length ? ', REGRESSED' : ''}${entry.valid ? '' : ', invalid'}) @${shortSha}`;
    const r = await commitAndPush({ message: msg, log, onRetry: apply });
    published = { ...r, takeId: applied.takeId, remote: redactRemote(monitor.remote) };
  }

  // summary -----------------------------------------------------------------------------------
  const finalId = published?.takeId ?? sealed.id;
  const lines = [];
  lines.push(`\n${entry.valid ? '✓' : '✗'} ${finalId} by ${agent} → ${items.join(', ')} @${shortSha}${gitNow.dirty && !importDir ? ' (dirty tree)' : ''}  [${entry.attestation.source}]`);
  lines.push(`  score ${score.passed}/${score.total} (phase 1: ${score.phasePassed}/${score.phaseRequired})${prev.entry ? ` · prev ${prev.entry.id}: ${prev.entry.score?.passed ?? '?'}` : ''}${score.improvements.length ? ` · ▲ ${score.improvements.join(', ')}` : ''}${score.regressions.length ? ` · ▼ ${score.regressions.join(', ')}` : ''}`);
  for (const [vp, m] of Object.entries(compare.viewpoints)) lines.push(`  ${vp.padEnd(11)} ssim ${m.ssim ?? '—'}  pHash ${m.phashDistance ?? '—'}  hueΔ ${m.hueDiffDeg ?? '—'}°${m.deltas ? `  Δ ${deltaSummary(m.deltas) || '—'}` : ''}`);
  if (!entry.valid) lines.push(`  INVALID: ${invalidReasons.join(' | ')}`);
  if (unclaimedItems.length && agent !== 'ci-monitor') lines.push(`  unclaimed: ${unclaimedItems.join(', ')}`);
  lines.push(`  out ${rel(finalDir)} · ledger ${rel(ledgerPath)} (${ledger.entries.length} entries)${published ? ` · monitor ${published.pushed ? `pushed ${published.head.slice(0, 7)}` : published.reason} → ${published.remote}` : ''}`);
  lines.push(`  ${((Date.now() - t0) / 1000).toFixed(0)} s total`);
  console.log(lines.join('\n'));
  if (strict && !entry.valid) process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
