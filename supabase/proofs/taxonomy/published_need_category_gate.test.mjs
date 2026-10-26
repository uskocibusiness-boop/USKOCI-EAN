import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path = new URL('../../migrations/20261026214500_published_need_category_gate.sql', import.meta.url);
const sql = readFileSync(path, 'utf8');

test('forward publication gate requires a canonical category without rewriting history', () => {
  assert.match(sql, /^begin;/m);
  assert.match(sql, /set local lock_timeout\s*=\s*'5s';/i);
  assert.match(sql, /needs_category_id_fkey/i);
  assert.match(sql, /add constraint needs_published_category_required/i);
  assert.match(sql, /check \(status <> 'PUBLISHED' or category_id is not null\) not valid;/i);
  assert.match(sql, /comment on constraint needs_published_category_required/i);
  assert.match(sql, /commit;\s*$/i);
  assert.doesNotMatch(sql, /validate constraint/i);
  assert.doesNotMatch(sql, /\b(update|delete|insert)\s+public\.needs\b/i);
});
