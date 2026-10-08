# RETIRE-V1 — uklanjanje zamenjenih serverskih funkcija (red S04) — PRIPREMLJENO, NIJE DOKAZANO, NIJE PRIMENJENO

**Status:** SAMO IZVORNI KOD. Kanonski DEV `leqcwgzvjsxugfgzdmth` tek posle zelenog dokaza na jednokratnoj bazi (FAIL pre / PASS posle, revert tačan, sertifikat nepomaknut), po vlasnikovom stalnom nalogu za dokazane pakete („DA, PRIMENJUJ DOKAZANE PAKETE SAM“, 7. 10.) i vlasnikovom odobrenju čišćenja starih funkcija (8. 10.: „kreni na ono što je loše urađeno, stare funkcije, urednost“). Nijedan klijent ne traži novi build.

## Zašto
Tabla (`docs/control/stanje.json`, `server_ume_aplikacija_ne_koristi`) broji 11 `rpc_*` koje aplikacija ne zove (+2 koje zove samo Edge). Čitanje DEV-a 8. 10. uveče (read-only) kaže koje od njih smeju da odu odmah.

## Analiza 11 funkcija (DEV 8. 10., md5 = `md5(prosrc)` prvih 8)

| Funkcija (potpis) | md5 | Zovu je druge funkcije | U digestu sertifikata | Odluka |
|---|---|---|---|---|
| `rpc_ai_open_conversation(text)` | 36b32569 | 0 | ne | **UKLONITI** (stari AI otvarač; klijent koristi `rpc_ai_open_need_conversation_owned_v2`; `scripts/pre_html_source_inventory.cjs` je već vodi kao „retired“) |
| `rpc_confirm_need_edit(uuid,integer,text,jsonb)` | 450b6f8d | 0 | ne | **UKLONITI** (zamenjena sa `rpc_confirm_need_edit_from_review_v2`) |
| `rpc_get_my_safety_report(uuid)` | bc347bd8 | 0 | ne | **UKLONITI** (zamenjena sa `rpc_read_my_safety_report_command`) |
| `rpc_list_my_agreements()` | f4c56eca | 0 | ne | **UKLONITI** (zamenjena sa `rpc_list_my_agreements_page`, EX-04) |
| `rpc_agreement_invalidation_visible_v1(uuid)` | a6fa339b | 2 | DA | OSTAJE (pomera sertifikat) |
| `rpc_ai_open_need_conversation_v2()` | 666dfd22 | 1 | ne | OSTAJE dok se ne prepiše pozivalac (verovatno `_owned_v2` je omotač) |
| `rpc_ai_read_need_location_turn_v1(uuid,uuid)` | 48d137c3 | 2 | DA | OSTAJE |
| `rpc_closure_api_guard()` | 09d52bad | 2 | DA | OSTAJE (čuvar zatvaranja naloga, ACL i za anon) |
| `rpc_get_push_device(text)` | df3deab0 | 1 | ne | OSTAJE dok se ne prepiše pozivalac (`_owned` varijanta) |
| `rpc_send_agreement_message(uuid,text)` | d9a37338 | 1 | ne | OSTAJE dok se ne prepiše pozivalac (`_v2` verovatno delegira) |
| `rpc_storage_account_open()` | 7350621e | 5 | ne | OSTAJE (pomoćna, 5 pozivalaca) |

Provera u repou (8. 10.): nijedna od 4 za uklanjanje nema poziv u `src/`, `supabase/functions/`, `scripts/`, `.maestro/` (pogoci su samo podnizovi novijih imena i spisak „retired“). Stari APK-ovi: na vlasnikovom telefonu je APK 4e0ea506; produkcija ne postoji; DEV ima 5 test naloga — rizik starog klijenta je samo emulator/stari lokalni build.

## Šta paket radi (`candidate.sql`)
1. Pred-čuvari u istoj transakciji: sertifikat spreman; za svaku od 4 funkcije: postoji sa tačno tim potpisom, `md5(prosrc)` jednak pinu, nijedna druga funkcija u `public`/`private` je ne pominje, nema okidača ni cron posla koji je zove; nijedna nije u telima tri digest funkcije.
2. `DROP FUNCTION` za 4 funkcije.
3. Post-čuvari: sve 4 nestale; oba digesta sertifikata jednaka pre/posle; sertifikat spreman; broj `rpc_*` = 254.
Svako odbijanje je errcode `55000`; nema `40001` (B24).

## Šta Codex mora PRE primene
1. **`revert.sql`:** generisati iz DEV-a pre primene (ne iz migracija — telo na DEV-u je merodavno): za svaku od 4 `select pg_get_functiondef(oid)` + `grant execute … to <uloge iz ACL>` (ACL iz tabele: `rpc_ai_open_conversation` i `rpc_list_my_agreements` imaju i `service_role`), + komentar za `rpc_confirm_need_edit` (`obj_description` nije null). Pin md5 definicija: 067f372e, 1d36828f, aec8c83a, 8b499cf5.
2. **Dokaz** `.github/workflows/retire-v1-proof.yml` na jednokratnoj bazi (lanac kao DISCOVERY-GRAD): PRE = 4 funkcije postoje i pozivi iz klijenta ne postoje (grep gate u CI); PRIMENA; POSLE = 4 nestale, svi klijentski tokovi koji su ranije zvali zamene i dalje prolaze (postojeći dokazi EX-04 S2/PKG-006/EX-06E), sertifikat nepomaknut; REVERT vraća bajt-tačne definicije.
3. Primena: `preflight.readonly.sql` → `candidate.in-transaction.sql` kroz konektor (baza prvo izmeri otkucani tekst, md5 = fajl) → `postflight.readonly.sql` → potvrda (`write_application_receipt.py`), registar red S04, tabla.

## Drugi talas RETIRE (posle ovog)
Prepisati tri pozivaoca da ne zavise od starih tela (`rpc_ai_open_need_conversation_v2`, `rpc_get_push_device`, `rpc_send_agreement_message`), pa ih ukloniti; `rpc_storage_account_open` ostaje kao pomoćna ili se premešta u `private`.
