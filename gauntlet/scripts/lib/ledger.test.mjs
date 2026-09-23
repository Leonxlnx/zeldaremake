// node --test gauntlet/scripts/lib/ledger.test.mjs
// Concurrent-publish merge: a local entry that started before the monitor's newest entry is
// appended behind it with a later ordering time (`at`), keeps its capture time (`capturedAt`), is
// still found by identity (applyToMonitor's lookup), and a second merge of the same local ledger
// adds nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendEntry, mergeLedgers, entryIdentity, verifyChain } from './ledger.mjs';

const mk = (id, at, agent) => ({ id, number: Number(id.slice(5)), at, agent, sha: `sha-${agent}`, items: ['W01'], note: `note ${agent}`, images: null });

test('resequenced entry keeps identity and merges idempotently', () => {
  const monitor = { entries: [] };
  appendEntry(monitor, mk('take-0001', '2026-09-11T10:00:00.000Z', 'fable'));
  const local = { entries: [] };
  const theirs = appendEntry(local, mk('take-0001', '2026-09-11T09:50:00.000Z', 'astra'));

  const first = mergeLedgers(monitor, local);
  assert.equal(first.ledger.entries.length, 2);
  const sealed = first.ledger.entries[1];
  assert.equal(sealed.id, 'take-0002');
  assert.equal(sealed.resequenced, true);
  assert.equal(sealed.capturedAt, '2026-09-11T09:50:00.000Z');
  assert.ok(Date.parse(sealed.at) > Date.parse(first.ledger.entries[0].at), 'ordering time follows the head');
  assert.ok(first.ledger.entries.some((e) => entryIdentity(e) === entryIdentity(theirs)), 'lookup by identity after resequencing');
  assert.equal(verifyChain(first.ledger).ok, true);

  const again = mergeLedgers(first.ledger, local);
  assert.equal(again.appended.length, 0, 'second merge of the same local ledger appends nothing');
  assert.equal(again.ledger.entries.length, 2);
});

test('an entry that is already later than the head is not resequenced', () => {
  const monitor = { entries: [] };
  appendEntry(monitor, mk('take-0001', '2026-09-11T10:00:00.000Z', 'fable'));
  const local = { entries: [] };
  appendEntry(local, mk('take-0001', '2026-09-11T10:30:00.000Z', 'astra'));
  const merged = mergeLedgers(monitor, local).ledger;
  assert.equal(merged.entries[1].resequenced, undefined);
  assert.equal(merged.entries[1].at, '2026-09-11T10:30:00.000Z');
});
