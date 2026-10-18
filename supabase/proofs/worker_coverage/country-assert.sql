\set ON_ERROR_STOP on
begin;
select private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'same_city_same_country');
update public.app_profiles set operating_country_code='BA';
select private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'same_city_other_country');
do $$begin
 if (private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',true)->>'matches')::boolean is distinct from false then
   raise exception 'FIRST_REFUSAL_DIVERGENCE';
 end if;
end$$;
update public.app_profiles set operating_country_code=null;
select private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'unknown_worker_country');
update public.app_profiles set operating_country_code='RS';
update public.needs set task_country_code=null;
select private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'unknown_task_country');
update public.needs set task_country_code='RS', approximate_city='Other city';
select private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'different_city');
update public.needs set approximate_city='';
update public.app_profiles set city='';
select private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'empty_cities');
update public.needs set execution_location_mode='REMOTE', task_country_code=null;
select private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'remote_no_geographic_gate');
-- Existing measured radius behavior stays unchanged; this patch is only the label fallback.
update public.needs set execution_location_mode='STATIONARY', approximate_lat=45, approximate_lng=20;
update public.worker_match_preferences set approximate_lat=45, approximate_lng=20;
select private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'measured_distance_unchanged');
update public.worker_match_preferences set approximate_lat=40;
select private.check_fit('22222222-2222-4222-8222-222222222222',true,false,false,'outside_radius');
update public.needs set execution_location_mode='REMOTE', category_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
select private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'taxonomy_path_unchanged');
update private.taxonomy_match_scope_control_v1 set enabled=true;
do $$begin
 if private.worker_need_fit_v1('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',false)->'hard'
   is distinct from '["SIGNED_SERVICE_SCOPE_REQUIRED"]'::jsonb then raise exception 'SIGNED_SCOPE_BYPASSED'; end if;
end$$;
rollback;
