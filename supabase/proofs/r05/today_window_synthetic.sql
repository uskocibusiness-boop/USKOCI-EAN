-- R05 TODAY_FLEXIBLE synthetic PostgreSQL timeline arithmetic, no business rows.
BEGIN TRANSACTION READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='20s';
WITH cases(label,published_at,at_now,task_timezone,available_now,available_start,available_end,
           blocked_start,blocked_end,expected_tier,expected_day_hours) AS (
 VALUES
  ('later_today','2026-10-28T08:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',FALSE,'2026-10-28T15:00:00+01:00','2026-10-28T16:00:00+01:00',NULL,NULL,2,24),
  ('available_now','2026-10-28T08:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',TRUE,NULL,NULL,NULL,NULL,1,24),
  ('expired_next_midnight','2026-10-28T08:00:00+01:00','2026-10-29T00:15:00+01:00','Europe/Belgrade',FALSE,'2026-10-29T15:00:00+01:00','2026-10-29T16:00:00+01:00',NULL,NULL,NULL,24),
  ('partially_blocked','2026-10-28T08:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',FALSE,'2026-10-28T15:00:00+01:00','2026-10-28T16:00:00+01:00','2026-10-28T15:30:00+01:00','2026-10-28T17:00:00+01:00',2,24),
  ('fully_blocked','2026-10-28T08:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',FALSE,'2026-10-28T15:00:00+01:00','2026-10-28T16:00:00+01:00','2026-10-28T14:00:00+01:00','2026-10-28T17:00:00+01:00',NULL,24),
  ('blocked_now_later_free','2026-10-28T08:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',TRUE,'2026-10-28T15:00:00+01:00','2026-10-28T16:00:00+01:00','2026-10-28T10:00:00+01:00','2026-10-28T12:00:00+01:00',2,24),
  ('blocked_now_no_later','2026-10-28T08:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',TRUE,NULL,NULL,'2026-10-28T10:00:00+01:00','2026-10-28T12:00:00+01:00',NULL,24),
  ('spring_DST_23h','2026-03-29T00:10:00+01:00','2026-03-29T01:10:00+01:00','Europe/Belgrade',FALSE,'2026-03-29T19:00:00+02:00','2026-03-29T20:00:00+02:00',NULL,NULL,2,23),
  ('fall_DST_25h','2026-10-25T00:10:00+02:00','2026-10-25T01:10:00+02:00','Europe/Belgrade',FALSE,'2026-10-25T17:00:00+01:00','2026-10-25T18:00:00+01:00',NULL,NULL,2,25),
  ('future_publication','2026-10-28T15:00:00+01:00','2026-10-28T10:00:00+01:00','Europe/Belgrade',TRUE,NULL,NULL,NULL,NULL,NULL,24),
  ('null_publication',NULL,'2026-10-28T10:00:00+01:00','Europe/Belgrade',TRUE,NULL,NULL,NULL,NULL,NULL,NULL)
), typed AS (
 SELECT label,published_at::timestamptz published_at,at_now::timestamptz at_now,
 task_timezone,available_now,available_start::timestamptz available_start,
 available_end::timestamptz available_end,blocked_start::timestamptz blocked_start,
 blocked_end::timestamptz blocked_end,expected_tier::integer expected_tier,
 expected_day_hours::integer expected_day_hours FROM cases
), windows AS (
 SELECT *,((published_at at time zone task_timezone)::date)::timestamp at time zone task_timezone AS day_start,
 (((published_at at time zone task_timezone)::date)+1)::timestamp at time zone task_timezone AS day_end
 FROM typed
), computed AS (
 SELECT *,
 CASE WHEN available_start IS NOT NULL AND available_end IS NOT NULL AND available_start<available_end
 THEN tstzmultirange(tstzrange(available_start,available_end,'[)'))
 ELSE '{}'::tstzmultirange END AS available_periods,
 CASE WHEN blocked_start IS NOT NULL AND blocked_end IS NOT NULL AND blocked_start<blocked_end
 THEN tstzmultirange(tstzrange(blocked_start,blocked_end,'[)'))
 ELSE '{}'::tstzmultirange END AS blocked_periods
 FROM windows
), verdict AS (
 SELECT label,expected_tier,expected_day_hours,
 CASE WHEN day_start IS NULL THEN NULL
 ELSE (extract(epoch from day_end-day_start)/3600)::integer END AS day_hours,
 CASE WHEN published_at IS NULL OR at_now<published_at OR day_end<=at_now THEN NULL
 WHEN available_now AND NOT (blocked_periods @> at_now) THEN 1
 WHEN (available_periods * tstzmultirange(tstzrange(greatest(day_start,at_now),day_end,'[)')))
 - blocked_periods <> '{}'::tstzmultirange THEN 2
 ELSE NULL END AS actual_tier
 FROM computed
)
SELECT jsonb_build_object('unit','R05_TODAY_FLEXIBLE_SYNTHETIC_DAY_MATRIX','format_version',1,
'read_only',current_setting('transaction_read_only'),
'cases',(SELECT count(*) FROM verdict),
'mismatches',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'label',label,'actual_tier',actual_tier,'expected_tier',expected_tier,
  'day_hours',day_hours,'expected_hours',expected_day_hours) ORDER BY label),'[]'::jsonb)
 FROM verdict WHERE actual_tier IS DISTINCT FROM expected_tier
 OR day_hours IS DISTINCT FROM expected_day_hours),
'results',(SELECT jsonb_agg(jsonb_build_object('label',label,'tier',actual_tier,'hours',day_hours)
 ORDER BY label) FROM verdict)) AS capture;
ROLLBACK;
