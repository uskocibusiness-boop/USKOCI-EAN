-- Canonical DEV: leqcwgzvjsxugfgzdmth. Read-only forensic evidence.
-- Execute each SELECT separately to retain its result set. No function that
-- reconciles, claims, saves, binds, publishes or sends notifications is called.
-- Only truncated pending-row hashes, counts, statuses, times and booleans leave
-- the database. No raw account/profile/review IDs or user content are returned.
-- These queries classify observations; they do not change resolution_state.

-- Q01: Base evidence, observed 2026-10-26T23:03:11.916990Z.
-- Missing/non-array candidates or reviewed modes are represented as count 0.
-- digest_present_64hex checks presence/shape, NOT cryptographic validity.
-- Absent candidates/catalog data never proves whether Gemini was called.
with source_reviews as (
 select p.id,p.purpose,p.classification_state,p.resolution_state,p.saved_at,
 p.owner_account_id,p.request_key,p.source_review_id,
 case when p.purpose='WORKER_CAPABILITY' then w.envelope else n.envelope end envelope,
 case when p.purpose='WORKER_CAPABILITY' then w.id is not null else n.id is not null end source_review_present
 from private.work_taxonomy_pending_reviews_v1 p
 left join private.worker_ai_reviews w on p.purpose='WORKER_CAPABILITY' and w.id=p.source_review_id and w.account_id=p.owner_account_id
 left join private.ai_task_reviews n on p.purpose='NEED_SERVICE' and n.id=p.source_review_id and n.account_id=p.owner_account_id
 where p.resolution_state='OPEN'
)
select statement_timestamp() observed_at_utc,left(md5(id::text),12) case_id,purpose,classification_state,resolution_state,saved_at,source_review_present,
case when jsonb_typeof(envelope->'classificationCandidates')='array' then jsonb_array_length(envelope->'classificationCandidates') else 0 end candidate_count,
case when jsonb_typeof(envelope->'reviewedServiceModes')='array' then jsonb_array_length(envelope->'reviewedServiceModes') else 0 end reviewed_mode_count,
envelope->>'classificationCatalogVersion' is not null catalog_version_present,
envelope->>'classificationCatalogFingerprint' is not null catalog_fingerprint_present,
coalesce(envelope->>'displayedContentDigest','') ~ '^[a-f0-9]{64}$' digest_present_64hex,
exists(select 1 from private.work_taxonomy_review_outbox_v1 q where q.owner_account_id=source_reviews.owner_account_id and q.request_key=source_reviews.request_key and q.source_review_id=source_reviews.source_review_id) outbox_present
from source_reviews order by saved_at,case_id;

-- Q02: Saved WORKER target freshness; executed on 2026-10-26 UTC.
-- Same-conversation revision equality does not prove current profile freshness.
-- A strictly newer successful signed-review Save for the same owner/profile is
-- evidence of replacement. Equal timestamps alone are not ordered by UUID.
-- A changed profile without a newer Save is not independently classified here.
select left(md5(p.id::text),12) case_id, p.classification_state,p.saved_at,
r.id is not null and s.review_id is not null source_save_present,
r.revision=ws.revision same_conversation_revision,
s.receipt->>'profileId'=r.envelope->>'profileId' receipt_matches_review_target,
a.id is not null current_profile_present,a.updated_at>s.created_at profile_updated_after_save,
to_jsonb(a.skills) is distinct from r.envelope#>'{profile,skills}' current_skills_changed,
(select count(*) from private.worker_ai_saves z join private.worker_ai_reviews q on q.id=z.review_id and q.account_id=z.account_id where z.account_id=p.owner_account_id and z.created_at>s.created_at and z.receipt->>'profileId'=s.receipt->>'profileId' and q.envelope->>'profileId'=s.receipt->>'profileId' and z.receipt->'saved'='true'::jsonb) newer_saved_same_profile,
(select count(*) from private.worker_ai_saves z where z.account_id=p.owner_account_id and z.created_at=s.created_at and z.review_id<>s.review_id and z.receipt->>'profileId'=s.receipt->>'profileId') equal_time_other_save,
(select q.envelope->>'classificationState' from private.worker_ai_saves z join private.worker_ai_reviews q on q.id=z.review_id and q.account_id=z.account_id where z.account_id=p.owner_account_id and z.receipt->>'profileId'=s.receipt->>'profileId' and z.receipt->'saved'='true'::jsonb order by z.created_at desc limit 1) latest_saved_classification_state
from private.work_taxonomy_pending_reviews_v1 p
left join private.worker_ai_reviews r on r.id=p.source_review_id and r.account_id=p.owner_account_id
left join private.worker_ai_saves s on s.review_id=p.source_review_id and s.account_id=p.owner_account_id and s.client_request_id=p.request_key
left join private.worker_ai_sessions ws on ws.conversation_id=r.conversation_id and ws.account_id=p.owner_account_id
left join public.app_profiles a on a.id::text=s.receipt->>'profileId' and a.account_id=p.owner_account_id and a.kind='WORKER'
where p.purpose='WORKER_CAPABILITY' and p.resolution_state='OPEN' order by p.saved_at;

