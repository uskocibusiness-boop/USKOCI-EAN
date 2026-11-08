-- R13 P0: never execute matching work inside the task publication transaction.
-- The existing durable enqueue and minute recovery Cron remain the authority.
-- Exact preimage/postimage guards prevent silent drift or privilege changes.
-- Real old body MD5 ea56b40af1ebd687d1713f75e619392c.
-- Independently verified in BEGIN/ROLLBACK on DEV before application.
-- To revert safely, restore the exact previous function only after evaluating
-- lock duration and the risk of synchronous matching; no data rollback.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
do $r13$
declare
  v_before text;
  v_new_definition text;
  v_old_source text;
  v_acl aclitem[];
  v_owner oid;
  v_privileged boolean;
  v_settings text[];
begin
  select pg_get_functiondef(p.oid),p.prosrc,p.proacl,p.proowner,p.prosecdef,p.proconfig
    into strict v_before,v_old_source,v_acl,v_owner,v_privileged,v_settings
  from pg_proc p where p.oid='private.enqueue_on_need_change()'::regprocedure;
  if md5(v_old_source)<>'ea56b40af1ebd687d1713f75e619392c'
     or not v_privileged or v_settings is distinct from array['search_path=pg_catalog']::text[]
     or v_old_source not like '%perform private.enqueue_dispatch(new.id, statement_timestamp());%'
     or v_old_source not like '%perform private.dispatch_next_wave(new.id);%' then
    raise exception 'R13_SHORT_PUBLICATION_PREIMAGE_DRIFT';
  end if;
  if (select count(*) from pg_trigger where tgfoid='private.enqueue_on_need_change()'::regprocedure
      and not tgisinternal and tgname='needs_enqueue_dispatch')<>1 then
    raise exception 'R13_SHORT_PUBLICATION_TRIGGER_DRIFT';
  end if;
  v_new_definition := replace(v_before,$old$      -- Instant dispatch on initial publication
      if new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED') then
        begin
          perform private.dispatch_next_wave(new.id);
        exception when others then
          null;
        end;
      end if;$old$,$new$      -- Durable dispatch_schedule is serviced outside the publication transaction.$new$);
  if v_new_definition=v_before or position('perform private.dispatch_next_wave' in v_new_definition)>0
     or position('perform private.enqueue_dispatch' in v_new_definition)=0 then
    raise exception 'R13_SHORT_PUBLICATION_REPLACEMENT_INCOMPLETE';
  end if;
  execute v_new_definition;
  if not exists(select 1 from pg_proc p
    where p.oid='private.enqueue_on_need_change()'::regprocedure
      and md5(p.prosrc)='3f7d263b9e1724e683c9c920ed782550'
      and p.proowner=v_owner and p.proacl is not distinct from v_acl
      and p.prosecdef=v_privileged and p.proconfig is not distinct from v_settings) then
    raise exception 'R13_SHORT_PUBLICATION_POSTIMAGE_DRIFT';
  end if;
end
$r13$;
commit;
