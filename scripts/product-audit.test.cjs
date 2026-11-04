'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {safePath, group, resolveLocal, references, audit} = require('./product-audit.cjs');
test('rejects traversal and distinguishes runtime, verification and migration history',()=>{
  for (const p of ['../x','/x','src/../../x','src\\x','']) assert.equal(safePath(p),false);
  assert.equal(safePath('src/app/(app)/nova.tsx'),true);
  assert.equal(group('src/app/(app)/nova.tsx'),'navigation_entry');
  assert.equal(group('src/features/ai/__tests__/example.test.ts'),'verification');
  assert.equal(group('supabase/migrations/20200101000000.sql'),'migration_history_and_checks');
});
test('resolves aliases, explicit shared Edge imports and platform variants conservatively',()=>{
  const files = new Set(['src/ui/A.ts','src/ui/A.android.tsx','src/ui/A.ios.tsx','src/ui/A.types.ts','src/ui/B.native.ts','assets/x.png','supabase/functions/_shared/contract.mjs']);
  assert.deepEqual(resolveLocal('src/features/x.ts','@/ui/A',files),['src/ui/A.android.tsx','src/ui/A.ios.tsx','src/ui/A.ts']);
  assert.deepEqual(resolveLocal('src/features/x.ts','@/assets/x.png',files),['assets/x.png']);
  assert.deepEqual(resolveLocal('src/contracts/x.ts','../../supabase/functions/_shared/contract.mjs',files),['supabase/functions/_shared/contract.mjs']);
  assert.deepEqual(resolveLocal('src/ui/x.ts','./A.types',files),['src/ui/A.types.ts']);
  assert.deepEqual(resolveLocal('src/ui/x.ts','./B.native',files),['src/ui/B.native.ts']);
  assert.equal(resolveLocal('src/x.ts','react',files),null);
});
test('AST records real dependencies but does not interpret comments and prose as imports',()=>{
  const text=`// import Nope from './not-a-dependency';
    const text = "import X from './also-not'";
    import type {A} from './a';
    export {B} from './b';
    const C=import('./c');
    jest.mock('./d');
    const url=new URL('./fixture.sql',import.meta.url);
    const unknown=require(name);
    function owned() { return true; }
  `;
  const r=references('src/x.ts',text);
  assert.deepEqual(r.refs.map(x=>x.specifier),['./a','./b','./c','./d','./fixture.sql']);
  assert.equal(r.dynamic.length,1);
  assert.equal(r.declarations[0].name,'owned');
  assert.deepEqual(r.parseDiagnostics,[]);
});
test('inventory distinguishes unavailable font bytes, missing imports and duplicate bytes without deleting',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'uskoci-inventory-'));
  try {
    fs.mkdirSync(path.join(root,'src/app'),{recursive:true});
    fs.writeFileSync(path.join(root,'src/app/index.ts'),"import '../absent';\nexport const a=1;\n");
    fs.writeFileSync(path.join(root,'copy-a.txt'),'same');
    fs.writeFileSync(path.join(root,'copy-b.txt'),'same');
    const paths=['src/app/index.ts','copy-a.txt','copy-b.txt','assets/fonts/Inter.ttf'];
    const r=audit(root,paths.map(p=>({path:p})));
    assert.equal(r.summary.trackedFiles,4);
    assert.equal(r.summary.presentFiles,3);
    assert.equal(r.summary.unresolvedLocalReferences,1);
    assert.equal(r.summary.byteIdenticalGroups,1);
    assert.equal(r.files.find(x=>x.path.endsWith('index.ts')).implicitRouteEntry,true);
    assert.equal(r.files.find(x=>x.path.endsWith('Inter.ttf')).reason,'FONT_BYTES_EXCLUDED_FROM_REVIEW_ARCHIVE');
    assert.equal(r.summary.semanticReviewComplete,false);
    assert.ok(r.files.every(x=>x.deletionApproved===false));
    assert.equal(fs.readFileSync(path.join(root,'copy-a.txt'),'utf8'),'same');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
test('unsafe and duplicate manifest entries fail before reading outside the checkout',()=>{
  assert.throws(()=>audit('/tmp',[{path:'../outside'}]),/INVALID_OR_DUPLICATE_PATH/);
  assert.throws(()=>audit('/tmp',[{path:'same'},{path:'same'}]),/INVALID_OR_DUPLICATE_PATH/);
});
