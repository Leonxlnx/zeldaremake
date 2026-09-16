/**
 * Cross-review verdicts (GAUNTLET.md §4.D7). One file per rubric item:
 *   gauntlet/reviews/<item>.json = { item, reviewer, verdict, evidence, takeId, author, at, note, history: [...] }
 * `author` is the author of the reviewed take (recorded when the review is filed). A verdict is
 * invalid when the reviewer is the author of the reviewed take or of the take being scored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REVIEWS_DIR } from './paths.mjs';

export function loadReviews(dir = REVIEWS_DIR) {
  const reviews = {};
  if (!fs.existsSync(dir)) return reviews;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const item = r.item ?? f.replace(/\.json$/, '');
      reviews[item] = { ...r, item };
    } catch (e) {
      reviews[f.replace(/\.json$/, '')] = { item: f.replace(/\.json$/, ''), error: `unreadable: ${e.message}` };
    }
  }
  return reviews;
}

/** All verdicts ever filed (current + history), flattened. */
export function allReviewRecords(reviews) {
  const out = [];
  for (const r of Object.values(reviews)) {
    if (r.error) continue;
    const { history, ...cur } = r;
    out.push(cur);
    for (const h of history ?? []) out.push({ ...h, item: r.item });
  }
  return out;
}

export function reviewValidity(review, takeAuthor) {
  if (!review || review.error) return { valid: false, reason: review?.error ?? 'no review' };
  if (!['pass', 'fail'].includes(review.verdict)) return { valid: false, reason: `verdict "${review.verdict}" is not pass|fail` };
  if (!review.reviewer) return { valid: false, reason: 'missing reviewer' };
  if (review.author && review.reviewer === review.author) return { valid: false, reason: `D7: reviewer ${review.reviewer} authored the reviewed take` };
  if (takeAuthor && review.reviewer === takeAuthor) return { valid: false, reason: `D7: reviewer ${review.reviewer} is the author of this take` };
  if (!review.evidence) return { valid: false, reason: 'missing evidence path' };
  return { valid: true, reason: null };
}

export function writeReview(dir, review) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${review.item}.json`);
  let history = [];
  if (fs.existsSync(file)) {
    try {
      const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
      const { history: ph, ...cur } = prev;
      history = [cur, ...(ph ?? [])].slice(0, 50);
    } catch {
      history = [];
    }
  }
  const record = { ...review, history };
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  return file;
}
