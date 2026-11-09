'use strict';
// Local source generation only; no connection and no deployment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'sql'),stem='worker_application_areas_20261109';
const capture=JSON.parse(fs.readFileSync(path.join(dir,stem+'.preimage.json'),'utf8'));
const names=['public.rpc_submit_response','public.rpc_select_response','public.rpc_resolve_stale_response_after_need_edit'];
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique anchor: '+a);return s.replace(a,b)};
const oldCity="(char_length(btrim(v_profile.city)) < 2 and private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS NOT TRUE)";
const readiness=`  -- An ACTIVE worker can have saved work areas without a legacy city.
  -- Read only the existing owned Save projection; invalid areas fail closed.
  v_location_ready := char_length(btrim(coalesce(v_profile.city,''))) >= 2
    OR private.worker_remote_only_activation_ready_v1(v_profile.account_id,v_profile.skills) IS TRUE;
  IF v_location_ready IS NOT TRUE THEN
    BEGIN
      v_location_ready := jsonb_array_length(private.validate_worker_areas_v1(
        private.worker_saved_areas_v1(v_profile.account_id))) > 0;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      v_location_ready := false;
    END;
  END IF;
`;
const defs=names.map(name=>{
 let s=capture.functions.find(f=>f.name===name).definition;
 s=replace(s,'declare\n','declare\n  v_location_ready boolean := false;\n');
 const check=name.endsWith('rpc_resolve_stale_response_after_need_edit')?
  "    if v_profile.profile_status is distinct from 'ACTIVE'":name.endsWith('rpc_select_response')?
  "  if not found\n     or v_profile.kind <> 'WORKER'":"  if v_profile.profile_status <> 'ACTIVE'";
 const identity=name.endsWith('rpc_select_response')?"FOUND AND v_profile.kind='WORKER' AND v_profile.account_id=v_resp.worker_account_id AND ":'';
 const guardedReadiness="  IF "+identity+"v_profile.profile_status='ACTIVE'\n    AND char_length(btrim(coalesce(v_profile.display_name,'')))>=2\n    AND cardinality(coalesce(v_profile.skills,'{}'))>=1 THEN\n"+readiness+"  END IF;\n";
 s=replace(s,check,guardedReadiness+check);
 s=name.endsWith('rpc_resolve_stale_response_after_need_edit')?
  replace(s,"or char_length(btrim(coalesce(v_profile.city,''))) < 2","or v_location_ready IS NOT TRUE"):
  replace(s,oldCity,'v_location_ready IS NOT TRUE');
 return s+';';
});
const source='-- SOURCE candidate: preserve ACTIVE/name/skills, ownership/world, revision, pricing,\n-- capacity, manual responseAllowed and idempotency. No user-data/grant/flag writes.\n'+defs.join('\n\n')+'\n';
const target=path.join(dir,stem+'.sql');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),source);else fs.writeFileSync(target,source);
console.log('WORKER_APPLICATION_AREAS_SOURCE_'+(process.argv.includes('--check')?'CHECK':'BUILD')+'_PASS');
