/**
 * Repository paths shared by the gauntlet scripts (pure — no puppeteer/sharp imports).
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const GAUNTLET = path.join(ROOT, 'gauntlet');
export const RUBRIC_PATH = path.join(GAUNTLET, 'rubric.json');
export const BASELINE_PATH = path.join(GAUNTLET, 'rubric.baseline.json');
export const LOCK_PATH = path.join(GAUNTLET, 'RUBRIC.lock');
export const LEDGER_PATH = path.join(GAUNTLET, 'ledger.json');
export const CLAIMS_PATH = path.join(GAUNTLET, 'claims.json');
export const REVIEWS_DIR = path.join(GAUNTLET, 'reviews');
export const REPORTS_DIR = path.join(GAUNTLET, 'reports');
export const OUT_DIR = path.join(GAUNTLET, 'out');
export const LAST_DIR = path.join(OUT_DIR, 'last');
export const PREV_DIR = path.join(OUT_DIR, 'prev');
export const MONITOR_DIR = path.join(ROOT, '.monitor');
export const REFERENCE_DIR = path.join(ROOT, 'reference');
export const REFERENCE_FRAMES = path.join(REFERENCE_DIR, 'frames');
export const REFERENCE_PHASH = path.join(REFERENCE_DIR, 'phash.json');
export const DIST_DIR = path.join(ROOT, 'dist');
export const AGENTS_DIR = path.join(ROOT, '.agents');

export function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error(`cannot read JSON ${file}: ${e.message}`);
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function loadRubric() {
  return readJson(RUBRIC_PATH);
}

export function rel(p) {
  const r = path.relative(ROOT, p);
  if (!r) return '.';
  return r.startsWith('..') ? p : r;
}

/** Resolve a CLI path argument against the repo root (absolute paths pass through). */
export function resolveArg(p, fallback) {
  const v = p === undefined || p === true ? fallback : p;
  if (v === undefined) return undefined;
  return path.isAbsolute(v) ? v : path.resolve(ROOT, v);
}
