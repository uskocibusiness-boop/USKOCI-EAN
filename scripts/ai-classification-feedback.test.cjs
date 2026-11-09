'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

test('unconfirmed taxonomy never announces review or a successful category write',async t=>{
  const {withUnresolvedSinglePassReply:guard}=await import('../supabase/functions/_shared/singlePassTaxonomy.mjs');
  const facts=[{key:'need.people_needed',value:2,evidence:'trebaju mi dvojica'}];
  const need=(next='REVIEW',message='Sve je spremno. Želite li da objavite zadatak?')=>({
    assistantMessage:message,safety:'ALLOW',proposals:facts,
    dialogue:{next,questionKey:'NONE',taskRelation:'CONTINUE'},
  });
  await t.test('REVIEW question cannot bypass a missing plan',()=>{
    const result=guard(need(),null,null);
    assert.equal(result.dialogue.next,'ACK');
    assert.match(result.assistantMessage,/Pregled još nije spreman/);
    assert.doesNotMatch(result.assistantMessage,/zabeležen|sačuvan|objavlj|odgovarajuću kategoriju/);
    assert.equal(result.proposals,facts);
  });
  await t.test('unresolved ordinary acknowledgements remain honest',()=>{
    for(const message of ['Detalji zadatka su zabeleženi u odgovarajuću kategoriju.','Sve je spremno.','Opis ostaje u nacrtu.']) {
      const result=guard(need('ACK',message),null,null);
      assert.match(result.assistantMessage,/Pregled još nije spreman/);
      assert.equal(result.proposals,facts);
    }
  });
  await t.test('worker draft patch is retained without claiming a saved profile',()=>{
    const patch={skills:['Fizička pomoć pri selidbi']};
    const result=guard({assistantMessage:'Vaš profil je sačuvan.',safety:'ALLOW',patch},null,null);
    assert.equal(result.patch,patch);
    assert.match(result.assistantMessage,/Pregled još nije spreman/);
    assert.equal(Object.hasOwn(result,'dialogue'),false);
  });
  await t.test('specific validated work distinction takes precedence',()=>{
    const question='Nudite li samo nošenje stvari ili i prevoz svojim vozilom?';
    const result=guard(need(),{clarifications:[{ambiguityPrompt:question}]},null);
    assert.equal(result.assistantMessage,question);
    assert.equal(result.dialogue.next,'CLARIFY');
    assert.equal(result.dialogue.questionKey,'NONE');
    assert.equal(result.proposals,facts);
  });
  await t.test('ordinary missing-business-fact question survives',()=>{
    const source=need('ASK','Kada Vam je potrebna pomoć?');
    assert.equal(guard(source,null,null),source);
  });
  await t.test('Worker names one truly unconfirmed legacy service without changing facts or granting review',()=>{
    const patch={skills:['Kurirske dostave','Izrada prezentacija']};
    const result=guard({assistantMessage:'Sve je spremno.',safety:'ALLOW',patch},{
      unresolvedServices:['Kurirske dostave'],unconfirmedModeServices:['Kurirske dostave'],
    },{proposals:[{service:'Izrada prezentacija',mode:'REMOTE'}]});
    assert.equal(result.assistantMessage,'Da li uslugu „Kurirske dostave“ pružate na lokaciji, onlajn ili na oba načina?');
    assert.equal(result.patch,patch);
    assert.equal(result.safety,'ALLOW');
    assert.equal(Object.hasOwn(result,'dialogue'),false);
  });
  await t.test('known modes with a technical failure never become a repeated modes question',()=>{
    const source={assistantMessage:'Sve je spremno.',safety:'ALLOW',patch:{}};
    for(const code of ['WORKER_MODE_REQUEST_INVALID','PROVIDER_INVALID_DECISION','WORKER_SERVICE_MODE_SET_INCOMPLETE']){
      const result=guard(source,{failures:[{code,service:'Lektura'}],unresolvedServices:['Lektura'],unconfirmedModeServices:[]},null);
      assert.match(result.assistantMessage,/Pregled još nije spreman/);
      assert.doesNotMatch(result.assistantMessage,/na lokaciji|onlajn/);
    }
  });
  await t.test('a direct explanation is not replaced by classification status',()=>{
    const source=need('ANSWER','Vaš zadatak se objavljuje tek kada Vi potvrdite pregled.');
    assert.equal(guard(source,null,null),source);
  });
  await t.test('a present plan does not hide unresolved or rejected services',()=>{
    for(const built of [{failures:['NO_MATCH']},{unresolvedServices:['Fizička pomoć']},{clarifications:[{ambiguityPrompt:'Da li nosite stvari?'}]}]) {
      const result=guard(need(),built,{catalogVersion:3,proposals:[{}],anchors:[]});
      assert.notEqual(result.dialogue.next,'REVIEW');
      assert.equal(result.proposals,facts);
    }
  });
  await t.test('complete plan and safety holds remain unchanged',()=>{
    const source=need();
    assert.equal(guard(source,{clarifications:[],failures:[],unresolvedServices:[]},{proposals:[{}]}),source);
    for(const safety of ['REVIEW','BLOCK']) {
      const held={...source,safety};
      assert.equal(guard(held,null,null),held);
    }
  });
});
