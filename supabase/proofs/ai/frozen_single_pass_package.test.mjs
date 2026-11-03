import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {check,payload,frozenSourceCommit} from '../../operations/dev-alpha/r04-single-pass-20261103/edge-package.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const root=new URL('../../../',import.meta.url);
const directory='supabase/operations/dev-alpha/r04-single-pass-20261103/';
const read=name=>readFileSync(new URL(directory+name,root),'utf8');
const manifest=JSON.parse(read('edge-manifest.json'));
test('historical manifest remains byte-identical while current intake evolves',()=>{
  assert.equal(read('edge-manifest.json'),execFileSync('git',['show',frozenSourceCommit+':'+directory+'edge-manifest.json'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024}));
  check();
});
for(const fn of manifest.functions)test('frozen bundle matches every recorded file: '+fn.slug,()=>{
  const files=payload(fn.slug).files;
  assert.equal(files.length,fn.candidate_files.length);
  assert.deepEqual(files.map(f=>({name:f.name,sha256:sha(f.content)})).sort((a,b)=>a.name.localeCompare(b.name,'en')),fn.candidate_files);
  assert.ok(files.find(f=>f.name.endsWith('/taxonomyRuntimeConfig.mjs')).content.includes('taxonomyDualGeminiEnabled'));
  assert.ok(!readFileSync(new URL('supabase/functions/_shared/taxonomyRuntimeConfig.mjs',root),'utf8').includes('export function taxonomyDualGeminiEnabled'));
});
