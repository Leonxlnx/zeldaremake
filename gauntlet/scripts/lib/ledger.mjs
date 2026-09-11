/**
 * Append-only hash-chained ledger of takes (GAUNTLET.md §4.D1).
 *
 *   entry.hash     = "sha256:" + sha256(canonicalJSON(entry without `hash`))
 *   entry.prevHash = previous entry's hash, or "sha256:" + sha256(ledger.genesis) for the first
 *
 * Canonical JSON = keys sorted recursively, arrays kept in order, no whitespace.
 * Only take.mjs writes the real ledger; every other script verifies.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const sha256hex = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const sha256 = (buf) => 'sha256:' + sha256hex(buf);

export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value === undefined ? null : value);
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJSON(v)).join(',') + ']';
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
}

export function entryHash(entry) {
  const { hash: _h, ...rest } = entry;
  return sha256(canonicalJSON(rest));
}

export function genesisHash(ledger) {
  return sha256(String(ledger.genesis ?? ''));
}

export function emptyLedger(genesis = `kokiri-forest-phase1-${new Date().toISOString().slice(0, 10)}`) {
  return {
    note: 'Append-only hash chain of takes. Written only by gauntlet/scripts/take.mjs. Each entry\'s `hash` = sha256(canonical JSON of the entry without `hash`), and `prevHash` = previous entry\'s hash. Editing any entry breaks the chain and fails CI (GAUNTLET.md §4.D1).',
    genesis,
    entries: [],
  };
}

export function loadLedger(file) {
  if (!fs.existsSync(file)) return emptyLedger();
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'));
  ledger.entries ??= [];
  return ledger;
}

export function saveLedger(file, ledger) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
}

export function lastEntry(ledger) {
  return ledger.entries.length ? ledger.entries[ledger.entries.length - 1] : null;
}

export function nextId(ledger) {
  let max = 0;
  for (const e of ledger.entries) {
    const m = /^take-(\d+)$/.exec(e.id ?? '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return { id: `take-${String(max + 1).padStart(4, '0')}`, number: max + 1 };
}

/** How far an entry's `at` may precede the previous entry's when two agents publish concurrently. */
export const CONCURRENT_PUBLISH_WINDOW_MS = 3 * 3600 * 1000;

/** Verify the whole chain. Returns { ok, problems, length }. */
export function verifyChain(ledger) {
  const problems = [];
  let prev = genesisHash(ledger);
  const ids = new Set();
  ledger.entries.forEach((e, i) => {
    const where = `entry ${i} (${e.id ?? '?'})`;
    if (e.prevHash !== prev) problems.push(`${where}: prevHash ${short(e.prevHash)} ≠ expected ${short(prev)}`);
    const h = entryHash(e);
    if (e.hash !== h) problems.push(`${where}: hash ${short(e.hash)} ≠ recomputed ${short(h)}`);
    if (ids.has(e.id)) problems.push(`${where}: duplicate id`);
    ids.add(e.id);
    // `at` is the capture/record time, not the sealing time: two agents publishing concurrently
    // (CI on one branch, a local take on another) legitimately append an entry whose `at` precedes
    // the previous entry's by up to the publish latency. Only gross backdating is a chain problem.
    if (i > 0 && !e.imported && ledger.entries[i - 1].at && e.at && Date.parse(e.at) < Date.parse(ledger.entries[i - 1].at) - CONCURRENT_PUBLISH_WINDOW_MS) problems.push(`${where}: timestamp ${e.at} precedes previous entry by more than ${CONCURRENT_PUBLISH_WINDOW_MS / 3600000} h`);
    prev = e.hash;
  });
  return { ok: problems.length === 0, problems, length: ledger.entries.length, head: prev };
}

