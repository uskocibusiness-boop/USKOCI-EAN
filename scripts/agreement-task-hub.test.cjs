'use strict';
// Owner's Dogovor design (22.11.2026): one card and one screen per task, with the people agreed on it.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHarness}=require('./ux-component-harness.cjs');
const model=createHarness().load('src/ui/agreements/agreementTaskModel.ts');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const has=(text,snippet,message)=>assert.ok(text.includes(snippet),message??snippet);
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

test('the task screen: back and four premium 3D icons on top (handshake, blue paper plane, chat, notepad for edits); overview below', () => {
  const hub=read('src/ui/agreements/AgreementTaskHub.tsx');
  const tabs=read('src/ui/agreements/TaskTabs.tsx'), page=read('src/ui/v2/NeedPresentation.tsx'), route=read('src/app/(app)/potrebe/[id]/pregled.tsx');
  has(tabs,"<Tab label=\"Pregled zadatka\" short=\"Pregled\" art=\"tasks\"",'Pregled is the first part (approved canvas, 25.11.2026)');
  has(tabs,"short={owner ? `Dogovoreni${agreed ? ` ${agreed}` : ''}` : 'Dogovor'} art=\"agreements\"",'Dogovoreni says how many');
  has(tabs,"{owner ? <Tab label=\"Prijave\" short={`Prijave${applications ? ` ${applications}` : ''}`} art=\"applications\"",'Prijave only for the task owner, with the blue paper plane and the count');
  has(tabs,"<Tab label=\"Poruke\" short=\"Poruke\" art=\"chat\"",'one Poruke part');
  has(tabs,'{short}</T>','every icon says what it opens (owner-approved look, 25.11.2026)');
  has(hub,"<TaskTabs owner={owner}",'the task screen of a Dogovor wears the shared row');
  has(page,"<TaskTabs owner selected=\"overview\"",'the published task of the owner wears the same row (owner, 25.11.2026)');
  has(route,"params: { needId: id, role: 'narucilac', title: potreba.naslov, pane: tab }",'its parts open the task screen of the Dogovor');
  has(hub,"router.replace({ pathname: '/potrebe/[id]/pregled', params: { id: needId } })",'Pregled of the owner is the task page');
  has(hub,"<ChromeIconButton glyph=\"edit\" label=\"Uredite zadatak\"",'the pencil sits beside the task title');
  has(hub,"if (!hasGroup && live.length === 1) openAgreement(live[0].agreementId, 'poruke');",'one person: that conversation opens at once');
  has(hub,"Grupni razgovor</T>",'several people: the group on top of the list');
  has(hub,"<GroupConversationScreen agreementId={anchor.id} embedded />",'the group conversation is on the same screen');
  has(hub,"<T variant=\"label\" tone=\"muted\">Opis</T>"); has(hub,"Približno mesto, oko 200 m.");
  has(hub,"<T variant=\"bodyStrong\">{owner ? 'Dogovoreno sa' : 'Objavio zadatak'}</T>");
  has(hub,"Privatna poruka: "); has(hub,"label: owner ? 'Uklonite iz Dogovora' : 'Otkažite Dogovor'",'remove sits in the person menu (owner, 25.11.2026)'); has(hub,"action: 'problem'",'problem report opens its own clean page');
  has(hub,"<PublicProfileSheet state={profile}",'avatar opens profile and reviews in a sheet');
  has(hub,'people = summary ? (owner ? summary.people : summary.owner ? [summary.owner] : [])','a worker sees only the task owner');
});

test('the Dogovori list opens the task screen for a task with a known source', () => {
  const route=read('src/app/(app)/dogovori.tsx');
  has(route,"pathname: '/dogovor/zadatak', params: { needId, role, title: first.naslov, id: first.id }");
  has(route,"if (!needId || (role !== 'narucilac' && role !== 'uskocer')) { open(first); return; }");
  assert.ok(fs.existsSync(path.join(__dirname,'..','src/app/dogovor/zadatak.tsx')));
});

test('Prijave: swipe right opens the existing selection review, swipe left declines after a confirmation', () => {
  const card=read('src/ui/agreements/ApplicationSwipeCard.tsx'), hub=read('src/ui/agreements/AgreementTaskHub.tsx');
  has(card,"if (direction === 'left') onAccept(); else setConfirming(true);");
  has(card,'Odbijte prijavu osobe'); has(card,"accessibilityActions={[{ name: 'accept'",'swiping is never the only way');
  has(hub,"pathname: '/potrebe/[id]/kandidati', params: { id: needId, prijavaId: c.prijavaId }");
  has(card,'onPress={onAvatar}','the applicant avatar opens the profile');
  has(hub,"const OPEN_APPLICATION = new Set(['SELECTABLE', 'STALE', 'OVERFILL'])");
  has(hub,"declineIds.current.get(c.prijavaId) ?? noviZahtevId('odbijanje')",'a retry reuses the same request id');
  const svc=read('src/data/applicationDeclineClientService.ts');
  has(svc,"rpc('rpc_decline_response'"); has(svc,"receipt.status !== 'NOT_SELECTED'");
  const sql=read('supabase/migrations/20261122162908_decline_response_for_task_owner.sql');
  has(sql,"if n.requester_account_id <> u then raise exception using errcode='42501', message='NOT_REQUESTER'");
  has(sql,"'RESPONSE_NOT_SELECTED'");
});

test('completion per person: the card offers the next step and opens the existing review of that Dogovor', () => {
  const hub=read('src/ui/agreements/AgreementTaskHub.tsx'), page=read('src/app/dogovor/[id].tsx');
  has(hub,"canConfirm ? <V2Action tone=\"brand\" label=\"Potvrdite završetak\" onPress={onComplete} style={s.flex} />");
  has(hub,"canReport ? <V2Action tone=\"brand\" label=\"Zadatak je gotov\" onPress={onComplete} style={s.flex} />");
  has(hub,'label="Ocenite saradnju" onPress={onRate}');
  has(hub,'Ako ne odgovorite, završetak se sam potvrđuje: {autoConfirm}.','the 48 h automatic confirmation is said where the decision is');
  has(hub,"params: { id: person.agreementId, action: 'complete' }");
  has(hub,"item.radnje ? item.radnje.mozePotvrditiZavrsetak && item.stanje === 'AWAITING_REQUESTER'",'the server\'s allowed actions decide');
  has(page,"requestedCompletion={action === 'complete' && tab !== 'poruke'}");
  has(page,"if (!completionAsked.current || !canComplete || !formCurrent()) return;",'the review opens only when this screen would allow it');
  assert.ok(page.indexOf('useEffect(() => { requestedCompletionStep.current(); });') < page.indexOf("if (!foreground || (resumeRequired && !keepsContent)) return"),'the hook stays before the early returns');
});
