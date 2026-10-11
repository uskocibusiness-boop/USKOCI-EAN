-- USKOCI: read-only preview of legacy category/worker records.
-- NOT a migration, NOT a worker capability confirmation or push admission.
WITH fam AS (
 SELECT f.legacy_kind,f.category_id,c.label
 FROM private.work_taxonomy_legacy_kind_map f
 JOIN private.work_taxonomy_categories c ON c.id=f.category_id
 WHERE f.authority='NONE' AND f.family_only
),
 task_rows AS (
  SELECT n.id,n.category,
   private.work_kinds_v5(ARRAY[n.category]) AS suggested_family_kinds
  FROM public.needs n
 ),
 worker_rows AS (
  SELECT p.id,p.account_id,skill,
    private.work_kinds_v5(ARRAY[skill]) AS suggested_family_kinds
  FROM public.app_profiles p CROSS JOIN LATERAL unnest(p.skills) AS s(skill)
  WHERE p.kind='WORKER' AND p.profile_status='ACTIVE'
 ),
 task_labels AS (
  SELECT t.category,
    count(*) AS records,
    CASE WHEN (SELECT count(*) FROM fam f
         WHERE private.taxonomy_normalize_v1(f.label)=private.taxonomy_normalize_v1(t.category))=1
          THEN 'EXACT_FAMILY_LABEL_ONLY_NOT_CAPABILITY'
         WHEN cardinality(t.suggested_family_kinds)=0
          THEN 'UNRECOGNIZED_NEEDS_USER_REVIEW'
         ELSE 'ALIASED_OR_COMPOUND_NEEDS_REVIEW' END AS status,
    t.suggested_family_kinds AS legacy_suggestions
  FROM task_rows t GROUP BY t.category,t.suggested_family_kinds
 ),
 worker_labels AS (
  SELECT w.skill,count(*) AS records,
    CASE WHEN (SELECT count(*) FROM fam f
         WHERE private.taxonomy_normalize_v1(f.label)=private.taxonomy_normalize_v1(w.skill))=1
          THEN 'EXACT_FAMILY_LABEL_ONLY_NOT_WORKER_CONFIRMATION'
         WHEN cardinality(w.suggested_family_kinds)=0
          THEN 'UNRECOGNIZED_WORKER_CONFIRMATION_REQUIRED'
         ELSE 'LEGACY_ALIAS_NEEDS_WORKER_CONFIRMATION' END AS status,
    w.suggested_family_kinds AS legacy_suggestions
  FROM worker_rows w GROUP BY w.skill,w.suggested_family_kinds
 )
SELECT jsonb_pretty(jsonb_build_object(
 'mode','READ_ONLY_NEVER_AUTO_BACKFILL',
 'families',(SELECT count(*) FROM fam),
 'task_labels',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.category),'[]'::jsonb) FROM task_labels x),
 'worker_skill_labels',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.skill),'[]'::jsonb) FROM worker_labels x),
 'task_rows_needing_review',(SELECT coalesce(sum(records),0) FROM task_labels WHERE status<>'EXACT_FAMILY_LABEL_ONLY_NOT_CAPABILITY'),
 'worker_skill_mentions_needing_confirmation',(SELECT coalesce(sum(records),0) FROM worker_labels WHERE status<>'EXACT_FAMILY_LABEL_ONLY_NOT_WORKER_CONFIRMATION'),
 'classify_authority','NONE','matching_authority','NONE','notification_authority','NONE'
)) AS receipt;