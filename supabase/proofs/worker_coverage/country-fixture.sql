\set ON_ERROR_STOP on
-- Extends the existing DISPOSABLE fixture. All identities and helpers are synthetic.
alter table public.needs add column task_country_code text, add column category_id uuid;
alter table public.app_profiles add column operating_country_code text;
create table private.taxonomy_match_scope_control_v1(singleton boolean primary key, enabled boolean);
insert into private.taxonomy_match_scope_control_v1 values(true,false);
create function private.taxonomy_scope_eligible_v1(uuid,uuid) returns boolean language sql as $$select false$$;
create function private.taxonomy_requirement_tier_inherited_v1(uuid,uuid) returns text language sql as $$select 'EXACT'::text$$;
update public.needs set category='Čišćenje', task_country_code='RS';
update public.app_profiles set operating_country_code='RS';
revoke all on function private.worker_need_fit_v1(uuid,uuid,boolean) from public;
