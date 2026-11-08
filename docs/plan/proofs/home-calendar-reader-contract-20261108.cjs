'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require(path.join(process.cwd(),'scripts/ux-component-harness.cjs'));
const h=createHarness();
const {composeHome}=h.load('src/data/homeSnapshot.ts');
const {buildPlanner}=h.load('src/ui/calendar/planner.ts');
const now=Date.parse('2026-11-08T10:00:00Z');
const from='2026-11-01T00:00:00Z',to='2026-12-01T00:00:00Z';
const start='2026-11-09T10:00:00Z',end='2026-11-09T11:00:00Z';
const row=(id,extra={})=>({id,verzija:1,naslov:'Zadatak '+id,stanje:'CONFIRMED',vremeTekst:'Termin još nije dogovoren',
 ucesnici:[{id:'me',viSte:true,uloga:'narucilac',ime:'Vlasnik'},{id:'other',viSte:false,uloga:'uskocer',ime:'Saradnik'}],
 cena:{iznos:1000,valuta:'RSD',prikaz:'1.000 RSD'},osnovaCene:'TOTAL',rezim:'FIZICKI',putanjaTekst:'Novi Sad',
 tacanTermin:null,prihvacenPocetak:null,izmenaCeka:null,ocenaMoguca:false,stanjeProvereOcene:'NOT_DUE',...extra});
const home=(agreements,attention)=>composeHome({needs:{kind:'known',value:[]},applications:{kind:'known',value:[]},agreements:{kind:'known',value:agreements}},attention,now,'Europe/Belgrade');
const first20=Array.from({length:20},(_,i)=>row('attention-'+i,{izmenaCeka:{predlogId:'proposal-'+i,mojPredlog:false}}));
const nearest=row('nearest',{tacanTermin:{pocetak:start,kraj:end},prihvacenPocetak:start,vremeTekst:'Sutra u 11'});
const full=home([...first20,nearest]),cut=home(first20);
assert.equal(full.agreements.value.rows[0].target.agreementId,'nearest');
assert.notEqual(cut.agreements.value.rows[0]?.target.agreementId,'nearest');
assert.ok(full.agreements.value.rows[0].raspored);assert.equal(cut.agreements.value.rows[0]?.raspored,undefined);
const completed=row('completed',{stanje:'COMPLETED',tacanTermin:{pocetak:start,kraj:end},prihvacenPocetak:start});
assert.equal(home([completed]).firstRun,false);assert.equal(home([]).firstRun,true);
const due=row('due',{stanje:'COMPLETED',ocenaMoguca:true,stanjeProvereOcene:'DUE'});
const unavailableAttention={kind:'unavailable'};
assert.equal(home([due],unavailableAttention).ratingsDue,1);assert.equal(home([],unavailableAttention).ratingsDue,0);
const before=buildPlanner({events:[],agreements:[completed],from,to,now:new Date(now)});
const activeOnly=buildPlanner({events:[],agreements:[],from,to,now:new Date(now)});
assert.equal(before.placed.length,1);assert.equal(before.placed[0].done,true);assert.equal(activeOnly.placed.length,0);
console.log(JSON.stringify({
 source:'actual composeHome and buildPlanner loaded from native-flows worktree; synthetic account projections; no API/native/SQL execution',
 cases:[
  {name:'first 20 attention groups omit nearest accepted appointment',complete:{nearest:full.agreements.value.rows[0].target.agreementId,totalActive:full.agreements.value.more+1},firstPage:{nearestVisible:false,totalActive:cut.agreements.value.more+1}},
  {name:'history-only account loses hasAny',complete:{firstRun:home([completed]).firstRun},emptyActive:{firstRun:home([]).firstRun}},
  {name:'old ACTIVE scope omits completed rating due when aggregate unavailable',complete:{ratingsDue:home([due],unavailableAttention).ratingsDue},activeOnly:{ratingsDue:home([],unavailableAttention).ratingsDue}},
  {name:'calendar ACTIVE-only omits completed agreed event inside selected month',complete:{placed:before.placed.length},activeOnly:{placed:activeOnly.placed.length}}
 ],passed:4,failed:0
},null,2));
