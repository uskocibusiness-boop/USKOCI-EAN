import {readFileSync,writeFileSync} from 'node:fs';
import {compareSurface,compareInvalidation} from './closure108-diagnostic.mjs';
import assert from 'node:assert/strict';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const actual=read('closure108-full-local.json'),expected=read('closure108-full-dev-v2.json');
for(const x of [actual,expected]){
 assert.equal(x.surface.components.sourceDigest,x.surface.projectedSourceDigest);
 assert.equal(x.surface.components.programDigest,x.surface.projectedProgramDigest);
}
const full=compareSurface(expected.surface,actual.surface);
const invalidation=compareInvalidation(expected.invalidation,actual.invalidation);
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const s1=read('closure108-supplement-dev.json'),s2=read('closure108-supplement-local.json');
const supplement=[];
for(const key of ['catalog'])if(stable(s1[key])!==stable(s2[key])){
 for(const part of Object.keys(s1[key]))if(stable(s1[key][part])!==stable(s2[key][part]))supplement.push({field:key+'.'+part,expected:s1[key][part],actual:s2[key][part]});
}
for(const key of Object.keys(s1.surface).filter(k=>k!=='closure'))if(stable(s1.surface[key])!==stable(s2.surface[key]))supplement.push({field:'surface.'+key,expected:s1.surface[key],actual:s2.surface[key]});
const supplementaryFunctions=[];
const identities=['oid','pronamespace','proowner','prolang','proargtypes','prorettype'];
for(const a of s1.functions){const b=s2.functions.find(b=>b.signature===a.signature);assert.ok(b,a.signature);
 if(stable(a.names)!==stable(b.names))supplementaryFunctions.push({signature:a.signature,field:'symbolicNames',expected:a.names,actual:b.names});
 for(const key of Object.keys(a.metadata))if(!identities.includes(key)&&stable(a.metadata[key])!==stable(b.metadata[key]))supplementaryFunctions.push({signature:a.signature,field:key,expected:a.metadata[key],actual:b.metadata[key]});
}
const report={state:'DIAGNOSTIC_ONLY_NOT_CERTIFIED',full,invalidation,supplement,supplementaryFunctions};
writeFileSync(new URL('closure108-semantic-comparison.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fullSemantic:full.semanticDifferences.map(x=>({surface:x.surface,id:x.id,field:x.field})),catalogIdentities:full.catalogIdentityDifferences.length,invalidationSemantic:invalidation.semanticDifferences.map(x=>({surface:x.surface,id:x.id,field:x.field})),invalidationIdentities:invalidation.catalogIdentityDifferences.length,supplement:supplement.map(x=>x.field),supplementaryFunctions:supplementaryFunctions.map(x=>({signature:x.signature,field:x.field}))},null,2));
