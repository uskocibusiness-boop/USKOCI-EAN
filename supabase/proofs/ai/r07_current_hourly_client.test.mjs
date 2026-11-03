// Real mobile data adapters + the current SQL chain in an isolated process.
// Transport/Auth are fixture substitutions; not GoTrue/PostgREST or native.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadModules} from '../ex04/ts_loader.mjs';
import {setup,candidate} from './r07_current_hourly_fixture.mjs';

function client(f,accountId) {
 const routes={
  rpc_submit_response:['p_need_id','p_need_revision','p_worker_profile_id','p_covered_slots','p_price_rsd','p_proposed_start_at','p_proposed_end_at','p_scope_note','p_client_request_id'],
  rpc_list_my_applications:[],
  rpc_list_my_applications_page:['p_scope','p_limit','p_before_at','p_before_id','p_before_rank'],
  rpc_select_response:['p_need_id','p_need_revision','p_response_id','p_response_version','p_content_hash','p_client_request_id'],
 };
 const transport={auth:{getUser:async()=>({data:{user:{id:accountId}},error:null})},rpc:async(name,args={})=>{
  assert.ok(Object.hasOwn(routes,name),'UNEXPECTED_CLIENT_RPC:'+name);
  await f.actor(accountId);
  try {const names=routes[name];return {data:await f.value(`SELECT public.${name}(${names.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,names.map(n=>args[n]??null)),error:null};}
  catch(error){return {data:null,error:{code:error.code,message:error.message,details:error.detail??null}};}
 }};
 return loadModules({client:transport,accountId});
}
test('actual mobile submit/list/page/select adapters consume the corrected SQL without inventing a unit',async t=>{
 const f=await setup(t,{apply:false}),id=await f.need('HOURLY');
 const worker=client(f,f.WORKER),requester=client(f,f.REQUESTER);
 const submitter=worker.load('data/applicationSelectionClientService').applicationSelectionClientService;
 const command={potrebaId:id,potrebaRevizija:1,radnikProfilId:f.PROFILE,pokrivenaMesta:2,cenaRsd:1200,
  predlozeniPocetak:null,predlozeniKraj:null,napomena:null,clientRequestId:randomUUID()};
 const before=await submitter.podnesiPrijavu(command);assert.equal(before.ok,false);assert.equal(before.kod,'UNKNOWN_PRICE_BASIS');
 await f.db.exec("SET uskoci.r07_current.disposable='LOCAL_ONLY';"+candidate);
 const result=await submitter.podnesiPrijavu(command);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.podatak.osnovaCene,'HOURLY');
 const own=worker.load('data/applicationClientService').applicationClientService;
 const all=await own.mojePrijave(),page=await own.mojePrijaveStrana({scope:'ALL',limit:20,cursor:null});
 for(const item of [all[0],page.items[0]]){assert.equal(item.osnovaCene,'HOURLY');assert.equal(item.cena.iznos,1200);assert.equal(item.pokrivaMesta,2);}
 const chosen=await requester.load('data/applicationSelectionClientService').applicationSelectionClientService.izaberiPrijavu({
  potrebaId:id,potrebaRevizija:1,prijavaId:result.podatak.prijavaId,prijavaVerzija:result.podatak.verzija,
  prijavaHash:result.podatak.hash,mesta:2,clientRequestId:randomUUID()});
 assert.equal(chosen.ok,true,JSON.stringify(chosen));
 const terms=await f.value('SELECT terms AS value FROM public.agreement_versions WHERE agreement_id=$1',[chosen.podatak.dogovorId]);
 assert.equal(terms.priceBasis,'HOURLY');assert.equal(terms.price_rsd,1200);assert.equal(terms.covered_slots,2);
 assert.ok(worker.sources.some(s=>s.path==='src/data/applicationSelectionClientService.ts'));
 assert.ok(worker.sources.some(s=>s.path==='src/data/applicationClientService.ts'));
});
