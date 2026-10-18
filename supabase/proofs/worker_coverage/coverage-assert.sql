\set ON_ERROR_STOP on
begin;
-- Deliberately FICTIONAL geometries. These are not the boundaries of Serbia,
-- Vojvodina or any real city, and prove no provider/geocoding accuracy.
insert into private.worker_coverage_regions_v1 values
 ('fixture-v1','box','RS','Synthetic square',extensions.ST_Multi(extensions.ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))',4326)),'urn:uskoci:synthetic-test','SYNTHETIC_FIXTURE_ONLY'),
 ('fixture-v2','box','RS','Different version',extensions.ST_Multi(extensions.ST_GeomFromText('POLYGON((10 10,12 10,12 12,10 12,10 10))',4326)),'urn:uskoci:synthetic-test','SYNTHETIC_FIXTURE_ONLY'),
 ('fixture-v1','hole','RS','Synthetic hole',extensions.ST_Multi(extensions.ST_GeomFromText('POLYGON((0 0,4 0,4 4,0 4,0 0),(1 1,1 2,2 2,2 1,1 1))',4326)),'urn:uskoci:synthetic-test','SYNTHETIC_FIXTURE_ONLY');

create function pg_temp.pt(lat numeric,lng numeric,country text default 'RS',uncertainty numeric default 0)
returns jsonb language sql as $$select jsonb_build_object('countryCode',country,'latitude',lat,'longitude',lng,'uncertaintyMeters',uncertainty)$$;
create function pg_temp.check_area(areas jsonb,mode text,points jsonb,wanted text,label text)
returns void language plpgsql as $$declare r jsonb;begin
 r:=private.evaluate_worker_coverage_v1(areas,mode,points);
 if r->>'state' is distinct from wanted or (r->>'area')::boolean is distinct from (wanted in ('MATCH','NOT_REQUIRED')) then
   raise exception 'COVERAGE_PROOF_FAIL %: expected %, got %',label,wanted,r;
 end if;
end$$;

do $$declare
 country jsonb:='[{"kind":"COUNTRY","countryCode":"RS"}]';
 circles jsonb:='[{"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":0,"longitude":0,"radiusKm":10},{"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":2,"longitude":2,"radiusKm":10}]';
 region jsonb:='[{"kind":"ADMIN_REGION","countryCode":"RS","catalogVersion":"fixture-v1","regionId":"box"}]';
 hole jsonb:='[{"kind":"ADMIN_REGION","countryCode":"RS","catalogVersion":"fixture-v1","regionId":"hole"}]';
 r jsonb; bad jsonb; points jsonb; mode text;
