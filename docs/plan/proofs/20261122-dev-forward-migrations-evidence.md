# DEV prenos 22.11.2026 — regije i neograničena područja rada

Projekat: `leqcwgzvjsxugfgzdmth` (DEV). PROD nije diran. Izdanje: NO-GO.

| Verzija | Naziv | Ledger md5 | Postimage (md5 prosrc) |
|---|---|---|---|
| 20261122084958 | worker_regions_districts_unlimited_areas | d844ee2d91d06d1377726a0e02550cc5 | validate_worker_areas_v1 e1a3173af2838612a72e3fcf2ec3bce8, worker_area_fit_v1 9cb9babbdafee1111d41f66cfa35ed6b, worker_region_districts_v1 e1ccd35f4ae75ff02a375a434dea7998, worker_region_label_v1 d009489b915ad7a82bdc33707409fa15, rs_district_at_v1 e5a1c857266f3d119a1f256f92a75f2e |

- Odluka vlasnika 22.11.2026: bez praktične granice broja gradova (tehnička granica 200), sve regije Srbije (Vojvodina, Beograd, Šumadija i Zapadna Srbija, Južna i Istočna Srbija, Bačka, Banat, Srem, svih 24 okruga); Balkan kasnije, kad zadaci izađu van Srbije. Kosovo nije uključeno (čeka odluku vlasnika).
- Preimage proveren u migraciji: validate 8f1cd592eb48eb9da31e0af02c0bdd2e, fit 859d6f0a9ab940793b7cdab7ddbab2cd.
- Granice: © OpenStreetMap contributors (ODbL), admin_level 6, 25 relacija, pojednostavljeno ~100 m; lokalno provereno 31 mesto, u migraciji 6 tačaka + REGION fit/validacija.
- Probni prolaz sa ROLLBACK na DEV-u prošao; DEV posle probe nepromenjen (readback). Primena preko `supabase db query --linked -f` sa upisom u `supabase_migrations.schema_migrations` iz istog fajla.
- Readback posle: 25 okruga, Bačka Topola RS-01, Surčin RS-00, Vranje RS-24, REGION Srem → Sremska Mitrovica TRUE, RLS na tabeli uključen. Ledger posle primene: 384.
- Rollback: `scripts/sql/rollback_worker_regions_preimage_20261122.sql`.
