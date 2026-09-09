#!/usr/bin/env node
/**
 * gauntlet.mjs — CLI front for the loop (GAUNTLET.md §3).
 *
 *   npm run gauntlet                                        anticheat (source) + capture + compare + score → gauntlet/out/last
 *   npm run gauntlet -- --claim W02,W15 --agent <id>       claim rubric items (3 h expiry; warns on overlap)
 *   npm run gauntlet -- --review W25 --verdict pass|fail --evidence <path> --agent <id> [--take <id>] [--note "…"]
 *   npm run gauntlet:verify-exit                            can Phase 1 be declared complete? exit 0 only on pass
 *   options: --out <dir> --ledger <path> --claims <path> --reviews <dir> --report <path> --no-build --quality high --settle 90
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, LEDGER_PATH, CLAIMS_PATH, REVIEWS_DIR, LAST_DIR, PREV_DIR, REPORTS_DIR, MONITOR_DIR, readJson, writeJson, resolveArg, rel, loadRubric } from './lib/paths.mjs';
import { parseArgs, listArg } from './lib/cli.mjs';
import { loadLedger } from './lib/ledger.mjs';
import { writeReview } from './lib/reviews.mjs';
import { runAntiCheat } from './anti-cheat.mjs';
import { captureAll } from './capture.mjs';
import { compareDir } from './compare.mjs';
import { scoreDir, renderTable, findPrevious } from './score.mjs';
import { readTakes } from './lib/monitor.mjs';

const CLAIM_HOURS = 3;

export function claim({ agent, items, rubric = loadRubric(), claimsPath = CLAIMS_PATH, scope = null, now = new Date() } = {}) {
  const validIds = new Set(rubric.items.map((i) => i.id));
  const bad = items.filter((i) => !validIds.has(i));
  if (bad.length) throw new Error(`unknown rubric item(s): ${bad.join(', ')}`);
  const data = readJson(claimsPath, { note: 'Claim rubric items before working on them: npm run gauntlet -- --claim W02,W03 --agent <id>. Claims expire 3 h after `at`. Do not edit another agent\'s claims by hand.', claims: [] });
  data.claims ??= [];
  const t = now.getTime();
  const live = data.claims.filter((c) => {
    const start = Date.parse(c.at);
    return Number.isFinite(start) && start <= t && t <= start + Number(c.expiresHours ?? CLAIM_HOURS) * 3600_000;
  });
  const overlaps = [];
  for (const c of live) {
    if (c.agent === agent) continue;
    const shared = items.filter((i) => c.items?.includes(i));
    if (shared.length) overlaps.push({ agent: c.agent, items: shared, expires: new Date(Date.parse(c.at) + Number(c.expiresHours ?? CLAIM_HOURS) * 3600_000).toISOString() });
  }
  const entry = { agent, items, at: now.toISOString(), expiresHours: CLAIM_HOURS, ...(scope ? { scope } : {}) };
  data.claims.push(entry);
  writeJson(claimsPath, data);
  return { entry, overlaps, live: live.length + 1 };
}

export function review({ item, verdict, evidence, agent, takeId = null, note = null, rubric = loadRubric(), ledgerPath = LEDGER_PATH, reviewsDir = REVIEWS_DIR, monitorDir = MONITOR_DIR } = {}) {
  const rubricItem = rubric.items.find((i) => i.id === item);
  if (!rubricItem) throw new Error(`unknown rubric item ${item}`);
  if (!['visual', 'both'].includes(rubricItem.verify)) throw new Error(`${item} is verify:"${rubricItem.verify}" — only visual/both items take reviewer verdicts`);
  if (!['pass', 'fail'].includes(verdict)) throw new Error('--verdict must be pass or fail');
  if (!evidence) throw new Error('--evidence <path> is required (the capture image / strip you judged)');
  const evidencePath = resolveArg(evidence);
  if (!fs.existsSync(evidencePath)) throw new Error(`evidence file not found: ${evidence}`);
  const ledger = loadLedger(ledgerPath);
  let take = takeId ? ledger.entries.find((e) => e.id === takeId) : null;
  if (takeId && !take) {
    const rec = readTakes(monitorDir).takes.find((t) => t.id === takeId);
    if (rec) take = rec;
  }
  if (!take && !takeId) {
    const candidates = ledger.entries.filter((e) => e.agent !== agent);
    take = candidates.length ? candidates[candidates.length - 1] : null;
    if (!take) throw new Error(`no take by another agent found in ${rel(ledgerPath)} — pass --take <id> or wait for the other agent's take`);
  }
  if (!take) throw new Error(`take ${takeId} not found in the ledger or the monitor`);
  if (take.agent === agent) throw new Error(`D7: ${agent} cannot review their own take ${take.id}`);
  const record = { item, reviewer: agent, verdict, evidence: rel(evidencePath), takeId: take.id, author: take.agent, takeSha: take.sha ?? null, at: new Date().toISOString(), criterion: rubricItem.visualCriterion ?? null, note: note ?? null };
  const file = writeReview(reviewsDir, record);
  return { record, file };
}

export async function runDefault({ outDir = LAST_DIR, ledgerPath = LEDGER_PATH, build = true, quality = 'high', settleFrames = 90, agent = null } = {}) {
  const rubric = loadRubric();
  const { report } = await runAntiCheat({ skipCapture: true, ledgerPath });
  report.print();
  if (!report.ok) console.log(`✗ anti-cheat (source): ${report.failures.length} failure(s) — continuing with capture so you can see the score`);
  if (build) {
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (b.status !== 0) throw new Error(`build failed (exit ${b.status})`);
  }
  const tmp = outDir === LAST_DIR ? path.join(path.dirname(LAST_DIR), `.gauntlet-${Date.now()}`) : outDir;
  fs.rmSync(tmp, { recursive: true, force: true });
  await captureAll({ out: tmp, rubric, quality, settleFrames });
  const previousDir = outDir === LAST_DIR && fs.existsSync(path.join(LAST_DIR, 'compare.json')) ? LAST_DIR : fs.existsSync(path.join(PREV_DIR, 'compare.json')) ? PREV_DIR : null;
  await compareDir({ inDir: tmp, previousDir, rubric });
  const previous = findPrevious({ previousDir, ledgerPath });
  const score = scoreDir({ inDir: tmp, rubric, previous, author: agent });
  if (outDir === LAST_DIR) {
    fs.rmSync(PREV_DIR, { recursive: true, force: true });
    if (fs.existsSync(LAST_DIR)) fs.renameSync(LAST_DIR, PREV_DIR);
    fs.renameSync(tmp, LAST_DIR);
  }
  console.log(renderTable(score));
  const { report: takeReport } = await runAntiCheat({ takeDir: outDir, ledgerPath, agent });
  for (const r of takeReport.results) if (r.level !== 'pass' && /^[BC]/.test(r.rule)) console.log(`${r.level === 'warn' ? '⚠' : '✗'} ${r.rule} ${r.message}`);
  console.log(`${takeReport.ok ? '✓' : '✗'} anti-cheat on ${rel(outDir)} — ${takeReport.failures.length} failure(s)`);
  return { score, ok: report.ok && takeReport.ok };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const agent = typeof args.agent === 'string' ? args.agent : null;
  const ledgerPath = resolveArg(args.ledger, LEDGER_PATH);
  const claimsPath = resolveArg(args.claims, CLAIMS_PATH);
  const reviewsDir = resolveArg(args.reviews, REVIEWS_DIR);
  (async () => {
    if (args.claim) {
      if (!agent) throw new Error('--agent <id> is required');
      const r = claim({ agent, items: listArg(args.claim), claimsPath, scope: typeof args.scope === 'string' ? args.scope : null });
      console.log(`✓ claimed ${r.entry.items.join(', ')} for ${agent} until ${new Date(Date.parse(r.entry.at) + CLAIM_HOURS * 3600_000).toISOString()} (${rel(claimsPath)})`);
      for (const o of r.overlaps) console.log(`⚠ overlap: ${o.agent} holds a live claim on ${o.items.join(', ')} until ${o.expires} — coordinate in .agents/INBOX.md or pick another item`);
      return;
    }
    if (args.review) {
      if (!agent) throw new Error('--agent <id> is required');
      const r = review({ item: String(args.review), verdict: String(args.verdict), evidence: typeof args.evidence === 'string' ? args.evidence : null, agent, takeId: typeof args.take === 'string' ? args.take : null, note: typeof args.note === 'string' ? args.note : null, ledgerPath, reviewsDir });
      console.log(`✓ review ${r.record.item}: ${r.record.verdict} by ${r.record.reviewer} on ${r.record.takeId} (author ${r.record.author}) → ${rel(r.file)}`);
      return;
    }
    if (args['verify-exit']) {
      const reportPath = resolveArg(args.report, path.join(REPORTS_DIR, 'verify-exit.json'));
      const { report, exit } = await runAntiCheat({ skipCapture: true, ledgerPath, claimsPath, reviewsDir, reportPath, verifyExit: true });
      report.print();
      console.log(exit.pass ? `✓ verify-exit PASS — Phase 1 may be declared complete (report: ${rel(reportPath)}, attestation ${exit.attestation.source})` : `✗ verify-exit FAIL — ${exit.failures.length} unmet condition(s); report: ${rel(reportPath)}`);
      process.exit(exit.pass ? 0 : 1);
    }
    const r = await runDefault({ outDir: resolveArg(args.out, LAST_DIR), ledgerPath, build: !args['no-build'], quality: args.quality || 'high', settleFrames: Number(args.settle || 90), agent });
    process.exit(r.ok ? 0 : 1);
  })().catch((e) => {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  });
}