-- Q03: Saved NEED revision and replacement freshness; executed 2026-10-26 UTC.
-- A staged replacement DRAFT does not supersede the published original.
-- Published replacement evidence additionally requires original CANCELLED state
-- and matching signed source/target IDs, owner and source revision.
select left(md5(p.id::text),12) case_id,p.classification_state,p.saved_at,
r.id is not null and c.review_id is not null source_save_present,
n.id is not null current_need_present,n.status need_status,
c.need_revision source_need_revision,n.revision current_need_revision,
(select count(*) from private.ai_task_review_commands z join private.ai_task_reviews q on q.id=z.review_id and q.account_id=z.account_id where z.account_id=p.owner_account_id and z.need_id=c.need_id and z.created_at>c.created_at and z.need_revision>c.need_revision and z.need_revision<=n.revision and z.state in ('ACCEPTED','EVALUATING','EVALUATED','PUBLISHED')) newer_saved_same_need,
(select count(*) from private.ai_task_review_commands z where z.account_id=p.owner_account_id and z.need_id=c.need_id and z.created_at=c.created_at and z.review_id<>c.review_id) equal_time_other_save,
(select count(*) from private.ai_task_review_commands z join private.ai_task_reviews q on q.id=z.review_id and q.account_id=z.account_id join public.needs n2 on n2.id=z.need_id and n2.requester_account_id=p.owner_account_id where z.account_id=p.owner_account_id and z.state='PUBLISHED' and n.status='CANCELLED' and q.envelope#>>'{replacement,version}'='TASK_REPLACEMENT_V1' and q.envelope#>>'{replacement,sourceNeedId}'=c.need_id::text and q.envelope#>>'{replacement,sourceRevision}'=c.need_revision::text and q.envelope#>>'{replacement,targetNeedId}'=z.need_id::text) published_replacements,
(select count(*) from private.ai_task_review_commands z join private.ai_task_reviews q on q.id=z.review_id and q.account_id=z.account_id join public.needs n2 on n2.id=z.need_id and n2.requester_account_id=p.owner_account_id where z.account_id=p.owner_account_id and z.state<>'PUBLISHED' and n2.status='DRAFT' and q.envelope#>>'{replacement,version}'='TASK_REPLACEMENT_V1' and q.envelope#>>'{replacement,sourceNeedId}'=c.need_id::text and q.envelope#>>'{replacement,targetNeedId}'=z.need_id::text) staged_replacements
from private.work_taxonomy_pending_reviews_v1 p
left join private.ai_task_reviews r on r.id=p.source_review_id and r.account_id=p.owner_account_id
left join private.ai_task_review_commands c on c.review_id=p.source_review_id and c.account_id=p.owner_account_id and c.client_request_id=p.request_key
left join public.needs n on n.id=c.need_id and n.requester_account_id=p.owner_account_id
where p.purpose='NEED_SERVICE' and p.resolution_state='OPEN' order by p.saved_at;

-- Q04: Live strict matching control. Observed enabled=true at
-- 2026-10-26T23:02:50.473489Z. This is configuration evidence, not phone E2E.
select now() as observed_at_utc, enabled
from private.taxonomy_match_scope_control_v1 where singleton;

-- Q05: Function-body evidence, read on 2026-10-26 UTC.
-- Scope helper prosrc matches the unchanged source used by the PGlite regression:
-- MD5 8a1bbb43ad9c021f95cc82be5c5e5e6c, 2176 characters.
-- Reconcile has closure guards beyond the older candidate and inserts missing
-- pending rows; it does not mark current OPEN rows resolved/superseded.
select p.oid::regprocedure::text as signature, md5(p.prosrc) as prosrc_md5,
length(p.prosrc) as prosrc_chars
from pg_proc p where p.oid in (
 'private.taxonomy_scope_eligible_v1(uuid,uuid)'::regprocedure,
 'private.taxonomy_reconcile_pending_reviews_v1(integer)'::regprocedure,
 'public.rpc_taxonomy_bind_reviewed_worker_service(uuid,uuid,uuid,uuid)'::regprocedure
);
