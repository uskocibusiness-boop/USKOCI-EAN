// Shared bounded PostgreSQL pricing fixture. PGlite 18, not hosted PG17/Auth/RLS.
// Existing environmental substitutes remain explicit below. Current-body callers
// may supply reviewed definitions and extra domain tables; no remote I/O exists.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
export async function createHourlyFixture({functionOverrides={},extraTables=[],beforeFunctions='',afterFunctions='',database=null}={}) {
 const db=database??new PGlite({extensions:{pgcrypto}});
 try {
const bootstrap = readFileSync(new URL('../supabase/proofs/privacy/bootstrap/current-application.sql', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(bootstrap).digest('hex'), '1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f');

const WORKER = '11111111-1111-4111-8111-111111111111';
const REQUESTER = '22222222-2222-4222-8222-222222222222';
const FOREIGN = '33333333-3333-4333-8333-333333333333';
const PROFILE = '44444444-4444-4444-8444-444444444444';
const REQUESTER_PROFILE = '55555555-5555-4555-8555-555555555555';
const changedNames = ['private.assert_application_price_v5', 'public.rpc_submit_response',
  'public.rpc_resolve_stale_response_after_need_edit', 'public.rpc_select_response',
  'public.rpc_list_need_candidates', 'public.rpc_list_need_candidates_page',
  'public.rpc_list_my_applications', 'public.rpc_list_my_applications_page',
  'public.rpc_ai_open_need_edit_conversation_v2'];
const tables = [
  'public.app_profiles', 'public.needs', 'public.marketplace_responses', 'public.marketplace_response_versions',
  'public.need_selections', 'public.agreements', 'public.agreement_versions', 'public.agreement_execution',
  'public.opportunity_deliveries', 'public.notification_deliveries', 'public.user_activity_events',
  'private.response_application_snapshots', 'private.response_submit_commands',
  'private.response_revision_resolution_commands', 'private.selection_commands',
  'private.connection_activations', 'private.connection_policy_versions',
  'public.need_sensitive', 'public.need_geography', 'public.need_requirement_details',
  'public.ai_conversations', 'public.ai_structured_facts', 'private.need_fact_registry',
];
const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
const value = async (sql, args = []) => (await rows(sql, args))[0]?.value;
const actor = id => value("select set_config('request.jwt.claim.sub',$1,false) as value", [id ?? '']);
const fn = (name, args = '') => {
  if (Object.hasOwn(functionOverrides,name) && !args) return functionOverrides[name];
  const marker = `CREATE OR REPLACE FUNCTION ${name}(${args}`;
  const start = bootstrap.indexOf(marker);
  assert(start >= 0, `missing function ${name}`);
  const body = bootstrap.indexOf('AS $function$', start);
  const end = bootstrap.indexOf('$function$;', body + 13);
  assert(end > body);
  return bootstrap.slice(start, end + '$function$;'.length);
};
const metadata = () => rows(`select n.nspname||'.'||p.proname as name, p.oid, p.proowner, p.proacl,
  p.prosecdef,p.proconfig,p.provolatile,p.prorettype from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [changedNames]);
const hashes = () => rows(`select n.nspname||'.'||p.proname as name,md5(p.prosrc) as hash
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [changedNames]);
const basisColumns = () => value(`select count(*)::integer as value from information_schema.columns
  where table_schema='public' and table_name in ('marketplace_responses','marketplace_response_versions') and column_name='price_basis'`);
async function fails(operation, message, code) {
  await assert.rejects(operation, error => {
    assert.match(error.message, new RegExp(message));
    if (code) assert.equal(error.code, code);
    return true;
  });
}
async function need(basis, amount = 1200, required = 4, mode = 'MY_PRICE') {
  const id = randomUUID();
  await db.query(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,
    required_slots,mode,requester_price_rsd,price_basis) values($1,$2,$3,'PUBLISHED','Posao','Opis posla','Selidbe',$4,$5,$6,$7)`,
  [id, REQUESTER, REQUESTER_PROFILE, required, mode, amount, basis]);
  return id;
}
async function submit(id, price = 1200, covered = 2, revision = 1, key = randomUUID(), profile = PROFILE) {
  return value(`select public.rpc_submit_response($1,$2,$3,$4,$5,null,null,'',$6) as value`,
    [id, revision, profile, covered, price, key]);
}
async function select(id, receipt, key = randomUUID(), revision = receipt.needRevision) {
  return value(`select public.rpc_select_response($1,$2,$3,$4,$5,$6) as value`,
    [id, revision, receipt.responseId, receipt.version, receipt.contentHash, key]);
}
async function resolveStale(receipt, revision, action, price = null, covered = null, key = randomUUID()) {
  return value(`select public.rpc_resolve_stale_response_after_need_edit($1,$2,$3,$4,$5,$6,$7,null,null,'') as value`,
    [receipt.responseId, receipt.version, revision, key, action, covered, price]);
}
async function stale(id, receipt, basis, amount = 1200) {
  await db.query(`update public.needs set revision=revision+1,price_basis=$2,requester_price_rsd=$3 where id=$1`, [id, basis, amount]);
  await db.query(`update public.marketplace_responses set status='STALE_REVIEW_REQUIRED' where id=$1`, [receipt.responseId]);
}
async function immutableRows(responseId) {
  return value(`select jsonb_build_object(
    'response',(select to_jsonb(r)-'price_basis' from public.marketplace_responses r where id=$1),
    'versions',(select jsonb_agg(to_jsonb(v)-'price_basis' order by version) from public.marketplace_response_versions v where response_id=$1),
    'submit',(select jsonb_agg(to_jsonb(c) order by client_request_id) from private.response_submit_commands c where response_id=$1),
    'selections',(select jsonb_agg(to_jsonb(c) order by client_request_id) from private.selection_commands c where response_id=$1),
    'agreement',(select jsonb_agg(to_jsonb(v) order by v.version) from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.selected_response_id=$1)
  ) as value`, [responseId]);
}

  await db.exec(`create schema private; create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    set check_function_bodies=off;`);
  await db.exec(fn('private.taxonomy_handoff_valid_v1'));
  for (const name of [...tables,...extraTables]) {
    const quoted = name.split('.').map(p => `"${p}"`).join('.');
    const marker = `CREATE TABLE ${quoted} (`;
    const start = bootstrap.indexOf(marker);
    assert(start >= 0, `missing table ${name}`);
    const end = bootstrap.indexOf('\n);', start);
    let ddl = bootstrap.slice(start, end + 3);
    // The sole schema substitution is a non-participating generated PostGIS
    // projection. No tested price/identity/version column is replaced or omitted.
    if (name === 'public.needs') ddl = ddl.replace(/"approx_geog" extensions\.geography\(Point,4326\) GENERATED ALWAYS AS \([\s\S]*?END\) STORED/, '"approx_geog" text');
    await db.exec(ddl);
    const escaped = quoted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statements = [...bootstrap.matchAll(new RegExp(`ALTER TABLE ${escaped} (?:ALTER COLUMN [^;]* SET DEFAULT [^;]*|ADD CONSTRAINT [^;]*(?:PRIMARY KEY|UNIQUE|CHECK)[^;]*);`, 'g'))].map(m => m[0]);
    for (const sql of statements) await db.exec(sql);
  }
  // Explicit environmental stubs: Auth identity is a local session setting;
  // world/location/time/matching/calendar admit fixtures; public-profile content
  // is irrelevant to price propagation; notification/dispatch/audit are inert.
  // Edit-conversation geography normalization admits ONLY the exact null/REMOTE
  // fixture; this does not prove physical locations. The price validator chain,
  // geography shape validator, price labels and all fact inserts are real SQL.
  // None of the 9 changing functions, state builders, counts, receipts or hashes
  // is stubbed. FK/RLS/production triggers are outside this isolated proof.
  await db.exec(`
    create function private.accounts_same_world(uuid,uuid) returns boolean language sql stable as $$select true$$;
    create function private.need_search_time_admitted_v1(uuid,timestamptz) returns boolean language sql stable as $$select true$$;
    create function private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz) returns jsonb language sql stable as $$select '{"responseAllowed":true,"hardBlockers":[]}'::jsonb$$;
    create function private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid) returns boolean language sql stable as $$select false$$;
    create function private.application_calendar_conflict_v1(uuid) returns boolean language sql stable as $$select false$$;
    create function public.rpc_get_public_profile(uuid) returns jsonb language sql stable as $$select '{}'::jsonb$$;
    create function private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text default 'NORMAL',jsonb default '{}',timestamptz default null) returns void language plpgsql as $$begin end$$;
    create function private.enqueue_dispatch(uuid,timestamptz) returns void language plpgsql as $$begin end$$;
    create function private.audit_marketplace(uuid,text,text,uuid,integer,jsonb) returns void language plpgsql as $$begin end$$;
    create function private.normalize_task_geography(p_value jsonb) returns jsonb language plpgsql immutable as $$
      begin
        if p_value is distinct from '{"mode":"REMOTE","start":null,"end":null,"waypoints":[],"serviceArea":null}'::jsonb then
          raise exception 'R07B_REMOTE_GEOGRAPHY_FIXTURE_ONLY' using errcode='22023';
        end if;
        return p_value;
      end $$;
  `);
  if (beforeFunctions) await db.exec(beforeFunctions);
  for (const name of [...changedNames, 'private.my_application_state', 'private.own_application_rows', 'public.fn_need_covered_slots']) await db.exec(fn(name));
  await db.exec(fn('private.need_candidate_states_v5', 'p_need_id uuid)'));
  await db.exec(fn('private.need_candidate_states_v5', 'p_need_id uuid, p_response_ids'));
  for (const name of ['private.validate_need_v2_fact', 'private.validate_need_v2_fact_pre_country',
    'private.validate_need_v2_fact_pre_location', 'private.validate_need_v2_fact_pre_fastest_retirement',
    'private.need_v2_location_ref_valid']) await db.exec(fn(name));
  // A declared narrow registry fixture, not a replacement implementation: each
  // value still traverses the unmodified production validation chain.
  await db.exec(`insert into private.need_fact_registry(fact_key,schema_version,value_type,required_for_draft,privacy_class,material,target_owner)
    values ('need.price_mode','NEED_FACT_V2','ENUM',true,'PUBLIC',true,'needs'),
      ('need.price_basis','NEED_FACT_V2','ENUM',false,'PUBLIC',true,'needs'),
      ('need.price_rsd','NEED_FACT_V2','INTEGER',false,'PUBLIC',true,'needs'),
      ('need.people_needed','NEED_FACT_V2','INTEGER',true,'PUBLIC',true,'needs'),
      ('need.task_geography','NEED_FACT_V2','OBJECT',true,'PUBLIC',true,'need_geography');`);
  await db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
    values($1,$2,'WORKER','Radnik','Beograd',array['Selidbe'],'ACTIVE'),($3,$4,'REQUESTER','Naručilac','Beograd','{}','ACTIVE')`,
  [PROFILE,WORKER,REQUESTER_PROFILE,REQUESTER]);
  await db.exec(`insert into private.connection_policy_versions(policy_key,version,beneficiary_role,activation_reason,charge_mode,unit_basis,platform_cost_rsd,policy_snapshot)
    values('REQUESTER_SELECTION_V1',1,'REQUESTER','SELECTION','PROMOTIONAL_FREE','HEADCOUNT',0,
    '{"schema":"CONNECTION_POLICY_V1","policyKey":"REQUESTER_SELECTION_V1","version":1,"beneficiaryRole":"REQUESTER","activationReason":"SELECTION","chargeMode":"PROMOTIONAL_FREE","unitBasis":"HEADCOUNT","platformCostRsd":0}');`);

  if (afterFunctions) await db.exec(afterFunctions);

 return {db,WORKER,REQUESTER,FOREIGN,PROFILE,REQUESTER_PROFILE,changedNames,bootstrap,
   rows,value,actor,fn,metadata,hashes,basisColumns,fails,need,submit,select,resolveStale,stale,immutableRows};
 } catch(error) {if(!database)await db.close();throw error;}
}
