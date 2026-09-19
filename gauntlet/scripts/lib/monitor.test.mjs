// node --test gauntlet/scripts/lib/monitor.test.mjs
// The director's-cut fields (headline / round from a ledger note), the evidence sheet name parser,
// and the evidence export (a temp art/environment with one round: downscaled JPEGs, README copied,
// pairs recognised, a second run converts nothing).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { headlineOf, roundOf, firstSentence, truncate, viewDeltas, HEADLINE_MAX } from '../../../site/js/headline.js';
import { parseSheetName, syncEvidence, syncPlayerStrip, monitorDataDir } from './monitor.mjs';

const NOTE_0116 =
  'Round 46 on 973a21e - the survey-2 re-rank, evidence-gated: every lane had to change the exact player-height pose it was briefed on, and an after that looked like its before was recorded as a fail. trees-29: the emergent column boles at 4 m (w07-spine-l, w29-house-l) were a flat green camo decal in the frames where the reference shows deep fissured bark. Six views: A -0.0006, B -0.0009, C +0.0001, D -0.0018, E -0.0007, F +0.0007. Draws 521, 8.80 M tris on A. Score 24/50.';

test('headline: first sentence without the round prefix, capitalised, capped', () => {
  const h = headlineOf(NOTE_0116, 'Merge r46/structures (structures-29)');
  assert.ok(h.startsWith('The survey-2 re-rank, evidence-gated: every lane'), h);
  assert.ok(h.endsWith('recorded as a fail.'), h);
  assert.ok(h.length <= HEADLINE_MAX);
  assert.equal(roundOf(NOTE_0116, ''), 46);
});

test('headline: decimal points do not end the sentence; long sentences are cut at a word', () => {
  assert.equal(firstSentence('D pays 0.0018 for the risers. Next sentence.'), 'D pays 0.0018 for the risers.');
  assert.equal(firstSentence('Score 24/50 vs 23/50 before'), 'Score 24/50 vs 23/50 before');
  const long = `${'word '.repeat(60)}end.`;
  const t = truncate(long, 60);
  assert.ok(t.length <= 61 && t.endsWith('…'), t);
});

test('headline: the CI auto-note yields the commit subject; an empty note too', () => {
  assert.equal(headlineOf('Automated hourly monitor take of abc1234 ("x", branch main) at …', 'Trees: canopy roof'), 'Trees: canopy roof');
  assert.equal(headlineOf('', 'Subject only'), 'Subject only');
  assert.equal(headlineOf(undefined, undefined), '');
});

test('round: "Round 47", "round-12", "r46/structures" in the subject when the note has none', () => {
  assert.equal(roundOf('nothing here', 'Merge r46/structures (structures-29)'), 46);
  assert.equal(roundOf('round-12 sealed', ''), 12);
  assert.equal(roundOf('Round 47 — the fix list', ''), 47);
  assert.equal(roundOf('no round', 'no round'), null);
});

test('viewDeltas reads the shots in order with their metric delta', () => {
  const take = { shots: [{ viewpoint: 'A_stairs', deltas: { ssim: -0.0006 }, metrics: { ssim: 0.2252 } }, { viewpoint: 'B_house', deltas: {}, metrics: { ssim: 0.2 } }] };
  const d = viewDeltas(take);
  assert.deepEqual(d.map((x) => x.letter), ['A', 'B']);
  assert.equal(d[0].delta, -0.0006);
  assert.equal(d[1].delta, null);
});

test('parseSheetName: lane, pose, before/after pairs', () => {
  assert.deepEqual(parseSheetName('trees29-w07-spine-l.jpg'), { name: 'trees29-w07-spine-l', lane: 'trees', laneRaw: 'trees29', pose: 'w07-spine-l', pairKey: null, pairRole: null });
  const a = parseSheetName('character9-stairs-peak-after.jpg');
  assert.equal(a.lane, 'character');
  assert.equal(a.pairKey, 'character9-stairs-peak');
  assert.equal(a.pairRole, 'after');
  assert.equal(parseSheetName('character9-stairs-peak-before.jpg').pairRole, 'before');
  assert.equal(parseSheetName('r45-sn-boulder-stairfoot.jpg').lane, 'round');
  assert.equal(parseSheetName('r45-sn-boulder-stairfoot.jpg').pose, 'sn-boulder-stairfoot');
  assert.equal(parseSheetName('survey2-01-column-trees-smooth-cylinders.jpg').lane, 'survey');
  assert.equal(parseSheetName('veg25-crop-B-house-shrubs.jpg').lane, 'veg');
  assert.equal(parseSheetName('expansion1-ledge-stair.jpg').pose, null);
});

