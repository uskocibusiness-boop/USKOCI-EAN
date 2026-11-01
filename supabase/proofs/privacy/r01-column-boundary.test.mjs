// SQL boundary proof only: no network, credentials, actual Auth or PostgREST.
// Uses PostgreSQL in PGlite with injected claims and the current captured RLS/RPC
// definitions. Geography is inert text; unrelated guard/classifier/event internals
// are explicit fixture substitutes. Do not use this as full application acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {snapshot} from './r01_fixture.mjs';
import {discoverySnapshot} from './r01_discovery_fixture.mjs';

const candidate = readFileSync(new URL('../../candidates/r01_needs_column_privileges.sql', import.meta.url), 'utf8');
// All columns outside the reviewed 38-column direct-read allowlist. Keep the
// internal category_id behind the same direct SQL/API access boundary; unlike
// the first three it is an internal identity, not a personal identifier.
const nonPublicColumns = ['requester_account_id', 'remaining_search_closed_by_account_id',
  'remaining_search_close_reason', 'category_id'];
// Independent historical public contract, not parsed from the candidate.
const publicColumns = `id requester_profile_id status title description category approximate_city approximate_area
 approximate_lat approximate_lng schedule_kind starts_at ends_at required_slots mode requester_price_rsd
 required_skills required_tools required_vehicles verified_identity_required urgent public_photo_paths revision
 published_at created_at updated_at response_deadline urgent_activated_at urgent_expires_at urgent_policy_version
 minimum_experience_years execution_location_mode approx_geog required_licenses remaining_search_closed_at
 task_country_code task_timezone price_basis`.split(/\s+/).filter(Boolean);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner=uuid(1), reader=uuid(2), participant=uuid(3), real=uuid(4), closed=uuid(5);
const published=uuid(101), selection=uuid(102), active=uuid(103), draft=uuid(104), realNeed=uuid(105);
const marker='SYNTHETIC_PRIVATE_R01_REASON';
const internalCategory=uuid(301);
const db = new PGlite({extensions:{pgcrypto}});
test.after(() => db.close());
const query = async (sql, args=[]) => (await db.query(sql,args)).rows;
const scalar = async (sql,args=[]) => Object.values((await query(sql,args))[0])[0];
const denied = promise => assert.rejects(promise, e => e.code === '42501');
async function as(role, actor, action) {
  assert(['anon','authenticated','service_role'].includes(role));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor ?? '']);
  await db.exec(`set role ${role}`);
  try { return await action(); } finally { await db.exec('reset role'); }
}
async function install() {
  await db.exec("set uskoci.r01.disposable = 'LOCAL_ONLY'");
  await db.exec(candidate);
}
async function immutableState() {
  return scalar(`select jsonb_build_object(
    'policies',(select jsonb_agg(to_jsonb(p) order by oid) from pg_policy p),
    'functions',(select jsonb_agg(jsonb_build_array(p.oid,md5(p.prosrc),p.prosecdef,p.proacl,p.proconfig)
      order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private','rls_private','auth')),
    'relation',(select jsonb_build_array(relowner,relrowsecurity,relforcerowsecurity) from pg_class where oid='public.needs'::regclass),
    'certificates',(select jsonb_agg(to_jsonb(c) order by kind) from private.fixture_certificates c),
    'other_acl',(select jsonb_agg(to_jsonb(x) order by x.column_number,x.grantee,x.privilege_type) from (
      select 0 column_number,a.* from pg_class c cross join lateral aclexplode(c.relacl) a where c.oid='public.needs'::regclass
      union all select attnum,a.* from pg_attribute c cross join lateral aclexplode(c.attacl) a where c.attrelid='public.needs'::regclass
    ) x where privilege_type<>'SELECT' or grantee not in(0,'anon'::regrole,'authenticated'::regrole)))`);
}
async function aclState() {
  return scalar(`select jsonb_build_object('table',relacl,'columns',
    (select jsonb_agg(jsonb_build_array(attname,attacl) order by attnum) from pg_attribute
     where attrelid=c.oid and attnum>0 and not attisdropped)) from pg_class c where oid='public.needs'::regclass`);
}

