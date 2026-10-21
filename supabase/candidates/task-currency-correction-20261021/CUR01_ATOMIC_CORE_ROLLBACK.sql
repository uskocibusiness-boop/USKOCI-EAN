-- CUR01 source-only integration candidate. Deliberately rollback-only.
-- The opening gate currently fails on DEV (2026-10-21 readback); this file
-- must not be copied into supabase/migrations or sent to DEV.
-- Even after the gate is repaired the final exception prevents commit until
-- retention/closure rebinding and an isolated two-session proof are reviewed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $gate$
declare
  v_digest text;
begin
  v_digest := private.closure_source_digest_v5();
  if private.retention_ai_source_ready() is distinct from true
     or v_digest is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or v_digest is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or private.closure_binding_v5() is null
     or private.closure_erasure_binding_v5() is null
  then
    raise exception 'CUR01_PREEXISTING_CLOSURE_RETENTION_GATE_NOT_READY'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.ai_conversations'::regclass
      and attname = 'price_resolution_state' and not attisdropped
  ) then raise exception 'CUR01_COLUMN_ALREADY_EXISTS' using errcode = '55000'; end if;
  if has_table_privilege('authenticated','public.ai_conversations','UPDATE')
     or has_table_privilege('authenticated','public.ai_structured_facts','UPDATE')
     or has_table_privilege('anon','public.ai_conversations','UPDATE')
     or has_table_privilege('anon','public.ai_structured_facts','UPDATE')
  then raise exception 'CUR01_DIRECT_CLIENT_FACT_WRITE_OPEN' using errcode = '42501'; end if;
end $gate$;

alter table public.ai_conversations
  add column price_resolution_state text not null default 'NORMAL',
  add constraint ai_conversations_price_resolution_state_check
    check (price_resolution_state in ('NORMAL','UNRESOLVED','RSD_READY','OFFERS_READY'));

-- Conservative server signal. False positives pause review until the owner
-- chooses RSD or offers; no currency conversion is inferred.
create function private.cur01_eur_correction(p_message text) returns boolean
language sql immutable security invoker set search_path = pg_catalog as $f$
  -- The claim accepts messages up to 4000 characters. A currency clause at
  -- the end of a long valid message must not bypass the server marker.
  select char_length(btrim(coalesce(p_message,''))) > 0
    and (lower(p_message) ~ '(^|[^[:alpha:]])(eur|eura|eurima|euro|evro|evra|evri|evrima|еуро|еура|евро|евра|еври|еврима)([^[:alpha:]]|$)'
         or strpos(p_message,'€') > 0)
$f$;

-- A ready price is still awaiting owner acceptance. A later price-related
-- turn invalidates that proposal before the provider sees the old facts.
-- Any turn with at least three consecutive digits is treated conservatively;
-- dates or address numbers can trigger an extra clarification, not a stale
-- price acceptance. For one/two-digit values, only a whole bare answer or an
-- explicit correction phrase counts. A quantity inside another sentence does
-- not invalidate a READY price. A bounded basis phrase anywhere in the
-- follow-up does: this may conservatively pause an unrelated sentence.
create function private.cur01_price_change_signal(p_message text) returns boolean
language sql immutable security invoker set search_path = pg_catalog as $f$
  select private.cur01_eur_correction(p_message)
    or lower(coalesce(p_message,'')) ~
      '(^|[^[:alpha:]])(rsd|dinara|динар[а-я]*|cena|cenu|cene|цен[аеиу]|budžet|budzet|буџет|iznos|износ|ponude|ponudu|понуде|понуду)([^[:alpha:]]|$)'
    or coalesce(p_message,'') ~ '[0-9]{3,}'
    or lower(coalesce(p_message,'')) ~
      '(^|[^[:alpha:]])(ukupno|укупно|po[[:space:]]+osobi|по[[:space:]]+особи)([^[:alpha:]]|$)'
    or lower(btrim(coalesce(p_message,''))) ~ '^[0-9]{1,2}[.!?]?$'
    or lower(btrim(coalesce(p_message,''))) ~
      '^(ipak|ипак|umesto|уместо|neka[[:space:]]+bude|нека[[:space:]]+буде)[[:space:]]+[0-9]{1,2}[.!?]?$'
