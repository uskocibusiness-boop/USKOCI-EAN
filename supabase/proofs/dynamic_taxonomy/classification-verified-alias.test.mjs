import test from 'node:test';
import assert from 'node:assert/strict';
import { loadClassificationCatalog, reviewClassificationProposal, catalogPromptContext } from '../../functions/_shared/classificationEngine.mjs';
import { inspectGeminiClassificationShadow } from '../../functions/_shared/classificationGeminiShadow.mjs';

const printing='d5e890a0-2502-4901-8803-7462b8ca6d24';
const modeling='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const fingerprint='9e7b3b3d05c6b636067ee37dea9e8980';
const category=(id,label,aliases=[])=>({categoryId:id,label,aliases,parentId:null,path:[label],isLeaf:true});
const categories=[category(printing,'3D printovanje',['3D štampa','Izrada 3D figurica']),category(modeling,'3D modelovanje')];
const page=(scope,items,nextAfter=null)=>({action:'CATALOG_CONTEXT',scope,items,nextAfter,catalogVersion:4,
  catalogFingerprint:fingerprint,classificationAuthority:'NONE',notificationAuthority:'NONE'});
const rpc=async(_name,args)=>page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',
  args.p_execution_location_mode==='REMOTE'?categories:[]);
const proposal=(service='3D štampa',action='REUSE_EXISTING',categoryId=printing)=>({
  service,mode:'REMOTE',action,categoryId,parentId:'',proposedPath:[],
  reason:'The person explicitly offers this named service remotely.',catalogVersion:4,
});
const inspect=(catalog,p,purpose='WORKER_CAPABILITY')=>inspectGeminiClassificationShadow({
  assistantMessage:'Proveri nacrt.',safety:'ALLOW',patch:{skills:[p.service]},
  classificationShadowJson:JSON.stringify([p]),
},catalog,purpose);

test('fresh server aliases pass through actual reader and both shadow purposes with original service',async()=>{
  const catalog=await loadClassificationCatalog(rpc);
  assert.equal(catalog.catalogFingerprint,fingerprint);
  assert.deepEqual(catalog.categories[0].aliases,['3D štampa','Izrada 3D figurica']);
  assert.ok(Object.isFrozen(catalog.categories[0].aliases));
  for(const purpose of ['WORKER_CAPABILITY','NEED_SERVICE']){
    for(const action of ['REUSE_EXISTING','REUSE_ALIAS']){
      for(const service of ['3D štampa','3D штампа']){
        const p=proposal(service,action);
        const result=inspect(catalog,p,purpose);
        assert.deepEqual(result.statuses,['REUSE_CANDIDATE']);
        assert.deepEqual(result.reviewProposals,[{...p,action:'REUSE_EXISTING'}]);
        assert.equal(result.reviewProposals[0].service,service,'retain the actual skill for SQL source/mode binding');
        assert.equal(Object.hasOwn(result.output,'classificationShadowJson'),false);
        const checked=reviewClassificationProposal({purpose,service,mode:'REMOTE'},catalog,p);
        assert.equal(checked.requiresOwnerReview,true);
        assert.equal(checked.capabilityAuthority,'NONE');
        assert.equal(checked.notificationAuthority,'NONE');
      }
    }
  }
});

test('registered alias cannot choose wrong ID, unsupported mode, stale version or unknown synonym',async()=>{
  const catalog=await loadClassificationCatalog(rpc);
  for(const p of [proposal('3D štampa','REUSE_EXISTING',modeling),proposal('3D laserska obrada'),
    proposal('3D stampa'),{...proposal(),mode:'ON_SITE'},{...proposal(),catalogVersion:3},
    {...proposal(),mode:'UNCONFIRMED'}]){
    assert.deepEqual(inspect(catalog,p).reviewProposals,[]);
  }
});

test('alias evidence is unavailable with old catalog or absent authoritative fingerprint',async()=>{
  const legacy=await loadClassificationCatalog(async(_name,args)=>{
    const p=page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',
      args.p_execution_location_mode==='REMOTE'?categories.map(({aliases,...row})=>row):[]);
    delete p.catalogFingerprint;return p;
  });
  assert.deepEqual(inspect(legacy,proposal()).reviewProposals,[]);
  assert.deepEqual(inspect(legacy,proposal('3D štampa','REUSE_ALIAS')).reviewProposals,[]);
  assert.equal(inspect(legacy,proposal('3D printovanje')).reviewProposals.length,1);
  const verified=await loadClassificationCatalog(rpc);
  const {catalogFingerprint,...withoutFingerprint}=verified;
  assert.deepEqual(inspect(withoutFingerprint,proposal()).reviewProposals,[]);
});

