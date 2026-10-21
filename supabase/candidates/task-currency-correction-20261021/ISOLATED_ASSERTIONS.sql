-- CUR01 assertions for a verified disposable database after a completed
-- forward port is installed. This file is read-only and does not create
-- fixture data. Set cur01.proof_* values to IDs from isolated signed fixtures.
-- Execute each stage in a fresh transaction after the named signed action.
-- C00A (closed, unbound priced intake) is a pre-port expected-failure test:
-- the candidate transaction must raise the inventory error and roll back.
-- This post-port read-only assertion cannot represent that failed install.
-- This file was NOT executed against DEV.
begin;
set local statement_timeout = '15s';
do $proof$
declare
  v_stage text := current_setting('cur01.proof_stage',true);
  v_owner uuid := nullif(current_setting('cur01.proof_owner',true),'')::uuid;
  v_conversation uuid := nullif(current_setting('cur01.proof_conversation',true),'')::uuid;
  v_need uuid := nullif(current_setting('cur01.proof_need',true),'')::uuid;
  v_expected_revision integer := nullif(current_setting('cur01.proof_need_revision',true),'')::integer;
  v_expected_old_price integer := nullif(current_setting('cur01.proof_old_price_rsd',true),'')::integer;
  v_expected_new_price integer := nullif(current_setting('cur01.proof_new_price_rsd',true),'')::integer;
  v_expected_mode text := nullif(current_setting('cur01.proof_expected_mode',true),'');
  v_expected_basis text := nullif(current_setting('cur01.proof_expected_price_basis',true),'');
  v_state text;
  v_status text;
  v_revision integer;
  v_price integer;
  v_need_mode text;
  v_need_basis text;
  v_active_price_keys integer;
  v_mode text;
  v_basis text;
  v_people integer;
  v_new_price integer;
