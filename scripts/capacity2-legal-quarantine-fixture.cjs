'use strict';
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const root = path.join(__dirname, '..');
const read = name => readFileSync(path.join(root, name), 'utf8');
const preimage = JSON.parse(read('scripts/sql/capacity2_legal_quarantine_20261108.preimage.json'));
const candidates = readdirSync(path.join(root, 'supabase/migrations')).filter(n => /^\d+_r12_quarantine_unverified_legal_20261108\.sql$/.test(n));
assert.equal(candidates.length, 1);
const migrationPath = 'supabase/migrations/' + candidates[0];
const candidate = read(migrationPath);
const accountId = '11111111-1111-4111-8111-111111111111';

async function fixture(Db = PGlite) {
 const db = new Db();
 const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].value;
 const insert = async (table, data) => {
  assert.match(table, /^(?:private|public)\.[a-z_]+$/);
  const keys = Object.keys(data);
  keys.forEach(k => assert.match(k, /^[a-z_][a-z_0-9]*$/));
  return db.query(`insert into ${table}(${keys.join(',')}) select ${keys.map(k => 'x.' + k).join(',')}
   from jsonb_populate_record(null::${table},$1::jsonb) x`, [JSON.stringify(data)]);
 };
 await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema private;
  grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.uid() returns uuid language sql stable as
   $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function private.audit_marketplace(uuid,text,text,uuid,integer,jsonb) returns void
   language plpgsql as $$begin return; end$$;
  create table public.app_accounts(id uuid primary key);
  create table public.notification_push_devices(id uuid primary key);
  create table public.notification_push_attempts(id uuid primary key);
  create table public.ai_conversations(id uuid primary key);
 `);
 await db.exec(read('supabase/migrations/20260908130000_clean_p1_legal_consent_ledger.sql'));
 await db.exec(read('supabase/migrations/20260908140000_clean_p4_processor_map_registry.sql'));
 // The current deployed function bodies and ACLs, not replacements written to
 // make this test pass. Only the unrelated audit sink is an inert fixture.
 for (const fn of [...preimage.functions, ...preimage.currentUiFunctions]) {
  await db.exec(fn.definition);
  await db.exec(`revoke all on function public.${fn.signature} from public,anon,authenticated,service_role;
   grant execute on function public.${fn.signature} to authenticated,service_role;`);
  if (fn.signature === 'rpc_get_legal_bundle()') await db.exec(`grant execute on function public.${fn.signature} to anon;`);
 }
 await db.query('insert into public.app_accounts(id) values($1)', [accountId]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)", [accountId]);
 const documents = [];
 for (const d of preimage.documents) {
  const row = { id: randomUUID(), ...d }; documents.push(row);
  await insert('private.legal_document_versions', row);
 }
 const map = { id: randomUUID(), ...preimage.processorMaps[0] };
 await insert('private.processor_map_sets', map);
 for (const e of preimage.processorEntries) await insert('private.processor_map_entries', { id: randomUUID(), map_id: map.id, ...e });
 for (const i of preimage.providerInventory) await db.query(`update private.processor_provider_inventory p
  set (display_name,technical_purpose,physical_evidence,required_current,active,updated_at)=
   (x.display_name,x.technical_purpose,x.physical_evidence,x.required_current,x.active,x.updated_at)
  from jsonb_populate_record(null::private.processor_provider_inventory,$1::jsonb) x where p.code=x.code`, [JSON.stringify(i)]);
 const snapshot = () => value(`select jsonb_build_object(
  'documents',(select jsonb_agg(to_jsonb(d) order by d.id) from private.legal_document_versions d),
  'maps',(select jsonb_agg(to_jsonb(m) order by m.id) from private.processor_map_sets m),
  'entries',(select jsonb_agg(to_jsonb(e) order by e.id) from private.processor_map_entries e),
  'inventory',(select jsonb_agg(to_jsonb(i) order by i.code) from private.processor_provider_inventory i),
  'acceptances',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.account_legal_acceptance_events a),
  'functions',(select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'config',p.proconfig,
   'definer',p.prosecdef,'definition',pg_get_functiondef(p.oid)) order by p.oid)
   from pg_proc p where p.oid in('public.rpc_get_legal_bundle()'::regprocedure,'public.rpc_accept_legal_bundle(text)'::regprocedure,
   'public.rpc_get_processor_map_status()'::regprocedure,'public.rpc_accept_reviewed_legal_bundle(text,text,text)'::regprocedure,
   'public.rpc_read_my_legal_acceptance(text)'::regprocedure)),
  'tableSecurity',(select jsonb_agg(jsonb_build_object('name',c.oid::regclass::text,'owner',c.relowner,
   'acl',c.relacl,'rls',c.relrowsecurity,'forcedRls',c.relforcerowsecurity) order by c.oid)
   from pg_class c where c.oid in('private.legal_document_versions'::regclass,'private.processor_map_sets'::regclass,
   'private.processor_map_entries'::regclass,'private.processor_provider_inventory'::regclass,'public.account_legal_acceptance_events'::regclass))
 ) as value`);
 const run = async () => { try { return await db.exec(candidate); } catch (e) { await db.exec('rollback'); throw e; } };
 const asRole = async (role, sql, args = []) => {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec('set role ' + role);
  try { return await value(sql, args); } finally { await db.exec('reset role'); }
 };
 return { db, value, insert, snapshot, run, asRole, documents, map, accountId };
}
module.exports = { fixture, preimage, candidate, migrationPath, accountId };