test('R01 current SQL boundary and compatibility controls', async t => {
  await t.test('fixture binds current function bodies before execution', async () => {
    assert.equal(publicColumns.length,38);
    assert.equal(new Set(publicColumns).size,38,'no duplicate public column can hide an exclusion');
    assert.equal(snapshot.columns.length,42);
    assert.equal(new Set(snapshot.columns.map(c=>c.name)).size,42);
    assert.deepEqual(snapshot.columns.map(c=>c.name)
      .filter(name=>!publicColumns.includes(name)).sort(),[...nonPublicColumns].sort(),
    'every current column excluded from the public projection must be denied in SQL');
    assert.equal(discoverySnapshot.prior_fixture_current_body_hashes.length,snapshot.functions.length);
    for(const f of snapshot.functions) assert.equal(
      discoverySnapshot.prior_fixture_current_body_hashes.find(current=>
        current.signature.replaceAll('public.','')===f.signature.replaceAll('public.',''))?.body_md5,
      f.body_md5,`2026-11-01 metadata must still bind ${f.signature}`);
    for(const f of [...snapshot.functions,...discoverySnapshot.functions]) {
      const body=f.definition.match(/AS \$function\$([\s\S]*)\$function\$/)?.[1];
      assert(body, f.signature);
      assert.equal(createHash('md5').update(body).digest('hex'),f.body_md5,f.signature);
    }
    assert(discoverySnapshot.functions.every(f=>f.definer===false),'Discovery runs with caller privileges');
    const policyShape=p=>({policyname:p.policyname,cmd:p.cmd,permissive:p.permissive,roles:p.roles,
      qual:p.qual?.replaceAll('public.','')??null,with_check:p.with_check?.replaceAll('public.','')??null});
    assert.deepEqual(discoverySnapshot.current_reader_policies.filter(p=>p.tablename==='needs').map(policyShape),
      snapshot.policies.map(policyShape),'the original Need policies must still match current metadata');
    assert.equal(await scalar('select current_user'),'postgres');
  });

  await t.test('build isolated roles, current policies and bounded synthetic data', async () => {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private; create schema rls_private; create schema extensions;
      create extension pgcrypto with schema extensions;
      -- PGlite has no ICU provider. Preserve the exact function bodies by giving
      -- their collation name an explicit C substitute. ASCII fixtures below do
      -- not establish Serbian case folding/sorting or hosted collation parity.
      create collation pg_catalog."sr-Latn-RS-x-icu" from pg_catalog."C";
      grant usage on schema public,auth to anon,authenticated,service_role;
      grant usage on schema rls_private to authenticated;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table private.fixture_accounts(id uuid primary key,world text,is_open boolean);
      insert into private.fixture_accounts values
        ('${owner}','TEST',true),('${reader}','TEST',true),('${participant}','TEST',true),('${real}','REAL',true),('${closed}','TEST',false);
      -- Substitutes model the guard/classifier contract only; their production
      -- dependencies, closure digest, trigger inventory and lifecycle are not proven.
      create function private.closure_assert_open(actor uuid) returns void language plpgsql as $$
        begin if not coalesce((select is_open from private.fixture_accounts where id=actor),false)
        then raise exception 'ACCOUNT_NOT_OPEN' using errcode='42501'; end if; end $$;
      create table private.account_lineage_v5(account_id uuid);
      insert into private.account_lineage_v5 select id from private.fixture_accounts;
      create function private.account_visibility_world(actor uuid) returns text language sql stable as
        $$select world from private.fixture_accounts where id=actor$$;
      create table private.fixture_certificates(kind text,sha256 text);
      insert into private.fixture_certificates values('source','PREEXISTING_STALE'),('erasure','PREEXISTING_STALE');
      create table public.agreements(id uuid default gen_random_uuid(),need_id uuid,worker_account_id uuid,status text);
      create table public.need_selections(need_id uuid,worker_account_id uuid,status text,covered_slots integer);
      create table public.marketplace_responses(id uuid default gen_random_uuid(),need_id uuid,worker_account_id uuid,status text);
      create table public.need_geography(need_id uuid,public_topology jsonb);
      create table public.need_requirement_details(need_id uuid,critical_conditions text[]);
      create table public.dispatch_rounds(need_id uuid,status text,stop_reason text);
      create table public.opportunity_deliveries(need_id uuid,status text);
      create table private.dispatch_schedule(need_id uuid);
      create table private.remaining_search_close_commands(requester_account_id uuid,client_request_id text,
        request_hash text,need_id uuid,need_revision integer,result jsonb,
        primary key(requester_account_id,client_request_id));
      create table private.fixture_candidates(need_id uuid,candidate_state text);
      create function private.need_candidate_states_v5(nid uuid) returns table(candidate_state text)
        language sql stable as $$select candidate_state from private.fixture_candidates where need_id=nid$$;
      create function private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,uuid)
        returns void language sql as $$select$$;
      create function private.audit_marketplace(uuid,text,text,uuid,integer,jsonb)
        returns void language sql as $$select$$;
    `);
    const ddl = snapshot.columns.map(c=>{
      const type=c.name==='approx_geog'?'text':c.type;
      const fallback = type==='uuid'?'gen_random_uuid()':type==='text'?"''":type==='text[]'?"'{}'::text[]":
        type==='boolean'?'false':type==='integer'?'1':type.includes('timestamp')?'statement_timestamp()':'null';
      return `${c.name} ${type}${c.not_null?` not null default ${fallback}`:''}`;
    }).join(',');
    await db.exec(`create table public.needs(${ddl},primary key(id)); alter table public.needs enable row level security;`);
    // Function install order is allowed by PL/pgSQL's deferred statement planning.
    for(const f of snapshot.functions) await db.exec(f.definition);
    for(const f of discoverySnapshot.functions) await db.exec(f.definition);
    await db.exec(`revoke all on all functions in schema public,private,rls_private from public,anon,authenticated;
      grant execute on all functions in schema public to authenticated,service_role;
      grant execute on all functions in schema rls_private to authenticated;
      grant select on public.marketplace_responses,public.need_geography,public.need_requirement_details to authenticated;
      grant select,insert,update,truncate,references,trigger on public.needs to authenticated;
      grant truncate,references,trigger on public.needs to anon;
      grant all on public.needs to service_role;
      grant select (${publicColumns.join(',')}) on public.needs to authenticated;`);
    for(const p of snapshot.policies) {
      await db.exec(`create policy ${p.policyname} on public.needs as ${p.permissive} for ${p.cmd}
        to ${p.roles.join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''}`);
    }
    for(const table of ['need_geography','need_requirement_details']) {
      await db.exec(`alter table public.${table} enable row level security`);
      for(const p of discoverySnapshot.current_reader_policies.filter(p=>p.tablename===table))
        await db.exec(`create policy ${p.policyname} on public.${table} as ${p.permissive} for ${p.cmd}
          to ${p.roles.join(',')}${p.qual?` using (${p.qual})`:''}${p.with_check?` with check (${p.with_check})`:''}`);
    }
    for(const [id,status,who] of [[published,'PUBLISHED',owner],[selection,'SELECTION',owner],[active,'ACTIVE',owner],[draft,'DRAFT',owner],[realNeed,'PUBLISHED',real]]) {
      await db.query(`insert into public.needs(id,requester_account_id,status,title,description,category,
        schedule_kind,mode,required_slots,execution_location_mode,task_country_code,task_timezone,
        published_at,remaining_search_closed_at,remaining_search_closed_by_account_id,remaining_search_close_reason)
        values($1,$2,$3,'Synthetic task','Public description','Cleaning','FLEXIBLE','OFFERS',3,'REMOTE','RS','Europe/Belgrade',
        statement_timestamp()-interval '1 day',case when $3='SELECTION' then statement_timestamp() end,
        case when $3='SELECTION' then $2::uuid end,case when $3='SELECTION' then $4 end)`,[id,who,status,marker]);
    }
    // An explicit internal ID makes the baseline and the later denial
    // meaningful; null values alone cannot demonstrate the exposure.
    await db.query('update public.needs set category_id=$1 where id=$2',[internalCategory,selection]);
    await db.exec(`insert into public.agreements(need_id,worker_account_id,status) values('${active}','${participant}','CONFIRMED');
      insert into public.need_selections values('${active}','${participant}','SELECTED',1);
      insert into private.fixture_candidates values('${published}','SELECTABLE');`);
  });

  await t.test('baseline reproduces foreign private data access with a successful public control', async () => {
    const rows=await as('authenticated',reader,()=>query(`select id,requester_account_id,category_id,
      remaining_search_closed_by_account_id,remaining_search_close_reason from public.needs where id=$1`,[selection]));
    assert.deepEqual(rows,[{id:selection,requester_account_id:owner,category_id:internalCategory,
      remaining_search_closed_by_account_id:owner,remaining_search_close_reason:marker}]);
    assert.deepEqual(await as('authenticated',reader,()=>query('select id from public.needs where id=$1',[published])),[{id:published}]);
  });

  await t.test('candidate requires explicit disposable context and preserves state on refusal', async () => {
    const before=await aclState();
    await assert.rejects(db.exec(candidate), e=>e.message==='R01_DISPOSABLE_TARGET_REQUIRED');
    assert.deepEqual(await aclState(),before);
  });

  await t.test('atomic patch and repeat application preserve all unrelated authority', async () => {
    const before=await immutableState();
    const priorAcl=await aclState();
    await install();
    assert.deepEqual(await immutableState(),before);
    assert.notDeepEqual(await aclState(),priorAcl);
    const after=await aclState();
    await install();
    assert.deepEqual(await aclState(),after);
    assert.deepEqual(await immutableState(),before);
    const columns=await query(`select attname,has_column_privilege('authenticated',attrelid,attnum,'SELECT') allowed,
      has_column_privilege('anon',attrelid,attnum,'SELECT') anon from pg_attribute
      where attrelid='public.needs'::regclass and attnum>0 and not attisdropped`);
    assert.deepEqual(columns.filter(c=>c.allowed).map(c=>c.attname).sort(),[...publicColumns].sort());
    assert(columns.every(c=>!c.anon));
  });

  await t.test('private projections, aliases, predicates, ordering and whole rows fail with 42501', async () => {
    for(const actor of [owner,reader,participant]) {
      await as('authenticated',actor,async()=>{
        for(const col of nonPublicColumns) for(const sql of [
          `select ${col} from public.needs`, `select ${col} as public_title from public.needs`,
          `select id from public.needs where ${col} is not null`, `select id from public.needs order by ${col}`,
          `select count(*) from public.needs group by ${col}`
        ]) await denied(query(sql));
        for(const sql of ['select * from public.needs','select n from public.needs n',
          'select to_jsonb(n) from public.needs n','select public.covered_slots(n) from public.needs n',
          'select public.selectable_application_count(n) from public.needs n']) await denied(query(sql));
      });
    }
  });

  await t.test('all permitted columns and direct remaining-search reader still succeed', async () => {
    const rows=await as('authenticated',reader,()=>query(`select ${publicColumns.join(',')} from public.needs where id=$1`,[published]));
    assert.equal(rows.length,1);
    assert.equal(Object.keys(rows[0]).length,38);
    const state=await as('authenticated',reader,()=>query('select remaining_search_closed_at from public.needs where id=$1',[selection]));
    assert(state[0].remaining_search_closed_at);
    assert.equal(await as('service_role',null,()=>scalar('select remaining_search_close_reason from public.needs where id=$1',[selection])),marker);
  });

  await t.test('current RLS keeps owners, participants, worlds, closed and anonymous callers separated', async () => {
    const ids=actor=>as('authenticated',actor,async()=>(await query('select id from public.needs order by id')).map(x=>x.id));
    assert.deepEqual(await ids(owner),[published,selection,active,draft]);
    assert.deepEqual(await ids(reader),[published,selection]);
    assert.deepEqual(await ids(participant),[published,selection,active]);
    assert.deepEqual(await ids(real),[realNeed]);
    await denied(ids(closed));
    await denied(as('anon',null,()=>query('select id from public.needs')));
    await db.exec(`update public.agreements set status='CANCELLED'; update public.need_selections set status='CANCELLED';`);
    assert.deepEqual(await ids(participant),[published,selection]);
    await db.exec(`update public.agreements set status='COMPLETED';`);
    assert.deepEqual(await ids(participant),[published,selection,active]);
    await db.exec(`update public.agreements set status='CONFIRMED'; update public.need_selections set status='SELECTED';`);
  });

  await t.test('current detail and owner RPCs preserve public documents and caller scoping', async () => {
    const read=actor=>as('authenticated',actor,()=>scalar('select public.rpc_read_task($1)',[published]));
    const foreign=await read(reader), owned=await read(owner);
    assert.equal(foreign.id,published);
    assert.equal(owned.selectable_application_count,1);
    assert.equal(foreign.selectable_application_count,null);
    for(const value of [foreign,owned]) for(const col of nonPublicColumns) assert.equal(Object.hasOwn(value,col),false);
    const list=await as('authenticated',owner,()=>scalar('select public.rpc_list_my_tasks()'));
    assert.deepEqual(list.map(x=>x.id).sort(),[published,selection,active,draft].sort());
    for(const item of list) for(const col of nonPublicColumns) assert.equal(Object.hasOwn(item,col),false);
    assert(!JSON.stringify(list).includes(marker));
    assert.deepEqual(await as('authenticated',reader,()=>scalar('select public.rpc_list_my_tasks()')),[]);
    const page=await as('authenticated',owner,()=>scalar("select public.rpc_list_my_needs_page('ALL',30,null,null)"));
    assert.deepEqual(page.items.map(x=>x.id).sort(),[published,selection,active,draft].sort());
    for(const item of page.items) for(const col of nonPublicColumns) assert.equal(Object.hasOwn(item,col),false);
    assert(!JSON.stringify(page).includes(marker));
    // Existing R03 wire mismatch is deliberately not reclassified as fixed.
    assert.equal(Object.hasOwn(page,'counts'),false);
    await denied(as('authenticated',closed,()=>scalar('select public.rpc_list_my_tasks()')));
    const forged=await as('authenticated',reader,()=>scalar(`select public.selectable_application_count(
      jsonb_populate_record(null::public.needs,jsonb_build_object('id',$1::uuid,'requester_account_id',$2::uuid)))`,[published,reader]));
    assert.equal(forged,null);
    assert.equal(await as('authenticated',reader,()=>scalar(`select public.covered_slots(
      jsonb_populate_record(null::public.needs,jsonb_build_object('id',$1::uuid)))`,[active])),1);
  });

  await t.test('current Discovery preserves positive owned/foreign pages, exact landing and scope after the column patch', async () => {
    const second=uuid(106), onsite=uuid(107);
    const request={mode:'PAGE',filter:{text:'',price:'all',where:'any',places:1,when:'any',dates:null,place:null},
      anchor:null,scope:{kind:'ALL'},limit:30,after:null};
    const discover=(actor,body=request)=>as('authenticated',actor,
      ()=>scalar('select public.rpc_discovery_v1($1::jsonb)',[JSON.stringify(body)]));
    const exact=(actor,id)=>discover(actor,{mode:'EXACT_PUBLIC',needId:id});
    const ids=result=>result.items.map(item=>item.id);
    const publicOnly=result=>{
      const forbidden=new Set([...nonPublicColumns,'requesterAccountId','remainingSearchClosedByAccountId',
        'remainingSearchCloseReason','categoryId']);
      const visit=value=>{ if(value && typeof value==='object') for(const [key,child] of Object.entries(value)) {
        assert(!forbidden.has(key),`private field ${key}`); visit(child);
      }};
      visit(result);
      assert(!JSON.stringify(result).includes(marker));
      assert(!JSON.stringify(result).includes(internalCategory));
    };
    // Two nonempty actors and both work modes avoid an empty-RLS success. Private
    // markers remain populated while only the reviewed public contract is read.
    await db.query(`insert into public.needs(id,requester_account_id,status,title,category,category_id,
      schedule_kind,mode,required_slots,execution_location_mode,task_country_code,task_timezone,
      approximate_city,approximate_lat,approximate_lng,published_at)
      values($1,$2,'PUBLISHED','Remote second','Cleaning',$5,'FLEXIBLE','OFFERS',3,'REMOTE','RS','Europe/Belgrade',
        '',null,null,statement_timestamp()-interval '12 hours'),
      ($3,$4,'SELECTION','Onsite third','Cleaning',$5,'FLEXIBLE','OFFERS',3,'ON_SITE','RS','Europe/Belgrade',
        'Belgrade',44.81,20.46,statement_timestamp()-interval '6 hours')`,[second,reader,onsite,owner,internalCategory]);
    try {
      await db.query('insert into public.need_geography values($1,$2::jsonb)',
        [onsite,JSON.stringify({kind:'POINT',precision:'COARSE_1KM',lat:44.81,lng:20.46})]);
      await db.query('insert into public.need_requirement_details values($1,$2::text[])',[onsite,['Bring tools']]);
      for(const actor of [owner,reader,participant]) {
        const page=await discover(actor);
        assert.deepEqual(ids(page),[onsite,second,published]);
        assert.equal(page.counts.listed,3);
        assert.equal(page.hasMore,false);
        publicOnly(page);
        for(const id of [onsite,second,published]) {
          const landing=await exact(actor,id);
          assert.deepEqual(ids(landing),[id]);
          assert.equal(landing.items[0].coveredSlots,0);
          assert.equal(landing.items[0].acceptsApplications,true);
          if(id===onsite) {
            assert.deepEqual(landing.items[0].publicTopology,{kind:'POINT',precision:'COARSE_1KM',lat:44.81,lng:20.46});
            assert.deepEqual(landing.items[0].criticalConditions,['Bring tools']);
          }
          publicOnly(landing);
        }
      }
      // The same actors still receive only their own private workspace lists.
      const own=await as('authenticated',reader,()=>scalar('select public.rpc_list_my_tasks()'));
      const ownPage=await as('authenticated',reader,()=>scalar("select public.rpc_list_my_needs_page('ALL',30,null,null)"));
      assert.deepEqual(own.map(item=>item.id),[second]);
      assert.deepEqual(ids(ownPage),[second]);
      publicOnly(own); publicOnly(ownPage);
      const remote=await discover(reader,{...request,filter:{...request.filter,where:'remote'}});
      assert.deepEqual(ids(remote),[second,published]); publicOnly(remote);
      const area=await discover(reader,{...request,scope:{kind:'AREA',bounds:[20,44,21,45]}});
      assert.deepEqual(ids(area),[onsite,second,published]);
      assert.equal(area.counts.inArea,1); assert.equal(area.counts.withoutPoint,2); publicOnly(area);

      let page=await discover(reader,{...request,limit:1});
      const seen=[];
      for(let i=0;i<3;i++) {
        seen.push(...ids(page)); publicOnly(page);
        assert.equal(page.hasMore,i<2);
        if(i<2) {
          assert(page.nextCursor);
          page=await discover(reader,{...request,limit:1,anchor:page.anchor,after:page.nextCursor});
        } else assert.equal(page.nextCursor,null);
      }
      assert.deepEqual(seen,[onsite,second,published],'column restriction must not break or skip cursor pages');
      assert.deepEqual(ids(await discover(real)),[realNeed]);
      for(const id of [realNeed,selection,active,draft]) assert.deepEqual(ids(await exact(reader,id)),[]);
      assert.deepEqual(ids(await exact(real,published)),[]);
      await denied(discover(closed));
      await denied(as('anon',null,()=>scalar('select public.rpc_discovery_v1($1::jsonb)',[JSON.stringify(request)])));
      await assert.rejects(discover(null),e=>e.code==='28000');
      for(const column of nonPublicColumns) await denied(as('authenticated',reader,
        ()=>query(`select ${column} from public.needs where id=$1`,[onsite])));
    } finally {
      await db.query('delete from public.need_geography where need_id=$1',[onsite]);
      await db.query('delete from public.need_requirement_details where need_id=$1',[onsite]);
      await db.query('delete from public.needs where id=any($1::uuid[])',[[second,onsite]]);
    }
  });

  await t.test('a whole-row Discovery regression fails instead of bypassing the candidate boundary', async () => {
    const captured=discoverySnapshot.functions.find(f=>f.signature==='public.rpc_discovery_v1(jsonb)');
    const safe="public.covered_slots(jsonb_populate_record(null::public.needs,jsonb_build_object('id',n.id)))";
    assert.equal(captured.definition.split(safe).length,2,'adversary targets one actual call site');
    try {
      await db.exec(captured.definition.replace(safe,'public.covered_slots(n)'));
      await denied(as('authenticated',reader,()=>scalar('select public.rpc_discovery_v1($1::jsonb)',
        [JSON.stringify({mode:'EXACT_PUBLIC',needId:published})])));
    } finally {
      await db.exec(captured.definition);
    }
    assert.equal(await scalar("select md5(prosrc) from pg_proc where oid='public.rpc_discovery_v1(jsonb)'::regprocedure"),captured.body_md5);
    assert.equal((await as('authenticated',reader,()=>scalar('select public.rpc_discovery_v1($1::jsonb)',
      [JSON.stringify({mode:'EXACT_PUBLIC',needId:published})]))).items[0].id,published);
  });

  await t.test('owner close-search writer still stores private actor/reason and rejects foreign caller', async () => {
    await denied(as('authenticated',reader,()=>scalar('select public.rpc_close_remaining_search($1,1,$2,$3)',[active,'r01-foreign-attempt',marker])));
    const receipt=await as('authenticated',owner,()=>scalar('select public.rpc_close_remaining_search($1,1,$2,$3)',[active,'r01-owner-close',marker]));
    assert.equal(receipt.remainingSearchClosed,true);
    assert.equal(receipt.status,'ACTIVE');
    assert(!JSON.stringify(receipt).includes(marker));
    assert.deepEqual(await query('select remaining_search_closed_by_account_id,remaining_search_close_reason from public.needs where id=$1',[active]),
      [{remaining_search_closed_by_account_id:owner,remaining_search_close_reason:marker}]);
    const replay=await as('authenticated',owner,()=>scalar('select public.rpc_close_remaining_search($1,1,$2,$3)',[active,'r01-owner-close',marker]));
    assert.equal(replay.idempotentReplay,true);
    await denied(as('authenticated',owner,()=>query('select remaining_search_close_reason from public.needs where id=$1',[active])));
  });

  await t.test('draft INSERT/UPDATE privileges and RLS remain usable without private RETURNING', async () => {
    const id=uuid(201);
    await as('authenticated',owner,()=>query(`insert into public.needs(id,requester_account_id,status) values($1,$2,'DRAFT')`,[id,owner]));
    assert.deepEqual(await as('authenticated',owner,()=>query("update public.needs set title='Changed' where id=$1 returning id,title",[id])),[{id,title:'Changed'}]);
    assert.deepEqual(await as('authenticated',reader,()=>query("update public.needs set title='Foreign' where id=$1 returning id",[id])),[]);
    for(const col of nonPublicColumns) await denied(as('authenticated',owner,
      ()=>query(`update public.needs set title='Private returning' where id=$1 returning ${col}`,[id])));
  });

  await t.test('future columns default to unreadable; stray PUBLIC/anon grants are removed', async () => {
    await db.exec('alter table public.needs add column future_private_note text');
    await denied(as('authenticated',reader,()=>query('select future_private_note from public.needs')));
    await db.exec('grant select(remaining_search_close_reason) on public.needs to public; grant select(id) on public.needs to anon');
    await install();
    await denied(as('authenticated',reader,()=>query('select remaining_search_close_reason from public.needs')));
    await denied(as('anon',null,()=>query('select id from public.needs')));
    await denied(as('authenticated',reader,()=>query('select future_private_note from public.needs')));
  });

  await t.test('inherited grants fail the postcondition and roll back the entire candidate', async () => {
    await db.exec('create role r01_parent; grant r01_parent to authenticated; grant select on public.needs to r01_parent');
    const before=await aclState();
    await assert.rejects(db.exec(candidate),e=>e.message==='R01_EFFECTIVE_COLUMN_BOUNDARY_FAILED');
    assert.deepEqual(await aclState(),before);
    await db.exec('revoke r01_parent from authenticated; revoke select on public.needs from r01_parent; drop role r01_parent');
    await install();
  });
});
