// R01 PHONE deactivation, real source-only SQL under isolated in-memory PG18.
// Not hosted, not Auth/PostgREST, not current-schema parity or release acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const candidate=readFileSync(new URL('../../candidates/r01_phone_messages_only_current.sql',import.meta.url),'utf8');
// Current DEV reader definitions already include the previous safety-grant fix.
const revert=readFileSync(new URL('../../candidates/r01_phone_read_consent_20261009.sql',import.meta.url),'utf8');
function defs(s) {
 const found=[...s.matchAll(/CREATE OR REPLACE FUNCTION[\s\S]*?\$function\$;/g)].map(m=>m[0]);
 return new Map(found.map(s=>[s.match(/FUNCTION\s+(?:public|private)\.([a-z0-9_]+)\(/i)[1],s]));
}
const newer=defs(candidate),older=defs(revert);
const names=['grant_is_ownable','rpc_set_contact_grant','rpc_reveal_contact','rpc_get_agreement_workspace','rpc_list_my_agreements','rpc_list_my_agreements_page'];
const pinned=JSON.parse(candidate.match(/FOR x IN SELECT \* FROM jsonb_to_recordset\('([^']+)'::jsonb\)/)[1]);
const user='00000000-0000-4000-8000-000000000001',worker='00000000-0000-4000-8000-000000000002';
const other='00000000-0000-4000-8000-000000000003',agreement='00000000-0000-4000-8000-000000000010';
const need='00000000-0000-4000-8000-000000000011';
function previous(name){
 if(older.has(name))return older.get(name);
 let s=newer.get(name);
 if(name==='grant_is_ownable')return s.replace("when 'PHONE' then false",
  "when 'PHONE' then p_granter in (a.requester_account_id, a.worker_account_id)");
 if(name==='rpc_set_contact_grant')return s.replace(
  "\n  -- Product contract: only Agreement messages. Existing PHONE grants\n  -- may still be REVOKED by their owner; no new PHONE grant is admitted.\n  if p_channel = 'PHONE' and p_granted then\n    raise exception 'PHONE_SHARING_DISABLED' using errcode = '42501';\n  end if;\n",'\n');
 if(name==='rpc_reveal_contact')return s.replace(
  "\n  -- Historical PHONE receipts remain revocable, never reveal a phone.\n  if p_channel = 'PHONE' then\n    raise exception 'PHONE_SHARING_DISABLED' using errcode='42501';\n  end if;\n",'\n');
 throw Error('MISSING_PREIMAGE');
}
const db=new PGlite();
test.after(()=>db.close());
const rows=async(q,p=[])=>(await db.query(q,p)).rows;
async function as(actor,func){
 await rows("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
 await db.exec('SET ROLE authenticated');
 try{return await func();}finally{await db.exec('RESET ROLE')}
}
const one=(q,p=[])=>rows(q,p).then(r=>r[0]);
const deny=async fn=>assert.rejects(fn,e=>e.code==='42501'||String(e.message).includes('PHONE_SHARING_DISABLED'));
async function refuse(code){
 try{await assert.rejects(db.exec(candidate),e=>String(e.message).includes(code));}
 finally{await db.exec('ROLLBACK')}
}
test('R01: legacy PHONE grants refused, old revoke kept, EXACT_LOCATION kept',async()=>{
 assert.equal(newer.size,6);assert.equal(pinned.length,6);
 await db.exec([
 'CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;',
 'CREATE SCHEMA auth;CREATE SCHEMA private;',
 "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
 'CREATE TABLE public.agreements(id uuid primary key,requester_account_id uuid,worker_account_id uuid,requester_profile_id uuid,worker_profile_id uuid,need_id uuid,status text,selected_response_id uuid,current_version integer,created_at timestamptz default now());',
 'CREATE TABLE public.app_accounts(id uuid primary key,phone text);',
 'CREATE TABLE public.app_profiles(id uuid primary key,display_name text);',
 'CREATE TABLE public.needs(id uuid primary key,title text,approximate_area text,approximate_city text,required_slots integer,starts_at timestamptz,revision integer,task_country_code text);',
 'CREATE TABLE public.need_geography(need_id uuid primary key,public_topology jsonb);',
 'CREATE TABLE public.need_sensitive(need_id uuid primary key,exact_address text,resolved_location jsonb,access_notes text,exact_lat numeric,exact_lng numeric);',
 'CREATE TABLE public.access_grants(id uuid default gen_random_uuid(),agreement_id uuid,channel text,granted_by_account_id uuid,granted_to_account_id uuid,status text,granted_at timestamptz,revoked_at timestamptz,expires_at timestamptz,UNIQUE(agreement_id,channel,granted_by_account_id,granted_to_account_id));',
 'CREATE TABLE public.agreement_versions(agreement_id uuid,version integer,terms jsonb);',
 'CREATE TABLE public.agreement_execution(agreement_id uuid,state text,mode text,requester_deadline_at timestamptz,problem_opened_at timestamptz);',
 'CREATE TABLE public.agreement_change_proposals(id uuid,agreement_id uuid,status text,proposed_by_account_id uuid,created_at timestamptz);',
 'CREATE TABLE private.agreement_reviews(agreement_id uuid,reviewer_account_id uuid);',
 "CREATE FUNCTION private.agreement_action_state(uuid,uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$select '{}'::jsonb$$;",
 'CREATE FUNCTION private.closure_account_restricted(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$select false$$;',
 'CREATE FUNCTION private.safety_grant_valid(uuid,uuid,timestamptz) RETURNS boolean LANGUAGE sql STABLE AS $$select true$$;',
 'CREATE FUNCTION private.grant_counterparty_ok(uuid,uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$select true$$;',
 'CREATE FUNCTION private.resolved_location_record_valid(jsonb,text,jsonb,text,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$select true$$;',
 'GRANT USAGE ON SCHEMA public,auth TO authenticated;'
 ].join('\n'));
 for(const name of names){const s=previous(name);assert(s&&s.includes('FUNCTION'));await db.exec(s)}
 for(const entry of pinned){
   await db.exec('REVOKE EXECUTE ON FUNCTION '+entry.sig+' FROM PUBLIC');
   if(entry.sig.startsWith('public.')){
     const roles=entry.acl.slice(1,-1).split(',').map(x=>x.split('=')[0]);
     for(const role of roles.filter(x=>x!=='postgres'))await db.exec('GRANT EXECUTE ON FUNCTION '+entry.sig+' TO '+role);
   }
 }
 await db.query('INSERT INTO public.app_accounts VALUES($1,$2),($3,$4),($5,$6)',
   [user,'+38111111',worker,'+38122222',other,'+38133333']);
 await db.query('INSERT INTO public.app_profiles VALUES($1,$2),($3,$4)',
   ['00000000-0000-4000-8000-000000000020','Buyer','00000000-0000-4000-8000-000000000021','Worker']);
 await db.query("INSERT INTO public.needs VALUES($1,'Task','Area','Novi Sad',1,now(),1,'RS')",[need]);
 await db.query("INSERT INTO public.need_geography VALUES($1,'{}')",[need]);
 await db.query("INSERT INTO public.need_sensitive VALUES($1,'EXACT_SYNTHETIC_ADDRESS',null,'DOOR',45.1,19.8)",[need]);
 await db.query("INSERT INTO public.agreements(id,requester_account_id,worker_account_id,requester_profile_id,worker_profile_id,need_id,status,current_version) VALUES($1,$2,$3,$4,$5,$6,'CONFIRMED',1)",
   [agreement,user,worker,'00000000-0000-4000-8000-000000000020','00000000-0000-4000-8000-000000000021',need]);
 await db.query("INSERT INTO public.agreement_versions VALUES($1,1,'{}')",[agreement]);
 await db.query("INSERT INTO public.agreement_execution VALUES($1,'CONFIRMED','ON_SITE',null,null)",[agreement]);
 for(const p of pinned){
  const x=await one('SELECT md5(prosrc) md5,proacl::text acl,proconfig::text cfg FROM pg_proc WHERE oid=to_regprocedure($1)',[p.sig]);
  assert.equal(x.md5,p.bodyMd5,'exact PG17 predecessor body: '+p.sig);
  assert.equal(x.acl,p.acl,'source ACL: '+p.sig);
  assert.equal(x.cfg,p.config,'source config: '+p.sig);
 }
 const before=await as(user,()=>one("SELECT public.rpc_set_contact_grant($1,'PHONE',true) result",[agreement]));
 assert.equal(before.result.granted,true);
 const shown=await as(worker,()=>one("SELECT public.rpc_reveal_contact($1,'PHONE') result",[agreement]));
 assert.equal(shown.result.phone,'+38111111');
 await refuse('R01_PHONE_DISPOSABLE_ONLY');
 await db.exec("SET uskoci.r01.disposable='LOCAL_ONLY'");
 await as(user,()=>refuse('R01_PHONE_DISPOSABLE_ONLY'));
 await db.exec(candidate);
 const ownerPhone=await one("SELECT private.grant_is_ownable($1,'PHONE',$2) ok",[agreement,user]);
 const ownerLocation=await one("SELECT private.grant_is_ownable($1,'EXACT_LOCATION',$2) ok",[agreement,user]);
 assert.equal(ownerPhone.ok,false);assert.equal(ownerLocation.ok,true);
 await as(user,()=>deny(one("SELECT public.rpc_set_contact_grant($1,'PHONE',true)",[agreement])));
 await as(worker,()=>deny(one("SELECT public.rpc_reveal_contact($1,'PHONE')",[agreement])));
 const detail=(await as(worker,()=>one("SELECT public.rpc_get_agreement_workspace($1) result",[agreement]))).result;
 const list=(await as(worker,()=>one("SELECT public.rpc_list_my_agreements() result"))).result;
 const page=(await as(worker,()=>one("SELECT public.rpc_list_my_agreements_page('ALL',30,null,null) result"))).result;
 assert.equal(list.length,1);assert.equal(page.items.length,1);
 for(const x of [detail,list[0],page.items[0]]){assert.equal(x.myPhoneShared,false);assert.equal(x.theirPhone,null);}
 assert.equal(detail.title,'Task');assert.equal(page.hasMore,false);
 assert(!JSON.stringify([detail,list,page]).includes('+38111111'));
 const loc=await as(user,()=>one("SELECT public.rpc_set_contact_grant($1,'EXACT_LOCATION',true) result",[agreement]));
 assert.equal(loc.result.granted,true);
 const revealed=await as(worker,()=>one("SELECT public.rpc_reveal_contact($1,'EXACT_LOCATION') result",[agreement]));
 assert.equal(revealed.result.exactAddress,'EXACT_SYNTHETIC_ADDRESS');
 await as(other,()=>deny(one("SELECT public.rpc_reveal_contact($1,'EXACT_LOCATION')",[agreement])));
 await as(worker,()=>deny(one("SELECT public.rpc_set_contact_grant($1,'EXACT_LOCATION',true)",[agreement])));
 await db.query("UPDATE public.agreements SET status='CANCELLED' WHERE id=$1",[agreement]);
 const revoke=await as(user,()=>one("SELECT public.rpc_set_contact_grant($1,'PHONE',false) result",[agreement]));
 assert.equal(revoke.result.granted,false);
 assert.equal((await one("SELECT status FROM public.access_grants WHERE agreement_id=$1 AND channel='PHONE'",[agreement])).status,'REVOKED');
 await as(user,()=>deny(one("SELECT public.rpc_set_contact_grant($1,'PHONE',true)",[agreement])));
});