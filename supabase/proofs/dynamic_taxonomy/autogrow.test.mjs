import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedWorkLabel,planAutomaticCategory} from './autogrow.mjs';
const catalog=[
 {id:'moler-1',label:'Molerski radovi',aliases:['Krečenje stana','Farbanje zidova'],status:'ESTABLISHED'},
 {id:'reno-1',label:'Adaptacija objekata',aliases:[],status:'ESTABLISHED'},
 {id:'clean-1',label:'Čišćenje',aliases:['Spremanje stanova'],status:'ESTABLISHED'},
];
const decide=(label,extra={})=>planAutomaticCategory({label,ownerReviewed:true,catalogVersion:'cat-v8',catalog,...extra});
test('same work in latin, sans accents, and Cyrillic reuses the same real category',()=>{
 for(const label of ['Krečenje stana','Krecenje stana','Кречење стана']){
  const p=decide(label);assert.equal(p.action,'REUSE_EXISTING');assert.equal(p.categoryId,'moler-1');
  assert.equal(p.notificationAuthority,'NONE');
 }
 assert.equal(normalizedWorkLabel('Фарбање зидова'),'farbanje zidova');
});
test('unseen legitimate kind creates provisional searchable catalog entry, not forced into eleven kinds',()=>{
 const p=decide('Servis baterija električnog bicikla');
 assert.equal(p.action,'CREATE_AUTO_PROVISIONAL');
 assert.equal(p.parentId,null);assert.equal(p.status,'AUTO_PROVISIONAL');
 assert.equal(p.searchableImmediately,true);assert.equal(p.workerSkillInferred,false);
 assert.equal(p.notificationAuthority,'NONE');
 assert.equal(p.dedupeKey,'category:v1:root:servis baterija elektricnog bicikla');
});
test('two concurrent novel spellings target the same unique dedupe key',()=>{
 const a=decide('Podešavanje 3D štampača');
 const b=decide('  Podesavanje   3D   stampaca  ');
 assert.equal(a.action,'CREATE_AUTO_PROVISIONAL');
 assert.equal(a.dedupeKey,b.dedupeKey);
 // A real DB UNIQUE/UPSERT still has to enforce the concurrency guarantee.
});
test('provisional parent may be set only by confirmed catalog relation',()=>{
 const label='Montaža pametne brave';
 const guessed=decide(label,{parentHint:{id:'reno-1',relation:'AI_GUESSED'}});
 const proven=decide(label,{parentHint:{id:'reno-1',relation:'CATALOG_CONFIRMED_PARENT'}});
 const fake=decide(label,{parentHint:{id:'invented',relation:'CATALOG_CONFIRMED_PARENT'}});
 assert.equal(guessed.parentId,null);assert.equal(fake.parentId,null);
 assert.equal(proven.parentId,'reno-1');
 assert.notEqual(proven.dedupeKey,guessed.dedupeKey);
});
test('alias collisions do not arbitrarily select a worker category',()=>{
 const conflict=[...catalog,{id:'unrelated-2',label:'Elektronika',aliases:['Krečenje stana']}];
 const p=decide('Krečenje stana',{catalog:conflict});
 assert.equal(p.action,'CLARIFY');assert.equal(p.reason,'AMBIGUOUS_ALIAS_COLLISION');
});
test('bad or unclear AI output never pollutes catalog',()=>{
 for(const label of ['', 'xx','Drugo','Ostalo','Razno','<script>alert(1)</script>','x'.repeat(121)]){
  const p=decide(label);assert.equal(p.action,'CLARIFY',label);
 }
});
test('AI cannot register before owner-reviewed publish or with an untrusted missing catalog',()=>{
 assert.equal(decide('Servis solarnih invertora',{ownerReviewed:false}).reason,'PUBLISH_REVIEW_REQUIRED');
 assert.equal(decide('Servis solarnih invertora',{catalog:null}).reason,'CATALOG_SNAPSHOT_UNAVAILABLE');
});
test('an existing category identity alone does not authorize any push',()=>{
 const p=decide('Krečenje stana');
 assert.equal(p.action,'REUSE_EXISTING');assert.equal(p.notificationAuthority,'NONE');
 const fresh=decide('Ugradnja automatskog zalivanja');
 assert.equal(fresh.notificationAuthority,'NONE');
});
