'use strict';
// Two existing reader bodies only. No database connection or deployment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const stem='worker_candidate_areas_20261109',dir=path.join(__dirname,'sql');
const snapshot=JSON.parse(fs.readFileSync(path.join(dir,stem+'.operation-preimage.json'),'utf8'));
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'Unique anchor: '+a);return s.replace(a,b)};
const oldCity=`(char_length(btrim(coalesce(c.city,'')))<2
          and not (n.execution_location_mode='REMOTE'
            and private.worker_remote_only_activation_ready_v1(c.worker_account_id,c.skills) IS TRUE))`;
const readiness=`    -- Match the existing writer readiness without inventing a legacy city.
    -- Only the owned saved-area projection and its existing validator can admit areas.
    location_ready:=false;
    if c.kind='WORKER' and c.profile_account=c.worker_account_id
      and c.profile_status='ACTIVE' and char_length(btrim(coalesce(c.display_name,'')))>=2
      and cardinality(coalesce(c.skills,'{}'::text[]))>=1
      and c.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then
      location_ready:=char_length(btrim(coalesce(c.city,'')))>=2
        or (n.execution_location_mode='REMOTE'
          and private.worker_remote_only_activation_ready_v1(c.worker_account_id,c.skills) IS TRUE);
      if location_ready IS NOT TRUE then
        begin
          location_ready:=jsonb_array_length(private.validate_worker_areas_v1(
            private.worker_saved_areas_v1(c.worker_account_id)))>0;
        exception when sqlstate '22023' then
          location_ready:=false;
        end;
      end if;
    end if;
`;
const defs=snapshot.functions.filter(f=>f.signature.startsWith('private.need_candidate_states_v5(')).map(f=>{
 let d=replace(f.definition,'eligible boolean;','eligible boolean; location_ready boolean;');
 d=replace(d,'    candidate_state:=case',readiness+'    candidate_state:=case');
 return replace(d,oldCity,'location_ready IS NOT TRUE')+';';
});
assert.equal(defs.length,2);
const sql='-- SOURCE candidate: same owned saved-area readiness as the applied submit/select writers.\n-- Preserve response/revision/identity/status/price/capacity/calendar guards and reader scope.\n'+defs.join('\n\n')+'\n';
const target=path.join(dir,stem+'.sql');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),sql);else fs.writeFileSync(target,sql);
console.log('WORKER_CANDIDATE_AREAS_SOURCE_'+(process.argv.includes('--check')?'CHECK':'BUILD')+'_PASS');
