\set ON_ERROR_STOP on
-- Isolated PostgreSQL ONLY: 60 work identities, 20,000 worker skill confirmations,
-- 10,000 publisher-reviewed task revisions. No production credentials/notification.
-- Installed locked catalog is unchanged. Only synthetic operator-owned rows.
CREATE TEMP TABLE synthetic_kind_labels (n integer PRIMARY KEY, label text UNIQUE NOT NULL);
INSERT INTO synthetic_kind_labels(n,label)
SELECT ordinality::integer,label FROM unnest(ARRAY[
 'Dresiranje pasa',
 'Podešavanje 3D štampača',
 'Fotografisanje događaja',
 'Servis bicikala',
 'Popravka laptopa',
 'Popravka 3D štampača',
 'Šivenje odeće',
 'Prevođenje dokumenata',
 'Čuvanje ljubimaca',
 'Priprema kolača',
 'Video montaža',
 'Uređivanje dvorišta',
 'Servis klima uređaja',
 'Postavljanje laminata',
 'Izrada nameštaja',
 'Čišćenje prozora',
 'Presvlačenje nameštaja',
 'Bojenje ograda',
 'Održavanje bazena',
 'Popravka roletni',
 'Montaža kuhinje',
 'Servis računara',
 'Popravka telefona',
 'Ugradnja brave',
 'Dekoracija proslave',
 'Pakovanje pošiljaka',
 'Čišćenje nameštaja',
 'Pranje tepiha',
 'Održavanje travnjaka',
 'Transport nameštaja',
 'Časovi matematike',
 'Podučavanje programiranja',
 'Časovi engleskog jezika',
 'Lektura tekstova',
 'Grafički dizajn',
 'Izrada logotipa',
 'Digitalizacija fotografija',
 'Obrada videa',
 'Popravka odeće',
 'Pletenje džempera',
 'Pravljenje torti',
 'Organizacija događaja',
 'Montaža polica',
 'Popravka vrata',
 'Sastavljanje kreveta',
 'Restauracija stolica',
 'Orezivanje voćaka',
 'Sadnja cveća',
 'Čišćenje garaže',
 'Pranje automobila',
 'Zamena guma bicikla',
 'Zamena ekrana telefona',
 'Restauracija fotografija',
 'Postavljanje tapeta',
 'Uređenje terase',
 'Popravka stolova',
 'Pomoć pri selidbi',
 'Podešavanje rutera',
 'Popravka usisivača',
 'Fotografisanje proizvoda'
]::text[]) WITH ORDINALITY AS labels(label,ordinality);

INSERT INTO private.work_taxonomy_categories
 (id,canonical_key,label,source,catalog_version,state)
SELECT ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  private.taxonomy_normalize_v1(label), label,'SYSTEM',1,'ESTABLISHED'
FROM synthetic_kind_labels;

INSERT INTO private.work_taxonomy_worker_capabilities
 (worker_account_id,category_id,confirmed_at,origin)
SELECT ('91000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       ('90000000-0000-4000-8000-'||lpad((((i-1)%60)+1)::text,12,'0'))::uuid,
       statement_timestamp(),'WORKER_CONFIRMED'
FROM generate_series(1,20000) g(i);

INSERT INTO public.needs(id)
SELECT ('92000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid
FROM generate_series(1,10000) g(i);

INSERT INTO private.work_taxonomy_need_snapshots
 (need_id,need_revision,category_id,catalog_version,reviewed_by_requester,source,classification_state)
SELECT ('92000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       1,
       ('90000000-0000-4000-8000-'||lpad((((i-1)%60)+1)::text,12,'0'))::uuid,
       1,true,'SYSTEM_MIGRATED','CONFIRMED'
FROM generate_series(1,10000) g(i);

DO $prove$
DECLARE n integer; positives integer; negatives integer; t timestamptz;
BEGIN
 SELECT count(*) INTO n FROM private.work_taxonomy_categories;
 IF n<>60 OR
   (SELECT count(*) FROM private.work_taxonomy_worker_capabilities)<>20000 OR
   (SELECT count(*) FROM private.work_taxonomy_need_snapshots)<>10000
 THEN RAISE EXCEPTION 'TAXONOMY_SCALE_SEED_INCOMPLETE'; END IF;
 t:=clock_timestamp();
 SELECT count(*) INTO positives FROM generate_series(1,600) g(i)
 WHERE private.taxonomy_capability_tier_v1(
  ('92000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,
  ('91000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid)='EXACT';
 SELECT count(*) INTO negatives FROM generate_series(1,600) g(i)
 WHERE private.taxonomy_capability_tier_v1(
  ('92000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,1,
  ('91000000-0000-4000-8000-'||lpad((i+1)::text,12,'0'))::uuid)='NO_SAFE_MATCH';
 IF positives<>600 OR negatives<>600 THEN
  RAISE EXCEPTION 'TAXONOMY_SCALE_WRONG_POSITIVE_OR_NEGATIVE_%_%',positives,negatives;
 END IF;
 RAISE NOTICE 'TAXONOMY_SCALE_PASS kind_ids=60 confirmed_workers=20000 need_snapshots=10000 positive=600 negative=600 elapsed_ms=%',
 round((extract(epoch from clock_timestamp()-t)*1000)::numeric,1);
END $prove$;

-- A changed task must not inherit the old revision's worker eligibility.
UPDATE private.work_taxonomy_need_snapshots
SET reviewed_by_requester=false, classification_state='NEEDS_CLARIFICATION',
    category_id=NULL
WHERE need_id='92000000-0000-4000-8000-000000000001' AND need_revision=1;
DO $prove$
BEGIN
 IF private.taxonomy_capability_tier_v1(
  '92000000-0000-4000-8000-000000000001',1,
  '91000000-0000-4000-8000-000000000001') <> 'NO_SAFE_MATCH'
 THEN RAISE EXCEPTION 'UNREVIEWED_REVISED_TASK_LEAK'; END IF;
 -- The disposable fixture has no push/opportunity-delivery tables or transport.
 RAISE NOTICE 'TAXONOMY_REVIEW_REVISION_DENIAL_PASS';
END $prove$;
