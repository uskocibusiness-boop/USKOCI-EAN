\set ON_ERROR_STOP on
begin;
-- Reproduce: identical city labels in DIFFERENT countries are incorrectly admitted.
update public.app_profiles set operating_country_code='BA';
select private.check_fit('22222222-2222-4222-8222-222222222222',true,true,true,'baseline_cross_country_false_positive');
rollback;
