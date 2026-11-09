'use strict';
// SOURCE candidate only. This generator is not a DEV promotion procedure.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'sql');
const capture=JSON.parse(fs.readFileSync(path.join(root,'worker_draft_activation_20261109.preimage.json'),'utf8'));
const get=name=>capture.functions.find(f=>f.name===name).definition;
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b);};
const draft=String.raw`
 -- Reopen only the latest unchanged owned DRAFT Save as proposals. These rows
 -- stay draftServices: they grant no active capability or notification consent.
 IF v_session.revision=0 AND v_session.candidate=private.worker_ai_initial(p_account_id)
   AND EXISTS(SELECT 1 FROM public.app_profiles p WHERE p.id=v_profile_id
     AND p.account_id=p_account_id AND p.kind='WORKER' AND p.profile_status='DRAFT')
   AND NOT EXISTS(SELECT 1 FROM private.worker_ai_turns t WHERE t.conversation_id=p_conversation_id)
   AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_gemini_turn_hints_v1 h
     WHERE h.account_id=p_account_id AND h.conversation_id=p_conversation_id)
 THEN
   WITH latest AS (
     SELECT s.* FROM private.worker_ai_saves s WHERE s.account_id=p_account_id
       AND s.receipt->>'profileId'=v_profile_id::text
     ORDER BY s.created_at DESC,s.review_id DESC LIMIT 1
   )
   SELECT r.envelope INTO v_prior_review FROM latest s
   JOIN private.worker_ai_reviews r ON r.id=s.review_id AND r.account_id=s.account_id
   JOIN private.worker_ai_sessions prior ON prior.conversation_id=r.conversation_id
     AND prior.account_id=p_account_id AND prior.profile_id=v_profile_id
   JOIN public.ai_conversations conv ON conv.id=r.conversation_id
     AND conv.account_id=p_account_id AND conv.purpose='PROFILE' AND conv.status='COMPLETED'
   WHERE s.receipt->>'accountId'=p_account_id::text
     AND s.receipt->>'reviewId'=r.id::text AND s.receipt->>'conversationId'=r.conversation_id::text
     AND s.receipt->>'profileStatus'='DRAFT'
     AND s.receipt->'saved'='true'::jsonb AND s.receipt->'authoritative'='true'::jsonb
     AND r.envelope->>'accountId'=p_account_id::text AND r.envelope->>'profileId'=v_profile_id::text
     AND r.envelope->>'reviewId'=r.id::text AND r.envelope->>'conversationId'=r.conversation_id::text
     AND r.envelope->'revision'=to_jsonb(r.revision) AND prior.revision=r.revision
     AND prior.base_hash=v_session.base_hash AND prior.candidate=v_session.candidate
     AND prior.safety NOT IN ('BLOCK','REVIEW')
     AND r.envelope->'profile'=v_session.candidate
     AND r.envelope->'activate'='false'::jsonb AND r.envelope->'canAccept'='true'::jsonb
     AND r.envelope->>'classificationState'='READY'
     AND r.envelope->'classificationCatalogVersion'=
       (SELECT to_jsonb(catalog_version) FROM private.work_taxonomy_control WHERE singleton)
     AND r.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
     AND r.created_at<=s.created_at AND s.created_at<=r.expires_at
     AND r.envelope->>'displayedContentDigest'=encode(extensions.digest(
       ((r.envelope-'displayedContentDigest')||jsonb_build_object('baseHash',r.base_hash))::text,'sha256'),'hex')
     AND NOT EXISTS(SELECT 1 FROM private.worker_ai_saves other WHERE other.account_id=p_account_id
       AND other.receipt->>'profileId'=v_profile_id::text AND other.created_at=s.created_at
       AND other.review_id<>s.review_id);
   IF jsonb_typeof(v_prior_review->'classificationCandidates')='array'
      AND jsonb_typeof(v_prior_review->'reviewedServiceModes')='array'
      AND jsonb_array_length(v_prior_review->'classificationCandidates') BETWEEN 1 AND 12
      AND jsonb_array_length(v_prior_review->'classificationCandidates')=
          jsonb_array_length(v_prior_review->'reviewedServiceModes')
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
        WHERE (SELECT count(*) FROM jsonb_array_elements_text(v_session.candidate->'skills') other
          WHERE private.taxonomy_normalize_v1(other)=private.taxonomy_normalize_v1(skill))<>1)
   THEN
     v_prior_valid:=true;
     FOR v_item IN SELECT value FROM jsonb_array_elements(v_prior_review->'classificationCandidates') LOOP
       -- Exact/alias plans intentionally omit semantic label/parent witnesses.
       -- Re-run their exact projection; semantic synonyms retain signed IDs.
       v_projection:=private.taxonomy_review_exact_projection_v1('WORKER_CAPABILITY',
         jsonb_build_array(v_item->>'service'),jsonb_build_array(jsonb_build_object(
           'service',v_item->>'service','mode',v_item->>'mode')));
       IF v_item->>'action' IS DISTINCT FROM 'REUSE_EXISTING'
         OR v_item->>'mode' IS NULL OR v_item->>'mode' NOT IN ('ON_SITE','REMOTE')
         OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
           WHERE skill=v_item->>'service')
         OR (SELECT count(*) FROM jsonb_array_elements(v_prior_review->'classificationCandidates') p
           WHERE p->>'service'=v_item->>'service' AND p->>'mode'=v_item->>'mode')<>1
         OR (SELECT count(*) FROM jsonb_array_elements(v_prior_review->'reviewedServiceModes') m
           WHERE m->>'service'=v_item->>'service' AND m->>'mode'=v_item->>'mode')<>1
         OR private.taxonomy_risk_triage_v1(v_item->>'service') IS DISTINCT FROM 'LOW_RISK_CANDIDATE'
         OR NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories c
           JOIN private.work_taxonomy_category_modes cm ON cm.category_id=c.id AND cm.execution_scope=v_item->>'mode'
           WHERE c.id::text=v_item->>'categoryId' AND c.state='ESTABLISHED'
             AND ((v_projection->>'status'='READY'
               AND v_projection#>>'{classificationCandidates,0,categoryId}'=c.id::text)
              OR (v_item?'categoryParentId' AND c.label=v_item->>'categoryLabel'
               AND coalesce(to_jsonb(c.parent_id),'null'::jsonb)=v_item->'categoryParentId'))
             AND private.taxonomy_risk_triage_v1(c.label)='LOW_RISK_CANDIDATE'
             AND private.taxonomy_category_path_valid_v1(c.id)
             AND NOT EXISTS(SELECT 1 FROM private.work_taxonomy_categories child
               WHERE child.parent_id=c.id AND child.state='ESTABLISHED'))
         OR (v_item?'handoff' AND (v_item->>'mode'<>'REMOTE'
           OR private.taxonomy_handoff_valid_v1(v_item->'handoff') IS NOT TRUE))
         OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_prior_review->'classificationCandidates') other
           WHERE other->>'categoryId'=v_item->>'categoryId' AND other->>'mode'=v_item->>'mode'
             AND other->'handoff' IS DISTINCT FROM v_item->'handoff')
       THEN v_prior_valid:=false;EXIT; END IF;
       v_prior_draft:=v_prior_draft||jsonb_build_array(jsonb_build_object(
         'service',v_item->>'service','mode',v_item->>'mode','categoryId',v_item->>'categoryId')
         ||CASE WHEN v_item?'handoff' THEN jsonb_build_object('handoff',v_item->'handoff') ELSE '{}'::jsonb END);
     END LOOP;
     IF v_prior_valid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(v_session.candidate->'skills') skill
       WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_prior_draft) p WHERE p->>'service'=skill))
     THEN v_draft_services:=v_prior_draft; END IF;
   END IF;
 END IF;
`;
let context=get('private.worker_ai_service_mode_context_v1');
context=replace(context," v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';",
 " v_saved_services jsonb:='[]';v_draft_services jsonb:='[]';v_unresolved jsonb:='[]';\n v_prior_review jsonb;v_prior_draft jsonb:='[]';v_prior_valid boolean:=false;");
