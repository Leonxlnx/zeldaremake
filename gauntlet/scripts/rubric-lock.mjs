#!/usr/bin/env node
/**
 * Rubric integrity helpers.
 *   node gauntlet/scripts/rubric-lock.mjs --check   verify RUBRIC.lock, baseline compatibility, and regenerate RUBRIC.md check
 *   node gauntlet/scripts/rubric-lock.mjs --write   (human only) rewrite RUBRIC.lock + RUBRIC.md from rubric.json
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUBRIC = path.join(ROOT, 'gauntlet/rubric.json');
const BASELINE = path.join(ROOT, 'gauntlet/rubric.baseline.json');
const LOCK = path.join(ROOT, 'gauntlet/RUBRIC.lock');
const MD = path.join(ROOT, 'gauntlet/RUBRIC.md');

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

export function loadRubric() {
  return JSON.parse(fs.readFileSync(RUBRIC, 'utf8'));
}

export function rubricHash() {
  return sha256(fs.readFileSync(RUBRIC));
}

/** Compare thresholds: every check in `current` must be at least as strict as in `baseline`. */
export function compareStrictness(baseline, current) {
  const problems = [];
  const bItems = new Map(baseline.items.map((i) => [i.id, i]));
  const cIds = new Set(current.items.map((i) => i.id));
  for (const id of bItems.keys()) if (!cIds.has(id)) problems.push(`A4: item ${id} removed`);
  for (const item of current.items) {
    const b = bItems.get(item.id);
    if (!b) {
      problems.push(`A4: item ${item.id} added (allowed only with human approval)`);
      continue;
    }
    if (b.verify !== item.verify && item.verify === 'auto' && b.verify !== 'auto') problems.push(`A2: ${item.id} dropped visual verification`);
    if ((item.checks?.length ?? 0) < (b.checks?.length ?? 0)) problems.push(`A2: ${item.id} has fewer checks than baseline`);
    for (const bc of b.checks ?? []) {
      const cc = (item.checks ?? []).find((c) => c.type === bc.type && (c.path ?? c.metric ?? c.layout ?? c.x) === (bc.path ?? bc.metric ?? bc.layout ?? bc.x) && (c.viewpoint ?? '') === (bc.viewpoint ?? ''));
      if (!cc) {
        problems.push(`A2: ${item.id} lost check ${bc.type}:${bc.path ?? bc.metric ?? ''}`);
        continue;
      }
      if (bc.op === cc.op && typeof bc.value === 'number' && typeof cc.value === 'number') {
        if ((bc.op === '>=' || bc.op === '>') && cc.value < bc.value) problems.push(`A2: ${item.id} lowered ${bc.path ?? bc.metric} ${bc.value} → ${cc.value}`);
        if ((bc.op === '<=' || bc.op === '<') && cc.value > bc.value) problems.push(`A2: ${item.id} loosened ${bc.path ?? bc.metric} ${bc.value} → ${cc.value}`);
      }
      if (bc.op === 'between' && cc.op === 'between' && Array.isArray(bc.value) && Array.isArray(cc.value)) {
        if (cc.value[0] < bc.value[0] || cc.value[1] > bc.value[1]) problems.push(`A2: ${item.id} widened range ${JSON.stringify(bc.value)} → ${JSON.stringify(cc.value)}`);
      }
      if (typeof bc.minPass === 'number' && typeof cc.minPass === 'number' && cc.minPass < bc.minPass) problems.push(`A2: ${item.id} lowered minPass`);
      if (typeof bc.maxGap === 'number' && typeof cc.maxGap === 'number' && cc.maxGap > bc.maxGap) problems.push(`A2: ${item.id} raised maxGap`);
      if (typeof bc.minInside === 'number' && typeof cc.minInside === 'number' && cc.minInside < bc.minInside) problems.push(`A2: ${item.id} lowered minInside`);
      if (typeof bc.tolerance === 'number' && typeof cc.tolerance === 'number' && cc.tolerance > bc.tolerance) problems.push(`A2: ${item.id} raised tolerance`);
      if (typeof bc.maxErrors === 'number' && typeof cc.maxErrors === 'number' && cc.maxErrors > bc.maxErrors) problems.push(`A2: ${item.id} raised maxErrors`);
    }
  }
  return problems;
}

