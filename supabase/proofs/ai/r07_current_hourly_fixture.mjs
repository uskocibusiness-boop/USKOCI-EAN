// Shared current pricing fixture. Test-only, isolated PGlite: no remote database.
import {after} from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createHourlyFixture} from '../../../scripts/r07b-hourly-fixture.mjs';
const data=JSON.parse(execFileSync('python',['supabase/proofs/ai/build_current_hourly_candidate.py','--json'],{encoding:'utf8',maxBuffer:2*1024*1024}));
const candidate=readFileSync(new URL('../../candidates/r07_hourly_pricing_current.sql',import.meta.url),'utf8');
const body=definition=>definition.match(/\bAS (\$\w*\$)([\s\S]*?)\1;/)[2];
const md5=text=>createHash('md5').update(text).digest('hex');
const acl=Object.values(data.before).map(f=>`REVOKE ALL ON FUNCTION ${f.signature} FROM PUBLIC,anon,authenticated,service_role;
 ${[...f.acl.matchAll(/(?:\{|,)(authenticated|service_role)=/g)].map(m=>`GRANT EXECUTE ON FUNCTION ${f.signature} TO ${m[1]};`).join('\n')}`).join('\n');
const unchanged=['private.own_application_rows','private.my_application_state',
 'private.need_edit_base_marker','private.guard_need_edit_base_marker',
 'private.agreement_calendar_interval','public.rpc_propose_agreement_change_v2','public.rpc_respond_agreement_change'];
const overrides=Object.fromEntries([...Object.entries(data.before),...unchanged.map(n=>[n,data.dependencies[n]])].map(([n,f])=>[n,f.definition]));
// Keep one engine per test process; rebuild only synthetic schemas between cases.
// This bounds Wasm resources rather than retaining many full engine instances.
let database=null;
after(async()=>{if(database)await database.close();});
async function setup(t,{apply=true}={}) {
 if(!database)database=new PGlite({extensions:{pgcrypto}});
 await database.exec(`ROLLBACK;RESET ALL;
  DROP SCHEMA IF EXISTS private CASCADE;DROP SCHEMA IF EXISTS auth CASCADE;
  DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS extensions CASCADE;
  CREATE SCHEMA public;DROP ROLE IF EXISTS anon;DROP ROLE IF EXISTS authenticated;DROP ROLE IF EXISTS service_role;`);
 const fixture=await createHourlyFixture({database,functionOverrides:overrides,
  extraTables:['public.ai_messages','private.ai_task_reviews','private.ai_task_review_commands','public.agreement_change_proposals'],
  beforeFunctions:`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
   ALTER TABLE public.marketplace_responses ADD COLUMN price_basis text CONSTRAINT marketplace_responses_price_basis_check CHECK(price_basis IN ('TOTAL','HOURLY'));
   ALTER TABLE public.marketplace_response_versions ADD COLUMN price_basis text CONSTRAINT marketplace_response_versions_price_basis_check CHECK(price_basis IN ('TOTAL','HOURLY'));
   CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT 'authenticated'::text$$;
   CREATE OR REPLACE FUNCTION private.accounts_same_world(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.world_mismatch',true) IS DISTINCT FROM 'true'$$;
   CREATE FUNCTION private.worker_remote_only_activation_ready_v1(uuid,text[]) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.remote_ready',true)='true'$$;
   CREATE FUNCTION private.closure_assert_open(uuid,uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF current_setting('test.closed',true)='true' THEN RAISE EXCEPTION 'ACCOUNT_CLOSING';END IF;END$$;
   CREATE FUNCTION private.need_publication_fingerprint_snapshot(uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT jsonb_build_object('canonicalFingerprint',revision::text) FROM public.needs WHERE id=$1$$;`,
  afterFunctions:unchanged.filter(n=>!['private.own_application_rows','private.my_application_state'].includes(n)).map(n=>data.dependencies[n].definition).join('\n')+`
   CREATE TRIGGER guard_need_edit_base_marker_trg BEFORE INSERT OR UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION private.guard_need_edit_base_marker();
   ${acl}`});
 if(apply) await fixture.db.exec("SET uskoci.r07_current.disposable='LOCAL_ONLY';"+candidate);
 return fixture;
}

export {data,candidate,body,md5,setup};
