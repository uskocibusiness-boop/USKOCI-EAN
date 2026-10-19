// Pure source admission checks: no database client or provider is created.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { historicalPredecessorFixture } from '../historical_predecessor_fixture.mjs';
import { readAiAuthorityPredecessorPlan } from './ai_draft_authority_predecessor.mjs';

const fixture = run => historicalPredecessorFixture('ai', run);

test('exact historical fixture derives the frozen predecessor and optional D03', () => fixture(root => {
  const plan = readAiAuthorityPredecessorPlan(root);
  assert.equal(plan.source_migration_count, plan.source_inventory.length);
  assert.equal(plan.expected_predecessor_count + 1, plan.source_migration_count);
  assert.equal(plan.expected_predecessor_count, plan.historical_predecessor_count + (plan.d03 ? 1 : 0));
  assert.equal(plan.historical_predecessor_count, 85);
}));
test('historical AI planner rejects the larger current integration source instead of silently admitting it', () => {
  assert.throws(() => readAiAuthorityPredecessorPlan(), /UNKNOWN_MISSING_OR_CHANGED_PREDECESSOR_SOURCE|SOURCE_CR_BYTE/);
});
test('unknown additional migration refuses source admission before any database operation', () => fixture(root => {
  writeFileSync(join(root, 'supabase/migrations/20990101000000_unadmitted.sql'), 'select 1;\n');
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
}));
test('missing historical migration refuses source admission', () => fixture(root => {
  const first = readdirSync(join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()[0];
  unlinkSync(join(root, 'supabase/migrations', first));
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
}));
test('changed historical SQL bytes refuse source admission even with unchanged names', () => fixture(root => {
  const first = readdirSync(join(root, 'supabase/migrations')).filter(name => name.endsWith('.sql')).sort()[0];
  const path = join(root, 'supabase/migrations', first);
  writeFileSync(path, Buffer.concat([readFileSync(path), Buffer.from('\n-- changed disposable test bytes\n')]));
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /UNKNOWN_MISSING_OR_CHANGED_PREDECESSOR_SOURCE/);
}));
test('missing provenance record cannot be hidden by matching physical file count', () => fixture(root => {
  const path = join(root, 'supabase/migrations/MIGRATION_PROVENANCE.json');
  const provenance = JSON.parse(readFileSync(path, 'utf8'));
  provenance.live_history_snapshot.entries.shift();
  writeFileSync(path, JSON.stringify(provenance));
  assert.throws(() => readAiAuthorityPredecessorPlan(root), /SOURCE_PROVENANCE_INVENTORY_MISMATCH/);
}));