$f$;

-- Only an unambiguous, whole task-price utterance can ground a new RSD
-- price. In particular, 5.000 RSD is 5000, not 000; two monetary amounts,
-- "15 000 RSD", and incidental expense clauses require clarification.
-- Other facts in those turns may still pass the writer's normal validation.
create function private.cur01_explicit_rsd_price_amount(p_message text)
returns integer
language plpgsql immutable security invoker set search_path = pg_catalog as $f$
declare
  v_text text := lower(btrim(coalesce(p_message,'')));
  v_match text[];
  v_amount bigint;
begin
  if private.cur01_eur_correction(p_message) then return null; end if;
  v_text := regexp_replace(v_text,'[.!?][[:space:]]*$','');
  v_text := regexp_replace(v_text,
    '^(moja cena|cena zadatka|cena posla|cena|budžet|budzet|nudim|plaćam|placam|stavi|neka bude|računaj|racunaj)[[:space:]]*(je|:)?[[:space:]]*','');
  v_text := regexp_replace(v_text,
    '[[:space:]]*(ukupno|укупно|po[[:space:]]+osobi|по[[:space:]]+особи)[[:space:]]*$','');
  v_match := regexp_match(v_text,
    '^([0-9]{1,3}(\.[0-9]{3})+|[0-9]{1,9})[[:space:]]*(rsd|dinara|динара|din|дин)$');
  if v_match is null then return null; end if;
  v_amount := replace(v_match[1],'.','')::bigint;
  if v_amount < 1 or v_amount > 100000000 then return null; end if;
  return v_amount::integer;
end $f$;

-- Called only from the shared service claim helper after request-hash/
-- idempotency and optional location-context checks, before the provider
-- context/hash is read. Both task and location claim routes use that helper.
-- Caller owns the conversation FOR UPDATE lock. This helper takes Need second.
create function private.cur01_claim_price_correction(
  p_account_id uuid, p_conversation_id uuid, p_message text
) returns boolean
language plpgsql security definer set search_path = pg_catalog as $f$
declare
  c public.ai_conversations;
  n public.needs;
  v_active_price boolean;
  v_eur boolean;
begin
  if auth.role() is distinct from 'service_role'
  then raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501'; end if;
  v_eur := private.cur01_eur_correction(p_message);
  if not private.cur01_price_change_signal(p_message) then return false; end if;
  select * into c from public.ai_conversations
   where id = p_conversation_id and account_id = p_account_id for update;
  if not found or c.purpose <> 'NEED_INTAKE'
     or c.fact_schema_version <> 'NEED_FACT_V2' or c.status <> 'OPEN'
  then raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.bound_need_id is not null then
    select * into n from public.needs where id = c.bound_need_id for update;
    if not found or n.requester_account_id <> p_account_id
    then raise exception 'NEED_NOT_OWNED' using errcode = '42501'; end if;
  end if;
  select exists(
    select 1 from public.ai_structured_facts f
    where f.conversation_id = c.id and f.account_id = p_account_id
      and f.fact_key in ('need.price_mode','need.price_rsd','need.price_basis')
      and f.superseded_at is null
  ) into v_active_price;
  -- First-turn EUR is pending even when there is no earlier RSD fact. A
  -- later correction of a READY price also invalidates that proposal. For
  -- NORMAL, a non-EUR signal only applies to an already stored price.
  if not v_eur and c.price_resolution_state not in ('RSD_READY','OFFERS_READY')
     and not v_active_price and n.requester_price_rsd is null
  then return false; end if;
  if n.id is not null and n.status is distinct from 'DRAFT' then
    raise exception 'PRICE_CORRECTION_REQUIRES_REPLACEMENT'
      using errcode = '55000';
  end if;
  -- Do not mutate the accepted DRAFT Need: its edit-base marker must remain
  -- valid until a new signed review accepts the corrected price.
  update public.ai_structured_facts
     set superseded_at = statement_timestamp()
   where conversation_id = c.id and account_id = p_account_id
     and fact_key in ('need.price_mode','need.price_rsd','need.price_basis')
     and superseded_at is null;
  update public.ai_conversations
     set price_resolution_state = 'UNRESOLVED' where id = c.id;
  return true;
