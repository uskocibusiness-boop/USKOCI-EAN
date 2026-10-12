-- Exact canonical DEV agreement-calendar parser snapshot captured read-only.
-- Used exclusively on anonymous disposable PostgreSQL 16/17 in CI.
-- Real DEV procedure body MD5: c75b53c50a362718f607da4d74c333cb.
CREATE OR REPLACE FUNCTION private.agreement_calendar_interval(p_terms jsonb)
 RETURNS TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  s text := p_terms->>'proposed_start_at';
  e text := p_terms->>'proposed_end_at';
  pattern text := '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,6})?(Z|[+-](0[0-9]|1[0-5]):[0-5][0-9])$';
begin
  if jsonb_typeof(p_terms) is distinct from 'object' then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  if s is null and e is null then
    return query select null::timestamptz,null::timestamptz;
    return;
  end if;
  if s is null or e is null or jsonb_typeof(p_terms->'proposed_start_at') <> 'string'
     or jsonb_typeof(p_terms->'proposed_end_at') <> 'string'
     or length(s)>32 or length(e)>32 or s !~ pattern or e !~ pattern then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  begin
    starts_at := s::timestamptz;
    ends_at := e::timestamptz;
  exception when datetime_field_overflow or invalid_datetime_format or invalid_parameter_value then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end;
  if not isfinite(starts_at) or not isfinite(ends_at) or starts_at>=ends_at then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  return next;
end;
$function$;