function describeCheck(c) {
  switch (c.type) {
    case 'audit':
      return `audit \`${c.path}\` ${c.op}${c.value !== undefined ? ' ' + JSON.stringify(c.value) : ''}`;
    case 'stats':
      return `stats[${c.viewpoint}].${c.metric} ${c.op} ${c.value}`;
    case 'compare':
      return `compare[${c.viewpoint}].${c.metric} ${c.op} ${c.value}`;
    case 'pixels':
      return `pixels[${c.viewpoint}].${c.metric} ${c.op} ${c.value}`;
    case 'depth':
      return `depth[${c.viewpoint}].${c.metric} ${c.op} ${c.value}`;
    case 'probe':
      return `terrain height at (${c.x}, ${c.z}) = ${c.height} ± ${c.tolerance}`;
    case 'placement':
      return `placement \`${c.path}\`: ${c.maxGap !== undefined ? `gap ≤ ${c.maxGap} m` : ''}${c.maskMax ? ` mask ${JSON.stringify(c.maskMax)}` : ''} for ≥ ${Math.round(c.minPass * 100)} %`;
    case 'projection':
      return `layout \`${c.layout}\` projects into region ${JSON.stringify(c.region)} of ${c.viewpoint} (≥ ${Math.round(c.minInside * 100)} %)`;
    case 'console':
      return `console errors ≤ ${c.maxErrors}`;
    default:
      return JSON.stringify(c);
  }
}

export function renderMarkdown(rubric) {
  const groups = {};
  for (const it of rubric.items) (groups[it.group] ??= []).push(it);
  const lines = [];
  lines.push(`# ${rubric.title}`);
  lines.push('');
  lines.push(`> Generated from \`gauntlet/rubric.json\` (sha256 \`${rubricHash().slice(0, 16)}…\`). Do not edit by hand — see GAUNTLET.md §4.A.`);
  lines.push('');
  lines.push(`Reference: ${rubric.reference}`);
  lines.push('');
  lines.push(`| Phase | Items | Required for phase exit |`);
  lines.push(`| --- | --- | --- |`);
  lines.push(`| 1 World | W01–W42 | all 42 |`);
  lines.push(`| 2 Character | C01–C05 | all 5 |`);
  lines.push(`| 3 UI | U01–U03 | all 3 |`);
  lines.push('');
  const groupTitles = {
    composition: 'Composition, terrain, ground',
    trees: 'Trees',
    vegetation: 'Vegetation & wind',
    rocks: 'Rocks',
    structures: 'Structures',
    lighting: 'Lighting, atmosphere, image match',
    engineering: 'Performance & engineering',
    character: 'Character (Phase 2)',
    ui: 'UI (Phase 3)',
  };
  for (const [g, items] of Object.entries(groups)) {
    lines.push(`## ${groupTitles[g] ?? g}`);
    lines.push('');
    for (const it of items) {
      lines.push(`### ${it.id} — ${it.title}  \`${it.verify}\` · weight ${it.weight}`);
      lines.push('');
      lines.push(`Reference frame: \`reference/frames/${it.reference.frame}.jpg\` (t ≈ ${it.reference.seconds} s)`);
      lines.push('');
      lines.push(it.description);
      lines.push('');
      if (it.checks?.length) {
        lines.push('Automated checks:');
        for (const c of it.checks) lines.push(`- ${describeCheck(c)}`);
        lines.push('');
      }
      if (it.visualCriterion) {
        lines.push(`Visual criterion (cross-reviewed): ${it.visualCriterion}`);
        lines.push('');
      }
    }
  }
  return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const rubric = loadRubric();
  if (rubric.items.length !== 50) {
    console.error(`rubric must have exactly 50 items, found ${rubric.items.length}`);
    process.exit(1);
  }
  if (mode === 'write') {
    fs.writeFileSync(LOCK, rubricHash() + '\n');
    fs.writeFileSync(MD, renderMarkdown(rubric) + '\n');
    if (!fs.existsSync(BASELINE)) fs.copyFileSync(RUBRIC, BASELINE);
    console.log('RUBRIC.lock + RUBRIC.md written');
  } else {
    const problems = [];
    const lock = fs.existsSync(LOCK) ? fs.readFileSync(LOCK, 'utf8').trim() : '';
    if (lock !== rubricHash()) problems.push(`A1: RUBRIC.lock (${lock.slice(0, 12)}) does not match rubric.json (${rubricHash().slice(0, 12)})`);
    if (fs.existsSync(BASELINE)) problems.push(...compareStrictness(JSON.parse(fs.readFileSync(BASELINE, 'utf8')), rubric));
    else problems.push('A2: rubric.baseline.json missing');
    if (fs.existsSync(MD) && fs.readFileSync(MD, 'utf8').trim() !== renderMarkdown(rubric).trim()) problems.push('A1: RUBRIC.md is stale (regenerate with --write, human approval required)');
    if (problems.length) {
      for (const p of problems) console.error('✗ ' + p);
      process.exit(1);
    }
    console.log('✓ rubric lock, baseline strictness and RUBRIC.md verified (50 items)');
  }
}
