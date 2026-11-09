'use strict';
// Deterministic packaging only. Does not connect to DEV or apply SQL.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=__dirname,stem='worker_draft_activation_20261109';
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');
function render(snapshot,candidate,operationSource=JSON.stringify(snapshot)) {
const defs=candidate.match(/CREATE OR REPLACE FUNCTION[\s\S]*?AS \$function\$[\s\S]*?\$function\$/g);
if(defs?.length!==3)throw Error('Exactly three function definitions required');
const md5=x=>crypto.createHash('md5').update(x).digest('hex');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const body=d=>d.split('AS $function$')[1].split('$function$')[0];
const fnName=d=>d.match(/CREATE OR REPLACE FUNCTION ([^(]+)/)[1].replace(/^public\./,'');
const changed=new Map(defs.map(d=>[fnName(d),d]));
const metadata=f=>Object.fromEntries(Object.entries(f).filter(([k])=>k!=='definition'));
const before=snapshot.functions.map(metadata);
const after=before.map(f=>changed.has(f.signature.split('(')[0])?{...f,body_md5:md5(body(changed.get(f.signature.split('(')[0])))}:f);
for(const f of snapshot.functions)if(md5(body(f.definition))!==f.body_md5)throw Error('Capture digest mismatch '+f.signature);
const relationNames=snapshot.relations.map(r=>"'"+r.name+"'::regclass").join(',');
const observe=[
"select jsonb_build_object('relations',(select jsonb_agg(jsonb_build_object(",
"'name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,",
"'constraints',(select coalesce(jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname),'[]'::jsonb) from pg_constraint k where k.conrelid=c.oid),",
"'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'roles',p.polroles::text,'permissive',p.polpermissive,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid)) order by n.nspname,c.relname)",
"from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid=any(array["+relationNames+"])),",
"'closure',jsonb_build_object('storedSource',(select sha256 from private.closure_source_v5 where singleton),",
"'storedErasure',(select sha256 from private.closure_erasure_source_v5 where singleton),",
"'sourceDigest',private.closure_source_digest_v5(),'schemaDigest',private.closure_schema_digest_v5_139(),",
"'erasureDigest',private.closure_erasure_program_digest_v5(),",
"'sourceReady',(select sha256 from private.closure_source_v5 where singleton)=private.closure_source_digest_v5()))"
].join('\n');
function checks(functions,phase){
 const all=phase==='BEFORE';
 return [
 "for f in select value from jsonb_array_elements($expected$"+JSON.stringify(functions)+"$expected$::jsonb) loop",
 " select jsonb_build_object('signature',f->>'signature','oid',p.oid::bigint,'body_md5',md5(p.prosrc),'definer',p.prosecdef,'volatility',p.provolatile,",
 " 'is_strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'owner',pg_get_userbyid(p.proowner),",
 " 'acl',p.proacl::text,'config',p.proconfig,'arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),",
 " 'kind',p.prokind,'language',l.lanname,'cost',p.procost,'rows',p.prorows,'support',p.prosupport::text,'argument_defaults',pg_get_expr(p.proargdefaults,0))",
 " into actual from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(f->>'signature');",
 " if actual is distinct from f then raise exception 'WORKER_DRAFT_ACTIVATION_FUNCTION_DRIFT: %',f->>'signature' using errcode='55000'; end if;",
 "end loop;",
 observe+" into observed;",
 "expected:=$environment$"+JSON.stringify({relations:snapshot.relations,closure:all?snapshot.closure:snapshot.closurePostimage})+"$environment$::jsonb;",
 "if observed is distinct from expected then raise exception 'WORKER_DRAFT_ACTIVATION_"+(all?'PREIMAGE':'POSTIMAGE')+"_ENVIRONMENT_DRIFT' using errcode='55000'; end if;"
 ].join('\n');
}
const pre=checks(before,'BEFORE'),post=checks(after,'AFTER');
const block=body=>[
"DO $worker_draft_activation_operation$",
"declare f jsonb;actual jsonb;observed jsonb;expected jsonb;",
"begin",
"perform set_config('lock_timeout','5s',true);",
"perform set_config('statement_timeout','60s',true);",
body,
"end $worker_draft_activation_operation$;"
].join('\n');
const execute=d=>"execute $worker_draft_activation_ddl$"+d+"$worker_draft_activation_ddl$;";
const disclaimer="-- Prepared operation; NOT applied by this script. Exact preimage guards are mandatory.\n-- Does not rewrite closure certificates/readiness, grants, ownership, RLS or user data.\n";
const files={
 [stem+'.preflight.sql']:disclaimer+block(pre)+"\nselect 'WORKER_DRAFT_ACTIVATION_PREIMAGE_MATCH' as status;\n",
 [stem+'.promotion.sql']:disclaimer+block(pre+'\n'+defs.map(execute).join('\n')+'\n'+post)+"\nselect 'WORKER_DRAFT_ACTIVATION_POSTIMAGE_MATCH' as status;\n",
 [stem+'.postflight.sql']:disclaimer+block(post)+"\n"+observe+" as observed;\n",
 [stem+'.rollback.sql']:disclaimer+"-- DDL rollback only: preserves prior signed receipts and granted capabilities.\n"+
  block(post+'\n'+snapshot.functions.filter(f=>changed.has(f.signature.split('(')[0])).map(f=>execute(f.definition)).join('\n')+'\n'+pre)+"\nselect 'WORKER_DRAFT_ACTIVATION_ROLLBACK_MATCH' as status;\n"
};
const manifest={schema:'worker-draft-activation-operation-manifest-v1',project:snapshot.project,status:'PREPARED_NOT_DEPLOYED',
 changedFunctions:after.filter((f,i)=>f.body_md5!==before[i].body_md5).map(f=>({signature:f.signature,before:before.find(x=>x.signature===f.signature).body_md5,after:f.body_md5})),
 inputSha256:{candidate:sha(candidate),operationPreimage:sha(operationSource)},
 closureBefore:snapshot.closure,closurePredictedAfter:snapshot.closurePostimage,
 outputSha256:Object.fromEntries(Object.entries(files).map(([name,body])=>[name,sha(body)]))};
files[stem+'.manifest.json']=JSON.stringify(manifest,null,2)+'\n';
return files;
}
module.exports={render};
if(require.main===module){
const operationSource=read(stem+'.operation-preimage.json');
const files=render(JSON.parse(operationSource),read(stem+'.sql'),operationSource);
for(const[name,body]of Object.entries(files)){
 if(process.argv.includes('--check')){if(read(name)!==body)throw Error('Generated package drift '+name);}
 else fs.writeFileSync(path.join(dir,name),body);
}
console.log('WORKER_DRAFT_ACTIVATION_PACKAGE_'+(process.argv.includes('--check')?'CHECK':'BUILD')+'_PASS');
}
