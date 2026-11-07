'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {ROOT,React,createHarness,mount,nodes,unmount}=require('./ux-component-harness.cjs');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
function literals(file){const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),values=[];function visit(n){if(ts.isStringLiteralLike(n)||ts.isJsxText(n)||ts.isTemplateSpan(n))values.push(n.text??n.literal?.text??'');ts.forEachChild(n,visit)}visit(ast);return values.join('\n');}
test('UX05 old archive address replaces navigation with existing previous collaborations only',async()=>{const h=createHarness({'expo-router':{Redirect:p=>React.createElement('Redirect',p)}}),C=h.load('src/app/(app)/arhiva.tsx').default,r=await mount(C,{});assert.deepEqual(nodes(r,n=>n.type==='Redirect')[0].props.href,{pathname:'/dogovori',params:{odeljak:'istorija'}});assert.equal(read('src/app/(app)/arhiva.tsx').match(/from /g).length,1);await unmount(r);});
test('UX05 planner links directly to the existing history context, not generic archive',()=>{const code=read('src/app/(app)/raspored.tsx');assert.match(code,/onPreviousAgreements=\{\(\) => router\.navigate\(\{ pathname: '\/dogovori', params: \{ odeljak: 'istorija' \} \}\)\}/);assert.doesNotMatch(code,/['"]\/arhiva['"]/);});
test('UX05 planner presents previous collaborations and retains independent availability entry',()=>{const source=read('src/ui/calendar/AgendaScreen.tsx');assert.match(source,/title="Prethodne saradnje"/);assert.match(source,/onPress=\{onPreviousAgreements\}/);assert.match(source,/onPress=\{onAvailability\}/);assert.doesNotMatch(source,/onArchive|title="Arhiva"/);});
test('UX07 numeric filter describes stated price without changing the MY_PRICE business value',()=>{const code=read('src/ui/v2/discovery/DiscoverySearchPanel.tsx');assert.match(code,/Sa navedenom cenom/);assert.match(code,/Najmanja navedena cena u dinarima/);assert.match(code,/MY_PRICE/);assert.doesNotMatch(literals('src/ui/v2/discovery/DiscoverySearchPanel.tsx'),/Fiksna cena|Najmanja fiksna cena/);});
test('UX08 the two work-profile entrances name the same broad service profile',()=>{assert.match(literals('src/ui/home/HomePresentation.tsx'),/Podesite radni profil/);assert.match(literals('src/ui/profile/ProfileHubPresentation.tsx'),/Radni profil/);for(const p of ['src/ui/home/HomePresentation.tsx','src/ui/profile/ProfileHubPresentation.tsx','src/ui/workerProfile/WorkerProfilePresentation.tsx'])assert.doesNotMatch(literals(p),/profil majstora|[Pp]rofil za uskakanje/);});
test('UX08 reviewed auth, application and support commands use formal address',()=>{const paths=['src/app/auth.tsx','src/ui/v2/ApplicationComposerPresentation.tsx',...fs.readdirSync(path.join(ROOT,'src/ui/support')).filter(p=>p.endsWith('.tsx')).map(p=>'src/ui/support/'+p)];for(const p of paths){const text=literals(p);assert.doesNotMatch(text,/Poslali smo ti kod|Ako te izaberu|a ti još nemaš|zahtev povežeš|Tvoji Dogovori/);assert.doesNotMatch(text,/(?:^|\n)(?:Pošalji|Sačuvaj|Pokušaj ponovo|Proveri|Unesi|Otvori|Nastavi|Izaberi)(?:\s|\n|$)/);}});
test('owner applicant instruction: person count is supplied by the applicant, not an invented team',()=>{
 const composer=literals('src/ui/v2/ApplicationComposerPresentation.tsx');
 const people=read('src/ui/v2/ApplicationPeopleInput.tsx');
 const route=read('src/app/(app)/prilike/[id]/prijava.tsx');
 assert.match(composer,/Koliko ljudi obezbeđujete/);
 assert.match(composer,/Uključite i sebe ako dolazite/);
 assert.match(people,/Broj ljudi koje obezbeđujete/);
 assert.match(route,/pokrivenaMesta: Number\(draft.people\)/);
 assert.match(route,/people > data\.need\.pokrivenost\.preostalo/);
});
