-- Canonical read-only DEV notification builder. Used ONLY inside disposable
-- PostgreSQL; it can insert into synthetic local tables but cannot send push.
CREATE OR REPLACE FUNCTION private.category_of_event(p_event_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when p_event_type = 'OPPORTUNITY_AVAILABLE' then 'opportunities'
    when p_event_type like 'RESPONSE\_%'
      or p_event_type in ('NEED_REVISED','NEED_CANCELLED','CLARIFICATION_CREATED','CLARIFICATION_ANSWERED') then 'responses'
    when p_event_type like 'AGREEMENT\_%'
      or p_event_type in ('MESSAGE_RECEIVED','PRIVATE_ACCESS_GRANTED','REVIEW_RECEIVED') then 'dogovor'
    when p_event_type in ('EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED') then 'execution'
    when p_event_type = 'RECOVERY_OPENED' then 'recovery'
    else 'account'
  end;
$function$;

CREATE OR REPLACE FUNCTION private.notification_copy_v5(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case p_text
    when 'Pregledajte svoju prijavu pre nastavka.' then 'Pregledaj svoju prijavu pre nastavka.'
    when 'Nova prilika koja može da Vam odgovara' then 'Nova prilika koja ti može odgovarati'
    when 'Imate novu prijavu za Zadatak.' then 'Imaš novu prijavu za Zadatak.'
    when 'Pregledajte aktuelne uslove prijave.' then 'Pregledaj aktuelne uslove prijave.'
    when 'Potreba je otkazana' then 'Zadatak je otkazan'
    when 'Narucilac je otkazao Potrebu za koju ste poslali prijavu.' then 'Zadatak za koji imaš prijavu je otkazan.'
    when 'Naručilac je potvrdio završetak.' then 'Završetak Dogovora je potvrđen.'
    when 'Naručilac je pregledao Vašu prijavu.' then 'Tvoja prijava je pregledana.'
    when 'Završetak čeka Vašu potvrdu' then 'Završetak čeka tvoju potvrdu'
    when 'Uskočer je označio Dogovor kao završen.' then 'Dogovor je označen kao završen.'
    when 'Pogledajte predlog i odgovorite u Dogovoru.' then 'Pogledaj predlog i odgovori u Dogovoru.'
    when 'Otvorite Dogovor da vidite prijavljeni problem.' then 'Otvori Dogovor da vidiš prijavljeni problem.'
    when 'Pogledajte važeće uslove u Dogovoru.' then 'Pogledaj važeće uslove u Dogovoru.'
    when 'Naručilac je odgovorio na Vaše pitanje.' then 'Stigao je odgovor na tvoje pitanje.'
    when 'Uskočer je postavio anonimno pitanje o Zadatku.' then 'Stiglo je anonimno pitanje o Zadatku.'
    when 'Vaša prijava je izabrana' then 'Tvoja prijava je izabrana'
    when 'Otvorite Dogovor za detalje zadatka.' then 'Otvori Dogovor za detalje zadatka.'
    when 'Imate novu poruku u Dogovoru.' then 'Imaš novu poruku u Dogovoru.'
    when 'Dobili ste ocenu za završen Dogovor.' then 'Stigla je ocena za završen Dogovor.'
    when 'Prijava je povucena' then 'Prijava je povučena'
    when 'Uskocer je povukao prijavu za Vasu Potrebu.' then 'Jedna prijava za tvoj Zadatak je povučena.'
    when 'Otvorite za trenutne informacije.' then 'Otvori za trenutne informacije.'
    else p_text
  end
$function$;

CREATE OR REPLACE FUNCTION private.in_quiet_hours(p_prefs notification_preferences)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when not p_prefs.quiet_hours_enabled then false
    when p_prefs.quiet_start is null or p_prefs.quiet_end is null then false
    when p_prefs.quiet_start < p_prefs.quiet_end
      then (statement_timestamp() at time zone p_prefs.quiet_timezone)::time
             between p_prefs.quiet_start and p_prefs.quiet_end
    -- prelazak preko ponoci
    else (statement_timestamp() at time zone p_prefs.quiet_timezone)::time >= p_prefs.quiet_start
      or (statement_timestamp() at time zone p_prefs.quiet_timezone)::time <= p_prefs.quiet_end
  end;
$function$;

CREATE OR REPLACE FUNCTION private.emit_event(p_recipient uuid, p_role text, p_event_type text, p_entity_type text, p_entity_id uuid, p_entity_version integer, p_title text, p_body text, p_dedupe_key text, p_urgency text DEFAULT 'NORMAL'::text, p_payload jsonb DEFAULT '{}'::jsonb, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_event_id uuid;
  v_prefs public.notification_preferences%rowtype;
  v_cat text := private.category_of_event(p_event_type);
  v_cat_on boolean;
  v_quiet boolean;
  v_prio text := case when p_urgency = 'HITNO' then 'HIGH' else 'NORMAL' end;
  v_suppress text;
begin
  -- PKG-027c: every stored text addresses the person as "ti" and uses the product's words. Two emitting
  -- functions are trigger functions inside the certified closure source, so the texts are mapped here.
  p_title := private.notification_copy_v5(p_title);
  p_body := private.notification_copy_v5(p_body);
  -- 1) durable event, idempotentno
  insert into public.user_activity_events
    (recipient_user_id, recipient_role, event_type, entity_type, entity_id,
     entity_version, urgency, payload, dedupe_key)
  values (p_recipient, p_role, p_event_type, p_entity_type, p_entity_id,
     p_entity_version, p_urgency, p_payload, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return null;  -- vec emitovano; nista se ne duplira
  end if;

  -- 2) preference; ako red ne postoji, vaze podrazumevane vrednosti
  select * into v_prefs from public.notification_preferences
   where user_id = p_recipient and role_context = p_role;
  if not found then
    v_prefs.in_app_enabled := true;
    -- PKG-029a (deep read 4.1): a role without its own row takes the push choice of the account's other role.
    -- A person who switched push on once expects it on; it was off for every event of the other role.
    v_prefs.push_enabled := coalesce((select np.push_enabled from public.notification_preferences np
                                       where np.user_id = p_recipient order by np.role_context limit 1), false);
    v_prefs.quiet_hours_enabled := false;
    v_prefs.urgent_overrides_quiet_hours := false;
    v_prefs.opportunities_enabled := true; v_prefs.responses_enabled := true;
    v_prefs.dogovor_enabled := true; v_prefs.execution_enabled := true;
    v_prefs.recovery_enabled := true; v_prefs.account_enabled := true;
  end if;

  v_cat_on := case v_cat
    when 'opportunities' then v_prefs.opportunities_enabled
    when 'responses'     then v_prefs.responses_enabled
    when 'dogovor'       then v_prefs.dogovor_enabled
    when 'execution'     then v_prefs.execution_enabled
    when 'recovery'      then v_prefs.recovery_enabled
    else v_prefs.account_enabled end;

  -- 3) IN_APP
  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'IN_APP', v_prio,
     case when v_prefs.in_app_enabled and v_cat_on then 'CREATED' else 'SUPPRESSED' end,
     case when v_prefs.in_app_enabled and v_cat_on then null
          when not v_cat_on then 'CATEGORY_OFF' else 'IN_APP_OFF' end,
     p_title, p_body, p_dedupe_key || ':in_app', p_expires_at)
  on conflict (dedupe_key) do nothing;

  -- 4) PUSH — tihi sati se postuju osim uz izricit opt-in za HITNO
  v_quiet := private.in_quiet_hours(v_prefs);
  v_suppress := case
    when not v_prefs.push_enabled then 'PUSH_OFF'
    when not v_cat_on then 'CATEGORY_OFF'
    when v_quiet and not (p_urgency = 'HITNO' and v_prefs.urgent_overrides_quiet_hours)
      then 'QUIET_HOURS'
    else null end;

  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'PUSH', v_prio,
     case when v_suppress is null then 'CREATED' else 'SUPPRESSED' end,
     v_suppress, p_title, p_body, p_dedupe_key || ':push', p_expires_at)
  on conflict (dedupe_key) do nothing;

  return v_event_id;
end;
$function$;
