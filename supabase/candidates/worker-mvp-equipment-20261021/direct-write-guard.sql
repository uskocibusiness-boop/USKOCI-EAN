-- Stop older authenticated REST clients from creating fresh equipment claims.
-- Historical rows/export stay unchanged; administrative erasure remains possible.
create function private.guard_worker_equipment_retired_v1()
returns trigger language plpgsql set search_path=pg_catalog as $f$
begin
 -- This is deliberately SECURITY INVOKER: canonical SECURITY DEFINER erasure
 -- may redact historical data; authenticated REST cannot edit it.
 if current_user='authenticated' and new.kind='WORKER' then
  if tg_op='INSERT' then
   if cardinality(coalesce(new.tools,'{}'::text[]))>0 or cardinality(coalesce(new.vehicles,'{}'::text[]))>0 then
    raise exception 'WORKER_EQUIPMENT_RETIRED' using errcode='22023';
   end if;
  elsif new.tools is distinct from old.tools or new.vehicles is distinct from old.vehicles then
   raise exception 'WORKER_EQUIPMENT_RETIRED' using errcode='22023';
  end if;
 end if;
 return new;
end $f$;
revoke all on function private.guard_worker_equipment_retired_v1() from public,anon,authenticated,service_role;
create trigger guard_worker_equipment_retired_v1
before insert or update of tools,vehicles on public.app_profiles
for each row execute function private.guard_worker_equipment_retired_v1();
