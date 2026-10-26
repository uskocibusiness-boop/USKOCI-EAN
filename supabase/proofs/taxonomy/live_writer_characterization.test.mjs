// F0 characterization only: passing assertions reproduce existing risks, not a fix.
// No network and no application/schema deployment.
// Exact DEV prosrc captured via SELECT pg_proc on 2026-10-26 23:34-23:35 UTC.
// Minimal PGlite fixture: NOT full DEV RLS, Save, binder, dispatch or auth proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const bodies = {
  "needs_sync_taxonomy_category_trigger_fn": {
    "md5": "3244c0fd784d722ece2e3ace8688bfe7",
    "source": "\nDECLARE\n  v_leaf text;\nBEGIN\n  IF NEW.category IS NOT NULL AND btrim(NEW.category) <> '' THEN\n    SELECT id INTO NEW.category_id\n    FROM private.work_taxonomy_categories\n    WHERE canonical_key = private.taxonomy_normalize_v1(NEW.category)\n      AND state <> 'RETIRED'\n    ORDER BY (parent_id IS NOT NULL) DESC, created_at ASC\n    LIMIT 1;\n\n    IF NEW.category_id IS NULL AND NEW.category LIKE '%/%' THEN\n      v_leaf := btrim(reverse(split_part(reverse(NEW.category), '/', 1)));\n      SELECT id INTO NEW.category_id\n      FROM private.work_taxonomy_categories\n      WHERE canonical_key = private.taxonomy_normalize_v1(v_leaf)\n        AND state <> 'RETIRED'\n      ORDER BY (parent_id IS NOT NULL) DESC, created_at ASC\n      LIMIT 1;\n    END IF;\n  END IF;\n  RETURN NEW;\nEND;\n"
  },
  "sync_worker_skills_to_taxonomy_capabilities": {
    "md5": "8bfb57431cd6a6fcff2e1e80fe8b5fbc",
    "source": "\nDECLARE\n v_saved_skills text[];\n v_skill text;v_norm text;v_cat_id uuid;v_match_count integer;\n v_retained_ids uuid[]:=ARRAY[]::uuid[];\n v_unmapped_labels text[]:=ARRAY[]::text[];\n v_revoked integer:=0;v_revoked_acceptances integer:=0;\nBEGIN\n IF private.closure_taxonomy_profile_erasing_v1(p_account_id) THEN\n RETURN jsonb_build_object('success',true,'workerAccountId',p_account_id,'assignedCount',0,'assignedCategoryIds','[]'::jsonb,\n 'retainedExistingCategoryCount',0,'retainedExistingCategoryIds','[]'::jsonb,'revokedCount',0,'revokedRelatedAcceptances',0,\n 'unmappedSkillLabels','[]'::jsonb,'openNeedsRequeued',0,'newCapabilityAuthority','NONE','notificationAuthority','NONE');END IF;\n PERFORM private.closure_assert_open(p_account_id);\n IF p_account_id IS NULL THEN\n   RAISE EXCEPTION 'WORKER_ACCOUNT_REQUIRED' USING errcode='22023';\n END IF;\n SELECT COALESCE(p.skills,ARRAY[]::text[]) INTO v_saved_skills\n FROM public.app_profiles p\n WHERE p.account_id=p_account_id AND p.kind='WORKER'\n FOR UPDATE;\n IF NOT FOUND THEN RAISE EXCEPTION 'WORKER_PROFILE_REQUIRED' USING errcode='55000'; END IF;\n IF v_saved_skills IS DISTINCT FROM COALESCE(p_skills,ARRAY[]::text[]) THEN\n   RAISE EXCEPTION 'TAXONOMY_PROFILE_SKILLS_MISMATCH' USING errcode='22023';\n END IF;\n -- A canonical/registered-alias match is used ONLY to decide which already\n -- confirmed capability is still mentioned by the worker. This is not consent.\n -- No invented ON_SITE mode, no nearest-parent inference and no new records.\n FOREACH v_skill IN ARRAY v_saved_skills LOOP\n   v_skill:=btrim(COALESCE(v_skill,''));\n   IF char_length(v_skill) NOT BETWEEN 3 AND 120 THEN\n     v_unmapped_labels:=array_append(v_unmapped_labels,v_skill);\n     CONTINUE;\n   END IF;\n   v_norm:=private.taxonomy_normalize_v1(v_skill);\n   SELECT count(DISTINCT c.id),min(c.id::text)::uuid\n      INTO v_match_count,v_cat_id\n   FROM private.work_taxonomy_categories c\n   WHERE c.state='ESTABLISHED'\n     AND EXISTS(SELECT 1 FROM private.work_taxonomy_category_modes m\n       WHERE m.category_id=c.id)\n     AND (c.canonical_key=v_norm OR EXISTS(\n       SELECT 1 FROM private.work_taxonomy_aliases a\n       WHERE a.category_id=c.id AND a.normalized_key=v_norm));\n   IF v_match_count<>1 OR v_cat_id IS NULL THEN\n     v_unmapped_labels:=array_append(v_unmapped_labels,v_skill);\n     CONTINUE;\n   END IF;\n   IF NOT v_cat_id=ANY(v_retained_ids) THEN\n     v_retained_ids:=array_append(v_retained_ids,v_cat_id);\n   END IF;\n END LOOP;\n -- Explicitly removed or now-ambiguous worker services lose existing legacy\n -- eligibility and related opt-ins. Retained rows are NOT refreshed/revived.\n UPDATE private.work_taxonomy_worker_capabilities w\n SET excluded=true,allow_related_offers=false,updated_at=statement_timestamp()\n WHERE w.worker_account_id=p_account_id\n   AND NOT (w.category_id=ANY(v_retained_ids))\n   AND (NOT w.excluded OR w.allow_related_offers);\n GET DIAGNOSTICS v_revoked=ROW_COUNT;\n DELETE FROM private.work_taxonomy_related_acceptances a\n WHERE a.worker_account_id=p_account_id\n   AND NOT (a.source_category_id=ANY(v_retained_ids));\n GET DIAGNOSTICS v_revoked_acceptances=ROW_COUNT;\n -- Deliberately NO requeue: Save is not a taxonomy binder receipt. A signed\n -- reconciler may later schedule matching only after both sides are bound.\n RETURN jsonb_build_object(\n   'success',true,'workerAccountId',p_account_id,\n   'assignedCount',0,'assignedCategoryIds','[]'::jsonb,\n   'retainedExistingCategoryCount',cardinality(v_retained_ids),\n   'retainedExistingCategoryIds',to_jsonb(v_retained_ids),\n   'revokedCount',v_revoked,\n   'revokedRelatedAcceptances',v_revoked_acceptances,\n   'unmappedSkillLabels',to_jsonb(v_unmapped_labels),\n   'openNeedsRequeued',0,\n   'newCapabilityAuthority','NONE',\n   'notificationAuthority','NONE'\n );\nEND "
  },
  "worker_profile_sync_taxonomy_capabilities_trg_fn": {
    "md5": "f24e6379c27ea76f477a93577e70d0cd",
    "source": "\nBEGIN\n  IF NEW.kind <> 'WORKER' THEN RETURN NEW; END IF;\n  IF TG_OP = 'UPDATE' AND NEW.skills IS NOT DISTINCT FROM OLD.skills THEN\n    RETURN NEW;\n  END IF;\n  -- No nonempty check: a zero-skill profile must revoke all active categories.\n  PERFORM private.sync_worker_skills_to_taxonomy_capabilities(\n    NEW.account_id, COALESCE(NEW.skills, ARRAY[]::text[])\n  );\n  RETURN NEW;\nEND "
  },
  "taxonomy_normalize_v1": {
    "md5": "8c360cb0a05699cdae25485a5efc77ba",
    "source": "\n SELECT btrim(regexp_replace(\n   translate(\n     replace(replace(replace(replace(replace(replace(lower(btrim(coalesce(p_value,''))),\n       'ђ','dj'),'љ','lj'),'њ','nj'),'џ','dz'),'đ','dj'),'ß','ss'),\n     'абвгдежзијклмнопрстћуфхцчшčćšž',\n     'abvgdezzijklmnoprstcufhccsccsz'\n   ),\n   '[[:space:]]+', ' ', 'g'\n ))\n"
  }
};
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const W='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const db=new PGlite();
test.after(async()=>{await db.close();});
const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0];