/** Append `entry` (without prevHash/hash; id/number assigned when missing) to the ledger; returns the sealed entry. */
export function appendEntry(ledger, entry) {
  const prev = lastEntry(ledger);
  const next = entry.id ? null : nextId(ledger);
  const sealed = { ...entry, ...(next ? { id: next.id, number: next.number } : {}), prevHash: prev ? prev.hash : genesisHash(ledger) };
  delete sealed.hash;
  sealed.hash = entryHash(sealed);
  ledger.entries.push(sealed);
  return sealed;
}

/** Content identity of an entry (independent of chain position and id) — used to reconcile ledgers. */
export function entryIdentity(e) {
  // `capturedAt` survives a resequence (see mergeLedgers); `at` is the chain's ordering time and may
  // move, so identity is keyed on the original time.
  return canonicalJSON({ at: e.capturedAt ?? e.at, sha: e.sha, agent: e.agent, images: e.images ?? null, note: e.note ?? null });
}

/**
 * Append entries of `local` that are missing from `base` onto `base`'s chain (same content,
 * recomputed prevHash/hash). Used by `take.mjs --publish`: the monitor branch's ledger is the
 * canonical chain and local-only takes are re-sealed on top of it. Returns the merged ledger,
 * `appended` (ids of all entries added) and `rebased` (those whose id or hash had to change).
 */
export function mergeLedgers(base, local) {
  const merged = { ...base, entries: [...base.entries] };
  const known = new Set(merged.entries.map(entryIdentity));
  const appended = [];
  const rebased = [];
  for (const e of local.entries) {
    const idty = entryIdentity(e);
    if (known.has(idty)) continue;
    const { hash: _h, prevHash: _p, ...content } = e;
    const ids = new Set(merged.entries.map((x) => x.id));
    if (ids.has(content.id)) {
      const next = nextId(merged);
      content.id = next.id;
      content.number = next.number;
    }
    // Concurrent publishers: an entry that started (or was imported with an `at`) before the entry
    // now at the chain's head is appended AFTER it, so `at` — the chain's ordering time — moves to
    // just after the head's while the original capture/record time is kept in `capturedAt`. This
    // happens before sealing (the hash covers the final values); sealed entries are never touched.
    const head = merged.entries[merged.entries.length - 1];
    if (head?.at && content.at && Date.parse(content.at) <= Date.parse(head.at)) {
      content.capturedAt = content.capturedAt ?? content.at;
      content.at = new Date(Date.parse(head.at) + 1000).toISOString();
      content.resequenced = true;
    }
    const sealed = appendEntry(merged, content);
    appended.push(sealed.id);
    if (sealed.id !== e.id || sealed.hash !== e.hash) rebased.push(`${e.id}${sealed.id !== e.id ? `→${sealed.id}` : ''}`);
    known.add(idty);
  }
  return { ledger: merged, rebased, appended };
}

function short(h) {
  return typeof h === 'string' ? h.replace(/^sha256:/, '').slice(0, 10) : String(h);
}

/** Word-set Jaccard similarity of two notes (rule D6). */
export function jaccard(a, b) {
  const tok = (s) =>
    new Set(
      String(s ?? '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3),
    );
  const A = tok(a);
  const B = tok(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Validate a take note against rule D6. Returns { ok, problems }. */
export function validateNote(note, earlierNotes, { minChars = 200, maxJaccard = 0.7 } = {}) {
  const problems = [];
  const n = String(note ?? '').trim();
  if (n.length < minChars) problems.push(`D6: note is ${n.length} chars (< ${minChars})`);
  let worst = 0;
  let worstIdx = -1;
  earlierNotes.forEach((prev, i) => {
    const j = jaccard(n, prev);
    if (j > worst) {
      worst = j;
      worstIdx = i;
    }
  });
  if (worst >= maxJaccard) problems.push(`D6: note is ${(worst * 100).toFixed(0)} % Jaccard-similar to earlier note #${worstIdx + 1} (limit ${maxJaccard})`);
  return { ok: problems.length === 0, problems, maxJaccard: worst };
}
