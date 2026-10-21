-- PED02 follow-up: opening an unchanged review must not close applications.
set local lock_timeout='5s';
create function private.task_replacement_material(p_need uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog as $f$
 with source as (
  select private.need_full_edit_snapshot(n.id) as s,d.handoff,d.critical_conditions
  from public.needs n left join public.need_requirement_details d on d.need_id=n.id where n.id=p_need
 ), normalized as (
  select s || jsonb_build_object(
   'approximateCity',nullif(s->>'approximateCity',''),
   'approximateArea',nullif(s->>'approximateArea',''),
   'publicTopology',jsonb_strip_nulls(case when s#>'{publicTopology,waypoints}'='[]'::jsonb
      then (s->'publicTopology')-'waypoints' else s->'publicTopology' end),
   'privateLocation',case when s->'privateLocation'='null'::jsonb then null
     else jsonb_strip_nulls((s->'privateLocation')||jsonb_build_object(
       'exactAddress',nullif(s#>>'{privateLocation,exactAddress}',''),
       'accessNotes',nullif(s#>>'{privateLocation,accessNotes}',''))) end,
   'criticalConditions',to_jsonb(array_remove(coalesce(critical_conditions,'{}'::text[]),
      'Predaja: '||private.taxonomy_handoff_display_v1(handoff))),
   'handoff',handoff) as s from source
 ) select jsonb_strip_nulls(case when s->'privateLocation'='{}'::jsonb then s-'privateLocation' else s end) from normalized;
$f$;
revoke all on function private.task_replacement_material(uuid) from public,anon,authenticated,service_role;
do $patch$
declare d text;
begin
 d:=pg_get_functiondef('private.stage_task_replacement(uuid,uuid,text,jsonb)'::regprocedure);
 if md5(d)<>'862ed3e71407fa97667380569bbb526f' then raise exception 'PED02_STAGE_PREIMAGE_CHANGED';end if;
 if strpos(d,'  -- Preserve source-bound facts')=0 then raise exception 'PED02_STAGE_ANCHOR';end if;
 execute replace(d,'  -- Preserve source-bound facts', $new$
  if private.task_replacement_material(v_need_id) = private.task_replacement_material(v_conv.bound_need_id) then
    raise exception 'NO_MATERIAL_CHANGE' using errcode='P0001';
  end if;
  -- Preserve source-bound facts$new$);
 d:=pg_get_functiondef('private.finalize_task_replacement(uuid)'::regprocedure);
 if md5(d)<>'ec0c72ceb0c3384555b271d46db1a865' then raise exception 'PED02_FINALIZE_PREIMAGE_CHANGED';end if;
 if strpos(d,' perform private.cancel_replaced_task(')=0 then raise exception 'PED02_FINALIZE_ANCHOR';end if;
 execute replace(d,' perform private.cancel_replaced_task(', $new$
 if private.task_replacement_material(p_candidate) = private.task_replacement_material((r->>'sourceNeedId')::uuid) then
  raise exception 'NO_MATERIAL_CHANGE' using errcode='P0001';end if;
 perform private.cancel_replaced_task($new$);
end $patch$;
