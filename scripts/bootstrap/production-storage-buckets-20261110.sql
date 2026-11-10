-- Empty private storage buckets for the new USKOCI production project.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
DO $preflight$ BEGIN
  IF (SELECT system_identifier::text FROM pg_control_system()) <> '7703760980994770283'
     OR current_user <> 'postgres'
     OR EXISTS (SELECT 1 FROM storage.buckets)
     OR EXISTS (SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'USKOCI_PROD_STORAGE_PREIMAGE_MISMATCH';
  END IF;
END $preflight$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES
  ('agreement-voice','agreement-voice',false,4194304,ARRAY['audio/mp4']),
  ('data-export-artifacts','data-export-artifacts',false,8388608,ARRAY['application/json']),
  ('profile-media','profile-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp']);

DO $postflight$ BEGIN
  IF (SELECT count(*) FROM storage.buckets WHERE NOT public AND type='STANDARD'
       AND versioning_status='DISABLED') <> 3
     OR EXISTS (SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'USKOCI_PROD_STORAGE_POSTFLIGHT_FAILED';
  END IF;
END $postflight$;
COMMIT;