begin
 perform pg_temp.check_area(null,'REMOTE',null,'NOT_REQUIRED','remote_without_city_or_circle');
 perform pg_temp.check_area('[]','STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'COVERAGE_REQUIRED','empty_coverage');
 perform pg_temp.check_area('{}','STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'COVERAGE_REQUIRED','wrong_coverage_type');
 perform pg_temp.check_area(country,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'MATCH','country_identity');
 perform pg_temp.check_area(country,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1,'BA')),'OUTSIDE','other_country');
 perform pg_temp.check_area(country,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1,null)),'LOCATION_REQUIRED','unknown_country');
 perform pg_temp.check_area(country,'STATIONARY',null,'LOCATION_REQUIRED','missing_location');
 perform pg_temp.check_area(country,'STATIONARY','[]','LOCATION_REQUIRED','empty_location');
 perform pg_temp.check_area(country,'STATIONARY','{}','LOCATION_REQUIRED','wrong_location_type');
 perform pg_temp.check_area(country,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1),pg_temp.pt(2,2)),'LOCATION_REQUIRED','extra_stationary_point');
 perform pg_temp.check_area(country,'POINT_TO_POINT',jsonb_build_array(pg_temp.pt(1,1)),'LOCATION_REQUIRED','missing_route_end');
 perform pg_temp.check_area(country,'MULTI_STOP',jsonb_build_array(pg_temp.pt(1,1)),'LOCATION_REQUIRED','missing_route_stops');
 foreach mode in array array['AREA_BASED','unknown',null] loop
   perform pg_temp.check_area(country,mode,jsonb_build_array(pg_temp.pt(1,1)),'LOCATION_REQUIRED','unsupported_mode_no_centroid_guess');
 end loop;
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(0,0)),'MATCH','first_city');
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(2,2)),'MATCH','second_city');
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'OUTSIDE','no_invented_circle_between_cities');
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(0,0,'BA')),'OUTSIDE','circle_country_is_explicit');
 perform pg_temp.check_area(circles,'POINT_TO_POINT',jsonb_build_array(pg_temp.pt(0,0),pg_temp.pt(2,2)),'MATCH','both_working_stops');
 perform pg_temp.check_area(circles,'POINT_TO_POINT',jsonb_build_array(pg_temp.pt(0,0),pg_temp.pt(1,1)),'OUTSIDE','end_outside');
 perform pg_temp.check_area(circles,'MULTI_STOP',jsonb_build_array(pg_temp.pt(0,0),pg_temp.pt(1,1),pg_temp.pt(2,2)),'OUTSIDE','middle_stop_outside');
 perform pg_temp.check_area(circles,'MULTI_STOP',jsonb_build_array(pg_temp.pt(0,0),pg_temp.pt(2,2),pg_temp.pt(0,0)),'MATCH','all_stops_covered');
 r:=private.evaluate_worker_coverage_v1(circles,'POINT_TO_POINT',jsonb_build_array(pg_temp.pt(0,0),pg_temp.pt(2,2)));
 if r->'matchedAreasByPoint'<>'[[0],[1]]'::jsonb then raise exception 'EXPLANATION_INDEX_MISMATCH'; end if;
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(0,0.089,'RS',500)),'LOCATION_REQUIRED','circle_boundary_uncertainty');
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(0,0.095,'RS',1000)),'LOCATION_REQUIRED','circle_outside_but_uncertain');
 perform pg_temp.check_area(circles,'STATIONARY',jsonb_build_array(pg_temp.pt(0,0.11,'RS',100)),'OUTSIDE','circle_definitely_outside');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'MATCH','inside_region');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,2)),'MATCH','exact_boundary_included');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,3)),'OUTSIDE','outside_region');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1,'RS',1000)),'MATCH','inside_with_margin');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,2,'RS',500)),'LOCATION_REQUIRED','uncertain_boundary');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,2.001,'RS',500)),'LOCATION_REQUIRED','uncertain_near_outside');
 perform pg_temp.check_area(region,'STATIONARY',jsonb_build_array(pg_temp.pt(1,3,'RS',500)),'OUTSIDE','known_outside_with_margin');
 perform pg_temp.check_area(hole,'STATIONARY',jsonb_build_array(pg_temp.pt(1.5,1.5)),'OUTSIDE','polygon_hole');
 perform pg_temp.check_area(hole,'STATIONARY',jsonb_build_array(pg_temp.pt(0.5,0.5)),'MATCH','polygon_shell');
 perform pg_temp.check_area(jsonb_set(region,'{0,catalogVersion}','"fixture-v2"'),'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'OUTSIDE','version_pinned');
 perform pg_temp.check_area(jsonb_set(region,'{0,catalogVersion}','"missing"'),'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'CATALOG_UNAVAILABLE','unknown_version');
 perform pg_temp.check_area(jsonb_set(region,'{0,countryCode}','"BA"'),'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'INVALID_COVERAGE','region_country_mismatch');
 perform pg_temp.check_area(country||jsonb_set(region,'{0,catalogVersion}','"missing"'),'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'CATALOG_UNAVAILABLE','no_ignore_stale_selection');
 for bad in select value from jsonb_array_elements('[null,1,"text",{}, {"kind":"COUNTRY"}, {"kind":"COUNTRY","countryCode":"rs"}, {"kind":"COUNTRY","countryCode":"RS","confirmed":true}, {"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":"0","longitude":0,"radiusKm":10}, {"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":91,"longitude":0,"radiusKm":10}, {"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":0,"longitude":181,"radiusKm":10}, {"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":0,"longitude":0,"radiusKm":201}, {"kind":"LOCAL_CIRCLE","countryCode":"RS","latitude":0,"longitude":0,"radiusKm":0}, {"kind":"ADMIN_REGION","countryCode":"RS","regionId":"box"}]') loop
   perform pg_temp.check_area(jsonb_build_array(bad),'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'INVALID_COVERAGE','malformed_selection');
 end loop;
 for bad in select value from jsonb_array_elements('[null,1,"text",{}, {"countryCode":"RS","latitude":1,"longitude":1}, {"countryCode":"RS","latitude":"1","longitude":1,"uncertaintyMeters":0}, {"countryCode":"RS","latitude":91,"longitude":1,"uncertaintyMeters":0}, {"countryCode":"RS","latitude":1,"longitude":181,"uncertaintyMeters":0}, {"countryCode":"RS","latitude":1,"longitude":1,"uncertaintyMeters":-1}, {"countryCode":"RS","latitude":1,"longitude":1,"uncertaintyMeters":5001}, {"countryCode":"RS","latitude":1,"longitude":1,"uncertaintyMeters":0,"address":"private"}]') loop
   perform pg_temp.check_area(country,'STATIONARY',jsonb_build_array(bad),'LOCATION_REQUIRED','malformed_or_private_point');
 end loop;
 select jsonb_agg(pg_temp.pt(1,1)) into points from generate_series(1,33);
 perform pg_temp.check_area(country,'MULTI_STOP',points,'LOCATION_REQUIRED','point_limit_no_truncation');
 select jsonb_agg(country->0) into bad from generate_series(1,33);
 perform pg_temp.check_area(bad,'STATIONARY',jsonb_build_array(pg_temp.pt(1,1)),'INVALID_COVERAGE','area_limit_no_truncation');
 -- A geography result is NOT service consent, profile ownership or a full match.
 if r ? 'matches' then raise exception 'CORE_MUST_NOT_CLAIM_FULL_MATCH'; end if;
 if has_function_privilege('anon','private.evaluate_worker_coverage_v1(jsonb,text,jsonb)','EXECUTE')
   or has_function_privilege('authenticated','private.evaluate_worker_coverage_v1(jsonb,text,jsonb)','EXECUTE')
   or has_function_privilege('service_role','private.evaluate_worker_coverage_v1(jsonb,text,jsonb)','EXECUTE')
   or has_table_privilege('authenticated','private.worker_coverage_regions_v1','SELECT') then
   raise exception 'UNEXPECTED_COVERAGE_ACCESS';
 end if;
 if not (select relrowsecurity from pg_class where oid='private.worker_coverage_regions_v1'::regclass) then
   raise exception 'COVERAGE_RLS_MISSING';
 end if;
end$$;
-- Every fixture row and temporary helper disappears; guarded revert remains empty.
rollback;
