/**
 * Read the authored layout numbers the projection checks need without importing TypeScript.
 * `src/world/layout.ts` is the single source of truth; we extract the few literals we need with
 * a tolerant regex parser and fall back to the last known values (with a warning) if it fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';

const LAYOUT_TS = path.join(ROOT, 'src/world/layout.ts');

const FALLBACK = {
  stairs: {
    main: { base: [7.5, 0, -1.5], dir: [1, -0.35], steps: 18, rise: 0.3, tread: 0.42, width: 2.7 },
  },
  lanternBranch: { from: [-10.5, 5.8, -6.8], to: [3.0, 3.9, 0.2] },
};

const NUM = '-?\\d+(?:\\.\\d+)?';
const VEC = (n) => `\\[\\s*${Array.from({ length: n }, () => `(${NUM})`).join('\\s*,\\s*')}\\s*\\]`;

export function readLayoutSource() {
  try {
    return fs.readFileSync(LAYOUT_TS, 'utf8');
  } catch {
    return '';
  }
}

export function parseLayout(source = readLayoutSource(), warn = console.warn) {
  const out = { stairs: {}, lanternBranch: null, warnings: [] };
  const stairRe = new RegExp(`\\{\\s*id:\\s*'([^']+)'\\s*,\\s*base:\\s*${VEC(3)}\\s*,\\s*dir:\\s*${VEC(2)}\\s*,\\s*steps:\\s*(${NUM})\\s*,\\s*rise:\\s*(${NUM})\\s*,\\s*tread:\\s*(${NUM})\\s*,\\s*width:\\s*(${NUM})`, 'g');
  for (const m of source.matchAll(stairRe)) {
    out.stairs[m[1]] = { base: [+m[2], +m[3], +m[4]], dir: [+m[5], +m[6]], steps: +m[7], rise: +m[8], tread: +m[9], width: +m[10] };
  }
  const lb = new RegExp(`lanternBranch:\\s*\\{[^}]*?from:\\s*${VEC(3)}[^}]*?to:\\s*${VEC(3)}`, 's').exec(source);
  if (lb) out.lanternBranch = { from: [+lb[1], +lb[2], +lb[3]], to: [+lb[4], +lb[5], +lb[6]] };
  if (!out.stairs.main) {
    out.warnings.push('layout.ts: could not parse stairs.main — using fallback values');
    out.stairs.main = FALLBACK.stairs.main;
  }
  if (!out.lanternBranch) {
    out.warnings.push('layout.ts: could not parse lanternBranch — using fallback values');
    out.lanternBranch = FALLBACK.lanternBranch;
  }
  for (const w of out.warnings) warn?.(w);
  return out;
}

/**
 * World-space sample points for a rubric `layout` key.
 *   stairs.<id>  → 4 footprint corners + bottom centre + top centre (top at base.y + steps·rise)
 *   lanternBranch → from, mid, to
 */
export function layoutPoints(key, layout = parseLayout()) {
  if (key.startsWith('stairs.')) {
    const s = layout.stairs[key.slice('stairs.'.length)];
    if (!s) return null;
    const l = Math.hypot(s.dir[0], s.dir[1]) || 1;
    const dx = s.dir[0] / l;
    const dz = s.dir[1] / l;
    const px = -dz;
    const pz = dx;
    const run = s.steps * s.tread;
    const rise = s.steps * s.rise;
    const hw = s.width / 2;
    const [bx, by, bz] = s.base;
    const tx = bx + dx * run;
    const tz = bz + dz * run;
    const ty = by + rise;
    return [
      [bx + px * hw, by, bz + pz * hw],
      [bx - px * hw, by, bz - pz * hw],
      [tx + px * hw, ty, tz + pz * hw],
      [tx - px * hw, ty, tz - pz * hw],
      [bx, by, bz],
      [tx, ty, tz],
    ];
  }
  if (key === 'lanternBranch') {
    const { from, to } = layout.lanternBranch;
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    return [from, mid, to];
  }
  return null;
}