test('syncEvidence: exports a round with pairs, idempotently; syncPlayerStrip writes the take strip', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-ev-'));
  const root = path.join(tmp, 'repo');
  const monitorDir = path.join(tmp, 'monitor');
  const round = path.join(root, 'art', 'environment', 'round99-review');
  fs.mkdirSync(round, { recursive: true });
  fs.mkdirSync(path.join(root, 'art', 'environment', 'not-a-round'), { recursive: true });
  const png = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 40, g: 90, b: 30 } } }).png().toBuffer();
  fs.writeFileSync(path.join(round, 'lane1-w00-spine-f-before.png'), png);
  fs.writeFileSync(path.join(round, 'lane1-w00-spine-f-after.png'), png);
  fs.writeFileSync(path.join(round, 'lane2-overview.jpg'), await sharp(png).jpeg().toBuffer());
  fs.writeFileSync(path.join(round, 'notes.txt'), 'ignored');
  fs.writeFileSync(path.join(round, 'README.md'), '# Round 99 — test round (take-0123)\n\nBefore = take-0122, after = take-0123.\n');

  const first = await syncEvidence(monitorDir, { root, log: () => {}, maxWidth: 800 });
  assert.equal(first.index.sets.length, 1);
  const s = first.index.sets[0];
  assert.equal(s.id, 'round99-review');
  assert.equal(s.round, 99);
  assert.equal(s.kind, 'round');
  assert.equal(s.title, 'Round 99 — test round (take-0123)');
  assert.deepEqual(s.takes, ['take-0122', 'take-0123']);
  assert.equal(s.text, 'evidence/round99-review/README.md');
  assert.equal(s.sheets.length, 3);
  assert.equal(first.converted, 3);
  const after = s.sheets.find((x) => x.pairRole === 'after');
  assert.equal(after.pairKey, 'lane1-w00-spine-f');
  assert.equal(after.w, 800);
  assert.equal(after.h, 450);
  assert.ok(after.file.endsWith('.jpg'));
  assert.ok(fs.existsSync(path.join(monitorDataDir(monitorDir), after.file)));
  assert.ok(fs.existsSync(path.join(monitorDataDir(monitorDir), 'evidence', 'round99-review', 'README.md')));

  const second = await syncEvidence(monitorDir, { root, log: () => {}, maxWidth: 800 });
  assert.equal(second.converted, 0);
  assert.equal(second.index.sets[0].sheets.length, 3);

  // player strip: a frames dir with index.json + PNGs → data/takes/<id>/player/*.jpg + index.json
  const frames = path.join(tmp, 'frames');
  fs.mkdirSync(frames, { recursive: true });
  fs.writeFileSync(path.join(frames, 'w00-spine-f.png'), png);
  fs.writeFileSync(path.join(frames, 'index.json'), JSON.stringify({ renderer: 'test', capturedAt: '2026-09-19T00:00:00Z', width: 1600, height: 900, poses: [{ name: 'w00-spine-f', label: 'Plaza', p: [0, 1.45, 0], t: [0, 1.3, -5], fov: 46, file: 'w00-spine-f.png' }, { name: 'missing', file: 'missing.png' }] }));
  const rec = await syncPlayerStrip({ monitorDir, takeId: 'take-0123', framesDir: frames, log: () => {}, width: 640 });
  assert.equal(rec.count, 1);
  assert.equal(rec.poses[0].file, 'takes/take-0123/player/w00-spine-f.jpg');
  assert.equal(rec.poses[0].label, 'Plaza');
  assert.ok(fs.existsSync(path.join(monitorDataDir(monitorDir), rec.poses[0].file)));
  assert.ok(fs.existsSync(path.join(monitorDataDir(monitorDir), rec.index)));
  fs.rmSync(tmp, { recursive: true, force: true });
});
