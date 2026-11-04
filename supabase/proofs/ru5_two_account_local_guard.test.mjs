import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertRu5TwoAccountLocal, RU5_TWO_ACCOUNT_LOCAL_ACK } from './ru5_two_account_local_guard.mjs';

const local=()=>({RU5_TWO_ACCOUNT_LOCAL_ACK,
  SUPABASE_URL:'http://127.0.0.1:54321',
  DB_URL:'postgresql://postgres:SYNTHETIC_PASSWORD@127.0.0.1:54322/postgres'});
test('existing two-account Auth/Need journey admits only the disposable local stack',()=>{
  assert.equal(assertRu5TwoAccountLocal(local()),true);
  for(const bad of [
    {RU5_TWO_ACCOUNT_LOCAL_ACK:undefined},
    {SUPABASE_URL:'https://leqcwgzvjsxugfgzdmth.supabase.co'},
    {SUPABASE_URL:'http://127.0.0.1.attacker.invalid:54321'},
    {DB_URL:'postgresql://postgres:DO_NOT_PRINT@db.production.invalid:5432/postgres'},
    {DB_URL:'postgresql://postgres:DO_NOT_PRINT@127.0.0.1:5432/postgres'},
    {DB_URL:'postgresql://postgres:DO_NOT_PRINT@127.0.0.1:54322/postgres?host=remote.invalid'},
  ]) assert.throws(()=>assertRu5TwoAccountLocal({...local(),...bad}),error=>{
    assert.match(error.message,/RU5_(TWO_ACCOUNT|DEVICE)_/);
    assert.ok(!error.message.includes('DO_NOT_PRINT'));
    assert.ok(!error.message.includes('postgresql://'));
    return true;
  });
});
test('script and CI shell enforce local-only admission before first real write',()=>{
  const script=readFileSync(new URL('./ru5_two_account_auth_journey.mjs',import.meta.url),'utf8');
  const shell=readFileSync(new URL('./ru5_two_account_auth_journey_ci.sh',import.meta.url),'utf8');
  const gate=script.indexOf('assertRu5TwoAccountLocal(process.env);');
  assert.ok(gate>0);
  for(const token of ['createClient(url,', 'await createRealSession(', 'psql(`'])
    assert.ok(script.indexOf(token)>gate,token);
  const shellGate=shell.indexOf('assertRu5TwoAccountLocal({');
  assert.ok(shellGate>0);
  for(const token of ['supabase db reset --local', 'psql "$DB_URL" -v ON_ERROR_STOP',
    'node "$GITHUB_WORKSPACE/supabase/proofs/ru5_two_account_auth_journey.mjs"'])
    assert.ok(shell.indexOf(token)>shellGate,token);
  assert.match(shell,/export RU5_TWO_ACCOUNT_LOCAL_ACK/);
  assert.match(script,/seeded_published_need_not_an_ai_publication/);
  assert.match(script,/agreement_chat_not_exercised/);
});
