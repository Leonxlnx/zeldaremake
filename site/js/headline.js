// Pure helpers shared by the site and by gauntlet/scripts/lib/monitor.mjs (node imports this file
// too, so it must stay free of DOM and browser globals): a take's one-line headline and its round
// number from the ledger note / commit subject, and the six-view metric deltas for the headline's
// chips. `take.mjs --publish` stores `headline` / `round` on the take record through monitor.mjs;
// the site derives them again client-side for takes published before those fields existed.

export const HEADLINE_MAX = 200;

const AUTO_NOTE = /^Automated hourly monitor take\b/i;
const ROUND_PREFIX = /^round\s*\d{1,3}\s*(?:\([^)]*\)\s*)?(?:on\s+[0-9a-f]{7,40}\s*)?[-–—:]\s*/i;

/**
 * The first sentence of `text`: ends at the first `.` / `!` / `?` that is followed by whitespace
 * (or the end) — never at a decimal point ("0.0018", "8.80 M") and regardless of what the next
 * sentence starts with (lane names such as "trees-29:" open sentences in lower case).
 */
export function firstSentence(text) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const m = /[.!?](?=\s+\S|\s*$)/.exec(s);
  return m ? s.slice(0, m.index + 1) : s;
}

/** Cut at a word boundary with an ellipsis when `s` is longer than `max`. */
export function truncate(s, max = HEADLINE_MAX) {
  const str = String(s ?? '');
  if (str.length <= max) return str;
  const cut = str.lastIndexOf(' ', max - 1);
  return `${str.slice(0, cut > max * 0.6 ? cut : max - 1).replace(/[\s,;:–—-]+$/, '')}…`;
}

/**
 * The take's headline: the note's first sentence without its "Round N on <sha> —" prefix (the
 * round tag carries that), capped at HEADLINE_MAX; the commit subject when the note is the CI
 * auto-note or missing.
 */
export function headlineOf(note, subject) {
  const n = String(note ?? '').replace(/\s+/g, ' ').trim();
  const subj = String(subject ?? '').replace(/\s+/g, ' ').trim();
  if (!n || AUTO_NOTE.test(n)) return truncate(subj || n);
  let s = firstSentence(n).replace(ROUND_PREFIX, '').trim();
  if (!s) s = subj || n;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return truncate(s);
}

/** Round number from "Round 46", "round-46", "r46/structures" in the note, else the subject; null when absent. */
export function roundOf(note, subject) {
  for (const text of [note, subject]) {
    const s = String(text ?? '');
    if (!s) continue;
    const m = /\bround[\s-]*(\d{1,3})\b/i.exec(s) ?? /\br(\d{2,3})\/[a-z]/.exec(s);
    if (m) return Number(m[1]);
  }
  return null;
}

/** [{ viewpoint, letter, delta }] of one metric across the take's shots (the headline's chips). */
export function viewDeltas(take, key = 'ssim') {
  const shots = Array.isArray(take?.shots) ? take.shots : [];
  return shots
    .filter((s) => s?.viewpoint)
    .map((s) => ({ viewpoint: s.viewpoint, letter: s.viewpoint.charAt(0).toUpperCase(), delta: typeof s.deltas?.[key] === 'number' ? s.deltas[key] : null, value: typeof s.metrics?.[key] === 'number' ? s.metrics[key] : null }));
}
