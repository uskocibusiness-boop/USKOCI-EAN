-- R12: withdraw the exact unverified v1.0-20261108 publication snapshot.
-- The historical migration asserted counsel approval and provider contracts
-- without verified evidence. These rows remain intact as audit history, but
-- must no longer be advertised as an active published/legal-ready bundle.
-- No document text, provider claim, user data, function, grant or policy is
-- created, replaced or deleted here. The hashes are PostgreSQL JSONB snapshot
-- drift guards, not cryptographic attestations of legal approval.
--
-- Preimage: scripts/sql/capacity2_legal_quarantine_20261108.preimage.json
-- Recovery is forward-only: independently verified documents and processor
-- contracts must be published under a new version. Never reactivate these
-- unverified claims as an automated rollback.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
set local timezone='UTC';
set local datestyle='ISO, MDY';

-- EXCLUSIVE permits ordinary reads, but waits for an in-flight acceptance's
-- FOR SHARE table lock before inspecting evidence. A subsequent acceptance
-- cannot read the old active rows while this withdrawal is committing.
lock table private.legal_document_versions in exclusive mode;
lock table private.processor_map_sets, private.processor_map_entries in share row exclusive mode;
lock table public.account_legal_acceptance_events in share mode;

do $quarantine$
declare
  target_documents uuid[];
  target_map uuid;
  snapshot_hash text;
  affected integer;
  retired_time timestamptz := clock_timestamp();
begin
  select array_agg(d.id order by d.document_kind),
         md5(jsonb_agg(to_jsonb(d)-'id' order by d.document_kind)::text)
    into target_documents, snapshot_hash
  from private.legal_document_versions d
  where d.version_label='v1.0-20261108';
  if array_length(target_documents,1) is distinct from 2
     or snapshot_hash is distinct from '2964fb16b92e7eadf972bdc8b4609447' then
    raise exception 'R12_QUARANTINE_DOCUMENT_PREIMAGE_DRIFT';
  end if;

  select md5(jsonb_agg(to_jsonb(m)-'id' order by m.map_version)::text)
    into snapshot_hash
  from private.processor_map_sets m where m.map_version='v1.0-20261108';
  if snapshot_hash is distinct from '2f8f4030c6614fac2f01ad95e72832e9' then
    raise exception 'R12_QUARANTINE_MAP_PREIMAGE_DRIFT';
  end if;
  select m.id into strict target_map
  from private.processor_map_sets m where m.map_version='v1.0-20261108';

  select md5(jsonb_agg(to_jsonb(e)-'id'-'map_id' order by e.provider_code)::text)
    into snapshot_hash
  from private.processor_map_entries e where e.map_id=target_map;
  if snapshot_hash is distinct from '99522f63e25915805bd1369e64703ea0' then
    raise exception 'R12_QUARANTINE_ENTRIES_PREIMAGE_DRIFT';
  end if;

  if exists (
    select 1 from public.account_legal_acceptance_events a
    where a.terms_document_id=any(target_documents)
       or a.privacy_document_id=any(target_documents)
  ) then
    raise exception 'R12_QUARANTINE_ACCEPTANCE_REQUIRES_REVIEW';
  end if;

  update private.legal_document_versions
  set is_active=false, retired_at=retired_time
  where id=any(target_documents);
  get diagnostics affected=row_count;
  if affected<>2 then raise exception 'R12_QUARANTINE_DOCUMENT_COUNT'; end if;

  update private.processor_map_sets set retired_at=retired_time
  where id=target_map;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'R12_QUARANTINE_MAP_COUNT'; end if;

  if coalesce((public.rpc_get_legal_bundle()->>'ready')::boolean,true)
     or exists(select 1 from private.processor_map_sets m
               where m.retired_at is null and m.effective_at<=statement_timestamp()) then
    raise exception 'R12_QUARANTINE_READINESS_NOT_CLOSED';
  end if;
end
$quarantine$;

commit;
