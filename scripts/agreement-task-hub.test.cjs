'use strict';
// Owner's Dogovor design (22.11.2026): one card and one screen per task, with the people agreed on it.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness}=require('./ux-component-harness.cjs');
const model=createHarness().load('src/ui/agreements/agreementTaskModel.ts');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const party=(id,uloga,viSte,ime)=>({id,profilId:null,ime,inicijali:ime.slice(0,2).toUpperCase(),uloga,mesta:1,viSte,telefon:null});
const row=(id,patch={})=>({id,naslov:'Selidba stana',stanje:'CONFIRMED',rezim:'FIZICKI',izvor:{zadatakId:'task-1',prijavaId:null},verzija:1,
 ucesnici:[party('me','narucilac',true,'Vlasnik'),party('w-'+id,'uskocer',false,'Radnik '+id)],putanjaTekst:'Liman · Novi Sad',vremeTekst:'28. novembar u 10:00',
 cena:{prikaz:'1.200 RSD'},osnovaCene:'HOURLY',pokrivenost:{ukupno:3,popunjeno:1,preostalo:2,udeo:0.33},ocenaMoguca:false,izmenaCeka:null,
 prihvacenObim:'Nošenje nameštaja.',problemOtvoren:false,...patch});

test('owner card: one price format, place, term and "2 od 3 osobe" with the chosen people', () => {
  const s=model.agreementTaskSummary({key:'k',items:[row('a'),row('b'),row('c',{stanje:'CANCELLED'})]});
  assert.equal(s.myRole,'narucilac'); assert.equal(s.priceText,'1.200 RSD/sat po osobi');
  assert.equal(s.placeText,'Liman · Novi Sad'); assert.equal(s.whenText,'28. novembar u 10:00');
  assert.equal(model.fillText(s),'2 od 3 osobe'); assert.deepEqual(s.people.map(p=>p.name),['Radnik a','Radnik b']);
  assert.equal(s.description,'Nošenje nameštaja.');
});

test('worker card: the task owner on one side, me on the other, never other workers', () => {
  const mine=row('x',{ucesnici:[party('owner','narucilac',false,'Vlasnik Zadatka'),party('me','uskocer',true,'Ja')]});
  const s=model.agreementTaskSummary({key:'k',items:[mine]});
  assert.equal(s.myRole,'uskocer'); assert.equal(s.owner?.name,'Vlasnik Zadatka'); assert.equal(s.me?.ime,'Ja');
  assert.ok(s.people.every(p=>p.role==='narucilac'));
});

test('remote task and different prices are said plainly', () => {
  const s=model.agreementTaskSummary({key:'k',items:[row('a',{rezim:'DALJINSKI'}),row('b',{cena:{prikaz:'1.500 RSD'}})]});
  assert.equal(s.placeText,'Na daljinu'); assert.equal(s.remote,true); assert.equal(s.priceText,'Različite cene po osobi');
});

test('the task screen: four icons with the blue paper plane for Prijave, owner-only Prijave and editing', () => {
  const hub=read('src/ui/agreements/AgreementTaskHub.tsx');
  assert.match(hub,/key: 'applications' as const, label: 'Prijave', art: 'applications' as const/);
  assert.match(hub,/\.\.\.\(owner \? \[\{ key: 'applications'/); assert.match(hub,/\.\.\.\(owner \? \[\{ key: 'edit'/);
  assert.match(hub,/key: 'group' as const, label: 'Grupa', glyph: 'messages'/);
  assert.match(hub,/Pošaljite privatnu poruku/); assert.match(hub,/onRemove=\{owner \?/);
  assert.match(hub,/people = summary \? \(owner \? summary\.people : summary\.owner \? \[summary\.owner\] : \[\]\)/,'a worker sees only the task owner');
});

test('the Dogovori list opens the task screen for a task with a known source', () => {
  const route=read('src/app/(app)/dogovori.tsx');
  assert.match(route,/pathname: '\/dogovor\/zadatak', params: \{ needId, role, title: first\.naslov, id: first\.id \}/);
  assert.match(route,/if \(!needId \|\| \(role !== 'narucilac' && role !== 'uskocer'\)\) \{ open\(first\); return; \}/);
  assert.ok(fs.existsSync(path.join(__dirname,'..','src/app/dogovor/zadatak.tsx')));
});
