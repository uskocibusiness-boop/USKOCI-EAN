-- Reverse only the EMPTY unused candidate. Never delete imported catalogue data.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table private.worker_coverage_regions_v1 in access exclusive mode;
do $$begin
 if exists(select 1 from private.worker_coverage_regions_v1) then
   raise exception 'COVERAGE_REVERT_REFUSES_NONEMPTY_CATALOG';
 end if;
end$$;
drop function private.evaluate_worker_coverage_v1(jsonb,text,jsonb);
drop table private.worker_coverage_regions_v1;
commit;
