'use strict';
// One bounded documentation checkpoint after this UX source passes the QA job.
// No dependency install, deploy, secret management, business write or force push.
// The connector cannot replace the >1 MB master as a mounted file. This separate
// job edits only that existing master and one proof, with exact preimage/source pins.
const fs=require('node:fs'),crypto=require('node:crypto');
const REPO='uskocibusiness-boop/USKOCI-EAN',BRANCH='work/uskoci-cist-proizvod-20261104';
const PLAN='docs/plan/CODEX_PLAN_RADA.md',PROOF='docs/plan/proofs/ux-fixes-20261107.json';
const CI_PROOF='docs/plan/proofs/ux-fixes-ci-20261107.json';
const MARKER='<!-- USKOCI_UX_QA48_FOLLOWUP_20261107 -->';
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const gitBlob=b=>crypto.createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
function insertCheckpoint(original,body){
 if(!original.startsWith('# USKOČI — ')||original.includes(MARKER))throw Error('CHECKPOINT_MASTER_SHAPE');
 const at=original.indexOf('\n');if(at<0)throw Error('CHECKPOINT_MASTER_SHAPE');
 return original.slice(0,at+1)+'\n'+MARKER+'\n'+body.trim()+'\n\n'+original.slice(at+1).replace(/^\n/,'');
}
function positive(raw,label){if(!/^\d+$/.test(raw??'')||!Number.isSafeInteger(Number(raw))||Number(raw)<1)throw Error('CHECKPOINT_'+label);return Number(raw);}
function buildCheckpoint(proof,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_REF!==`refs/heads/${BRANCH}`||!['push','workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)
   ||! /^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''))throw Error('CHECKPOINT_CONTEXT');
 if(proof.schema!=='USKOCI_UX_IMPLEMENTATION_20261107'||proof.sourceBase!=='f9e13ed5020a786ba6e0963dfd5de87eba3e3245'
   ||proof.expectedPlanBlob!=='8850410ea6b41eb024955acf1153bb8c031f536f')throw Error('CHECKPOINT_PROOF_CONTEXT');
 const tests=positive(env.UX_CI_TESTS,'TESTS'),run=positive(env.GITHUB_RUN_ID,'RUN'),number=positive(env.GITHUB_RUN_NUMBER,'NUMBER'),artifact=positive(env.UX_APK_ARTIFACT,'ARTIFACT');
 if(tests<proof.minimumExpectedActiveTests)throw Error('CHECKPOINT_TEST_COUNT');
 const receipt={schema:'USKOCI_UX_CI_CHECKPOINT_V1',source:env.GITHUB_SHA,run,number,artifact,tests,typescript:'PASS',migrationIntegrity:'PASS',androidBuild:'PASS',native:false,
   independentlyDownloadedApk:false,devDeploy:false,paidAiCalls:0,proof:PROOF,sourceBase:proof.sourceBase};
 const url=`https://github.com/${REPO}/actions/runs/${run}`;
 const body=`## Aktuelni izvršni checkpoint — 07.11.2026: popravke posle UX pregleda QA48\n\n`+
 `Nastavljeno na istoj grani od \`${proof.sourceBase}\`, bez resetovanja. Product/UX master i zaključane odluke nisu menjani. Stvarni subagenti nisu bili dostupni; rad je izvršen sekvencijalno.\n\n`+
 `**Source:** \`${env.GITHUB_SHA}\`. **QA${number}:** [run ${run}](${url}), **${tests}/${tests} aktivnih testova PASS**, TypeScript i migracioni integritet PASS, Android build PASS. Artefakt: [uskoci-isolated-qa-apk-${number}](${url}/artifacts/${artifact}). Ovo je dokaz CI izgradnje i objavljenog artefakta, **ne instalacija, native E2E ili nezavisan pregled preuzetih APK bajtova**.\n\n`+
 `| Nalaz | Popravka i potvrda | Granica |\n| --- | --- | --- |\n`+
 proof.findings.map(f=>`| ${f.id} — ${f.status} | ${f.fix} | ${f.boundary} |`).join('\n')+
 `\n\n**Dokazi:** [izvršeni lokalni testovi i tačne datoteke](proofs/ux-fixes-20261107.json), [CI vezivanje](proofs/ux-fixes-ci-20261107.json). Novi testovi su u aktivnom npm test paketu. Raniji lokalni pokušaj šire regresije sa nedostajućim SDK/SQL paketima nije proglašen prolazom; pun paket je izvršen u ovom CI-u.\n\n`+
 `**DEV i granice:** u ovom UX krugu nema SQL migracije, Edge deploy-a, poslovnog upisa niti plaćenog AI poziva. Proveren je metadata digest postojećeg P6 čitača; preview/QA sada koristi taj već objavljeni čitač, dok je produkcioni flag ostao isključen. To nije novi ordinary-Auth ili native dokaz.\n\n`+
 `**Otvoreno:** UX03 potpun serverski spisak obaveza i dalje zahteva autorizovani paginirani reader; sadašnji panel iskreno označava neprikazane stavke. Opoziv legacy ključa, odobrena retention/export politika, AI budžet, pozitivni više-korisnički scenariji i native kamera/mikrofon/mapa/push ostaju otvoreni kao u prethodnom checkpoint-u. Beta i produkcija nisu odobrene.\n\n`+
 `**Sledeće:** nezavisno proveriti ovaj APK i ekran-po-ekran native prihvat. Za UX03 završiti bounded account-owned paginaciju bez promene poslovnih writer-a. Zatim nastaviti preostale P0/R07/R09/R10 kapije.\n\n---`;
 return {receipt,body};
}
function verifySource(proof,readFile=p=>fs.readFileSync(p)){
 for(const [p,hash]of Object.entries(proof.sourceFileSha256)){
  if(!/^(src|scripts|\.github|docs)\//.test(p)&&!['package.json','eas.json'].includes(p))throw Error('CHECKPOINT_SOURCE_PATH');
  if(p.split('/').includes('..')||sha256(readFile(p))!==hash)throw Error('CHECKPOINT_SOURCE_DIGEST');
 }
}
async function recordCheckpoint({env=process.env,readFile=p=>fs.readFileSync(p),api}){
 const proof=JSON.parse(readFile(PROOF).toString('utf8')),prepared=buildCheckpoint(proof,env);
 verifySource(proof,readFile);
 const ref=await api('GET',`/git/ref/heads/${BRANCH}`);
 if(ref.object?.sha!==env.GITHUB_SHA)return{status:'SKIPPED_BRANCH_MOVED'};
 const commit=await api('GET',`/git/commits/${env.GITHUB_SHA}`);
 const meta=await api('GET',`/contents/${PLAN}?ref=${env.GITHUB_SHA}`);
 if(meta.sha!==proof.expectedPlanBlob)return{status:'SKIPPED_MASTER_CHANGED'};
 const blob=await api('GET',`/git/blobs/${meta.sha}`);
 if(blob.encoding!=='base64'||typeof blob.content!=='string')throw Error('CHECKPOINT_BLOB_ENCODING');
 const bytes=Buffer.from(blob.content,'base64');
 if(bytes.length<1||bytes.length>5_000_000||gitBlob(bytes)!==proof.expectedPlanBlob)throw Error('CHECKPOINT_MASTER_DIGEST');
 const original=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const content=insertCheckpoint(original,prepared.body);
 const written=await api('POST','/git/blobs',{encoding:'utf-8',content});
 const tree=await api('POST','/git/trees',{base_tree:commit.tree.sha,tree:[{path:PLAN,mode:'100644',type:'blob',sha:written.sha},
  {path:CI_PROOF,mode:'100644',type:'blob',content:JSON.stringify(prepared.receipt,null,2)+'\n'}]});
 const saved=await api('POST','/git/commits',{message:`docs: record verified QA${prepared.receipt.number} UX checkpoint`,tree:tree.sha,parents:[env.GITHUB_SHA]});
 // An intervening source or documentation commit creates a non-fast-forward;
 // GitHub refuses it. Never retry with another parent or force the reference.
 await api('PATCH',`/git/refs/heads/${BRANCH}`,{sha:saved.sha,force:false});
 return{status:'SAVED',commit:saved.sha,source:env.GITHUB_SHA};
}
if(require.main===module && process.argv.includes('--verify-source')){
 verifySource(JSON.parse(fs.readFileSync(PROOF,'utf8')));console.log('UX source manifest matches exact tested files');
}else if(require.main===module){
 const token=process.env.GITHUB_TOKEN;if(!token)throw Error('CHECKPOINT_TOKEN_MISSING');
 const api=async(method,p,data)=>{const r=await fetch(`https://api.github.com/repos/${REPO}${p}`,{method,redirect:'error',signal:AbortSignal.timeout(30000),
  headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
  if(!r.ok)throw Error(`CHECKPOINT_GITHUB_${r.status}`);return r.json()};
 recordCheckpoint({api}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(String(error.message));process.exitCode=1});
}
module.exports={insertCheckpoint,buildCheckpoint,recordCheckpoint,gitBlob,verifySource};