test('catalog rejects malformed alias payloads and alias pages without fingerprint',async()=>{
  for(const aliases of ['3D štampa',[null],['x'],['<script>'],['a'.repeat(121)]]){
    await assert.rejects(loadClassificationCatalog(async(_name,args)=>page(
      args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',[{...categories[0],aliases}])),/INVALID_ALIAS/);
  }
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>{
    const p=page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',[categories[0]]);
    delete p.catalogFingerprint;return p;
  }),/ALIAS_FINGERPRINT_REQUIRED/);
});

test('catalog rejects changed fingerprint even when catalog version stays the same',async()=>{
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>({
    ...page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',[]),
    catalogFingerprint:args.p_execution_location_mode==='REMOTE'?'a'.repeat(32):fingerprint,
  })),/STALE_FINGERPRINT/);
});

test('catalog rejects malformed fingerprints and legacy/new mixed pages',async()=>{
  for(const catalogFingerprint of [null,42,'',fingerprint.toUpperCase(),'f'.repeat(31)]){
    await assert.rejects(loadClassificationCatalog(async(_name,args)=>({
      ...page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',[]),catalogFingerprint,
    })),/INVALID_FINGERPRINT/);
  }
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>{
    const p=page(args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',[]);
    if(args.p_execution_location_mode==='STATIONARY')delete p.catalogFingerprint;
    return p;
  }),/STALE_FINGERPRINT/);
});

test('same category cannot acquire conflicting aliases across execution-scope pages',async()=>{
  await assert.rejects(loadClassificationCatalog(async(_name,args)=>page(
    args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',
    [{...categories[0],aliases:args.p_execution_location_mode==='REMOTE'?['3D štampa']:['Izrada figurica']}]
  )),/CONFLICTING_ID/);
});

test('ambiguous server aliases do not let Gemini choose a convenient category',async()=>{
  const catalog=await loadClassificationCatalog(async(_name,args)=>page(
    args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',
    args.p_execution_location_mode==='REMOTE'?[categories[0],{...categories[1],aliases:['3D štampa']}]:[]));
  for(const categoryId of [printing,modeling]){
    assert.deepEqual(inspect(catalog,proposal('3D štampa','REUSE_ALIAS',categoryId)).reviewProposals,[]);
  }
});

test('canonical name colliding with another registered alias cannot be chosen in either direction',async()=>{
  const catalog=await loadClassificationCatalog(async(_name,args)=>page(
    args.p_execution_location_mode==='REMOTE'?'REMOTE':'ON_SITE',
    args.p_execution_location_mode==='REMOTE'?[categories[0],{...categories[1],label:'3D štampa',aliases:['3D printovanje']}]:[]));
  for(const p of [proposal(),proposal('3D printovanje'),proposal('3D štampa','REUSE_EXISTING',modeling)]){
    assert.deepEqual(inspect(catalog,p).reviewProposals,[]);
    assert.deepEqual(inspect(catalog,p).statuses,['AMBIGUOUS_CANONICAL_IDENTITY']);
  }
});

test('model-authored alias evidence and extra fields never become server catalog proof',async()=>{
  const catalog=await loadClassificationCatalog(rpc);
  const p={...proposal('Nezabeležena usluga','REUSE_ALIAS'),aliases:['Nezabeležena usluga']};
  assert.deepEqual(inspect(catalog,p).statuses,['INVALID_PLAN']);
  assert.deepEqual(inspect(catalog,p).reviewProposals,[]);
});

test('prompt exposes registered aliases without provider alias creation authority',async()=>{
  const catalog=await loadClassificationCatalog(rpc);
  const prompt=JSON.parse(catalogPromptContext(catalog));
  assert.deepEqual(prompt.categories.find(x=>x.id===printing).aliases,['3D štampa','Izrada 3D figurica']);
  assert.match(prompt.instructions,/registered aliases/i);
  assert.match(prompt.instructions,/registered aliases/i);
});
