begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $gate$ begin
  if md5(pg_get_functiondef('private.worker_ai_patch(jsonb,jsonb,uuid,uuid,boolean)'::regprocedure)) <> '2e3dd7908e493da2145f15c61ba3481c'
    then raise exception 'WA02_PREIMAGE_CHANGED: worker_ai_patch'; end if;
  if md5(pg_get_functiondef('private.worker_ai_initial(uuid)'::regprocedure)) <> 'e74f666d636b83d53e5795450a774202'
    then raise exception 'WA02_PREIMAGE_CHANGED: worker_ai_initial'; end if;
  if md5(pg_get_functiondef('private.worker_ai_source(uuid)'::regprocedure)) <> '24725641b8eefe96f5a52a22f4c044d1'
    then raise exception 'WA02_PREIMAGE_CHANGED: worker_ai_source'; end if;
  if exists(select 1 from pg_trigger where tgrelid='private.worker_ai_saves'::regclass
    and tgname='worker_ai_area_source_continuity_v1' and not tgisinternal)
    then raise exception 'WA02_PREIMAGE_CHANGED: trigger exists'; end if;
end $gate$;

-- WA01 added an explicit empty workAreas array to the canonical source. Migrate
-- only still-open sessions which had no signed areas and whose base hash still
-- exactly matches the previous source contract. A genuinely stale session is
-- deliberately not refreshed.
update private.worker_ai_sessions s
set candidate=jsonb_set(s.candidate,'{workAreas}','[]'::jsonb,true),
    base_hash=private.worker_ai_source_hash(s.account_id)
from public.ai_conversations c
where c.id=s.conversation_id and c.account_id=s.account_id and c.status='OPEN'
  and not(s.candidate?'workAreas')
  and private.worker_saved_areas_v1(s.account_id)='[]'::jsonb
  and s.base_hash=encode(extensions.digest(coalesce((
    select jsonb_build_object('profile',to_jsonb(p),'location',private.worker_location_document(p.id),
      'availability',private.worker_availability_document(p.id),'capacity',private.worker_capacity_document(p.id))
    from public.app_profiles p where p.account_id=s.account_id and p.kind='WORKER'
  ),'null'::jsonb)::text,'sha256'),'hex');

-- Inserting a signed Save changes worker_saved_areas_v1 and therefore the
-- canonical source hash. Refresh only the session whose candidate contains the
-- exact just-signed areas; other concurrent sessions remain stale by design.
CREATE FUNCTION private.worker_ai_area_source_continuity_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
declare
  v_conversation_id uuid;
  v_areas jsonb;
begin
  select r.conversation_id,r.envelope#>'{profile,workAreas}'
    into v_conversation_id,v_areas
  from private.worker_ai_reviews r
  where r.id=new.review_id and r.account_id=new.account_id;
  if not found then raise exception 'WORKER_AI_SAVE_REVIEW_MISSING' using errcode='23503'; end if;
  v_areas:=coalesce(v_areas,'[]'::jsonb);
  update private.worker_ai_sessions s
     set base_hash=private.worker_ai_source_hash(new.account_id)
   where s.conversation_id=v_conversation_id and s.account_id=new.account_id
     and coalesce(s.candidate->'workAreas','[]'::jsonb)=v_areas;
  if not found then raise exception 'WORKER_AI_SAVED_AREA_SOURCE_MISMATCH' using errcode='PT409'; end if;
  return new;
end $function$;

REVOKE ALL ON FUNCTION private.worker_ai_area_source_continuity_v1() FROM public,anon,authenticated,service_role;

CREATE TRIGGER worker_ai_area_source_continuity_v1
AFTER INSERT ON private.worker_ai_saves
FOR EACH ROW EXECUTE FUNCTION private.worker_ai_area_source_continuity_v1();

commit;
