'use strict';
          const test=require('node:test');
          const assert=require('node:assert/strict');
          const fs=require('node:fs'),path=require('node:path');
          const root=path.resolve(__dirname,'..');
          const exists=p=>fs.existsSync(path.join(root,p));
          test('app has both real AI interview routes',()=>{
            for(const p of ['src/app/(app)/nova.tsx','src/app/(app)/profil/razgovor.tsx',
              'src/ui/aiFirst/AiConversationShell.tsx','src/ui/v2/IntakePresentation.tsx'])
              assert.ok(exists(p),p);
          });
          test('one shared service handoff contract exists for both client and Edge',()=>{
            const client=fs.readFileSync(path.join(root,'src/contracts/serviceHandoff.ts'),'utf8');
            assert.ok(client.includes("from '../../supabase/functions/_shared/serviceHandoff.mjs'"));
            assert.ok(exists('supabase/functions/_shared/serviceHandoff.mjs'));
          });
          test('both Edge interview entrypoints are retained',()=>{
            for(const p of ['supabase/functions/uskoci-ai-interview/index.ts',
              'supabase/functions/uskoci-worker-interview/index.ts'])assert.ok(exists(p),p);
          });
          test('canonical database migration history is still present',()=>{
            const dir=path.join(root,'supabase/migrations');
            assert.equal(fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).length>100,true);
          });
          test('native patch and app entry generation inputs are kept',()=>{
            for(const p of ['patches/react-native-reanimated+4.5.1.patch',
              'scripts/verify-native-patches.cjs','scripts/sync-entry-reference-assets.cjs',
              'assets/brand/reference-entry/provenance.json','vendor/decode-uri-component-compat/package.json'])
              assert.ok(exists(p),p);
          });
          test('production tree has no historical QA corpora or extra masters',()=>{
            for(const p of ['supabase/proofs','supabase/candidates','supabase/operations',
              'src/data/__tests__','src/designLab','docs/continuation','jest.config.cjs'])
              assert.equal(exists(p),false,p);
            for(const p of ['docs/plan/CODEX_PLAN_RADA.md','docs/product/USKOCI_PRODUCT_UX_MASTER.md'])
              assert.ok(exists(p),p);
          });
          test('normal product screens keep active visual resources',()=>{
            for(const p of ['assets/illustrations/natural-v1/home.webp',
              'assets/illustrations/uskoci-clock-v1.png',
              'assets/illustrations/uskoci-messages-v2.png'])
              assert.ok(exists(p),p);
          });
          test('AI timing distinguishes active phases without logging private text',async()=>{
            const {measureAiPhase}=await import('../supabase/functions/_shared/aiPhaseTiming.mjs');
            const phases=['NEED_FULL_CATALOG','WORKER_FULL_CATALOG','NEED_TAXONOMY_VALIDATE','WORKER_TAXONOMY_VALIDATE'];
            const original=console.info, logs=[];
            console.info=(...args)=>logs.push(args);
            try {
              const value={private:'PRIVATE_RESULT'}, error=new Error('PRIVATE_ERROR');
              for(const phase of phases)assert.equal(await measureAiPhase(phase,async()=>value),value);
              await assert.rejects(measureAiPhase('PRIVATE_PROMPT',async()=>{throw error;}),e=>e===error);
              assert.deepEqual(logs.map(row=>row[1]),[...phases,'UNKNOWN']);
              assert.ok(logs.every(row=>row.length===4&&row[0]==='AI_PHASE_MS'&&Number.isFinite(row[2])&&row[2]>=0));
              assert.equal(logs.at(-1)[3],'FAILED');
              assert.equal(JSON.stringify(logs).includes('PRIVATE_'),false);
            } finally {console.info=original;}
          });