test('F0 S11/S12: exact live bodies and bounded synthetic cases',async t=>{
 for(const {md5,source} of Object.values(bodies))
   assert.equal(createHash('md5').update(source).digest('hex'),md5);
 await db.exec(`
 create schema private;
 create table private.work_taxonomy_categories(id uuid primary key,canonical_key text unique,label text,state text check(state in('AUTO_PROVISIONAL','ESTABLISHED','RETIRED')),parent_id uuid,created_at timestamptz default now());
 create table private.work_taxonomy_aliases(category_id uuid references private.work_taxonomy_categories,normalized_key text);
 create table private.work_taxonomy_category_modes(category_id uuid references private.work_taxonomy_categories,execution_scope text);
 create table public.needs(id integer primary key,category text not null check(char_length(btrim(category)) between 1 and 120),category_id uuid references private.work_taxonomy_categories);
 create table public.app_profiles(account_id uuid primary key,kind text,skills text[]);
 create table private.work_taxonomy_worker_capabilities(worker_account_id uuid,category_id uuid,excluded boolean,allow_related_offers boolean,updated_at timestamptz,primary key(worker_account_id,category_id));
 create table private.work_taxonomy_related_acceptances(worker_account_id uuid,source_category_id uuid);
 create table private.taxonomy_confirmed_worker_modes_v1(worker_account_id uuid,category_id uuid,active boolean);
 -- Stubs only for unrelated account-erasure guards: no ownership/security conclusion.
 create function private.closure_taxonomy_profile_erasing_v1(uuid) returns boolean language sql as 'select false';
 create function private.closure_assert_open(uuid) returns void language sql as 'select';
 `);
 await db.exec('create function private.taxonomy_normalize_v1(p_value text) returns text language sql immutable as $audit$'+bodies.taxonomy_normalize_v1.source+'$audit$;');
 await db.exec('create function private.needs_sync_taxonomy_category_trigger_fn() returns trigger language plpgsql security definer set search_path=pg_catalog,private as $audit$'+bodies.needs_sync_taxonomy_category_trigger_fn.source+'$audit$;');
 await db.exec('create function private.sync_worker_skills_to_taxonomy_capabilities(p_account_id uuid,p_skills text[]) returns jsonb language plpgsql security definer set search_path=pg_catalog,private as $audit$'+bodies.sync_worker_skills_to_taxonomy_capabilities.source+'$audit$;');
 await db.exec('create function private.worker_profile_sync_taxonomy_capabilities_trg_fn() returns trigger language plpgsql security definer set search_path=pg_catalog,private as $audit$'+bodies.worker_profile_sync_taxonomy_capabilities_trg_fn.source+'$audit$;');
 await db.exec(`
 create trigger needs_sync_taxonomy_category_trg before insert or update of category on public.needs for each row execute function private.needs_sync_taxonomy_category_trigger_fn();
 create trigger worker_profile_sync_taxonomy_capabilities_trg after insert or update of skills on public.app_profiles for each row when (new.kind='WORKER') execute function private.worker_profile_sync_taxonomy_capabilities_trg_fn();
 insert into private.work_taxonomy_categories values
 ('${A}','krecenje zidova','Krečenje zidova','ESTABLISHED',null,now()),
 ('${B}','pranje prozora','Pranje prozora','ESTABLISHED',null,now()),
 ('33333333-3333-4333-8333-333333333333','popravka vrata','Popravka vrata','AUTO_PROVISIONAL',null,now());
 insert into private.work_taxonomy_aliases values ('${A}','bojenje zidova');
 insert into private.work_taxonomy_category_modes values ('${A}','ON_SITE'),('${B}','ON_SITE');
 `);
 await t.test('S11 direct INSERT with category and ID overwrites supplied ID by text',async()=>{
  assert.equal((await one('insert into public.needs values(1,$1,$2) returning category_id',['Krečenje zidova',B])).category_id,A);
 });
 await t.test('S11 ID-only binder-shaped UPDATE does not run text trigger',async()=>{
  assert.equal((await one('update public.needs set category_id=$1 where id=1 returning category_id',[B])).category_id,B);
 });
 await t.test('S11 same UPDATE naming category and category_id lets text override requested ID',async()=>{
  assert.equal((await one('update public.needs set category=category,category_id=$1 where id=1 returning category_id',[B])).category_id,A);
 });
 await t.test('S11 registered alias is ignored and erases an existing ID',async()=>{
  assert.equal((await one('update public.needs set category=$1 where id=1 returning category_id',['Bojenje zidova'])).category_id,null);
 });
 await t.test('S11 mentioning unchanged alias column erases later ID-only binding again',async()=>{
  await db.query('update public.needs set category_id=$1 where id=1',[A]);
  assert.equal((await one('update public.needs set category=category where id=1 returning category_id')).category_id,null);
 });
 await t.test('S11 blank label is blocked by existing table CHECK despite trigger no-op',async()=>{
  await db.query('update public.needs set category_id=$1 where id=1',[A]);
  await assert.rejects(db.query('update public.needs set category=$1 where id=1',['']),{code:'23514'});
  assert.equal((await one('select category_id from public.needs where id=1')).category_id,A);
 });
 await t.test('S11 slash leaf fallback ignores parent path meaning',async()=>{
  assert.equal((await one('update public.needs set category=$1 where id=1 returning category_id',['Nepovezana grana / Krečenje zidova'])).category_id,A);
 });
 await t.test('S11 non-retired provisional category is projected without ESTABLISHED gate',async()=>{
  assert.equal((await one('update public.needs set category=$1 where id=1 returning category_id',['Popravka vrata'])).category_id,'33333333-3333-4333-8333-333333333333');
 });
 await t.test('existing FK still rejects unknown category ID',async()=>{
  await assert.rejects(db.query('update public.needs set category_id=$1 where id=1',['99999999-9999-4999-8999-999999999999']),{code:'23503'});
 });
 await db.query('insert into public.app_profiles values($1,$2,$3)',[W,'WORKER',['Krečenje zidova']]);
 await db.query('insert into private.work_taxonomy_worker_capabilities values($1,$2,false,true,now())',[W,A]);
 await db.query('insert into private.work_taxonomy_related_acceptances values($1,$2)',[W,A]);
 await db.query('insert into private.taxonomy_confirmed_worker_modes_v1 values($1,$2,true)',[W,A]);
 await t.test('S12 adding unknown service keeps unchanged known capability and creates none',async()=>{
  await db.query('update public.app_profiles set skills=$1 where account_id=$2',[['Krečenje zidova','Nova nepoznata usluga'],W]);
  assert.equal((await one('select excluded from private.work_taxonomy_worker_capabilities')).excluded,false);
  assert.equal((await one('select count(*)::int as n from private.work_taxonomy_worker_capabilities')).n,1);
 });
 await t.test('S12 registered alias rename retains same category capability',async()=>{
  await db.query('update public.app_profiles set skills=$1 where account_id=$2',[['Bojenje zidova'],W]);
  assert.equal((await one('select excluded from private.work_taxonomy_worker_capabilities')).excluded,false);
 });
 await t.test('S12 unregistered synonymous display rename revokes same synthetic capability',async()=>{
  await db.query('update public.app_profiles set skills=$1 where account_id=$2',[['Farbanje zidova'],W]);
  assert.deepEqual(await one('select excluded,allow_related_offers from private.work_taxonomy_worker_capabilities'),{excluded:true,allow_related_offers:false});
  assert.equal((await one('select count(*)::int as n from private.work_taxonomy_related_acceptances')).n,0);
  // Sync does not update signed mode history; excluded capability blocks eligibility elsewhere.
  assert.equal((await one('select active from private.taxonomy_confirmed_worker_modes_v1')).active,true);
 });
 await t.test('S12 text re-add cannot revive previously excluded authority',async()=>{
  await db.query('update public.app_profiles set skills=$1 where account_id=$2',[['Krečenje zidova'],W]);
  assert.equal((await one('select excluded from private.work_taxonomy_worker_capabilities')).excluded,true);
 });
 await t.test('S12 explicit empty skills revokes active capability without deleting history',async()=>{
  await db.query('update private.work_taxonomy_worker_capabilities set excluded=false,allow_related_offers=true where worker_account_id=$1',[W]);
  await db.query('update public.app_profiles set skills=$1 where account_id=$2',[[],W]);
  assert.equal((await one('select excluded from private.work_taxonomy_worker_capabilities')).excluded,true);
  assert.equal((await one('select count(*)::int as n from private.work_taxonomy_worker_capabilities')).n,1);
 });
 await t.test('S12 supplied stale list is rejected against current locked profile',async()=>{
  await assert.rejects(db.query('select private.sync_worker_skills_to_taxonomy_capabilities($1,$2)',[W,['Krečenje zidova']]),{code:'22023'});
 });
 // This is the live batch's identity SELECT only, not a full signed batch call.
 // It demonstrates the name/registered-alias gate; no claim about bypassing it.
 const identity = async service => one(`select count(distinct c.id)::int as count,min(c.id::text)::uuid as id
   from private.work_taxonomy_categories c
   where c.state<>'RETIRED' and (c.canonical_key=private.taxonomy_normalize_v1($1) or exists (
     select 1 from private.work_taxonomy_aliases a where a.category_id=c.id
       and a.normalized_key=private.taxonomy_normalize_v1($1)))`,[service]);
 await t.test('S08 isolated live identity predicate accepts a registered alias',async()=>{
  assert.deepEqual(await identity('Bojenje zidova'),{count:1,id:A});
 });
 await t.test('S08 isolated live identity predicate rejects unregistered synonym even with a known UUID',async()=>{
  assert.deepEqual(await identity('Farbanje zidova'),{count:0,id:null});
 });
});
