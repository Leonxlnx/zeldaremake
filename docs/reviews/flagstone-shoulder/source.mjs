import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const pin = '71843a28538f00bdbbd0005a65a1b588315753b5';
const edits = JSON.parse(fs.readFileSync(new URL('./edits.json', import.meta.url), 'utf8'));
const hash = s => createHash('sha256').update(s).digest('hex');
export function sourcePair(name) {
  const definition = edits[name]; assert.ok(definition);
  const before = execFileSync('git', ['show', pin + ':src/world/hardscape/' + name + '.ts'], {encoding: 'utf8'});
  assert.equal(hash(before), definition.beforeSHA256);
  let after = before;
  for (const edit of definition.edits) {
    assert.equal(after.split(edit.before).length, 2, 'Unique pinned edit context');
    after = after.replace(edit.before, edit.after);
  }
  assert.equal(hash(after), definition.afterSHA256);
  return {before, after};
}
