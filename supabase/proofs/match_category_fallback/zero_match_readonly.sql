-- Diagnostic-only query for an operator. No IDs, addresses or messages in output.
-- Bounded sample: maximum 10 newest published tasks x 40 active worker profiles.
-- Read-only: call on DEV if matching appears stuck; do not treat a sample as a
-- complete count on a large production database.
WITH tasks AS (
 SELECT id,schedule_kind FROM public.needs
 WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,id DESC LIMIT 10
), workers AS (
 SELECT id FROM public.app_profiles
 WHERE kind='WORKER' AND profile_status='ACTIVE'
 ORDER BY updated_at DESC,id DESC LIMIT 40
), fits AS (
 SELECT n.schedule_kind,private.worker_need_fit_v1(n.id,p.id,false) AS detail
 FROM tasks n CROSS JOIN workers p
), reasons AS (
 SELECT schedule_kind,
 CASE WHEN detail->'hard' ? 'OWN_NEED' THEN 'OWN_NEED'
      WHEN detail->'hard' ? 'OTHER_WORLD' THEN 'OTHER_WORLD'
      WHEN detail->'hard' ? 'ACCOUNT_OR_PROFILE_RESTRICTED' THEN 'PROFILE_RESTRICTED'
      WHEN coalesce((detail->>'service')::boolean,false) IS NOT TRUE THEN 'UNRELATED_SERVICE'
      WHEN coalesce((detail->>'area')::boolean,false) IS NOT TRUE THEN 'OUTSIDE_AREA'
      WHEN detail->'timeTier' IS NULL OR detail->>'timeTier'='null' THEN 'TIME_NOT_ADMITTED'
      WHEN coalesce((detail->>'matches')::boolean,false) THEN 'POTENTIALLY_ELIGIBLE'
      ELSE 'OTHER_HARD_BLOCK'
 END AS reason
 FROM fits
)
SELECT schedule_kind,reason,count(*) AS evaluated_pairs
FROM reasons GROUP BY 1,2 ORDER BY 1,2;
