'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {original,definition,afterMd5,migrationSql}=require('../../candidates/home-read-reliability-20261018/invoker-fix.cjs');
test('column-grant regression reproduced, then fixed without new grants or definer access',async t=>{
 const {PGlite}=require(process.env.PGLITE_MODULE);const db=new PGlite();
 const uid=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
 const reader=uid(999),other=uid(888);
 const read=async(filters={},limit=3,actor=reader,bbox=null,cursor=null)=>{
  await db.exec('begin;set local role authenticated');
  try{
   await db.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);
   return (await db.query('select public.rpc_list_open_tasks_v3($1,$2,$3,$4,$5) result',
    [bbox,JSON.stringify(filters),limit,cursor?.sortAt??null,cursor?.id??null])).rows[0].result;
  }finally{await db.exec('rollback');}
 };
 const snapshot=async()=> (await db.query("select to_jsonb(p)-'prosrc' metadata from pg_proc p where oid=$1::regprocedure",['public.'+original.signature])).rows[0].metadata;
 try{
  await db.exec(fs.readFileSync(path.join(__dirname,'fixture.sql'),'utf8'));
  await db.exec(`create table public.app_profiles(id uuid primary key,account_id uuid not null);
   alter table public.app_profiles enable row level security;
   create policy own_profile on public.app_profiles for select to authenticated using(account_id=auth.uid());
   grant select on public.app_profiles to authenticated;
   alter function public.covered_slots(public.needs) security definer;
   revoke select on public.needs from authenticated;`);
  const columns=(await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='needs' order by ordinal_position")).rows
   .map(r=>r.column_name).filter(n=>n!=='requester_account_id'&&!n.startsWith('_'));
  await db.exec('grant select ('+columns.join(',')+') on public.needs to authenticated');
  await db.exec(original.definition);
  await db.exec('revoke all on function public.'+original.signature+' from public;grant execute on function public.'+original.signature+' to authenticated');
  await db.query('insert into public.app_profiles values($1,$2),($3,$4)',[uid(700),reader,uid(701),other]);
  for(const n of [10,9,8,7,6,5,4,3,2,1])await db.query(`insert into public.needs
   (id,requester_account_id,requester_profile_id,published_at,_covered,response_deadline,_visible,remaining_search_closed_at,status)
   values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[uid(n),n===10?reader:other,n===10?uid(700):uid(701),
    '2026-10-18T'+String(n).padStart(2,'0')+':00:00Z',n===9?2:0,n===8?'2000-01-01':'2099-01-01',n!==7,n===3?'2026-10-18':null,n===2?'DRAFT':'PUBLISHED']);
  const bbox={west:19.7,south:45.1,east:20,north:45.4};
  const baseline=await read({},20),exact=await read({needId:uid(10)},1),map=await read({},20,reader,bbox);
  const beforeMetadata=await snapshot();
  await t.test('original candidate breaks even ordinary reads when private identity column is withheld',async()=>{
   await db.exec(original.after);
   await assert.rejects(()=>read({},20),e=>e.code==='42501');
   await db.exec(original.definition);
  });
  await t.test('forward fix preserves metadata and the actual column-privilege boundary',async()=>{
   await db.exec('begin;'+migrationSql()+'commit;');
   assert.deepEqual(await snapshot(),beforeMetadata);
   const p=(await db.query("select has_column_privilege('authenticated','public.needs','requester_account_id','SELECT') private_read,md5(prosrc) hash from pg_proc where oid=$1::regprocedure",['public.'+original.signature])).rows[0];
   assert.equal(p.private_read,false);assert.equal(p.hash,afterMd5);
   assert.equal(definition.includes('m.requester_account_id'),false);
  });
  await t.test('own/full/expired/closed/draft/RLS-hidden rows do not consume the limit; no profile still sees public work',async()=>{
   const preview=await read({homePreview:true});
   assert.deepEqual(preview.items.map(r=>r.id),[uid(6),uid(5),uid(4)]);assert.equal(preview.hasMore,true);
   assert.equal(preview.items.every(r=>r.acceptsApplications),true);
   const noProfile=await read({homePreview:true},3,uid(555));assert.equal(noProfile.items[0].id,uid(10));
   assert.equal(JSON.stringify(preview).includes('PRIVATE_'),false);
  });
  await t.test('ordinary/exact/cursor/map outputs remain equal',async()=>{
   assert.deepEqual((await read({},20)).items,baseline.items);
   assert.deepEqual((await read({needId:uid(10)},1)).items,exact.items);
   assert.deepEqual((await read({},20,reader,bbox)).items,map.items);
   assert.deepEqual((await read({},20,reader,null,baseline.items[2])).items,baseline.items.slice(3));
  });
  await t.test('mixed filters, invalid limits, bbox/cursor and missing auth still fail closed',async()=>{
   for(const f of [{homePreview:false},{homePreview:true,remote:'ONLY'},{homePreview:'true'}])
    await assert.rejects(()=>read(f),e=>e.code==='22023');
   for(const n of [1,2,4])await assert.rejects(()=>read({homePreview:true},n),e=>e.code==='22023');
   await assert.rejects(()=>read({homePreview:true},3,reader,bbox),e=>e.code==='22023');
   await assert.rejects(()=>read({homePreview:true},3,reader,null,baseline.items[0]),e=>e.code==='22023');
   await assert.rejects(()=>read({homePreview:true},3,''),e=>e.code==='28000');
  });
  await t.test('repeat/drift refuses without partial function or privilege changes',async()=>{
   const fixed=await snapshot();
   await assert.rejects(()=>db.exec('begin;'+migrationSql()+'commit;'),/HOME_INVOKER_FIX_PREIMAGE_DRIFT/);
   await db.exec('rollback');assert.deepEqual(await snapshot(),fixed);
  });
 }finally{await db.close();}
});
