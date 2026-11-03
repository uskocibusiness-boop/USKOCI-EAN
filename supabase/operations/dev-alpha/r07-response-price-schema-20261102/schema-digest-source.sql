CREATE OR REPLACE FUNCTION private.closure_schema_digest_v5_139()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,
 'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(pg_get_constraintdef(x.oid) order by x.conname) from pg_constraint x where x.conrelid=c.oid),
 'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),md5(p.prosrc)) order by t.tgname) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid=c.oid and not t.tgisinternal)) order by c.oid::regclass::text),'[]')::text,'UTF8'),'sha256'),'hex')
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname in('public','private') or c.oid='storage.objects'::regclass) and c.relkind in('r','p');
$function$
