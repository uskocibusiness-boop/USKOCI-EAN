import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20261021014557_ai_history_h2_messages.sql', 'utf8');
const body = migration.match(/create function public\.rpc_list_owned_ai_history_messages_v1\([\s\S]*?as \$f\$([\s\S]*?)\$f\$/i)?.[1]
  ?.replace(/--[^\n]*/g, '');

test('H2 has owner, closure, purpose and session checks before any message read', () => {
  assert.ok(body);
  assert.match(migration, /language plpgsql volatile security definer set search_path=pg_catalog/i);
  assert.match(body, /owner_id uuid := auth\.uid\(\)/i);
  assert.match(body, /perform private\.closure_assert_open\(owner_id\)/i);
  assert.match(body, /c\.id = p_conversation_id and c\.account_id = owner_id and c\.purpose = p_purpose/i);
  assert.match(body, /c\.fact_schema_version = 'NEED_FACT_V2'/i);
  assert.match(body, /s\.conversation_id = c\.id and s\.account_id = owner_id/i);
  assert.match(body, /conversation_status not in \('COMPLETED','ABANDONED'\)/i);
  assert.match(body, /m\.account_id = owner_id and m\.conversation_id = p_conversation_id/i);
  assert.equal((body.match(/m\.role in \('USER','ASSISTANT'\)/g) ?? []).length, 2,
    'cursor and transcript must exclude any future internal message role');
  assert.match(migration, /revoke all on function public\.rpc_list_owned_ai_history_messages_v1\(text,uuid,uuid,integer\)\s+from public, anon, authenticated, service_role/i);
  assert.match(migration, /grant execute on function public\.rpc_list_owned_ai_history_messages_v1\(text,uuid,uuid,integer\)\s+to authenticated/i);
});

test('H2 resolves an opaque cursor only inside the owner conversation and never returns global sequence', () => {
  assert.ok(body);
  assert.match(body, /p_limit < 1 or p_limit > 50/i);
  assert.match(migration, /p_before_message_id uuid default null/i);
  assert.match(body, /select m\.sequence_no into before_sequence\s+from public\.ai_messages m/i);
  assert.match(body, /m\.id = p_before_message_id and m\.account_id = owner_id\s+and m\.conversation_id = p_conversation_id/i);
  assert.match(body, /if not found then raise exception 'AI_HISTORY_CURSOR_INVALID'/i);
  assert.match(body, /m\.sequence_no < before_sequence/i);
  assert.match(body, /order by m\.sequence_no desc\s+limit p_limit \+ 1/i);
  assert.match(body, /'hasMore', row_count > p_limit/i);
  assert.match(body, /'nextBeforeMessageId', next_before_message_id/i);
  assert.doesNotMatch(body, /'sequence'|'nextBeforeSequence'|item\.sequence_no::text/i);
  assert.doesNotMatch(body, /\b(?:insert|update|delete|truncate)\s+(?:into\s+|from\s+)?(?:public|private)\./i);
});