context=replace(context,' -- Latest current-source hints are separate proposals.',draft+'\n -- Latest current-source hints are separate proposals.');
let prepare=get('public.rpc_prepare_worker_ai_review_taxonomy');
prepare=replace(prepare," for v_item in select value from jsonb_array_elements(v_context->'savedServices') loop",
` -- An untouched new session may also reuse the current DRAFT Save witness
 -- validated by context. Any user turn/edit or hint excludes this fallback.
 for v_item in select value from jsonb_array_elements((v_context->'savedServices')||
   case when s.revision=0 and s.candidate=private.worker_ai_initial(auth.uid())
     and not exists(select 1 from private.worker_ai_turns t where t.conversation_id=p_conversation_id)
     and not exists(select 1 from private.work_taxonomy_gemini_turn_hints_v1 h
       where h.account_id=auth.uid() and h.conversation_id=p_conversation_id)
   then v_context->'draftServices' else '[]'::jsonb end) loop`);
prepare=replace(prepare,"'Previously saved and bound service identity'","'Previously signed and saved service identity'");
prepare=replace(prepare,"    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE then",
`    and private.worker_remote_review_ready_v1(doc) IS NOT TRUE
    and (doc->>'classificationState'='READY'
      and jsonb_array_length(private.validate_worker_areas_v1(
        coalesce(s.candidate->'workAreas','[]'::jsonb)))>0) IS NOT TRUE then`);
let complete=get('private.complete_worker_profile_v1');
complete=replace(complete,"    if private.worker_remote_review_ready_v1(v_review.envelope) IS NOT TRUE then",
`    if private.worker_remote_review_ready_v1(v_review.envelope) IS NOT TRUE
      and (v_review.envelope->>'classificationState'='READY'
        and v_review.envelope->'classificationCatalogVersion'=
          (select to_jsonb(catalog_version) from private.work_taxonomy_control where singleton)
        and v_review.envelope->>'classificationCatalogFingerprint'=private.taxonomy_admission_fingerprint_v1()
        and jsonb_array_length(private.validate_worker_areas_v1(
          coalesce(v_review.envelope#>'{profile,workAreas}','[]'::jsonb)))>0) IS NOT TRUE then`);
const output='-- SOURCE ONLY: saved DRAFT activation continuity. No DEV authorization.\n-- WORKER_DRAFT_ACTIVATION_ISOLATED_START\n'+[context,prepare,complete].map(x=>x.trim()+';\n').join('\n');
const dest=path.join(root,'worker_draft_activation_20261109.sql');
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(dest,'utf8'),output);
else fs.writeFileSync(dest,output);
console.log('worker draft activation source '+(process.argv.includes('--check')?'check':'generate')+': PASS');