end $f$;

-- The provider is not authority for currency conversion. While correction is
-- pending, unsupported price proposals are removed, leaving unrelated facts
-- in this turn available to the existing writer. A new RSD amount requires an
-- exact number and RSD unit in owner text; offers require explicit owner text.
create function private.cur01_turn_price_filter(
  p_conversation_id uuid, p_message text, p_proposals jsonb
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog as $f$
declare
  v_state text;
  v_new_state text;
  v_amount integer;
  v_price jsonb;
  v_mode jsonb;
  v_basis jsonb;
  v_people integer;
  v_filtered jsonb;
  v_valid_price boolean := false;
  v_duplicate_price_keys boolean;
begin
  select price_resolution_state into v_state
    from public.ai_conversations where id = p_conversation_id;
  if not found then raise exception 'CONVERSATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_state = 'NORMAL' then
    return jsonb_build_object('state',v_state,'proposals',p_proposals);
  end if;
  if jsonb_typeof(p_proposals) is distinct from 'array'
  then raise exception 'PROPOSALS_INVALID' using errcode = '22023'; end if;
  -- Never validate the first model price key and then forward a later duplicate
  -- to the existing writer. Drop the entire price triple on ambiguity.
  select count(*) > count(distinct x.value->>'key')
    into v_duplicate_price_keys
    from jsonb_array_elements(p_proposals) x(value)
   where x.value->>'key' in
     ('need.price_mode','need.price_rsd','need.price_basis');
  select x into v_price from jsonb_array_elements(p_proposals) x
   where x->>'key' = 'need.price_rsd' limit 1;
  select x into v_mode from jsonb_array_elements(p_proposals) x
   where x->>'key' = 'need.price_mode' limit 1;
  select x into v_basis from jsonb_array_elements(p_proposals) x
   where x->>'key' = 'need.price_basis' limit 1;
  select (f.fact_value #>> '{}')::integer into v_people
    from public.ai_structured_facts f
   where f.conversation_id = p_conversation_id
     and f.fact_key = 'need.people_needed' and f.superseded_at is null
   limit 1;
  v_amount := private.cur01_explicit_rsd_price_amount(p_message);
  v_new_state := v_state;
  if not v_duplicate_price_keys and v_mode->>'value' = 'MY_PRICE'
     and v_price is not null and jsonb_typeof(v_price->'value') = 'number'
     and (v_price->>'value') ~ '^[0-9]{1,9}$'
     and (v_price->>'value')::integer = v_amount and v_amount > 0
     and v_people is not null and v_people >= 1
     and ((v_people = 1 and v_basis is null)
          or (v_people > 1 and v_basis->>'value' = 'TOTAL'
              and lower(p_message) ~ '(ukupno|укупно)')
          or (v_people > 1 and v_basis->>'value' = 'PER_PERSON'
              and lower(p_message) ~ '(po[[:space:]]+osobi|по[[:space:]]+особи)'))
  then v_new_state := 'RSD_READY'; v_valid_price := true;
  elsif not v_duplicate_price_keys and v_mode->>'value' = 'OFFERS'
        and v_price is null and v_basis is null
        and lower(btrim(p_message)) ~
          '^(ponude|понуде|(tražim|trazim|želim|zelim|prihvatam|hoću|желим|тражим|прихватам|хоћу)[[:space:]]+(ponude|ponudu|понуде|понуду))[.!?]?$'
  then v_new_state := 'OFFERS_READY'; v_valid_price := true;
  end if;
  if not v_valid_price then
    -- Unsupported model price proposals cannot leave the pending state or
    -- change an already ready price. Independent facts remain in this turn.
    select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
      into v_filtered
      from jsonb_array_elements(p_proposals) with ordinality x(value,ordinality)
     where x.value->>'key' not in
       ('need.price_mode','need.price_rsd','need.price_basis');
  else
    v_filtered := p_proposals;
  end if;
  return jsonb_build_object('state',v_new_state,'proposals',v_filtered);
end $f$;

create function private.cur01_review_price_ready(p_conversation_id uuid)
returns boolean
language plpgsql stable security definer set search_path = pg_catalog as $f$
declare v_state text; v_mode text; v_price jsonb; v_basis text; v_people integer;
begin
  select price_resolution_state into v_state from public.ai_conversations
   where id = p_conversation_id;
  if v_state = 'NORMAL' then return true; end if;
  if v_state = 'UNRESOLVED' or v_state is null then return false; end if;
  select f.fact_value #>> '{}' into v_mode from public.ai_structured_facts f
   where f.conversation_id = p_conversation_id and f.fact_key = 'need.price_mode'
     and f.superseded_at is null;
  select f.fact_value into v_price from public.ai_structured_facts f
   where f.conversation_id = p_conversation_id and f.fact_key = 'need.price_rsd'
     and f.superseded_at is null;
  select f.fact_value #>> '{}' into v_basis from public.ai_structured_facts f
   where f.conversation_id = p_conversation_id and f.fact_key = 'need.price_basis'
     and f.superseded_at is null;
  select (f.fact_value #>> '{}')::integer into v_people
    from public.ai_structured_facts f
   where f.conversation_id = p_conversation_id
     and f.fact_key = 'need.people_needed' and f.superseded_at is null;
  if v_state = 'OFFERS_READY' then
    return coalesce(v_mode = 'OFFERS' and v_price is null and v_basis is null,false);
  end if;
  return coalesce(v_state = 'RSD_READY' and v_mode = 'MY_PRICE'
    and jsonb_typeof(v_price) = 'number'
    and (v_price #>> '{}') ~ '^[0-9]{1,9}$'
    and (v_price #>> '{}')::integer > 0
    and v_people is not null and v_people >= 1
    and ((v_people = 1 and v_basis is null)
         or (v_people > 1 and v_basis in ('TOTAL','PER_PERSON'))),false);
end $f$;

revoke all on function private.cur01_eur_correction(text),
  private.cur01_price_change_signal(text),
  private.cur01_explicit_rsd_price_amount(text),
  private.cur01_claim_price_correction(uuid,uuid,text),
  private.cur01_turn_price_filter(uuid,text,jsonb),
  private.cur01_review_price_ready(uuid)
  from public,anon,authenticated,service_role;

-- A DEFAULT NORMAL alone would grandfather historically ambiguous prices.
-- Do not touch a PUBLISHED/SELECTION (or otherwise non-DRAFT) Need or a
-- closed intake conversation here: each needs a separate owner-visible
-- inventory/replacement or reopen decision. For OPEN draft/unbound intakes,
-- quarantine every preexisting price, even one that may have been valid,
-- because this migration cannot prove its original currency provenance.
-- Retain the old fact rows until a signed owner turn supersedes them: the
-- structural fact trigger forbids a privileged migration session from
-- silently impersonating an owner/service turn. Review/publish are blocked
-- by the marker in the meantime; UI must label the old value as stale.
do $history$
begin
  if exists (
    select 1 from public.ai_conversations c
    left join public.needs n on n.id = c.bound_need_id
      and n.requester_account_id = c.account_id
    where c.purpose = 'NEED_INTAKE'
      and (c.status is distinct from 'OPEN'
           or (c.bound_need_id is not null and
               (n.id is null or n.status is distinct from 'DRAFT'
                or c.fact_schema_version is distinct from 'NEED_FACT_V2')))
      and (n.requester_price_rsd is not null or exists (
        select 1 from public.ai_structured_facts f
        where f.conversation_id = c.id and f.account_id = c.account_id
          and f.fact_key in ('need.price_mode','need.price_rsd','need.price_basis')
          and f.superseded_at is null
      ))
  ) then
    raise exception 'CUR01_HISTORICAL_PUBLISHED_OR_CLOSED_PRICE_INVENTORY_REQUIRED'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.ai_conversations c
    where c.purpose = 'NEED_INTAKE' and c.status = 'OPEN'
      and c.fact_schema_version is distinct from 'NEED_FACT_V2'
      and exists (
        select 1 from public.ai_structured_facts f
        where f.conversation_id = c.id and f.account_id = c.account_id
          and f.fact_key in ('need.price_mode','need.price_rsd','need.price_basis')
          and f.superseded_at is null
      )
  ) then
    raise exception 'CUR01_HISTORICAL_LEGACY_PRICE_INVENTORY_REQUIRED'
      using errcode = '55000';
  end if;

  update public.ai_conversations c
     set price_resolution_state = 'UNRESOLVED'
   where c.purpose = 'NEED_INTAKE' and c.status = 'OPEN'
     and c.fact_schema_version = 'NEED_FACT_V2'
     and (c.bound_need_id is null or exists (
       select 1 from public.needs n where n.id = c.bound_need_id
         and n.requester_account_id = c.account_id and n.status = 'DRAFT'
     ))
     and (exists (
       select 1 from public.ai_structured_facts f
       where f.conversation_id = c.id and f.account_id = c.account_id
         and f.fact_key in ('need.price_mode','need.price_rsd','need.price_basis')
         and f.superseded_at is null
     ) or exists (
       select 1 from public.needs n where n.id = c.bound_need_id
         and n.requester_account_id = c.account_id
         and n.requester_price_rsd is not null
     ));

end $history$;

-- Preserve every unrelated current function body, owner, and ACL. Each
-- replacement is constrained by the observed DEV body hash and one exact
-- insertion point. A mismatch aborts the whole transaction.
create function pg_temp.cur01_patch(
  p_signature text, p_md5 text, p_needle text, p_replacement text
) returns void language plpgsql as $f$
declare v_oid oid; v_definition text; v_body text;
begin
  v_oid := to_regprocedure(p_signature);
  if v_oid is null then raise exception 'CUR01_FUNCTION_MISSING: %',p_signature; end if;
  select prosrc into v_body from pg_proc where oid = v_oid;
  if md5(v_body) is distinct from p_md5
  then raise exception 'CUR01_PREDECESSOR_DRIFT: %',p_signature; end if;
  v_definition := pg_get_functiondef(v_oid);
  if p_needle is null or length(p_needle) = 0
     or length(v_definition)-length(replace(v_definition,p_needle,''))
        is distinct from length(p_needle)
  then raise exception 'CUR01_PATCH_ANCHOR_DRIFT: %',p_signature; end if;
  execute replace(v_definition,p_needle,p_replacement);
end $f$;

select pg_temp.cur01_patch(
 'private.ai_claim_need_turn_context_v1(uuid,uuid,uuid,text,jsonb)',
 '114bd0b4b9d6e60a0abb0d0d64e63c69',
 'ctx:=private.ai_need_turn_context(c.id);attempt:=gen_random_uuid();',
 'perform private.cur01_claim_price_correction(p_account_id,c.id,p_user_message);' ||
 'ctx:=private.ai_need_turn_context(c.id);attempt:=gen_random_uuid();');

select pg_temp.cur01_patch(
 'private.ai_need_turn_context(uuid)',
 '972099be9f9429d87bc1566334e7d8f2',
 '''boundNeedId'',c.bound_need_id,''schema'',c.fact_schema_version,''editBase'',c.need_edit_base_fingerprint);',
 '''boundNeedId'',c.bound_need_id,''schema'',c.fact_schema_version,''editBase'',c.need_edit_base_fingerprint,' ||
 '''priceResolutionState'',c.price_resolution_state);');

-- The existing writer still owns validation, supersession, messages and
-- receipts. Filter only the price triple before its loop, then persist the
-- state in the same transaction as the accepted facts.
do $writer$
declare d text; v_oid oid := 'public.rpc_ai_apply_interview_turn_v2_service(uuid,uuid,text,text,text,jsonb)'::regprocedure;
begin
  if (select md5(prosrc) from pg_proc where oid = v_oid)
       is distinct from '14ace04bd1895f4d230d41baf13dd6d6'
  then raise exception 'CUR01_WRITER_DRIFT'; end if;
  d := pg_get_functiondef(v_oid);
  if length(d)-length(replace(d,'v_proposals jsonb:=coalesce(p_proposals,''[]''::jsonb);',''))
       <> length('v_proposals jsonb:=coalesce(p_proposals,''[]''::jsonb);')
     or length(d)-length(replace(d,'  for v_item in select value from jsonb_array_elements(v_proposals)',''))
       <> length('  for v_item in select value from jsonb_array_elements(v_proposals)')
     or length(d)-length(replace(d,'  insert into public.ai_messages(account_id,conversation_id,role,body)',''))
       <> length('  insert into public.ai_messages(account_id,conversation_id,role,body)')
  then raise exception 'CUR01_WRITER_ANCHOR_DRIFT'; end if;
  d := replace(d,
    'v_proposals jsonb:=coalesce(p_proposals,''[]''::jsonb);',
    'v_proposals jsonb:=coalesce(p_proposals,''[]''::jsonb); v_cur01 jsonb;');
  d := replace(d,
    '  for v_item in select value from jsonb_array_elements(v_proposals)',
    E'  v_cur01:=private.cur01_turn_price_filter(v_conv.id,p_user_message,v_proposals);\n' ||
    E'  v_proposals:=v_cur01->''proposals'';\n' ||
    E'  if v_cur01->>''state''=''OFFERS_READY'' then\n' ||
    E'    update public.ai_structured_facts set superseded_at=statement_timestamp()\n' ||
    E'    where conversation_id=v_conv.id and fact_key in(''need.price_rsd'',''need.price_basis'')\n' ||
    E'      and superseded_at is null;\n' ||
    E'  end if;\n' ||
    '  for v_item in select value from jsonb_array_elements(v_proposals)');
  d := replace(d,
    '  insert into public.ai_messages(account_id,conversation_id,role,body)',
    E'  if v_conv.price_resolution_state<>''NORMAL'' then\n' ||
    E'    update public.ai_conversations set price_resolution_state=v_cur01->>''state'' where id=v_conv.id;\n' ||
    E'  end if;\n' ||
    '  insert into public.ai_messages(account_id,conversation_id,role,body)');
  execute d;
end $writer$;

select pg_temp.cur01_patch(
 'private.ai_task_review_source(uuid)',
 '61c7ad3b2917bcd80ec43d2a74f726a3',
 'return d||jsonb_build_object(''media'',',
 'return (d||jsonb_build_object(''priceResolutionState'',' ||
 '(select price_resolution_state from public.ai_conversations where id=cid)))||jsonb_build_object(''media'',');

-- Both prepare routes return a server-stored canAccept=false review during
-- UNRESOLVED, with a specific owner prompt. The source hash includes state,
-- so a review made before correction cannot later be accepted.
select pg_temp.cur01_patch(
 'public.rpc_prepare_ai_task_review(uuid,timestamptz,jsonb)',
 '908e8e72762c1d01c2348266955396c5',
 '''canAccept'',jsonb_array_length(missing)=0 and location is not null',
 '''priceResolutionState'',c.price_resolution_state,' ||
 '''priceResolutionPrompt'',case when c.price_resolution_state=''UNRESOLVED'' ' ||
 'then ''Unesi nov iznos u RSD ili izaberi ponude.'' else null end,' ||
 '''canAccept'',private.cur01_review_price_ready(c.id) and jsonb_array_length(missing)=0 and location is not null');

select pg_temp.cur01_patch(
 'public.rpc_prepare_ai_task_review_taxonomy(uuid,timestamptz,jsonb)',
 'a0e25b32283e182da4bc2012c7194608',
 '''canAccept'',jsonb_array_length(missing)=0 and location is not null',
 '''priceResolutionState'',c.price_resolution_state,' ||
 '''priceResolutionPrompt'',case when c.price_resolution_state=''UNRESOLVED'' ' ||
 'then ''Unesi nov iznos u RSD ili izaberi ponude.'' else null end,' ||
 '''canAccept'',private.cur01_review_price_ready(c.id) and jsonb_array_length(missing)=0 and location is not null');

select pg_temp.cur01_patch(
 'public.rpc_accept_ai_task_review(uuid,text,uuid)',
 '3d1265c4ab2f9bad12393c5cccac996e',
 ' -- Acceptance is confined to the exact server-stored IDs',
 E' if not private.cur01_review_price_ready(c.id) then raise exception ''PRICE_UNRESOLVED'' using errcode=''55000''; end if;\n' ||
 E' if c.price_resolution_state in(''RSD_READY'',''OFFERS_READY'') then\n' ||
 E'   update public.ai_conversations set price_resolution_state=''NORMAL'' where id=c.id;\n' ||
 E' end if;\n' ||
 ' -- Acceptance is confined to the exact server-stored IDs');

-- Direct draft/edit writers may return an exact old receipt, but a new write
-- while the correction is pending must pass through the signed accept path.
select pg_temp.cur01_patch(
 'public.rpc_save_need_draft_from_review(uuid,uuid,text)',
 '39a3d39e60e8ab42f7e0269aba965280',
 '  if v_conv.status<>''OPEN'' then raise exception ''CONVERSATION_CLOSED''',
 '  if v_conv.price_resolution_state<>''NORMAL'' then raise exception ''PRICE_UNRESOLVED'' using errcode=''55000''; end if;' ||
 E'\n  if v_conv.status<>''OPEN'' then raise exception ''CONVERSATION_CLOSED''');

select pg_temp.cur01_patch(
 'public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)',
 '18896c1a6b80c7df09515aeb6851a145',
 '  v_region_token:=current_setting(''uskoci.need_region'',true);',
 '  if exists(select 1 from public.ai_conversations x where x.bound_need_id=p_need_id' ||
 ' and x.account_id=v_uid and x.price_resolution_state<>''NORMAL'') then' ||
 ' raise exception ''PRICE_UNRESOLVED'' using errcode=''55000''; end if;' ||
 E'\n  v_region_token:=current_setting(''uskoci.need_region'',true);');

-- The canonical publisher and evaluator both use this Need-locked context.
-- The plain SELECT of conversations does not take the reverse c->Need lock.
select pg_temp.cur01_patch(
 'private.need_publication_context(uuid,integer,uuid)',
 '47c471edbb45f07a71177b4fcfbeb617',
 '  select * into market from private.location_market_configs where country_code=n.task_country_code;',
 E'  if exists(select 1 from public.ai_conversations c where c.bound_need_id=n.id\n' ||
 E'    and c.account_id=n.requester_account_id and c.purpose=''NEED_INTAKE''\n' ||
 E'    and c.price_resolution_state<>''NORMAL'') then\n' ||
 E'    return result||jsonb_build_object(''code'',''PRICE_UNRESOLVED''); end if;\n' ||
 E'  if (n.mode=''MY_PRICE'' and (n.requester_price_rsd is null or n.requester_price_rsd<=0\n' ||
 E'       or (n.required_slots>1 and n.price_basis is null)))\n' ||
 E'     or (n.mode=''OFFERS'' and (n.requester_price_rsd is not null or n.price_basis is not null)) then\n' ||
 E'    return result||jsonb_build_object(''code'',''PRICE_INCONSISTENT''); end if;\n' ||
 '  select * into market from private.location_market_configs where country_code=n.task_country_code;');

-- A forward version also needs the exact retention column whitelist, closure
-- schema digest, policy source SHA/content SHA, erasure source binding and
-- isolated erasure proof. This source-only candidate intentionally cannot
-- pass that postcondition or commit.
do $blocked$
begin
  raise exception 'CUR01_FORWARD_REBIND_AND_ISOLATED_RACE_PROOF_REQUIRED'
    using errcode = '55000';
end $blocked$;
rollback;
