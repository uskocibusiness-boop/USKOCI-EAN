// Execute captured, unmodified current SQL in isolated in-memory PostgreSQL.
// Only conversation prerequisite tables and auth.jwt() are synthetic. This is
// not hosted R01/Auth/PostgREST, concurrency, provider, or deployment acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { persistClarificationHint, getUnconsumedClarificationHint }
  from '../../functions/_shared/backgroundTaxonomyArchitect.mjs';

const snapshot=readFileSync(new URL('../privacy/bootstrap/current-application.sql',import.meta.url),'utf8');
const functionNames=['private.classification_conversation_revision_v1',
  'public.rpc_taxonomy_store_classification_turn_hint_service',
  'public.rpc_taxonomy_get_unconsumed_turn_hint_service',
  'public.rpc_taxonomy_consume_turn_hint_revision_service'];
const actualFunctions=functionNames.map(name=>{
  const start=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');
  const end=snapshot.indexOf('$function$;',snapshot.indexOf('AS $function$',start)+14);
  assert.ok(start>=0&&end>start,'captured SQL definition must exist: '+name);
  return snapshot.slice(start,end+'$function$;'.length);
}).join('\n');
const actualTable=snapshot.match(/CREATE TABLE "private"\."classification_turn_hints" \([\s\S]*?\n\);/)[0];
const actualTableRules=snapshot.match(/^ALTER TABLE "private"\."classification_turn_hints" .*;$/gm).join('\n');
const id=n=>`${String(n).padStart(8,'0')}-5555-4555-8555-555555555555`;
const storeName='rpc_taxonomy_store_classification_turn_hint_service';
const getName='rpc_taxonomy_get_unconsumed_turn_hint_service';
const consumeName='rpc_taxonomy_consume_turn_hint_revision_service';
const signature={
  [storeName]:['p_conversation_id','p_draft_revision','p_service','p_mode','p_ambiguity_prompt','p_reason'],
  [getName]:['p_conversation_id','p_draft_revision'],
  [consumeName]:['p_conversation_id','p_draft_revision','p_service'],
};
async function fixture(t,kind,caseId){
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      'SELECT jsonb_build_object(''role'',current_setting(''test.jwt_role'',true))';
    CREATE TABLE public.ai_conversations(id uuid PRIMARY KEY,account_id uuid,purpose text,status text);
    CREATE TABLE public.ai_messages(conversation_id uuid,account_id uuid,sequence_no bigint);
    CREATE TABLE private.worker_ai_sessions(conversation_id uuid,account_id uuid,revision bigint);
    ${actualTable}\n${actualTableRules}\n${actualFunctions}
    SELECT set_config('test.jwt_role','service_role',false);`);
  const conversationId=id(caseId),accountId=id(999);
  await db.query('INSERT INTO public.ai_conversations VALUES($1,$2,$3,\'OPEN\')',
    [conversationId,accountId,kind==='NEED'?'NEED_INTAKE':'PROFILE']);
  if(kind==='NEED')await db.query('INSERT INTO public.ai_messages VALUES($1,$2,4)',[conversationId,accountId]);
  else await db.query('INSERT INTO private.worker_ai_sessions VALUES($1,$2,4)',[conversationId,accountId]);
  const call=async(name,args)=>{
    assert.ok(Object.hasOwn(signature,name),'allowlisted SQL only');
    const keys=signature[name];
    return (await db.query(`SELECT public.${name}(${keys.map((_,i)=>'$'+(i+1)).join(',')}) AS value`,
      keys.map(key=>args[key]??null))).rows[0].value;
  };
  const hint={conversationId,draftRevision:4,service:'  Krečenje  ',mode:'ON_SITE',
    ambiguityPrompt:'  Koju prostoriju treba okrečiti?  ',reason:'  Obim posla nije određen.  '};
  const get=()=>call(getName,{p_conversation_id:conversationId,p_draft_revision:4});
  const rows=async()=> (await db.query('SELECT id::text,service,consumed_at FROM private.classification_turn_hints WHERE conversation_id=$1',[conversationId])).rows;
  return {db,call,hint,get,rows,conversationId};
}

for(const [index,kind] of ['NEED','WORKER'].entries()){
  test(kind+' captured SQL commit plus lost ACK is recovered with one write and one exact read',async t=>{
    const f=await fixture(t,kind,10+index),calls=[];
    let storedId;
    const ok=await persistClarificationHint(async(name,args)=>{
      calls.push(name);
      const value=await f.call(name,args);
      if(name===storeName){storedId=(await f.rows())[0].id;throw new Error('SYNTHETIC_LOST_ACK');}
      return {ok:true,data:value};
    },f.hint);
    assert.equal(ok,true);
    assert.deepEqual(calls,[storeName,getName]);
    const rows=await f.rows();assert.equal(rows.length,1);assert.equal(rows[0].id,storedId);
    const saved=await f.get();
    assert.equal(saved.service,'Krečenje');
    assert.equal(saved.ambiguityPrompt,'Koju prostoriju treba okrečiti?');
    assert.equal(saved.reason,'Obim posla nije određen.');
    assert.equal(getUnconsumedClarificationHint(f.conversationId,4)?.service,saved.service);
  });
  test(kind+' identical replacement proves current content, not the original write identity',async t=>{
    const f=await fixture(t,kind,20+index),calls=[];
    let originalRowId,replacementRowId;
    assert.equal(await persistClarificationHint(async(name,args)=>{
      calls.push(name);
      const value=await f.call(name,args);
      if(name===storeName){
        originalRowId=(await f.rows())[0].id;
        // Another writer may replace the same tuple while the first ACK is lost.
        // Existing GET returns no operation/row ID; never infer paid-attempt status.
        await f.call(storeName,args);replacementRowId=(await f.rows())[0].id;
        return null;
      }
      return value;
    },f.hint),true);
    assert.deepEqual(calls,[storeName,getName]);
    assert.notEqual(originalRowId,replacementRowId);
    assert.equal((await f.rows())[0].id,replacementRowId);
  });
  for(const [caseOffset,change] of ['replacement','consumed','revision','closed','expired'].entries()){
    test(kind+' captured SQL '+change+' cannot be mistaken for the lost clarification receipt',async t=>{
      const f=await fixture(t,kind,100+index*10+caseOffset),calls=[];
      let firstRowId;
      assert.equal(await persistClarificationHint(async(name,args)=>{
        calls.push(name);
        const value=await f.call(name,args);
        if(name===storeName){
          firstRowId=(await f.rows())[0].id;
          if(change==='replacement')await f.call(storeName,{...args,p_service:'Druga usluga'});
          if(change==='consumed')await f.call(consumeName,{...args,p_service:'Krečenje'});
          if(change==='revision'){
            if(kind==='NEED')await f.db.query('UPDATE public.ai_messages SET sequence_no=5 WHERE conversation_id=$1',[f.conversationId]);
            else await f.db.query('UPDATE private.worker_ai_sessions SET revision=5 WHERE conversation_id=$1',[f.conversationId]);
          }
          if(change==='closed')await f.db.query('UPDATE public.ai_conversations SET status=\'CLOSED\' WHERE id=$1',[f.conversationId]);
          if(change==='expired')await f.db.query('UPDATE private.classification_turn_hints SET created_at=now()-interval \'2 days\' WHERE conversation_id=$1',[f.conversationId]);
          return null;
        }
        return value;
      },f.hint),false);
      assert.deepEqual(calls,[storeName,getName]);
      assert.equal(getUnconsumedClarificationHint(f.conversationId,4),null);
      const rows=await f.rows();assert.equal(rows.length,1,'readback must not replay replacement/consume');
      if(change==='replacement'){
        assert.notEqual(rows[0].id,firstRowId);assert.equal(rows[0].service,'Druga usluga');
      }else assert.equal(rows[0].id,firstRowId);
      if(change==='consumed')assert.notEqual(rows[0].consumed_at,null);
    });
  }
}

test('captured hint read/write still require service-role JWT inside isolated SQL',async t=>{
  const f=await fixture(t,'NEED',300);
  await f.db.exec("SELECT set_config('test.jwt_role','authenticated',false)");
  await assert.rejects(f.get(),error=>error.code==='42501'&&error.message.includes('TAXONOMY_HINT_DENIED'));
  await assert.rejects(f.call(storeName,{p_conversation_id:f.conversationId,p_draft_revision:4,
    p_service:'Krečenje',p_ambiguity_prompt:'Koju prostoriju treba okrečiti?'}),error=>error.code==='42501');
  assert.deepEqual(await f.rows(),[]);
});
