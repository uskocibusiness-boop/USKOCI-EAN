// R07a SQL boundary proof, called by the price-retraction regression.
// Actual current prepare/accept/save/publish bodies, NOT a full integration test.
// Auth/closure are inherited synthetic fixtures. Geography and policy below are
// fixed fixtures; successful acceptance deliberately stops BEFORE location save.
// No successful draft creation, evaluation, publication, Auth/HTTP or RLS claim.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function verifyPriceReviewBoundary({t,db,bootstrap,install,owner,conversation,apply,guard,proposal,active,seedPrice}) {
 const one=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
 const json=JSON.stringify;
 const table=(schema,name)=>{
  const start=bootstrap.indexOf(`CREATE TABLE "${schema}"."${name}" (`);
  assert.ok(start>=0,`missing table ${name}`);
  return bootstrap.slice(start,bootstrap.indexOf('\n);',start)+4);
 };
 for(const name of ['ai_task_reviews','ai_task_review_commands','owned_media_assets','need_draft_save_commands'])
  await db.exec(table('private',name));
 await db.exec(`
  alter table private.ai_task_reviews alter column created_at set default clock_timestamp();
  create table public.app_profiles(id uuid,account_id uuid,kind text,profile_status text);
  create table private.publication_policy_bundles(id uuid);
  create table private.publication_policy_rule_refs(id uuid);
  create table private.location_market_configs(country_code text);
  create function extensions.digest(text,text) returns bytea language sql as
   'select extensions.digest(convert_to($1,''UTF8''),$2)';
  create function private.ai_task_review_policy(text) returns jsonb language sql as
   'select jsonb_build_object(''fixture'',''R07_PRICE_ONLY'',''country'',$1)';
  create function private.require_location_country(jsonb) returns text language plpgsql as
   $$begin if $1 <> '"RS"'::jsonb then raise exception 'FIXTURE_COUNTRY'; end if; return 'RS'; end$$;
  create function private.normalize_task_geography(jsonb) returns jsonb language plpgsql as
   $$begin if $1 <> '{"mode":"STATIONARY","start":{"city":"Novi Sad"}}'::jsonb
    then raise exception 'FIXTURE_GEOGRAPHY'; end if; return $1; end$$;
  create function private.need_location_review_document(uuid) returns jsonb language sql as
   $$select '{"revision":"fixture-location","value":{"taskCountryCode":"RS","geography":{"mode":"STATIONARY","start":{"city":"Novi Sad"}}}}'::jsonb$$;
  create function private.normalize_need_location(jsonb) returns jsonb language plpgsql as
   $$begin if $1 <> '{"taskCountryCode":"RS","geography":{"mode":"STATIONARY","start":{"city":"Novi Sad"}}}'::jsonb
    then raise exception 'FIXTURE_LOCATION'; end if; return $1; end$$;
  create function private.taxonomy_handoff_valid_v1(jsonb) returns boolean language sql as 'select false';
  create function public.rpc_save_need_location_review(uuid,text,jsonb,boolean) returns jsonb language plpgsql as
   $$begin raise exception 'FIXTURE_ACCEPT_WRITE_BOUNDARY' using errcode='P0001'; end$$;
 `);
 const profile=randomUUID();
 await db.query("insert into public.app_profiles values($1,$2,'REQUESTER','ACTIVE')",[profile,owner]);
 // Review/media body hashes were checked read-only against DEV on 2026-10-28;
 // the leaf location validator is pinned to the existing canonical bootstrap.
 for(const [name,md5] of [
  ['private.need_v2_location_ref_valid','8ff36bb72b3bce9987db9ccbcd09bf19'],
  ['private.media_task_refs','1629303365028bddc5047fbbf3d9829b'],
  ['private.media_refs_ready','8ea1151e0da7f885daaa3f422fe618fa'],
  ['private.ai_task_review_source','61c7ad3b2917bcd80ec43d2a74f726a3'],
  ['public.rpc_prepare_ai_task_review','3701c41f5fcca0bdfd1e50573305600c'],
  ['public.rpc_accept_ai_task_review','535fa065c24b514423af8d04a8a58574'],
  ['public.rpc_save_need_draft_from_review','39a3d39e60e8ab42f7e0269aba965280'],
  ['public.rpc_publish_accepted_ai_task_review','610a2f0eb6a8cf5ba5e53cd750bdc438'],
 ]){
  const start=bootstrap.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');
  assert.ok(start>=0);
  const end=bootstrap.indexOf('$function$;',start)+'$function$;'.length;
  await install(bootstrap.slice(start,end),md5);
 }
 const prepare=async()=> (await one('select public.rpc_prepare_ai_task_review($1) as result',[conversation])).result;
 const accept=(review,digest=review.displayedContentDigest)=>db.query(
  'select public.rpc_accept_ai_task_review($1,$2,$3)',[review.reviewId,digest,randomUUID()]);
 const noWrites=async()=>{
  for(const name of ['public.needs','private.ai_task_review_commands','private.need_draft_save_commands'])
   assert.equal((await one(`select count(*)::int as n from ${name}`)).n,0,name);
 };
 const assertBlocked=async(review,message)=>{
  const facts=await active();
  await assert.rejects(accept(review),{message});
  assert.deepEqual(await active(),facts);
  await noWrites();
 };
 let oldReview,withdrawn;
 await t.test('actual prepared review is complete before retraction and reaches the write boundary',async()=>{
  await seedPrice();
  for(const fact of await active())await db.query('select public.rpc_ai_confirm_fact($1)',[fact.id]);
  oldReview=await prepare();
  assert.equal(oldReview.canAccept,true);assert.deepEqual(oldReview.missingRequired,[]);
  assert.equal(oldReview.publicProjection.find(f=>f.key==='need.price_rsd').value,8000);
  assert.equal(oldReview.publicProjection.find(f=>f.key==='need.price_rsd').status,'CONFIRMED');
  assert.deepEqual(await prepare(),oldReview,'unchanged refresh reuses the immutable review');
  await assertBlocked(oldReview,'FIXTURE_ACCEPT_WRITE_BOUNDARY');
 });
 await t.test('actual accept rejects the previously prepared review after EUR retraction',async()=>{
  await apply('u evrima',guard('u evrima',[],await active()));
  await assertBlocked(oldReview,'TASK_REVIEW_STALE');
  withdrawn=await prepare();
  assert.notEqual(withdrawn.reviewId,oldReview.reviewId);
  assert.notEqual(withdrawn.displayedContentDigest,oldReview.displayedContentDigest);
  assert.equal(withdrawn.canAccept,false);
  assert.deepEqual(withdrawn.missingRequired,['need.price_mode']);
  assert.equal(withdrawn.publicProjection.some(f=>f.key.startsWith('need.price_')),false);
  await assertBlocked(withdrawn,'TASK_REVIEW_INCOMPLETE');
 });
 await t.test('later ALLOW cannot revive old consent or bypass the actual direct draft writer',async()=>{
  await apply('Hvala.',guard('Hvala.',[],await active()));
  const review=await prepare();assert.equal(review.safety,'ALLOW');assert.equal(review.canAccept,false);
  await assertBlocked(oldReview,'TASK_REVIEW_STALE');
  await assertBlocked(review,'TASK_REVIEW_INCOMPLETE');
  // Confirm unrelated facts so this rejection cannot be explained by a missing
  // headcount left by earlier scenarios; price_mode alone must be missing.
  for(const fact of await active())await db.query('select public.rpc_ai_confirm_fact($1)',[fact.id]);
  await assert.rejects(db.query('select public.rpc_save_need_draft_from_review($1,$2,$3)',
   [conversation,profile,'r07-direct-save-negative']),error=>{
    assert.equal(error.message,'REQUIRED_CONFIRMED_FACTS_MISSING');
    assert.equal(error.detail,'need.price_mode');return true;
   });
  await noWrites();
 });
 await t.test('a new explicit RSD amount needs a new review and reaches acceptance without restoring old fact IDs',async()=>{
  await apply('Cena je 9000 RSD ukupno.',guard('Cena je 9000 RSD ukupno.',[
   proposal('need.price_mode','MY_PRICE','9000 RSD'),proposal('need.price_rsd',9000,'9000 RSD'),
   proposal('need.price_basis','TOTAL','ukupno')],await active()));
  const review=await prepare();assert.equal(review.canAccept,true);
  const price=review.publicProjection.find(f=>f.key==='need.price_rsd');
  assert.equal(price.value,9000);assert.equal(price.status,'NEEDS_CONFIRMATION');
  assert.notEqual(price.id,oldReview.publicProjection.find(f=>f.key==='need.price_rsd').id);
  await assertBlocked(oldReview,'TASK_REVIEW_STALE');
  await assertBlocked(withdrawn,'TASK_REVIEW_STALE');
  await assert.rejects(accept(review,oldReview.displayedContentDigest),{message:'TASK_REVIEW_DIGEST_MISMATCH'});
  await assertBlocked(review,'FIXTURE_ACCEPT_WRITE_BOUNDARY');
 });
 await t.test('returning to the same numeric amount still cannot accept the original review',async()=>{
  await seedPrice();
  const review=await prepare();assert.equal(review.canAccept,true);
  assert.equal(review.publicProjection.find(f=>f.key==='need.price_rsd').value,8000);
  assert.notEqual(review.displayedContentDigest,oldReview.displayedContentDigest);
  await assertBlocked(oldReview,'TASK_REVIEW_STALE');
  await assertBlocked(review,'FIXTURE_ACCEPT_WRITE_BOUNDARY');
 });
 await t.test('explicit OFFERS after retraction creates a fresh acceptable review with no old amount',async()=>{
  await apply('u evrima',guard('u evrima',[],await active()));
  await apply('Želim ponude.',guard('Želim ponude.',[proposal('need.price_mode','OFFERS','Želim ponude')],await active()));
  const review=await prepare();assert.equal(review.canAccept,true);
  assert.equal(review.publicProjection.find(f=>f.key==='need.price_mode').value,'OFFERS');
  assert.equal(review.publicProjection.some(f=>['need.price_rsd','need.price_basis'].includes(f.key)),false);
  await assertBlocked(oldReview,'TASK_REVIEW_STALE');
  await assertBlocked(review,'FIXTURE_ACCEPT_WRITE_BOUNDARY');
 });
 await t.test('actual publish refuses a review that never produced an accepted command',async()=>{
  await assert.rejects(db.query('select public.rpc_publish_accepted_ai_task_review($1,$2)',
   [oldReview.reviewId,randomUUID()]),{message:'TASK_REVIEW_COMMAND_MISMATCH'});
  await noWrites();
 });
}
