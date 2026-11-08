'use strict';
// Execute the additive SQL reader against the existing real R08/review fixture.
// JWT hosting, production scale and native rendering are outside this proof.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {createReviewFixture}=require('./r08-blind-reviews-fixture.cjs');
const {createHarness}=require('./ux-component-harness.cjs');
const candidate=fs.readFileSync(path.join(__dirname,'sql/r09_agreement_groups_20261108.sql'),'utf8');
const rollback=fs.readFileSync(path.join(__dirname,'sql/r09_agreement_groups_20261108.rollback.sql'),'utf8');
const base={section:'active',role:'all',outcome:'all',confirmationOnly:false,query:''};

test('R09 complete Agreement groups: scoped SQL, real client decoder, keysets and privacy',async t=>{
 const f=await createReviewFixture();
 try{
  await f.db.exec(f.ratingCandidate);
  const catalog=()=>f.rows("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,md5(p.prosrc) as body,p.proacl::text as acl,p.proowner::regrole::text as owner,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname not in ('rpc_list_my_agreement_groups_page','agreement_list_instant_v1','agreement_list_search_v1') order by 1,2,3");
  const beforeCatalog=await catalog();
  const original=await f.value("select md5(prosrc) as value from pg_proc where oid='public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'::regprocedure");
  await f.db.exec(candidate);
  const sql=(view=base,limit=20,cursor=null)=>f.value('select public.rpc_list_my_agreement_groups_page($1,$2,$3) as value',[view,limit,cursor]);
  const session={user:{id:f.REQUESTER},accountRevision:1},calls=[];
  const h=createHarness({
   'src/store/sesija.ts':{sesijaSada:()=>session},
   'src/data/supabaseClient.ts':{supabaseKlijent:()=>({auth:{getUser:async()=>({data:{user:session.user},error:null})},rpc:(name,args)=>{
    calls.push({name,args});assert.equal(name,'rpc_list_my_agreement_groups_page');
    return {abortSignal:async signal=>{assert.equal(signal.aborted,false);return{data:await sql(args.p_view,args.p_limit,args.p_cursor),error:null};}};
   }})},
   'src/data/agreementRatingsRead.ts':{ratingReadOwnerCurrent:owner=>owner.accountId===session.user?.id&&owner.accountRevision===session.accountRevision,
    withAgreementRatings:async()=>{throw new Error('No per-row rating reads are allowed');}},
  });
  const {agreementClientService:client}=h.load('src/data/agreementClientService.ts');
  const {ownAgreementView,decodeOwnAgreementPage}=h.load('src/data/ownAgreementGroupsPage.ts');
  const {calendarInstant}=h.load('src/lib/calendarTime.ts');
  const {normalizedPlaceText}=h.load('src/ui/location/placeText.ts');
  const {groupAgreementTasks,groupActiveAgreementTasks}=h.load('src/ui/agreements/agreementListModel.ts');
  const page=(view=base,limit=20,cursor=null)=>client.mojiDogovoriStrana({view,limit,cursor});
  await f.actor(f.REQUESTER);
  const active=await f.agreement(),cancelledSibling=await f.agreement({need:active.need});
  await f.cancel(cancelledSibling,'Promenjen plan.');
  const due=await f.completed(),expired=await f.completed(337),cancelled=await f.agreement();
  await f.cancel(cancelled,'Otkazano.');
  let first;

  await t.test('opening reads one page and no terminal history or per-row rating RPC',async()=>{
   const before=await f.state(active);calls.length=0;first=await page();
   assert.equal(calls.length,1);assert.equal(calls[0].args.p_view.section,'active');
   assert.equal(first.items.length,2);assert.equal(first.counts.active,2);assert.equal(first.counts.history,2);
   assert.deepEqual(new Set(first.items.flatMap(g=>g.items.map(x=>x.id))),new Set([active.id,cancelledSibling.id,due.id]));
   assert.equal(first.items.find(g=>g.needId===active.need).items.length,2);
   assert.deepEqual(await f.state(active),before);
  });
  await t.test('COMPLETED awaiting my review stays active; expired reviews go to history',async()=>{
   const d=first.items.flatMap(g=>g.items).find(x=>x.id===due.id);
   assert.equal(d.ocenaMoguca,true);assert.equal(d.stanjeProvereOcene,'DUE');
   const old=await page({...base,section:'history'});
   assert.deepEqual(new Set(old.items.flatMap(g=>g.items.map(x=>x.id))),new Set([expired.id,cancelled.id]));
   assert.equal(old.items.flatMap(g=>g.items).find(x=>x.id===expired.id).ocenaMoguca,false);
   assert.equal(old.counts.historyInActive,true);
  });
  await t.test('task linkage, accepted hourly price and people are preserved in complete groups',async()=>{
   const item=first.items.find(g=>g.needId===active.need).items.find(x=>x.id===active.id);
   assert.equal(item.izvor.zadatakId,active.need);assert.equal(item.izvor.prijavaId,active.response);
   assert.equal(item.osnovaCene,'HOURLY');assert.equal(item.cena.iznos,1200);assert.equal(item.cena.valuta,'RSD');
   assert.equal(item.pokrivenost.popunjeno,2);assert.equal(item.pokrivenost.ukupno,5);
  });
  await t.test('active chronology matches the real UI order, including an old due review',async()=>{
   const raw=await sql();const p=await page();
   const order=groupActiveAgreementTasks(groupAgreementTasks(p.items.flatMap(x=>x.items)),new Date(raw.viewAt)).flatMap(g=>g.items.map(x=>x.key));
   assert.deepEqual(p.items.map(x=>x.key),order);assert.equal(p.items[0].needId,due.need);
  });
  await t.test('a one-group page never splits active/cancelled siblings and advances exactly once',async()=>{
   const a=await page(base,1);assert.equal(a.hasMore,true);const b=await page(base,1,a.cursor);
   assert.equal(b.hasMore,false);assert.equal(b.counts,null);assert.notEqual(a.items[0].key,b.items[0].key);
   assert.deepEqual(new Set([...a.items,...b.items].flatMap(g=>g.items.map(x=>x.id))),new Set([active.id,cancelledSibling.id,due.id]));
  });
  await t.test('history ties retain PostgreSQL microseconds and task/role tie breakers',async()=>{
   await f.db.query("update public.agreements set created_at='2026-11-01T10:00:00.123456Z' where id=any($1::uuid[])",[[expired.id,cancelled.id]]);
   const a=await page({...base,section:'history'},1),b=await page({...base,section:'history'},1,a.cursor);
   assert.equal(a.hasMore,true);assert.equal(b.hasMore,false);assert.notEqual(a.items[0].key,b.items[0].key);
   assert.equal(calendarInstant(a.cursor.at)%1000000n,123456n);assert.equal(a.cursor.at,b.cursor.at);
  });
  await t.test('normalization matches the existing Serbian/Unicode client helper',async()=>{
   for(const value of ['МАРКО Живковић',' Љиљана Његош Џемпер ','ČĆŽŠĐ','C\u030cаs','ℌelena','Νови Београд','Ana, Novi-Sad','Vlasnik','Љ'.repeat(120)]){
    const actual=await f.value('select private.agreement_list_search_v1($1) as value',[value]);
    assert.equal(actual,normalizedPlaceText(value),value);
   }
  });
  await t.test('calendar parser rejects normalized invalid dates and preserves exact offset/microsecond instants',async()=>{
   for(const value of ['2026-11-08T12:00:00Z','2026-11-08T12:00:00.123456+01:00','2024-02-29T23:59:59-03:30',
    '2026-02-29T12:00:00Z','2026-11-08T24:00:00Z','2026-11-08T12:00:60Z','2026-11-08T12:00:00+16:00','2026-11-08','infinity','0000-01-01T00:00:00Z']){
    const actual=await f.value('select (extract(epoch from private.agreement_list_instant_v1($1))*1000000)::bigint::text as value',[value]);
    const expected=calendarInstant(value);assert.equal(actual===null?null:BigInt(actual),expected,value);
   }
  });
  await t.test('same known search finds title/person/coarse place without private or own-name matches',async()=>{
   await f.db.query("update public.needs set title='Selidba stana',approximate_area='Liman',approximate_city='Novi Sad' where id=$1",[active.need]);
   await f.db.query("update public.app_profiles set display_name='Marko Živković' where id=$1",[f.PROFILE]);
   await f.db.query("update public.app_profiles set display_name='Vlasnik' where id=$1",[f.REQUESTER_PROFILE]);
   for(const query of ['Selidba','марко живковић','zivkovic selidba','Liman','Novi Sad']){
    const p=await page(ownAgreementView({...base,query}));assert.ok(p.items.some(g=>g.needId===active.need),query);
   }
   for(const query of ['Vlasnik','hiddenphone',active.id,active.need,'Ana']){
    const p=await page(ownAgreementView({...base,query}));assert.equal(p.items.length,0,query);assert.equal(p.counts.matching,0,query);
   }
  });
  await t.test('REMOTE uses the displayed Na daljinu label and ignores an obsolete physical place',async()=>{
   await f.db.query("update public.agreement_execution set mode='REMOTE' where agreement_id=any($1::uuid[])",[[active.id,cancelledSibling.id]]);
   assert.equal((await page(ownAgreementView({...base,query:'Selidba na daljinu'}))).items.length,1);
   assert.equal((await page(ownAgreementView({...base,query:'Liman'}))).items.length,0);
  });
  await t.test('role and outcome filters are applied before the page, preserving whole task groups',async()=>{
   assert.equal((await page({...base,role:'uskocer'})).items.length,0);
   const h=await page({...base,section:'history',outcome:'cancelled'});
   assert.deepEqual(h.items.flatMap(g=>g.items).map(x=>x.id),[cancelled.id]);
   const c=await page({...base,section:'history',outcome:'completed'});
   assert.deepEqual(c.items.flatMap(g=>g.items).map(x=>x.id),[expired.id]);
   assert.equal((await page({...base,confirmationOnly:true})).items.length,0);
  });
  await t.test('confirmed review moves only a fully settled group to history',async()=>{
   await f.review(due);
   assert.ok(!(await page()).items.some(g=>g.needId===due.need));
   assert.ok((await page({...base,section:'history'})).items.some(g=>g.needId===due.need));
  });
  await t.test('anonymous, foreign and closing accounts cannot obtain another account group',async()=>{
   await f.actor(null);await f.fails(()=>sql(),'AUTH_REQUIRED');
   await f.actor(f.FOREIGN);const foreign=await sql();assert.deepEqual(foreign.groups,[]);assert.equal(foreign.counts.hasAny,false);
   await f.actor(f.REQUESTER);await f.close(f.REQUESTER);
   try{await f.fails(()=>sql(),'ACCOUNT_CLOSING');}finally{await f.reopen();}
  });
  await t.test('the other participant sees their own role and bilateral rows',async()=>{
   session.user={id:f.WORKER};session.accountRevision++;await f.actor(f.WORKER);
   const p=await page();assert.ok(p.items.length>0);assert.ok(p.items.every(g=>g.role==='uskocer'));
   assert.ok(p.items.flatMap(g=>g.items).every(x=>x.ucesnici.find(person=>person.viSte).id===f.WORKER));
   session.user={id:f.REQUESTER};session.accountRevision++;await f.actor(f.REQUESTER);
  });
  await t.test('invalid, foreign-view and incomplete cursors fail closed',async()=>{
   for(const view of [{...base,section:null},{...base,role:1},{...base,outcome:null},{...base,query:null},
    {...base,confirmationOnly:null},{...base,unknown:true},{...base,query:'MARKO'},{...base,section:'history',confirmationOnly:true}]){
    await f.fails(()=>sql(view),'INVALID_VIEW');
   }
   for(const limit of [0,31,-1,null])await f.fails(()=>sql(base,limit),'INVALID_PAGE');
   const p=await page(base,1);
   for(const cursor of [{...p.cursor,id:null},{...p.cursor,role:null},{...p.cursor,at:null},{...p.cursor,rank:null},
    {...p.cursor,view:{...base,role:'uskocer'}},{...p.cursor,viewAt:'9999-01-01T00:00:00Z'},{...p.cursor,rank:0.1}]){
    await f.fails(()=>sql(base,1,cursor),'INVALID_PAGE');
   }
  });
  await t.test('the public projection has no PHONE or exact-location fields',async()=>{
   const result=await sql();
   for(const row of result.groups.flatMap(x=>x.items))for(const key of ['myPhoneShared','theirPhone','phone','address','exactAddress','latitude','longitude','exactLocation'])assert.equal(Object.hasOwn(row,key),false,key);
  });
  await t.test('ACL permits only deliberate authenticated RPC entry; helpers stay private',async()=>{
   assert.equal(await f.value("select has_function_privilege('anon','public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)','execute') as value"),false);
   assert.equal(await f.value("select has_function_privilege('authenticated','public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)','execute') as value"),true);
   for(const name of ['agreement_list_instant_v1','agreement_list_search_v1'])for(const role of ['anon','authenticated','service_role']){
    assert.equal(await f.value(`select has_function_privilege('${role}','private.${name}(text)','execute') as value`),false);
   }
   await f.db.exec('set role authenticated');try{assert.ok((await sql()).groups.length>0);}finally{await f.db.exec('reset role');}
   await f.db.exec('set role anon');try{await f.fails(()=>sql(),'permission denied');}finally{await f.db.exec('reset role');}
  });
  await t.test('undated active work has a valid cursor, ordered after known appointments',async()=>{
   const undated=await f.agreement({noInterval:true});const p=await page();
   assert.equal(p.items.at(-1).needId,undated.need);assert.ok(calendarInstant(p.cursor.at)!==null);
   assert.equal(p.items.at(-1).items[0].prihvacenPocetak,null);
  });
  await t.test('today, past, tomorrow and multi-day work preserve UI urgency and accepted chronology',async()=>{
   const now=Date.parse(await f.value('select statement_timestamp()::text as value'));
   const dated=[];
   for(const offset of [-3,-1,0,1,3,10])dated.push({offset,...await f.agreement({start:new Date(now+offset*86400000).toISOString(),end:new Date(now+offset*86400000+3600000).toISOString()})});
   const initial=await page();
   assert.deepEqual(initial.items.map(x=>x.key),groupActiveAgreementTasks(groupAgreementTasks(initial.items.flatMap(x=>x.items)),new Date(initial.asOf)).flatMap(g=>g.items.map(x=>x.key)));
   // Release overlapping accepted slots through the real cancellation writer;
   // the calendar must not be disabled to manufacture impossible agreements.
   for(const a of dated.filter(x=>Math.abs(x.offset)<=1))await f.cancel(a);
   const ongoing=await f.agreement({start:new Date(now-2*86400000).toISOString(),end:new Date(now+86400000).toISOString()});
   const raw=await sql(),p=await page();
   const order=groupActiveAgreementTasks(groupAgreementTasks(p.items.flatMap(x=>x.items)),new Date(raw.viewAt)).flatMap(g=>g.items.map(x=>x.key));
   assert.deepEqual(p.items.map(x=>x.key),order);
   assert.equal(p.items.find(g=>g.needId===ongoing.need).rank,2);
  });
  await t.test('my own pending change does not invent an action awaiting my completion confirmation',async()=>{
   const a=await f.agreement();await f.actor(f.WORKER);await f.markDone(a);await f.actor(f.REQUESTER);
   await f.db.query(`insert into public.agreement_change_proposals(agreement_id,base_version,proposed_terms,content_hash,client_request_id,proposed_by_account_id)
    values($1,1,$2,$3,$4,$5)`,[a.id,a.terms,'b'.repeat(64),randomUUID(),f.REQUESTER]);
   const p=await page(),g=p.items.find(g=>g.needId===a.need);assert.ok(g);assert.notEqual(g.rank,0);
   const ui=groupActiveAgreementTasks(groupAgreementTasks(g.items),new Date(p.asOf));assert.notEqual(ui[0].key,'waiting');
   assert.ok((await page({...base,confirmationOnly:true})).items.some(g=>g.needId===a.need));
  });
  await t.test('a worker never receives another worker in the same requester task group',async()=>{
   const profile=randomUUID(),response=randomUUID(),selection=randomUUID(),id=randomUUID();
   await f.db.query("insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status) values($1,$2,'WORKER','Ana','Novi Sad',array['Selidbe'],'ACTIVE')",[profile,f.FOREIGN]);
   await f.db.query(`insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,covered_slots,price_rsd,price_basis,selected_at)
    values($1,$2,$3,$4,'APPLICATION','SELECTED',1,1,9999,'TOTAL',statement_timestamp())`,[response,active.need,f.FOREIGN,profile]);
   await f.db.query(`insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode)
    values($1,$2,1,$3,$4,1,$5,$6,$7,'REQUESTER_SELECTS')`,[selection,active.need,f.REQUESTER,randomUUID(),response,f.FOREIGN,profile]);
   await f.db.query(`insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id)
    values($1,$2,$3,$4,$5,$6,$7,$8)`,[id,active.need,selection,response,f.REQUESTER,f.REQUESTER_PROFILE,f.FOREIGN,profile]);
   await f.db.query(`insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
    values($1,1,'CONFIRMED',$2,$3,$4)`,[id,{...active.terms,price_rsd:9999,priceBasis:'TOTAL',covered_slots:1},'a'.repeat(64),f.REQUESTER]);
   await f.db.query('insert into public.agreement_execution(agreement_id,agreement_version) values($1,1)',[id]);
   const owner=await page();assert.equal(owner.items.find(g=>g.needId===active.need).items.length,3);
   session.user={id:f.WORKER};session.accountRevision++;await f.actor(f.WORKER);
   const worker=await page();assert.equal(worker.items.find(g=>g.needId===active.need).items.length,2);
   assert.ok(!worker.items.flatMap(g=>g.items).some(x=>x.id===id||x.cena.iznos===9999));
   session.user={id:f.FOREIGN};session.accountRevision++;await f.actor(f.FOREIGN);
   const outsider=await page();assert.deepEqual(outsider.items.flatMap(g=>g.items).map(x=>x.id),[id]);
   session.user={id:f.REQUESTER};session.accountRevision++;await f.actor(f.REQUESTER);
  });
  await t.test('legacy reader bytes and all existing writer contracts remain unchanged',async()=>{
   assert.deepEqual(await catalog(),beforeCatalog);
   assert.equal(await f.value("select md5(prosrc) as value from pg_proc where oid='public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'::regprocedure"),original);
   await f.fails(()=>f.db.exec(candidate),'AGREEMENT_GROUPS_ALREADY_EXISTS');await f.db.exec('rollback');
  });
  await t.test('rollback refuses an unexpected replacement and restores only the additive reader',async()=>{
   const helper=await f.value("select pg_get_functiondef('private.agreement_list_search_v1(text)'::regprocedure) as value");
   await f.db.exec(helper.replace('AS $function$','AS $function$\n-- Deliberate local drift for rollback refusal.'));
   await f.fails(()=>f.db.exec(rollback),'AGREEMENT_GROUPS_ROLLBACK_BODY_MISMATCH');await f.db.exec('rollback');
   assert.equal(await f.value("select to_regprocedure('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)') is not null as value"),true);
   await f.db.exec(helper);const before=await f.state(active);await f.db.exec(rollback);
   assert.equal(await f.value("select to_regprocedure('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)') is null as value"),true);
   assert.deepEqual(await f.state(active),before);assert.deepEqual(await catalog(),beforeCatalog);
   assert.ok((await f.list()).items.length>0);
   await f.db.exec(candidate);assert.ok((await page()).items.length>0);
  });
  await t.test('forward preflight refuses changed baseline and leaves it intact',async()=>{
   await f.db.exec(rollback);
   const definition=await f.value("select pg_get_functiondef('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)'::regprocedure) as value");
   await f.db.exec(definition.replace('AS $function$','AS $function$\n-- Deliberate local preimage drift.'));
   await f.fails(()=>f.db.exec(candidate),'AGREEMENT_GROUPS_PREIMAGE_MISMATCH');await f.db.exec('rollback');
   assert.equal(await f.value("select to_regprocedure('public.rpc_list_my_agreement_groups_page(jsonb,integer,jsonb)') is null as value"),true);
   await f.db.exec(definition);await f.db.exec(candidate);assert.deepEqual(await catalog(),beforeCatalog);
  });
 }finally{await f.db.close();}
});
