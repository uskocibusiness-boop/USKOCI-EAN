import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261021014544_ai_history_h1_metadata.sql', 'utf8');
const body = migration.match(/create function public\.rpc_list_owned_ai_history_v1\([\s\S]*?as \$f\$([\s\S]*?)\$f\$/i)?.[1];
const executableBody = body?.replace(/--[^\n]*/g, '');

test('H1 metadata reader has an explicit owner and open-account boundary for every source', () => {
  assert.ok(executableBody, 'H1 function body must be found');
  assert.match(migration, /language plpgsql volatile security definer set search_path=pg_catalog/i);
  assert.match(executableBody, /owner_id uuid := auth\.uid\(\)/i);
  assert.match(executableBody, /perform private\.closure_assert_open\(owner_id\)/i);
  assert.match(executableBody, /c\.account_id = owner_id and c\.purpose = p_purpose/i);
  assert.match(executableBody, /n\.requester_account_id = owner_id/i);
  assert.match(executableBody, /f\.account_id = owner_id and f\.conversation_id = c\.id/i);
  assert.match(executableBody, /s\.conversation_id = c\.id and s\.account_id = owner_id/i);
  assert.match(executableBody, /s\.account_id = owner_id[\s\S]*?r\.account_id = owner_id/i);
  assert.match(migration, /grant execute on function public\.rpc_list_owned_ai_history_v1\(text,timestamptz,uuid,integer\)\s+to authenticated/i);
  assert.doesNotMatch(migration, /grant execute on function public\.rpc_list_owned_ai_history_v1\([^;]+to (?:anon|public|service_role)/i);
});

test('H1 excludes legacy and unrelated purposes, bounds keyset pages, and does not expose content', () => {
  assert.ok(executableBody, 'H1 function body must be found');
  assert.match(executableBody, /p_purpose not in \('NEED_INTAKE','PROFILE'\)/i);
  assert.match(executableBody, /c\.fact_schema_version = 'NEED_FACT_V2'/i);
  assert.match(executableBody, /p_limit < 1 or p_limit > 20/i);
  assert.match(executableBody, /\(c\.created_at, c\.id\) < \(p_before_created_at, p_before_id\)/i);
  assert.match(executableBody, /order by c\.created_at desc, c\.id desc\s+limit p_limit \+ 1/i);
  assert.match(executableBody, /f\.status = 'CONFIRMED'[\s\S]*?f\.superseded_at is null/i);
  assert.match(executableBody, /join private\.worker_ai_saves s on s\.review_id = r\.id/i);
  assert.doesNotMatch(executableBody, /\b(?:ai_messages|candidate|envelope|receipt|message_body|profile_document)\b/i);
  assert.doesNotMatch(executableBody, /\b(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?(?:public|private)\./i);
  assert.match(executableBody, /'visibility', 'VISIBLE'/i);
  assert.match(executableBody, /'canRead', false/i);
  // A bound NEED edit remains an OPEN conversation that /nova can resume by CID.
  assert.match(executableBody, /'canContinue', item\.status = 'OPEN'/i);
  assert.match(executableBody, /coalesce\(item\.completed_at, item\.retention_abandoned_at\)/i);
});
