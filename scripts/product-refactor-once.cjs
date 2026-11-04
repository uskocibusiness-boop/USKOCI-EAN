'use strict';
// Temporary, bounded migration. Removed by the acceptance workflow after success.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const ts=require('typescript');
const root=process.cwd();
const out=path.join(process.env.RUNNER_TEMP,'uskoci-refactor');fs.mkdirSync(out,{recursive:true});
const moves={
 'src/ui/aiFirst/aiDownLine.ts':'src/features/ai/intake/aiDownLine.ts',
 'src/ui/aiFirst/aiInterviewWelcome.ts':'src/features/ai/intake/aiInterviewWelcome.ts',
 'src/ui/aiFirst/intakeReviewReadiness.ts':'src/features/ai/intake/intakeReviewReadiness.ts',
 'src/ui/aiFirst/__tests__/aiDownLine.test.ts':'tests/ai/__tests__/aiDownLine.test.ts',
 'src/ui/aiFirst/__tests__/aiInterviewWelcome.test.ts':'tests/ai/__tests__/aiInterviewWelcome.test.ts',
};
const expected={
 'src/app/(app)/nova.tsx':'996a6aaab1a9eeec8bf9558ec6b883dd1cd5c38e8d10a6f2ed539e0c8e63016c',
 'src/app/(app)/pregled-zadatka.tsx':'325d06e0f6f55fc176c895e3b032368001b382e06db0f280517b7bce81d3cb87',
 'src/app/(app)/profil/razgovor.tsx':'53ad55112c99bb7c1c981d14f5735037dd18ef221b0beca83994e47791fae98c',
 'src/designLab/dizajn-ai.tsx':'aac7c51f1f8e07d813e2c7650d80e34ea930f75cf82699ad796607a8ac720d6d',
 'src/features/ai/intake/aiDownLine.ts':'cffae393a7bd8e93a1953de8d661568147fd3349ea985ef88c5c3496ab6fe02a',
 'src/features/ai/intake/aiInterviewWelcome.ts':'8fe71269ea4d6a3fde799a61ebd3db20bc615da95437188ab8641de90436b251',
 'src/features/ai/intake/intakeReviewReadiness.ts':'3ce3569f43914144dca7d23c6bfb431e9d00ec3ad0b0915603648dc1330a2c8e',
 'src/ui/v2/IntakePresentation.tsx':'d2f0cc98cd1f0e6542cf6780d5b08270b5ef2bb2a796985351628cd3f17939e5',
 'src/ui/workerProfile/WorkerAiPresentation.tsx':'f1961142a38e37029ac9d82903b0d8077835d3cd8b0b3ee1d34b7e9d1f8a73c9',
 'supabase/proofs/dynamic_taxonomy/worker-interview-question-policy.test.mjs':'90787a5ab1a6881fdfc44d88b66a6527dec7cda2b33d4f6119199bee538ba917',
 'tests/ai/__tests__/aiDownLine.test.ts':'edc479aac18985822ff48ed68bae6cecdf596fc28d0121673dd7d16297eb6d77',
 'tests/ai/__tests__/aiInterviewWelcome.test.ts':'91ebbb13aaaaf73447f0f2b63ba28e8424277b75e70345722b62b7f9f5adaa2e',
};
const all=cp.execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean);
const known=new Set(all),changes=[],edits=[];
function target(from,spec){
 if(!spec.startsWith('.'))return null;
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
 for(const suffix of ['', '.ts','.tsx','.js','.mjs','.cjs','.json','.sql'])if(known.has(base+suffix))return base+suffix;
 return null;
}
for(const file of all){
 if(!/\.[cm]?[jt]sx?$/.test(file))continue;
 const oldText=fs.readFileSync(file,'utf8'),newFile=moves[file]||file;
 const sf=ts.createSourceFile(file,oldText,ts.ScriptTarget.Latest,true),patches=[];
 function literal(node,kind){
  if(!node||!ts.isStringLiteralLike(node))return;
  const oldTarget=target(file,node.text);if(!oldTarget)return;
  const newTarget=moves[oldTarget]||oldTarget;
  if(newTarget===oldTarget&&newFile===file)return;
  let dest=newTarget;
  if(!/\.(?:[cm]?[jt]sx?|json|sql|md)$/.test(node.text))dest=dest.replace(/\.(?:[cm]?[jt]sx?)$/,'');
  let spec=path.posix.relative(path.posix.dirname(newFile),dest);if(!spec.startsWith('.'))spec='./'+spec;
  if(spec===node.text)return;
  const start=node.getStart(sf)+1,end=node.getEnd()-1;
  patches.push({start,end,value:spec});
  edits.push({file,newFile,kind,oldSpecifier:node.text,newSpecifier:spec,oldTarget,newTarget});
 }
 function visit(n){
  if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))literal(n.moduleSpecifier,'module');
  if(ts.isCallExpression(n)){
   const e=n.expression.getText(sf);
   if(e==='require'||e==='import'||/^jest\.(mock|doMock|requireActual|requireMock)$/.test(e))literal(n.arguments[0],'module');
   if(['resolve','join','path.resolve','path.join'].includes(e)&&n.arguments[0]?.getText(sf)==='__dirname'&&n.arguments.length===2)literal(n.arguments[1],'source_read');
  }
  if(ts.isNewExpression(n)&&n.expression.getText(sf)==='URL'&&n.arguments?.[1]?.getText(sf)==='import.meta.url')literal(n.arguments[0],'source_url');
  ts.forEachChild(n,visit);
 }
 visit(sf);let next=oldText;
 for(const p of patches.sort((a,b)=>b.start-a.start))next=next.slice(0,p.start)+p.value+next.slice(p.end);
 if(patches.length||newFile!==file)changes.push({file,newFile,next});
}
if(edits.length!==21||changes.length!==12)throw Error('UNEXPECTED_RELOCATION_SCOPE');
for(const [old,dest]of Object.entries(moves))if(!fs.existsSync(old)||fs.existsSync(dest))throw Error('PREIMAGE_MISMATCH '+old);
for(const c of changes){
 if(crypto.createHash('sha256').update(c.next).digest('hex')!==expected[c.newFile])throw Error('POSTIMAGE_MISMATCH '+c.newFile);
}
for(const c of changes){fs.mkdirSync(path.dirname(c.newFile),{recursive:true});fs.writeFileSync(c.newFile,c.next);}
for(const old of Object.keys(moves))fs.unlinkSync(old);
cp.execFileSync('git',['add','--',...new Set(changes.flatMap(c=>[c.file,c.newFile]))]);
fs.writeFileSync(path.join(out,'relocation.json'),JSON.stringify({moves,edits,expectedPostimageSha256:expected,runtimeLogicChanged:false},null,2)+'\n');
console.log('Exact 5-file relocation and 21 references verified against local postimages.');
