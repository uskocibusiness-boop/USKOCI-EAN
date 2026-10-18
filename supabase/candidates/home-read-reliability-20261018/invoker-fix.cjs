'use strict';
// Forward repair after the first DEV role probe exposed a column-grant mismatch.
// The original candidate and its applied history are intentionally not rewritten.
const {plan,body,md5,replaceOnce}=require('./package.cjs');
const original=plan().find(row=>row.signature.startsWith('rpc_list_open_tasks_v3('));
const definition=replaceOnce(original.after,'m.requester_account_id <> v_uid',
  `not exists (select 1 from public.app_profiles own_profile
              where own_profile.id = m.requester_profile_id and own_profile.account_id = v_uid)`);
const afterMd5=md5(body(definition));
const literal=value=>"'"+value.replaceAll("'","''")+"'";
function migrationSql(){return `-- Bounded Home preview using the existing own-profile RLS/identity binding.
-- Never grant access to needs.requester_account_id or change SECURITY INVOKER.
set local lock_timeout='5s';
set local statement_timeout='30s';
do $fix$
declare v_oid oid:='public.${original.signature}'::regprocedure; b pg_proc%rowtype; a pg_proc%rowtype; c text;
begin
 select * into strict b from pg_proc where oid=v_oid;
 if md5(b.prosrc)<>${literal(original.body_md5)} or b.prosecdef
    or b.proacl::text<>${literal(original.acl)} or b.proconfig::text<>'{search_path=pg_catalog}'
    or pg_get_userbyid(b.proowner)<>'postgres' then raise exception 'HOME_INVOKER_FIX_PREIMAGE_DRIFT'; end if;
 c:=private.closure_source_digest_v5();
 execute ${literal(definition)};
 select * into strict a from pg_proc where oid=v_oid;
 if md5(a.prosrc)<>${literal(afterMd5)} or (to_jsonb(a)-'prosrc') is distinct from (to_jsonb(b)-'prosrc')
    then raise exception 'HOME_INVOKER_FIX_POSTIMAGE_DRIFT'; end if;
 if c is null or private.closure_source_digest_v5() is distinct from c then raise exception 'HOME_INVOKER_FIX_CLOSURE_DRIFT'; end if;
end $fix$;
`;}
module.exports={original,definition,afterMd5,migrationSql};
