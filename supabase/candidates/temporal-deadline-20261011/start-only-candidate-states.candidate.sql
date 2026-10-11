-- SOURCE CANDIDATE ONLY; no live data writes. Worker match remains the one authority.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='private.need_candidate_states_v5(uuid)'::regprocedure) IS DISTINCT FROM '112ed258e838b2cae22b248ac94ebe7c'
 THEN RAISE EXCEPTION 'START_ONLY_CANDIDATE_STATES_SOURCE_DRIFT' USING errcode='PT409'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION private.need_candidate_states_v5(p_need_id uuid)
 RETURNS TABLE(response_id uuid, candidate_state text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  n public.needs; c record; remaining integer; s timestamptz; e timestamptz; eligible boolean;
begin
  select * into n from public.needs where id=p_need_id;
  if not found then return; end if;
  remaining:=greatest(n.required_slots-public.fn_need_covered_slots(n.id),0);
  for c in
    select r.id,r.worker_profile_id,r.worker_account_id,r.status,r.current_version,r.covered_slots,
      r.submitted_against_need_revision,v.need_revision as version_revision,v.content_hash,v.price_rsd as version_price,
      v.covered_slots as version_slots, v.proposed_start_at as version_start, v.proposed_end_at as version_end,
      p.account_id as profile_account, p.kind, p.profile_status, p.display_name, p.city, p.skills, p.team_capacity,
      exists(select 1 from public.agreements a where a.selected_response_id=r.id) as has_agreement
    from public.marketplace_responses r
    left join public.marketplace_response_versions v on v.response_id=r.id and v.version=r.current_version
    left join public.app_profiles p on p.id=r.worker_profile_id
    where r.need_id=n.id and r.status<>'DRAFT'
  loop
    response_id:=c.id;
    candidate_state:=case
      when c.has_agreement or c.status='SELECTED' then 'SELECTED'
      when c.status='WITHDRAWN' then 'WITHDRAWN'
      when c.status in ('NOT_SELECTED','EXPIRED') then 'CLOSED'
      when n.status not in ('PUBLISHED','SELECTION')
        or (n.response_deadline is not null and n.response_deadline<=statement_timestamp()) then 'CLOSED'
      when c.kind is distinct from 'WORKER' or c.profile_account is distinct from c.worker_account_id
        or c.profile_status is distinct from 'ACTIVE'
        or char_length(btrim(coalesce(c.display_name,'')))<2
        or char_length(btrim(coalesce(c.city,'')))<2
        or cardinality(coalesce(c.skills,'{}'::text[]))<1
        or c.version_slots is null
        or c.status in ('STALE','STALE_REVIEW_REQUIRED') or c.current_version is null or c.content_hash is null
        or c.version_revision is distinct from n.revision
        or c.submitted_against_need_revision is distinct from n.revision then 'STALE'
      when remaining<=0 then 'FULL'
      when c.covered_slots>remaining or c.version_slots>remaining then 'OVERFILL'
      when c.status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED') then 'SELECTABLE'
      else 'CLOSED' end;
    if candidate_state='SELECTABLE' then
      s:=coalesce(c.version_start,case when n.schedule_kind='FIXED_WINDOW' then n.starts_at end);
      e:=coalesce(c.version_end,case when n.schedule_kind='FIXED_WINDOW' then n.ends_at end);
      -- No proposed interval and a start-only task: revalidate the worker's
      -- confirmed service/area/instant, not a fabricated calendar duration.
      if n.schedule_kind='FIXED_WINDOW' and n.ends_at is null
         and c.version_start is null and c.version_end is null then
        s:=null; e:=null;
      end if;
      if (c.version_start is null)<>(c.version_end is null)
        or (s is null)<>(e is null)
        or (s is not null and (not isfinite(s) or not isfinite(e) or s>=e))
        or (c.version_start is null and n.schedule_kind='FIXED_WINDOW'
          and (n.starts_at is null or not isfinite(n.starts_at)
            or (n.ends_at is not null and (s is null or e is null)))) then
        candidate_state:='STALE';
      else
        eligible:=coalesce((private.match_detail_for_calendar_interval(n.id,c.worker_profile_id,s,e)->>'responseAllowed')::boolean,false);
        if not eligible then candidate_state:='STALE'; end if;
      end if;
      if candidate_state='SELECTABLE' then
        begin
          -- Use the final selection authority, including legacy null/TOTAL/PER_PERSON semantics.
          perform private.assert_application_price_v5(n,c.version_slots,c.version_price);
        exception when sqlstate '22023' or sqlstate 'P0001' then
          if sqlerrm not in ('INVALID_PRICE','FIXED_PRICE_NOT_READY','FIXED_PRICE_MISMATCH',
            'TOTAL_PRICE_REQUIRES_ALL_SLOTS','UNKNOWN_PRICE_BASIS') then raise; end if;
          candidate_state:='STALE';
        end;
      end if;
    end if;
    return next;
  end loop;
end;
$function$;
COMMIT;
