-- PED01 containment: disable unsafe in-place edits of published tasks.
-- This is NOT staged/atomic replacement. New tasks, private draft edits and
-- acknowledged historic command recovery remain on their existing contracts.
-- Preserve ownership checks, all ACLs, immutable reviews and existing data.
set local lock_timeout='5s';

do $patch0$
declare d text;
begin
 d:=pg_get_functiondef('public.rpc_accept_ai_task_review(uuid,text,uuid)'::regprocedure);
 if md5(d) <> 'e4955e0eac5b4e80be51489096c6e5ae' then raise exception 'PED01_PREIMAGE_CHANGED: rpc_accept_ai_task_review(uuid,text,uuid)'; end if;
 if strpos(d,$old$  then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
 end if;$old$)=0 then raise exception 'PED01_ANCHOR_MISSING'; end if;
 execute replace(d,$old$  then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
 end if;$old$,$new$  then raise exception 'TASK_REVIEW_STALE' using errcode='PT409'; end if;
  if n.status in ('PUBLISHED','SELECTION') then
   raise exception 'PUBLISHED_TASK_EDIT_NOT_READY' using errcode='P0001';
  end if;
 end if;$new$);
end $patch0$;

do $patch1$
declare d text;
begin
 d:=pg_get_functiondef('public.rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'::regprocedure);
 if md5(d) <> '20214f44c2155cd633aeb8ada4280edf' then raise exception 'PED01_PREIMAGE_CHANGED: rpc_confirm_need_edit_from_review(uuid,integer,uuid,text)'; end if;
 if strpos(d,$old$  v_from_status:=v_need.status;$old$)=0 then raise exception 'PED01_ANCHOR_MISSING'; end if;
 execute replace(d,$old$  v_from_status:=v_need.status;$old$,$new$  -- PED01: until staged replacement is implemented, never unpublish a live task.
  if v_need.status in ('PUBLISHED','SELECTION') then
    raise exception 'PUBLISHED_TASK_EDIT_NOT_READY' using errcode='P0001';
  end if;
  v_from_status:=v_need.status;$new$);
end $patch1$;

do $patch2$
declare d text;
begin
 d:=pg_get_functiondef('public.rpc_confirm_need_edit(uuid,integer,text,jsonb)'::regprocedure);
 if md5(d) <> '1d36828fd9ea35849f999842d06721f4' then raise exception 'PED01_PREIMAGE_CHANGED: rpc_confirm_need_edit(uuid,integer,text,jsonb)'; end if;
 if strpos(d,$old$  v_before := private.need_material_snapshot(v_need.id);$old$)=0 then raise exception 'PED01_ANCHOR_MISSING'; end if;
 execute replace(d,$old$  v_before := private.need_material_snapshot(v_need.id);$old$,$new$  -- PED01: this legacy writer only edits public tasks; successful replay above remains readable.
  raise exception 'PUBLISHED_TASK_EDIT_NOT_READY' using errcode='P0001';

  v_before := private.need_material_snapshot(v_need.id);$new$);
end $patch2$;
