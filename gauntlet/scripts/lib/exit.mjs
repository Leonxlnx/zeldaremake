/**
 * verify-exit — can Phase 1 be declared complete? (GAUNTLET.md §6, rules D4–D8, E1–E3)
 *
 * Appends its results to an anti-cheat Report and writes gauntlet/reports/verify-exit.json.
 * Which entries count:
 *   "all W pass", D4, D5      → valid, CI-attested entries only (attestation.source === "ci")
 *   D6                        → every valid entry (a copy-pasted local note is still a violation)
 *   D7, E1, E2                → every valid entry of any source (agents' local takes prove activity
 *                               and coverage; the hourly CI monitor only targets W37 and never reviews)
 * The monitor branch's ledger (.monitor/ledger.json) is preferred when it verifies and extends the
 * local one, because `take.mjs --publish` rebases local-only takes onto it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, LEDGER_PATH, MONITOR_DIR, REVIEWS_DIR, REPORTS_DIR, readJson, writeJson, rel, loadRubric } from './paths.mjs';
import { loadLedger, verifyChain, entryIdentity, jaccard } from './ledger.mjs';
import { loadReviews, allReviewRecords } from './reviews.mjs';
import { attestation } from './attest.mjs';

export const EXIT_RULES = { minTakes: 24, minDiffLines: 20, minNoteChars: 200, maxJaccard: 0.7, reviewsPerTakes: 3, minHours: 10, minClockHours: 10, minTakesPerGroup: 2, monitorStaleHours: 2 };

export function pickLedger(localPath = LEDGER_PATH, monitorDir = MONITOR_DIR) {
  const local = loadLedger(localPath);
  const monitorPath = path.join(monitorDir, 'data', 'ledger.json');
  if (!fs.existsSync(monitorPath)) return { ledger: local, path: localPath, source: 'local' };
  const monitor = loadLedger(monitorPath);
  if (!verifyChain(monitor).ok) return { ledger: local, path: localPath, source: 'local', note: 'monitor ledger chain broken — using local' };
  const known = new Set(monitor.entries.map(entryIdentity));
  const missing = local.entries.filter((e) => !known.has(entryIdentity(e))).length;
  if (monitor.entries.length >= local.entries.length && missing === 0) return { ledger: monitor, path: monitorPath, source: 'monitor' };
  return { ledger: local, path: localPath, source: 'local', note: `monitor ledger lacks ${missing} local entr(y/ies) — using local` };
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return null;
  }
}

export function diffLines(shaA, shaB, paths = ['src', 'public']) {
  for (const sha of [shaA, shaB]) if (!sha || git(['cat-file', '-e', `${sha}^{commit}`]) === null) return null;
  const out = git(['diff', '--numstat', shaA, shaB, '--', ...paths]);
  if (out === null) return null;
  let total = 0;
  for (const line of out.split('\n')) {
    const m = /^(\d+|-)\t(\d+|-)\t/.exec(line);
    if (!m) continue;
    total += (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]));
  }
  return total;
}

export async function verifyExit({ ledgerPath = LEDGER_PATH, monitorDir = MONITOR_DIR, reviewsDir = REVIEWS_DIR, report, rubric = loadRubric(), now = Date.now(), writeReport = true, reportPath = path.join(REPORTS_DIR, 'verify-exit.json') } = {}) {
  const R = EXIT_RULES;
  const picked = pickLedger(ledgerPath, monitorDir);
  const ledger = picked.ledger;
  if (picked.note) report.warn('D1', picked.note);
  const chain = verifyChain(ledger);
  if (!chain.ok) for (const p of chain.problems) report.fail('D1', `(${picked.source}) ${p}`);
  const valid = ledger.entries.filter((e) => e.valid !== false);
  const ci = valid.filter((e) => e.attestation?.source === 'ci');
  const wItems = rubric.items.filter((i) => i.id.startsWith(rubric.phaseRequired?.['1'] ?? 'W'));

  // all W items pass on the latest CI-attested take
  const latest = ci.length ? ci[ci.length - 1] : null;
  if (!latest) report.fail('EXIT', `no valid CI-attested take in ${rel(picked.path)} (${valid.length} valid local entries do not count — rule B2)`);
  else {
    const failing = wItems.filter((i) => latest.score?.items?.[i.id] !== 'pass').map((i) => i.id);
    if (failing.length) report.fail('EXIT', `latest CI take ${latest.id} (${latest.sha?.slice(0, 7)}): ${wItems.length - failing.length}/${wItems.length} W items pass; failing/pending: ${failing.join(', ')}`);
    else report.pass('EXIT', `latest CI take ${latest.id}: all ${wItems.length} W items pass`);
  }

  // D4 — ≥ 24 valid CI takes with distinct SHAs
  const distinct = [];
  const seen = new Set();
  for (const e of ci) {
    if (!e.sha || seen.has(e.sha)) continue;
    seen.add(e.sha);
    distinct.push(e);
  }
  if (distinct.length >= R.minTakes) report.pass('D4', `${distinct.length} valid CI-attested takes with distinct SHAs (≥ ${R.minTakes})`);
  else report.fail('D4', `${distinct.length}/${R.minTakes} valid CI-attested takes with distinct SHAs`);

  // D5 — ≥ 20 changed lines under src/ or public/ between consecutive counted takes
  const d5 = [];
  let d5n = 0;
  for (let i = 1; i < distinct.length; i++) {
    const a = distinct[i - 1];
    const b = distinct[i];
    const n = diffLines(a.sha, b.sha);
    if (n === null) d5.push(`${a.id}→${b.id}: cannot diff ${a.sha?.slice(0, 7)}..${b.sha?.slice(0, 7)} (missing commits — fetch full history)`);
    else if (n < R.minDiffLines) d5.push(`${a.id}→${b.id}: only ${n} changed line(s) under src/ or public/`);
    else d5n++;
  }
  if (d5.length) for (const x of d5) report.fail('D5', x);
  else report.pass('D5', `${d5n} consecutive take pair(s) each change ≥ ${R.minDiffLines} lines under src/ or public/`);

  // D6 — notes
  const d6 = [];
  valid.forEach((e, i) => {
    const note = String(e.note ?? '');
    if (note.length < R.minNoteChars) d6.push(`${e.id}: note ${note.length} chars`);
    for (let j = 0; j < i; j++) {
      const s = jaccard(note, valid[j].note ?? '');
      if (s >= R.maxJaccard) d6.push(`${e.id}: note ${(s * 100).toFixed(0)} % similar to ${valid[j].id}`);
    }
  });
  if (d6.length) for (const x of d6) report.fail('D6', x);
  else report.pass('D6', `${valid.length} note(s) ≥ ${R.minNoteChars} chars and < ${R.maxJaccard} Jaccard-similar`);

  // D7 — cross-review cadence
  const records = allReviewRecords(loadReviews(reviewsDir));
  const byAgent = {};
  for (const e of valid) if (e.agent && e.agent !== 'ci-monitor') (byAgent[e.agent] ??= []).push(e);
  const d7 = [];
  for (const [agent, takes] of Object.entries(byAgent)) {
    const reviews = records.filter((r) => r.reviewer === agent && r.reviewer !== r.author && ['pass', 'fail'].includes(r.verdict));
    const need = Math.floor(takes.length / R.reviewsPerTakes);
    if (reviews.length < need) d7.push(`${agent}: ${reviews.length} review(s) for ${takes.length} take(s) (need ≥ ${need})`);
  }
  const selfReviews = records.filter((r) => r.author && r.reviewer === r.author);
  for (const r of selfReviews) d7.push(`${r.item}: self-review by ${r.reviewer} is invalid`);
  if (d7.length) for (const x of d7) report.fail('D7', x);
  else report.pass('D7', `${records.length} cross-review(s) on file; every agent filed ≥ 1 per ${R.reviewsPerTakes} takes`);

  // E1 — ≥ 10 h span and ≥ 10 distinct clock hours
  const times = valid.map((e) => Date.parse(e.at)).filter(Number.isFinite).sort((a, b) => a - b);
  const spanH = times.length ? (times[times.length - 1] - times[0]) / 3600_000 : 0;
  const hours = new Set(times.map((t) => new Date(t).toISOString().slice(0, 13)));
  if (spanH >= R.minHours && hours.size >= R.minClockHours) report.pass('E1', `takes span ${spanH.toFixed(1)} h across ${hours.size} distinct clock hours`);
  else report.fail('E1', `takes span ${spanH.toFixed(1)} h (need ≥ ${R.minHours}) across ${hours.size} distinct clock hours (need ≥ ${R.minClockHours})`);

  // E2 — every rubric group targeted by ≥ 2 takes
  const groups = [...new Set(wItems.map((i) => i.group))];
  const itemGroup = Object.fromEntries(rubric.items.map((i) => [i.id, i.group]));
  const e2 = [];
  for (const g of groups) {
    const n = valid.filter((e) => (e.items ?? []).some((id) => itemGroup[id] === g)).length;
    if (n < R.minTakesPerGroup) e2.push(`${g}: ${n} take(s)`);
  }
  if (e2.length) report.fail('E2', `groups with < ${R.minTakesPerGroup} targeted takes — ${e2.join('; ')}`);
  else report.pass('E2', `all ${groups.length} rubric groups targeted by ≥ ${R.minTakesPerGroup} takes`);

  // E3 — monitor freshness
  const takesJson = readJson(path.join(monitorDir, 'data', 'takes.json'), null);
  if (!takesJson?.updatedAt) report.warn('E3', 'no monitor data (.monitor/data/takes.json) — freshness not checked; run `npm run take -- --publish` or fetch the monitor branch');
  else {
    const ageH = (now - Date.parse(takesJson.updatedAt)) / 3600_000;
    if (ageH > R.monitorStaleHours) report.fail('E3', `monitor is stale: last update ${ageH.toFixed(1)} h ago (limit ${R.monitorStaleHours} h)`);
    else report.pass('E3', `monitor updated ${ageH.toFixed(1)} h ago`);
  }

  const pass = report.ok;
  const out = {
    at: new Date(now).toISOString(),
    pass,
    attestation: attestation(),
    ledger: { path: rel(picked.path), source: picked.source, entries: ledger.entries.length, valid: valid.length, ciAttested: ci.length, distinctCiShas: distinct.length, latestCiTake: latest?.id ?? null },
    rules: EXIT_RULES,
    checks: report.results,
    failures: report.failures.map((f) => `${f.rule} ${f.message}`),
  };
  out.report = rel(reportPath);
  if (writeReport) writeJson(reportPath, out);
  return out;
}
