'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),source=p=>fs.readFileSync(path.join(root,p),'utf8');
const moduleUrl=pathToFileURL(path.join(root,'src/data/aiRoleHandoff.mjs')).href,load=()=>import(moduleUrl);
test('Need to Worker handoff preserves exact user-authored draft once',async()=>{
 const {stageRoleHandoffText,takeRoleHandoffText}=await load(),text='Mogu da pomognem oko selidbe.\nImam kombi i slobodan sam u subotu.';
 const token=stageRoleHandoffText('WORKER',text);assert.equal(typeof token,'string');assert.equal(takeRoleHandoffText('WORKER',token),text);assert.equal(takeRoleHandoffText('WORKER',token),null);
});
test('Worker to Need handoff is symmetrical and wrong destination cannot consume it',async()=>{
 const {stageRoleHandoffText,takeRoleHandoffText}=await load(),text='Potreban mi je prevoz nameštaja u petak.',token=stageRoleHandoffText('NEED',text);
 assert.equal(takeRoleHandoffText('WORKER',token),null);assert.equal(takeRoleHandoffText('NEED',token),text);assert.equal(takeRoleHandoffText('NEED',token),null);
});
test('handoff expires, rejects blank or oversized drafts, and newer handoff replaces older one',async()=>{
 const {stageRoleHandoffText,takeRoleHandoffText,ROLE_HANDOFF_TTL_MS,ROLE_HANDOFF_MAX_CHARS}=await load(),original=Date.now;let now=1000;
 try{Date.now=()=>now;const token=stageRoleHandoffText('WORKER','tekst');now+=ROLE_HANDOFF_TTL_MS+1;assert.equal(takeRoleHandoffText('WORKER',token),null);}finally{Date.now=original;}
 assert.equal(stageRoleHandoffText('WORKER','   '),null);assert.equal(stageRoleHandoffText('WORKER','x'.repeat(ROLE_HANDOFF_MAX_CHARS+1)),null);
 const old=stageRoleHandoffText('WORKER','stari'),next=stageRoleHandoffText('NEED','novi');assert.equal(takeRoleHandoffText('WORKER',old),null);assert.equal(takeRoleHandoffText('NEED',next),'novi');
});
test('handoff can be cleared and stores only a short-lived in-memory text envelope',async()=>{
 const {stageRoleHandoffText,takeRoleHandoffText,clearRoleHandoffText}=await load(),token=stageRoleHandoffText('NEED','samo tekst');
 clearRoleHandoffText(token);assert.equal(takeRoleHandoffText('NEED',token),null);
 const s=source('src/data/aiRoleHandoff.mjs');assert.match(s,/pending=\{targetRole,text,token,expiresAt\}/);assert.doesNotMatch(s,/supabase|fetch\(|AsyncStorage|SecureStore|localStorage/i);
});
test('both role switches stage only user text into an editable draft; neither sends or activates anything',()=>{
 const need=source('src/app/(app)/nova.tsx'),worker=source('src/app/(app)/profil/razgovor.tsx'),intake=source('src/ui/v2/IntakePresentation.tsx');
 assert.match(need,/stageRoleHandoffText\('WORKER', body\)/);assert.match(need,/stageRoleHandoffText\('WORKER', transferText\)/);
 assert.match(need,/takeRoleHandoffText\('NEED', handoffToken\)/);assert.match(need,/find\(message => !message\.fromAi\)\?\.body/);
 assert.match(worker,/stageRoleHandoffText\('NEED',transferText\)/);assert.match(worker,/takeRoleHandoffText\('WORKER',handoffToken\)/);
 assert.match(worker,/find\(message=>message\.role==='USER'\)\?\.body/);
 assert.match(intake,/Prenosi se samo Vaš tekst kao nacrt/);assert.match(worker,/Prenosi se samo Vaš tekst kao nacrt/);
 const nc=need.slice(need.indexOf("const transferred = takeRoleHandoffText('NEED'"),need.indexOf('}, [handoffToken, resumeId]);'));
 const wc=worker.slice(worker.indexOf("const transferred=takeRoleHandoffText('WORKER'"),worker.indexOf('},[handoffToken,initialId]);'));
 assert.match(nc,/setUnos\(transferred\)/);assert.match(wc,/setInput\(transferred\)/);assert.doesNotMatch(nc+wc,/submitTurn|api\.send|void send\(/);
});
