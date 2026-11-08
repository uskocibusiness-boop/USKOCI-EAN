-- 20261108130000_r13_instant_push_and_capacity_dispatch_20261108.sql
-- R13: Instant Event-Driven Push, 300K Capacity Dispatch Configuration, and FK Indexes

-- 1. Update marketplace dispatch configurations for 300K user scalability
-- Waves start at 50-100 workers, response targets expanded to 500 ceiling, candidate budget up to 5000.
UPDATE private.marketplace_config
SET value = jsonb_build_object(
  'waveSizes', '[50, 100, 250, 500, 1000, 2000, 3000]'::jsonb,
  'windowMinutes', 10,
  'candidateLimit', 5000,
  'candidateBudget', jsonb_build_object(
    '_note', 'CAPACITY_300K_20261108',
    'baseLimit', 100,
    'hardMaxLimit', 5000,
    'responseRate', 0.25,
    'safetyFactor', 3,
    'avgCoveragePerResponse', 1.3,
    'maxRoutingCallsPerWave', 50
  ),
  'targetResponses', 500,
  'fallbackToFixedWaves', true
),
updated_at = statement_timestamp()
WHERE key = 'dispatch_normal';

UPDATE private.marketplace_config
SET value = jsonb_build_object(
  'waveSizes', '[100, 200, 500, 1000, 2000]'::jsonb,
  'windowMinutes', 3,
  'candidateLimit', 3000,
  'candidateBudget', jsonb_build_object(
    '_note', 'CAPACITY_300K_URGENT_20261108',
    'baseLimit', 100,
    'hardMaxLimit', 3000,
    'responseRate', 0.35,
    'safetyFactor', 3,
    'avgCoveragePerResponse', 1.3,
    'maxRoutingCallsPerWave', 50
  ),
  'targetResponses', 500,
  'fallbackToFixedWaves', true
),
updated_at = statement_timestamp()
WHERE key = 'dispatch_urgent';

UPDATE private.marketplace_config
SET value = jsonb_set(
  jsonb_set(value, '{remoteStopAfterResponses}', '500'::jsonb),
  '{workerNotifyPerTransaction}', '1000'::jsonb
),
updated_at = statement_timestamp()
WHERE key = 'match_v1_dispatch';

-- 2. Six Foreign Key and Filter Indexes for High Concurrency
CREATE INDEX IF NOT EXISTS idx_push_attempts_device_id ON public.notification_push_attempts (device_id);
CREATE INDEX IF NOT EXISTS idx_opp_deliveries_worker_profile_id ON public.opportunity_deliveries (worker_profile_id);
CREATE INDEX IF NOT EXISTS idx_opp_deliveries_dispatch_round_id ON public.opportunity_deliveries (dispatch_round_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_account_id ON public.ai_messages (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_resp_worker_profile_id ON public.marketplace_responses (worker_profile_id);
CREATE INDEX IF NOT EXISTS idx_push_attempts_active_queue ON public.notification_push_attempts (next_attempt_at) 
WHERE transport_state IN ('PENDING', 'RETRYABLE', 'TICKET_PENDING');

-- 3. Instant Push Event-Driven Trigger Infrastructure
CREATE OR REPLACE FUNCTION private.wake_push_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
declare
  v_base text;
  v_key text;
begin
  select s.decrypted_secret into v_base from vault.decrypted_secrets s where s.name = 'uskoci_edge_base_url';
  select s.decrypted_secret into v_key from vault.decrypted_secrets s where s.name = 'uskoci_edge_worker_key';
  if v_base is not null and v_key is not null then
    perform net.http_post(
      url := v_base || '/functions/v1/uskoci-push-transport',
      body := '{"action":"tick"}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_key),
      timeout_milliseconds := 15000
    );
  end if;
exception when others then
  null;
end;
$$;

CREATE OR REPLACE FUNCTION private.trg_wake_push_worker_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
begin
  if exists (select 1 from new_table where channel = 'PUSH' and state = 'CREATED') then
    perform private.wake_push_worker();
  end if;
  return null;
end;
$$;

DROP TRIGGER IF EXISTS trg_wake_push_on_delivery ON public.notification_deliveries;
CREATE TRIGGER trg_wake_push_on_delivery
  AFTER INSERT ON public.notification_deliveries
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.trg_wake_push_worker_on_delivery();

CREATE OR REPLACE FUNCTION private.enqueue_on_need_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
begin
 if auth.role()='service_role' then
  if TG_OP in ('UPDATE','DELETE') and private.closure_redaction_allowed_v5(TG_RELID,TG_OP,to_jsonb(OLD),case when TG_OP='UPDATE' then to_jsonb(NEW) else null end) then
   if TG_OP='DELETE' then return OLD;end if;return NEW;
  end if;
 end if;

  if new.status in ('PUBLISHED','SELECTION') then
    if tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.revision is distinct from new.revision then
      perform private.enqueue_dispatch(new.id, statement_timestamp());
      -- Matching runs through durable dispatch_schedule and its Cron worker.
      -- Forward repair: 20261108141444_r13_short_publication_transaction_20261108.sql; no inline wave.
    end if;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    delete from private.dispatch_schedule where need_id = new.id;
  end if;
  return new;
end;
$function$;

-- 4. Worker default availability without manual 'available_now' toggling
-- Workers without custom recurring rules are available by default unless an explicit UNAVAILABLE window is set.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('private.worker_need_time_tier_v1(uuid,uuid)'::regprocedure) INTO v_def;
  IF position('if not has_rules and false' in v_def) > 0 THEN
    v_def := replace(v_def, 'if not has_rules and false', 'if not has_rules');
    EXECUTE v_def;
  END IF;
END $$;

