# 14 — Security, Privacy & Account Deletion

## 1. Autorizacija i RLS granice

- **Nula direktnih upisa sa klijenta:** Sve `public.*` tabele imaju opozvane `INSERT`, `UPDATE` i `DELETE` dozvole za `anon` i `authenticated`. Svaka promena prolazi kroz `SECURITY DEFINER` RPC funkcije (sa `SET search_path TO 'pg_catalog'`) i zaštićena je transakcionim okidačima (`private.guard_need_write`, `private.guard_response_write`, `private.guard_agreement_write`, `private.guard_execution_write`, `private.guard_app_profile_write`).
- **Kolonska zaštita zadataka (`pkg045b`):** `authenticated` uloga ima `SELECT` dozvolu samo na 29 bezbednih kolona tabele `public.needs`.
- **Priprema za 30.10.2026. (`GRANT SELECT`):** Dodaje se eksplicitni `GRANT SELECT ON TABLE ... TO authenticated` za 11 tabela koje su se oslanjale na podrazumevane privilegije (`marketplace_responses`, `marketplace_response_versions`, `need_selections`, `agreements`, `agreement_versions`, `agreement_execution`, `user_activity_events`, `ai_structured_facts`, `worker_match_preferences`, `dispatch_rounds`, `opportunity_deliveries`).

---

## 2. Privatnost lokacije i kontakta

1. **Fizičko razdvajanje tabele lokacije:**
   - Javni pin (`public.needs.approximate_lat/lng`) zaokružen je na 2 decimale (~1.1 km mreža).
   - Tačna adresa i ulazne napomene žive u `public.need_sensitive`, čiji RLS dozvoljava čitanje samo vlasniku zadatka ili izvršiocu u aktivnom Dogovoru kome je naručilac eksplicitno dodelio `access_grants` (`channel = 'EXACT_LOCATION'`, `status = 'GRANTED'`).
2. **Svesno i smerno deljenje telefona i adrese:**
   - Sklapanje Dogovora ne otkriva automatski ni telefon ni adresu.
   - Svaka strana svesno deli sopstveni telefon (`rpc_set_contact_grant(agreement_id, 'PHONE', true)`), a naručilac svesno deli tačnu lokaciju (`EXACT_LOCATION`).
   - Kandidat `supabase/candidates/r01_phone_read_consent_20261009.sql` dodaje `private.safety_grant_valid` i `expires_at` proveru u sve 3 read RPC funkcije za Dogovor (`rpc_get_agreement_workspace`, `rpc_list_my_agreements`, `rpc_list_my_agreements_page`).

---

## 3. Brisanje i anonimizacija naloga (`uskoci-account-closure-worker`)

- Implementirana je trofazna mašina stanja (`private.closure_executions_v5`):
  1. **`STORAGE_DELETE`:** Briše fajlove korisnika iz `profile-media` i `data-export-artifacts` bucket-a.
  2. **`RELATIONAL_REDACT`:** Kroz `rpc_redact_account_closure_step_service` briše ili anonimizuje podatke kroz svih **67 relacija** u `public` i `private` šemi (`20261021104455_closure_taxonomy_archive_copy_coverage.sql`).
  3. **`AUTH_IDENTITY_ERASE`:** Anonimizuje `auth.users` email/telefon/metapodatke, briše OAuth identitete, MFA faktore i aktivne sesije (`rpc_scrub_closed_auth_subject_service`).
- **Otvorena stavka za DEV primenu:** Primeniti pripremljenu migraciju `20261021104455_closure_taxonomy_archive_copy_coverage.sql` na DEV serveru kako bi `private.closure_source_digest_v5()` uključio nove oktobarske tabele taksonomije.