begin
  if current_setting('cur01.proof_disposable_identity_verified',true)
       is distinct from 'CUR01_DISPOSABLE_CONFIRMED'
     or v_stage not in ('AFTER_HISTORY_QUARANTINE','AFTER_CORRECTION','AFTER_RSD_TURN','AFTER_OFFERS_TURN',
                       'AFTER_ACCEPT','AFTER_FAILED_PROVIDER','AFTER_BASIS_ONLY_CORRECTION',
                       'AFTER_SHORT_AMOUNT_CORRECTION','AFTER_DUPLICATE_PRICE_PROPOSAL')
      or v_owner is null or v_conversation is null or v_need is null
      or v_expected_revision is null or v_expected_old_price is null
      or (v_stage='AFTER_RSD_TURN' and v_expected_new_price is null)
      or (v_stage='AFTER_ACCEPT' and (
           v_expected_mode is null or v_expected_mode not in ('MY_PRICE','OFFERS')
           or (v_expected_mode='MY_PRICE' and (
             v_expected_new_price is null or v_expected_new_price <= 0))
           or (v_expected_mode='OFFERS' and (
             v_expected_new_price is not null or v_expected_basis is not null))))
   then raise exception 'CUR01_PROOF_FIXTURE_OR_DISPOSABLE_IDENTITY_MISSING'; end if;
  select c.price_resolution_state into v_state
    from public.ai_conversations c
   where c.id=v_conversation and c.account_id=v_owner
     and c.purpose='NEED_INTAKE' and c.bound_need_id=v_need;
  if not found then raise exception 'CUR01_PROOF_CONVERSATION_MISMATCH'; end if;
  select n.status,n.revision,n.requester_price_rsd,n.mode,n.price_basis
    into v_status,v_revision,v_price,v_need_mode,v_need_basis from public.needs n
   where n.id=v_need and n.requester_account_id=v_owner;
  if not found then raise exception 'CUR01_PROOF_NEED_MISMATCH'; end if;
  select count(*) into v_active_price_keys from public.ai_structured_facts f
   where f.conversation_id=v_conversation and f.superseded_at is null
     and f.fact_key in ('need.price_mode','need.price_rsd','need.price_basis');
  select f.fact_value#>>'{}' into v_mode from public.ai_structured_facts f
   where f.conversation_id=v_conversation and f.fact_key='need.price_mode'
     and f.superseded_at is null;
  select f.fact_value#>>'{}' into v_basis from public.ai_structured_facts f
   where f.conversation_id=v_conversation and f.fact_key='need.price_basis'
     and f.superseded_at is null;
  select (f.fact_value#>>'{}')::integer into v_people from public.ai_structured_facts f
   where f.conversation_id=v_conversation and f.fact_key='need.people_needed'
     and f.superseded_at is null;
  select (f.fact_value#>>'{}')::integer into v_new_price from public.ai_structured_facts f
   where f.conversation_id=v_conversation and f.fact_key='need.price_rsd'
     and f.superseded_at is null;
  if v_stage='AFTER_HISTORY_QUARANTINE' then
    if v_state is distinct from 'UNRESOLVED' or v_active_price_keys<1
       or v_status<>'DRAFT' or v_revision<>v_expected_revision
       or v_price is distinct from v_expected_old_price
       or private.cur01_review_price_ready(v_conversation)
    then raise exception 'CUR01_HISTORICAL_QUARANTINE_INVARIANT_FAILED'; end if;
    if (private.need_publication_context(v_need,v_revision,v_owner)->>'code')
         is distinct from 'PRICE_UNRESOLVED'
    then raise exception 'CUR01_HISTORICAL_PUBLICATION_GATE_FAILED'; end if;
  elsif v_stage in ('AFTER_CORRECTION','AFTER_FAILED_PROVIDER',
                    'AFTER_BASIS_ONLY_CORRECTION','AFTER_SHORT_AMOUNT_CORRECTION',
                    'AFTER_DUPLICATE_PRICE_PROPOSAL') then
    if v_state is distinct from 'UNRESOLVED' or v_active_price_keys<>0
       or v_status<>'DRAFT' or v_revision<>v_expected_revision
       or v_price is distinct from v_expected_old_price
       or private.cur01_review_price_ready(v_conversation)
    then raise exception 'CUR01_UNRESOLVED_INVARIANT_FAILED'; end if;
    if (private.need_publication_context(v_need,v_revision,v_owner)->>'code')
         is distinct from 'PRICE_UNRESOLVED'
    then raise exception 'CUR01_PUBLICATION_GATE_FAILED'; end if;
  elsif v_stage='AFTER_RSD_TURN' then
    if v_state is distinct from 'RSD_READY' or v_mode is distinct from 'MY_PRICE'
       or v_new_price is distinct from v_expected_new_price
       or v_people is null or v_people < 1
       or v_active_price_keys <> case when v_people=1 then 2 else 3 end
       or (v_people=1 and v_basis is not null)
       or (v_people>1 and (v_basis is null or v_basis not in ('TOTAL','PER_PERSON')))
       or v_status<>'DRAFT' or v_revision<>v_expected_revision
       or v_price is distinct from v_expected_old_price
       or not private.cur01_review_price_ready(v_conversation)
    then raise exception 'CUR01_RSD_READY_INVARIANT_FAILED'; end if;
  elsif v_stage='AFTER_OFFERS_TURN' then
    if v_state is distinct from 'OFFERS_READY' or v_mode is distinct from 'OFFERS'
       or v_active_price_keys<>1 or v_basis is not null or v_new_price is not null
       or v_status<>'DRAFT' or v_revision<>v_expected_revision
       or v_price is distinct from v_expected_old_price
       or not private.cur01_review_price_ready(v_conversation)
    then raise exception 'CUR01_OFFERS_READY_INVARIANT_FAILED'; end if;
  elsif v_stage='AFTER_ACCEPT' then
    if v_state is distinct from 'NORMAL' or v_revision<=v_expected_revision
       or v_status is distinct from 'DRAFT'
       or v_need_mode is distinct from v_expected_mode
       or (v_expected_mode='MY_PRICE' and (
         v_price is distinct from v_expected_new_price
         or v_need_basis is distinct from v_expected_basis
         or v_people is null or v_people<1
         or (v_people=1 and v_expected_basis is not null)
         or (v_people>1 and (v_expected_basis is null
             or v_expected_basis not in ('TOTAL','PER_PERSON')))))
       or (v_expected_mode='OFFERS' and (
         v_price is not null or v_need_basis is not null))
    then raise exception 'CUR01_ACCEPT_INVARIANT_FAILED'; end if;
  end if;
  if has_table_privilege('authenticated','public.ai_conversations','UPDATE')
     or has_table_privilege('authenticated','public.ai_structured_facts','UPDATE')
     or has_table_privilege('anon','public.ai_conversations','UPDATE')
     or has_table_privilege('anon','public.ai_structured_facts','UPDATE')
  then raise exception 'CUR01_DIRECT_CLIENT_WRITE_OPEN'; end if;
end $proof$;
rollback;
