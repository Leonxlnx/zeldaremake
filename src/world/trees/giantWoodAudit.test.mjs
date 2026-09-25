/**
 * Run: node --test src/world/trees/giantWoodAudit.test.mjs (Node 20+, no browser needed).
 *
 * `giantWoodByTree` exists because the giants' wood is the largest single geometry in the trees
 * system — 1,508,970 triangles static, 1.36 M drawn at hero A, flat with distance
 * (art/environment/squad2-2026-09-23/giantwood/) — and no audit said WHERE in a giant those
 * triangles are. Without that split a rung for the family cannot be designed: the first proposal
 * aimed at the trunk arc, which `heroDistance` already gates twice over (CORRECTION.md).
 *
 * The row's shape is what makes it useful, so it is pinned here: the three parts must add back to
 * the total (no part silently dropped), the near base must stay out of it (it is pooled and drawn
 * only inside NEAR_BASE_IN_M, so counting it would double-count against `nearBase.boles`), and the
 * hero distance must travel with the row — a heavy giant no fixed camera looks at is the one a rung
 * can coarsen, and that is the whole point of reporting it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'index.ts'), 'utf8');

/** the audit entry as written, from `giantWoodByTree:` to the line that closes the sort */
const entry = () => {
  const at = source.indexOf('giantWoodByTree: [...giants]');
  assert.notEqual(at, -1, 'giantWoodByTree is gone from the trees audit');
  return source.slice(at, source.indexOf('),', source.indexOf('.sort(', at)) + 2);
};

test('the row splits a giant s wood into parts that add back to its total', () => {
  const src = entry();
  assert.match(src, /const bark = g\.asset\.bark\?\.triangles \?\? 0/, 'the relief bole is the first part');
  assert.match(src, /const boughs = g\.asset\.boughDress\.reduce/, "the authored boughs' dressing is the second part");
  assert.match(src, /g\.asset\.woodTriangles - bark - boughs/, 'the remainder must be total − bark − boughs, or a part is silently dropped');
  assert.match(src, /g\.asset\.woodTriangles/, "the row's total is the asset's own wood count");
});

test('the leaf column is in the row, because the mesh holds leaves too', () => {
  const src = entry();
  assert.match(src, /g\.asset\.leafTriangles/, "a giant's laminae share the geometry its wood is in (1 wood group + GIANT_LEAF_BANDS leaf bands per giant), so a row without them invites the family name to be read as wood only");
});

test('the near base stays out of the row', () => {
  const src = entry();
  assert.doesNotMatch(src, /nearBaseAudit/, 'the near base is pooled and reported by nearBase.boles — counting it here double-counts');
});

test('the hero distance travels with the row', () => {
  const src = entry();
  assert.match(src, /Number\.isFinite\(g\.heroDistance\)/, 'a giant no fixed camera holds must read null, not Infinity');
  assert.match(source, /giants: \{ def: GiantTreeDef; asset: GiantAsset; origin: Vector3; angle: number; heroDistance: number \}\[\]/, 'heroDistance must be kept on the giants list, not recomputed');
  assert.match(source, /giants\.push\(\{ def, asset, origin, angle: Math\.atan2\(pz, px\), heroDistance \}\)/, 'the built giant carries the distance its relief-bole gate used');
});

test('the rows are ordered heaviest first', () => {
  assert.match(entry(), /\.sort\(\(a, b\) => b\[1\] - a\[1\]\)/, 'an unordered list makes the heavy trees hard to see');
});
